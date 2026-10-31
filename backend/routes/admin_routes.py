from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from services.user_service import UserService
from utils.permissions import require_roles
from schemas.user_schemas import (
    UserCreateSchema,
    UserUpdateSchema,
    UserResponseSchema,
    BulkAgentCreateSchema
)
from routes.notification_routes import _current_user_id

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

create_schema = UserCreateSchema()
update_schema = UserUpdateSchema()
user_schema = UserResponseSchema()
users_schema = UserResponseSchema(many=True)

bulk_agent_create_schema = BulkAgentCreateSchema()

# =========================================================
# USERS MANAGEMENT
# =========================================================

@admin_bp.route("/users", methods=["GET"])
@jwt_required()
@require_roles("ADMIN")
def list_users():
    """
    List all users
    """
    users = UserService.list_users()
    return jsonify(users)


@admin_bp.route("/users", methods=["POST"])
@jwt_required()
@require_roles("ADMIN")
def create_user():
    """
    Create user (Admin only)
    """
    data = create_schema.load(request.json)

    required_fields = ["username", "email", "password", "role"]
    if not all(field in data for field in required_fields):
        return {"message": "Missing required fields"}, 400

    user = UserService.create_user(
        username=data["username"],
        email=data["email"],
        password=data["password"],
        role=data["role"],
        performed_by=_current_user_id()
    )

    return user, 201

@admin_bp.route("/users/agents/bulk", methods=["POST"])
@jwt_required()
@require_roles("ADMIN")
def bulk_create_agents():
    """
    Create multiple AGENT users with auto-generated passwords
    """
    data = bulk_agent_create_schema.load(request.json)
    performed_by = _current_user_id()

    result = UserService.bulk_create_agents(
        users_data=data["agents"],
        performed_by=performed_by
    )

    return {
        "created": result,
        "count": len(result),
        "note": "Passwords are shown only once. Store them securely."
    }, 201

@admin_bp.route("/users/<int:user_id>", methods=["GET"])
@jwt_required()
@require_roles("ADMIN")
def get_user(user_id):
    """
    Get user details
    """
    user = UserService.get_user(user_id)
    return user


@admin_bp.route("/users/<int:user_id>", methods=["PUT"])
@jwt_required()
@require_roles("ADMIN")
def update_user(user_id):
    """
    Update user (email, role, activation)
    """
    data = update_schema.load(request.json)
    jwt_data = get_jwt()

    user = UserService.update_user(
        user_id=user_id,
        email=data.get("email"),
        role=data.get("role"),
        is_active=data.get("is_active"),
        performed_by=jwt_data["user_id"]
    )

    return user


@admin_bp.route("/users/<int:user_id>/reset-password", methods=["PUT"])
@jwt_required()
@require_roles("ADMIN")
def reset_password(user_id):
    """
    Reset user password
    """
    password = request.json.get("password")
    jwt_data = get_jwt()

    UserService.reset_password(
        user_id=user_id,
        password=password,
        performed_by=jwt_data["user_id"]
    )

    return {"message": "Password reset successfully"}


@admin_bp.route("/users/<int:user_id>/disable", methods=["PUT"])
@jwt_required()
@require_roles("ADMIN")
def disable_user(user_id):
    """
    Disable user account
    """
    UserService.deactivate_user(user_id, _current_user_id())
    return {"message": "User disabled"}


@admin_bp.route("/users/<int:user_id>/enable", methods=["PUT"])
@jwt_required()
@require_roles("ADMIN")
def enable_user(user_id):
    """
    Enable user account
    """
    UserService.enable_user(user_id, _current_user_id())
    return {"message": "User enabled"}


@admin_bp.route("/users/<int:user_id>", methods=["DELETE"])
@jwt_required()
@require_roles("ADMIN")
def delete_user(user_id):
    """
    Delete user (hard delete – use with caution)
    """
    jwt_data = get_jwt()

    if jwt_data["user_id"] == user_id:
        return {"message": "Cannot delete your own account"}, 400

    UserService.delete_user(user_id, jwt_data["user_id"])
    return {"message": "User deleted"}
