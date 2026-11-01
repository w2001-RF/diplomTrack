"""Dossiers through the real routes, services and seed data: the main path, the
correction loop, the attestation path and the guard rules (docs/workflow.md)."""

import pytest

from extensions import db
from models import Chronologie, Milestone, Notification, Ticket

MAIN_PATH = ["DOSSIER_EN_COURS", "PIECES_COMPLETES", "EN_ATTENTE_REPONSE", "REPONSE_RECUE", "DOSSIER_CLOTURE"]


def milestone_of(ticket_id):
    return db.session.get(Milestone, db.session.get(Ticket, ticket_id).current_milestone_id).code


# ---------------------------------------------------------------------------
# Creation
# ---------------------------------------------------------------------------

def test_new_ticket_starts_at_created_with_its_required_documents(seeded):
    ticket = seeded.create_ticket()

    assert ticket["current_milestone"]["code"] == "CREATED"
    assert ticket["reference"]
    assert ticket["diploma_validation_type"] == "DIPLOMA"
    missing = seeded.get(f"/api/documents/ticket/{ticket['id']}/missing").get_json()
    assert missing["count"] == len(missing["missing_documents"]) > 0


def test_ticket_details_include_student_and_chronology(seeded):
    tid = seeded.create_ticket(last_name="Detail")["id"]

    ticket = seeded.get(f"/api/tickets/{tid}").get_json()

    assert ticket["student"]["last_name"] == "Detail"
    assert [c["milestone"]["code"] for c in ticket["chronologies"]] == ["CREATED"]


def test_unknown_ticket_is_404(seeded):
    assert seeded.get("/api/tickets/9999").status_code == 404


def test_agent_can_delete_a_ticket(seeded):
    tid = seeded.create_ticket()["id"]

    assert seeded.delete(f"/api/tickets/{tid}").status_code in (200, 204)
    assert db.session.get(Ticket, tid) is None


def test_advanced_creation_backfills_the_history(seeded):
    student_id = seeded.create_student(last_name="Historique")["id"]

    response = seeded.post("/api/tickets/create-advanced", json={
        "student_id": student_id,
        "target_milestone_code": "DOSSIER_EN_COURS",
        "chronologies": [
            {"milestone_code": "CREATED", "started_at": "2026-01-05T09:00:00", "completed_at": "2026-01-10T09:00:00"},
            {"milestone_code": "DOSSIER_EN_COURS", "started_at": "2026-01-10T09:00:00"},
        ],
    })

    assert response.status_code == 201, response.get_json()
    tid = response.get_json()["id"]
    assert milestone_of(tid) == "DOSSIER_EN_COURS"
    assert Chronologie.query.filter_by(ticket_id=tid).count() == 2


# ---------------------------------------------------------------------------
# Main path
# ---------------------------------------------------------------------------

def test_full_lifecycle_from_created_to_closed(seeded):
    tid = seeded.create_ticket()["id"]

    assert seeded.transition(tid, "DOSSIER_EN_COURS").status_code == 200
    seeded.attach_all_documents(tid)
    for state in MAIN_PATH[1:]:
        response = seeded.transition(tid, state, comment=f"vers {state}")
        assert response.status_code == 200, (state, response.get_json())
        assert response.get_json()["ticket"]["current_milestone"]["code"] == state

    assert db.session.get(Ticket, tid).status == "COMPLETED"
    visited = [c.milestone.code for c in Chronologie.query.filter_by(ticket_id=tid).order_by(Chronologie.id)]
    assert visited == ["CREATED", *MAIN_PATH]
    open_rows = Chronologie.query.filter_by(ticket_id=tid, ended_at=None).all()
    assert [c.milestone.code for c in open_rows] == ["DOSSIER_CLOTURE"]


def test_transition_accepts_a_backdated_change(seeded):
    tid = seeded.create_ticket()["id"]

    response = seeded.transition(tid, "DOSSIER_EN_COURS", changed_at="2026-02-01T10:00:00", comment="reçu")

    assert response.status_code == 200
    row = Chronologie.query.filter_by(ticket_id=tid).join(Milestone).filter(Milestone.code == "DOSSIER_EN_COURS").one()
    assert row.started_at.isoformat().startswith("2026-02-01")


def test_lifecycle_appears_in_the_ticket_list(seeded):
    ticket = seeded.create_ticket()

    listed = seeded.get("/api/tickets").get_json()

    assert listed["total"] == 1
    assert listed["tickets"][0]["reference"] == ticket["reference"]


def test_ticket_list_pages_with_length(seeded):
    student_id = seeded.create_student()["id"]
    for _ in range(3):
        seeded.create_ticket(student_id=student_id)

    first = seeded.get("/api/tickets?page=1&length=2").get_json()
    second = seeded.get("/api/tickets?page=2&length=2").get_json()

    assert (first["total"], first["pages"], len(first["tickets"]), len(second["tickets"])) == (3, 2, 2, 1)


# ---------------------------------------------------------------------------
# Who sees and moves what
# ---------------------------------------------------------------------------

def test_student_sees_only_their_own_ticket(seeded):
    seeded.create_ticket(user_id=seeded.users["student"].id)
    seeded.create_ticket(last_name="Autre")

    listed = seeded.get("/api/tickets", as_="student").get_json()

    assert listed["total"] == 1


def test_agent_sees_only_the_tickets_they_created(seeded):
    from models import User
    from utils.security import hash_password

    other = User(username="agent2", email="agent2@test.ma", password_hash=hash_password("x"), role="AGENT")
    db.session.add(other)
    db.session.commit()
    seeded.create_ticket()

    assert seeded.get("/api/tickets", as_=other).get_json()["total"] == 0
    assert seeded.get("/api/tickets", as_="admin").get_json()["total"] == 1


def test_students_cannot_move_tickets(seeded):
    tid = seeded.create_ticket(user_id=seeded.users["student"].id)["id"]

    assert seeded.transition(tid, "DOSSIER_EN_COURS", as_="student").status_code == 403


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

def test_student_is_notified_as_the_dossier_moves(seeded):
    # The student-facing messages used to go to ticket.user_id, which is the
    # agent who created the ticket, so students were never notified
    student_id = seeded.users["student"].id
    tid = seeded.create_ticket(user_id=student_id)["id"]

    seeded.transition(tid, "DOSSIER_EN_COURS")
    seeded.attach_all_documents(tid)
    assert seeded.transition(tid, "PIECES_COMPLETES").status_code == 200

    to_student = Notification.query.filter_by(user_id=student_id, ticket_id=tid).all()
    assert [n.title for n in to_student] == ["Dossier complet"]
    assert Notification.query.filter_by(user_id=seeded.users["agent"].id, title="Dossier complet").count() == 0


def test_no_notification_when_the_student_has_no_account(seeded):
    tid = seeded.create_ticket()["id"]  # student record not linked to a user

    seeded.transition(tid, "DOSSIER_EN_COURS")
    seeded.attach_all_documents(tid)

    assert seeded.transition(tid, "PIECES_COMPLETES").status_code == 200
    assert Notification.query.filter_by(ticket_id=tid, title="Dossier complet").count() == 0


# ---------------------------------------------------------------------------
# Guard rules
# ---------------------------------------------------------------------------

def test_incomplete_documents_block_pieces_completes_with_400(seeded):
    # Used to answer 500: the workflow's ValueError was not turned into a client error
    tid = seeded.create_ticket()["id"]
    seeded.transition(tid, "DOSSIER_EN_COURS")

    response = seeded.transition(tid, "PIECES_COMPLETES")

    assert response.status_code == 400
    assert "Missing or unvalidated documents" in response.get_json()["error"]


@pytest.mark.parametrize("path, target", [
    ([], "DOSSIER_CLOTURE"),                     # cannot skip to the end
    ([], "PIECES_COMPLETES"),                    # not reachable from CREATED
    (["DOSSIER_EN_COURS"], "REPONSE_RECUE"),    # not reachable from DOSSIER_EN_COURS
    (["DOSSIER_EN_COURS"], "NOT_A_MILESTONE"),
])
def test_transitions_outside_the_graph_are_rejected_with_400(seeded, path, target):
    tid = seeded.create_ticket()["id"]
    for state in path:
        assert seeded.transition(tid, state).status_code == 200

    response = seeded.transition(tid, target)

    assert response.status_code == 400, response.get_json()
    assert milestone_of(tid) == (path[-1] if path else "CREATED")


def test_transition_requires_next_state(seeded):
    tid = seeded.create_ticket()["id"]

    assert seeded.patch(f"/api/tickets/{tid}/transition", json={}).status_code == 400


def test_transition_rejects_a_malformed_date(seeded):
    tid = seeded.create_ticket()["id"]

    assert seeded.transition(tid, "DOSSIER_EN_COURS", changed_at="hier").status_code == 400


# ---------------------------------------------------------------------------
# Correction loop
# ---------------------------------------------------------------------------

def invalidate(seeded, document_id, reason="Illisible"):
    return seeded.patch(f"/api/documents/{document_id}/invalidate", json={"comment": reason})


def test_invalidating_an_auto_validated_document_starts_the_correction_loop(seeded):
    student_id = seeded.users["student"].id
    tid = seeded.create_ticket(user_id=student_id, email="student@test.ma")["id"]
    cin = next(d for d in seeded.documents(tid) if d["document_type"] == "CIN")

    response = invalidate(seeded, cin["id"])

    assert response.status_code == 200, response.get_json()
    assert milestone_of(tid) == "ATTENTE_CORRECTION_DOCS"
    titles = [n.title for n in Notification.query.filter_by(user_id=student_id)]
    assert "Correction de documents requise" in titles


def test_only_the_correction_milestone_is_allowed_while_a_document_is_invalid(seeded):
    tid = seeded.create_ticket()["id"]
    seeded.transition(tid, "DOSSIER_EN_COURS")
    cin = next(d for d in seeded.documents(tid) if d["document_type"] == "CIN")
    invalidate(seeded, cin["id"])

    assert milestone_of(tid) == "ATTENTE_CORRECTION_DOCS"
    assert seeded.transition(tid, "DOSSIER_EN_COURS").status_code == 400


def test_corrected_documents_go_back_to_processing(seeded):
    tid = seeded.create_ticket()["id"]
    cin = next(d for d in seeded.documents(tid) if d["document_type"] == "CIN")
    invalidate(seeded, cin["id"])

    seeded.post("/api/documents", json={"ticket_id": tid, "document_type": "CIN", "file_path": "/uploads/cin-v2.pdf"})
    assert seeded.transition(tid, "DOCS_CORRIGES_SOUMIS").status_code == 200
    cin = next(d for d in seeded.documents(tid) if d["document_type"] == "CIN")
    assert seeded.patch(f"/api/documents/{cin['id']}/validate").status_code == 200

    # Validating the corrected document moves the dossier back on its own
    assert milestone_of(tid) == "DOSSIER_EN_COURS"


# ---------------------------------------------------------------------------
# Attestation path
# ---------------------------------------------------------------------------

def test_diploma_ticket_cannot_enter_the_attestation_path(seeded):
    ticket = seeded.create_ticket()

    assert seeded.transition(ticket["id"], "ATTENTE_DIPLOME").status_code == 400


def test_attestation_ticket_detours_and_comes_back_as_diploma(seeded):
    tid = seeded.create_ticket()["id"]
    response = seeded.patch(f"/api/tickets/{tid}/diploma-validation-type", json={"validation_type": "ATTESTATION"})
    assert response.status_code == 200, response.get_json()

    # Switching to ATTESTATION sends the dossier on the detour right away
    assert milestone_of(tid) == "ATTENTE_DIPLOME"
    assert seeded.transition(tid, "DOSSIER_EN_COURS").status_code == 400

    for state in ["DIPLOME_DEPOSE", "DIPLOME_ENVOYE_CENTRE", "VALIDATION_CENTRE_RECUE"]:
        response = seeded.transition(tid, state)
        assert response.status_code == 200, (state, response.get_json())

    assert db.session.get(Ticket, tid).diploma_validation_type == "DIPLOMA"
    assert seeded.transition(tid, "DOSSIER_EN_COURS").status_code == 200


def test_unknown_diploma_validation_type_is_rejected(seeded):
    tid = seeded.create_ticket()["id"]

    response = seeded.patch(f"/api/tickets/{tid}/diploma-validation-type", json={"validation_type": "PARCHEMIN"})

    assert response.status_code == 400
