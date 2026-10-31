from sqlalchemy import asc, desc, or_, and_
from sqlalchemy.orm import joinedload
from models.formation import Formation
from models.student import Student
from models.user import User
from extensions import db
from services.audit_service import AuditService


class StudentService:

    @staticmethod
    def list_students(page: int = 1, limit: int = 10,  sort_field: str = "created_at", sort_order: str = "desc", filters=None):
        """
        List students with pagination, sorting, and filtering
        
        Args:
            page: Page number
            limit: Items per page
            sort_field: Field to sort by
            sort_order: 'asc' or 'desc'
            filters: List of filter dictionaries with 'field', 'operator', 'value'
        
        Returns:
            Paginated query result
        """
        query = Student.query

        # Apply filters
        if filters:
            for filter_item in filters:
                field = filter_item.get('field')
                operator = filter_item.get('operator')
                value = filter_item.get('value')
                
                # Get the model attribute
                if not hasattr(Student, field):
                    continue  # Skip invalid fields
                
                column = getattr(Student, field)
                # Apply operator
                if operator == 'eq':
                    query = query.filter(column == value)
                elif operator == 'ne':
                    query = query.filter(column != value)
                elif operator == 'gt':
                    query = query.filter(column > value)
                elif operator == 'gte':
                    query = query.filter(column >= value)
                elif operator == 'lt':
                    query = query.filter(column < value)
                elif operator == 'lte':
                    query = query.filter(column <= value)
                elif operator == 'like':
                    query = query.filter(column.like(f"%{value}%"))
                elif operator == 'ilike':
                    query = query.filter(column.ilike(f"%{value}%"))
                elif operator == 'in':
                    # Handle comma-separated values
                    values = [v.strip() for v in value.split(',')]
                    query = query.filter(column.in_(values))
        
        # Apply sorting
        if hasattr(Student, sort_field):
            sort_column = getattr(Student, sort_field)
            if sort_order == "desc":
                query = query.order_by(desc(sort_column))
            else:
                query = query.order_by(asc(sort_column))
        
        # Paginate
        paginated = query.paginate(
            page=page,
            per_page=limit,
            error_out=False
        )
        
        return paginated

    @staticmethod
    def get_student(student_id: int) -> Student:
        return Student.query.get_or_404(student_id)

    @staticmethod
    def get_student_by_email(email: str) -> Student:
        """
        Find student profile by linked user email
        """
        return Student.query.filter_by(email=email).first()

    @staticmethod
    def create_student(data: dict, performed_by: int = None) -> Student:
        print("Creating student with data:", data)
        formation = Formation.query.get_or_404(data["formation_id"])
        if not formation:
            raise ValueError("Formation not found")
        
        student = Student(
            user_id=data.get("user_id"),
            first_name=data["first_name"],
            last_name=data["last_name"],
            email=data.get("email"),
            num_apogee=data.get("num_apogee"),            
            formation_id=formation.id,
            academic_year=data["academic_year"]
        )

        db.session.add(student)
        db.session.commit()

        AuditService.log_action(
            action="CREATE_STUDENT",
            entity_type="Student",
            entity_id=student.id,
            performed_by=performed_by
        )

        return student

    @staticmethod
    def bulk_create_students(students_data: list, performed_by: int = None) -> dict:
        """
        Create or update multiple students at once
        - If student exists (same first_name, last_name, formation_id): UPDATE
        - If student doesn't exist: CREATE
        
        Returns: {
            'success': int,
            'failed': int,
            'total': int,
            'created': int,
            'updated': int,
            'errors': [{'index': int, 'data': dict, 'error': str}]
        }
        """
        from models.formation_type import FormationType
        
        results = {
            'success': 0,
            'failed': 0,
            'total': len(students_data),
            'created': 0,
            'updated': 0,
            'errors': []
        }
        
        for index, student_data in enumerate(students_data):
            try:
                # Find formation by name and type
                formation_type = FormationType.query.filter_by(
                    code=student_data['formation_type']
                ).first()
                
                if not formation_type:
                    raise ValueError(f"Formation type '{student_data['formation_type']}' not found")
                
                formation = Formation.query.filter_by(
                    formation_name=student_data['formation_name'],
                    formation_type_id=formation_type.id
                ).first()
                
                if not formation:
                    raise ValueError(
                        f"Formation '{student_data['formation_name']}' "
                        f"of type '{student_data['formation_type']}' not found"
                    )
                
                # ✅ Check if student already exists
                existing_student = Student.query.filter_by(
                    first_name=student_data['first_name'],
                    last_name=student_data['last_name'],
                    formation_id=formation.id
                ).first()
                
                if existing_student:
                    # ✅ UPDATE existing student
                    existing_student.email = student_data.get('email') or existing_student.email
                    existing_student.num_apogee = student_data.get('num_apogee') or existing_student.num_apogee
                    existing_student.academic_year = student_data['academic_year']
                    
                    db.session.flush()
                    
                    AuditService.log_action(
                        action="BULK_UPDATE_STUDENT",
                        entity_type="Student",
                        entity_id=existing_student.id,
                        performed_by=performed_by
                    )
                    
                    results['updated'] += 1
                    results['success'] += 1
                    
                else:
                    # ✅ CREATE new student
                    student = Student(
                        user_id=None,
                        first_name=student_data['first_name'],
                        last_name=student_data['last_name'],
                        email=student_data.get('email'),
                        num_apogee=student_data.get('num_apogee'),
                        formation_id=formation.id,
                        academic_year=student_data['academic_year']
                    )
                    
                    db.session.add(student)
                    db.session.flush()
                    
                    AuditService.log_action(    
                        action="BULK_CREATE_STUDENT",
                        entity_type="Student",
                        entity_id=student.id,
                        performed_by=performed_by
                    )
                    
                    results['created'] += 1
                    results['success'] += 1
                    
            except Exception as e:
                results['failed'] += 1
                results['errors'].append({
                    'index': index,
                    'data': student_data,
                    'error': str(e)
                })
                db.session.rollback()
        
        # Commit all successful operations
        if results['success'] > 0:
            db.session.commit()
        
        return results

    @staticmethod
    def update_student(student_id: int, data: dict, performed_by: int = None) -> Student:
        student = Student.query.get_or_404(student_id)

        for field in [
            "first_name", "last_name", "email", "num_apogee", 
            "formation_id","academic_year"
        ]:
            if field in data and data[field] is not None:
                if field == "formation_id":
                    formation = Formation.query.get_or_404(data["formation_id"])
                    if not formation:
                        raise ValueError("Formation not found")
                    setattr(student, field, formation.id)
                    continue
                setattr(student, field, data[field])

        db.session.commit()

        AuditService.log_action(
            action="UPDATE_STUDENT",
            entity_type="Student",
            entity_id=student.id,
            performed_by=performed_by
        )

        return student

    @staticmethod
    def delete_student(student_id: int, performed_by: int = None):
        student = Student.query.get_or_404(student_id)

        db.session.delete(student)
        db.session.commit()

        AuditService.log_action(
            action="DELETE_STUDENT",
            entity_type="Student",
            entity_id=student_id,
            performed_by=performed_by
        )
    
    # ---------------------------
    # LINKING (account ↔ profile)
    # ---------------------------
    @staticmethod
    def link_student_to_user_by_email(student_id: int, user: User = None, performed_by: int = None) -> Student:
        """
        Link an existing Student profile to the User account with the same email.
        If no User exists yet -> raise ValueError.
        """
        student = Student.query.get_or_404(student_id)

        if not user:
            user = User.query.filter_by(email=student.email).first()
        if not user:
            raise ValueError("No user account exists with this email yet")

        if user.role != "STUDENT":
            raise ValueError("User exists but is not a STUDENT role")

        student.user_id = user.id
        db.session.commit()

        AuditService.log_action(
            action="LINK_STUDENT_PROFILE",
            entity_type="Student",
            entity_id=student.id,
            performed_by=performed_by
        )

        return student
