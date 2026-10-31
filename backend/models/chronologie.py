from extensions import db
from datetime import datetime


class Chronologie(db.Model):
    __tablename__ = "chronologies"

    id = db.Column(db.Integer, primary_key=True)

    ticket_id = db.Column(
        db.Integer,
        db.ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False
    )

    milestone_id = db.Column(
        db.Integer,
        db.ForeignKey("milestones.id"),
        nullable=False
    )

    status = db.Column(
        db.String(30),
        nullable=False,
        default="PENDING"  # DONE | BLOCKED | PENDING
    )

    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)

    comment = db.Column(db.Text)

    performed_by = db.Column(
        db.Integer,
        db.ForeignKey("users.id")
    )

    blocked_reason = db.Column(db.Text)

    ended_at = db.Column(db.DateTime, nullable=True)

    # Relationships
    ticket = db.relationship("Ticket", back_populates="chronologies")
    milestone = db.relationship("Milestone")

    def __repr__(self):
        return f"<Chronologie ticket={self.ticket_id}>"
