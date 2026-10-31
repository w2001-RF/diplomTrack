from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from sqlalchemy.orm import joinedload
from datetime import datetime
from typing import Dict, List, Tuple, Optional, Any
import logging

from utils.permissions import require_roles
from models.milestone import Milestone
from models.user import User
from models.app_config import AppConfig
from models.chronologie import Chronologie
from models.formation import Formation
from schemas.formation_schema import FormationResponseSchema
from extensions import db

logger = logging.getLogger(__name__)

data_bp = Blueprint("data", __name__, url_prefix="/api")

# ============================================================================
# SCHEMAS
# ============================================================================

formation_schema = FormationResponseSchema()
formations_schema = FormationResponseSchema(many=True)


# ============================================================================
# CONFIGURATION METADATA
# ============================================================================

class AppConfigMetadata:
    """Metadata for app configuration fields"""
    
    FIELDS = {
        "warning_delay_days": {
            "type": "integer",
            "description": "Days before deadline to show warning"
        },
        "alerts_email": {
            "type": "string",
            "description": "Email address receiving system alerts"
        },
        "notification_template_student": {
            "type": "text",
            "description": "Default notification template for students"
        },
        "notification_template_agent": {
            "type": "text",
            "description": "Default notification template for agents"
        },
        "max_upload_size_mb": {
            "type": "integer",
            "description": "Maximum upload size in MB"
        },
        "auto_archive_days": {
            "type": "integer",
            "description": "Number of days before automatic archival"
        },
        "updated_at": {
            "type": "datetime",
            "description": "Last update timestamp"
        },
        "enable_email_notifications": {
            "type": "boolean",
            "description": "Enable/disable email notifications"
        },
        "email_check_interval_hours": {
            "type": "integer",
            "description": "Interval in hours to check for pending emails"
        },
        "email_ticket_blocked_subject": {
            "type": "string",
            "description": "Subject line for ticket blocked email"
        },
        "email_agent_delay_subject": {
            "type": "string",
            "description": "Subject line for agent delay email"
        },
        "email_admin_report_subject": {
            "type": "string",
            "description": "Subject line for admin report email"
        },
        "email_ticket_blocked_template": {
            "type": "text",
            "description": "Template for ticket blocked email"
        },
        "email_agent_delay_template": {
            "type": "text",
            "description": "Template for agent delay email"
        },
        "email_admin_report_template": {
            "type": "text",
            "description": "Template for admin report email"
        },
    }
    
    @classmethod
    def serialize_field(cls, config: AppConfig, field_name: str) -> Dict[str, Any]:
        """Serialize a single config field"""
        meta = cls.FIELDS.get(field_name)
        if not meta:
            return None
        
        value = getattr(config, field_name, None)
        
        # Format datetime values
        if meta["type"] == "datetime" and value:
            value = value.isoformat()
        
        return {
            "id": config.id,
            "key": field_name,
            "value": value,
            "type": meta["type"],
            "description": meta["description"]
        }


# ============================================================================
# PAGINATION UTILITIES
# ============================================================================

class PaginationParams:
    """Container for pagination parameters"""
    
    def __init__(self, request_args):
        self.sort = request_args.get('sort', type=str)
        self.page = request_args.get('page', type=int)
        self.limit = request_args.get('limit', type=int)
        self.offset = request_args.get('offset', type=int)
    
    @property
    def sort_field(self) -> str:
        """Extract sort field from sort parameter"""
        if not self.sort:
            return "created_at"
        return self.sort.lstrip("+-") or "created_at"
    
    @property
    def sort_order(self) -> str:
        """Extract sort order from sort parameter"""
        if not self.sort:
            return "asc"
        return "desc" if self.sort.startswith("-") else "asc"


class QueryPaginator:
    """Handles query pagination"""
    
    @staticmethod
    def paginate_query(query: Any, params: PaginationParams) -> Tuple[List, int]:
        """
        Apply SQL-level pagination to a SQLAlchemy query
        
        Returns:
            Tuple of (items, total_count)
        """
        # Apply sorting
        if params.sort:
            entity = query.column_descriptions[0]['entity']
            sort_column = getattr(entity, params.sort_field, None)
            
            if sort_column is not None:
                if params.sort_order == "desc":
                    query = query.order_by(sort_column.desc())
                else:
                    query = query.order_by(sort_column.asc())
        
        # Get total count
        total = query.count()
        
        # Apply pagination
        if not params.limit:
            return query.all(), total
        
        if params.page and params.page > 0:
            items = query.limit(params.limit).offset((params.page - 1) * params.limit).all()
        elif params.offset is not None:
            items = query.limit(params.limit).offset(params.offset).all()
        else:
            items = query.limit(params.limit).all()
        
        return items, total
    
    @staticmethod
    def paginate_list(items_list: List, params: PaginationParams) -> Tuple[List, Optional[int]]:
        """
        Apply in-memory pagination to a Python list
        
        Returns:
            Tuple of (sliced_list, total_count_or_None)
        """
        if not params.limit:
            return items_list, None
        
        total = len(items_list)
        
        # Calculate start index
        if params.page and params.page > 0:
            start = (params.page - 1) * params.limit
        elif params.offset is not None:
            start = params.offset
        else:
            start = 0
        
        # Apply sorting if specified
        if params.sort:
            items_list = sorted(
                items_list,
                key=lambda x: getattr(x, params.sort_field, None),
                reverse=(params.sort_order == "desc")
            )
        
        return items_list[start:start + params.limit], total


# ============================================================================
# FILTER UTILITIES
# ============================================================================

class QueryFilter:
    """Handles query filtering from request parameters"""
    
    @staticmethod
    def parse_filter_key(raw_key: str) -> Optional[Tuple[str, str]]:
        """
        Parse filter key to extract field and operator
        
        Example: "filter[user_id][eq]" -> ("user_id", "eq")
        """
        try:
            parts = raw_key.split("[")
            field = parts[1].rstrip("]")
            op = parts[2].rstrip("]")
            return field, op
        except (IndexError, ValueError):
            return None
    
    @staticmethod
    def apply_filters(query: Any, model: Any, request_args: Dict) -> Any:
        """Apply filters from request arguments to query"""
        for raw_key, raw_val in request_args.items():
            if not raw_key.startswith("filter["):
                continue
            
            filter_params = QueryFilter.parse_filter_key(raw_key)
            if not filter_params:
                continue
            
            field, op = filter_params
            
            # Map API field names to model field names
            if field == "user_id" and model == User:
                field = "id"
            
            # Only support 'eq' operator for now
            if op != "eq" or not hasattr(model, field):
                continue
            
            column = getattr(model, field)
            
            # Convert to int for ID fields
            if "id" in field:
                try:
                    raw_val = int(raw_val)
                except ValueError:
                    continue
            
            query = query.filter(column == raw_val)
        
        return query


# ============================================================================
# SERIALIZERS
# ============================================================================

class MilestoneSerializer:
    """Serializes Milestone objects"""
    
    @staticmethod
    def serialize(milestone: Milestone) -> Dict[str, Any]:
        """Serialize a single milestone"""
        if not milestone:
            return None
        
        return {
            'id': milestone.id,
            'code': milestone.code,
            'label': milestone.label,
            'description': milestone.description,
            'order': milestone.order,
            'is_terminal': bool(milestone.is_terminal)
        }
    
    @staticmethod
    def serialize_many(milestones: List[Milestone]) -> List[Dict[str, Any]]:
        """Serialize multiple milestones"""
        return [MilestoneSerializer.serialize(m) for m in milestones]


class UserProfileSerializer:
    """Serializes User profiles"""
    
    @staticmethod
    def serialize(user: User) -> Dict[str, Any]:
        """Serialize a single user profile"""
        return {
            "id": user.id,
            "user_id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": getattr(user, "full_name", user.username),
            "role": user.role,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None
        }
    
    @staticmethod
    def serialize_many(users: List[User]) -> List[Dict[str, Any]]:
        """Serialize multiple user profiles"""
        return [UserProfileSerializer.serialize(u) for u in users]


class ChronologieSerializer:
    """Serializes Chronologie (milestone history) objects"""
    
    @staticmethod
    def serialize_transition(prev: Chronologie, curr: Chronologie) -> Dict[str, Any]:
        """Serialize a milestone transition"""
        return {
            'id': curr.id,
            'ticket_id': curr.ticket_id,
            'from_milestone': MilestoneSerializer.serialize(prev.milestone),
            'to_milestone': MilestoneSerializer.serialize(curr.milestone),
            'changed_by': curr.performed_by,
            'changed_at': curr.started_at.isoformat() if curr.started_at else None,
            'notes': curr.comment,
            'status': curr.status,
            'blocked_reason': curr.blocked_reason
        }


# ============================================================================
# ROUTES - MILESTONES
# ============================================================================

@data_bp.route("/milestones", methods=["GET"])
@jwt_required()
def list_milestones():
    """Get all milestones with pagination"""
    try:
        params = PaginationParams(request.args)
        query = Milestone.query.order_by(Milestone.order.asc())
        
        items, total = QueryPaginator.paginate_query(query, params)
        
        return jsonify({
            "data": MilestoneSerializer.serialize_many(items),
            "count": total
        }), 200
        
    except Exception as e:
        logger.error(f"Error listing milestones: {str(e)}", exc_info=True)
        return jsonify({"message": str(e)}), 500


# ============================================================================
# ROUTES - APP SETTINGS
# ============================================================================

@data_bp.route("/app_settings", methods=["GET"])
@jwt_required()
@require_roles("ADMIN")
def list_app_settings():
    """Get all app settings (admin only)"""
    try:
        params = PaginationParams(request.args)
        query = AppConfig.query
        
        items, total = QueryPaginator.paginate_query(query, params)
        
        payload = []
        for config in items:
            for field_name in AppConfigMetadata.FIELDS.keys():
                field_data = AppConfigMetadata.serialize_field(config, field_name)
                if field_data:
                    payload.append(field_data)
        
        return jsonify({'data': payload, 'count': total}), 200
        
    except Exception as e:
        logger.error(f"Error listing app settings: {str(e)}", exc_info=True)
        return jsonify({"message": str(e)}), 500


@data_bp.route("/app_settings/<int:setting_id>", methods=["PUT", "PATCH"])
@jwt_required()
@require_roles("ADMIN")
def update_app_setting(setting_id):
    """Update or patch app setting"""
    try:
        data = request.json or {}
        config = AppConfig.query.get_or_404(setting_id)
        
        result = []
        
        # Update provided fields
        for key, value in data.items():
            if key in AppConfigMetadata.FIELDS and hasattr(config, key):
                setattr(config, key, value)
                field_data = AppConfigMetadata.serialize_field(config, key)
                if field_data:
                    result.append(field_data)
        
        if not result:
            return jsonify({"message": "No valid fields to update"}), 400
        
        db.session.commit()
        
        # Add updated_at to response
        db.session.refresh(config)
        updated_at_data = AppConfigMetadata.serialize_field(config, 'updated_at')
        if updated_at_data:
            result.append(updated_at_data)
        
        return jsonify(result), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating app setting: {str(e)}", exc_info=True)
        return jsonify({"message": str(e)}), 500


# ============================================================================
# ROUTES - USER ROLES
# ============================================================================

@data_bp.route("/user_roles", methods=["GET"])
@jwt_required()
def list_user_roles():
    """Get user roles with pagination and sorting"""
    try:
        user_id = request.args.get('user_id')
        
        # Single user lookup
        if user_id:
            user = User.query.get(int(user_id))
            if not user:
                return jsonify({'data': [], 'count': 0}), 200
            
            return jsonify({
                'data': [{
                    'id': user.id,
                    'user_id': user.id,
                    'role': user.role
                }],
                'count': 1
            }), 200
        
        # Paginated list
        params = PaginationParams(request.args)
        query = User.query
        
        items, total = QueryPaginator.paginate_query(query, params)
        
        payload = [{
            'id': u.id,
            'user_id': u.id,
            'role': u.role
        } for u in items]
        
        return jsonify({
            'data': payload,
            'count': total,
            'page': params.page or 1,
            'limit': params.limit or len(payload)
        }), 200
        
    except Exception as e:
        logger.error(f"Error listing user roles: {str(e)}", exc_info=True)
        return jsonify({"message": str(e)}), 500


# ============================================================================
# ROUTES - PROFILES
# ============================================================================

@data_bp.route("/profiles", methods=["GET"])
@jwt_required()
def list_profiles():
    """Get user profiles with filtering and pagination"""
    try:
        params = PaginationParams(request.args)
        query = User.query
        
        # Apply filters
        query = QueryFilter.apply_filters(query, User, request.args)
        
        # Apply default ordering
        query = query.order_by(User.created_at.desc())
        
        # Apply pagination
        items, total = QueryPaginator.paginate_query(query, params)
        
        return jsonify({
            "data": UserProfileSerializer.serialize_many(items),
            "count": total
        }), 200
        
    except Exception as e:
        logger.error(f"Error listing profiles: {str(e)}", exc_info=True)
        return jsonify({"message": str(e)}), 500


@data_bp.route("/profiles/<int:profile_id>", methods=["PUT"])
@jwt_required()
def update_profile(profile_id):
    """Update user profile"""
    try:
        data = request.json or {}
        user = User.query.get_or_404(profile_id)
        
        # Update allowed fields
        if 'email' in data:
            user.email = data['email']
        if 'full_name' in data:
            user.username = data['full_name']
        if 'phone' in data and hasattr(user, 'phone'):
            user.phone = data['phone']
        
        db.session.commit()
        
        return jsonify(UserProfileSerializer.serialize(user)), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating profile: {str(e)}", exc_info=True)
        return jsonify({"message": str(e)}), 500


# ============================================================================
# ROUTES - MILESTONE HISTORY
# ============================================================================

@data_bp.route("/ticket_milestone_history", methods=["GET"])
@jwt_required()
def list_milestone_history():
    """Get ticket milestone history with optimized queries (only DONE chronologies)"""
    try:
        params = PaginationParams(request.args)
        
        # Build query with eager loading
        query = Chronologie.query.options(
            joinedload(Chronologie.milestone)
        )
        
        # Apply filters
        query = QueryFilter.apply_filters(query, Chronologie, request.args)
        
        # Order by start time ascending to build transitions
        entries = query.order_by(Chronologie.started_at.asc()).all()
        
        # Build transitions from chronologies
        transitions = []
        for i in range(1, len(entries)):
            prev = entries[i - 1]
            curr = entries[i]
            transitions.append(
                ChronologieSerializer.serialize_transition(prev, curr)
            )
        
        # Reverse to show most recent first
        transitions.reverse()
        
        # Apply in-memory pagination
        paged, total = QueryPaginator.paginate_list(transitions, params)
        
        if total is not None:
            return jsonify({'data': paged, 'count': total}), 200
        
        return jsonify(paged), 200
        
    except Exception as e:
        logger.error(f"Error fetching milestone history: {str(e)}", exc_info=True)
        return jsonify({"message": str(e)}), 500

# ============================================================================
# ROUTES - FORMATIONS
# ============================================================================

@data_bp.route('/formations', methods=['GET'])
@jwt_required()
def get_formations():
    """Get all formations with optional pagination"""
    try:
        params = PaginationParams(request.args)
        
        # Build query with eager loading
        query = Formation.query.options(
            joinedload(Formation.formation_type),
            joinedload(Formation.professor_responsible),
            joinedload(Formation.contact_professor)
        )
        
        # Apply pagination
        items, total = QueryPaginator.paginate_query(query, params)
        
        # Build response
        response = {
            'data': formations_schema.dump(items),
            'count': total
        }
        
        # Add pagination metadata if limit was provided
        if params.limit:
            response.update({
                'page': params.page or 1,
                'limit': params.limit,
                'offset': params.offset or 0
            })
        
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"Error fetching formations: {str(e)}", exc_info=True)
        return jsonify({"message": str(e)}), 500


# ============================================================================
# ERROR HANDLERS
# ============================================================================

@data_bp.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({"message": "Resource not found"}), 404


@data_bp.errorhandler(400)
def bad_request(error):
    """Handle 400 errors"""
    return jsonify({"message": "Bad request"}), 400


@data_bp.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    db.session.rollback()
    logger.error(f"Internal server error: {str(error)}", exc_info=True)
    return jsonify({"message": "Internal server error"}), 500
