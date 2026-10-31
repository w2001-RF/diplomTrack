from marshmallow import Schema, fields, validate
from schemas.milestone_schema import MilestoneSchema


class ChronologieSchema(Schema):
    id = fields.Int(dump_only=True)

    milestone_id = fields.Int(required=True)

    milestone = fields.Nested(MilestoneSchema, allow_none=True)

    status = fields.Str(
        validate=validate.OneOf(["DONE", "BLOCKED", "PENDING"])
    )

    started_at = fields.Str(dump_only=True)
    completed_at = fields.Str(allow_none=True)
    ended_at = fields.Str(allow_none=True)

    comment = fields.Str(allow_none=True)
    blocked_reason = fields.Str(allow_none=True)

    performed_by = fields.Int(allow_none=True)