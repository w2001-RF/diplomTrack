from extensions import db
from datetime import datetime


class Formation(db.Model):
    __tablename__ = "formations"

    id = db.Column(db.Integer, primary_key=True)

    formation_name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)

    formation_type_id = db.Column(
        db.Integer,
        db.ForeignKey("formation_types.id"),
        nullable=False
    )

    professor_responsible_id = db.Column(
        db.Integer,
        db.ForeignKey("professors.id"),
        nullable=False
    )

    # Optional: separate "contact"
    contact_professor_id = db.Column(
        db.Integer,
        db.ForeignKey("professors.id"),
        nullable=True
    )

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    formation_type = db.relationship("FormationType", back_populates="formations")
    professor_responsible = db.relationship(
        "Professor",
        foreign_keys=[professor_responsible_id],
        back_populates="formations_responsible"
    )

    contact_professor = db.relationship(
        "Professor",
        foreign_keys=[contact_professor_id],
        back_populates="formations_contact"
    )

    __table_args__ = (
        db.UniqueConstraint("formation_name", "formation_type_id", name="uq_formation_name_type"),
    )

    def __repr__(self):
        return f"<Formation {self.formation_name}>"
