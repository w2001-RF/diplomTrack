import os
from flask import Blueprint, request, jsonify, send_from_directory, current_app, Response
from flask_jwt_extended import jwt_required
from services.user_service import UserService
from services.auth_service import AuthService
from schemas.auth_schemas import (
    SignupSchema,
    LoginSchema,
    AuthUserResponseSchema
)
from marshmallow import ValidationError as MarshmallowValidationError
from exceptions import ValidationError

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

signup_schema = SignupSchema()
login_schema = LoginSchema()
user_schema = AuthUserResponseSchema()


# =========================================================
# AUTH ROUTES
# =========================================================

@auth_bp.route("/signup", methods=["POST"])
def signup():
    """
    Public signup (STUDENT by default)
    Agents/Admins should be created by ADMIN only
    """
    try:
        data = signup_schema.load(request.json)
    except MarshmallowValidationError as e:
        # Handle Marshmallow validation errors specifically
        raise ValidationError("Missing required fields")
    except Exception as e:
        # Handle other exceptions
        raise ValidationError("Invalid request data")

    required_fields = ["username", "email", "password"]
    if not all(field in data for field in required_fields):
        return {"message": "Missing required fields"}, 400

    user = AuthService.signup(
        username=data["username"],
        email=data["email"],
        password=data["password"]
    )

    return {
        "message": "Account created successfully",
        "user_id": user.id
    }, 201


@auth_bp.route("/login", methods=["POST"])
def login():
    """
    Login and retrieve JWT token
    """
    data = login_schema.load(request.json)

    if "email" not in data or "password" not in data:
        return {"message": "Email and password required"}, 400

    try:
        user = AuthService.authenticate(
            data["email"],
            data["password"]
        )
    except ValueError:
        return {"message": "Invalid credentials"}, 401
    except PermissionError:
        return {"message": "Account disabled"}, 403

    token = AuthService.generate_token(user)

    return jsonify({
        "access_token": token,
        "token_type": "Bearer",
        "expires_in": 8 * 3600
    })


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    """
    Get current authenticated user info
    """
    user = AuthService.get_current_user()

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active
    }


@auth_bp.route("/session", methods=["GET"])
@jwt_required()
def get_session():
    """
    Get current session with user info and role
    """
    user = AuthService.get_current_user()

    return {
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
            "must_reset_password": user.must_reset_password,
            "profile_image": user.profile_image  # ✅ AJOUTER
        },
        "role": user.role
    }

@auth_bp.route("/reset-password", methods=["PUT"])
@jwt_required()
def reset_password():
    data = request.get_json(silent=True) or {}

    if "password" not in data:
        return {"message": "Password required"}, 400

    AuthService.reset_password(data["password"])
    return {"message": "Password updated"}

@auth_bp.route("/upload-profile-image/<int:user_id>", methods=["POST"])
@jwt_required()
def upload_profile_image(user_id):
    """
    Upload profile image for a user
    - Users can only upload their own image
    - Admins can upload for any user
    """
    if 'file' not in request.files:
        return {"message": "No file provided"}, 400
    
    file = request.files['file']
    
    if file.filename == '':
        return {"message": "No file selected"}, 400
    
    # Validate file type
    allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    if not ('.' in file.filename and file.filename.rsplit('.', 1)[1].lower() in allowed_extensions):
        return {"message": "Invalid file type. Allowed: png, jpg, jpeg, gif, webp"}, 400
    
    try:
        current_user = AuthService.get_current_user()
        
        # ✅ Check permissions: only own profile or ADMIN
        if current_user.id != user_id and current_user.role != "ADMIN":
            return {"message": "Forbidden: You can only update your own profile image"}, 403
        
        result = UserService.upload_profile_image(user_id, file, current_user.id)
        return {
            "message": "Profile image uploaded successfully",
            "profile_image": result
        }, 200
    except Exception as e:
        return {"message": str(e)}, 500


@auth_bp.route("/delete-profile-image/<int:user_id>", methods=["DELETE"])
@jwt_required()
def delete_profile_image(user_id):
    """
    Delete profile image for a user
    - Users can only delete their own image
    - Admins can delete for any user
    """
    try:
        current_user = AuthService.get_current_user()
        
        # ✅ Check permissions: only own profile or ADMIN
        if current_user.id != user_id and current_user.role != "ADMIN":
            return {"message": "Forbidden: You can only delete your own profile image"}, 403
        
        UserService.delete_profile_image(user_id, current_user.id)
        return {"message": "Profile image deleted successfully"}, 200
    except ValueError as e:
        return {"message": str(e)}, 404
    except Exception as e:
        return {"message": str(e)}, 500

@auth_bp.route("/profile-image/<int:user_id>", methods=["GET"])
def get_profile_image(user_id):
    """
    Get profile image for a user
    Public endpoint - no authentication required
    Returns the image file or 404 if not found
    """
    try:
        from flask import Response

        user = UserService.get_profile_image_path(user_id)
        use_minio = current_app.config.get("USE_MINIO", False)

        if use_minio:
            from utils.minio_client import get_minio_client

            client = get_minio_client()
            bucket = current_app.config.get("MINIO_BUCKET", "uploads")

            obj = client.get_object(bucket, user)

            return Response(
                obj.read(),
                mimetype="image/jpeg"
            )

        else:
            upload_folder = current_app.config.get("UPLOAD_FOLDER", "uploads/profiles")
            return send_from_directory(upload_folder, user)
        
    except ValueError as e:
        return {"message": str(e)}, 404
    except Exception as e:
        return {"message": str(e)}, 500