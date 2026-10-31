from extensions import db


class Grade(db.Model):
    __tablename__ = "grades"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(100), unique=True, nullable=False)  # e.g. "Professeur", "Maître de Conférences", etc.
    code = db.Column(db.String(30), unique=True, nullable=True)    # optional: "PA", "PES", ...

    professors = db.relationship("Professor", back_populates="grade", lazy=True)

    def __repr__(self):
        return f"<Grade {self.name}>"
