# RecoMind AI â€” Personalized Recommendation Engine

RecoMind AI is a complete recommendation platform that suggests movies to users based on their interests, preferences, ratings, and feedback. This is a professional portfolio project built with FastAPI, React + TypeScript + Vite + Tailwind CSS, SQLAlchemy/SQLite, and scikit-learn for machine learning.

## Tech Stack
- **Backend:** Python 3.10.11, FastAPI, SQLAlchemy, SQLite
- **ML:** pandas, NumPy, scikit-learn
- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **API:** REST

## Project Structure
```
recomind-ai/
â”œâ”€â”€ backend/        # FastAPI application
â”œâ”€â”€ frontend/       # React + TypeScript + Vite app
â”œâ”€â”€ ml/             # Recommendation algorithms, training, pipelines
â”œâ”€â”€ data/           # Raw/processed datasets (gitignored)
â”œâ”€â”€ docs/           # Documentation
â””â”€â”€ .venv/          # Project virtual environment (not recreated)
```

## Development Plan (Incremental)
1. **Foundation** (current) â€” project config, gitignore, docs scaffolding
2. **Python environment** â€” use Python 3.10.11, create/use suitable project-local venv without deleting existing .venv
3. **FastAPI backend** â€” config, DB, models, schemas, health, API structure
4. **Recommendation engine** â€” working content-based algorithm (pandas + scikit-learn)
5. **Dataset pipeline** â€” sample dataset + support for real movie CSV
6. **API integration** â€” connect engine to endpoints
7. **Testing** â€” meaningful unit and API tests
8. **Frontend** â€” professional responsive UI
9. **Integration** â€” connect frontend to backend, end-to-end test
10. **Documentation** â€” setup, architecture, API, portfolio details

## Backend Development (Phase 3)
The backend uses the project-local Python 3.10.11 environment in `.venv310`.

```powershell
cd C:\Users\hp\Documents\recomind-ai\backend

# Install pinned dependencies into .venv310 only
..\.venv310\Scripts\python.exe -m pip install -r requirements.txt

# Optional: create local configuration
Copy-Item ..\.env.example ..\.env

# Run the development server
..\.venv310\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open:
- API information: http://127.0.0.1:8000/
- Health check: http://127.0.0.1:8000/health
- Swagger UI: http://127.0.0.1:8000/docs

Run the tests from the `backend` directory:

```powershell
..\.venv310\Scripts\python.exe -m pytest
```

The development database defaults to SQLite at `backend/recomind.db` when the
server is started from `backend`. Set `DATABASE_URL` in `.env` to override it.
Automatic schema creation only runs outside `production`; use Alembic
migrations for production deployments.

## Notes
- Use Python 3.10.11 for compatibility.
- No secrets committed. Use `.env` (see `.env.example`).
- Datasets and ML artifacts are gitignored.
