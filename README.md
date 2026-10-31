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
| File storage | MinIO (S3-compatible, used for profile images) or the local `uploads/` folder |
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
├── frontend/           React SPA (originally generated with Lovable)
├── nginx/              Reverse-proxy config
├── postgres/, minio/   Docker bind-mounted data volumes (runtime data, not source)
├── docs/               Project documentation
└── docker-compose.yml
```

## Quick start (Docker)

1. Create a `.env` file at the repo root:

   ```env
   JWT_SECRET_KEY=change-me-to-a-long-random-string
   MAIL_USERNAME=you@example.com
   MAIL_PASSWORD=your-smtp-app-password
   MAIL_DEFAULT_SENDER=you@example.com
   ```

2. Start everything:

   ```sh
   docker compose up --build
   ```

3. Open the services:
   - Application: http://localhost
   - API: http://localhost:5000/api
   - MinIO console: http://localhost:9001 (`minioadmin` / `minioadmin`)

4. Log in with the seeded admin account, **`admin@uit.ac.ma` / `123456`**. You must change the password on first login.

For local development without Docker, see [docs/setup.md](docs/setup.md).

## Documentation

| Document | Contents |
|---|---|
| [docs/architecture.md](docs/architecture.md) | System architecture, layers, request flow, cross-cutting concerns |
| [docs/workflow.md](docs/workflow.md) | Ticket lifecycle, milestones, transition rules, document rules |
| [docs/data-model.md](docs/data-model.md) | Database entities and relationships |
| [docs/api.md](docs/api.md) | REST endpoint reference with role requirements |
| [docs/setup.md](docs/setup.md) | Local development, configuration and environment variables |
| [docs/known-issues.md](docs/known-issues.md) | Bugs and technical debt found while reviewing the code |
