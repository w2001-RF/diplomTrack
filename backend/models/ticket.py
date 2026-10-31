from extensions import db
from datetime import datetime


class Ticket(db.Model):
    __tablename__ = "tickets"

    id = db.Column(db.Integer, primary_key=True)

    reference = db.Column(db.String(50), unique=True, nullable=False)

    student_id = db.Column(
        db.Integer,
        db.ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    status = db.Column(db.String(30), nullable=False)
    # OPEN | BLOCKED | IN_PROGRESS | COMPLETED

    current_milestone_id = db.Column(
        db.Integer,
        db.ForeignKey("milestones.id"),
        nullable=False
    )

    # Valeurs possibles: "DIPLOMA" | "ATTESTATION" | None
    diploma_validation_type = db.Column(
        db.String(20),
        nullable=True,
        default=None
    )

    # Relationships
    student = db.relationship(
        "Student",
        backref="tickets",
        lazy="select"
    )

    # 🔹 SAFE string-based relationship

    documents = db.relationship(
        "Document",
        back_populates="ticket",
        cascade="all, delete-orphan",
        lazy="select"
    )

    chronologies = db.relationship(
        "Chronologie",
        back_populates="ticket",
        cascade="all, delete-orphan",
        order_by="Chronologie.started_at",
        lazy="select"
    )

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Ticket {self.reference} status={self.status}>"
