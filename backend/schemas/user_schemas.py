from marshmallow import Schema, fields, validate


class UserCreateSchema(Schema):
    username = fields.Str(required=True, validate=validate.Length(min=3))
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=validate.Length(min=6))
    role = fields.Str(
        required=True,
        validate=validate.OneOf(["STUDENT", "AGENT", "ADMIN"])
    )


class UserUpdateSchema(Schema):
    email = fields.Email(required=False)
    role = fields.Str(
        required=False,
        validate=validate.OneOf(["STUDENT", "AGENT", "ADMIN"])
    )
    is_active = fields.Boolean(required=False)


class UserResponseSchema(Schema):
    id = fields.Int()
    username = fields.Str()
    email = fields.Email()
    role = fields.Str()
    is_active = fields.Boolean()
    created_at = fields.DateTime()

class UserListResponseSchema(Schema):
    users = fields.List(fields.Nested(UserResponseSchema))

class BulkAgentCreateItemSchema(Schema):
    username = fields.Str(required=True, validate=validate.Length(min=3))
    email = fields.Email(required=True)


class BulkAgentCreateSchema(Schema):
    agents = fields.List(
        fields.Nested(BulkAgentCreateItemSchema),
        required=True,
        validate=validate.Length(min=1)
    )
