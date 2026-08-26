# Deuxième table + jointures, scopée à la page "Interroger"

## Contexte

Toute l'app tourne aujourd'hui autour d'**un seul dataset / une seule table DuckDB**,
toujours nommée `"data"`. L'utilisateur veut pouvoir croiser deux fichiers (ex :
clients + commandes) et poser des questions en langage naturel qui génèrent des
JOIN. Comme discuté et validé : on ne touche PAS au nettoyage/dashboard/insights
(qui restent sur le dataset principal, inchangés) — on ajoute juste la possibilité
de charger un **second fichier, uniquement sur la page "Interroger"**, pour que le
text-to-SQL et l'agent puissent écrire des requêtes multi-tables.

## Ce qui a été vérifié dans le code existant

- `backend/app/sql_safety.py` : `validate_read_only_sql(sql, allowed_table)` n'a
  **aucun couplage structurel à une seule table** — la marche d'AST déjà générique
  (elle itère déjà tous les `exp.Table` d'une requête, JOIN compris). Généraliser à
  un ensemble de tables autorisées touche seulement 3 lignes (signature, construction
  de l'ensemble autorisé, message d'erreur).
- `_READ_ONLY_RULES` (prompts.py) n'interdit pas JOIN syntaxiquement — seul le
  wording "la table" (singulier) laisse croire au modèle qu'il n'y en a qu'une.
- `_format_schema` (prompts.py) et `buildDatasetSchema` (schemaBuilder.ts) sont
  tous les deux des rendus **strictement single-table**, réutilisés chacun par 3
  points d'appel (generate-sql/fix-sql/agent-step côté backend ; ask/agent côté
  frontend) — un seul endroit à généraliser de chaque côté, pas trois.
- `QUERY_TABLE_NAME = "data"` (loadDataset.ts) et les noms de table de staging
  (`__data_staging`, `dataset_rows.json`) sont non-namespacés — il faut les
  paramétrer par nom de table pour charger une 2ᵉ table sans collision.
- `Dataset` (types/dataset.ts) ne porte aucun nom de table — c'est le loader qui
  décide, donc le nom de la 2ᵉ table doit être dérivé du nom de fichier.
- **Point important repéré en analysant le flux graphique de l'agent** :
  `chartData.ts`/`ChartRenderer` travaillent sur le `Dataset` déjà en mémoire
  (Zustand), pas sur DuckDB — donc l'action `chart` de l'agent doit rester limitée
  aux colonnes de la table **principale** uniquement. L'étendre aux colonnes de la
  table secondaire créerait un bug silencieux (validé côté backend, graphique vide
  côté front). `_validate_chart_fields` n'est PAS touché par ce plan.
- `FileDropzone.tsx` est déjà un composant pur (`{ onFileSelected, disabled }`,
  aucun couplage au store principal) — réutilisable tel quel dans un wrapper compact.
- `parseFile(file): Promise<Dataset>` (fileParser.ts) est une fonction pure,
  réutilisable directement pour le second fichier.

## Backend

**`backend/app/sql_safety.py`** : `validate_read_only_sql(sql, allowed_tables:
set[str])` — remplace le paramètre `allowed_table: str` par un ensemble. Construction
de l'allowlist : `{t.lower() for t in allowed_tables} | cte_names`. Message d'erreur
mis à jour pour lister toutes les tables autorisées au lieu d'en nommer une seule.

**`backend/app/schemas.py`** : ajouter `secondary_tables: list[DatasetSchema] =
Field(default_factory=list)` à `GenerateSqlRequest`, `FixSqlRequest`,
`AgentStepRequest` (les trois requêtes qui génèrent du SQL). Additif, pas d'alias
nécessaire (nouveau champ, pas de clé JSON historique à préserver).

**`backend/app/prompts.py`** :
- `_format_schema` devient `_format_schemas(schemas: list[DatasetSchema])` qui
  rend chaque table dans son propre bloc ; garder `_format_schema` comme alias
  `_format_schemas([schema])` pour ne rien casser ailleurs si besoin, ou l'inliner
  directement — à trancher à l'implémentation selon ce qui reste le plus lisible.
  Quand il y a ≥ 2 tables, ajoute une ligne : "Plusieurs tables sont disponibles :
  tu peux les combiner avec JOIN si c'est pertinent pour répondre à la question."
- `_READ_ONLY_RULES`, règle 2 : reformuler "la table" → "les tables et colonnes
  listées dans le(s) schéma(s) fourni(s)" — reste naturel que le schéma fasse 1 ou 2
  tables, aucune logique conditionnelle nécessaire dans le code.
- `build_generate_sql_user_message`, `build_fix_sql_user_message`,
  `build_agent_step_user_message` : chacune prend maintenant la liste complète des
  schémas (primaire + secondaires) au lieu d'un seul, et appelle `_format_schemas`.

**`backend/app/main.py`** :
- `_extract_sql_response(data, allowed_tables: set[str])` — généralisé.
- `_validate_agent_sql(sql, allowed_tables: set[str])` — généralisé.
- Dans `generate_sql`, `fix_sql`, `agent_step` : calculer
  `all_schemas = [request.schema_] + request.secondary_tables` et
  `allowed_tables = {s.table_name for s in all_schemas}`, passer `all_schemas` aux
  builders de prompt et `allowed_tables` à la validation SQL.
- `_validate_chart_fields` **inchangé** (voir note ci-dessus — reste scopé à
  `request.schema_` seul, la table principale).

## Frontend

**`src/lib/duckdb/loadDataset.ts`** : `loadDatasetIntoDuckDB(dataset, tableName =
QUERY_TABLE_NAME)` — paramètre optionnel, comportement par défaut inchangé pour tous
les appels existants. Noms de staging namespacés par table
(`` `__staging_${tableName}` ``, `` `staging_${tableName}.json` ``) pour éviter toute
collision si les deux tables sont chargées l'une après l'autre.

**Nouveau : `src/lib/duckdb/tableName.ts`** — petite fonction pure
`sanitizeTableName(fileName: string): string` : retire l'extension, minuscule,
remplace tout caractère hors `[a-z0-9_]` par `_`, préfixe `t_` si ça commence par un
chiffre, retombe sur `"table2"` si vide ou si ça collisionne avec `"data"`.

**`src/lib/textToSql/schemaBuilder.ts`** : `buildDatasetSchema(dataset, tableName =
QUERY_TABLE_NAME)` — même pattern de paramètre optionnel, réutilisable pour la table
secondaire sans dupliquer la logique de `collectSampleValues`.

**Nouveau : `src/store/secondaryTableStore.ts`** — store Zustand minimal et
indépendant : `{ dataset: Dataset | null, tableName: string | null, status:
"idle"|"loading"|"ready"|"error", errorMessage, load(file), clear() }`. Fonctionne
comme le premier fichier : `parseFile(file)` → `sanitizeTableName(file.name)` →
`loadDatasetIntoDuckDB(dataset, tableName)`. **Décision volontaire** : ce store n'est
PAS branché sur la cascade de `useDatasetStore.resetDataset()` — changer de fichier
principal ne supprime pas la table secondaire (elle reste chargée et jointe au
nouveau dataset principal). L'utilisateur la retire manuellement via le chip.

**`src/types/textToSql.ts`** (`GenerateSqlRequest`, `FixSqlRequest`) et
**`src/types/agent.ts`** (`AgentStepRequest`) : ajouter
`secondary_tables?: DatasetSchemaPayload[]`.

**`src/store/textToSqlStore.ts`** (`ask()`) et
**`src/store/agentExplorationStore.ts`** (`run()`) : lire
`useSecondaryTableStore.getState()`, et si une table secondaire est chargée,
inclure `secondary_tables: [buildDatasetSchema(secondaryDataset, secondaryTableName)]`
dans le payload envoyé (sinon tableau vide/absent, comportement actuel inchangé).

**`src/pages/QueryPage.tsx`** : un widget compact juste après le toggle de mode
(visible dans les deux modes, "Poser une question" et "Agent IA autonome", puisque
les deux en bénéficient) :
- Rien chargé + DuckDB prêt → petit bouton/zone reprenant `FileDropzone` en version
  compacte : "+ Ajouter une deuxième table pour les jointures".
- Chargé → un chip : "Table jointe : `commandes` (commandes.csv · 42 lignes ·
  5 colonnes) [✕]".
- Caché/désactivé tant que `duckDbStatus !== "ready"` (la connexion partagée doit
  déjà exister pour charger une 2ᵉ table dedans).

## Fichiers inchangés

`DataCleaningPage.tsx`, `DashboardPage.tsx`, `InsightsPanel`/`insightsStore.ts`,
`chartData.ts`, `ChartRenderer.tsx`, `_validate_chart_fields` (main.py),
`mistral_client.py`, `useDatasetStore` (aucune modification, juste lu par le nouveau
store secondaire côté schéma de nommage).

## Vérification

1. `python -m py_compile` + import de `app.main` ; `tsc -b && vite build` propres.
2. Test backend isolé (mock `call_mistral_json`) : une requête avec `secondary_tables`
   rempli doit accepter un SQL avec JOIN sur les deux tables (pas de rejet
   `sql_safety`), et rejeter toujours une requête référençant une table absente des
   deux schémas.
3. Bout en bout (Playwright, dev servers réels) : charger le dataset principal,
   ajouter un second fichier CSV sur la page Interroger, poser une question qui
   nécessite de croiser les deux (ex. "combien de commandes par client ?"),
   vérifier que le SQL généré contient un JOIN et s'exécute sans erreur DuckDB.
4. Vérifier que le mode Agent voit aussi les deux tables (schéma inclus dans son
   payload) et peut proposer une requête JOIN.
5. Vérifier la non-régression : sans second fichier chargé, tout se comporte
   exactement comme avant (mêmes requêtes générées, pas de `secondary_tables` dans
   le payload réseau — à vérifier via l'onglet Network).
