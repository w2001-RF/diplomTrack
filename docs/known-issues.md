# Known issues and technical debt

Found while reviewing the code on 2026-10-31. Ordered by impact. Entries marked ✅ have been fixed; the branch that fixed each one is named in the entry.

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
The frontend no longer depends on it (it reads `current_milestone.code`, see #12), but the backend vocabulary is still inconsistent:
The model comment documents `OPEN | BLOCKED | IN_PROGRESS | COMPLETED`, but the workflow writes `PENDING`. `BLOCKED` is never set, even though there is a "ticket blocked" email template. Pick one vocabulary and use it in the backend, the frontend filters and the notification queries.

### 8. ✅ Fixed: frontend calls that did not match the Flask API
Fixed in branch `refactor/frontend-python-backend`:
- **Notifications.** The UI read `read`, but the API returns `is_read`, so every notification counted as unread. "Mark as read" called `PATCH /notifications/<id>` and "mark all" looped over it; neither route exists, the real ones are `PATCH /<id>/read` and `PATCH /read-all`. The list did not return `type` or `ticket_id`, so icons and links never worked (the backend now returns them, covered by `tests/test_notification_routes.py`). The Supabase realtime subscriptions are replaced by 60-second polling.
- **Broken links.** Notification and dossier links went to `/ticket/<id>`, which is not a route. They now go to `/dossier/<id>`.
- **Role change.** `AdminUsers` wrote to Supabase directly and compared lowercase role values with the uppercase `UserRole` enum, so promoting a user always failed. It now calls `PUT /api/admin/users/<id>`. Role badges, colors and icons also used lowercase keys and now show.
- **Error messages.** Flask returns `{"error": …}`, but most adapter methods read `message`, so users saw "Request failed". All requests now go through one parser.
- **Password change.** A failed `PUT /auth/reset-password` was reported as a success, because the pages read `data.error` while the adapter returned `error`.
- **Expired sessions.** A 401 after the JWT expired (8 hours) left the user on the page with failing requests. It now logs them out.
- **Uploads through Nginx.** Nginx's default 1 MB body limit was below Flask's 10 MB `MAX_CONTENT_LENGTH`; it is now 10 MB.
- **`npm ci` failed** because `package-lock.json` was out of sync with `package.json`. The lockfile is regenerated.

### 9. ✅ Fixed: creating a user through the admin API answered 500
Fixed in branch `test/frontend-suites`, found by the QA suite. `UserService.create_user` passed `user_id=` to `AuditService.log_action`, which takes `performed_by=`. The user was already committed, so the account existed but the API (and the admin UI) reported an error, and no audit row was written. Covered by `tests/test_admin_users.py`.

### 10. ✅ Fixed: the signup validation test always failed
Fixed in branch `test/frontend-suites`. `test_signup_missing_fields_returns_400` failed on `main` because the test app in `tests/conftest.py` had none of the JSON error handlers that `create_app()` registers, so the route's `ValidationError` escaped instead of becoming a 400. The handlers now live in `error_handlers.py` and both use them. The route itself was correct.

### 11. ✅ Fixed: problems found by the QA run's server log
Fixed in branch `fix/qa-findings`. The Robot suite passed, but the backend log showed:
- **Lists never loaded in development.** Collections are declared as `/` under a `url_prefix`, so `GET /api/tickets` answered 308 → `/api/tickets/`. Behind the Vite proxy the redirect pointed at the API's own origin, and the browser followed it without the `Authorization` header (401). `register_routes()` now sets `strict_slashes = False`.
- **The agent dashboard crashed once tickets did load.** The refactored adapter only unwrapped `{data}`/`{items}` envelopes, while the pages read `{tickets, total}`. `getMany` now unwraps any single-list envelope (`students`, `documents`…), and `useTicketsQuery` returns the typed `TicketListResponse` the pages use. The dashboard's empty state (`recentTickets.total === 0` on an array) never showed; fixed.
- **A malformed token answered 422 with `msg`**, so the SPA did not treat it as a dead session. All token problems now answer 401 in the API's error format.
- **A duplicate user answered 500** (`ValueError`). Admin user creation and signup now answer 409.
- **Students' timelines compared `milestone.ordre`**, a field the API does not send (it sends `order`), so past and future steps were not told apart.
- Stray `print(data)` in `POST /api/students`, and the `Query.get()` deprecation warning in `init_db.py`.

Covered by `tests/test_api_contract.py`, `tests/test_admin_users.py`, `tests/test_auth_routes.py`, `src/test/integration/lists.integration.test.tsx` and the Robot test *Agent Sees Records Created Through The API*.

### 12. ✅ Fixed: problems found while extending the test suites
Fixed in branch `fix/open-issues`. Each has a test that failed first.
- **Security: any account could edit any profile.** `PUT /api/profiles/<id>` had no ownership check, so a student could change an admin's email. It is now owner-or-admin, and it finally saves `phone_number` (it looked for a `phone` attribute that does not exist).
- **Security: a student's own-record check used the wrong id.** `GET /api/students/<id>` compared against the student whose *id* equals the user id, so students were refused their own record and could read another one.
- **Students were never notified.** The workflow's student-facing messages ("Votre dossier est complet"…) went to `ticket.user_id`, the agent who created the ticket. They now go to the student's account.
- **Ticket statuses were read from the wrong field.** The dossier list, the student's page and the admin dashboard used `ticket.status` (OPEN/PENDING/COMPLETED) as a milestone code, so status badges were blank, the student's timeline was wrong and "closed"/"blocked" counts were 0. They now use `current_milestone.code`. The student page also never found its own record (it read the old `{students: […]}` shape).
- **Lists stopped at 10 items.** Tickets and students are paged by the API; the hooks now fetch every page.
- **Errors reported as 500:** refused workflow transitions, Marshmallow schema errors, signup without a student record, unknown documents (a broad `except Exception` swallowed the 404). They now answer 400/404.
- **Rejecting a document dropped the reason** (the hook passed `reason`, the mutation read `comment`), and the API accepted an empty one. The reason is sent and required.
- **Deleting a profile picture always failed** (`delete_profile_image` was a copy of the upload and used an undefined `file`).
- **Students could not update their contact details** (`useUpdateProfile` sent PATCH; the route only accepts PUT).
- **The admin role dialog had no button**, and `ProtectedRoute` read `window.location` instead of the router's location.
- **Optional JSON bodies** (validate, transition…) answered 415 when absent.
- Dead code removed: hook mutations aimed at routes that do not exist (`PATCH /tickets/<id>`, writes to `/user_roles`), unused `DocumentList`/`WorkflowTimeline`, debug `print()`s in the workflow.

## Incomplete features

- ✅ **Fixed: emails were never triggered.** Fixed in branch `fix/email-notifications`. All three emails are now sent (see [architecture.md](architecture.md#cross-cutting-concerns)), and the template links point to real SPA routes (`/dossier/<id>`, `/dossiers`, `/admin`). Existing databases keep their old template copies in `app_config`, so re-save the templates in **Admin → Settings** to pick up the corrected links. Still open: `email_check_interval_hours` is not used, and the delay check stays hourly.
- **Documents carry no file content.** `POST /api/documents/` accepts a `file_path` string only. There is no binary upload for dossier documents, only for profile images, and the dossier page's upload dialog is never opened, so agents cannot attach files from the UI at all. The QA lifecycle test attaches them through the API for that reason.
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
- ✅ **Fixed: Lovable and Supabase leftovers.** Removed in branch `refactor/frontend-python-backend`, together with `lovable-tagger`, `@supabase/supabase-js`, the Bun lockfile and the unused mock pages. See [architecture.md](architecture.md#api-layer) for the resulting API layer.
- **The frontend does not pass a full typecheck.** `npm run typecheck` reports about 155 errors, all older than the refactor: they were hidden because `src/types/database.ts` had syntax errors that stopped `tsc` early, and Vite builds without type-checking. Most come from the pages using fields the types don't declare (for example `student.formation`, `milestone.order`, the `{tickets, total}` shape of the paginated ticket list) and from status-label maps that miss some milestone codes. Fix them page by page, starting with `TicketDetail.tsx` (65 errors). `npm run lint` reports 51 older problems.
- **`init_db.py` crashes on Windows when its output is piped** (emoji in `print` under the cp1252 console encoding). Set `PYTHONUTF8=1`; `run_qa.py` does.
- **Test coverage gaps.** The backend suite covers auth, notifications, scheduling, emails and admin user creation; the frontend suites cover the API layer, routing, login and notifications (see [testing.md](testing.md)). The workflow engine (`update_status` and its validators) and the ticket pages are the most valuable things to test next.
