from marshmallow import Schema, fields, validate
from schemas.formation_schema import FormationResponseSchema

class StudentCreateSchema(Schema):
    # user_id is optional now (link later)
    user_id = fields.Int(required=False, allow_none=True)

    first_name = fields.Str(required=True, validate=validate.Length(min=1))
    last_name = fields.Str(required=True, validate=validate.Length(min=1))

    email = fields.Email(allow_none=True, required=False, load_default=None)

    num_apogee = fields.Int(allow_none=True, required=False, load_default=None)

    formation_id = fields.Int(required=True)

    academic_year = fields.Str(required=True)


class StudentUpdateSchema(Schema):
    first_name = fields.Str(required=False, validate=validate.Length(min=1))
    last_name = fields.Str(required=False, validate=validate.Length(min=1))

    email = fields.Email(required=False)
    
    formation_id = fields.Int(required=False)

    num_apogee = fields.Int(required=False)

    academic_year = fields.Str(required=False)


class StudentResponseSchema(Schema):
    id = fields.Int()
    user_id = fields.Int(allow_none=True)

    first_name = fields.Str()
    last_name = fields.Str()
    email = fields.Email()

    num_apogee = fields.Int()

    academic_year = fields.Str(required=True)

    formation_id = fields.Int()
    formation = fields.Nested(FormationResponseSchema)
    
    created_at = fields.DateTime()

class StudentBulkCreateSchema(Schema):
    first_name = fields.Str(required=True, validate=validate.Length(min=1))
    last_name = fields.Str(required=True, validate=validate.Length(min=1))
    academic_year = fields.Str(required=True)
    formation_type = fields.Str(required=True, validate=validate.OneOf(['LUS', 'MUS']))
    formation_name = fields.Str(required=True)
    email = fields.Email(allow_none=True, required=False, load_default=None)
    num_apogee = fields.Int(allow_none=True, required=False, load_default=None)

class StudentBulkCreateRequestSchema(Schema):
    students = fields.List(fields.Nested(StudentBulkCreateSchema), required=True, validate=validate.Length(min=1))
