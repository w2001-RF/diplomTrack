from apscheduler.schedulers.background import BackgroundScheduler
from services.notification_service import NotificationService
import logging

logger = logging.getLogger(__name__)

def init_scheduler(app):
    """
    Initialise le scheduler pour les tâches planifiées
    """
    scheduler = BackgroundScheduler()
    
    # Vérifier les délais toutes les heures
    scheduler.add_job(
        func=check_delay_warnings,
        args=[app],
        trigger="interval",
        hours=1,
        id='check_delay_warnings',
        name='Vérification des délais dépassés',
        replace_existing=True
    )
    
    # Ou vérifier tous les jours à 9h00
    # scheduler.add_job(
    #     func=check_delay_warnings,
    #     trigger="cron",
    #     hour=9,
    #     minute=0,
    #     id='check_delay_warnings',
    #     name='Vérification quotidienne des délais',
    #     replace_existing=True
    # )
    
    scheduler.start()
    logger.info("Scheduler démarré avec succès")
    
    return scheduler

def check_delay_warnings(app):
    """
    Fonction wrapper pour la vérification des délais.
    Le job tourne dans un thread APScheduler : il faut pousser un
    contexte applicatif pour accéder à la base de données.
    """
    try:
        logger.info("Début de la vérification des délais...")
        with app.app_context():
            count = NotificationService.check_and_create_delay_warnings()
        logger.info(f"Vérification terminée. {count} notification(s) créée(s)")
    except Exception as e:
        logger.error(f"Erreur lors de la vérification des délais: {str(e)}")
