# Agent multi-outils — ajout de l'action "chart" à l'agent d'exploration

## Contexte

L'agent d'exploration IA (implémenté plus tôt dans ce projet) n'a aujourd'hui qu'**un
seul outil** : proposer une requête SQL. À chaque tour il choisit juste entre relancer
cet unique outil ou conclure — ce n'est pas vraiment un choix "agentique" au sens fort
(sélection entre plusieurs actions hétérogènes), et le résultat reste uniquement
textuel (résumé + observations), jamais un artefact visible dans l'app.

Objectif : donner à l'agent un **deuxième outil** — ajouter un graphique au tableau de
bord — en réutilisant l'infrastructure de graphiques déjà existante
(`useDashboardStore.addChart`, `ChartRenderer`). À chaque tour, l'agent choisit
maintenant entre 3 actions : `query` (SQL), `chart` (ajouter un graphique), ou
`finish`. Ça transforme la démo : l'agent ne se contente plus de texte, il construit
littéralement le tableau de bord.

## Ce qui a été vérifié dans le code existant (réutilisable tel quel)

- `useDashboardStore.addChart(config: Omit<ChartConfig, "id"|"createdAt">)`
  (`src/store/dashboardStore.ts:16,41-44`) — **zéro validation**, pure action Zustand.
  Fonctionne depuis n'importe où via `useDashboardStore.getState().addChart(...)`,
  y compris hors composant React et peu importe la page actuellement affichée (Zustand
  est un store global, pas lié au cycle de vie de la page "Tableau de bord").
- `buildChartData` (`src/lib/chartData.ts`) est déjà défensif : si `xField`/`yFields`
  ne correspondent à aucune colonne du dataset, il retourne un résultat vide avec
  `missingColumns` peuplé (pas de crash). Donc même une config imparfaite ne casse
  rien côté rendu — mais on valide quand même côté backend (voir plus bas) pour que
  l'agent reçoive un vrai retour d'erreur exploitable plutôt qu'un graphique vide
  silencieux dans le dashboard de l'utilisateur.
- `ChartConfig` (`src/types/dashboard.ts:7-20`) : `{ id, title, type, xField, yFields,
  aggregation, groupByField, createdAt }`. `ChartType = "line"|"bar"|"area"|"pie"|
  "scatter"`. `AggregationType = "sum"|"avg"|"count"|"min"|"max"`.
- `ChartRenderer` (`src/components/dashboard/ChartRenderer.tsx`) prend déjà
  `{ config, dataset, compact }` — réutilisable tel quel pour un mini-aperçu du
  graphique dans le fil de l'agent (déjà utilisé ainsi dans `ChartBuilderPanel.tsx`).

**Décision de scope (v1)** : l'agent ne fixe jamais `groupByField` (toujours `null`) —
garde le prompt/la validation simples. Pas de contrainte serveur sur "x numérique pour
scatter" (déjà géré avec grâce côté front : au pire un graphique scatter vide, pas de
crash) — juste une consigne dans le prompt.

## Backend — additions et une extension de type existant

**`backend/app/schemas.py`** :
- Ajouter `ChartType = Literal["line","bar","area","pie","scatter"]` et
  `ChartAggregation = Literal["sum","avg","count","min","max"]` (miroir exact de
  `src/types/dashboard.ts`).
- `AgentStepRecord` — ajouter un discriminant `action: Literal["query","chart"] =
  "query"`, rendre `sql`/`row_count`/`columns`/`sample_rows` optionnels (`| None =
  None`, ils ne s'appliquent qu'à `action="query"`), ajouter les champs chart :
  `chart_title`, `chart_type: ChartType | None`, `chart_x_field: str | None`,
  `chart_y_fields: list[str] | None`, `chart_aggregation: ChartAggregation | None`.
- `AgentStepResponse` — étendre `action: Literal["query","chart","finish"]`, ajouter
  les mêmes champs chart optionnels que `AgentStepRecord` (sans le discriminant `action`
  dupliqué, il existe déjà sur la réponse).

**`backend/app/prompts.py`** :
- `_AGENT_JSON_CONTRACT` — décrire les 3 formes de réponse possibles au lieu de 2, avec
  un exemple JSON concret et complet pour chaque forme (pas juste des placeholders) —
  ça réduit le risque que le modèle renvoie un champ manquant ou un enum invalide sur
  la forme `chart`, qui a plus de champs structurés qu'une simple chaîne SQL :
  `{"action":"query", "sql":..., "reasoning":...}`,
  `{"action":"chart", "reasoning":..., "chart_title":..., "chart_type":"bar|line|area|pie|scatter",
  "chart_x_field":..., "chart_y_fields":[...], "chart_aggregation":"sum|avg|count|min|max"}`,
  `{"action":"finish", "summary":..., "findings":[...]}`.
- `AGENT_STEP_SYSTEM_PROMPT` — ajouter une section de règles pour l'action `chart` :
  quand utiliser un graphique plutôt qu'une requête (une distribution, une comparaison
  entre catégories, une répartition valent mieux en visuel qu'en texte) ; `chart_x_field`
  doit être une colonne du schéma fourni (le schéma expose déjà le type de chaque
  colonne dans le prompt via `_format_schema`, la règle s'appuie dessus sans rien
  ajouter), `chart_y_fields` doit être une ou plusieurs colonnes de type `number` ;
  pour `"pie"` et `"scatter"`, exactement une seule colonne dans `chart_y_fields` ; ne
  jamais ajouter plus d'un ou deux graphiques au total. **Règle explicite ajoutée
  suite à revue** : l'action `chart` ne compte PAS comme une requête exécutée — la
  règle existante "conclure seulement après au moins une requête" reste sur les
  actions `query` uniquement, donc le modèle doit exécuter au moins une vraie requête
  avant/à côté d'ajouter des graphiques, sous peine d'arriver à l'étape forcée de
  conclusion sans aucune donnée pour grounder son résumé.
- `_format_agent_history` — brancher explicitement sur `step.action` (`if step.action
  == "chart": ... else: ...`, pas une simple gestion de `None`) pour rendre les
  entrées `chart` (titre/type/colonnes) sans jamais afficher `SQL : None` pour ces
  entrées-là.

**`backend/app/main.py`** — route `/agent-step`, ajouter une branche :
- Nouveau petit helper `_validate_chart_fields(x_field, y_fields, schema)` — vérifie
  que `x_field` et chaque élément de `y_fields` existent dans
  `{c.name for c in schema.columns}` (même pattern que `_validate_agent_sql`,
  `HTTPException(422, ...)` sinon), **et** que chaque colonne de `y_fields` est bien de
  type `"number"` dans le schéma. **Ajouté suite à revue** : contrairement à ce que je
  pensais initialement, `chartData.ts` ne dégrade PAS proprement une mesure non
  numérique sur les types bar/line/area — `buildCartesianData` produit quand même des
  points (juste avec des valeurs `null`), donc `isEmpty` reste `false` et le graphique
  s'affiche avec axes/légende mais aucune barre/ligne visible, sans message "aucune
  donnée" (contrairement au cas scatter qui lui dégrade bien). C'est le cas d'erreur le
  plus probable qu'un LLM va réellement produire (choisir une colonne catégorielle
  comme mesure), donc cette vérification de type est ajoutée — coût quasi nul puisque
  le schéma est déjà là. Pas de vérification de type sur `x_field` (tout type convient
  pour l'axe X, quel que soit le type de graphique).
- Si `action == "chart"` : valider via ce helper, puis retourner
  `AgentStepResponse(action="chart", reasoning=..., chart_title=..., chart_type=...,
  chart_x_field=..., chart_y_fields=..., chart_aggregation=...)` — envelopper dans un
  `try/except ValidationError` (comme la branche `finish` existante) pour le cas où le
  modèle renvoie un `chart_type`/`chart_aggregation` hors de l'énum Pydantic → 502.

Pas de changement à `sql_safety.py`, `mistral_client.py`, `_validate_agent_sql` — les
branches `query` et `finish` existantes restent identiques.

## Frontend

**`src/types/agent.ts`** — miroir des extensions backend :
- `AgentStepRecord` : ajouter `action: "query" | "chart"`, rendre `sql`/`row_count`/
  `columns`/`sample_rows` optionnels, ajouter les champs `chart_title`, `chart_type`,
  `chart_x_field`, `chart_y_fields`, `chart_aggregation` (réutiliser `ChartType`/
  `AggregationType` importés de `@/types/dashboard`).
- `AgentStepResponse` : `action: "query" | "chart" | "finish"` + mêmes champs chart.
- `AgentTrailEntry` (type d'affichage) : ajouter `action: "query" | "chart"` et, pour
  une entrée chart, un champ `chart: { title: string; type: ChartType; xField: string;
  yFields: string[]; aggregation: AggregationType } | null`.

**`src/store/agentExplorationStore.ts`** — dans la boucle `run()`, après réception de
`response` :
- Si `response.action === "chart"` : construire un `ChartConfig` (sans id/createdAt)
  à partir des champs `chart_*`, appeler
  `useDashboardStore.getState().addChart({ title, type, xField, yFields, aggregation,
  groupByField: null })` (import `useDashboardStore` depuis `@/store/dashboardStore`),
  pousser une entrée dans `trail` avec `action:"chart"` et le `chart` rempli, pousser
  l'entrée correspondante dans `history` (avec `action:"chart"` et les champs
  `chart_*`, `sql`/`row_count`/etc. omis), puis continuer la boucle au step suivant.
  Pas de bloc try/catch nécessaire ici : le backend a déjà validé les noms de colonnes
  avant de renvoyer `action:"chart"`, donc pas de scénario d'échec à gérer côté client
  pour cette branche (contrairement à `runQuery` qui peut échouer à l'exécution).
  **Confirmé suite à revue** : les étapes `chart` restent bien dans `history` (pas
  d'option "les en exclure" retenue) — avec seulement 3 étapes au total et la
  dernière forcée à conclure, si le modèle ne voit pas dans son historique qu'il a
  déjà ajouté un graphique à l'étape précédente, rien ne l'empêche d'en ajouter un
  quasi-identique à l'étape suivante (contrairement à une requête SQL répétée, un
  graphique dupliqué reste visible en permanence sur le dashboard de l'utilisateur).

**`src/components/query/AgentExplorationPanel.tsx`** — dans le rendu du fil
(`trail.map(...)`), brancher sur `entry.action` :
- `"query"` : rendu actuel inchangé (raisonnement, `SqlCodeBlock`, ligne de résultat).
- `"chart"` : raisonnement en italique (comme pour query), puis un mini-aperçu du
  graphique via `<ChartRenderer config={{...entry.chart, id:"preview", createdAt:0}}
  dataset={dataset} compact />` (réutilisation directe, même pattern que
  `ChartBuilderPanel.tsx`) dans un cadre `rounded-lg border` de hauteur fixe modeste
  (~160px), avec une légende texte "→ Graphique ajouté au tableau de bord".

## Fichiers inchangés (réutilisation confirmée)

`sql_safety.py`, `mistral_client.py`, `_validate_agent_sql`, `lib/duckdb/loadDataset.ts`,
`lib/api/client.ts`, `lib/agent/api.ts` (le wrapper `agentStep` ne change pas de
signature), `SqlCodeBlock.tsx`, `dashboardStore.ts` (`addChart` déjà générique),
`chartData.ts`, `ChartRenderer.tsx`, `QueryPage.tsx` (aucun changement, le toggle de
mode existant suffit).

## Vérification

1. Régénérer les checks statiques : `python -m py_compile` sur les fichiers backend
   modifiés, puis import de `app.main` (comme lors de la première implémentation) pour
   confirmer que les nouvelles routes/schemas se chargent sans erreur Pydantic.
2. `npm run build` (tsc -b + vite build) pour confirmer que les types étendus
   compilent sans erreur dans `agentExplorationStore.ts` et `AgentExplorationPanel.tsx`.
3. Bout en bout (dev servers + Playwright, même pattern que la démo précédente) :
   charger un dataset, mode "Agent IA autonome", lancer l'agent, vérifier au Network
   tab qu'au moins un appel `/agent-step` renvoie `"action":"chart"`, et que le
   graphique apparaît (a) en mini-aperçu dans le fil de l'agent ET (b) réellement dans
   `useDashboardStore` en visitant l'onglet "Tableau de bord" après coup.
4. Cas d'erreur : si possible, observer un tour où le modèle propose une colonne
   inexistante ou non-numérique pour `chart_x_field`/`chart_y_fields` — vérifier le 422
   et qu'aucun graphique fantôme n'est ajouté au dashboard.
5. Vérifier qu'un run ne se termine jamais avec zéro requête exécutée dans l'historique
   (la nouvelle règle de prompt "chart ne compte pas comme requête" doit empêcher un
   run 100% graphiques + conclusion sans données réelles pour l'appuyer).
