# Known issues and technical debt

Found while reviewing the code on 2026-10-31. Ordered by impact. None of them has been fixed.

## Bugs

### 1. Delay warnings never fire
`services/notification_service.py` → `check_and_create_delay_warnings()`

- It selects tickets with `status='IN_PROGRESS'`, but the workflow never sets that value. `WorkflowManager.update_ticket_status` only sets `OPEN`, `PENDING` or `COMPLETED`.
- It then looks for a chronology on `EN_ATTENTE_REPONSE` with `status == 'DONE'`. While the ticket is still waiting on that milestone, its chronology is `PENDING`.

Result: the hourly job and `POST /api/notifications/check-delays` always find 0 tickets.
**Fix:** filter on `current_milestone_id` only (or `status='PENDING'`), and use the chronology that is still open (`ended_at IS NULL`).

### 2. The scheduler runs once per Gunicorn worker
`app.py` starts APScheduler inside `create_app()`. `entrypoint.sh` launches Gunicorn with `-w 6`, so six schedulers run the same job. Once issue 1 is fixed, every warning would be created six times.
**Fix:** run the scheduler in a separate process or container, use `gunicorn --preload` with a lock, or use a job store with a single leader.

### 3. `entrypoint.sh` starts Gunicorn twice
The first `gunicorn wsgi:app …` line runs in the foreground (single worker, no `exec`), so everything after it is never reached. That includes the intended `exec gunicorn -w 6`. `init_db.py` is also listed twice.
**Fix:** keep only the final block (`python init_db.py` followed by `exec gunicorn -w 6 …`).

### 4. `config.py` imports the test suite
`from tests.conftest import app` is at the top of `config.py`. Production code then depends on `pytest` and test fixtures, and the import is unused.
**Fix:** delete the line.

### 5. ✅ Fixed: `minio` package missing from `requirements.txt`
Fixed in branch `fix/minio-dependency`. `utils/minio_client.py` imports `minio`, but only `boto3` was listed, so with `USE_MINIO=true` (the Docker default) profile image upload and delete failed with `ModuleNotFoundError`. `minio==7.2.20` is now pinned in `requirements.txt` and listed in `requirements-windows.txt`. `requirements.txt` was also converted from UTF-16 to UTF-8.

### 6. `Document.to_dict()` would crash
It returns `self.document_type.value`, but `document_type` is a plain string column. It is not called today because routes use Marshmallow schemas, but any future caller would get an `AttributeError`.

### 7. Ticket status values are inconsistent
The model comment documents `OPEN | BLOCKED | IN_PROGRESS | COMPLETED`, but the workflow writes `PENDING`. `BLOCKED` is never set, even though there is a "ticket blocked" email template. Pick one vocabulary and use it in the backend, the frontend filters and the notification queries.

## Incomplete features

- **Emails are never triggered.** `EmailService.send_ticket_blocked_notification`, `send_agent_delay_warning` and `send_admin_daily_report` are fully implemented and their templates are seeded, but nothing calls them except the admin test endpoints. `enable_email_notifications` and `email_check_interval_hours` are not used.
- **Documents carry no file content.** `POST /api/documents/` accepts a `file_path` string only. There is no binary upload for dossier documents, only for profile images.
- **`auto_archive_days`** is stored but no archiving job exists.
- **No migrations.** Flask-Migrate and Alembic are installed, but the schema relies on `db.create_all()`, which never alters existing tables. Adding a column to a model will not update an existing Postgres database.

## Security and configuration

- **Weak defaults.** The seeded admin password is `123456` (a reset is forced at login), `JWT_SECRET_KEY` falls back to `super-secret-key`, and MinIO and Postgres use default credentials in `docker-compose.yml`. Move all secrets to `.env` and fail at startup if `JWT_SECRET_KEY` is unset in production.
- **The default mail sender** is hard-coded in `config.py` to a personal address. Make it environment-only.
- **CORS origins** are hard-coded in `app.py`. Read them from configuration.
- **JWT in `localStorage`** is readable by any script that runs on the page (XSS). An httpOnly cookie would be more robust.
- **The ownership checks** on `/api/auth/upload-profile-image/<user_id>`, `/delete-profile-image/<user_id>`, `PATCH /tickets/<id>/diploma-validation-type` and `POST /tickets/<id>/submit-corrected-documents` should be reviewed. These routes have no `@require_roles` and accept a client-supplied id.
- **`minio:latest`** is unpinned. Pin a version for reproducible builds.

## Code hygiene

- Leftover `print()` debug calls in `workflow_service.py` (for example `print(db.session.query)`). Use `logger.debug`.
- Two different `ChronologyManager` classes exist (`workflow_service.py` and `ticket_service.py`).
- Runtime data is mixed into the source tree: `postgres/`, `minio/`, `backend/logs/`, `backend/data/*.db`, `backend/uploads/`, `.venv/`, `.pytest_cache/`. The repo root is not a git repository (only `frontend/` is). When you initialize one, add a `.gitignore` that excludes these paths and `.env`.
- Supabase leftovers in the frontend (`integrations/supabase`, `supabase/migrations`, `supabase.adapter.ts`, `data/mockData.ts`) and the Lovable template `frontend/README.md` can be removed once the REST backend is final.
- Test coverage is limited to auth routes. The workflow engine (`update_status` and its validators) is the most valuable thing to test next.
