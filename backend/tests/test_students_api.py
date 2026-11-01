"""/api/students: CRUD, bulk creation, filters and per-role access."""

import pytest

from extensions import db
from models import Student


def test_agent_creates_and_reads_a_student(seeded):
    created = seeded.create_student(last_name="Alaoui", num_apogee=20261234, email="alaoui@test.ma")

    fetched = seeded.get(f"/api/students/{created['id']}").get_json()

    assert fetched["last_name"] == "Alaoui"
    assert fetched["num_apogee"] == 20261234
    assert fetched["formation"]["id"] == seeded.formation_id()


@pytest.mark.parametrize("missing", ["first_name", "last_name", "formation_id", "academic_year"])
def test_required_fields_are_validated(seeded, missing):
    body = {"first_name": "A", "last_name": "B", "formation_id": seeded.formation_id(), "academic_year": "2025-2026"}
    del body[missing]

    response = seeded.post("/api/students", json=body)

    assert response.status_code == 400


def test_list_is_paginated_with_limit(seeded):
    for i in range(3):
        seeded.create_student(last_name=f"Page{i}")

    page = seeded.get("/api/students?page=1&limit=2").get_json()

    assert page["total"] == 3
    assert len(page["students"]) == 2


def test_list_filters_by_field(seeded):
    seeded.create_student(last_name="Cible", email="cible@test.ma")
    seeded.create_student(last_name="Autre", email="autre@test.ma")

    found = seeded.get("/api/students?filter[last_name][eq]=Cible").get_json()

    assert [s["last_name"] for s in found["students"]] == ["Cible"]


def test_agent_updates_a_student(seeded):
    sid = seeded.create_student(last_name="Avant")["id"]

    response = seeded.put(f"/api/students/{sid}", json={"last_name": "Apres"})

    assert response.status_code == 200, response.get_json()
    assert db.session.get(Student, sid).last_name == "Apres"


def test_agent_deletes_a_student(seeded):
    sid = seeded.create_student()["id"]

    assert seeded.delete(f"/api/students/{sid}").status_code in (200, 204)
    assert db.session.get(Student, sid) is None


def test_bulk_creation_reports_each_row(seeded):
    formation = seeded.get("/api/formations").get_json()["data"][0]
    rows = [
        {"first_name": "Bulk", "last_name": f"Un{i}", "academic_year": "2025-2026",
         "formation_type": formation["formation_type"]["code"], "formation_name": formation["formation_name"]}
        for i in range(2)
    ]

    response = seeded.post("/api/students/bulk", json={"students": rows})

    assert response.status_code in (200, 201), response.get_json()
    assert Student.query.filter(Student.last_name.like("Un%")).count() == 2


def test_students_cannot_create_students(seeded):
    response = seeded.post("/api/students", as_="student", json={
        "first_name": "A", "last_name": "B", "formation_id": seeded.formation_id(), "academic_year": "2025-2026"})

    assert response.status_code == 403


def test_student_can_read_only_their_own_record(seeded):
    own = seeded.create_student(user_id=seeded.users["student"].id, email="student@test.ma")
    other = seeded.create_student(last_name="Autre")

    assert seeded.get(f"/api/students/{own['id']}", as_="student").status_code == 200
    assert seeded.get(f"/api/students/{other['id']}", as_="student").status_code == 403


def test_unknown_student_is_404(seeded):
    assert seeded.get("/api/students/9999").status_code == 404


def test_anonymous_requests_are_401(seeded):
    assert seeded.get("/api/students", as_=None).status_code == 401
