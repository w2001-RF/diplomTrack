from marshmallow import Schema, fields, validate
from utils.constants import DocumentType

REQUIRED_DOCUMENTS = DocumentType.all()

class DocumentSchema(Schema):
    id = fields.Int(dump_only=True)

    ticket_id = fields.Int(required=True)

    document_type = fields.Str(
        required=True,
        validate=validate.OneOf(REQUIRED_DOCUMENTS)
    )

    file_path = fields.Str(required=True)

    is_validated = fields.Bool(dump_only=True)
    validation_comment = fields.Str(allow_none=True)

    validated_by = fields.Int(dump_only=True)
    validated_at = fields.DateTime(dump_only=True)

    created_at = fields.DateTime(dump_only=True)
