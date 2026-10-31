from marshmallow import Schema, fields, validate


class MilestoneSchema(Schema):
    id = fields.Int(dump_only=True)

    code = fields.Str(dump_only=True)

    label = fields.Str(required=True)
    description = fields.Str(allow_none=True)

    order = fields.Integer(required=True)

    is_terminal = fields.Boolean(dump_only=True)