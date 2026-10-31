from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, jwt_required
from services.auth_service import AuthService
from utils.permissions import require_roles
from schemas.document_schema import DocumentSchema
from services.document_service import DocumentService

document_bp = Blueprint("documents", __name__, url_prefix="/api/documents")

document_schema = DocumentSchema()
documents_schema = DocumentSchema(many=True)

@document_bp.route("/", methods=["GET"])
@jwt_required()
def list_documents():
    """
    Get documents with pagination, sorting and filtering
    
    Query params:
    - page: page number
    - limit: items per page
    - sort: +field or -field for asc/desc
    - filter[field][op]=value: dynamic filters
    
    Example: /api/documents?filter[ticket_id][eq]=5&limit=10&sort=-created_at
    """
    try:
        sort = request.args.get('sort', type=str)
        page = request.args.get('page', type=int)
        limit = request.args.get('limit', type=int)
        offset = request.args.get('offset', type=int)

        documents, total = DocumentService.get_documents(limit, sort, page, offset, request)

        return jsonify({
            "documents": documents_schema.dump(documents),
            "total": total,
            "page": page,
            "limit": limit
        }), 200

    except Exception as e:
        return {"message": f"Error listing documents: {str(e)}"}, 500

@document_bp.route("/<int:document_id>", methods=["GET"])
@jwt_required()
@require_roles("AGENT", "ADMIN", "STUDENT")
def get_document(document_id):
    """
    Get a single document by ID
    """
    try:
        from models.document import Document
        
        document = Document.query.get_or_404(document_id)
        
        # ✅ Check permissions for STUDENT
        jwt_data = get_jwt()
        role = jwt_data.get("role")
        
        if role == "STUDENT":
            from models.student import Student
            user_id = AuthService.get_current_user().id
            student = Student.query.filter_by(user_id=user_id).first()
            
            if not student or document.ticket.student_id != student.id:
                return {"message": "Access denied"}, 403
        
        return document_schema.dump(document), 200
        
    except Exception as e:
        return {"message": f"Error retrieving document: {str(e)}"}, 500

@document_bp.route("/", methods=["POST"])
@jwt_required()
@require_roles("AGENT", "ADMIN")
def upload_document():
    """
    Upload a document to a ticket
    
    Body:
    {
        "ticket_id": 1,
        "document_type": "BAC",
        "file_path": "/uploads/bac_123.pdf"
    }
    """
    try:
        payload = request.json
        
        # Validation
        if not payload.get("ticket_id"):
            return {"message": "ticket_id is required"}, 400
        if not payload.get("document_type"):
            return {"message": "document_type is required"}, 400
        if not payload.get("file_path"):
            return {"message": "file_path is required"}, 400
        
        # ✅ Check permissions for STUDENT
        jwt_data = get_jwt()
        role = jwt_data.get("role")
        
        if role == "STUDENT":
            from models.student import Student
            from models.ticket import Ticket
            
            user_id = AuthService.get_current_user().id
            student = Student.query.filter_by(user_id=user_id).first()
            ticket = Ticket.query.get_or_404(payload["ticket_id"])
            
            if not student or ticket.student_id != student.id:
                return {"message": "Access denied. You can only upload documents to your own ticket"}, 403

        document = DocumentService.upload_document(
            ticket_id=payload["ticket_id"],
            document_type=payload["document_type"],
            file_path=payload["file_path"]
        )

        return document_schema.dump(document), 201

    except ValueError as e:
        return {"message": str(e)}, 400
    except Exception as e:
        return {"message": f"Error uploading document: {str(e)}"}, 500
    

@document_bp.route("/<int:document_id>/validate", methods=["PATCH"])
@jwt_required()
@require_roles("AGENT", "ADMIN")
def validate_document(document_id):
    """
    Validate a document
    
    Body (optional):
    {
        "comment": "Document is valid"
    }
    """
    try:
        data = request.json or {}
        comment = data.get("comment", None)
        
        user_id = AuthService.get_current_user().id
        
        document = DocumentService.validate_document(
            document_id=document_id,
            comment=comment,
            performed_by=user_id,
        )
        
        return {
            "message": "Document validated successfully",
            "document": document_schema.dump(document)
        }, 200
        
    except ValueError as e:
        return {"message": str(e)}, 400
    except Exception as e:
        return {"message": f"Error validating document: {str(e)}"}, 500


@document_bp.route("/<int:document_id>/invalidate", methods=["PATCH"])
@jwt_required()
@require_roles("AGENT", "ADMIN")
def invalidate_document(document_id):
    """
    Invalidate/reject a document
    
    Body:
    {
        "comment": "Document is not clear, please re-upload"
    }
    """
    try:
        data = request.json or {}
        comment = data.get("comment", "Document rejected")
        
        user_id = AuthService.get_current_user().id
        
        document = DocumentService.invalidate_document(
            document_id=document_id,
            comment=comment,
            performed_by=user_id,
        )
        
        return {
            "message": "Document invalidated successfully",
            "document": document_schema.dump(document)
        }, 200
        
    except Exception as e:
        return {"message": f"Error invalidating document: {str(e)}"}, 500

@document_bp.route("/<int:document_id>", methods=["DELETE"])
@jwt_required()
@require_roles("ADMIN", "AGENT")
def delete_document(document_id):
    """
    Delete a document (ADMIN only)
    """
    try:
        from models.document import Document
        
        document = Document.query.get_or_404(document_id)
        
        from extensions import db
        db.session.delete(document)
        db.session.commit()
        
        return {
            "message": "Document deleted successfully",
            "document_id": document_id
        }, 200
        
    except Exception as e:
        from extensions import db
        db.session.rollback()
        return {"message": f"Error deleting document: {str(e)}"}, 500

@document_bp.route("/ticket/<int:ticket_id>/status", methods=["GET"])
@jwt_required()
@require_roles("AGENT", "ADMIN", "STUDENT")
def get_ticket_documents_status(ticket_id):
    """
    Get documents completion status for a ticket
    
    Returns:
    {
        "documents": {
            "BAC": {
                "uploaded": true,
                "validated": true,
                "file_path": "/uploads/bac.pdf",
                "validation_comment": "OK",
                "validated_at": "2024-01-15T10:30:00"
            },
            ...
        },
        "is_complete": false,
        "missing_count": 2
    }
    """
    try:
        from models.ticket import Ticket
        
        ticket = Ticket.query.get_or_404(ticket_id)
        
        # ✅ Check permissions for STUDENT
        jwt_data = get_jwt()
        role = jwt_data.get("role")
        
        if role == "STUDENT":
            from models.student import Student
            user_id = AuthService.get_current_user().id
            student = Student.query.filter_by(user_id=user_id).first()
            
            if not student or ticket.student_id != student.id:
                return {"message": "Access denied"}, 403
        
        status = DocumentService.get_documents_status(ticket)
        
        return status, 200
        
    except Exception as e:
        return {"message": f"Error getting documents status: {str(e)}"}, 500

@document_bp.route("/ticket/<int:ticket_id>/missing", methods=["GET"])
@jwt_required()
@require_roles("AGENT", "ADMIN", "STUDENT")
def get_missing_documents(ticket_id):
    """
    Get list of missing or unvalidated documents for a ticket
    
    Returns:
    {
        "missing_documents": ["CIN", "CONTRAT"],
        "count": 2
    }
    """
    try:
        from models.ticket import Ticket
        
        ticket = Ticket.query.get_or_404(ticket_id)
        
        # ✅ Check permissions for STUDENT
        jwt_data = get_jwt()
        role = jwt_data.get("role")
        
        if role == "STUDENT":
            from models.student import Student
            user_id = AuthService.get_current_user().id
            student = Student.query.filter_by(user_id=user_id).first()
            
            if not student or ticket.student_id != student.id:
                return {"message": "Access denied"}, 403
        
        missing = DocumentService.get_missing_documents(ticket)
        
        return {
            "missing_documents": missing,
            "count": len(missing)
        }, 200
        
    except Exception as e:
        return {"message": f"Error getting missing documents: {str(e)}"}, 500


@document_bp.route("/types", methods=["GET"])
@jwt_required()
def get_document_types():
    """
    Get list of all valid document types
    
    Returns:
    {
        "document_types": [
            {"code": "BAC", "label": "Baccalauréat"},
            {"code": "CIN", "label": "Carte d'Identité Nationale"},
            ...
        ]
    }
    """
    try:
        from utils.constants import DocumentType
        
        types = [
            {
                "code": doc_type,
                "label": DocumentType.get_label(doc_type)
            }
            for doc_type in DocumentType.all()
        ]
        
        return {"document_types": types}, 200
        
    except Exception as e:
        return {"message": f"Error getting document types: {str(e)}"}, 500
