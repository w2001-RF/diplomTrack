import uuid
import logging
from typing import Optional, Dict, List, Any
from sqlalchemy.orm import joinedload
from datetime import datetime
from models.ticket import Ticket
from models.milestone import Milestone
from models.chronologie import Chronologie
from models.student import Student
from models.formation import Formation
from models.document import Document
from services.workflow_service import update_status, WorkflowNotifier
from services.notification_service import NotificationService
from extensions import db
from utils.constants import DocumentType

logger = logging.getLogger(__name__)


# ============================================================================
# FORMATTERS
# ============================================================================

class TicketFormatter:
    """Handles ticket data formatting for API responses"""
    
    @staticmethod
    def format_professor(professor) -> Optional[Dict[str, Any]]:
        """Format professor data with department and grade"""
        if not professor:
            return None
        
        professor_data = {
            "id": professor.id,
            "first_name": professor.first_name,
            "last_name": professor.last_name,
            "email": getattr(professor, "email", None),
            "phone": getattr(professor, "phone", None),
        }
        
        # Add department if exists
        departement = getattr(professor, "departement", None)
        if departement:
            professor_data["departement"] = {
                "id": departement.id,
                "name": departement.departement_name
            }
        
        # Add grade if exists
        grade = getattr(professor, "grade", None)
        if grade:
            professor_data["grade"] = {
                "id": grade.id,
                "name": grade.name,
                "code": grade.code,
            }
        
        return professor_data
    
    @staticmethod
    def format_formation(formation) -> Optional[Dict[str, Any]]:
        """Format formation data with type and professors"""
        if not formation:
            return None
        
        formation_type = getattr(formation, "formation_type", None)
        formation_type_data = None
        if formation_type:
            formation_type_data = {
                "id": formation_type.id,
                "code": formation_type.code,
                "label": formation_type.label,
            }
        
        return {
            "id": formation.id,
            "formation_name": formation.formation_name,
            "description": formation.description,
            "formation_type": formation_type_data,
            "professor_responsible": TicketFormatter.format_professor(
                getattr(formation, "professor_responsible", None)
            ),
            "contact_professor": TicketFormatter.format_professor(
                getattr(formation, "contact_professor", None)
            ),
        }
    
    @staticmethod
    def format_student(student) -> Optional[Dict[str, Any]]:
        """Format student data with formation"""
        if not student:
            return None
        
        return {
            "id": student.id,
            "first_name": student.first_name,
            "last_name": student.last_name,
            "email": student.email,
            "num_apogee": student.num_apogee,
            "academic_year": student.academic_year,
            "user_id": student.user_id,
            "formation": TicketFormatter.format_formation(
                getattr(student, "formation", None)
            ),
        }
    
    @staticmethod
    def format_documents(documents: List) -> List[Dict[str, Any]]:
        """Format documents list"""
        return [{
            "id": d.id,
            "document_type": d.document_type,
            "file_path": d.file_path,
            "is_validated": bool(getattr(d, "is_validated", False)),
            "validation_comment": getattr(d, "validation_comment", None),
            "validated_by": getattr(d, "validated_by", None),
            "validated_at": getattr(d, "validated_at", None),
            "created_at": getattr(d, "created_at", None),
        } for d in documents]
    
    @staticmethod
    def format_chronologies(chronologies: List) -> List[Dict[str, Any]]:
        """Format chronologies list sorted by started_at"""
        chronologies_sorted = sorted(
            chronologies,
            key=lambda c: (c.started_at is None, c.started_at)
        )
        
        return [{
            "id": c.id,
            "ticket_id": c.ticket_id,
            "milestone_id": c.milestone_id,
            "milestone": Milestone.query.get(c.milestone_id),
            "status": c.status,
            "started_at": c.started_at.isoformat() if getattr(c, "started_at", None) else None,
            "completed_at": getattr(c, "completed_at", None),
            "ended_at": getattr(c, "ended_at", None),
            "comment": getattr(c, "comment", None),
            "blocked_reason": getattr(c, "blocked_reason", None),
            "performed_by": getattr(c, "performed_by", None),
        } for c in chronologies_sorted]
    
    @staticmethod
    def format_ticket(ticket: Ticket) -> Dict[str, Any]:
        """Format complete ticket with all relationships"""
        return {
            "id": ticket.id,
            "reference": ticket.reference,
            "status": ticket.status,
            "user_id": ticket.user_id,
            "created_at": getattr(ticket, "created_at", None),
            "updated_at": getattr(ticket, "updated_at", None),
            "current_milestone_id": ticket.current_milestone_id,
            "current_milestone": Milestone.query.get(ticket.current_milestone_id),
            "diploma_validation_type": ticket.diploma_validation_type,
            "student": TicketFormatter.format_student(getattr(ticket, "student", None)),
            "documents": TicketFormatter.format_documents(
                getattr(ticket, "documents", []) or []
            ),
            "chronologies": TicketFormatter.format_chronologies(
                getattr(ticket, "chronologies", []) or []
            )
        }


# ============================================================================
# DOCUMENT MANAGER
# ============================================================================

class TicketDocumentManager:
    """Manages document creation for tickets"""
    
    @staticmethod
    def create_auto_validated_documents(
        ticket: Ticket, 
        formation_type_code: Optional[str],
        performed_by: int
    ) -> None:
        """Create all required documents with auto-validation"""
        auto_validated_docs = DocumentType.get_auto_validated_docs()
        
        for doc_type in DocumentType.all():
            # Skip documents based on formation type
            if TicketDocumentManager._should_skip_document(doc_type, formation_type_code):
                continue
            
            is_auto_validated = doc_type in auto_validated_docs
            
            document = Document(
                ticket_id=ticket.id,
                document_type=doc_type,
                file_path=None,
                is_validated=is_auto_validated,
                validated_by=performed_by if is_auto_validated else None,
                validated_at=datetime.utcnow() if is_auto_validated else None,
                validation_comment=(
                    "Document validé automatiquement lors de la création du dossier" 
                    if is_auto_validated else None
                )
            )
            
            db.session.add(document)
    
    @staticmethod
    def create_imported_documents(
        ticket: Ticket,
        documents_data: List[Dict],
        formation_type_code: Optional[str],
        performed_by: int
    ) -> None:
        """Create documents from import data"""
        auto_validated_docs = DocumentType.get_auto_validated_docs()
        
        for doc_type in DocumentType.all():
            # Skip documents based on formation type
            if TicketDocumentManager._should_skip_document(doc_type, formation_type_code):
                continue
            
            # Find matching document data
            doc_data = next(
                (d for d in documents_data if d.get("document_type") == doc_type),
                None
            )
            
            # Determine validation status
            is_auto_validated = doc_type in auto_validated_docs
            
            if doc_data:
                is_validated = doc_data.get("is_validated", is_auto_validated)
                validation_comment = doc_data.get("validation_comment")
            else:
                is_validated = is_auto_validated
                validation_comment = (
                    "Document validé automatiquement lors de la création du dossier" 
                    if is_auto_validated else None
                )
            
            document = Document(
                ticket_id=ticket.id,
                document_type=doc_type,
                file_path=None,
                is_validated=is_validated,
                validation_comment=validation_comment,
                validated_by=performed_by if is_validated else None,
                validated_at=datetime.utcnow() if is_validated else None
            )
            
            db.session.add(document)
    
    @staticmethod
    def _should_skip_document(doc_type: str, formation_type_code: Optional[str]) -> bool:
        """Determine if a document should be skipped based on formation type"""
        if doc_type == DocumentType.BAC_PLUS_2 and formation_type_code == "MUS":
            return True
        if doc_type == DocumentType.BAC_PLUS_3 and formation_type_code == "LUS":
            return True
        return False


# ============================================================================
# CHRONOLOGY MANAGER
# ============================================================================

class ChronologyManager:
    """Manages chronology creation for tickets"""
    
    @staticmethod
    def create_initial_chronology(
        ticket: Ticket, 
        milestone: Milestone, 
        performed_by: int,
        started_at: Optional[datetime] = None,
        comment: Optional[str] = None
    ) -> None:
        """Create initial chronology for new ticket"""
        chronologie = Chronologie(
            ticket_id=ticket.id,
            milestone_id=milestone.id,
            performed_by=performed_by,
            started_at=started_at or datetime.utcnow(),
            comment=comment
        )
        db.session.add(chronologie)
    
    @staticmethod
    def create_import_chronologies(
        ticket: Ticket,
        target_milestone: Milestone,
        performed_by: int
    ) -> None:
        """Create chronologies from first milestone to target milestone"""
        milestones = Milestone.query.order_by(Milestone.order.asc()).all()
        
        target_index = next(
            (i for i, m in enumerate(milestones) if m.id == target_milestone.id),
            0
        )
        
        # Create chronologies for all milestones up to and including target
        for i in range(target_index + 1):
            is_completed = i < target_index
            
            chronologie = Chronologie(
                ticket_id=ticket.id,
                milestone_id=milestones[i].id,
                performed_by=performed_by,
                status="COMPLETED" if is_completed else "IN_PROGRESS"
            )
            
            if is_completed:
                chronologie.ended_at = datetime.utcnow()
            
            db.session.add(chronologie)


# ============================================================================
# STUDENT MANAGER
# ============================================================================

class StudentManager:
    """Manages student creation and updates"""
    
    @staticmethod
    def get_or_create_student(student_data: Dict[str, Any]) -> Student:
        """Get existing student or create new one"""
        email = student_data.get("email")
        num_apogee = student_data.get("num_apogee")
        
        if not email:
            raise ValueError("Student email is required")
        
        # Try to find existing student
        student = StudentManager._find_existing_student(email, num_apogee)
        
        if student:
            StudentManager._update_student(student, student_data)
            logger.info(f"Updated existing student: {email} (ID: {student.id})")
            return student
        
        # Create new student
        student = StudentManager._create_new_student(student_data)
        logger.info(f"Created new student: {email} (ID: {student.id}) without user account")
        
        return student
    
    @staticmethod
    def _find_existing_student(email: str, num_apogee: Optional[int]) -> Optional[Student]:
        """Find student by email or num_apogee"""
        student = Student.query.filter_by(email=email).first()
        
        if not student and num_apogee:
            student = Student.query.filter_by(num_apogee=num_apogee).first()
        
        return student
    
    @staticmethod
    def _update_student(student: Student, student_data: Dict[str, Any]) -> None:
        """Update existing student information"""
        if student_data.get("first_name"):
            student.first_name = student_data["first_name"]
        if student_data.get("last_name"):
            student.last_name = student_data["last_name"]
        if student_data.get("academic_year"):
            student.academic_year = student_data["academic_year"]
        if student_data.get("formation_id"):
            student.formation_id = student_data["formation_id"]
        
        db.session.commit()
    
    @staticmethod
    def _create_new_student(student_data: Dict[str, Any]) -> Student:
        """Create new student without user account"""
        formation_id = student_data.get("formation_id")
        
        # Verify formation exists
        if formation_id:
            formation = Formation.query.get(formation_id)
            if not formation:
                raise ValueError(f"Formation with id {formation_id} not found")
        
        student = Student(
            first_name=student_data.get("first_name", ""),
            last_name=student_data.get("last_name", ""),
            email=student_data.get("email"),
            num_apogee=student_data.get("num_apogee"),
            academic_year=student_data.get("academic_year", ""),
            formation_id=formation_id,
            user_id=None
        )
        
        db.session.add(student)
        db.session.flush()
        
        # Load formation with relationships
        if formation_id:
            db.session.refresh(student)
            formation = Formation.query.options(
                joinedload(Formation.formation_type),
                joinedload(Formation.professor_responsible),
                joinedload(Formation.contact_professor)
            ).get(formation_id)
            if formation:
                student.formation = formation
        
        return student


# ============================================================================
# DIPLOMA VALIDATION MANAGER
# ============================================================================

class DiplomaValidationManager:
    """Manages diploma validation type transitions"""
    
    ATTESTATION_MILESTONES = [
        "ATTENTE_DIPLOME", 
        "DIPLOME_DEPOSE", 
        "DIPLOME_ENVOYE_CENTRE", 
        "VALIDATION_CENTRE_RECUE"
    ]
    
    @staticmethod
    def handle_type_change(
        ticket: Ticket,
        new_type: str,
        previous_type: str,
        performed_by: int
    ) -> None:
        """Handle automatic transitions when validation type changes"""
        if new_type == "DIPLOMA" and previous_type == "ATTESTATION":
            DiplomaValidationManager._handle_diploma_transition(ticket, performed_by)
        elif new_type == "ATTESTATION" and previous_type != "ATTESTATION":
            DiplomaValidationManager._handle_attestation_transition(ticket, performed_by)
    
    @staticmethod
    def _handle_diploma_transition(ticket: Ticket, performed_by: int) -> None:
        """Transition to CREATED when changing to DIPLOMA from ATTESTATION workflow"""
        current_milestone = Milestone.query.get(ticket.current_milestone_id)
        
        if current_milestone.code in DiplomaValidationManager.ATTESTATION_MILESTONES:
            try:
                update_status(ticket, "CREATED", performed_by)
                
                NotificationService.create_notification(
                    user_id=ticket.user_id,
                    ticket_id=ticket.id,
                    type="info",
                    title="Type de validation changé",
                    message="Le type de validation a été changé en Diplôme. "
                           "Votre dossier a été réinitialisé."
                )
                
                logger.info(f"Auto-transitioned ticket {ticket.reference} to CREATED (DIPLOMA type)")
                
            except Exception as e:
                logger.error(f"Failed to auto-transition to CREATED: {str(e)}")
    
    @staticmethod
    def _handle_attestation_transition(ticket: Ticket, performed_by: int) -> None:
        """Transition to ATTENTE_DIPLOME when changing to ATTESTATION"""
        current_milestone = Milestone.query.get(ticket.current_milestone_id)
        
        if current_milestone.code == "CREATED":
            try:
                update_status(ticket, "ATTENTE_DIPLOME", performed_by)
                
                NotificationService.create_notification(
                    user_id=ticket.user_id,
                    ticket_id=ticket.id,
                    type="warning",
                    title="Diplôme requis",
                    message="Le type de validation a été changé en ATTESTATION. "
                           "Veuillez déposer votre diplôme complet pour continuer le traitement."
                )
                
                logger.info(f"Auto-transitioned ticket {ticket.reference} to ATTENTE_DIPLOME")
                
            except Exception as e:
                logger.error(f"Failed to auto-transition to ATTENTE_DIPLOME: {str(e)}")


# ============================================================================
# QUERY BUILDER
# ============================================================================

class TicketQueryBuilder:
    """Builds optimized queries with eager loading"""
    
    @staticmethod
    def get_base_query():
        """Get base query with all relationships loaded"""
        return Ticket.query.options(
            joinedload(Ticket.student).joinedload(Student.formation)
                .joinedload(Formation.formation_type),
            joinedload(Ticket.student).joinedload(Student.formation)
                .joinedload(Formation.professor_responsible),
            joinedload(Ticket.student).joinedload(Student.formation)
                .joinedload(Formation.contact_professor),
            joinedload(Ticket.chronologies),
            joinedload(Ticket.documents)
        )
    
    @staticmethod
    def apply_filters(query, agent_id: Optional[int] = None, student_id: Optional[int] = None):
        """Apply filters to query"""
        if agent_id is not None:
            query = query.filter(Ticket.user_id == agent_id)
        
        if student_id is not None:
            query = query.filter(Ticket.student_id == student_id)
        
        return query
    
    @staticmethod
    def apply_sorting(query, sort_field: str = "created_at", sort_order: str = "desc"):
        """Apply sorting to query"""
        sort_col = getattr(Ticket, sort_field, Ticket.created_at)
        
        if sort_order.lower() == "desc":
            return query.order_by(sort_col.desc())
        else:
            return query.order_by(sort_col.asc())


# ============================================================================
# TICKET SERVICE (PUBLIC API)
# ============================================================================

class TicketService:
    """Main service for ticket operations"""
    
    @staticmethod
    def _generate_reference() -> str:
        """Generate unique ticket reference"""
        return f"FC-{uuid.uuid4().hex[:8].upper()}"
    
    # ========================================================================
    # CREATE
    # ========================================================================
    
    @staticmethod
    def create_ticket(
        student_id: int, 
        initial_milestone_code: str, 
        performed_by: int,
        created_at: Optional[datetime] = None,
        comment: Optional[str] = None
    ) -> Dict[str, Any]:
            """Create a new ticket with initial documents"""
            # Get milestone and student
            milestone = Milestone.query.filter_by(code=initial_milestone_code).first_or_404()
            student = Student.query.options(
                joinedload(Student.formation).joinedload(Formation.formation_type)
            ).get_or_404(student_id)
            
            formation_type_code = (
                student.formation.formation_type.code 
                if student.formation and student.formation.formation_type 
                else None
            )
            
            # Create ticket
            ticket = Ticket(
                reference=TicketService._generate_reference(),
                student_id=student_id,
                status="OPEN",
                current_milestone_id=milestone.id,
                user_id=performed_by,
                diploma_validation_type="DIPLOMA"
            )
            
            db.session.add(ticket)
            db.session.flush()
            
            # Create initial chronology
            ChronologyManager.create_initial_chronology(
                ticket, 
                milestone, 
                performed_by,
                started_at=created_at,
                comment=comment
            )
            
            # Create documents
            TicketDocumentManager.create_auto_validated_documents(
                ticket, formation_type_code, performed_by
            )
            
            db.session.commit()
            db.session.refresh(ticket)
            
            return TicketFormatter.format_ticket(ticket)
    
    @staticmethod
    def create_advanced_ticket(
        student_id: int,
        target_milestone_code: str,
        chronologies_data: List[Dict],
        performed_by: int,
        diploma_validation_type: str = "DIPLOMA"
    ) -> Dict[str, Any]:
        """
        Create a new ticket with specific chronologies
        
        Args:
            student_id: ID of the student
            target_milestone_code: Code of the target milestone
            chronologies_data: List of chronology data with milestone_code, dates and comments
            performed_by: ID of the user creating the ticket
            diploma_validation_type: Type of diploma validation (DIPLOMA or ATTESTATION)
            
        Returns:
            Formatted ticket data
        """
        
        # Get milestone and student
        target_milestone = Milestone.query.filter_by(code=target_milestone_code).first_or_404()
        student = Student.query.options(
            joinedload(Student.formation).joinedload(Formation.formation_type)
        ).get_or_404(student_id)
        
        formation_type_code = (
            student.formation.formation_type.code 
            if student.formation and student.formation.formation_type 
            else None
        )
        
        # Get all milestones for validation
        all_milestones = Milestone.query.order_by(Milestone.order.asc()).all()
        milestone_codes = [m.code for m in all_milestones]
        milestone_map = {m.code: m for m in all_milestones}
        
        # Validate chronologies
        for i, chrono_data in enumerate(chronologies_data):
            milestone_code = chrono_data.get("milestone_code")
            
            # Validate milestone exists
            if milestone_code not in milestone_map:
                raise ValueError(f"Invalid milestone code: {milestone_code}")
            
            # Validate chronology order
            if i > 0:
                prev_code = chronologies_data[i-1].get("milestone_code")
                prev_idx = milestone_codes.index(prev_code)
                curr_idx = milestone_codes.index(milestone_code)
                
                if prev_idx >= curr_idx:
                    raise ValueError(f"Chronologies must be in order: {prev_code} cannot come before {milestone_code}")
            
            # Validate dates if provided
            started_at = chrono_data.get("started_at")
            completed_at = chrono_data.get("completed_at")
            
            if started_at and completed_at:
                started_dt = datetime.fromisoformat(started_at.replace('Z', '+00:00'))
                completed_dt = datetime.fromisoformat(completed_at.replace('Z', '+00:00'))
                
                if completed_dt <= started_dt:
                    raise ValueError(f"Completion date must be after start date for milestone {milestone_code}")
        
        # Validate last chronology matches target milestone
        if chronologies_data and chronologies_data[-1].get("milestone_code") != target_milestone_code:
            raise ValueError(f"Last chronology must match target milestone: {chronologies_data[-1].get('milestone_code')} != {target_milestone_code}")
        
        # Create ticket
        ticket = Ticket(
            reference=TicketService._generate_reference(),
            student_id=student_id,
            status="OPEN" if target_milestone_code == "CREATED" else "PENDING",
            current_milestone_id=target_milestone.id,
            user_id=performed_by,
            diploma_validation_type=diploma_validation_type
        )
        
        db.session.add(ticket)
        db.session.flush()
        
        # Create documents
        TicketDocumentManager.create_auto_validated_documents(
            ticket, formation_type_code, performed_by
        )
        
        # Create chronologies
        for chrono_data in chronologies_data:
            milestone_code = chrono_data.get("milestone_code")
            milestone = milestone_map[milestone_code]
            
            # Parse dates
            started_at = None
            if chrono_data.get("started_at"):
                started_at = datetime.fromisoformat(chrono_data["started_at"].replace('Z', '+00:00'))
            
            completed_at = None
            if chrono_data.get("completed_at"):
                completed_at = datetime.fromisoformat(chrono_data["completed_at"].replace('Z', '+00:00'))
            
            # Determine status
            is_current = milestone_code == target_milestone_code
            status = "PENDING" if is_current else "DONE"
            
            chronology = Chronologie(
                ticket_id=ticket.id,
                milestone_id=milestone.id,
                performed_by=performed_by,
                started_at=started_at or datetime.utcnow(),
                ended_at=completed_at if not is_current else None,
                completed_at=completed_at if not is_current else None,
                comment=chrono_data.get("comment"),
                status=status
            )
            
            db.session.add(chronology)
        
        # Special validations for certain milestones
        if target_milestone_code == "PIECES_COMPLETES":
            from services.document_service import DocumentService
            
            # Verify all documents are validated
            if not DocumentService.check_documents_completion(ticket):
                db.session.rollback()
                missing_docs = DocumentService.get_missing_documents(ticket)
                raise ValueError(
                    f"Cannot set milestone to PIECES_COMPLETES. "
                    f"Missing or unvalidated documents: {', '.join(missing_docs)}"
                )
        
        # Update ticket status based on target milestone
        if target_milestone_code == "DOSSIER_CLOTURE":
            ticket.status = "COMPLETED"
        elif target_milestone_code == "CREATED":
            ticket.status = "OPEN"
        else:
            ticket.status = "PENDING"
        
        # Send notifications for the target milestone
        notifier = WorkflowNotifier()
        notifier.send_notification(ticket, target_milestone_code)
        
        # Special handling for correction workflow
        if target_milestone_code == "ATTENTE_CORRECTION_DOCS":
            from services.document_service import DocumentService
            
            auto_validated_status = DocumentService.check_auto_validated_documents_status(ticket)
            notifier.send_correction_notification(ticket, auto_validated_status['invalidated_docs'])
        
        db.session.commit()
        db.session.refresh(ticket)
        
        logger.info(
            f"Advanced ticket created: {ticket.reference} with target milestone {target_milestone_code} "
            f"and {len(chronologies_data)} chronologies"
        )
        
        return TicketFormatter.format_ticket(ticket)
           
    # ========================================================================
    # IMPORT
    # ========================================================================
    
    @staticmethod
    def import_tickets(tickets_data: List[Dict], performed_by: int) -> Dict[str, Any]:
        """
        Import multiple tickets from JSON data
        
        Returns:
            {
                "success": bool,
                "imported": int,
                "failed": int,
                "total": int,
                "results": [...]
            }
        """
        results = []
        imported_count = 0
        failed_count = 0
        
        for ticket_data in tickets_data:
            try:
                result = TicketService._import_single_ticket(ticket_data, performed_by)
                results.append(result)
                
                if result["success"]:
                    imported_count += 1
                else:
                    failed_count += 1
                    
            except Exception as e:
                db.session.rollback()
                error_msg = str(e)
                logger.error(f"Failed to import ticket: {error_msg}", exc_info=True)
                
                student_data = ticket_data.get("student", {})
                results.append({
                    "success": False,
                    "error": error_msg,
                    "student_email": student_data.get("email", "unknown")
                })
                failed_count += 1
        
        return {
            "success": failed_count == 0,
            "imported": imported_count,
            "failed": failed_count,
            "total": len(tickets_data),
            "results": results
        }
    
    @staticmethod
    def _import_single_ticket(ticket_data: Dict, performed_by: int) -> Dict[str, Any]:
        """Import a single ticket"""
        # Validate student data
        student_data = ticket_data.get("student", {})
        if not student_data:
            return {
                "success": False,
                "error": "Student data is required"
            }
        
        # Get or create student
        student = StudentManager.get_or_create_student(student_data)
        
        formation_type_code = (
            student.formation.formation_type.code 
            if student.formation and student.formation.formation_type 
            else None
        )
        
        # Get milestone
        initial_milestone_code = ticket_data.get("initial_milestone_code", "CREATED")
        milestone = Milestone.query.filter_by(code=initial_milestone_code).first()
        
        if not milestone:
            return {
                "success": False,
                "error": f"Milestone '{initial_milestone_code}' not found",
                "student_email": student_data.get("email")
            }
        
        # Create ticket
        ticket = Ticket(
            reference=TicketService._generate_reference(),
            student_id=student.id,
            status="OPEN",
            current_milestone_id=milestone.id,
            user_id=performed_by,
            diploma_validation_type=ticket_data.get("diploma_validation_type", "DIPLOMA")
        )
        
        db.session.add(ticket)
        db.session.flush()
        
        # Create chronologies
        ChronologyManager.create_import_chronologies(ticket, milestone, performed_by)
        
        # Create documents
        documents_data = ticket_data.get("documents", [])
        TicketDocumentManager.create_imported_documents(
            ticket, documents_data, formation_type_code, performed_by
        )
        
        # Verify documents if milestone is PIECES_COMPLETES
        if initial_milestone_code == "PIECES_COMPLETES":
            from services.document_service import DocumentService
            
            if not DocumentService.check_documents_completion(ticket):
                db.session.rollback()
                return {
                    "success": False,
                    "error": "Cannot set milestone to PIECES_COMPLETES: not all documents are validated",
                    "student_email": student.email,
                    "student_id": student.id
                }
            
            NotificationService.create_notification(
                user_id=ticket.user_id,
                ticket_id=ticket.id,
                title="Dossier complet",
                type="info",
                message="Toutes les pièces requises ont été validées. Votre dossier est maintenant complet."
            )
        
        db.session.commit()
        
        logger.info(f"Imported ticket {ticket.reference} for student {student.email}")
        
        return {
            "success": True,
            "ticket_id": ticket.id,
            "reference": ticket.reference,
            "student_email": student.email,
            "student_id": student.id
        }
    
    # ========================================================================
    # READ
    # ========================================================================
    
    @staticmethod
    def get_ticket(ticket_id: int) -> Dict[str, Any]:
        """Get a single ticket by ID"""
        ticket = TicketQueryBuilder.get_base_query().get_or_404(ticket_id)
        return TicketFormatter.format_ticket(ticket)
    
    @staticmethod
    def get_all_tickets(
        page: int = 1,
        length: int = 10,
        sort_field: str = "created_at",
        sort_order: str = "desc",
        agent_id: Optional[int] = None,
        student_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Get paginated list of tickets with filters"""
        query = TicketQueryBuilder.get_base_query()
        query = TicketQueryBuilder.apply_filters(query, agent_id, student_id)
        query = TicketQueryBuilder.apply_sorting(query, sort_field, sort_order)
        
        paginated = query.paginate(page=page, per_page=length, error_out=False)
        
        return {
            'items': [TicketFormatter.format_ticket(ticket) for ticket in paginated.items],
            'total': paginated.total,
            'pages': paginated.pages,
            'current_page': page,
            'per_page': length
        }
    
    @staticmethod
    def get_ticket_documents_status(ticket_id: int) -> Dict[str, Any]:
        """Get documents completion status for a ticket"""
        from services.document_service import DocumentService
        
        ticket = Ticket.query.options(
            joinedload(Ticket.documents)
        ).get_or_404(ticket_id)
        
        return DocumentService.get_documents_status(ticket)
    
    # ========================================================================
    # UPDATE
    # ========================================================================
    
    @staticmethod
    def update_diploma_validation_type(
        ticket_id: int,
        validation_type: str,
        performed_by: int
    ) -> Dict[str, Any]:
        """Update diploma validation type with automatic transitions"""
        if validation_type not in ["DIPLOMA", "ATTESTATION"]:
            raise ValueError("validation_type must be 'DIPLOMA' or 'ATTESTATION'")
        
        ticket = Ticket.query.get_or_404(ticket_id)
        previous_type = ticket.diploma_validation_type
        ticket.diploma_validation_type = validation_type
        
        db.session.commit()
        
        # Handle automatic transitions
        DiplomaValidationManager.handle_type_change(
            ticket, validation_type, previous_type, performed_by
        )
        
        db.session.refresh(ticket)
        
        logger.info(
            f"Updated diploma validation type for ticket {ticket.reference} "
            f"from {previous_type} to {validation_type}"
        )
        
        return TicketFormatter.format_ticket(ticket)
    
    @staticmethod
    def transition_ticket(
        ticket_id: int,
        next_state_code: str,
        performed_by: int,
        changed_at: Optional[datetime] = None,
        comment: Optional[str] = None
    ) -> Dict[str, Any]:
        """Transition ticket to next milestone"""
        ticket = TicketQueryBuilder.get_base_query().get_or_404(ticket_id)
        
        ticket = update_status(
            ticket, 
            next_state_code, 
            performed_by,
            changed_at=changed_at,
            comment=comment
        )
        
        db.session.refresh(ticket)
        return TicketFormatter.format_ticket(ticket)
    
    # ========================================================================
    # DELETE
    # ========================================================================
    
    @staticmethod
    def delete_ticket(ticket_id: int) -> None:
        """Delete a ticket and all related data (cascade)"""
        ticket = Ticket.query.get(ticket_id)
        
        if not ticket:
            raise ValueError(f"Ticket with id {ticket_id} not found")
        
        try:
            db.session.delete(ticket)
            db.session.commit()
            logger.info(f"Deleted ticket {ticket.reference} (ID: {ticket_id})")
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to delete ticket {ticket_id}: {str(e)}")
            raise Exception(f"Failed to delete ticket: {str(e)}")
