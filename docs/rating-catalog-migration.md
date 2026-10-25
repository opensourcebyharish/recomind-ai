# Rating catalog migration

Ratings are now stored with `catalog` (`local` or `tmdb`) in `user_movie_ratings`. TMDB IDs must use the namespaced form `tmdb:<positive-id>`; local rating IDs cannot use that prefix. This keeps catalog identity explicit and prevents TMDB ratings from becoming local recommender inputs.

The project did not have an Alembic revision history. The existing SQLite migration is therefore an idempotent additive migration in `backend/app/database/migrations.py`. It adds `catalog VARCHAR(16) NOT NULL DEFAULT 'local'`; existing rating rows retain their IDs, values, timestamps, and are classified as local, matching the prior frontend which only allowed local ratings. Development startup runs it after `create_all`.

For a production SQLite database, stop the application and run this from the `backend` directory before deploying the new code:

```powershell
..\.venv310\Scripts\python.exe migrate_rating_catalog.py
```

The script uses the configured `DATABASE_URL`, preserves every rating row, and can be run again safely. Take the normal database backup before applying schema changes. For non-SQLite database engines, this migration intentionally fails instead of applying unverified DDL.
