# REST API reference

Base URL: `/api` (in development: `http://localhost:5000/api`).

All endpoints except signup, login and profile image retrieval need the header `Authorization: Bearer <JWT>`. The **Roles** column lists the roles accepted by `@require_roles`. A dash (—) means any authenticated user. Students are further restricted to their own records inside the handlers.

Errors come back as `{"error": "...", "code": ..., "status": ...}` or `{"message": "..."}`.

## Auth: `/api/auth`

| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/signup` | public | Student self-signup. Needs an existing student profile with the same email |
| POST | `/login` | public | Returns a JWT with claims `role`, `user_id`, `must_reset_password` |
| GET | `/me` | — | Current user |
| GET | `/session` | — | Session information for the SPA |
| PUT | `/reset-password` | — | Change own password (clears `must_reset_password`) |
| POST | `/upload-profile-image/<user_id>` | — | Upload avatar (multipart) to MinIO or local disk |
| DELETE | `/delete-profile-image/<user_id>` | — | Remove avatar |
| GET | `/profile-image/<user_id>` | public | Serve avatar |

## Admin: `/api/admin`

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/users` | ADMIN | List users |
| POST | `/users` | ADMIN | Create a user |
| POST | `/users/agents/bulk` | ADMIN | Bulk-create agents with generated passwords |
| GET | `/users/<id>` | ADMIN | Get a user |
| PUT | `/users/<id>` | ADMIN | Update email, role or active flag |
| PUT | `/users/<id>/reset-password` | ADMIN | Set a user's password |
| PUT | `/users/<id>/disable` | ADMIN | Deactivate |
| PUT | `/users/<id>/enable` | ADMIN | Reactivate |
| DELETE | `/users/<id>` | ADMIN | Delete |

## Students: `/api/students`

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/` | ADMIN, AGENT, STUDENT | Paginated list (`page`, `limit`, sort, filters) |
| GET | `/<id>` | ADMIN, AGENT, STUDENT | Get one |
| POST | `/` | ADMIN, AGENT | Create |
| POST | `/bulk` | ADMIN, AGENT | Bulk create (Excel import) |
| PUT | `/<id>` | ADMIN, AGENT, STUDENT | Update |
| DELETE | `/<id>` | ADMIN, AGENT | Delete |

## Tickets: `/api/tickets`

| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/` | AGENT, ADMIN | Create a ticket for a student on an initial milestone |
| POST | `/create-advanced` | AGENT, ADMIN | Create with a target milestone and backdated chronology |
| POST | `/import` | ADMIN, AGENT | Bulk import tickets |
| GET | `/` | AGENT, ADMIN, STUDENT | List (a student only gets their own) |
| GET | `/<id>` | AGENT, ADMIN, STUDENT | Detail with student, formation, documents and chronology |
| PATCH | `/<id>/transition` | AGENT, ADMIN | Move to another milestone (see [workflow.md](workflow.md)) |
| GET | `/<id>/documents/status` | AGENT, ADMIN | Document completeness summary |
| PATCH | `/<id>/diploma-validation-type` | — | Switch between `DIPLOMA` and `ATTESTATION` |
| POST | `/<id>/submit-corrected-documents` | — | Report that corrections were submitted (→ `DOCS_CORRIGES_SOUMIS`) |
| DELETE | `/<id>` | AGENT, ADMIN | Delete |

Example transition:

```http
PATCH /api/tickets/12/transition
Content-Type: application/json
Authorization: Bearer <token>

{
  "next_state": "PIECES_COMPLETES",
  "changed_at": "2024-01-15T10:30:00",
  "comment": "Tout est complet"
}
```

`next_state` is required. `changed_at` (ISO datetime, for backdating) and `comment` are optional. A forbidden transition returns 400 with the reason.

## Documents: `/api/documents`

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/` | — | List with filters, sorting and pagination (`DocumentQueryBuilder`) |
| GET | `/<id>` | AGENT, ADMIN, STUDENT | Get one |
| POST | `/` | AGENT, ADMIN | Attach or replace a file reference: `{ticket_id, document_type, file_path}` |
| PATCH | `/<id>/validate` | AGENT, ADMIN | Validate (may advance the workflow) |
| PATCH | `/<id>/invalidate` | AGENT, ADMIN | Invalidate with a comment (may trigger the correction loop) |
| DELETE | `/<id>` | ADMIN, AGENT | Delete |
| GET | `/ticket/<ticket_id>/status` | AGENT, ADMIN, STUDENT | Per-document status for a ticket |
| GET | `/ticket/<ticket_id>/missing` | AGENT, ADMIN, STUDENT | Missing or unvalidated documents |
| GET | `/types` | — | Allowed document types and labels |

## Notifications: `/api/notifications`

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `` | — | Current user's notifications (`?unread=true` for unread only). Each item: `id, user_id, ticket_id, type, title, message, is_read, created_at` |
| PATCH | `/<id>/read` | — | Mark one as read |
| PATCH | `/read-all` | — | Mark all as read |
| DELETE | `/<id>` | — | Delete one |
| DELETE | `/delete-all` | — | Delete all |
| POST | `/check-delays` | ADMIN | Run the delay-warning job now |

## Emails: `/api/emails`

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/test-connection` | ADMIN | Test the SMTP connection |
| POST | `/test-send` | ADMIN | Send a test email |

## Reference data and settings: `/api`

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/milestones` | — | Ordered milestone list |
| GET | `/app_settings` | ADMIN | Read `app_config` with field metadata |
| PUT / PATCH | `/app_settings/<id>` | ADMIN | Update settings and email templates |
| GET | `/user_roles` | — | Roles (compatibility endpoint for the SPA) |
| GET | `/profiles` | — | User profiles |
| PUT | `/profiles/<id>` | — | Update a profile |
| GET | `/ticket_milestone_history` | — | Chronology rows (timeline data) |
| GET | `/formations` | — | Formations with type and professors |
