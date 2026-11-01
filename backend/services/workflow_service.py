from models.chronologie import Chronologie
from models.milestone import Milestone
from models.ticket import Ticket
from extensions import db
from utils.constants import (
    VALID_TRANSITIONS, 
    ATTESTATION_WORKFLOW_MILESTONES, 
    CORRECTION_WORKFLOW_MILESTONES
)
from datetime import datetime
from typing import Optional
import logging
from typing import Optional, Tuple
logger = logging.getLogger(__name__)


class WorkflowValidator:
    """Handles all workflow validation logic"""
    
    @staticmethod
    def validate_correction_workflow(ticket: Ticket, current_code: str, next_code: str) -> None:
        """Validate transitions related to document correction workflow"""
        from services.document_service import DocumentService
        
        if current_code not in ["CREATED", "DOSSIER_EN_COURS"]:
            return
            
        auto_validated_status = DocumentService.check_auto_validated_documents_status(ticket)
        
        if auto_validated_status["has_invalidated"] and next_code != "ATTENTE_CORRECTION_DOCS":
            raise ValueError(
                f"Cannot transition to {next_code}. "
                f"Documents requiring correction: {', '.join(auto_validated_status['invalidated_docs'])}. "
                f"Must transition to ATTENTE_CORRECTION_DOCS first."
            )
    
    @staticmethod
    def validate_attestation_workflow(ticket: Ticket, current_code: str, next_code: str) -> None:
        """Validate transitions related to attestation workflow"""
        if current_code != "CREATED":
            return
        
        if ticket.diploma_validation_type == "ATTESTATION":
            if next_code == "DOSSIER_EN_COURS":
                raise ValueError(
                    "Cannot transition directly to DOSSIER_EN_COURS with ATTESTATION validation type. "
                    "Must go through diploma validation workflow."
                )
        elif ticket.diploma_validation_type == "DIPLOMA":
            if next_code in ATTESTATION_WORKFLOW_MILESTONES:
                raise ValueError(
                    f"Cannot use milestone {next_code} with DIPLOMA validation type."
                )
    
    @staticmethod
    def validate_diploma_type_restriction(ticket: Ticket, next_code: str) -> None:
        """Prevent transitions to ATTESTATION milestones when type is DIPLOMA"""
        if ticket.diploma_validation_type == "DIPLOMA" and next_code in ATTESTATION_WORKFLOW_MILESTONES:
            raise ValueError(
                f"Cannot transition to {next_code} with DIPLOMA validation type. "
                f"Change validation type to ATTESTATION first."
            )
    
    @staticmethod
    def validate_documents_completion(ticket: Ticket, current_code: str, next_code: str) -> None:
        """Validate that all documents are complete before moving to PIECES_COMPLETES"""
        from services.document_service import DocumentService
        
        if current_code == "DOSSIER_EN_COURS" and next_code == "PIECES_COMPLETES":
            if not DocumentService.check_documents_completion(ticket):
                missing_docs = DocumentService.get_missing_documents(ticket)
                raise ValueError(
                    f"Cannot transition to PIECES_COMPLETES. "
                    f"Missing or unvalidated documents: {', '.join(missing_docs)}"
                )
    
    @staticmethod
    def validate_transition_allowed(current_code: str, next_code: str) -> None:
        """Validate that the transition is allowed according to VALID_TRANSITIONS"""
        if next_code not in VALID_TRANSITIONS.get(current_code, []):
            raise ValueError(f"Transition interdite: {current_code} → {next_code}")


class WorkflowNotifier:
    """Handles all workflow notifications.

    These messages are written to the student ("Votre dossier..."), so they go
    to the student's account. ticket.user_id is the agent in charge.
    """

    @staticmethod
    def _student_user_id(ticket: Ticket):
        """The student's account, or None when the student has not signed up yet"""
        return ticket.student.user_id if ticket.student else None
    
    NOTIFICATION_CONFIGS = {
        "ATTENTE_DIPLOME": {
            "type": "warning",
            "title": "Diplôme requis",
            "message": "Votre attestation a été validée. Veuillez déposer votre diplôme complet pour continuer le traitement de votre dossier."
        },
        "DIPLOME_DEPOSE": {
            "type": "info",
            "title": "Diplôme reçu",
            "message": "Votre diplôme a été reçu. Il sera prochainement envoyé au centre universitaire pour validation."
        },
        "DIPLOME_ENVOYE_CENTRE": {
            "type": "info",
            "title": "Diplôme envoyé au centre",
            "message": "Votre diplôme a été envoyé au centre universitaire pour validation. Vous serez notifié dès réception de la validation."
        },
        "VALIDATION_CENTRE_RECUE": {
            "type": "success",
            "title": "Diplôme validé",
            "message": "Votre diplôme a été validé par le centre universitaire. Votre dossier peut maintenant progresser."
        },
        "PIECES_COMPLETES": {
            "type": "info",
            "title": "Dossier complet",
            "message": "Toutes les pièces requises ont été validées. Votre dossier est maintenant complet."
        },
        "DOCS_CORRIGES_SOUMIS": {
            "type": "info",
            "title": "Documents corrigés reçus",
            "message": "Vos documents corrigés ont été reçus et sont en cours de validation."
        }
    }
    
    @staticmethod
    def send_notification(ticket: Ticket, milestone_code: str, **kwargs) -> None:
        """Send notification based on milestone code"""
        from services.notification_service import NotificationService
        
        config = WorkflowNotifier.NOTIFICATION_CONFIGS.get(milestone_code)
        recipient = WorkflowNotifier._student_user_id(ticket)
        if not config or recipient is None:
            return
        
        # Format message with additional context if provided
        message = config["message"].format(**kwargs) if kwargs else config["message"]
        
        NotificationService.create_notification(
            user_id=recipient,
            ticket_id=ticket.id,
            type=config["type"],
            title=config["title"],
            message=message
        )
    
    @staticmethod
    def send_correction_notification(ticket: Ticket, invalidated_docs: list) -> None:
        """Send notification for document correction"""
        from services.notification_service import NotificationService

        recipient = WorkflowNotifier._student_user_id(ticket)
        if recipient is None:
            return
        NotificationService.create_notification(
            user_id=recipient,
            ticket_id=ticket.id,
            type="warning",
            title="Correction de documents requise",
            message=f"{len(invalidated_docs)} document(s) nécessite(nt) une correction: "
                   f"{', '.join(invalidated_docs)}. Veuillez soumettre les versions corrigées."
        )
    
    @staticmethod
    def send_diploma_type_change_notification(ticket: Ticket) -> None:
        """Send notification when diploma type is auto-changed"""
        from services.notification_service import NotificationService

        recipient = WorkflowNotifier._student_user_id(ticket)
        if recipient is None:
            return
        NotificationService.create_notification(
            user_id=recipient,
            ticket_id=ticket.id,
            type="success",
            title="Diplôme validé par le centre",
            message="Votre diplôme a été validé par le centre universitaire. "
                   "Le type de validation a été automatiquement changé en Diplôme."
        )

    @staticmethod
    def send_correction_email(ticket: Ticket) -> None:
        """Email the student that the dossier is blocked until documents are corrected"""
        from services.email_service import EmailService
        from services.document_service import DocumentValidator

        student = ticket.student
        if not student:
            return
        student_email = student.email or (student.user.email if student.user else None)
        if not student_email:
            logger.info(f"No email for student of ticket {ticket.reference}; skipping blocked email")
            return

        reasons = [
            f"{doc.document_type}: {doc.validation_comment}" if doc.validation_comment else doc.document_type
            for doc in ticket.documents
            if DocumentValidator.is_auto_validated_document(doc.document_type) and doc.is_validated is False
        ]

        EmailService.send_ticket_blocked_notification(
            student_email=student_email,
            student_name=f"{student.first_name} {student.last_name}",
            ticket_reference=ticket.reference,
            ticket_id=ticket.id,
            reason="Documents à corriger : " + ", ".join(reasons) if reasons else "Documents à corriger"
        )

class ChronologyManager:
    """Manages chronology entries for tickets"""
    
    @staticmethod
    def find_existing_chronology(ticket: Ticket, milestone_id: int) -> Optional[Chronologie]:
        """
        Find existing chronology for the same milestone
        
        Returns:
            Existing chronology or None
        """
        return Chronologie.query.filter_by(
            ticket_id=ticket.id,
            milestone_id=milestone_id
        ).first()
    
    @staticmethod
    def close_current_chronology(ticket: Ticket, changed_at: datetime = None) -> None:
        """Close the current active chronology"""
        last_chrono = Chronologie.query.filter_by(
            ticket_id=ticket.id,
            ended_at=None
        ).first()

        if last_chrono:
            date_time = changed_at if changed_at is not None else datetime.utcnow()
            last_chrono.ended_at = date_time
            last_chrono.completed_at = date_time
            last_chrono.status = "DONE"
            logger.debug("Closing chronology %s (%s)", last_chrono.milestone.code, last_chrono.status)
            
            db.session.flush()
            logger.info(
                f"Closed chronology {last_chrono.id} for ticket {ticket.reference} "
                f"(milestone: {last_chrono.milestone.code}, status: DONE)"
            )
    
    @staticmethod
    def create_or_update_chronology(
        ticket: Ticket,
        milestone_id: int,
        performed_by: int,
        started_at: Optional[datetime] = None,
        comment: Optional[str] = None
    ) -> Tuple[Chronologie, bool]:
        """
        Create new chronology or update existing one
    
        Returns:
            Tuple of (chronology, is_new)
        """
        # Check if chronology already exists for this milestone
        existing = Chronologie.query.filter_by(
            ticket_id=ticket.id,
            milestone_id=milestone_id
        ).first()
        if existing:
            # Override existing chronology
            logger.info(
                f"Found existing chronology {existing.id} for milestone {milestone_id} "
                f"on ticket {ticket.reference}. Overriding..."
            )
            
            # Update fields
            existing.performed_by = performed_by
            existing.started_at = started_at or datetime.utcnow()
            existing.comment = comment
            existing.ended_at = None
            existing.completed_at = None
            existing.status = "PENDING"
            
            logger.info(
                f"Updated chronology {existing.id}: "
                f"started_at={existing.started_at}, comment={comment}, status=PENDING"
            )
            
            return existing, False
        else:
            # ✅ Create new chronology
            chronology = Chronologie(
                ticket_id=ticket.id,
                milestone_id=milestone_id,
                performed_by=performed_by,
                started_at=started_at or datetime.utcnow(),
                comment=comment,
                status="PENDING"
            )
            
            logger.info(
                f"Created new chronology for ticket {ticket.reference}: "
                f"milestone_id={milestone_id}, started_at={chronology.started_at}"
            )
            
            return chronology, True

class WorkflowManager:
    """Manages workflow state transitions"""

    @staticmethod
    def update_ticket_status(ticket: Ticket, milestone_code: str) -> None:
        """Update ticket status based on milestone"""
        if milestone_code == "DOSSIER_CLOTURE":
            ticket.status = "COMPLETED"
        elif milestone_code == "CREATED":
            ticket.status = "OPEN"
        else:
            ticket.status = "PENDING"
        
        ticket.updated_at = datetime.utcnow()
    
    @staticmethod
    def handle_diploma_type_auto_change(ticket: Ticket, next_code: str) -> None:
        """Auto-change diploma type to DIPLOMA when reaching VALIDATION_CENTRE_RECUE"""
        if next_code == "VALIDATION_CENTRE_RECUE" and ticket.diploma_validation_type == "ATTESTATION":
            ticket.diploma_validation_type = "DIPLOMA"
            logger.info(f"Auto-changed diploma_validation_type to DIPLOMA for ticket {ticket.reference}")
            WorkflowNotifier.send_diploma_type_change_notification(ticket)


# ============================================================================
# PUBLIC API
# ============================================================================

def can_transition(current: str, next_state: str) -> bool:
    """Check if a transition is allowed"""
    return next_state in VALID_TRANSITIONS.get(current, [])


def get_next_milestone_for_attestation(ticket: Ticket) -> Optional[str]:
    """Determine the next milestone based on diploma validation type"""
    current_milestone = Milestone.query.get(ticket.current_milestone_id)
    
    if ticket.diploma_validation_type == "ATTESTATION" and current_milestone.code == "CREATED":
        return "ATTENTE_DIPLOME"
    
    return None


def update_status(
    ticket: Ticket, 
    next_state_code: str, 
    performed_by: int,
    changed_at: Optional[datetime] = None,
    comment: Optional[str] = None
) -> Ticket:
    """
    Update ticket status with comprehensive validation and notification
    
    Args:
        ticket: The ticket to update
        next_state_code: The target milestone code
        performed_by: User ID performing the action
        changed_at: Optional datetime for the milestone change (default: now)
        comment: Optional comment for the milestone change
        
    Returns:
        Updated ticket instance
        
    Raises:
        ValueError: If transition is not allowed
    """
    from services.document_service import DocumentService
    from services.audit_service import AuditService
    
    current_milestone = Milestone.query.get(ticket.current_milestone_id)
    current_code = current_milestone.code
    
    # ============================================================================
    # VALIDATION PHASE
    # ============================================================================
    validator = WorkflowValidator()
    
    # Validate correction workflow
    validator.validate_correction_workflow(ticket, current_code, next_state_code)
    
    # Validate attestation workflow
    validator.validate_attestation_workflow(ticket, current_code, next_state_code)
    
    # Validate diploma type restrictions
    validator.validate_diploma_type_restriction(ticket, next_state_code)
    
    # Validate documents completion
    validator.validate_documents_completion(ticket, current_code, next_state_code)
    
    # Validate transition is allowed
    validator.validate_transition_allowed(current_code, next_state_code)
    
    # ============================================================================
    # TRANSITION PHASE
    # ============================================================================
    manager = WorkflowManager()
    chrono_manager = ChronologyManager()
    
    # Handle auto-change of diploma type
    manager.handle_diploma_type_auto_change(ticket, next_state_code)
    
    # Get next milestone
    next_milestone = Milestone.query.filter_by(code=next_state_code).first_or_404()
    
    # Close current chronology (only if different from target)
    if current_milestone.id != next_milestone.id:
        chrono_manager.close_current_chronology(ticket, changed_at)

    # Create or update chronology (with override logic)
    chronologie, is_new = chrono_manager.create_or_update_chronology(
        ticket=ticket,
        milestone_id=next_milestone.id,
        performed_by=performed_by,
        started_at=changed_at,
        comment=comment
    )
    # Ne pas ajouter si déjà existant
    if is_new:
        db.session.add(chronologie)
    
    # Update ticket
    ticket.current_milestone_id = next_milestone.id
    manager.update_ticket_status(ticket, next_state_code)
    
    # ============================================================================
    # NOTIFICATION PHASE
    # ============================================================================
    notifier = WorkflowNotifier()
    
    # Send standard notification
    notifier.send_notification(ticket, next_state_code)
    
    # Special handling for correction workflow
    if next_state_code == "ATTENTE_CORRECTION_DOCS":
        auto_validated_status = DocumentService.check_auto_validated_documents_status(ticket)
        notifier.send_correction_notification(ticket, auto_validated_status['invalidated_docs'])
    
    # Special handling for pieces completes (with audit)
    if next_state_code == "PIECES_COMPLETES":
        AuditService.log_action(
            action="MILESTONE_UPDATE",
            entity_type="TICKET",
            entity_id=ticket.id,
            performed_by=performed_by,
            description=f"All required documents validated - transitioned to {next_state_code}"
        )
    
    # ============================================================================
    # COMMIT PHASE
    # ============================================================================
    all_chronos = Chronologie.query.filter_by(ticket_id=ticket.id).all()
    logger.debug(f"All chronologies for ticket {ticket.reference}:")
    for chrono in all_chronos:
        logger.debug(
            f"  - ID: {chrono.id}, Milestone: {chrono.milestone.code}, "
            f"Status: {chrono.status}, Started: {chrono.started_at}, "
            f"Ended: {chrono.ended_at}"
        )
    
    db.session.commit()
    logger.debug("Chronology %s new=%s status=%s", chronologie.milestone.code, is_new, chronologie.status)

    # Emails are sent after the commit so an SMTP problem never rolls back
    # the transition (send_email logs and returns False on failure)
    if next_state_code == "ATTENTE_CORRECTION_DOCS":
        notifier.send_correction_email(ticket)

    # Log avec information sur création/mise à jour
    action = "created" if is_new else "updated"
    logger.info(
        f"Ticket {ticket.reference} transitioned: {current_code} → {next_state_code} "
        f"(chronology {action})"
    )

    return ticket
