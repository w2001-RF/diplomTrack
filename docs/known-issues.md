# Known issues and technical debt

Found while reviewing the code on 2026-10-31. Ordered by impact. None of them has been fixed.

## Bugs

### 1. ✅ Fixed: delay warnings never fired
Fixed in branch `fix/delay-warnings`. The check used to look for `status='IN_PROGRESS'` (never set by the workflow) and for a `DONE` chronology (a waiting ticket's chronology is `PENDING`), so it always found 0 tickets. The scheduled job also ran without a Flask app context, so it would have crashed on its first query.

It now selects tickets by `current_milestone_id` only and uses the chronology that is still open (`ended_at IS NULL`). The job pushes `app.app_context()`, and the 24-hour dedup only looks at earlier *delay* warnings, so other `warning` notifications don't suppress it. Covered by `tests/test_delay_warnings.py`.

### 2. ✅ Fixed: the scheduler ran once per Gunicorn worker
Fixed in branch `fix/single-scheduler`. `create_app()` runs in every Gunicorn worker, so `-w 6` started six schedulers. `init_scheduler()` now takes an exclusive, non-blocking lock on a file (`fcntl.flock` on Linux, `msvcrt.locking` on Windows), and only the process holding it starts APScheduler. If that worker dies, the OS releases the lock and the respawned worker picks it up. Set `ENABLE_SCHEDULER=false` to turn the scheduler off entirely. Covered by `tests/test_scheduler_lock.py`.

### 3. ✅ Fixed: `entrypoint.sh` started Gunicorn twice
Fixed in branch `fix/entrypoint`. A leftover single-worker `gunicorn` line ran in the foreground, so the intended `exec gunicorn -w 6` was never reached and `init_db.py` was listed twice. The script now waits for Postgres, runs `init_db.py` once, and `exec`s Gunicorn so it gets container signals as PID 1. The worker count comes from `GUNICORN_WORKERS` (default 6), and `set -e` stops the container if initialization fails. A new `.gitattributes` keeps `*.sh` files on LF line endings, because a Windows checkout with CRLF would break the script inside the Linux container.

### 4. ✅ Fixed: `config.py` imported the test suite
Fixed in branch `fix/config-test-import`. The unused `from tests.conftest import app` at the top of `config.py` loaded `pytest` and the test fixtures every time the app started. It has been removed. Importing `config` no longer loads `pytest` or `tests.conftest`.

### 5. ✅ Fixed: `minio` package missing from `requirements.txt`
Fixed in branch `fix/minio-dependency`. `utils/minio_client.py` imports `minio`, but only `boto3` was listed, so with `USE_MINIO=true` (the Docker default) profile image upload and delete failed with `ModuleNotFoundError`. `minio==7.2.20` is now pinned in `requirements.txt` and listed in `requirements-windows.txt`. `requirements.txt` was also converted from UTF-16 to UTF-8.

### 6. `Document.to_dict()` would crash
It returns `self.document_type.value`, but `document_type` is a plain string column. It is not called today because routes use Marshmallow schemas, but any future caller would get an `AttributeError`.

### 7. Ticket status values are inconsistent
The model comment documents `OPEN | BLOCKED | IN_PROGRESS | COMPLETED`, but the workflow writes `PENDING`. `BLOCKED` is never set, even though there is a "ticket blocked" email template. Pick one vocabulary and use it in the backend, the frontend filters and the notification queries.

## Incomplete features

- ✅ **Fixed: emails were never triggered.** Fixed in branch `fix/email-notifications`. All three emails are now sent (see [architecture.md](architecture.md#cross-cutting-concerns)), and the template links point to real SPA routes (`/dossier/<id>`, `/dossiers`, `/admin`). Existing databases keep their old template copies in `app_config`, so re-save the templates in **Admin → Settings** to pick up the corrected links. Still open: `email_check_interval_hours` is not used, and the delay check stays hourly.
- **Documents carry no file content.** `POST /api/documents/` accepts a `file_path` string only. There is no binary upload for dossier documents, only for profile images.
- **`auto_archive_days`** is stored but no archiving job exists.
- **No migrations.** Flask-Migrate and Alembic are installed, but the schema relies on `db.create_all()`, which never alters existing tables. Adding a column to a model will not update an existing Postgres database.

## Security and configuration

- ✅ **Fixed: weak defaults.** Fixed in branch `fix/insecure-defaults`. The changes:
  - The seeded admin password comes from `ADMIN_PASSWORD`, or is randomly generated and printed once, instead of `123456`.
  - The app refuses to start without `JWT_SECRET_KEY` unless `FLASK_ENV=development`.
  - Postgres and MinIO credentials come from required `.env` variables (Compose fails fast if they are missing), and both services only listen on `127.0.0.1`.
  - The mail sender defaults to `MAIL_USERNAME` instead of a hard-coded personal address.
  - `.env.example` documents every variable.

  Covered by `tests/test_secure_defaults.py`. The admin password of an existing database is unchanged.
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
