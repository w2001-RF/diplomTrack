# routes/email_routes.py
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from services.email_service import EmailService
from utils.permissions import require_roles

email_bp = Blueprint("emails", __name__, url_prefix="/api/emails")

@email_bp.route("/test-connection", methods=["GET"])
@jwt_required()
@require_roles("ADMIN")
def test_smtp_connection():
    """
    Tester la connexion SMTP (ADMIN uniquement)
    """
    try:
        success = EmailService.test_smtp_connection()
        if success:
            return {
                "message": "✅ Connexion SMTP réussie",
                "status": "success"
            }, 200
        else:
            return {
                "message": "❌ Échec de la connexion SMTP. Vérifiez les logs.",
                "status": "error"
            }, 500
    except Exception as e:
        return {
            "message": f"❌ Erreur: {str(e)}",
            "status": "error"
        }, 500

@email_bp.route("/test-send", methods=["POST"])
@jwt_required()
@require_roles("ADMIN")
def test_email_send():
    """
    Tester l'envoi d'un email (ADMIN uniquement)
    """
    try:
        success = EmailService.test_email_configuration()
        if success:
            return {
                "message": "✅ Email de test envoyé avec succès",
                "status": "success"
            }, 200
        else:
            return {
                "message": "❌ Échec de l'envoi de l'email. Vérifiez les logs.",
                "status": "error"
            }, 500
    except Exception as e:
        return {
            "message": f"❌ Erreur: {str(e)}",
            "status": "error"
        }, 500
