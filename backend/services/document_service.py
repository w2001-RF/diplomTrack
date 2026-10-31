from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any
import logging

from flask import Request
from sqlalchemy import desc, asc

from models.document import Document
from models.ticket import Ticket
from models.milestone import Milestone
from extensions import db
from services.audit_service import AuditService
from services.notification_service import NotificationService
from utils.constants import DocumentType, AUTO_VALIDATED_DOCUMENTS

logger = logging.getLogger(__name__)


# ============================================================================
# QUERY BUILDER
# ============================================================================

class DocumentQueryBuilder:
    """Builds and filters document queries"""
    
    @staticmethod
    def build_query(request: Request) -> Any:
        """Build base query with filters from request"""
        query = Document.query
        
        # Apply filters
        for raw_key, raw_val in request.args.items():
            if not raw_key.startswith("filter["):
                continue
            
            filter_params = DocumentQueryBuilder._parse_filter_key(raw_key)
            if not filter_params:
                continue
            
            field, op = filter_params
            query = DocumentQueryBuilder._apply_filter(query, field, op, raw_val)
        
        return query
    
    @staticmethod
    def _parse_filter_key(raw_key: str) -> Optional[Tuple[str, str]]:
        """Parse filter key to extract field and operator"""
        try:
            # raw_key example: filter[user_id][eq]
            parts = raw_key.split("[")
            field = parts[1].rstrip("]")
            op = parts[2].rstrip("]")
            return field, op
        except (IndexError, ValueError):
            return None
    
    @staticmethod
    def _apply_filter(query: Any, field: str, op: str, value: str) -> Any:
        """Apply filter to query"""
        if not hasattr(Document, field):
            return query
        
        column = getattr(Document, field)
        
        # Convert value for id fields
        if field == "id":
            try:
                value = int(value)
            except ValueError:
                return query.filter(False)  # Return empty query
        
        # Apply operator (only eq for now)
        if op == "eq":
            return query.filter(column == value)
        
        return query
    
    @staticmethod
    def apply_sorting(query: Any, sort: Optional[str]) -> Any:
        """Apply sorting to query"""
        # Default ordering
        if not sort:
            return query.order_by(desc(Document.validated_at))
        
        sort_field = sort.lstrip("+-") or "uploaded_at"
        sort_order = "desc" if sort.startswith("-") else "asc"
        
        if not hasattr(Document, sort_field):
            return query.order_by(desc(Document.validated_at))
        
        sort_column = getattr(Document, sort_field)
        
        if sort_order == "desc":
            return query.order_by(desc(sort_column))
        else:
            return query.order_by(asc(sort_column))
    
    @staticmethod
    def apply_pagination(
        query: Any,
        limit: Optional[int],
        page: Optional[int],
        offset: Optional[int]
    ) -> Tuple[List[Document], int]:
        """Apply pagination and return results with total count"""
        total = query.count()
        
        if not limit:
            return query.all(), total
        
        if page and page > 0:
            documents = query.limit(limit).offset((page - 1) * limit).all()
        elif offset is not None:
            documents = query.limit(limit).offset(offset).all()
        else:
            documents = query.limit(limit).all()
        
        return documents, total


# ============================================================================
# DOCUMENT VALIDATOR
# ============================================================================

class DocumentValidator:
    """Validates document operations and states"""
    
    @staticmethod
    def is_auto_validated_document(document_type: str) -> bool:
        """Check if document type is auto-validated"""
        return document_type in AUTO_VALIDATED_DOCUMENTS
    
    @staticmethod
    def check_all_documents_validated(ticket: Ticket) -> bool:
        """Check if all required documents are validated"""
        validated_types = {
            d.document_type
            for d in ticket.documents
            if d.is_validated
        }
        
        formation_type_code = ticket.student.formation.formation_type.code
        return all(doc in validated_types for doc in DocumentType.get_documents_by_formation_type(formation_type_code))
    
    @staticmethod
    def get_missing_documents(ticket: Ticket) -> List[str]:
        """Get list of missing or unvalidated documents"""
        validated_types = {
            d.document_type
            for d in ticket.documents
            if d.is_validated and d.file_path is not None
        }
        
        formation_type_code = ticket.student.formation.formation_type.code
        print(DocumentType.get_documents_by_formation_type(formation_type_code))
        return [
            doc for doc in DocumentType.get_documents_by_formation_type(formation_type_code)
            if doc not in validated_types
        ]
    
    @staticmethod
    def check_auto_validated_status(ticket: Ticket) -> Dict[str, Any]:
        """
        Check status of auto-validated documents
        
        Returns:
            {
                "has_invalidated": bool,
                "invalidated_docs": [list of invalidated document types],
                "count": int
            }
        """
        invalidated_docs = [
            doc.document_type
            for doc in ticket.documents
            if (DocumentValidator.is_auto_validated_document(doc.document_type) and
                doc.is_validated is False)
        ]
        
        return {
            "has_invalidated": len(invalidated_docs) > 0,
            "invalidated_docs": invalidated_docs,
            "count": len(invalidated_docs)
        }


# ============================================================================
# DOCUMENT STATUS MANAGER
# ============================================================================

class DocumentStatusManager:
    """Manages document status changes and related actions"""
    
    @staticmethod
    def validate_document(
        document: Document,
        comment: Optional[str],
        performed_by: int
    ) -> None:
        """Update document to validated state"""
        document.is_validated = True
        document.validation_comment = comment
        document.validated_by = performed_by
        document.validated_at = datetime.utcnow()
    
    @staticmethod
    def invalidate_document(
        document: Document,
        comment: str
    ) -> None:
        """Update document to invalidated state"""
        document.is_validated = False
        document.validation_comment = comment
        document.validated_by = None
        document.validated_at = None
    
    @staticmethod
    def update_file_path(
        document: Document,
        file_path: str
    ) -> None:
        """Update document file path and reset validation"""
        document.file_path = file_path
        document.is_validated = False
        document.validation_comment = None
        document.validated_by = None
        document.validated_at = None


# ============================================================================
# WORKFLOW TRANSITION HANDLER
# ============================================================================

class DocumentWorkflowHandler:
    """Handles workflow transitions triggered by document changes"""
    
    @staticmethod
    def handle_validation_transition(
        ticket: Ticket,
        document: Document,
        performed_by: int
    ) -> None:
        """Handle workflow transition after document validation"""
        auto_validated_status = DocumentValidator.check_auto_validated_status(ticket)
        current_milestone = Milestone.query.get(ticket.current_milestone_id)
        
        # Check if we should transition from DOCS_CORRIGES_SOUMIS
        if (current_milestone.code == "DOCS_CORRIGES_SOUMIS" and
            not auto_validated_status["has_invalidated"]):
            
            DocumentWorkflowHandler._transition_after_correction(
                ticket, performed_by
            )
        else:
            # Send standard notification
            NotificationService.create_notification(
                user_id=ticket.user_id,
                ticket_id=ticket.id,
                type="success",
                title="Document validé",
                message=f"Le document '{document.document_type}' a été validé avec succès."
            )
    
    @staticmethod
    def _transition_after_correction(ticket: Ticket, performed_by: int) -> None:
        """Transition ticket after all corrections are validated"""
        from services.workflow_service import update_status
        
        try:
            # Determine next milestone based on validation type
            if ticket.diploma_validation_type == "ATTESTATION":
                next_milestone = "ATTENTE_DIPLOME"
            else:
                next_milestone = "DOSSIER_EN_COURS"
            
            update_status(ticket, next_milestone, performed_by)
            
            NotificationService.create_notification(
                user_id=ticket.user_id,
                ticket_id=ticket.id,
                type="success",
                title="Documents corrigés validés",
                message="Tous vos documents corrigés ont été validés. Votre dossier progresse normalement."
            )
            
            logger.info(
                f"Auto-transitioned ticket {ticket.reference} to {next_milestone} "
                f"after document validation"
            )
            
        except Exception as e:
            logger.error(f"Failed to transition after document validation: {str(e)}")
    
    @staticmethod
    def handle_invalidation_transition(
        ticket: Ticket,
        document: Document,
        comment: str,
        performed_by: int,
        was_validated: bool
    ) -> None:
        """Handle workflow transition after document invalidation"""
        is_auto_validated = DocumentValidator.is_auto_validated_document(
            document.document_type
        )
        
        if is_auto_validated and was_validated:
            DocumentWorkflowHandler._transition_to_correction(
                ticket, document, comment, performed_by
            )
        else:
            # Send standard notification
            NotificationService.create_notification(
                user_id=ticket.user_id,
                ticket_id=ticket.id,
                type="warning",
                title="Document invalidé",
                message=f"Le document '{document.document_type}' a été invalidé. Raison: {comment}"
            )
    
    @staticmethod
    def _transition_to_correction(
        ticket: Ticket,
        document: Document,
        comment: str,
        performed_by: int
    ) -> None:
        """Transition ticket to correction workflow"""
        from services.workflow_service import update_status
        
        current_milestone = Milestone.query.get(ticket.current_milestone_id)
        
        if current_milestone.code in ["CREATED", "DOSSIER_EN_COURS"]:
            try:
                update_status(ticket, "ATTENTE_CORRECTION_DOCS", performed_by)
                
                NotificationService.create_notification(
                    user_id=ticket.user_id,
                    ticket_id=ticket.id,
                    type="warning",
                    title="Document invalidé - Correction requise",
                    message=f"Le document '{document.document_type}' a été invalidé. "
                           f"Raison: {comment}. Veuillez soumettre une version corrigée."
                )
                
                logger.info(
                    f"Auto-transitioned ticket {ticket.reference} to ATTENTE_CORRECTION_DOCS "
                    f"after invalidating {document.document_type}"
                )
                
            except Exception as e:
                logger.error(f"Failed to transition to ATTENTE_CORRECTION_DOCS: {str(e)}")


# ============================================================================
# DOCUMENT FORMATTER
# ============================================================================

class DocumentFormatter:
    """Formats document data for API responses"""
    
    @staticmethod
    def format_document_status(ticket: Ticket) -> Dict[str, Any]:
        """Get detailed status of all documents for a ticket"""
        documents_status = {}
        formation_type_code = ticket.student.formation.formation_type.code
        
        for doc_type in DocumentType.get_documents_by_formation_type(formation_type_code):
            doc = next(
                (d for d in ticket.documents if d.document_type == doc_type),
                None
            )
            
            if doc:
                documents_status[doc_type] = {
                    "uploaded": doc.file_path is not None,
                    "validated": doc.is_validated,
                    "file_path": doc.file_path,
                    "validation_comment": doc.validation_comment,
                    "validated_at": doc.validated_at.isoformat() if doc.validated_at else None
                }
            else:
                documents_status[doc_type] = {
                    "uploaded": False,
                    "validated": False,
                    "file_path": None,
                    "validation_comment": None,
                    "validated_at": None
                }
        
        return {
            "documents": documents_status,
            "is_complete": DocumentValidator.check_all_documents_validated(ticket),
            "missing_count": len(DocumentValidator.get_missing_documents(ticket))
        }


# ============================================================================
# DOCUMENT SERVICE (PUBLIC API)
# ============================================================================

class DocumentService:
    """Main service for document operations"""
    
    # ========================================================================
    # READ
    # ========================================================================
    
    @staticmethod
    def get_documents(
        limit: Optional[int],
        sort: Optional[str],
        page: Optional[int],
        offset: Optional[int],
        request: Request
    ) -> Tuple[List[Document], int]:
        """Get filtered and paginated documents"""
        query = DocumentQueryBuilder.build_query(request)
        query = DocumentQueryBuilder.apply_sorting(query, sort)
        documents, total = DocumentQueryBuilder.apply_pagination(
            query, limit, page, offset
        )
        
        return documents, total
    
    @staticmethod
    def get_documents_status(ticket: Ticket) -> Dict[str, Any]:
        """Get detailed status of all documents for a ticket"""
        return DocumentFormatter.format_document_status(ticket)
    
    # ========================================================================
    # VALIDATION CHECKS
    # ========================================================================
    
    @staticmethod
    def check_documents_completion(ticket: Ticket) -> bool:
        """
        Check if all required documents are validated
        Used by workflow_service when transitioning to PIECES_COMPLETES
        """
        return DocumentValidator.check_all_documents_validated(ticket)
    
    @staticmethod
    def get_missing_documents(ticket: Ticket) -> List[str]:
        """Get list of missing or unvalidated documents"""
        return DocumentValidator.get_missing_documents(ticket)
    
    @staticmethod
    def check_auto_validated_documents_status(ticket: Ticket) -> Dict[str, Any]:
        """Check if any auto-validated documents have been invalidated"""
        return DocumentValidator.check_auto_validated_status(ticket)
    
    # ========================================================================
    # CREATE / UPDATE
    # ========================================================================
    
    @staticmethod
    def upload_document(
        ticket_id: int,
        document_type: str,
        file_path: str
    ) -> Document:
        """Upload or update a document"""
        ticket = Ticket.query.get_or_404(ticket_id)
        
        document = Document.query.filter_by(
            ticket_id=ticket.id,
            document_type=document_type
        ).first()
        
        if document:
            # Update existing document
            old_path = document.file_path
            DocumentStatusManager.update_file_path(document, file_path)
            action = "UPDATE_DOCUMENT"
            description = f"{document_type} updated (was: {old_path})"
        else:
            # Create new document
            document = Document(
                ticket_id=ticket.id,
                document_type=document_type,
                file_path=file_path,
                is_validated=False
            )
            db.session.add(document)
            action = "UPLOAD_DOCUMENT"
            description = f"{document_type} uploaded"
        
        db.session.commit()
        
        AuditService.log_action(
            action=action,
            entity_type="DOCUMENT",
            entity_id=document.id,
            description=description
        )
        
        logger.info(f"{action}: {document_type} for ticket {ticket.reference}")
        
        return document
    
    # ========================================================================
    # VALIDATION
    # ========================================================================
    
    @staticmethod
    def validate_document(
        document_id: int,
        comment: Optional[str] = None,
        performed_by: Optional[int] = None
    ) -> Document:
        """Validate a document and handle workflow transitions"""
        document = Document.query.get_or_404(document_id)
        ticket = document.ticket
        
        # Update document status
        DocumentStatusManager.validate_document(document, comment, performed_by)
        
        db.session.commit()
        
        # Handle workflow transitions
        DocumentWorkflowHandler.handle_validation_transition(
            ticket, document, performed_by
        )
        
        # Log action
        AuditService.log_action(
            action="DOCUMENT_VALIDATED",
            entity_type="DOCUMENT",
            entity_id=document.id,
            performed_by=performed_by,
            description=f"Document {document.document_type} validated"
        )
        
        logger.info(
            f"Document {document.document_type} validated for ticket {ticket.reference} "
            f"by user {performed_by}"
        )
        
        return document
    
    @staticmethod
    def invalidate_document(
        document_id: int,
        comment: str,
        performed_by: int
    ) -> Document:
        """Invalidate a document and handle workflow transitions"""
        document = Document.query.get_or_404(document_id)
        ticket = document.ticket
        
        # Store previous state
        was_validated = document.is_validated
        
        # Update document status
        DocumentStatusManager.invalidate_document(document, comment)
        
        db.session.commit()
        
        # Handle workflow transitions
        DocumentWorkflowHandler.handle_invalidation_transition(
            ticket, document, comment, performed_by, was_validated
        )
        
        # Log action
        AuditService.log_action(
            action="DOCUMENT_INVALIDATED",
            entity_type="DOCUMENT",
            entity_id=document.id,
            performed_by=performed_by,
            description=f"Document {document.document_type} invalidated: {comment}"
        )
        
        logger.info(
            f"Document {document.document_type} invalidated for ticket {ticket.reference} "
            f"by user {performed_by}. Reason: {comment}"
        )
        
        return document