# Setup and configuration

## Option A: Docker Compose (full stack)

```sh
# at the repo root, with a .env file (see below)
docker compose up --build
```

| URL | Service |
|---|---|
| http://localhost | SPA through Nginx (`/api` is proxied to the backend) |
| http://localhost:5000/api | Flask API |
| http://localhost:9001 | MinIO console |
| localhost:5432 | PostgreSQL (`diplomtrack` / `diplomtrack`) |

On startup the backend container (`backend/entrypoint.sh`) waits for Postgres and runs `python init_db.py`, which creates tables and seeds reference data and is safe to re-run. It then `exec`s Gunicorn with `GUNICORN_WORKERS` workers (default 6). If initialization fails, the container exits instead of serving.

Runtime data is bind-mounted into the repo: `./postgres`, `./minio`, `./backend/logs`, `./backend/uploads`, `./backend/data`. Delete `./postgres` to reset the database.

## Option B: Local development (no Docker)

### Backend (SQLite)

```sh
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows  (Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt
pip install minio               # missing from requirements.txt, see known-issues.md

set FLASK_ENV=development       # PowerShell: $env:FLASK_ENV="development"
python init_db.py               # creates backend/data/diplomtrack.db and seeds data
python app.py                   # http://localhost:5000
```

`DATABASE_TYPE` defaults to `sqlite`, so no database server is needed. If `USE_MINIO` is unset, profile images are stored in `backend/uploads/profiles/`.

`requirements-windows.txt` is an unpinned alternative list that also includes `waitress`, a WSGI server that works on Windows, where Gunicorn does not run.

### Frontend

```sh
cd frontend
npm install
npm run dev                     # http://localhost:8080
```

`.env.development` already points to the local API:

```env
VITE_API_BACKEND="rest"
VITE_REST_API_URL="http://localhost:5000/api"
```

### Tests

```sh
cd backend
pytest
```

Only `tests/test_auth_routes.py` exists at the moment.

## Default account

| Email | Password | Role |
|---|---|---|
| `admin@uit.ac.ma` | `123456` | ADMIN (must change password at first login) |

Change this password immediately on any shared or deployed instance.

## Environment variables

### Root `.env` (read by Docker Compose)

| Variable | Purpose |
|---|---|
| `JWT_SECRET_KEY` | Secret for signing JWTs. **Required in production.** The code falls back to `super-secret-key` |
| `MAIL_USERNAME`, `MAIL_PASSWORD` | SMTP credentials (Gmail app password) |
| `MAIL_DEFAULT_SENDER` | From address |

Do not commit `.env`.

### Backend (`backend/config.py`)

| Variable | Default | Notes |
|---|---|---|
| `FLASK_ENV` | — | `development` enables debug mode and stack traces in error responses |
| `DATABASE_TYPE` | `sqlite` | Anything else uses `DATABASE_URL` |
| `DATABASE_URL` | `postgresql://diplomtrack:diplomtrack@postgres:5432/diplomtrack` | |
| `JWT_SECRET_KEY` | `super-secret-key` | Override it |
| `USE_MINIO` | `false` | `true` stores profile images in MinIO |
| `MINIO_ENDPOINT` / `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` / `MINIO_SECURE` / `MINIO_BUCKET` | `minio:9000` / `minioadmin` / `minioadmin` / `false` / `uploads` | |
| `MAIL_SERVER` / `MAIL_PORT` | `smtp.gmail.com` / `465` | |
| `MAIL_USE_TLS` / `MAIL_USE_SSL` | `true` / `false` | Compose sets SSL on port 465 |
| `UPLOAD_FOLDER` | `uploads/profiles` | Local avatar folder |
| `ENABLE_SCHEDULER` | `true` | `false` disables the background jobs (useful for tests or extra API replicas) |
| `SCHEDULER_LOCK_FILE` | `<system temp>/diplomtrack-scheduler.lock` | Lock file that elects the single process that runs the scheduler |
| `FRONTEND_URL` | `http://localhost` | Base URL used for links in emails |

`MAX_CONTENT_LENGTH` is fixed at 10 MB per request.

### Frontend (`frontend/.env.*`)

| Variable | Notes |
|---|---|
| `VITE_API_BACKEND` | `rest` (Flask) or `supabase` (legacy) |
| `VITE_REST_API_URL` | `http://localhost:5000/api` in development, `/api` in production (same origin through Nginx) |
| `VITE_SUPABASE_*` | Used only by the legacy Supabase adapter |

## Runtime business settings

Settings such as the warning delay, upload limit, archive delay and email templates are stored in the `app_config` table, not in environment variables. Edit them in **Admin → Settings** or with `PUT /api/app_settings/1`.
