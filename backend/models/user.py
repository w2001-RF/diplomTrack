from extensions import db
from datetime import datetime


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)

    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    phone_number = db.Column(db.String(20), unique=False, nullable=True)

    profile_image = db.Column(db.String(500), nullable=True)
    
    password_hash = db.Column(db.String(255), nullable=False)

    role = db.Column(db.String(30), nullable=False)
    # STUDENT | AGENT | ADMIN

    is_active = db.Column(db.Boolean, default=True)

    must_reset_password = db.Column(db.Boolean, default=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    # optional: list of student profiles linked to this account (usually 0 or 1)
    student_profiles = db.relationship("Student", backref="user", lazy=True)

    notifications = db.relationship(
        "Notification",
        backref="user",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<User {self.username} ({self.role})>"
