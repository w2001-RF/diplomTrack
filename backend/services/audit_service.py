import os
from models.audit_log import AuditLog
from extensions import db
from datetime import datetime
from flask import request

LOG_DIR = "logs"
os.makedirs(LOG_DIR, exist_ok=True)

class AuditService:
    @staticmethod
    def log_action(
        action: str,
        entity_type: str,
        entity_id: int = None,
        performed_by: int = None,
        description: str = None
    ):
        """
        Generic audit logger
        """

        ip_address = None
        route = None

        try:
            route = request.path
            ip_address = request.remote_addr
        except RuntimeError:
            # Called outside HTTP context (cron, tests)
            route = "SYSTEM"

        log = AuditLog(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            performed_by=performed_by,
            description=description,
            route=route,
            ip_address=ip_address
        )

        db.session.add(log)
        db.session.commit()

        AuditService._log_to_file(
            action, 
            route, 
            performed_by if performed_by is not None else "SYSTEM"
        )

        return log
    
    @staticmethod
    def _log_to_file(action, route, user_id):
        filename = route.strip("/").replace("/", "_") or "system"
        filepath = os.path.join(LOG_DIR, f"{filename}.log")

        with open(filepath, "a", encoding="utf-8") as f:
            f.write(
                f"[{datetime.utcnow()}] "
                f"user={user_id} action={action}\n"
            )