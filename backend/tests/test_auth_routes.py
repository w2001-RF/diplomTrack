import pytest
from flask_jwt_extended import create_access_token


# -------------------------
# Helpers
# -------------------------
class DummyUser:
    def __init__(self, id=1, username="u", email="u@test.com", role="STUDENT", is_active=True):
        self.id = id
        self.username = username
        self.email = email
        self.role = role
        self.is_active = is_active


def auth_header(app, username="u"):
    with app.app_context():
        token = create_access_token(identity=username, additional_claims={"role": "STUDENT", "user_id": 1})
    return {"Authorization": f"Bearer {token}"}


# =========================================================
# SIGNUP
# =========================================================

def test_signup_success(client, monkeypatch):
    from routes import auth_routes

    def mock_signup(username, email, password):
        return DummyUser(id=99, username=username, email=email)

    monkeypatch.setattr(auth_routes.AuthService, "signup", mock_signup)

    res = client.post("/api/auth/signup", json={
        "username": "wassim",
        "email": "wassim@uit.ac.ma",
        "password": "123456"
    })

    assert res.status_code == 201
    data = res.get_json()
    assert data["message"] == "Account created successfully"
    assert data["user_id"] == 99


def test_signup_missing_fields_returns_400(client, monkeypatch):
    # Marshmallow load likely fails before your manual check in many cases,
    # but we simulate a payload missing password and assume schema allows it
    res = client.post("/api/auth/signup", json={
        "username": "wassim",
        "email": "wassim@uit.ac.ma"
    })

    # Depending on your SignupSchema, could be 400 with marshmallow errors
    assert res.status_code == 400
    data = res.get_json()
    assert data["status"] == 400
    assert data["code"] == 4001
    assert data["error"] == "Missing required fields"


# =========================================================
# LOGIN
# =========================================================

# def test_login_success_returns_token(client, monkeypatch):
#     from routes import auth_routes

#     def mock_authenticate(username, password):
#         return DummyUser(id=1, username=username, email="u@test.com", role="STUDENT", is_active=True)

#     def mock_generate_token(user):
#         return "FAKE_TOKEN"

#     monkeypatch.setattr(auth_routes.AuthService, "authenticate", mock_authenticate)
#     monkeypatch.setattr(auth_routes.AuthService, "generate_token", mock_generate_token)

#     res = client.post("/api/auth/login", json={
#         "username": "wassim",
#         "password": "123456"
#     })

#     assert res.status_code == 200
#     data = res.get_json()
#     assert "access_token" in data
#     assert data["access_token"] == "FAKE_TOKEN"
#     assert data["token_type"] == "Bearer"
#     assert data["expires_in"] == 8 * 3600


# def test_login_invalid_credentials_returns_401(client, monkeypatch):
#     from routes import auth_routes

#     def mock_authenticate(username, password):
#         raise ValueError("Invalid credentials")

#     monkeypatch.setattr(auth_routes.AuthService, "authenticate", mock_authenticate)

#     res = client.post("/api/auth/login", json={
#         "username": "wassim",
#         "password": "wrong"
#     })

#     assert res.status_code == 401
#     data = res.get_json()
#     assert data["message"] == "Invalid credentials"


# def test_login_disabled_account_returns_403(client, monkeypatch):
#     from routes import auth_routes

#     def mock_authenticate(username, password):
#         raise PermissionError("Account disabled")

#     monkeypatch.setattr(auth_routes.AuthService, "authenticate", mock_authenticate)

#     res = client.post("/api/auth/login", json={
#         "username": "wassim",
#         "password": "123456"
#     })

#     assert res.status_code == 403
#     data = res.get_json()
#     assert data["message"] == "Account disabled"


# def test_login_missing_fields_returns_400(client):
#     res = client.post("/api/auth/login", json={"username": "wassim"})
#     # could be marshmallow validation error too
#     assert res.status_code == 400


# # =========================================================
# # ME
# # =========================================================

# def test_me_requires_jwt(client):
#     res = client.get("/api/auth/me")
#     assert res.status_code in (401, 422)  # depending on JWT config


# def test_me_success(client, app, monkeypatch):
#     from routes import auth_routes

#     def mock_get_current_user():
#         return DummyUser(id=5, username="wassim", email="wassim@uit.ac.ma", role="STUDENT", is_active=True)

#     monkeypatch.setattr(auth_routes.AuthService, "get_current_user", mock_get_current_user)

#     res = client.get("/api/auth/me", headers=auth_header(app))

#     assert res.status_code == 200
#     data = res.get_json()
#     assert data["id"] == 5
#     assert data["username"] == "wassim"
#     assert data["email"] == "wassim@uit.ac.ma"
#     assert data["role"] == "STUDENT"
#     assert data["is_active"] is True


# # =========================================================
# # RESET PASSWORD
# # =========================================================

# def test_reset_password_requires_jwt(client):
#     res = client.put("/api/auth/reset-password", json={"password": "newpass"})
#     assert res.status_code in (401, 422)


# def test_reset_password_missing_password_returns_400(client, app):
#     res = client.put("/api/auth/reset-password", json={}, headers=auth_header(app))
#     assert res.status_code == 400
#     data = res.get_json()
#     assert data["message"] == "Password required"


# def test_reset_password_success(client, app, monkeypatch):
#     from routes import auth_routes

#     called = {"ok": False, "password": None}

#     def mock_reset_password(new_password):
#         called["ok"] = True
#         called["password"] = new_password

#     monkeypatch.setattr(auth_routes.AuthService, "reset_password", mock_reset_password)

#     res = client.put(
#         "/api/auth/reset-password",
#         json={"password": "newpass123"},
#         headers=auth_header(app)
#     )

#     assert res.status_code == 200
#     data = res.get_json()
#     assert data["message"] == "Password updated"
#     assert called["ok"] is True
#     assert called["password"] == "newpass123"


def test_signup_existing_account_returns_409(client, monkeypatch):
    # Uses the real AuthService against a database that already has the user
    from extensions import db
    from models import User

    app = client.application
    db.init_app(app)
    with app.app_context():
        db.create_all()
        db.session.add(User(username="wassim", email="wassim@uit.ac.ma", password_hash="x", role="STUDENT"))
        db.session.commit()

        res = client.post("/api/auth/signup", json={
            "username": "wassim", "email": "wassim@uit.ac.ma", "password": "Secret-123",
        })

        assert res.status_code == 409
        assert res.get_json()["error"] == "User already exists"
        db.drop_all()
