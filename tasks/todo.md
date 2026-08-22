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
