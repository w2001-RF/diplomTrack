"""Where scanned dossier documents live: MinIO when USE_MINIO is on, else a local folder.

Documents are stored under a generated name; Document.file_path holds that name.
"""

import mimetypes
import os
import uuid
from io import BytesIO

from flask import current_app, send_file
from werkzeug.exceptions import NotFound
from werkzeug.utils import secure_filename

ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg"}
MINIO_PREFIX = "documents/"


def _use_minio():
    return current_app.config.get("USE_MINIO", False)


def _bucket():
    return current_app.config.get("MINIO_BUCKET", "uploads")


def _folder():
    return current_app.config.get("DOCUMENT_UPLOAD_FOLDER", "uploads/documents")


def extension_of(filename):
    name = secure_filename(filename or "")
    return name.rsplit(".", 1)[1].lower() if "." in name else ""


def save(file, ticket_id, document_type):
    """Store an uploaded file and return its stored name."""
    ext = extension_of(file.filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file type. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}")

    name = f"ticket_{ticket_id}_{document_type}_{uuid.uuid4().hex[:8]}.{ext}"
    if _use_minio():
        from utils.minio_client import get_minio_client

        client = get_minio_client()
        if not client.bucket_exists(_bucket()):
            client.make_bucket(_bucket())
        data = file.read()
        client.put_object(_bucket(), MINIO_PREFIX + name, BytesIO(data), length=len(data),
                          content_type=file.content_type)
    else:
        os.makedirs(_folder(), exist_ok=True)
        file.save(os.path.join(_folder(), name))
    return name


def _is_stored_name(name):
    # Only names save() generated; legacy paths and "../x" are not ours to serve or delete
    return bool(name) and name == secure_filename(name) and name.startswith("ticket_")


def remove(name):
    """Delete a stored file; best effort, never raises."""
    if not _is_stored_name(name):
        return
    try:
        if _use_minio():
            from utils.minio_client import get_minio_client

            get_minio_client().remove_object(_bucket(), MINIO_PREFIX + name)
        else:
            path = os.path.join(_folder(), name)
            if os.path.exists(path):
                os.remove(path)
    except Exception:
        current_app.logger.warning("Could not remove document file %s", name)


def send(name):
    """Flask response with the stored file, or 404."""
    if not _is_stored_name(name):
        raise NotFound("No file stored for this document")
    mimetype = mimetypes.guess_type(name)[0] or "application/octet-stream"

    if _use_minio():
        from utils.minio_client import get_minio_client

        try:
            obj = get_minio_client().get_object(_bucket(), MINIO_PREFIX + name)
        except Exception:
            raise NotFound("No file stored for this document")
        return send_file(BytesIO(obj.read()), mimetype=mimetype, download_name=name)

    path = os.path.abspath(os.path.join(_folder(), name))
    if not os.path.isfile(path):
        raise NotFound("No file stored for this document")
    return send_file(path, mimetype=mimetype, download_name=name)
