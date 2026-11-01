import pytest
from flask import Flask
from flask_jwt_extended import JWTManager, create_access_token

from extensions import db
from models import Notification, User
from routes.notification_routes import notification_bp


@pytest.fixture()
def api():
    app = Flask(__name__)
    app.config.update(
        TESTING=True,
        JWT_SECRET_KEY="test-secret",
        SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
    )
    db.init_app(app)
    JWTManager(app)
    app.register_blueprint(notification_bp)

    with app.app_context():
        db.create_all()
        user = User(username="agent", email="agent@test.ma", password_hash="x", role="AGENT")
        db.session.add(user)
        db.session.flush()
        db.session.add(Notification(
            user_id=user.id, ticket_id=7, type="warning",
            title="Délai dépassé", message="Dossier en retard",
        ))
        db.session.commit()
        token = create_access_token(identity="agent", additional_claims={"user_id": user.id, "role": "AGENT"})
        yield app.test_client(), {"Authorization": f"Bearer {token}"}, user.id
        db.session.remove()
        db.drop_all()


def test_list_returns_fields_the_spa_renders(api):
    # The SPA picks the icon from `type`, links to /dossier/<ticket_id>, and bolds unread items
    client, headers, user_id = api

    response = client.get("/api/notifications", headers=headers)

    assert response.status_code == 200
    [item] = response.get_json()
    assert item["user_id"] == user_id
    assert item["ticket_id"] == 7
    assert item["type"] == "warning"
    assert item["is_read"] is False


def test_mark_read_and_read_all_routes(api):
    client, headers, _ = api
    [item] = client.get("/api/notifications", headers=headers).get_json()

    assert client.patch(f"/api/notifications/{item['id']}/read", headers=headers).status_code == 200
    assert client.patch("/api/notifications/read-all", headers=headers).status_code == 200
    assert client.get("/api/notifications", headers=headers).get_json()[0]["is_read"] is True
