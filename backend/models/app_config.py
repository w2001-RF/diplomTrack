from extensions import db
from datetime import datetime


class AppConfig(db.Model):
    """
    Single-row configuration table (recommended: keep id=1).
    Stores business settings like warning delays.
    """
    __tablename__ = "app_config"

    id = db.Column(db.Integer, primary_key=True)

    # Core SLA / warnings
    warning_delay_days = db.Column(db.Integer, nullable=False, default=14)

    # Optional: email receiver for alerts
    alerts_email = db.Column(db.String(150), nullable=True)

    # Optional: default templates (can be extended later)
    notification_template_student = db.Column(db.Text, nullable=True)
    notification_template_agent = db.Column(db.Text, nullable=True)

    # Max upload size in MB
    max_upload_size_mb = db.Column(db.Integer, nullable=False, default=10)
    
    # Auto Archive Days
    auto_archive_days = db.Column(db.Integer, nullable=False, default=365)

    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # ✅ Email Templates - Subjects
    email_ticket_blocked_subject = db.Column(db.String(255), default='🚫 Ticket bloqué - {ticket_reference}')
    email_agent_delay_subject = db.Column(db.String(255), default='⚠️ Tickets en retard - {count} dossier(s)')
    email_admin_report_subject = db.Column(db.String(255), default='📊 Rapport journalier - {date}')
    
    # ✅ Email Templates - HTML Bodies
    email_ticket_blocked_template = db.Column(db.Text, nullable=True)
    email_agent_delay_template = db.Column(db.Text, nullable=True)
    email_admin_report_template = db.Column(db.Text, nullable=True)
    
    # ✅ Email Notification Settings
    enable_email_notifications = db.Column(db.Boolean, default=True)
    email_check_interval_hours = db.Column(db.Integer, default=1)

    def __repr__(self):
        return f"<AppConfig warning_delay_days={self.warning_delay_days}, alerts_email={self.alerts_email}, max_upload_size_mb={self.max_upload_size_mb}, auto_archive_days={self.auto_archive_days}>"
    
    @staticmethod
    def get_config():
        """
        Récupérer la configuration (singleton pattern)
        Crée une configuration par défaut si elle n'existe pas
        """
        config = AppConfig.query.first()
        if not config:
            config = AppConfig()
            db.session.add(config)
            db.session.commit()
        return config
