"""Accounts: /api/auth (login, session, signup, password, profile image) and
/api/admin/users (CRUD, activation, bulk agents)."""

import io

import pytest

from extensions import db
from models import Student, User
from tests.helpers import PASSWORD
from utils.security import verify_password


def login(seeded, email, password=PASSWORD):
    return seeded.post("/api/auth/login", as_=None, json={"email": email, "password": password})


# ---------------------------------------------------------------------------
# Login and session
# ---------------------------------------------------------------------------

def test_login_returns_a_token_that_opens_the_session(seeded):
    token = login(seeded, "agent@test.ma").get_json()["access_token"]

    session = seeded.client.get("/api/auth/session", headers={"Authorization": f"Bearer {token}"}).get_json()

    assert session["user"]["email"] == "agent@test.ma"
    assert session["user"]["role"] == "AGENT"


def test_me_returns_the_current_user(seeded):
    me = seeded.get("/api/auth/me", as_="admin")

    assert me.status_code == 200
    assert me.get_json()["email"] == "admin@test.ma"


@pytest.mark.parametrize("email, password", [("agent@test.ma", "wrong"), ("nobody@test.ma", PASSWORD)])
def test_bad_credentials_are_401(seeded, email, password):
    assert login(seeded, email, password).status_code == 401


def test_disabled_account_cannot_log_in(seeded):
    agent = seeded.users["agent"]
    assert seeded.put(f"/api/admin/users/{agent.id}/disable", as_="admin").status_code == 200

    assert login(seeded, "agent@test.ma").status_code == 403

    assert seeded.put(f"/api/admin/users/{agent.id}/enable", as_="admin").status_code == 200
    assert login(seeded, "agent@test.ma").status_code == 200


def test_user_changes_their_own_password(seeded):
    assert seeded.put("/api/auth/reset-password", as_="agent", json={"password": "Nouveau-456"}).status_code == 200

    assert login(seeded, "agent@test.ma", "Nouveau-456").status_code == 200
    assert seeded.users["agent"].must_reset_password is False


def test_password_change_requires_a_password(seeded):
    assert seeded.put("/api/auth/reset-password", as_="agent", json={}).status_code == 400


# ---------------------------------------------------------------------------
# Signup
# ---------------------------------------------------------------------------

def test_student_with_a_record_can_sign_up_and_is_linked(seeded):
    seeded.create_student(last_name="Inscrit", email="inscrit@test.ma")

    response = seeded.post("/api/auth/signup", as_=None, json={
        "username": "inscrit", "email": "inscrit@test.ma", "password": "Secret-789"})

    assert response.status_code == 201, response.get_json()
    user = User.query.filter_by(email="inscrit@test.ma").one()
    assert user.role == "STUDENT"
    assert Student.query.filter_by(email="inscrit@test.ma").one().user_id == user.id


def test_signup_without_a_student_record_is_refused(seeded):
    response = seeded.post("/api/auth/signup", as_=None, json={
        "username": "inconnu", "email": "inconnu@test.ma", "password": "Secret-789"})

    assert 400 <= response.status_code < 500
    assert User.query.filter_by(email="inconnu@test.ma").count() == 0


# ---------------------------------------------------------------------------
# Profile image (local storage, USE_MINIO=False)
# ---------------------------------------------------------------------------

def test_user_uploads_reads_and_deletes_their_profile_image(seeded):
    uid = seeded.users["agent"].id
    png = (io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"0" * 64), "me.png")

    uploaded = seeded.post(f"/api/auth/upload-profile-image/{uid}", data={"file": png},
                           content_type="multipart/form-data")
    assert uploaded.status_code == 200, uploaded.get_json()
    assert uploaded.get_json()["profile_image"]

    assert seeded.get(f"/api/auth/profile-image/{uid}", as_=None).status_code == 200
    assert seeded.delete(f"/api/auth/delete-profile-image/{uid}").status_code == 200
    assert db.session.get(User, uid).profile_image is None


def test_profile_image_upload_requires_a_file(seeded):
    uid = seeded.users["agent"].id

    response = seeded.post(f"/api/auth/upload-profile-image/{uid}", data={}, content_type="multipart/form-data")

    assert response.status_code == 400


# ---------------------------------------------------------------------------
# Admin user management
# ---------------------------------------------------------------------------

def test_admin_lists_and_reads_users(seeded):
    listed = seeded.get("/api/admin/users", as_="admin")
    one = seeded.get(f"/api/admin/users/{seeded.users['agent'].id}", as_="admin")

    assert listed.status_code == 200
    assert {u["email"] for u in listed.get_json()} >= {"admin@test.ma", "agent@test.ma", "student@test.ma"}
    assert one.get_json()["role"] == "AGENT"


def test_admin_changes_a_role_and_email(seeded):
    uid = seeded.users["student"].id

    response = seeded.put(f"/api/admin/users/{uid}", as_="admin", json={"role": "AGENT", "email": "promu@test.ma"})

    assert response.status_code == 200, response.get_json()
    user = db.session.get(User, uid)
    assert (user.role, user.email) == ("AGENT", "promu@test.ma")


def test_admin_rejects_an_unknown_role(seeded):
    uid = seeded.users["student"].id

    assert seeded.put(f"/api/admin/users/{uid}", as_="admin", json={"role": "SUPERUSER"}).status_code == 400


def test_admin_resets_a_password(seeded):
    uid = seeded.users["agent"].id

    response = seeded.put(f"/api/admin/users/{uid}/reset-password", as_="admin", json={"password": "Remis-123"})

    assert response.status_code == 200, response.get_json()
    assert verify_password("Remis-123", db.session.get(User, uid).password_hash)


def test_admin_deletes_a_user(seeded):
    uid = seeded.users["student"].id

    assert seeded.delete(f"/api/admin/users/{uid}", as_="admin").status_code in (200, 204)
    assert db.session.get(User, uid) is None


def test_admin_creates_agents_in_bulk_with_generated_passwords(seeded):
    response = seeded.post("/api/admin/users/agents/bulk", as_="admin",
                           json={"agents": [{"username": "bulk1", "email": "bulk1@test.ma"}, {"username": "bulk2", "email": "bulk2@test.ma"}]})

    assert response.status_code in (200, 201), response.get_json()
    agents = User.query.filter(User.email.like("bulk%")).all()
    assert {a.role for a in agents} == {"AGENT"}
    assert all(a.must_reset_password for a in agents)


@pytest.mark.parametrize("role", ["agent", "student"])
def test_only_admins_manage_users(seeded, role):
    assert seeded.get("/api/admin/users", as_=role).status_code == 403
