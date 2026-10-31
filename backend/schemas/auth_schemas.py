from marshmallow import Schema, fields, validate


class SignupSchema(Schema):
    username = fields.Str(required=True, validate=validate.Length(min=3))
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=validate.Length(min=6))


class LoginSchema(Schema):
    email = fields.Str(required=True)
    password = fields.Str(required=True)


class AuthUserResponseSchema(Schema):
    id = fields.Int()
    username = fields.Str()
    email = fields.Email()
    role = fields.Str()
