"""
Prompt construction for the LLM-backed endpoints.

Each prompt follows the same shape: a fixed system prompt stating the rules
(SQL dialect, read-only constraint, output format) and a per-request user
message built from the actual schema/question/error at hand. Keeping the
rules in the system prompt (not repeated in every user message) is what
lets them stay short and focused on the one thing that changes.
"""

from app.schemas import (
    AgentStepRecord,
    AgentStepRequest,
    ColumnInsightSummary,
    DatasetSchema,
    InsightsRequest,
    SummarizeRequest,
)

# Both /generate-sql and /fix-sql target this JSON shape. Grounding the model
# in this exact structure (rather than asking for prose) is what lets the
# backend parse the response without a fragile "extract the SQL from markdown"
# step, and is what the sql_safety validator and the frontend both expect.
_SQL_JSON_CONTRACT = (
    'Réponds UNIQUEMENT avec un objet JSON valide, sans balise markdown, sans texte '
    'avant ou après, de la forme exacte :\n'
    '{"sql": "<requête SQL ou null>", "explanation": "<courte explication en français, '
    '1 à 2 phrases, pour un utilisateur non technique>"}'
)

# The read-only rules are restated here (not just enforced by sql_safety.py)
# because a request that's rejected before it ever reaches the LLM is better
# than one the LLM had no chance of getting right — grounding beats catching.
_READ_ONLY_RULES = (
    "1. Tu génères UNIQUEMENT des requêtes en lecture seule : SELECT (avec CTE \"WITH\" "
    "autorisé). Il est strictement interdit de générer INSERT, UPDATE, DELETE, DROP, "
    "CREATE, ALTER, TRUNCATE, ATTACH, COPY, PRAGMA, ou toute autre instruction qui "
    "modifierait des données, un schéma, ou l'état du moteur.\n"
    "2. Tu utilises UNIQUEMENT la table et les colonnes listées dans le schéma fourni. "
    "N'invente jamais de colonne ou de table.\n"
    '3. Les noms de colonnes contenant des espaces, accents ou caractères spéciaux '
    'DOIVENT être entourés de guillemets doubles, par exemple "Montant achat".\n'
    "4. Utilise la syntaxe DuckDB (proche de PostgreSQL) : DATE_TRUNC, STRFTIME, EPOCH, "
    "ROUND, STDDEV, etc.\n"
    '5. Si la question est ambiguë, hors sujet par rapport aux données disponibles, ou '
    'ne peut pas être traduite en SQL à partir du schéma fourni, retourne "sql": null '
    'et explique pourquoi dans "explanation".'
)

GENERATE_SQL_SYSTEM_PROMPT = f"""Tu es un assistant expert en SQL, spécialisé dans le moteur DuckDB.

Ta tâche : transformer une question posée en français par un utilisateur non technique \
en une requête SQL DuckDB qui répond à sa question, à partir du schéma de données fourni.

RÈGLES STRICTES :
{_READ_ONLY_RULES}

FORMAT DE RÉPONSE :
{_SQL_JSON_CONTRACT}"""

FIX_SQL_SYSTEM_PROMPT = f"""Tu es un assistant expert en SQL, spécialisé dans le moteur DuckDB.

Une requête SQL que tu as générée précédemment a échoué à l'exécution. Ta tâche est de \
la corriger pour qu'elle s'exécute correctement, tout en continuant à répondre à la \
question d'origine de l'utilisateur.

RÈGLES STRICTES (elles s'appliquent aussi à la version corrigée) :
{_READ_ONLY_RULES}

FORMAT DE RÉPONSE :
{_SQL_JSON_CONTRACT}"""

SUMMARIZE_SYSTEM_PROMPT = """Tu es un assistant qui explique en français, à un utilisateur \
non technique, le résultat d'une requête SQL qu'il a demandée via une question en langage \
naturel.

RÈGLES :
1. Réponds en 1 à 3 phrases maximum, en français courant, sans jargon technique ni SQL.
2. Base-toi UNIQUEMENT sur les données fournies (question, requête exécutée, résultat). \
N'invente aucun chiffre qui ne figure pas dans le résultat.
3. Si le résultat est vide, dis-le clairement plutôt que d'inventer une réponse.
4. Si le résultat a été tronqué, tu peux le mentionner brièvement mais sans en faire le \
sujet principal de ta réponse.

FORMAT DE RÉPONSE :
Réponds UNIQUEMENT avec un objet JSON valide, sans balise markdown, sans texte avant ou \
après, de la forme exacte :
{"summary": "<réponse en langage naturel>"}"""


def _format_schema(schema: DatasetSchema) -> str:
    lines = [f'Table : "{schema.table_name}"', "Colonnes disponibles :"]
    for col in schema.columns:
        samples = ", ".join(col.sample_values) if col.sample_values else "aucun exemple disponible"
        lines.append(f'- "{col.name}" (type : {col.type}) — exemples de valeurs : {samples}')
    return "\n".join(lines)


def build_generate_sql_user_message(question: str, schema: DatasetSchema) -> str:
    return f"{_format_schema(schema)}\n\nQuestion de l'utilisateur : {question}"


def build_fix_sql_user_message(
    question: str, sql: str, error_message: str, schema: DatasetSchema
) -> str:
    return (
        f"{_format_schema(schema)}\n\n"
        f"Question originale de l'utilisateur : {question}\n\n"
        f"Requête SQL générée précédemment (incorrecte) :\n{sql}\n\n"
        f"Message d'erreur retourné par DuckDB lors de l'exécution :\n{error_message}\n\n"
        "Corrige la requête pour qu'elle s'exécute correctement sur DuckDB."
    )


def _format_result_rows(request: SummarizeRequest) -> str:
    if not request.rows:
        return "(aucune ligne dans le résultat)"
    header = " | ".join(request.columns)
    lines = [header, "-" * len(header)]
    for row in request.rows:
        lines.append(" | ".join(str(row.get(col, "")) for col in request.columns))
    return "\n".join(lines)


def build_summarize_user_message(request: SummarizeRequest) -> str:
    truncation_note = (
        f"\n\n(Résultat tronqué : {request.row_count} lignes au total, seules les "
        f"{len(request.rows)} premières sont montrées ci-dessus.)"
        if request.truncated
        else ""
    )
    return (
        f"Question de l'utilisateur : {request.question}\n\n"
        f"Requête SQL exécutée :\n{request.sql}\n\n"
        f"Résultat ({request.row_count} ligne(s) au total) :\n"
        f"{_format_result_rows(request)}"
        f"{truncation_note}"
    )


# The model only ever sees aggregate statistics, never raw rows — this is
# both a privacy property and, more importantly here, what keeps it from
# inventing anything: it literally has no numbers available except the ones
# in this prompt, so "don't hallucinate" is enforceable rather than aspirational.
INSIGHTS_SYSTEM_PROMPT = """Tu es un analyste de données qui repère les observations les plus \
intéressantes dans un jeu de données, pour un utilisateur non technique, en français.

RÈGLES STRICTES :
1. Tu génères entre 3 et 5 observations, pas plus, pas moins.
2. Chaque observation doit être basée UNIQUEMENT sur les statistiques fournies ci-dessous. \
N'invente JAMAIS un chiffre, un pourcentage ou une tendance qui n'apparaît pas explicitement \
dans les données fournies.
3. Ne mentionne jamais une évolution temporelle ou un pourcentage de croissance/baisse : ces \
statistiques ne sont pas fournies, donc tu ne peux pas les connaître.
4. Priorise les observations les plus utiles ou surprenantes : problèmes de qualité de données \
(valeurs manquantes, doublons), colonnes avec beaucoup de valeurs aberrantes, forte corrélation \
entre deux colonnes numériques, forte dominance d'une catégorie, grande étendue de valeurs.
5. Chaque observation est concise (une phrase, 200 caractères maximum), concrète, et mentionne \
un chiffre réel issu des statistiques quand c'est pertinent.
6. Classe chaque observation dans une catégorie parmi exactement : "qualite" (valeurs manquantes \
ou doublons), "distribution" (étendue, valeurs aberrantes), "correlation" (relation entre deux \
colonnes), "categorie" (dominance d'une valeur catégorielle), "general" (observation d'ensemble).

FORMAT DE RÉPONSE :
Réponds UNIQUEMENT avec un objet JSON valide, sans balise markdown, sans texte avant ou après, \
de la forme exacte :
{"insights": [{"text": "...", "category": "..."}, ...]}"""


def _format_column_insight(column: ColumnInsightSummary) -> str:
    header = f'"{column.name}" (type : {column.type}, {column.missing_percent}% de valeurs manquantes)'
    if column.type == "number":
        detail = (
            f"moyenne={column.mean}, médiane={column.median}, min={column.min}, max={column.max}, "
            f"écart-type={column.std_dev}, valeurs aberrantes={column.outlier_percent}%"
        )
    elif column.type == "date":
        detail = f"période : {column.date_min} à {column.date_max} ({column.range_days} jours)"
    elif column.top_values:
        top = ", ".join(f"{v.value} ({v.percent}%)" for v in column.top_values)
        detail = f"{column.unique_count} valeurs distinctes, les plus fréquentes : {top}"
    else:
        detail = f"{column.unique_count} valeurs distinctes" if column.unique_count is not None else ""
    return f"- {header}\n  {detail}"


def build_insights_user_message(request: InsightsRequest) -> str:
    lines = [
        f"Jeu de données : {request.row_count} lignes, {request.column_count} colonnes.",
        f"Lignes en double : {request.duplicate_row_count}.",
        f"Pourcentage global de cellules manquantes : {request.missing_percent}%.",
        "",
        "Statistiques par colonne :",
        *[_format_column_insight(col) for col in request.columns],
    ]

    if request.top_correlations:
        lines.append("")
        lines.append("Corrélations notables entre colonnes numériques :")
        lines.extend(
            f'- "{c.column_a}" et "{c.column_b}" : coefficient de corrélation = {c.r}'
            for c in request.top_correlations
        )

    return "\n".join(lines)


# The autonomous exploration agent: unlike every other prompt above (one-shot,
# stateless), this one is called repeatedly by the frontend loop with a growing
# history of prior steps, and the model itself decides each turn which of three
# heterogeneous actions to take (query, chart, finish) — that choice is the one
# genuinely agentic part of this app; everything else is a fixed pipeline the
# frontend orchestrates.
_AGENT_JSON_CONTRACT = (
    'Réponds UNIQUEMENT avec un objet JSON valide, sans balise markdown, sans texte '
    'avant ou après, selon EXACTEMENT une de ces trois formes :\n'
    'Pour proposer une requête :\n'
    '{"action": "query", "sql": "SELECT COUNT(*) AS total FROM data;", '
    '"reasoning": "Je vérifie le nombre total de lignes."}\n'
    'Pour ajouter un graphique au tableau de bord :\n'
    '{"action": "chart", "reasoning": "Je visualise la répartition des ventes par ville.", '
    '"chart_title": "Ventes par ville", "chart_type": "bar", "chart_x_field": "Ville", '
    '"chart_y_fields": ["Montant_achat"], "chart_aggregation": "sum"}\n'
    '(chart_type parmi : line, bar, area, pie, scatter — chart_aggregation parmi : '
    'sum, avg, count, min, max — une seule colonne dans chart_y_fields pour "pie" et "scatter")\n'
    'Pour terminer : {"action": "finish", "summary": "<résumé en 2 à 4 phrases>", '
    '"findings": [{"text": "<observation concrète, avec un chiffre réel>", '
    '"category": "qualite|distribution|correlation|categorie|general"}, ...]} '
    '(entre 3 et 5 findings)'
)

AGENT_STEP_SYSTEM_PROMPT = f"""Tu es un data analyst autonome. Ton objectif est d'explorer un \
jeu de données par toi-même pour en dégager les observations les plus utiles pour un \
utilisateur non technique, en français.

À chaque tour, tu choisis TOI-MÊME une des trois actions suivantes, en te basant sur ce que \
tu as déjà appris (voir l'historique ci-dessous) : exécuter une requête SQL, ajouter un \
graphique au tableau de bord de l'utilisateur, ou conclure avec un résumé et des observations.

RÈGLES STRICTES POUR LES REQUÊTES SQL :
{_READ_ONLY_RULES}

RÈGLES POUR LES GRAPHIQUES :
1. Utilise "action": "chart" quand une distribution, une comparaison entre catégories ou une \
répartition serait plus parlante en visuel qu'en texte.
2. "chart_x_field" doit être une colonne du schéma fourni ci-dessous (n'importe quel type). \
"chart_y_fields" doit contenir une ou plusieurs colonnes dont le type indiqué dans le schéma \
est "number" — jamais une colonne de type texte, date ou booléen.
3. N'ajoute jamais plus d'un ou deux graphiques au total sur l'ensemble de tes étapes, et ne \
répète jamais un graphique quasi identique à un graphique déjà ajouté (voir l'historique).
4. Ajouter un graphique NE COMPTE PAS comme exécuter une requête : voir règle 1 de "RÈGLES \
POUR CONCLURE" ci-dessous.

RÈGLES POUR CONCLURE :
1. Ne conclus ("action": "finish") que lorsque tu as exécuté au moins une VRAIE REQUÊTE SQL \
("action": "query", pas seulement des graphiques), ou si le budget d'étapes est épuisé (voir \
la consigne à la fin du message).
2. Chaque "finding" doit être basé UNIQUEMENT sur les résultats des requêtes réellement \
exécutées listées dans l'historique. N'invente JAMAIS un chiffre qui n'y figure pas.
3. Fournis entre 3 et 5 findings, concis (une phrase chacun), classés dans une catégorie parmi \
exactement : "qualite", "distribution", "correlation", "categorie", "general".
4. Ne propose jamais deux fois une requête très similaire à une requête déjà exécutée : \
diversifie les angles (qualité des données, distributions, corrélations, catégories dominantes).

FORMAT DE RÉPONSE :
{_AGENT_JSON_CONTRACT}"""


def _format_agent_history(history: list[AgentStepRecord]) -> str:
    if not history:
        return "(aucune action effectuée pour l'instant — c'est ta première étape)"
    blocks = []
    for i, step in enumerate(history, start=1):
        if step.action == "chart":
            block = [
                f"Étape {i} (graphique ajouté) :",
                f"Titre : {step.chart_title}",
                f"Type : {step.chart_type}, X : {step.chart_x_field}, "
                f"Y : {step.chart_y_fields}, agrégation : {step.chart_aggregation}",
                f"Raisonnement : {step.reasoning}",
            ]
        else:
            block = [f"Étape {i} (requête) :", f"SQL : {step.sql}", f"Raisonnement : {step.reasoning}"]
            if step.error_message:
                block.append(f"Résultat : ÉCHEC — {step.error_message}")
            else:
                block.append(f"Résultat : {step.row_count} ligne(s), colonnes {step.columns}")
                if step.sample_rows:
                    block.append(f"Extrait : {step.sample_rows}")
        blocks.append("\n".join(block))
    return "\n\n".join(blocks)


def build_agent_step_user_message(request: AgentStepRequest) -> str:
    budget_note = (
        'C\'est ta DERNIÈRE étape possible : tu DOIS conclure maintenant avec "action": "finish".'
        if request.must_finish
        else f"Étape {request.step_number} sur {request.max_steps} maximum."
    )
    return (
        f"{_format_schema(request.schema_)}\n\n"
        f"Historique des requêtes déjà exécutées :\n{_format_agent_history(request.history)}\n\n"
        f"{budget_note}"
    )
