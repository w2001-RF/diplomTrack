"""/api/documents: listing, upload, validation, status and permissions."""

import pytest

from extensions import db
from models import Document


def test_document_types_are_listed(seeded):
    types = seeded.get("/api/documents/types").get_json()["document_types"]

    codes = {t["code"] for t in types}
    assert {"BAC", "CIN", "CONTRAT"} <= codes
    assert all(t["label"] for t in types)


def test_upload_creates_or_replaces_a_document(seeded):
    tid = seeded.create_ticket()["id"]

    first = seeded.post("/api/documents", json={"ticket_id": tid, "document_type": "CIN", "file_path": "/u/cin.pdf"})
    second = seeded.post("/api/documents", json={"ticket_id": tid, "document_type": "CIN", "file_path": "/u/cin-v2.pdf"})

    assert first.status_code == second.status_code == 201
    cin = Document.query.filter_by(ticket_id=tid, document_type="CIN").all()
    assert len(cin) == 1
    assert (cin[0].file_path, cin[0].is_validated) == ("/u/cin-v2.pdf", False)


@pytest.mark.parametrize("missing", ["ticket_id", "document_type", "file_path"])
def test_upload_requires_every_field(seeded, missing):
    tid = seeded.create_ticket()["id"]
    body = {"ticket_id": tid, "document_type": "CIN", "file_path": "/u/cin.pdf"}
    del body[missing]

    assert seeded.post("/api/documents", json=body).status_code == 400


def test_validate_and_invalidate_a_document(seeded):
    tid = seeded.create_ticket()["id"]
    seeded.post("/api/documents", json={"ticket_id": tid, "document_type": "CONTRAT", "file_path": "/u/c.pdf"})
    doc = Document.query.filter_by(ticket_id=tid, document_type="CONTRAT").one()

    validated = seeded.patch(f"/api/documents/{doc.id}/validate", json={"comment": "Conforme"})
    assert validated.status_code == 200
    assert validated.get_json()["document"]["is_validated"] is True

    invalidated = seeded.patch(f"/api/documents/{doc.id}/invalidate", json={"comment": "Signature manquante"})
    assert invalidated.status_code == 200
    db.session.refresh(doc)
    assert (doc.is_validated, doc.validation_comment) == (False, "Signature manquante")


def test_validate_works_without_a_body(seeded):
    # The body is optional; request.json used to answer 415/500 without one
    tid = seeded.create_ticket()["id"]
    seeded.post("/api/documents", json={"ticket_id": tid, "document_type": "CONTRAT", "file_path": "/u/c.pdf"})
    doc = Document.query.filter_by(ticket_id=tid, document_type="CONTRAT").one()

    assert seeded.patch(f"/api/documents/{doc.id}/validate").status_code == 200


def test_invalidation_needs_a_reason(seeded):
    tid = seeded.create_ticket()["id"]
    doc = seeded.documents(tid)[0]

    assert seeded.patch(f"/api/documents/{doc['id']}/invalidate", json={}).status_code == 400


def test_get_and_delete_a_document(seeded):
    tid = seeded.create_ticket()["id"]
    doc = seeded.documents(tid)[0]

    assert seeded.get(f"/api/documents/{doc['id']}").get_json()["id"] == doc["id"]
    assert seeded.delete(f"/api/documents/{doc['id']}").status_code in (200, 204)
    assert db.session.get(Document, doc["id"]) is None


def test_ticket_document_status_counts_validated_documents(seeded):
    tid = seeded.create_ticket()["id"]

    status = seeded.get(f"/api/documents/ticket/{tid}/status").get_json()
    via_ticket = seeded.get(f"/api/tickets/{tid}/documents/status")

    assert status["documents"]
    assert via_ticket.status_code == 200


def test_missing_documents_shrink_as_files_arrive(seeded):
    tid = seeded.create_ticket()["id"]
    before = seeded.get(f"/api/documents/ticket/{tid}/missing").get_json()["count"]

    seeded.post("/api/documents", json={"ticket_id": tid, "document_type": "CIN", "file_path": "/u/cin.pdf"})
    seeded.patch(f"/api/documents/{Document.query.filter_by(ticket_id=tid, document_type='CIN').one().id}/validate")

    assert seeded.get(f"/api/documents/ticket/{tid}/missing").get_json()["count"] == before - 1


def test_students_cannot_validate_documents(seeded):
    tid = seeded.create_ticket(user_id=seeded.users["student"].id)["id"]
    doc = seeded.documents(tid)[0]

    assert seeded.patch(f"/api/documents/{doc['id']}/validate", as_="student").status_code == 403


@pytest.mark.parametrize("method, url", [
    ("get", "/api/documents/9999"),
    ("patch", "/api/documents/9999/validate"),
    ("delete", "/api/documents/9999"),
])
def test_unknown_document_is_404_not_500(seeded, method, url):
    # A broad `except Exception` used to turn get_or_404's 404 into a 500
    assert getattr(seeded, method)(url).status_code == 404
