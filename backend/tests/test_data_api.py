"""Reference data and settings: milestones, formations, profiles, user roles,
history, app settings and the email test endpoints."""

import pytest

from extensions import db
from models import AppConfig, User


def test_milestones_come_in_workflow_order(seeded):
    milestones = seeded.get("/api/milestones").get_json()["data"]

    assert [m["order"] for m in milestones] == sorted(m["order"] for m in milestones)
    assert milestones[0]["code"] == "CREATED"
    assert milestones[-1]["code"] == "DOSSIER_CLOTURE"


def test_formations_include_their_type(seeded):
    formations = seeded.get("/api/formations").get_json()

    assert formations["count"] == len(formations["data"]) > 0
    assert formations["data"][0]["formation_type"]["code"] in {"LUS", "MUS"}


def test_formations_paginate_with_limit(seeded):
    page = seeded.get("/api/formations?limit=5&page=1").get_json()

    assert len(page["data"]) == 5
    assert page["limit"] == 5


def test_profiles_and_roles_describe_every_account(seeded):
    profiles = seeded.get("/api/profiles", as_="admin").get_json()
    roles = seeded.get("/api/user_roles", as_="admin").get_json()

    assert profiles["count"] == 3
    assert {r["role"] for r in roles["data"]} == {"ADMIN", "AGENT", "STUDENT"}


def test_user_roles_for_one_user(seeded):
    uid = seeded.users["agent"].id

    roles = seeded.get(f"/api/user_roles?user_id={uid}", as_="admin").get_json()["data"]

    assert roles == [{"id": uid, "user_id": uid, "role": "AGENT"}]


def test_profiles_filter_by_user(seeded):
    uid = seeded.users["student"].id

    profiles = seeded.get(f"/api/profiles?filter[user_id][eq]={uid}", as_="admin").get_json()["data"]

    assert [p["email"] for p in profiles] == ["student@test.ma"]


def test_users_cannot_edit_someone_elses_profile(seeded):
    # Any account could change any other account's email, including an admin's
    admin_id = seeded.users["admin"].id

    response = seeded.put(f"/api/profiles/{admin_id}", as_="student", json={"email": "pirate@test.ma"})

    assert response.status_code == 403
    assert db.session.get(User, admin_id).email == "admin@test.ma"


def test_admin_can_edit_any_profile(seeded):
    uid = seeded.users["agent"].id

    assert seeded.put(f"/api/profiles/{uid}", as_="admin", json={"email": "agent.bfc@test.ma"}).status_code == 200
    assert db.session.get(User, uid).email == "agent.bfc@test.ma"


def test_user_updates_their_profile(seeded):
    uid = seeded.users["agent"].id

    response = seeded.put(f"/api/profiles/{uid}", as_="agent", json={"phone_number": "0600000000"})

    assert response.status_code == 200, response.get_json()
    assert db.session.get(User, uid).phone_number == "0600000000"


def test_milestone_history_lists_transitions(seeded):
    tid = seeded.create_ticket()["id"]
    seeded.transition(tid, "DOSSIER_EN_COURS")

    history = seeded.get(f"/api/ticket_milestone_history?filter[ticket_id][eq]={tid}").get_json()

    assert len(history) >= 1


def test_admin_reads_and_updates_app_settings(seeded):
    settings = seeded.get("/api/app_settings", as_="admin").get_json()["data"]
    setting_id = settings[0]["id"]

    response = seeded.patch(f"/api/app_settings/{setting_id}", as_="admin", json={"warning_delay_days": 21})

    assert response.status_code == 200, response.get_json()
    assert db.session.get(AppConfig, setting_id).warning_delay_days == 21


@pytest.mark.parametrize("role", ["agent", "student"])
def test_only_admins_see_app_settings(seeded, role):
    assert seeded.get("/api/app_settings", as_=role).status_code == 403


def test_email_test_send_composes_a_message(seeded):
    from extensions import mail

    with mail.record_messages() as outbox:
        response = seeded.post("/api/emails/test-send", as_="admin", json={})

    assert response.status_code == 200, response.get_json()
    assert len(outbox) == 1


def test_email_endpoints_are_admin_only(seeded):
    assert seeded.get("/api/emails/test-connection", as_="agent").status_code == 403
