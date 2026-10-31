from extensions import db
from datetime import datetime


class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.Integer, primary_key=True)

    performed_by = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=True
    )

    action = db.Column(db.String(100), nullable=False)
    # CREATE_TICKET, VALIDATE_DOCUMENT, CHANGE_MILESTONE, LOGIN, UPDATE_CONFIG

    entity_type = db.Column(db.String(50), nullable=False)
    # TICKET | DOCUMENT | USER | CONFIG

    entity_id = db.Column(db.Integer, nullable=True)

    description = db.Column(db.Text)

    route = db.Column(db.String(255))

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    ip_address = db.Column(db.String(50))

    def __repr__(self):
        return f"<AuditLog {self.action} {self.entity_type}>"
