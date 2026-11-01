"""A fully wired test app (all blueprints, error handlers, seed data) and request helpers.

Use the `seeded` fixture from conftest.py rather than building it directly.
"""

from flask import Flask
from flask_jwt_extended import create_access_token

import init_db
from error_handlers import register_error_handlers, register_jwt_handlers
from extensions import db, jwt, mail
from models import User
from routes import register_routes
from utils.security import hash_password

PASSWORD = "Secret-123"
_password_hash = None


def password_hash():
    """scrypt is slow on purpose (~0.1 s); hash the shared test password once"""
    global _password_hash
    if _password_hash is None:
        _password_hash = hash_password(PASSWORD)
    return _password_hash


def build_app(upload_folder=None, database_uri="sqlite:///:memory:", document_folder=None):
    app = Flask(__name__)
    app.config.update(
        TESTING=True,  # Flask-Mail does not send
        JWT_SECRET_KEY="test-secret",
        SQLALCHEMY_DATABASE_URI=database_uri,
        MAIL_DEFAULT_SENDER="noreply@test.ma",
        FRONTEND_URL="http://localhost",
        USE_MINIO=False,
        UPLOAD_FOLDER=upload_folder or "uploads/profiles",
        DOCUMENT_UPLOAD_FOLDER=document_folder or "uploads/documents",
    )
    db.init_app(app)
    jwt.init_app(app)
    mail.init_app(app)
    register_jwt_handlers(jwt)
    register_error_handlers(app)
    register_routes(app)
    return app


def seed_reference_data():
    """Same reference data as a fresh install (init_db.py), minus the admin."""
    init_db.seed_app_config()
    init_db.seed_milestones()
    init_db.seed_departements()
    init_db.seed_grades()
    init_db.seed_formation_types()
    init_db.seed_formations()


class Api:
    """Test client plus one account per role and shortcuts for common requests."""

    def __init__(self, client):
        self.client = client
        self.users = {}
        for role in ("ADMIN", "AGENT", "STUDENT"):
            name = role.lower()
            user = User(username=name, email=f"{name}@test.ma", password_hash=password_hash(), role=role)
            db.session.add(user)
            self.users[name] = user
        db.session.commit()

    def headers(self, role_or_user):
        user = self.users[role_or_user] if isinstance(role_or_user, str) else role_or_user
        claims = {"user_id": user.id, "role": user.role}
        token = create_access_token(identity=user.username, additional_claims=claims)
        return {"Authorization": f"Bearer {token}"}

    # Thin wrappers: api.get("/api/x", as_="agent")
    def _call(self, method, url, as_=None, **kwargs):
        headers = self.headers(as_) if as_ else {}
        return getattr(self.client, method)(url, headers=headers, **kwargs)

    def get(self, url, as_="agent", **kw):
        return self._call("get", url, as_, **kw)

    def post(self, url, as_="agent", **kw):
        return self._call("post", url, as_, **kw)

    def put(self, url, as_="agent", **kw):
        return self._call("put", url, as_, **kw)

    def patch(self, url, as_="agent", **kw):
        return self._call("patch", url, as_, **kw)

    def delete(self, url, as_="agent", **kw):
        return self._call("delete", url, as_, **kw)

    # Domain shortcuts
    def formation_id(self, index=0):
        return self.get("/api/formations").get_json()["data"][index]["id"]

    def create_student(self, last_name="Cycle", **fields):
        body = {"first_name": "Yasmine", "last_name": last_name, "formation_id": self.formation_id(),
                "academic_year": "2025-2026", **fields}
        response = self.post("/api/students", json=body)
        assert response.status_code == 201, response.get_json()
        return response.get_json()

    def create_ticket(self, student_id=None, milestone="CREATED", **student_fields):
        if student_id is None:
            student_id = self.create_student(**student_fields)["id"]
        response = self.post("/api/tickets", json={"student_id": student_id, "initial_milestone_code": milestone})
        assert response.status_code == 201, response.get_json()
        return response.get_json()

    def transition(self, ticket_id, next_state, as_="agent", **extra):
        return self.patch(f"/api/tickets/{ticket_id}/transition", as_=as_, json={"next_state": next_state, **extra})

    def documents(self, ticket_id):
        return self.get(f"/api/documents?filter[ticket_id][eq]={ticket_id}").get_json()["documents"]

    def attach_all_documents(self, ticket_id):
        """Give every required document a file and validate it, as an agent does."""
        missing = self.get(f"/api/documents/ticket/{ticket_id}/missing").get_json()["missing_documents"]
        for doc_type in missing:
            response = self.post("/api/documents", json={
                "ticket_id": ticket_id, "document_type": doc_type, "file_path": f"/uploads/{doc_type}.pdf"})
            assert response.status_code == 201, response.get_json()
        for document in self.documents(ticket_id):
            if not document["is_validated"]:
                response = self.patch(f"/api/documents/{document['id']}/validate")
                assert response.status_code == 200, response.get_json()
