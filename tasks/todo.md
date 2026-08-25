## Agent d'exploration IA — feature agentique additive

Plan complet : [docs/plans/agent-exploration-ia.md](../docs/plans/agent-exploration-ia.md)

### Plan
- [x] Backend : `AgentStepRecord`/`AgentStepRequest`/`AgentStepResponse` (schemas.py)
- [x] Backend : `AGENT_STEP_SYSTEM_PROMPT` + `build_agent_step_user_message` (prompts.py)
- [x] Backend : route `POST /agent-step` + `_validate_agent_sql` (main.py)
- [x] Frontend : `types/agent.ts`, `lib/agent/api.ts`
- [x] Frontend : `store/agentExplorationStore.ts` (boucle 3 étapes max, feed-back des erreurs)
- [x] Frontend : `components/query/AgentExplorationPanel.tsx`
- [x] Frontend : `pages/QueryPage.tsx` — toggle "Poser une question" / "Agent IA autonome", additif uniquement
- [x] Vérification : `tsc -b && vite build` propre, `python -m py_compile` propre
- [x] Vérification : test Playwright bout-en-bout (régression du mode existant + boucle agent complète)

### Résumé des changements
Nouveau mode "Agent IA autonome" dans la page "Interroger", à côté du mode question existant
(inchangé). L'agent décide lui-même, tour par tour (max 3 appels Mistral), quelle requête SQL
exécuter sur le dataset chargé dans DuckDB-WASM, jusqu'à conclure avec un résumé + 3-5
observations catégorisées. Toute la plomberie existante (validation SQL read-only, exécution
DuckDB, appel Mistral générique) est réutilisée sans modification.

### Revue
**Ce qui a fonctionné :** l'architecture existante (un endpoint stateless par capability,
boucle côté client pour le fix-loop de `textToSqlStore.ts`) se généralisait directement à un
agent multi-étapes sans rien casser — seule addition, aucune régression.

**Ce qui a été difficile :** rien de bloquant. Le seul point d'attention réel était le
rate-limit Mistral (2 req/min sur le plan gratuit) qui borne le nombre d'étapes possibles à 3
pour rester utilisable en démo.

**Preuve de fonctionnement (test Playwright bout-en-bout, `npm run dev` + `uvicorn` réels) :**
- Régression : mode "Poser une question" reste sélectionné par défaut, UI identique, aucun
  appel `/agent-step` déclenché dans ce mode.
- Agent : 3 appels `/agent-step` observés (2 requêtes SQL réelles exécutées par l'agent lui-même
  — d'abord un contrôle qualité des données, puis une analyse de distribution — puis conclusion
  forcée à l'étape 3/3 avec `must_finish: true` → `action: "finish"`), 5 findings affichés,
  0 erreur console. L'agent a notamment détecté un montant d'achat négatif (anomalie non
  suggérée dans le prompt) — comportement réellement autonome, pas un résultat scripté.

---

## Agent multi-outils — action "chart" (deuxième outil de l'agent)

Plan complet : [docs/plans/agent-multi-outils-chart.md](../docs/plans/agent-multi-outils-chart.md)

### Plan
- [x] Backend : `ChartType`/`ChartAggregation` + extension `AgentStepRecord`/`AgentStepResponse`
  avec discriminant `action: "query"|"chart"` (`"finish"` en plus côté réponse) (schemas.py)
- [x] Backend : règles de prompt pour l'action `chart` + exemples JSON concrets par action +
  règle "un graphique ne compte pas comme une requête exécutée" (prompts.py)
- [x] Backend : `_validate_chart_fields` (colonnes existantes + mesure numérique) + branche
  `action == "chart"` dans `/agent-step` (main.py)
- [x] Frontend : `types/agent.ts` étendu (discriminant `action`, champs `chart_*`)
- [x] Frontend : `agentExplorationStore.ts` — branche `chart` appelle
  `useDashboardStore.getState().addChart(...)`, historise l'étape
- [x] Frontend : `AgentExplorationPanel.tsx` — mini-aperçu live via `<ChartRenderer compact />`
  réutilisé tel quel dans le fil de l'agent
- [x] Vérification : `tsc -b && vite build` propre, `python -m py_compile` + import propre
- [x] Vérification : tests unitaires backend isolés (mock de `call_mistral_json`) pour la
  branche chart (succès + 2 cas d'erreur 422) et le rendu de l'historique
- [x] Vérification : test Playwright avec réponses réseau simulées (`page.route`) pour valider
  le rendu UI de bout en bout sans dépendre du choix du modèle ni du quota Mistral

### Résumé des changements
L'agent d'exploration choisit maintenant entre 3 actions à chaque tour (au lieu de 2) :
exécuter une requête SQL, ajouter un graphique au tableau de bord, ou conclure. Le deuxième
outil réutilise `useDashboardStore.addChart` (déjà utilisé par le constructeur de graphiques
manuel) sans aucune modification de cette infrastructure — seule la couche agent (schemas,
prompt, route, store, panel) est étendue.

### Revue
**Ce qui a fonctionné :** l'agent d'abord lancé en conditions réelles a choisi
"requête, requête, conclusion" (jamais l'action chart) — un choix légitime du modèle, mais qui
ne prouve rien sur la branche chart. Plutôt que de retenter en boucle (coûteux : chaque essai
consomme le quota Mistral 2 req/min et prend 2-3 min), la vérification a été faite en deux temps
indépendants du hasard du modèle : (1) tests backend isolés avec `call_mistral_json` mocké pour
tester la branche chart de façon déterministe, (2) test Playwright avec `page.route()`
interceptant `/agent-step` pour simuler une séquence chart→query→finish et valider tout le
pipeline frontend (rendu du mini-graphique, mise à jour réelle du dashboard) sans appel Mistral.

**Ce qui a été difficile :** un bug de rognage visuel repéré seulement grâce au test Playwright
avec captures d'écran — le cadre du mini-aperçu (180px) était plus petit que la hauteur interne
fixe du `ChartRenderer` en mode compact (220px), coupant les libellés de l'axe X. Corrigé en
portant le cadre à 236px (220 + padding).

**Preuve de fonctionnement :**
- Tests backend isolés : action chart valide → 200 avec les bons champs ; colonne X inexistante
  → 422 ; mesure Y non numérique → 422 ; une entrée d'historique `action="chart"` s'affiche
  correctement dans le message envoyé au modèle (pas de `SQL : None` résiduel).
- Test Playwright (réseau simulé) : le mini-graphique s'affiche dans le fil de l'agent (2 SVG
  Recharts détectés), et le graphique "Montant par ville" apparaît réellement sur la page
  "Tableau de bord" après coup — donc `addChart` fonctionne bien depuis le contexte de la page
  "Interroger", pas seulement depuis le tableau de bord lui-même.
- `npm run build` (tsc -b + vite build) et l'import de `app.main` passent sans erreur après
  toutes les modifications.
