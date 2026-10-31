from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt

from utils.permissions import require_roles
from services.notification_service import NotificationService

notification_bp = Blueprint(
    "notifications",
    __name__,
    url_prefix="/api/notifications"
)


# =========================================================
# GET CURRENT USER ID FROM JWT
# =========================================================

def _current_user_id():
    return get_jwt()["user_id"]


# =========================================================
# ROUTES
# =========================================================

@notification_bp.route("", methods=["GET"])
@jwt_required()
def list_notifications():
    """
    Get all notifications for current user
    Optional: ?unread=true
    """
    unread_only = request.args.get("unread") == "true"
    user_id = _current_user_id()

    notifications = NotificationService.get_user_notifications(
        user_id=user_id,
        unread_only=unread_only
    )

    return [
        {
            "id": n.id,
            "user_id": n.user_id,
            "ticket_id": n.ticket_id,
            "type": n.type,
            "title": n.title,
            "message": n.message,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat()
        }
        for n in notifications
    ]


@notification_bp.route("/<int:notification_id>/read", methods=["PATCH"])
@jwt_required()
def mark_notification_read(notification_id):
    """
    Mark a notification as read
    """
    user_id = _current_user_id()

    notification = NotificationService.mark_as_read(
        notification_id=notification_id,
        user_id=user_id
    )

    return {
        "message": "Notification marked as read",
        "notification_id": notification.id
    }


@notification_bp.route("/read-all", methods=["PATCH"])
@jwt_required()
def mark_all_read():
    """
    Mark all notifications as read
    """
    user_id = _current_user_id()
    count = NotificationService.mark_all_as_read(user_id)

    return {
        "message": "All notifications marked as read",
        "updated": count
    }


@notification_bp.route("/<int:notification_id>", methods=["DELETE"])
@jwt_required()
def delete_notification(notification_id):
    """
    Delete a notification
    """
    user_id = _current_user_id()
    NotificationService.delete_notification(notification_id, user_id)

    return {
        "message": "Notification deleted"
    }, 204

@notification_bp.route("/delete-all", methods=["DELETE"])
@jwt_required()
def delete_all_notifications():
    """
    Delete all notifications for the current user
    """
    user_id = _current_user_id()
    count = NotificationService.delete_all_user_notifications(user_id)

    return {
        "message": f"All notifications deleted for user",
        "deleted_count": count
    }, 200


@notification_bp.route("/check-delays", methods=["POST"])
@jwt_required()
@require_roles("ADMIN")
def manual_check_delays():
    """
    Déclencher manuellement la vérification des délais (ADMIN uniquement)
    """
    try:
        count = NotificationService.check_and_create_delay_warnings()
        return {
            "message": f"{count} notification(s) créée(s)",
            "count": count
        }, 200
    except Exception as e:
        return {"message": f"Erreur: {str(e)}"}, 500
