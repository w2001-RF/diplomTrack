"""Scanned files: multipart upload to /api/documents and download from /api/documents/<id>/file."""

import io
import os

from flask import current_app

from models import Document

PDF = b"%PDF-1.4 scanned CIN"


def upload(api, ticket_id, document_type="CIN", content=PDF, filename="cin.pdf", as_="agent"):
    return api.post("/api/documents", as_=as_, content_type="multipart/form-data", data={
        "ticket_id": str(ticket_id), "document_type": document_type,
        "file": (io.BytesIO(content), filename)})


def stored_files():
    folder = current_app.config["DOCUMENT_UPLOAD_FOLDER"]
    return sorted(os.listdir(folder)) if os.path.isdir(folder) else []


def test_upload_stores_the_file_and_serves_it_back(seeded):
    tid = seeded.create_ticket()["id"]

    response = upload(seeded, tid)

    assert response.status_code == 201, response.get_json()
    document = response.get_json()
    assert document["document_type"] == "CIN" and document["is_validated"] is False
    assert stored_files() == [document["file_path"]]

    download = seeded.get(f"/api/documents/{document['id']}/file")
    assert download.status_code == 200
    assert download.data == PDF
    assert download.mimetype == "application/pdf"


def test_replacing_a_file_removes_the_previous_one(seeded):
    tid = seeded.create_ticket()["id"]
    upload(seeded, tid, content=b"%PDF old")

    response = upload(seeded, tid, content=b"%PDF new", filename="cin-v2.pdf")

    assert response.status_code == 201
    assert stored_files() == [response.get_json()["file_path"]]
    assert seeded.get(f"/api/documents/{response.get_json()['id']}/file").data == b"%PDF new"


def test_deleting_a_document_removes_its_file(seeded):
    tid = seeded.create_ticket()["id"]
    doc_id = upload(seeded, tid).get_json()["id"]

    assert seeded.delete(f"/api/documents/{doc_id}").status_code == 200
    assert stored_files() == []


def test_only_pdf_and_images_are_accepted(seeded):
    tid = seeded.create_ticket()["id"]
    before = [(d.document_type, d.file_path) for d in Document.query.filter_by(ticket_id=tid)]

    response = upload(seeded, tid, content=b"MZ", filename="virus.exe")

    assert response.status_code == 400
    assert stored_files() == []
    assert [(d.document_type, d.file_path) for d in Document.query.filter_by(ticket_id=tid)] == before


def test_a_multipart_upload_needs_a_file(seeded):
    tid = seeded.create_ticket()["id"]

    response = seeded.post("/api/documents", content_type="multipart/form-data",
                           data={"ticket_id": str(tid), "document_type": "CIN"})

    assert response.status_code == 400


def test_an_unknown_document_type_is_refused(seeded):
    tid = seeded.create_ticket()["id"]

    assert upload(seeded, tid, document_type="PASSEPORT").status_code == 400
    assert stored_files() == []


def test_a_student_downloads_only_their_own_files(seeded):
    student_user = seeded.users["student"]
    own = seeded.create_ticket(last_name="Moi", email="moi@test.ma", user_id=student_user.id)["id"]
    other = seeded.create_ticket(last_name="Autre", email="autre@test.ma")["id"]
    own_doc = upload(seeded, own).get_json()["id"]
    other_doc = upload(seeded, other).get_json()["id"]

    assert seeded.get(f"/api/documents/{own_doc}/file", as_="student").status_code == 200
    assert seeded.get(f"/api/documents/{other_doc}/file", as_="student").status_code == 403


def test_a_student_cannot_upload(seeded):
    tid = seeded.create_ticket()["id"]

    assert upload(seeded, tid, as_="student").status_code == 403


def test_a_document_without_a_stored_file_is_not_found(seeded):
    # Recorded through the JSON body, as before file upload existed
    tid = seeded.create_ticket()["id"]
    created = seeded.post("/api/documents", json={"ticket_id": tid, "document_type": "BAC", "file_path": "/u/bac.pdf"})

    assert seeded.get(f"/api/documents/{created.get_json()['id']}/file").status_code == 404


def test_the_file_path_cannot_escape_the_upload_folder(seeded):
    tid = seeded.create_ticket()["id"]
    created = seeded.post("/api/documents", json={"ticket_id": tid, "document_type": "BAC", "file_path": "../../app.py"})

    assert seeded.get(f"/api/documents/{created.get_json()['id']}/file").status_code == 404


class FakeMinio:
    """The slice of minio.Minio that document_storage uses, kept in memory."""

    def __init__(self):
        self.buckets, self.objects = set(), {}

    def bucket_exists(self, bucket):
        return bucket in self.buckets

    def make_bucket(self, bucket):
        self.buckets.add(bucket)

    def put_object(self, bucket, name, data, length, content_type=None):
        self.objects[(bucket, name)] = data.read(length)

    def get_object(self, bucket, name):
        return io.BytesIO(self.objects[(bucket, name)])

    def remove_object(self, bucket, name):
        del self.objects[(bucket, name)]


def test_files_go_to_minio_when_it_is_enabled(seeded, monkeypatch):
    # USE_MINIO is the Docker default
    fake = FakeMinio()
    monkeypatch.setattr("utils.minio_client.get_minio_client", lambda: fake)
    current_app.config.update(USE_MINIO=True, MINIO_BUCKET="uploads")
    tid = seeded.create_ticket()["id"]

    first = upload(seeded, tid, content=b"%PDF old").get_json()
    second = upload(seeded, tid, content=b"%PDF new", filename="cin-v2.pdf").get_json()

    assert stored_files() == []  # nothing on local disk
    assert list(fake.objects) == [("uploads", f"documents/{second['file_path']}")]
    assert first["file_path"] != second["file_path"]
    assert seeded.get(f"/api/documents/{second['id']}/file").data == b"%PDF new"

    assert seeded.delete(f"/api/documents/{second['id']}").status_code == 200
    assert fake.objects == {}
