from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt, jwt_required
from services.auth_service import AuthService
from models.student import Student
from schemas.ticket_schema import TicketSchema, TicketCreateSchema
from services.ticket_service import TicketService
from utils.permissions import require_roles
import logging

logger = logging.getLogger(__name__)

ticket_bp = Blueprint("tickets", __name__, url_prefix="/api/tickets")

ticket_schema = TicketSchema()
tickets_schema = TicketSchema(many=True)
tickets_create_schema = TicketCreateSchema()


# =========================================================
# ROUTES
# =========================================================

@ticket_bp.route("/", methods=["POST"])
@jwt_required()
@require_roles("AGENT", "ADMIN")
def create_ticket():
    """
    Create a new student dossier
    """
    from datetime import datetime  # ✅ AJOUTER
    
    payload = tickets_create_schema.load(request.json)
    
    # ✅ AJOUTER: Parser la date et le commentaire
    created_at = None
    if payload.get("created_at"):
        try:
            created_at = datetime.fromisoformat(payload["created_at"].replace('Z', '+00:00'))
        except ValueError:
            return {"message": "Invalid date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)"}, 400
    
    ticket = TicketService.create_ticket(
        student_id=payload["student_id"],
        initial_milestone_code=payload["initial_milestone_code"],
        performed_by=get_jwt()["user_id"],
        created_at=created_at,
        comment=payload.get("comment")
    )

    return ticket_schema.dump(ticket), 201

@ticket_bp.route("/create-advanced", methods=["POST"])
@jwt_required()
@require_roles("AGENT", "ADMIN")
def create_advanced_ticket():
    """
    Create a new ticket with specific chronologies
    
    Body:
    {
        "student_id": 123,
        "target_milestone_code": "PIECES_COMPLETES",
        "chronologies": [
            {
                "milestone_code": "CREATED",
                "started_at": "2023-01-01T10:00:00",
                "completed_at": "2023-01-02T14:30:00",
                "comment": "Dossier créé"
            },
            {
                "milestone_code": "DOSSIER_EN_COURS",
                "started_at": "2023-01-02T14:30:00",
                "completed_at": "2023-01-05T09:15:00",
                "comment": "Traitement en cours"
            },
            {
                "milestone_code": "PIECES_COMPLETES",
                "started_at": "2023-01-05T09:15:00",
                "comment": "Toutes les pièces sont complètes"
            }
        ],
        "diploma_validation_type": "DIPLOMA"
    }
    """
    try:
        data = request.json
        
        # Validation des données
        if not data.get("student_id"):
            return {"message": "student_id is required"}, 400
            
        if not data.get("target_milestone_code"):
            return {"message": "target_milestone_code is required"}, 400
            
        if not data.get("chronologies") or not isinstance(data["chronologies"], list):
            return {"message": "chronologies array is required"}, 400
        
        # Créer le ticket avancé
        ticket = TicketService.create_advanced_ticket(
            student_id=data["student_id"],
            target_milestone_code=data["target_milestone_code"],
            chronologies_data=data["chronologies"],
            performed_by=get_jwt()["user_id"],
            diploma_validation_type=data.get("diploma_validation_type", "DIPLOMA")
        )
        
        return ticket_schema.dump(ticket), 201
        
    except ValueError as e:
        return {"message": str(e)}, 400
    except Exception as e:
        logger.error(f"Error creating advanced ticket: {str(e)}", exc_info=True)
        return {"message": f"Error creating advanced ticket: {str(e)}"}, 500

@ticket_bp.route("/import", methods=["POST"])
@jwt_required()
@require_roles("ADMIN", "AGENT")
def import_tickets():
    """
    Import multiple tickets from JSON data
    
    Expected payload:
    {
        "tickets": [
            {
                "student": {
                    "first_name": "Ahmed",
                    "last_name": "BENALI",
                    "email": "ahmed.benali@example.com",
                    "num_apogee": "12345678",
                    "academic_year": "2023-2024",
                    "formation_id": 1
                },
                "initial_milestone_code": "CREATED",
                "documents": [
                    {
                        "document_type": "CNI",
                        "is_validated": true,
                        "validation_comment": "Document conforme"
                    },
                    {
                        "document_type": "RELEVE_NOTES",
                        "is_validated": false,
                        "validation_comment": "Document manquant"
                    }
                ]
            }
        ]
    }
    
    Returns:
    {
        "success": true,
        "imported": 10,
        "failed": 2,
        "results": [...]
    }
    """
    try:
        data = request.json or {}
        tickets_data = data.get("tickets", [])
        
        if not tickets_data or not isinstance(tickets_data, list):
            return {
                "message": "Invalid payload. Expected 'tickets' array."
            }, 400
        
        performed_by = get_jwt()["user_id"]
        
        results = TicketService.import_tickets(
            tickets_data=tickets_data,
            performed_by=performed_by
        )
        
        return results, 200
        
    except Exception as e:
        logger.error(f"Error importing tickets: {str(e)}", exc_info=True)
        return {
            "message": f"Error importing tickets: {str(e)}"
        }, 500

@ticket_bp.route("/<int:ticket_id>", methods=["GET"])
@jwt_required()
@require_roles("AGENT", "ADMIN", "STUDENT")
def get_ticket(ticket_id):
    """
    Get full dossier details
    """
    ticket = TicketService.get_ticket(ticket_id)
    return ticket_schema.dump(ticket), 200


@ticket_bp.route("/", methods=["GET"])
@jwt_required()
@require_roles("AGENT", "ADMIN", "STUDENT")
def get_tickets():
    """
    List tickets:
    - ADMIN: all tickets
    - AGENT: only tickets assigned to them
    - STUDENT: only tickets that have them
    """
    page = request.args.get("page", 1, type=int)
    length = request.args.get("length", 10, type=int)
    sort = request.args.get("sort", "created_at", type=str)
    
    # Parse sort parameter: +field (asc), -field (desc), field (default asc)
    sort_field = sort.lstrip("+-") or "created_at"
    sort_order = "desc" if sort.startswith("-") else "asc"

    jwt_data = get_jwt()
    role = jwt_data.get("role")
    user_id = AuthService.get_current_user().id

    # ✅ enforce filter for AGENT
    agent_id = user_id if role == "AGENT" else None
    student_id = Student.query.filter_by(user_id=user_id).first().id if role == "STUDENT" else None
    
    result = TicketService.get_all_tickets(
        page=page, 
        length=length, 
        sort_field=sort_field,
        sort_order=sort_order,
        agent_id=agent_id,
        student_id=student_id
    )
    
    return {
        "tickets": tickets_schema.dump(result["items"]),
        "total": result["total"],
        "pages": result["pages"],
        "page": result["current_page"],
        "length": result["per_page"]
    }, 200

@ticket_bp.route("/<int:ticket_id>/transition", methods=["PATCH"])
@jwt_required()
@require_roles("AGENT", "ADMIN")
def transition_ticket(ticket_id):
    """
    Move ticket to next milestone
    
    Body:
    {
        "next_state": "DOSSIER_EN_COURS",
        "changed_at": "2024-01-15T10:30:00",  // Optional ISO datetime
        "comment": "Document validé"  // Optional comment
    }
    """
    from datetime import datetime
    
    data = request.json or {}
    next_state = data.get("next_state")
    changed_at_str = data.get("changed_at", None)
    comment = data.get("comment", "")

    if not next_state:
        return {"message": "next_state is required"}, 400
    
    #Parser la date si fournie
    changed_at = None
    if changed_at_str:
        try:
            changed_at = datetime.fromisoformat(changed_at_str.replace('Z', '+00:00'))
        except ValueError:
            return {"message": "Invalid date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)"}, 400

    ticket = TicketService.transition_ticket(
        ticket_id, 
        next_state, 
        performed_by=get_jwt()["user_id"],
        changed_at=changed_at,
        comment=comment
    )

    return {
        "message": "Ticket updated successfully",
        "ticket": ticket_schema.dump(ticket)
    }, 200

@ticket_bp.route("/<int:ticket_id>/documents/status", methods=["GET"])
@jwt_required()
@require_roles("AGENT", "ADMIN")
def get_ticket_documents_status(ticket_id):
    """
    Get documents completion status
    """
    status = TicketService.get_ticket_documents_status(ticket_id)
    return status, 200


@ticket_bp.route('/<int:ticket_id>/diploma-validation-type', methods=['PATCH'])
@jwt_required()
def update_diploma_validation_type(ticket_id):
    """Update diploma validation type for a ticket"""
    from services.ticket_service import TicketService
    
    data = request.get_json()
    validation_type = data.get('validation_type')
    
    if validation_type not in ['DIPLOMA', 'ATTESTATION']:
        return jsonify({'error': 'Invalid validation_type'}), 400
    
    try:
        ticket = TicketService.update_diploma_validation_type(ticket_id, validation_type, get_jwt()["user_id"])
        return jsonify({
            'message': 'Diploma validation type updated successfully',
            'ticket': ticket_schema.dump(ticket)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ticket_bp.route('/<int:ticket_id>/submit-corrected-documents', methods=['POST'])
@jwt_required()
def submit_corrected_documents(ticket_id):
    """
    Mark that student has submitted corrected documents
    Transitions from ATTENTE_CORRECTION_DOCS to DOCS_CORRIGES_SOUMIS
    
    Body (optional):
    {
        "changed_at": "2024-01-15T10:30:00",  // Optional ISO datetime
        "comment": "Documents corrigés soumis"  // Optional comment
    }
    """
    from services.ticket_service import TicketService
    from flask_jwt_extended import get_jwt_identity
    from datetime import datetime
    
    current_user_id = get_jwt_identity()
    
    #Parser les données optionnelles
    data = request.json or {}
    changed_at_str = data.get("changed_at")
    comment = data.get("comment")
    
    changed_at = None
    if changed_at_str:
        try:
            changed_at = datetime.fromisoformat(changed_at_str.replace('Z', '+00:00'))
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)'}), 400
    
    try:
        ticket = TicketService.transition_ticket(
            ticket_id=ticket_id,
            next_state_code="DOCS_CORRIGES_SOUMIS",
            performed_by=current_user_id,
            changed_at=changed_at,
            comment=comment
        )
        
        return jsonify({
            'message': 'Corrected documents submitted successfully',
            'ticket': ticket
        }), 200
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ticket_bp.route("/<int:ticket_id>", methods=["DELETE"])
@jwt_required()
@require_roles("AGENT", "ADMIN")
def delete_ticket(ticket_id):
    """
    Delete a ticket
    - ADMIN: can delete any ticket
    - AGENT: can only delete tickets they created
    
    This will cascade delete all related:
    - Documents
    - Chronologies
    """
    try:
        jwt_data = get_jwt()
        role = jwt_data.get("role")
        user_id = AuthService.get_current_user().id
        
        # ✅ Verify ticket exists and get details
        ticket = TicketService.get_ticket(ticket_id)
        
        # ✅ AGENT can only delete their own tickets
        if role == "AGENT":
            if ticket["user_id"] != user_id:
                logger.warning(
                    f"Access denied: User {user_id} (AGENT) attempted to delete ticket {ticket_id} "
                    f"owned by user {ticket['user_id']}"
                )
                return {
                    "message": "Access denied. You can only delete tickets you created.",
                    "ticket_id": ticket_id
                }, 403
        
        # ✅ Log deletion attempt
        logger.info(
            f"User {user_id} ({role}) is deleting ticket {ticket_id} "
            f"(reference: {ticket.get('reference')})"
        )
        
        # ✅ Perform deletion
        TicketService.delete_ticket(ticket_id)
        
        logger.info(f"Ticket {ticket_id} deleted successfully by user {user_id}")
        
        return {
            "message": "Ticket deleted successfully",
            "ticket_id": ticket_id,
            "reference": ticket.get("reference")
        }, 200
        
    except ValueError as e:
        logger.error(f"Ticket {ticket_id} not found: {str(e)}")
        return {"message": str(e)}, 404
    except Exception as e:
        logger.error(f"Error deleting ticket {ticket_id}: {str(e)}", exc_info=True)
        return {"message": f"Error deleting ticket: {str(e)}"}, 500