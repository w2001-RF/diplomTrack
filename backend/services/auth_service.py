from datetime import timedelta

from flask_jwt_extended import create_access_token, get_jwt_identity

from models.student import Student
from models.user import User
from extensions import db
from utils.security import verify_password, hash_password
from services.audit_service import AuditService
from services.student_service import StudentService
from exceptions import ConflictError, ValidationError


class AuthService:
    """
    Authentication & identity-related business logic
    """

    # =========================================================
    # JWT TOKEN GENERATOR
    # =========================================================
    @staticmethod
    def generate_token(user: User) -> str:
        """
        Generate JWT access token with RBAC claims
        """
        claims = {
            "role": user.role,
            "user_id": user.id,
            "must_reset_password": user.must_reset_password
        }

        return create_access_token(
            identity=user.username,
            additional_claims=claims,
            expires_delta=timedelta(hours=8)
        )

    # =========================================================
    # SIGNUP
    # =========================================================
    @staticmethod
    def signup(username: str, email: str, password: str) -> User:
        """
        Public signup (STUDENT only)
        """
        if User.query.filter(
            (User.username == username) |
            (User.email == email)
        ).first():
            raise ConflictError("User already exists")

        user = User(
            username=username,
            email=email,
            password_hash=hash_password(password),
            role="STUDENT",
            is_active=True
        )


        student = StudentService.get_student_by_email(email)
        if not student:
            raise ValidationError("No student exists with this email yet. Contact the admin to create your student profile.")
        
        db.session.add(user)
        db.session.flush()

        StudentService.link_student_to_user_by_email(student.id, user=user)

        db.session.add(student)
        db.session.commit()

        AuditService.log_action(
            action="SIGNUP",
            entity_type="USER",
            entity_id=user.id
        )

        return user

    # =========================================================
    # LOGIN
    # =========================================================
    @staticmethod
    def authenticate(email: str, password: str) -> User:
        """
        Validate credentials and return user
        """
        user = User.query.filter_by(email=email).first()
        if not user or not verify_password(password, user.password_hash):
            raise ValueError("Invalid credentials")

        if not user.is_active:
            raise PermissionError("Account disabled")

        AuditService.log_action(
            action="LOGIN",
            entity_type="USER",
            entity_id=user.id
        )

        return user

    # =========================================================
    # CURRENT USER
    # =========================================================
    @staticmethod
    def get_current_user() -> User:
        """
        Retrieve current authenticated user from JWT
        """
        username = get_jwt_identity()
        return User.query.filter_by(username=username).first_or_404()
    
    @staticmethod
    def reset_password(new_password):
        user = User.query.filter_by(
            username=get_jwt_identity()
        ).first_or_404()

        user.password_hash = hash_password(new_password)
        user.must_reset_password = False
        db.session.commit()
