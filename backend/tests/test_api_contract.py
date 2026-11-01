"""HTTP behaviour the SPA relies on (found by the Robot Framework QA run)."""

from datetime import timedelta

import pytest
from flask import Flask
from flask_jwt_extended import create_access_token

from error_handlers import register_error_handlers, register_jwt_handlers
from extensions import db, jwt
from models import User
from routes import register_routes


@pytest.fixture()
def api():
    app = Flask(__name__)
    app.config.update(TESTING=True, JWT_SECRET_KEY="test-secret", SQLALCHEMY_DATABASE_URI="sqlite:///:memory:")
    db.init_app(app)
    jwt.init_app(app)
    register_jwt_handlers(jwt)
    register_error_handlers(app)
    register_routes(app)

    with app.app_context():
        db.create_all()
        admin = User(username="admin", email="admin@test.ma", password_hash="x", role="ADMIN")
        db.session.add(admin)
        db.session.commit()
        claims = {"user_id": admin.id, "role": "ADMIN"}
        token = create_access_token(identity="admin", additional_claims=claims)
        expired = create_access_token(identity="admin", additional_claims=claims, expires_delta=timedelta(seconds=-1))
        yield app.test_client(), token, expired
        db.session.remove()
        db.drop_all()


@pytest.mark.parametrize("path", ["/api/tickets", "/api/students", "/api/documents"])
def test_collections_answer_without_a_trailing_slash(api, path):
    # A 308 to ".../" made the browser re-send the request to the API's own
    # origin without the Authorization header (cross-origin redirect)
    client, token, _ = api

    response = client.get(path, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200, response.get_data(as_text=True)


def test_trailing_slash_still_works(api):
    client, token, _ = api
    assert client.get("/api/tickets/", headers={"Authorization": f"Bearer {token}"}).status_code == 200


@pytest.mark.parametrize("header", ["Bearer tampered", "Bearer a.b.c", "Basic abc"])
def test_malformed_token_is_401_not_422(api, header):
    # The SPA treats 401 as "session over" and logs the user out
    client, _, _ = api

    response = client.get("/api/auth/session", headers={"Authorization": header})

    assert response.status_code == 401
    assert response.get_json()["error"]


def test_expired_token_is_401_with_an_error_message(api):
    client, _, expired = api

    response = client.get("/api/tickets", headers={"Authorization": f"Bearer {expired}"})

    assert response.status_code == 401
    assert response.get_json()["error"] == "Session expirée, veuillez vous reconnecter"


def test_missing_token_is_401(api):
    client, _, _ = api

    response = client.get("/api/tickets")

    assert response.status_code == 401
    assert response.get_json()["error"]
