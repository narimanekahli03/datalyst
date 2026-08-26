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

---

## Robustesse de l'agent — les échecs de graphique n'interrompent plus toute la run

Plan complet : [docs/plans/agent-robustesse-graphique.md](../docs/plans/agent-robustesse-graphique.md)

### Plan
- [x] Backend : `AgentStepResponse.error_message` ajouté (schemas.py)
- [x] Backend : `_validate_chart_fields` retourne une erreur au lieu de lever une `HTTPException`
  (main.py) — une colonne invalide devient un 200 avec `error_message`, plus un 422 fatal
- [x] Backend : `_format_agent_history` affiche `ÉCHEC` pour une entrée chart en erreur + le
  rappel dynamique ignore les tentatives échouées pour continuer à pousser vers un nouvel essai
  (prompts.py)
- [x] Frontend : `types/agent.ts` — `error_message` sur `AgentStepResponse`
- [x] Frontend : `agentExplorationStore.ts` — branche chart en échec : pas d'`addChart`,
  historise l'échec, `trail` avec `chart: null` + `errorMessage`, la boucle continue
- [x] Frontend : `AgentExplorationPanel.tsx` — rendu corrigé pour distinguer graphique réussi /
  échoué / requête (l'ancien code aurait affiché "Échec de la requête" pour un graphique raté)
- [x] Vérification : tests backend isolés (colonne inexistante et mesure non numérique → 200
  avec `error_message`, plus 422 ; cas valide inchangé ; rendu de l'historique avec `ÉCHEC`)
- [x] Vérification : test Playwright réseau simulé (query → chart invalide → finish) — la run
  va au bout, le bon message d'erreur s'affiche, rien n'est ajouté au dashboard
- [x] Vérification : `tsc -b && vite build` propre

### Résumé des changements
Avant : un graphique halluciné par l'agent (mauvais nom de colonne, mesure non numérique)
renvoyait une 422 qui faisait planter toute la run côté frontend (`phase:"error"`, arrêt
immédiat) — perte totale de 2-3 minutes de travail pour une seule erreur récupérable. Après :
le backend renvoie toujours 200, avec `error_message` rempli en cas de problème ; le frontend
réinjecte l'échec dans l'historique (même mécanisme que pour une requête SQL qui échoue à
l'exécution) et continue la boucle — l'agent voit son erreur au tour suivant et peut se
corriger, exactement comme pour les requêtes.

### Revue
**Ce qui a fonctionné :** le pattern existant pour les échecs de requête SQL (historiser plutôt
qu'avorter) s'est transposé directement au graphique sans surprise — même philosophie, même
mécanisme de rendu (`errorMessage` déjà présent dans `AgentTrailEntry`), juste une distinction
de branchement à corriger dans le composant pour ne pas confondre les deux types d'échec.

**Ce qui a été difficile :** rien de bloquant. Le seul point de vigilance identifié en amont
(et traité dans le plan) : garder une distinction entre échec de *contenu* (mauvaise colonne —
récupérable, 200) et échec de *format* (JSON qui casse le contrat Pydantic — non récupérable,
502 conservé), pour ne pas transformer un vrai bug de format en boucle infinie silencieuse.

**Preuve de fonctionnement :**
- Tests backend isolés : colonne X inexistante et mesure Y non numérique renvoient maintenant
  **200** avec `error_message` rempli (plus de 422) ; le cas valide reste inchangé (200, pas
  d'`error_message`) ; une entrée d'historique en échec s'affiche avec `ÉCHEC` dans le message
  envoyé au modèle.
- Test Playwright (réseau simulé, séquence query → chart invalide → finish) : la run atteint
  bien la conclusion (`phase` ne passe jamais à `"error"`), le fil affiche "Échec de l'ajout du
  graphique : Colonne inconnue..." (pas "Échec de la requête", confusion évitée), et le
  tableau de bord ne contient aucun graphique fantôme.
- `npm run build` (tsc -b + vite build, 2m41s) et l'import de `app.main` passent sans erreur.

---

## Deuxième table + jointures (scopé à la page "Interroger")

Plan complet : [docs/plans/deuxieme-table-jointures.md](../docs/plans/deuxieme-table-jointures.md)

### Plan
- [x] Backend : `validate_read_only_sql` accepte un ensemble de tables autorisées au lieu
  d'une seule (sql_safety.py) — aucun changement structurel nécessaire, juste le paramètre
- [x] Backend : `secondary_tables` ajouté à `GenerateSqlRequest`/`FixSqlRequest`/
  `AgentStepRequest` (schemas.py)
- [x] Backend : `_format_schemas` (rendu multi-tables + mention JOIN si ≥ 2), les 3 builders de
  message prennent la liste complète des schémas (prompts.py)
- [x] Backend : les 3 routes calculent `allowed_tables` = table principale + secondaires
  (main.py) — `_validate_chart_fields` volontairement NON touché (le graphique de l'agent
  reste sur le dataset principal en mémoire, pas sur DuckDB)
- [x] Frontend : `loadDatasetIntoDuckDB(dataset, tableName?)` paramétré, staging namespacé par
  table (loadDataset.ts) ; `buildDatasetSchema(dataset, tableName?)` idem (schemaBuilder.ts)
- [x] Frontend : `sanitizeTableName(fileName, reserved)` — nouveau (tableName.ts)
- [x] Frontend : `secondaryTableStore.ts` — nouveau store indépendant, pas branché sur le reset
  du dataset principal (décision volontaire)
- [x] Frontend : `textToSqlStore.ts` et `agentExplorationStore.ts` incluent `secondary_tables`
  dans leurs appels quand une table est chargée
- [x] Frontend : `SecondaryTableWidget.tsx` — nouveau, chip compact sur la page Interroger
  (visible dans les deux modes)
- [x] Vérification : tests backend isolés (JOIN accepté, table inconnue rejetée avec les deux
  noms listés, régression sans table secondaire)
- [x] Vérification : `tsc -b && vite build` propre
- [x] Vérification : test Playwright bout en bout avec deux vrais fichiers CSV, question
  nécessitant une jointure, dev servers réels

### Résumé des changements
Sur la page "Interroger" uniquement (nettoyage/dashboard/insights inchangés), on peut
maintenant joindre un second fichier CSV/Excel comme deuxième table DuckDB. Le text-to-SQL et
l'agent voient les deux schémas et peuvent écrire des requêtes avec JOIN. Le nom de table de la
seconde table est dérivé automatiquement du nom de fichier (`sanitizeTableName`).

### Revue
**Ce qui a fonctionné :** la recherche préalable (deux agents d'exploration en parallèle,
frontend + backend) a payé — `sql_safety.py` n'avait aucun couplage caché à une seule table,
donc la généralisation a été mécanique (3 lignes touchées) plutôt qu'une réécriture. Le pattern
"paramètre optionnel avec valeur par défaut = comportement actuel" (déjà utilisé pour l'agent)
a encore permis un changement 100% additif sur tous les call sites existants.

**Ce qui a été difficile :** repérer que l'action `chart` de l'agent ne devait PAS être étendue
aux colonnes de la table secondaire — `chartData.ts`/`ChartRenderer` lisent le `Dataset` déjà
en mémoire (Zustand), pas DuckDB, donc charter une colonne qui n'existe que dans la table
secondaire aurait validé côté backend mais produit un graphique vide côté front, un bug
silencieux difficile à diagnostiquer. Repéré à l'analyse, pas en le découvrant en testant.

**Preuve de fonctionnement (bout en bout, deux vrais fichiers, dev servers réels) :**
- Chargé `exemple-donnees-sales.csv` (table `data`) puis joint `commandes.csv` (table
  `commandes` auto-nommée) via le nouveau chip — "Table jointe : commandes (commandes.csv ·
  5 lignes · 4 colonnes)".
- Question "Quel est le montant total des commandes par client (Nom) ?" a généré :
  `WITH montants_par_client AS (SELECT d."Nom", SUM(c."montant_commande") ... FROM "data" d
  JOIN "commandes" c ON d."ID" = c."client_id" GROUP BY d."Nom") ...` — jointure correcte sur
  la bonne clé, exécutée sans erreur DuckDB, résultat affiché en tableau + graphique.
- Le payload réseau confirmé (`secondary_tables` bien présent avec le schéma complet de
  `commandes`), 0 erreur console.
- Sans table secondaire chargée : comportement inchangé (vérifié dans les tests backend
  isolés — pas de régression sur le flux à une seule table).
