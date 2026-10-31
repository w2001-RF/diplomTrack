from extensions import db
from datetime import datetime


class Student(db.Model):
    __tablename__ = "students"

    id = db.Column(db.Integer, primary_key=True)

    # OPTIONAL link to account (User). Not unique, nullable.
    # A student profile can exist without an account.
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    # Profile identity fields
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)

    # Identity
    # IMPORTANT: store the student email in profile (used for later linking)
    email = db.Column(db.String(120), nullable=True, index=True)
    num_apogee = db.Column(db.Integer, unique=True, nullable=True)

    # Academic formation details
    academic_year = db.Column(db.String(20), nullable=False)
    
    formation_id = db.Column(
        db.Integer,
        db.ForeignKey("formations.id"),
        nullable=False
    )

    # Relations
    formation = db.relationship("Formation")

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Student {self.first_name} {self.last_name}>"
