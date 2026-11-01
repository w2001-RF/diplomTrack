import pytest
from flask import Flask
from flask_jwt_extended import JWTManager, create_access_token

from extensions import db
from models import AuditLog, User
from routes.admin_routes import admin_bp


@pytest.fixture()
def admin_client():
    app = Flask(__name__)
    app.config.update(TESTING=True, JWT_SECRET_KEY="test-secret", SQLALCHEMY_DATABASE_URI="sqlite:///:memory:")
    db.init_app(app)
    JWTManager(app)
    app.register_blueprint(admin_bp)

    with app.app_context():
        db.create_all()
        admin = User(username="admin", email="admin@test.ma", password_hash="x", role="ADMIN")
        db.session.add(admin)
        db.session.commit()
        token = create_access_token(identity="admin", additional_claims={"user_id": admin.id, "role": "ADMIN"})
        yield app.test_client(), {"Authorization": f"Bearer {token}"}, admin.id
        db.session.remove()
        db.drop_all()


def test_create_user_returns_201_and_audits_the_admin(admin_client):
    # Used to answer 500 after committing the user: the audit call passed user_id=
    client, headers, admin_id = admin_client

    response = client.post("/api/admin/users", headers=headers, json={
        "username": "agent1", "email": "agent1@test.ma", "password": "Secret-123", "role": "AGENT",
    })

    assert response.status_code == 201
    assert User.query.filter_by(email="agent1@test.ma").one().must_reset_password is True
    audit = AuditLog.query.filter_by(action="CREATE_USER_AGENT").one()
    assert audit.performed_by == admin_id
