# Robustesse de l'agent — les échecs de graphique n'interrompent plus toute la run

## Contexte

L'agent d'exploration a deux outils (`query`, `chart`) mais leur gestion d'erreur est
asymétrique. Une requête SQL qui échoue à l'exécution est déjà gérée en douceur :
l'erreur est réinjectée dans l'historique, l'agent voit son échec au tour suivant et
peut s'auto-corriger, la run continue. Un graphique dont la colonne n'existe pas ou
n'est pas numérique, lui, fait planter **toute la run** — le backend renvoie une 422,
le store frontend traite ça comme une erreur réseau fatale (`phase:"error"`, arrêt
immédiat), sans aucune chance de récupération. Un seul nom de colonne halluciné perd
2-3 minutes de travail et toute la démo. Objectif : aligner le comportement du
graphique sur celui de la requête — l'échec devient une donnée dans l'historique, pas
un arrêt.

## Ce qui a été vérifié dans le code actuel

- `backend/app/main.py:140-168` (`_validate_chart_fields`) lève `HTTPException(422,
  ...)` sur colonne inconnue / mesure non numérique / champs manquants — c'est ce qui
  déclenche l'abandon complet.
- `src/store/agentExplorationStore.ts:60-72` : le seul `try/catch` autour de l'appel
  réseau `agentStep(...)` traite TOUTE erreur (y compris une 422 chart) comme fatale.
  Le pattern de récupération existant (réinjection dans `history` + `continue` de la
  boucle) n'existe aujourd'hui que dans le bloc `runQuery` catch (lignes 155-171), pas
  autour de la branche `chart` (lignes 83-124), qui suppose toujours le succès.
- `backend/app/prompts.py` (`_format_agent_history`) : la branche `chart` affiche
  toujours titre/type/colonnes, sans jamais vérifier un `error_message` (contrairement
  à la branche `query` qui le fait déjà).
- `backend/app/schemas.py` : `AgentStepResponse` n'a pas de champ `error_message` —
  seul `AgentStepRecord` (l'historique) en a un.

## Backend

**`backend/app/schemas.py`** : ajouter `error_message: str | None = None` à
`AgentStepResponse` (même nom/type que sur `AgentStepRecord`, pas de nouveau concept).

**`backend/app/main.py`** :
- `_validate_chart_fields` change de forme : au lieu de lever `HTTPException`, elle
  **retourne une chaîne d'erreur (ou `None` si valide)** — `-> str | None`. Garde la
  même logique de vérification (colonnes manquantes, colonne inconnue, mesure non
  numérique), juste `return "message"` au lieu de `raise HTTPException(422, ...)`.
- Dans la route, la branche `action == "chart"` : appelle `_validate_chart_fields`,
  et si elle retourne une erreur, renvoie `AgentStepResponse(action="chart",
  reasoning=..., error_message=erreur)` avec un **200** (pas de 422) — c'est un
  résultat normal de la boucle agent, pas une erreur serveur. Si valide, comportement
  inchangé (construit la réponse chart complète).
- **Distinction volontaire conservée** : une erreur de *contenu* (mauvaise colonne)
  devient un 200 avec `error_message` ; une erreur de *format* (le modèle renvoie un
  `chart_type` hors de l'énum Pydantic, JSON malformé) reste un 502 hard-fail via le
  `try/except ValidationError` existant — un modèle qui casse le contrat JSON lui-même
  ne va pas se corriger via l'historique, ça reste un vrai échec technique. Même
  logique déjà appliquée à la branche `finish`, non touchée ici.

**`backend/app/prompts.py`** :
- `_format_agent_history`, branche `chart` : ajouter la même vérification que la
  branche `query` — si `step.error_message` est renseigné, afficher `Résultat : ÉCHEC
  — {error_message}` au lieu du bloc titre/type/colonnes habituel.
- Le rappel dynamique (`chart_reminder` dans `build_agent_step_user_message`) : le
  calcul de `has_chart` doit ignorer les tentatives échouées — `any(step.action ==
  "chart" and not step.error_message for step in request.history)` — pour que le
  rappel continue de pousser l'agent vers un NOUVEL essai (avec de meilleures
  colonnes) plutôt que de considérer l'échec comme "graphique déjà fait".

## Frontend

**`src/types/agent.ts`** : ajouter `error_message?: string` à l'interface
`AgentStepResponse`. (`AgentStepRecord.error_message` existe déjà et est déjà
utilisable pour une entrée `action:"chart"`, aucun changement de type nécessaire là.)

**`src/store/agentExplorationStore.ts`**, branche `response.action === "chart"`
(lignes 83-124) : après réception de la réponse, si `response.error_message` est
défini :
- **Ne pas appeler** `useDashboardStore.getState().addChart(...)` (rien n'est ajouté
  au dashboard sur un échec — cohérent avec le fait que le backend ne renvoie plus
  les champs `chart_type`/`chart_aggregation` validés dans ce cas).
- Pousser dans `history` une entrée `{action:"chart", reasoning, chart_title:
  response.chart_title, chart_x_field: response.chart_x_field, chart_y_fields:
  response.chart_y_fields, error_message: response.error_message}` (les champs
  bruts tentés, pour que l'agent voie ce qu'il a essayé).
- Pousser dans `trail` une entrée avec `chart: null, errorMessage:
  response.error_message` (au lieu de `chart: {...}` rempli).
- `continue` la boucle (comportement déjà correct pour ce qui est de ne pas
  `return` — le `continue` existant reste, seul le contenu poussé change selon
  succès/échec).

Si `response.error_message` est absent (cas normal), comportement inchangé.

**`src/components/query/AgentExplorationPanel.tsx`** : la condition de rendu doit
d'abord brancher sur `entry.action === "chart"` (peu importe succès/échec), puis sur
`entry.chart` à l'intérieur pour distinguer les deux issues — actuellement le code
teste `entry.action === "chart" && entry.chart`, ce qui ferait tomber une entrée chart
échouée (où `chart` est `null`) dans le bloc de rendu SQL par défaut, avec le mauvais
message ("Échec de la **requête**"). Nouvelle structure :
```
{entry.action === "chart" ? (
  entry.chart ? (<aperçu ChartRenderer existant>)
  : (<p className="text-xs text-destructive">→ Échec de l'ajout du graphique : {entry.errorMessage}</p>)
) : (
  <bloc SQL existant inchangé>
)}
```

## Fichiers inchangés

`sql_safety.py`, `mistral_client.py`, `_validate_agent_sql`, `dashboardStore.ts`,
`chartData.ts`, `ChartRenderer.tsx`, `QueryPage.tsx` — aucun changement, le point de
défaillance corrigé est entièrement contenu dans la couche agent.

## Vérification

1. `python -m py_compile` + import de `app.main` (comme à chaque fois).
2. Test backend isolé (mock de `call_mistral_json`, même pattern que
   `test_chart_branch.py` utilisé plus tôt dans la session) : une réponse chart avec
   colonne inexistante doit maintenant renvoyer **200** avec `error_message` rempli
   (pas 422), et une réponse chart valide doit toujours renvoyer 200 sans
   `error_message`.
3. `npm run build` (tsc -b + vite build) propre après les changements de types.
4. Test Playwright avec `page.route()` interceptant `/agent-step` (même pattern que
   `test_agent_chart_ui.js`) simulant une séquence query → chart-avec-colonne-invalide
   → finish : vérifier que (a) la run ne s'arrête pas en erreur, (b) le fil affiche
   une ligne d'échec spécifique au graphique (pas "échec de la requête"), (c) aucun
   graphique n'apparaît sur le dashboard, (d) l'étape "finish" est bien atteinte.
