# RecoMind AI â€” Frontend

React + TypeScript + Vite + Tailwind CSS frontend for RecoMind AI.

## Features
- Cinematic, responsive UI with animations and reduced-motion support
- Browse synthetic movie catalog (20 titles)
- Select favorites/liked movies
- Get real content-based recommendations from the FastAPI backend via `POST /api/recommendations`
- Loading, error, and empty states with retry
- Clearly labeled as synthetic/demo data (not real user behavior)

## Environment
Copy `.env.example` to `.env` and configure:

```env
# Leave empty to use the Vite dev proxy (/api -> http://127.0.0.1:8000)
VITE_API_BASE_URL=
```

## Development
```bash
npm install
npm run dev
```

The dev server runs on http://127.0.0.1:5173 with a proxy for `/api`, `/health`, `/docs`, and `/openapi.json` to the backend at http://127.0.0.1:8000.

## Build
```bash
npm run build
npm run preview
```

## Tests
```bash
npm test
```

## Notes
- Recommendations use TF-IDF and cosine similarity (content-based only). No collaborative filtering.
- Dataset is synthetic (`data/raw/sample_movies.csv`).
- Similarity scores are content similarity values, not predicted ratings.
