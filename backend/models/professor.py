from extensions import db
from datetime import datetime


class Professor(db.Model):
    __tablename__ = "professors"

    id = db.Column(db.Integer, primary_key=True)

    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)

    email = db.Column(db.String(120), unique=True, nullable=True)
    phone = db.Column(db.String(30), nullable=True)

    speciality = db.Column(db.String(150), nullable=True)

    # If not linked => default to "Enseignements Généraux" via seeding logic
    departement_id = db.Column(
        db.Integer,
        db.ForeignKey("departements.id"),
        nullable=True
    )

    grade_id = db.Column(
        db.Integer,
        db.ForeignKey("grades.id"),
        nullable=True
    )
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # relationships
    formations_responsible = db.relationship(
        "Formation",
        foreign_keys="Formation.professor_responsible_id",
        back_populates="professor_responsible",
        lazy=True
    )

    formations_contact = db.relationship(
        "Formation",
        foreign_keys="Formation.contact_professor_id",
        back_populates="contact_professor",
        lazy=True
    )
    
    departement = db.relationship(
        "Departement",
        back_populates="professors",
        foreign_keys=[departement_id]
    )
    
    grade = db.relationship(
        "Grade", 
        back_populates="professors",
        foreign_keys=[grade_id]
    )

    def __repr__(self):
        return f"<Professor {self.first_name} {self.last_name}>"
