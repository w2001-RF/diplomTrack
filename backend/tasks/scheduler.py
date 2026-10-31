from apscheduler.schedulers.background import BackgroundScheduler
from services.notification_service import NotificationService
import logging
import os
import tempfile

logger = logging.getLogger(__name__)

# Garde le fichier de verrou ouvert : le verrou dure tant que le process vit
_lock_file = None


def _acquire_scheduler_lock(path):
    """
    Verrou exclusif non bloquant sur un fichier. Avec Gunicorn (-w N), chaque
    worker appelle create_app() : seul le premier qui obtient le verrou démarre
    le scheduler. Si ce worker meurt, l'OS libère le verrou et le worker
    relancé le reprend.
    """
    global _lock_file
    lock_file = open(path, "a+")
    try:
        if os.name == "nt":
            import msvcrt
            msvcrt.locking(lock_file.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        lock_file.close()
        return False

    _lock_file = lock_file
    return True


def init_scheduler(app):
    """
    Initialise le scheduler pour les tâches planifiées.
    Retourne None si le scheduler est désactivé ou déjà lancé par un autre process.
    """
    if os.getenv("ENABLE_SCHEDULER", "true").lower() != "true":
        logger.info("Scheduler désactivé (ENABLE_SCHEDULER != true)")
        return None

    lock_path = os.getenv(
        "SCHEDULER_LOCK_FILE",
        os.path.join(tempfile.gettempdir(), "diplomtrack-scheduler.lock")
    )
    if not _acquire_scheduler_lock(lock_path):
        logger.info(f"Scheduler déjà actif dans un autre process (pid {os.getpid()} ignoré)")
        return None

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
