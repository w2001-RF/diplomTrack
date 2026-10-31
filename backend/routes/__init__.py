from .ticket_routes import ticket_bp
from .admin_routes import admin_bp
from .auth_routes import auth_bp
from .notification_routes import notification_bp
from .student_routes import student_bp
from .document_routes import document_bp
from .data_routes import data_bp
from .email_routes import email_bp

def register_routes(app):
    app.register_blueprint(ticket_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(notification_bp)
    app.register_blueprint(student_bp)
    app.register_blueprint(document_bp)
    app.register_blueprint(data_bp)
    app.register_blueprint(email_bp)
