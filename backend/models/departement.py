from extensions import db
from datetime import datetime


class Departement(db.Model):
    __tablename__ = "departements"

    id = db.Column(db.Integer, primary_key=True)

    departement_name = db.Column(db.String(200), unique=True, nullable=False)
    # ✅ chef is a professor (FK)
    chef_professor_id = db.Column(
        db.Integer,
        db.ForeignKey("professors.id"),
        nullable=False
    )

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Professors belonging to this department
    professors = db.relationship(
        "Professor",
        back_populates="departement",
        lazy=True,
        foreign_keys="Professor.departement_id"
    )

    # Chef relationship (one professor)
    chef = db.relationship(
        "Professor",
        foreign_keys=[chef_professor_id],
        lazy=True
    )
    def __repr__(self):
        return f"<Departement {self.departement_name} chef={self.chef_professor_id}>"
