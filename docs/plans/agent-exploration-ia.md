# Agent d'exploration IA — feature additive à "Interroger mes données"

## Contexte

Le projet "Data Cleaning Studio" a déjà de l'IA assistée (text-to-SQL une question à
la fois, insights statiques) mais rien d'agentique : aucun endpoit où le modèle
décide lui-même, tour après tour, quelle action prendre ensuite. L'utilisateur veut
ajouter **une seule tâche agentique** — un agent qui explore le dataset de façon
autonome (il choisit lui-même sa prochaine requête SQL, jusqu'à décider qu'il en
sait assez) — **sans toucher au reste de l'app**. Le mode "Poser une question"
existant doit rester identique au pixel/comportement près ; le nouveau mode est un
onglet optionnel en plus, à l'intérieur de la page "Interroger".

Toute la plomberie (validation SQL read-only, exécution DuckDB-WASM côté navigateur,
appel Mistral générique, pattern request/response par capability) existe déjà et est
100% réutilisable sans modification — voir section Réutilisation.

## Nommage (évite la confusion avec l'onglet nav existant "Exploration")

Le nav a déjà un onglet **"Exploration"** (`Header.tsx` NAV_ITEMS, icône `Compass`,
page statique d'analyse par colonne) — sans rapport avec cette feature. Éviter le
mot nu "Exploration" dans la nouvelle UI :

- Toggle à deux boutons dans `QueryPage.tsx` : **"Poser une question"** (existant,
  sélectionné par défaut) vs **"Agent IA autonome"**.
- Titre du panneau : **"Agent d'exploration IA"**, sous-titre : "L'IA décide
  elle-même des requêtes à exécuter pour comprendre vos données, étape par étape."
- Icône du mode agent : `Wand2` (pas `Compass`, déjà pris par le nav ; pas `Bot`,
  déjà utilisé par l'onglet "Interroger" et le mode question existant).
- Étape en cours : "Étape N/3 — réflexion…" / résultat final : "Ce que l'agent a
  découvert" (résumé + liste de findings avec badge de catégorie).

## Backend — additions pures (aucune route existante modifiée)

**`backend/app/schemas.py`** — ajouter en fin de fichier :
- `AgentStepRecord` (sql, reasoning, row_count, columns, sample_rows, error_message: str | None)
- `AgentStepRequest` (schema_: DatasetSchema = Field(alias="schema") — réutiliser
  exactement le pattern alias de `GenerateSqlRequest` ; history: list[AgentStepRecord];
  step_number: int; max_steps: int; must_finish: bool)
- `AgentStepResponse` (action: Literal["query","finish"]; sql/reasoning optionnels ;
  summary optionnel ; findings: list[Insight] = [] — **réutiliser `Insight`/
  `InsightCategory` existants, ne pas créer un nouvel enum de catégories**)

**`backend/app/prompts.py`** — ajouter en fin de fichier :
- `_AGENT_JSON_CONTRACT` + `AGENT_STEP_SYSTEM_PROMPT` (rôle "data analyst autonome"
  + règles SQL en réutilisant **`_READ_ONLY_RULES` tel quel** + règles de conclusion :
  3-5 findings groundés uniquement sur les requêtes réellement exécutées, jamais de
  chiffre inventé, ne pas répéter une requête similaire)
- `_format_agent_history(history)` (rend chaque étape passée : SQL, raisonnement,
  résultat ou échec)
- `build_agent_step_user_message(request)` — réutilise **`_format_schema` tel quel**,
  ajoute l'historique formaté + une note de budget ("Étape N/max" ou "C'est ta
  DERNIÈRE étape, tu DOIS conclure" si `must_finish`)
- Étendre l'import `from app.schemas import ...` avec `AgentStepRequest, AgentStepRecord`

**`backend/app/main.py`** — additions seulement, `_extract_sql_response` intouché :
- Nouveaux imports (schemas + prompts additions)
- Nouvelle petite fonction privée `_validate_agent_sql(sql, table_name) -> str` qui
  appelle **`validate_read_only_sql` (sql_safety.py, inchangé)** — logique identique
  à `_extract_sql_response` mais séparée pour ne pas toucher au code existant
- `POST /agent-step` (`AgentStepRequest -> AgentStepResponse`) : construit le message
  via `build_agent_step_user_message`, appelle **`call_mistral_json` (mistral_client.py,
  inchangé)**, si `action=="query"` valide le SQL via `_validate_agent_sql`, si
  `action=="finish"` retourne summary+findings (502 si vide/malformé), sinon 502.
  Stateless comme les autres routes — `must_finish` n'est qu'une pression de prompt,
  pas une contrainte serveur (le front ne rappelle simplement pas après le cap).

Pas de changement à `sql_safety.py` ni `mistral_client.py` (max_tokens=1024 laissé
tel quel — suffisant vu le cap d'historique à 3 étapes × 5 lignes d'échantillon max,
comme `/generate-insights` qui tourne déjà avec ce budget).

## Frontend — nouveaux fichiers, un seul edit sur un fichier existant

**`src/types/agent.ts`** (nouveau) — miroir exact des schémas backend en snake_case
(même convention que `types/textToSql.ts`) : `AgentStepRecord`, `AgentStepRequest`,
`AgentStepResponse`, plus deux types UI locaux `AgentTrailEntry` et
`AgentPhase = "idle"|"thinking"|"executing"|"done"|"error"`. Réutilise `Insight`
depuis `types/insights.ts` (import, pas de redéfinition) et `DatasetSchemaPayload`
depuis `types/textToSql.ts`.

**`src/lib/agent/api.ts`** (nouveau) — wrapper fin `agentStep(request)` via
**`postJson` (lib/api/client.ts, inchangé)**, même pattern qu'un-liner que
`lib/textToSql/api.ts`.

**`src/store/agentExplorationStore.ts`** (nouveau) — la boucle agentique côté client
(le SQL ne s'exécute que dans le navigateur, donc la boucle doit vivre côté front,
comme le fait déjà la boucle de correction de `textToSqlStore.ts` → `ask()`).

- `MAX_AGENT_STEPS = 3`. Justification : le plan gratuit Mistral est à 2 req/min ;
  chaque étape = 1 appel Mistral (`/agent-step`), donc 3 étapes max garde le pire cas
  à ~3 appels séquentiels (sous la minute), tout en laissant au moins 2 vraies
  requêtes exploratoires avant la conclusion forcée.
- Récupération d'erreur : **on réinjecte l'échec dans l'historique au lieu d'arrêter
  la boucle.** Une requête proposée est déjà validée read-only côté backend, donc un
  échec DuckDB (colonne inexistante, typo de fonction) est rare et surtout le genre
  d'erreur qu'un LLM peut corriger lui-même en la voyant dans son historique — le
  champ `error_message` existe déjà dans `AgentStepRecord` pour ça, sans plomberie
  supplémentaire. L'étape ratée consomme quand même un slot du cap de 3 (pas d'étape
  bonus). Si c'est la toute dernière étape (must_finish) qui échoue à l'exécution, la
  boucle s'arrête directement en `phase:"error"` (pas de 4ème appel).
- Réutilise **`buildDatasetSchema` (lib/textToSql/schemaBuilder.ts, inchangé)** et
  **`runQuery`/`QueryResult` (lib/duckdb/loadDataset.ts, inchangé)**.
- `friendlyMessage(error)` dupliqué localement (429 → message français limite de
  débit), même convention que dans `textToSqlStore.ts` — pas de helper partagé.
- État exposé : `phase, trail: AgentTrailEntry[], summary, findings, errorMessage`,
  actions `run(dataset)` et `reset()`.

**`src/components/query/AgentExplorationPanel.tsx`** (nouveau) — tout le UI du mode
agent, prop `{ dataset }` :
- Bouton "Lancer l'agent" / "Relancer" (désactivé pendant thinking/executing)
- Fil des étapes : badge "Étape N/3", raisonnement en italique, **`<SqlCodeBlock>`
  (composants/query/SqlCodeBlock.tsx, inchangé)**, puis une ligne compacte de
  résultat ("→ 12 lignes, 4 colonnes") ou l'erreur en rouge — pas de table complète
  par étape (complexité de mise en page non justifiée pour un fil transitoire)
- Spinner "Réflexion de l'agent…" pendant l'appel en cours (idiome `Loader2`, comme
  `DuckDbLoadingState` dans QueryPage.tsx)
- État final : carte résumé (même idiome visuel que la carte résumé accent/Bot
  existante de QueryPage.tsx) + liste de findings avec badge catégorie/icône — miroir
  du mapping catégorie→icône/couleur déjà utilisé par `components/insights/*`
  (qualite→warning, distribution→Activity, correlation→Link2, categorie→PieChart,
  general→Sparkles), dupliqué localement plutôt que partagé (convention du projet)
- État erreur : petit bloc dupliqué localement (ne pas exporter/toucher
  `ErrorCallout` qui est privé à QueryPage.tsx)

**`src/pages/QueryPage.tsx`** — seul fichier existant modifié, édit minimal et
localisé :
- `useState` ajouté à l'import React existant ; nouvel état
  `const [mode, setMode] = useState<"ask" | "agent">("ask")`
- Import de `AgentExplorationPanel`
- Dans la branche où le dataset est chargé et DuckDB prêt (ne touche pas aux
  branches `NoDatasetState`/`DuckDbLoadingState`/`DuckDbErrorState`), insertion d'un
  toggle deux-boutons juste avant le `<div className="space-y-6">` actuel
- Le `<div className="space-y-6">...</div>` existant (tout son contenu interne
  inchangé) est enveloppé dans `{mode === "ask" && (...)}`. Un
  `{mode === "agent" && <AgentExplorationPanel dataset={dataset} />}` est ajouté juste
  après.

## Fichiers inchangés (réutilisation confirmée)

`sql_safety.py`, `mistral_client.py`, `lib/duckdb/loadDataset.ts`, `lib/api/client.ts`,
`lib/textToSql/*`, `textToSqlStore.ts`, `SqlCodeBlock.tsx`, `QueryResultTable.tsx`,
`QueryHistoryPanel.tsx`, `QuestionBar.tsx`, `Header.tsx`, `insightsStore.ts`,
`DataCleaningPage.tsx`, `ExplorePage.tsx`.

## Vérification

**Non-régression du mode existant :**
1. Lancer les deux serveurs (voir README.md — `npm run dev` + `uvicorn` dans
   `backend/`).
2. Charger un dataset, onglet "Interroger" : le toggle apparaît avec "Poser une
   question" sélectionné par défaut, l'UI est visuellement identique à avant.
3. Poser une question comme avant : génération SQL → exécution → (correction si
   besoin) → résumé → graphique/table → entrée d'historique — comportement identique.
4. Vérifier au Network tab qu'aucun appel `/agent-step` n'est fait dans ce mode.
5. `git diff src/pages/QueryPage.tsx` : le diff ne doit montrer que l'ajout du
   toggle et les accolades d'enveloppe `{mode === "ask" && (...)}`, rien d'autre
   reformaté.

**Nouvelle boucle agentique, bout en bout :**
1. Basculer sur "Agent IA autonome", cliquer "Lancer l'agent".
2. Observer le fil se remplir étape par étape (raisonnement, SQL, résultat compact),
   jusqu'à 3 étapes, avec des pauses visibles "Réflexion…" (attendu, pas un bug, vu
   le rate-limit 2 req/min).
3. Vérifier au Network tab que la 3ème requête `/agent-step` porte
   `"must_finish": true` et que la réponse est `"action": "finish"` avec résumé +
   3-5 findings catégorisés.
4. Provoquer un échec d'exécution (ex. relancer plusieurs fois jusqu'à ce que DuckDB
   trébuche sur une requête générée) : vérifier que l'étape échouée s'affiche en
   ligne d'erreur dans le fil sans stopper la boucle.
5. Déclencher un 429 (relancer l'agent juste après avoir utilisé le mode question,
   même quota Mistral) : vérifier le message français de limite de débit et le
   retour en `phase:"error"` relançable.
