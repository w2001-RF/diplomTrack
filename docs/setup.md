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
| 127.0.0.1:5432 | PostgreSQL (`diplomtrack` / your `POSTGRES_PASSWORD`) |

On startup the backend container waits for Postgres, runs `python init_db.py` (creates tables and seeds reference data, safe to re-run), then starts Gunicorn.

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

`init_db.py` creates one admin account the first time it runs:

| Email | Password | Role |
|---|---|---|
| `ADMIN_EMAIL` (default `admin@uit.ac.ma`) | `ADMIN_PASSWORD`, or a random password printed once in the `init_db.py` output | ADMIN (must change password at first login) |

These variables only matter the first time. If the admin account already exists, it is left unchanged.

## Environment variables

### Root `.env` (read by Docker Compose)

| Variable | Purpose |
|---|---|
| `JWT_SECRET_KEY` | **Required.** Secret for signing JWTs |
| `POSTGRES_PASSWORD` | **Required.** Database password, also used in `DATABASE_URL`, so keep it URL-safe |
| `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` | **Required.** MinIO root credentials, also used by the backend |
| `ADMIN_PASSWORD` | Optional initial admin password (see [Default account](#default-account)) |
| `MAIL_USERNAME`, `MAIL_PASSWORD` | SMTP credentials (Gmail app password) |
| `MAIL_DEFAULT_SENDER` | From address (defaults to `MAIL_USERNAME`) |

`.env.example` lists all of these. Do not commit `.env`.

> **Upgrading an existing install:** Postgres sets the password only when `./postgres` is first initialized. If your data was created with the old hard-coded `diplomtrack` password, either set `POSTGRES_PASSWORD=diplomtrack` for now, or change it first with `docker compose exec postgres psql -U diplomtrack -c "ALTER USER diplomtrack PASSWORD '<new>'"`.

### Backend (`backend/config.py`)

| Variable | Default | Notes |
|---|---|---|
| `FLASK_ENV` | — | `development` enables debug mode and stack traces in error responses |
| `DATABASE_TYPE` | `sqlite` | Anything else uses `DATABASE_URL` |
| `DATABASE_URL` | `postgresql://diplomtrack:diplomtrack@postgres:5432/diplomtrack` | Compose builds it from `POSTGRES_PASSWORD` |
| `JWT_SECRET_KEY` | none | The app refuses to start without it, unless `FLASK_ENV=development` (then a dev-only key is used) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@uit.ac.ma` / random | Used once, when `init_db.py` creates the admin |
| `USE_MINIO` | `false` | `true` stores profile images in MinIO |
| `MINIO_ENDPOINT` / `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` / `MINIO_SECURE` / `MINIO_BUCKET` | `minio:9000` / `minioadmin` / `minioadmin` / `false` / `uploads` | |
| `MAIL_SERVER` / `MAIL_PORT` | `smtp.gmail.com` / `465` | |
| `MAIL_USE_TLS` / `MAIL_USE_SSL` | `true` / `false` | Compose sets SSL on port 465 |
| `UPLOAD_FOLDER` | `uploads/profiles` | Local avatar folder |

`MAX_CONTENT_LENGTH` is fixed at 10 MB per request.

### Frontend (`frontend/.env.*`)

| Variable | Notes |
|---|---|
| `VITE_API_BACKEND` | `rest` (Flask) or `supabase` (legacy) |
| `VITE_REST_API_URL` | `http://localhost:5000/api` in development, `/api` in production (same origin through Nginx) |
| `VITE_SUPABASE_*` | Used only by the legacy Supabase adapter |

## Runtime business settings

Settings such as the warning delay, upload limit, archive delay and email templates are stored in the `app_config` table, not in environment variables. Edit them in **Admin → Settings** or with `PUT /api/app_settings/1`.
