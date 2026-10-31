from extensions import db


class FormationType(db.Model):
    __tablename__ = "formation_types"

    id = db.Column(db.Integer, primary_key=True)

    code = db.Column(db.String(10), unique=True, nullable=False)  # LUS | MUS
    label = db.Column(db.String(50), nullable=False)

    formations = db.relationship("Formation", back_populates="formation_type", lazy=True)

    def __repr__(self):
        return f"<FormationType {self.code}>"
