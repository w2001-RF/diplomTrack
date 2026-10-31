from marshmallow import Schema, fields


class FormationTypeMiniSchema(Schema):
    id = fields.Int()
    code = fields.Str()
    label = fields.Str()


class ProfessorMiniSchema(Schema):
    id = fields.Int()
    first_name = fields.Str()
    last_name = fields.Str()
    email = fields.Str(allow_none=True)
    phone = fields.Str(allow_none=True)


class FormationResponseSchema(Schema):
    id = fields.Int()
    formation_name = fields.Str()
    description = fields.Str(allow_none=True)

    formation_type = fields.Nested(FormationTypeMiniSchema)
    professor_responsible = fields.Nested(ProfessorMiniSchema)

    created_at = fields.DateTime()
