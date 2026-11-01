# DiplomTrack

DiplomTrack is a web application for tracking **diploma dossiers** of continuing-education students (*Formation Continue*). Each student's diploma request becomes a **ticket** (reference `FC-XXXXXXXX`) that moves through a defined administrative workflow: document collection and checking, an optional diploma-validation detour through the university center, submission, and closure.

It was built for the Université Ibn Tofail (`uit.ac.ma`) and covers two kinds of formation:

- **LUS**: Licence Universitaire Spécialisée
- **MUS**: Master Universitaire Spécialisé

## Who uses it

| Role | What they do |
|---|---|
| **ADMIN** | Manages users (including bulk agent creation), application settings, email templates and the SMTP test. Sees the global dashboard. |
| **AGENT** | Creates and imports students and tickets, validates or invalidates documents, moves tickets through the workflow. |
| **STUDENT** | Signs up (only if an agent already created their student profile with the same email), follows their dossier, receives notifications. |

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix), TanStack Query, React Router, Recharts, `xlsx` for Excel import |
| Backend | Python 3.13, Flask 3, Flask-SQLAlchemy, Flask-JWT-Extended, Marshmallow, Flask-Mail, APScheduler, Gunicorn |
| Database | PostgreSQL 16 (Docker) or SQLite (local development) |
| File storage | MinIO (S3-compatible, for profile images and scanned dossier documents) or the local `uploads/` folder |
| Serving | Nginx serves the built SPA and proxies `/api/*` to the backend |
| Orchestration | Docker Compose |

## Repository layout

```
diplomtrack/
├── backend/            Flask REST API (routes → services → models)
│   ├── models/         SQLAlchemy entities
│   ├── routes/         Flask blueprints, one per resource, all under /api
│   ├── services/       Business logic (workflow, tickets, documents, email…)
│   ├── schemas/        Marshmallow serializers
│   ├── tasks/          APScheduler background jobs
│   ├── templates/      HTML email templates
│   ├── utils/          Constants (workflow graph), RBAC decorator, MinIO client
│   ├── tests/          pytest suite
│   └── init_db.py      Creates tables and seeds reference data
├── frontend/           React SPA (talks to the Flask API through src/lib/api)
├── nginx/              Reverse-proxy config
├── postgres/, minio/   Docker bind-mounted data volumes (runtime data, not source)
├── docs/               Project documentation
└── docker-compose.yml
```

## Quick start (Docker)

1. Copy `.env.example` to `.env` and fill it in. `JWT_SECRET_KEY`, `POSTGRES_PASSWORD`, `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD` are required, and Compose refuses to start without them. To generate random values:

   ```sh
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

2. Start everything:

   ```sh
   docker compose up --build
   ```

3. Open the services:
   - Application: http://localhost
   - API: http://localhost:5000/api
   - MinIO console: http://localhost:9001 (your `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`)

   Postgres and MinIO only listen on `127.0.0.1`.

4. Log in as **`admin@uit.ac.ma`**. The password is `ADMIN_PASSWORD` from `.env`. If you left that empty, a random password is printed once in the backend logs (`docker compose logs backend | grep "admin password"`). You must change it at first login.

For local development without Docker, see [docs/setup.md](docs/setup.md).

## Documentation

| Document | Contents |
|---|---|
| [docs/architecture.md](docs/architecture.md) | System architecture, layers, request flow, cross-cutting concerns |
| [docs/workflow.md](docs/workflow.md) | Ticket lifecycle, milestones, transition rules, document rules |
| [docs/data-model.md](docs/data-model.md) | Database entities and relationships |
| [docs/api.md](docs/api.md) | REST endpoint reference with role requirements |
| [docs/setup.md](docs/setup.md) | Local development, configuration and environment variables |
| [docs/testing.md](docs/testing.md) | Backend, frontend and end-to-end (Robot Framework) tests |
| [docs/known-issues.md](docs/known-issues.md) | Bugs and technical debt found while reviewing the code |
