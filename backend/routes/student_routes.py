from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt

from services.auth_service import AuthService
from services.student_service import StudentService
from utils.permissions import require_roles

from schemas.student_schemas import (
    StudentCreateSchema,
    StudentUpdateSchema,
    StudentResponseSchema,
    StudentBulkCreateRequestSchema
)

student_bp = Blueprint("students", __name__, url_prefix="/api/students")

create_schema = StudentCreateSchema()
update_schema = StudentUpdateSchema()
student_schema = StudentResponseSchema()
students_schema = StudentResponseSchema(many=True)
bulk_create_schema = StudentBulkCreateRequestSchema()


@student_bp.route("/", methods=["GET"])
@jwt_required()
@require_roles("ADMIN", "AGENT", "STUDENT")
def list_students():
    """
    List students with pagination, sorting, and filtering
    Query params:
    - page: page number (default: 1)
    - limit/length: items per page (default: 10)
    - sort: sort field with +/- prefix for asc/desc (default: +created_at)
    - filter[field][op]=value: dynamic filters
      Supported operators: eq, ne, gt, gte, lt, lte, like, in
    
    Examples:
    - /students?filter[formation_id][eq]=3&limit=10
    - /students?filter[last_name][like]=Smith&page=1
    - /students?filter[num_apogee][in]=123,456,789
    """

    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 10, type=int)

    # Parse sort parameter: +field (asc), -field (desc), field (default asc)
    sort = request.args.get("sort", "created_at", type=str)
    sort_field = sort.lstrip("+-") or "created_at"
    sort_order = "desc" if sort.startswith("-") else "asc"

    # Parse dynamic filters
    filters = []
    for key in request.args.keys():
        if key.startswith("filter["):
            # Extract field and operator from filter[field][op]
            import re
            match = re.match(r'filter\[([^\]]+)\]\[([^\]]+)\]', key)
            if match:
                field, operator = match.groups()
                value = request.args.get(key)
                
                # Validate operator
                valid_operators = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'like', 'in', 'ilike']
                if operator in valid_operators:
                    filters.append({
                        'field': field,
                        'operator': operator,
                        'value': value
                    })

        
    # Get paginated students
    paginated_students = StudentService.list_students(
        page=page,
        limit=limit,
        sort_field=sort_field,
        sort_order=sort_order,
        filters=filters
    )

    return {
        "students": students_schema.dump(paginated_students.items),
        "total": paginated_students.total,
        "page": page
    }, 200


@student_bp.route("/<int:student_id>", methods=["GET"])
@jwt_required()
@require_roles("ADMIN", "AGENT", "STUDENT")
def get_student(student_id):
    """
    Get student by ID
    - ADMIN and AGENT can access any student
    - STUDENT can only access their own information
    """
    current_user = AuthService.get_current_user();
    
    if current_user.role == "STUDENT":
        try:
            user_student = StudentService.get_student(current_user.id)
            
            if user_student.id != student_id:
                return {
                    "message": "Access denied. You can only view your own information"
                }, 403
                
        except ValueError as e:
            return {"message": str(e)}, 404
        
    try:
        student = StudentService.get_student(student_id)
        return student_schema.dump(student), 200
    except ValueError as e:
        return {"message": str(e)}, 404


@student_bp.route("/", methods=["POST"])
@jwt_required()
@require_roles("ADMIN", "AGENT")
def create_student():
    data = create_schema.load(request.json)
    performed_by = get_jwt()["user_id"]

    student = StudentService.create_student(data, performed_by=performed_by)

    return student_schema.dump(student), 201

@student_bp.route("/bulk", methods=["POST"])
@jwt_required()
@require_roles("ADMIN", "AGENT")
def bulk_create_students():
    """
    Create multiple students at once
    
    Request body:
    {
        "students": [
            {
                "first_name": "John",
                "last_name": "Doe",
                "academic_year": "2023-2024",
                "formation_type": "LUS",
                "formation_name": "Licence Informatique",
                "email": "john@example.com",  // optional
                "num_apogee": 12345  // optional
            },
            ...
        ]
    }
    
    Response:
    {
        "success": 10,
        "failed": 2,
        "total": 12,
        "errors": [
            {
                "index": 5,
                "data": {...},
                "error": "Formation not found"
            }
        ]
    }
    """
    data = bulk_create_schema.load(request.json)
    performed_by = get_jwt()["user_id"]
    
    results = StudentService.bulk_create_students(
        students_data=data['students'],
        performed_by=performed_by
    )
    
    status_code = 201 if results['failed'] == 0 else 207  # 207 = Multi-Status
    
    return jsonify(results), status_code

@student_bp.route("/<int:student_id>", methods=["PUT"])
@jwt_required()
@require_roles("ADMIN", "AGENT", "STUDENT")
def update_student(student_id):
    data = update_schema.load(request.json)
    performed_by = get_jwt()["user_id"]

    student = StudentService.update_student(
        student_id=student_id,
        data=data,
        performed_by=performed_by
    )

    return student_schema.dump(student), 200


@student_bp.route("/<int:student_id>", methods=["DELETE"])
@jwt_required()
@require_roles("ADMIN", "AGENT")
def delete_student(student_id):
    performed_by = get_jwt()["user_id"]
    StudentService.delete_student(student_id, performed_by=performed_by)
    return {"message": "Student deleted"}, 200
