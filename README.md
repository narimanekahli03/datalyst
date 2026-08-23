# Datalyst

SaaS d'analyse de données 100% navigateur : chargez un fichier, nettoyez-le, explorez-le,
visualisez-le, interrogez-le en langage naturel grâce à l'IA, et générez un rapport PDF.

**Parcours produit :** charger → nettoyer → explorer → visualiser → interroger (IA) → rapporter

## Aperçu

| Page | Ce qu'elle fait |
|---|---|
| **Nettoyage** | Import CSV/Excel, aperçu paginé avec types détectés automatiquement, opérations de nettoyage en un clic (doublons, valeurs manquantes, espaces, conversion de type), historique avec annulation. Affiche aussi un panneau **Insights IA** : 3 à 5 observations générées automatiquement à l'ouverture du fichier. |
| **Exploration** | Statistiques automatiques par colonne (moyenne, médiane, quartiles, valeurs aberrantes, top valeurs), matrice de corrélation, détection d'outliers. |
| **Tableau de bord** | Constructeur de graphiques (barres, lignes, aires, secteurs, nuage de points) et d'indicateurs clés, export PNG. |
| **Interroger** | Text-to-SQL : posez une question en français, l'IA génère du SQL, l'exécute dans le navigateur via DuckDB-WASM, corrige automatiquement les erreurs d'exécution, et répond en langage naturel. Historique des questions rejouable. |
| **Rapport** | Assemble un rapport à partir de blocs (texte, graphique, indicateurs, tableau, insights IA, question IA) et l'exporte en PDF. |

Toutes les données restent dans le navigateur (DuckDB-WASM, calculs client-side) — seules la
question posée et des statistiques agrégées (jamais les lignes brutes) transitent vers le
backend pour la génération SQL/résumés par l'IA.

## Stack technique

**Frontend** (`src/`) — React 18, Vite 6, TypeScript, Tailwind CSS, composants shadcn/ui,
Zustand (un store par domaine), TanStack Table, Recharts, DuckDB-WASM, @react-pdf/renderer,
Papa Parse / SheetJS pour le parsing de fichiers.

**Backend** (`backend/`) — FastAPI, Mistral AI (`mistralai` SDK), Pydantic, `sqlglot` pour la
validation SQL en lecture seule.

Monorepo volontaire : front et back vivent dans ce même dépôt, mais sont deux applications
indépendantes (deux process, deux serveurs de dev).

## Structure du projet

```
Datalyst/
├── src/
│   ├── pages/              # Une page par étape du parcours
│   ├── components/         # UI, groupée par domaine (cleaning/, dashboard/, query/, report/, ui/, ...)
│   ├── store/               # Un store Zustand par domaine (dataset, dashboard, report, textToSql, insights, navigation)
│   ├── lib/                 # Logique pure : stats, duckdb, appels API, PDF, parsing de fichiers
│   └── types/                # Types partagés
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI + CORS + les 4 endpoints
│   │   ├── schemas.py        # Modèles Pydantic (contrat aligné sur src/types/*.ts)
│   │   ├── prompts.py        # Prompts système + construction des messages
│   │   ├── mistral_client.py # Appel Mistral, gestion des erreurs/rate limit
│   │   └── sql_safety.py     # Validation SQL lecture seule (AST via sqlglot)
│   ├── requirements.txt
│   └── .env.example          # Modèle vide — copier en .env avec vos propres valeurs
├── Dockerfile                # Build multi-stage (frontend statique + backend FastAPI)
└── docs/plans/                # Historique des plans de fonctionnalités
```

## Prérequis

- Node.js 18+ et npm
- Python 3.11+
- Une clé API Mistral ([console.mistral.ai](https://console.mistral.ai))

## Installation

```bash
# Frontend
npm install

# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows — sous macOS/Linux : source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

## Configuration

```bash
cd backend
copy .env.example .env          # Windows — sous macOS/Linux : cp .env.example .env
```

Puis éditez `backend/.env` :

| Variable | Description | Défaut |
|---|---|---|
| `MISTRAL_API_KEY` | **Obligatoire.** Votre clé API Mistral. | *(vide)* |
| `MISTRAL_MODEL` | Modèle Mistral utilisé. | `mistral-large-latest` |
| `CORS_ALLOWED_ORIGINS` | Origines autorisées à appeler le backend, séparées par des virgules. | `http://localhost:5173,http://localhost:5174` |

`backend/.env` n'est jamais commité (voir `backend/.gitignore`) — `backend/.env.example` est
le modèle public, à toujours garder vide de vraies valeurs.

## Lancer en local

**Deux terminaux séparés, lancés en même temps** (arrêter l'un dans le même terminal que l'autre
coupe le premier) :

```bash
# Terminal 1 — frontend
npm run dev                     # http://localhost:5173

# Terminal 2 — backend
cd backend
.venv\Scripts\activate
uvicorn app.main:app --reload --port 8000   # http://localhost:8000
```

Ouvrez ensuite http://localhost:5173 dans votre navigateur.

## Scripts disponibles

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de développement frontend (Vite, hot reload) |
| `npm run build` | Vérifie les types (`tsc -b`) puis build de production (`vite build`) |
| `npm run lint` | ESLint sur tout le projet frontend |
| `npm run preview` | Sert le build de production en local |

Côté backend, `uvicorn app.main:app --reload --port 8000` recharge automatiquement sur
modification de fichier.

## API backend

Base URL locale : `http://localhost:8000`. Toutes les routes sont en `POST`, sauf `/health`.

| Endpoint | Rôle |
|---|---|
| `GET /health` | Vérification de disponibilité |
| `POST /generate-sql` | Question en langage naturel + schéma → SQL généré (lecture seule, validé) + explication |
| `POST /fix-sql` | SQL en échec + message d'erreur DuckDB → SQL corrigé |
| `POST /summarize` | Question + résultat de requête → résumé en langage naturel (français) |
| `POST /generate-insights` | Statistiques agrégées du dataset → 3 à 5 observations classées par catégorie |
| `POST /agent-step` | Agent d'exploration autonome : à partir de l'historique de ses propres requêtes, propose la prochaine requête SQL à exécuter ou conclut avec un résumé + observations |

Le contrat exact des requêtes/réponses est défini dans `backend/app/schemas.py` (Pydantic) et
`src/types/textToSql.ts` / `src/types/insights.ts` (TypeScript) — les deux doivent rester
synchronisés à la main.

Tous les endpoints IA renvoient une erreur `429` avec un message explicite en cas de dépassement
du quota Mistral (le plan gratuit est limité à 2 requêtes par minute).

## Limites connues

- **Aucun test automatisé** n'existe encore, ni côté frontend ni côté backend.
- Le chunk JS principal du build frontend fait environ 960 Ko gzippé, à cause de l'import
  statique de `duckdb-wasm` — un import dynamique réglerait ça (non fait à ce jour).
- Le `Dockerfile` fournit un build de production (frontend statique servi par le backend
  FastAPI, un seul port) mais n'a pas encore été testé en conditions réelles de déploiement.