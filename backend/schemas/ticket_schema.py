from marshmallow import Schema, fields, validate
from schemas.milestone_schema import MilestoneSchema
from schemas.chronologie_schema import ChronologieSchema
from schemas.document_schema import DocumentSchema


class FormationTypeMiniSchema(Schema):
    """Mini formation type schema"""
    id = fields.Int()
    code = fields.Str()
    label = fields.Str()

class DepartementMiniSchema(Schema):
    """Mini departement schema"""
    id = fields.Int()
    name = fields.Str()

class GradeMiniSchema(Schema):
    """Mini grade schema"""
    id = fields.Int()
    name = fields.Str()
    code = fields.Str()
    
class ProfessorMiniSchema(Schema):
    """Mini professor schema"""
    id = fields.Int()
    first_name = fields.Str()
    last_name = fields.Str()
    email = fields.Email(allow_none=True)
    phone = fields.Str(allow_none=True)
    departement = fields.Nested(DepartementMiniSchema, allow_none=True)
    grade = fields.Nested(GradeMiniSchema, allow_none=True) 


class FormationMiniSchema(Schema):
    """Mini formation schema for nested student responses"""
    id = fields.Int()
    formation_name = fields.Str()
    description = fields.Str(allow_none=True)
    formation_type = fields.Nested(FormationTypeMiniSchema, allow_none=True)
    professor_responsible = fields.Nested(ProfessorMiniSchema, allow_none=True)
    contact_professor = fields.Nested(ProfessorMiniSchema, allow_none=True)


class StudentSchema(Schema):
    """Nested student schema for ticket responses"""
    id = fields.Int()
    first_name = fields.Str()
    last_name = fields.Str()
    email = fields.Email()
    num_apogee = fields.Int()
    academic_year = fields.Str()
    user_id = fields.Int(allow_none=True)
    formation = fields.Nested(FormationMiniSchema, allow_none=True)


class TicketCreateSchema(Schema):
    student_id = fields.Int(required=True)
    initial_milestone_code = fields.Str(required=True)
    created_at = fields.Str(required=False)
    comment = fields.Str(required=False)


class TicketSchema(Schema):
    id = fields.Int(dump_only=True)

    reference = fields.Str(dump_only=True)

    status = fields.Str(
        validate=validate.OneOf([
            "OPEN",
            "IN_PROGRESS",
            "BLOCKED",
            "COMPLETED"
        ])
    )

    current_milestone_id = fields.Int()

    current_milestone = fields.Nested(MilestoneSchema, allow_none=True)

    diploma_validation_type = fields.Str(
        validate=validate.OneOf([
            "ATTESTATION",
            "DIPLOMA"
        ])
    )

    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

    # Nested student object
    student = fields.Nested(StudentSchema, allow_none=True)

    # 🔹 Documents liés au ticket
    documents = fields.List(
        fields.Nested(DocumentSchema),
        dump_only=True
    )

    # 🔹 Historique / chronologie du ticket
    chronologies = fields.List(
        fields.Nested(ChronologieSchema),
        dump_only=True
    )
