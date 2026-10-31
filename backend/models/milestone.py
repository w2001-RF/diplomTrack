from extensions import db
from datetime import datetime
    
class Milestone(db.Model):
    __tablename__ = "milestones"

    id = db.Column(db.Integer, primary_key=True)

    code = db.Column(db.String(50), unique=True, nullable=False)
    label = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)

    order = db.Column(db.Integer, nullable=False)
    is_terminal = db.Column(db.Boolean, default=False)

    def __repr__(self):
        return f"<Milestone {self.code}>"
