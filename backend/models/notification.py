from extensions import db
from datetime import datetime


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    ticket_id = db.Column(
        db.Integer,
        db.ForeignKey("tickets.id"),
        nullable=True
    )

    type = db.Column(db.String(50), nullable=False)  # 'info', 'warning', 'error', 'success'

    title = db.Column(db.String(150), nullable=False)
    message = db.Column(db.Text, nullable=False)

    is_read = db.Column(db.Boolean, default=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relations
    ticket = db.relationship('Ticket', backref='notifications', lazy="select")

    def __repr__(self):
        return f"<Notification {self.id} user={self.user_id} type={self.type}>"