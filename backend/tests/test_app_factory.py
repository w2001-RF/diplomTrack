"""create_app(): the real wiring (config, CORS, blueprints, error handlers)."""

import pytest

from config import Config


@pytest.fixture()
def app(monkeypatch, tmp_path):
    monkeypatch.setenv("ENABLE_SCHEDULER", "false")
    monkeypatch.setattr(Config, "SQLALCHEMY_DATABASE_URI", f"sqlite:///{(tmp_path / 'app.db').as_posix()}")
    from app import create_app

    app = create_app()
    yield app
    from extensions import db
    with app.app_context():
        db.session.remove()
        db.engine.dispose()


def test_every_blueprint_is_registered(app):
    prefixes = {rule.rule.split("/")[2] for rule in app.url_map.iter_rules() if rule.rule.startswith("/api/")}

    assert prefixes >= {"auth", "admin", "tickets", "students", "documents", "notifications", "emails", "milestones"}


def test_unknown_route_answers_json_404(app):
    response = app.test_client().get("/api/does-not-exist")

    assert response.status_code == 404
    assert response.get_json()["status"] == 404


def test_cors_preflight_is_answered_without_a_token(app):
    response = app.test_client().options(
        "/api/tickets",
        headers={"Origin": "http://localhost:8080", "Access-Control-Request-Method": "GET"},
    )

    assert response.status_code in (200, 204)
    assert response.headers.get("Access-Control-Allow-Origin") == "http://localhost:8080"


def test_protected_route_needs_a_token(app):
    response = app.test_client().get("/api/tickets")

    assert response.status_code == 401
    assert response.get_json()["error"]
