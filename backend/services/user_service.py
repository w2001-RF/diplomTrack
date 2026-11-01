from models.user import User
from extensions import db
from utils.security import hash_password
from utils.passwords import generate_secure_password
from services.audit_service import AuditService
import os
import uuid
from werkzeug.utils import secure_filename
from flask import current_app
from io import BytesIO
from exceptions import ConflictError

# =========================================================
# Helper
# =========================================================

def serialize_user(user: User):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "profile_image": user.profile_image,
        "created_at": user.created_at.isoformat()
    }


class UserService:

    # -----------------------------------------
    # Internal helper
    # -----------------------------------------
    @staticmethod
    def _use_minio():
        return current_app.config.get("USE_MINIO", False)
    
    @staticmethod
    def _get_minio_client():
        from utils.minio_client import get_minio_client
        return get_minio_client()

    @staticmethod
    def create_user(username, email, password, role, performed_by=None):
        if User.query.filter(
            (User.username == username) |
            (User.email == email)
        ).first():
            raise ConflictError("User already exists")

        user = User(
            username=username,
            email=email,
            password_hash=hash_password(password),
            role=role,
            must_reset_password= role in ["ADMIN", "AGENT"],
            is_active=True
        )

        db.session.add(user)
        db.session.commit()

        AuditService.log_action(
            action="CREATE_USER_{role}".format(role=role),
            entity_type="USER",
            entity_id=user.id,
            performed_by=performed_by
        )

        return serialize_user(user)

    @staticmethod
    def get_user(user_id):
        return serialize_user(User.query.get_or_404(user_id))

    @staticmethod
    def list_users():
        users = User.query.order_by(User.created_at.desc()).all()
        return [serialize_user(u) for u in users]

    @staticmethod
    def update_user(user_id, email=None, role=None, is_active=None, performed_by=None):
        user = User.query.get_or_404(user_id)

        if email is not None:
            user.email = email
        if role is not None:
            user.role = role
        if is_active is not None:
            user.is_active = is_active

        db.session.commit()

        AuditService.log_action(
            action="UPDATE_USER_{role}".format(role=role),
            entity_type="USER",
            entity_id=user.id,
            performed_by=performed_by
        )

        return serialize_user(user)

    @staticmethod
    def reset_password(user_id, password, performed_by=None):
        user = User.query.get_or_404(user_id)
        user.password_hash = hash_password(password)
        role = user.role
        db.session.commit()

        AuditService.log_action(
            action="RESET_PASSWORD_{role}".format(role=role),
            entity_type="USER",
            entity_id=user.id,
            performed_by=performed_by
        )

    @staticmethod
    def deactivate_user(user_id, performed_by=None):
        user = User.query.get_or_404(user_id)
        user.is_active = False
        role = user.role
        db.session.commit()

        AuditService.log_action(
            action="DISABLE_USER_{role}".format(role=role),
            entity_type="USER",
            entity_id=user.id,
            performed_by=performed_by
        )

    @staticmethod
    def enable_user(user_id, performed_by=None):
        user = User.query.get_or_404(user_id)
        user.is_active = True
        role = user.role
        db.session.commit()

        AuditService.log_action(
            action="ENABLE_USER_{role}".format(role=role),
            entity_type="USER",
            entity_id=user.id,
            performed_by=performed_by
        )

    @staticmethod
    def delete_user(user_id, performed_by=None):
        user = User.query.get_or_404(user_id)
        role = user.role
        db.session.delete(user)
        db.session.commit()

        AuditService.log_action(
            action="DELETE_USER_{role}".format(role=role),
            entity_type="USER",
            entity_id=user_id,
            performed_by=performed_by
        )
    
    @staticmethod
    def bulk_create_agents(users_data: list, performed_by: int):
        """
        Create multiple AGENT users with auto-generated passwords
        """
        created_users = []

        for item in users_data:
            username = item["username"]
            email = item["email"]

            if User.query.filter(
                (User.username == username) |
                (User.email == email)
            ).first():
                continue  # skip existing users

            password = generate_secure_password()

            user = User(
                username=username,
                email=email,
                password_hash=hash_password(password),
                role="AGENT",
                must_reset_password=True,
                is_active=True
            )

            role = user.role

            db.session.add(user)
            db.session.flush()  # get user.id before commit

            AuditService.log_action(
                action="CREATE_AGENT_{role}".format(role=role),
                entity_type="USER",
                entity_id=user.id,
                performed_by=performed_by,
                description=str({"username": username})
            )

            created_users.append({
                "id": user.id,
                "username": username,
                "email": email,
                "password": password  # returned once
            })

        db.session.commit()
        return created_users
    
    @staticmethod
    def upload_profile_image(user_id: int, file, performed_by=None) -> str:
        """
        Upload profile image for a user
        """
        user = User.query.get_or_404(user_id)
        
        use_minio = UserService._use_minio()
        bucket = current_app.config.get("MINIO_BUCKET", "uploads")

        # Generate filename
        ext = secure_filename(file.filename).rsplit('.', 1)[1].lower()
        filename = f"profile_{user.id}_{uuid.uuid4().hex[:8]}.{ext}"

        # Delete old image if exists
        if user.profile_image:
            try:
                if use_minio:
                    client = UserService._get_minio_client()
                    client.remove_object(bucket, user.profile_image)
                else:
                    old_path = os.path.join(
                        current_app.config.get("UPLOAD_FOLDER", "uploads/profiles"),
                        user.profile_image
                    )
                    if os.path.exists(old_path):
                        os.remove(old_path)
            except Exception:
                pass  # do not block upload if old file missing

        # -----------------------------------------
        # Upload new file
        # -----------------------------------------
        if use_minio:
            client = UserService._get_minio_client()

            if not client.bucket_exists(bucket):
                client.make_bucket(bucket)

            file_bytes = file.read()
            file.seek(0)

            client.put_object(
                bucket,
                filename,
                BytesIO(file_bytes),
                length=len(file_bytes),
                content_type=file.content_type
            )

        else:
            upload_folder = current_app.config.get("UPLOAD_FOLDER", "uploads/profiles")
            os.makedirs(upload_folder, exist_ok=True)

            filepath = os.path.join(upload_folder, filename)
            file.save(filepath)

        # Update DB
        user.profile_image = filename
        db.session.commit()

        AuditService.log_action(
            action=f"UPLOAD_PROFILE_IMAGE_{user.role}",
            entity_type="USER",
            entity_id=user.id,
            performed_by=performed_by
        )

        return filename

    @staticmethod
    def delete_profile_image(user_id: int, performed_by=None):
        """
        Delete profile image for a user
        """
        user = User.query.get_or_404(user_id)
        
        if not user.profile_image:
            raise ValueError("No profile image to delete")
        
        use_minio = UserService._use_minio()
        bucket = current_app.config.get("MINIO_BUCKET", "uploads")

        # Generate filename
        ext = secure_filename(file.filename).rsplit('.', 1)[1].lower()
        filename = f"profile_{user.id}_{uuid.uuid4().hex[:8]}.{ext}"

        # Delete old image if exists
        if user.profile_image:
            try:
                if use_minio:
                    client = UserService._get_minio_client()
                    client.remove_object(bucket, user.profile_image)
                else:
                    old_path = os.path.join(
                        current_app.config.get("UPLOAD_FOLDER", "uploads/profiles"),
                        user.profile_image
                    )
                    if os.path.exists(old_path):
                        os.remove(old_path)
            except Exception:
                pass  # do not block upload if old file missing

        # -----------------------------------------
        # Upload new file
        # -----------------------------------------
        if use_minio:
            client = UserService._get_minio_client()

            if not client.bucket_exists(bucket):
                client.make_bucket(bucket)

            file_bytes = file.read()
            file.seek(0)

            client.put_object(
                bucket,
                filename,
                BytesIO(file_bytes),
                length=len(file_bytes),
                content_type=file.content_type
            )

        else:
            upload_folder = current_app.config.get("UPLOAD_FOLDER", "uploads/profiles")
            os.makedirs(upload_folder, exist_ok=True)

            filepath = os.path.join(upload_folder, filename)
            file.save(filepath)

        # Update DB
        user.profile_image = filename
        db.session.commit()

        AuditService.log_action(
            action=f"UPLOAD_PROFILE_IMAGE_{user.role}",
            entity_type="USER",
            entity_id=user.id,
            performed_by=performed_by
        )

        return filename
    
    @staticmethod
    def get_profile_image_path(user_id: int) -> str:
        """
        Get the profile image filename for a user
        Raises ValueError if user has no profile image
        """
        user = User.query.get_or_404(user_id)
        
        if not user.profile_image:
            raise ValueError("No profile image found for this user")
        
        return user.profile_image
