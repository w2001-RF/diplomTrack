from datetime import datetime, timedelta
from models.ticket import Ticket
from models.chronologie import Chronologie
from models.milestone import Milestone
from models.notification import Notification
from models.app_config import AppConfig
from extensions import db
from sqlalchemy import and_

class NotificationService:
    @staticmethod
    def check_and_create_delay_warnings():
        """
        Vérifie tous les tickets en EN_ATTENTE_REPONSE et crée des notifications
        si le délai d'avertissement est dépassé
        """
        # Récupérer le délai d'avertissement depuis la config
        config = AppConfig.query.first()
        if not config or not config.warning_delay_days:
            return 0  # Pas de configuration, pas de notifications
        
        warning_delay = config.warning_delay_days
        # Récupérer le milestone EN_ATTENTE_REPONSE
        milestone = Milestone.query.filter_by(code='EN_ATTENTE_REPONSE').first()
        if not milestone:
            return 0  # Milestone non trouvé
        
        # Calculer la date limite
        warning_date = datetime.utcnow() - timedelta(days=warning_delay)
        
        # Récupérer tous les tickets actuellement en EN_ATTENTE_REPONSE.
        # Le milestone courant suffit : le workflow met le statut à PENDING,
        # jamais à IN_PROGRESS.
        tickets = Ticket.query.filter_by(
            current_milestone_id=milestone.id
        ).all()

        notifications_created = 0

        for ticket in tickets:
            # Récupérer la chronologie encore ouverte pour ce milestone
            # (status PENDING, ended_at NULL tant que le ticket y est)
            chronologie = Chronologie.query.filter(
                and_(
                    Chronologie.ticket_id == ticket.id,
                    Chronologie.milestone_id == milestone.id,
                    Chronologie.ended_at.is_(None)
                )
            ).order_by(Chronologie.started_at.desc()).first()
            
            if not chronologie or not chronologie.started_at:
                continue
            
            # Vérifier si le délai est dépassé
            if chronologie.started_at <= warning_date:
                # Vérifier si une notification de délai n'a pas déjà été créée
                # (les autres alertes 'warning' du ticket ne comptent pas)
                last_notification = Notification.query.filter(
                    and_(
                        Notification.ticket_id == ticket.id,
                        Notification.user_id == ticket.user_id,
                        Notification.type == 'warning',
                        Notification.title.like('%Délai dépassé%')
                    )
                ).order_by(Notification.created_at.desc()).first()
                
                # Ne créer une nouvelle notification que si:
                # - Aucune notification n'existe
                # - OU la dernière notification date de plus de 24h
                should_create = (
                    not last_notification or 
                    (datetime.utcnow() - last_notification.created_at).days >= 1
                )
                
                if should_create:
                    days_exceeded = (datetime.utcnow() - chronologie.started_at).days - warning_delay
                    
                    notification = Notification(
                        user_id=ticket.user_id,
                        ticket_id=ticket.id,
                        type='warning',
                        title=f'⚠️ Délai dépassé - {ticket.reference}',
                        message=f'Le ticket {ticket.reference} est en attente de réponse depuis {days_exceeded} jours au-delà du délai d\'avertissement ({warning_delay} jours).',
                        is_read=False
                    )
                    
                    db.session.add(notification)
                    notifications_created += 1
        
        if notifications_created > 0:
            db.session.commit()
            print(f"{notifications_created} notification(s) de délai créée(s)")
        
        return notifications_created
    
    @staticmethod
    def create_notification(user_id: int, ticket_id: int, title: str, type: str, message: str) -> Notification:
        notification = Notification(
            user_id=user_id,
            ticket_id=ticket_id,
            title=title,
            type=type,
            message=message
        )

        db.session.add(notification)
        db.session.commit()
        return notification

    @staticmethod
    def get_user_notifications(user_id: int, unread_only: bool = False):
        query = Notification.query.filter_by(user_id=user_id)

        if unread_only:
            query = query.filter_by(is_read=False)

        return query.order_by(Notification.created_at.desc()).all()

    @staticmethod
    def mark_as_read(notification_id: int, user_id: int) -> Notification:
        notification = Notification.query.filter_by(
            id=notification_id,
            user_id=user_id
        ).first_or_404()

        notification.is_read = True
        db.session.commit()
        return notification

    @staticmethod
    def mark_all_as_read(user_id: int) -> int:
        updated = Notification.query.filter_by(
            user_id=user_id,
            is_read=False
        ).update({"is_read": True})

        db.session.commit()
        return updated

    @staticmethod
    def delete_notification(notification_id: int, user_id: int) -> None:
        notification = Notification.query.filter_by(
            id=notification_id,
            user_id=user_id
        ).first_or_404()

        db.session.delete(notification)
        db.session.commit()

    @staticmethod
    def delete_all_user_notifications(user_id):
        """
        Delete all notifications for a specific user
        
        Args:
            user_id (int): The user ID
            
        Returns:
            int: Number of notifications deleted
        """
        try:
            # Récupérer toutes les notifications de l'utilisateur
            notifications = Notification.query.filter_by(user_id=user_id).all()
            count = len(notifications)
            
            # Supprimer toutes les notifications
            for notification in notifications:
                db.session.delete(notification)
                
            db.session.commit()
            return count
        except Exception as e:
            db.session.rollback()
            raise e
