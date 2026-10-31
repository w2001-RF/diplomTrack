from extensions import db
from datetime import datetime
from utils.constants import DocumentType

class Document(db.Model):
    __tablename__ = "documents"

    id = db.Column(db.Integer, primary_key=True)

    ticket_id = db.Column(
        db.Integer,
        db.ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False
    )

    # BAC | BAC+2 | CIN | CONTRAT | RECU_PAIEMENT | RETOUR_CFC | PV_DIPLOME | ATTESTATION_INSC
    document_type = db.Column(
        db.String(50),
        nullable=False
    )

    file_path = db.Column(db.String(255), nullable=True)

    is_validated = db.Column(db.Boolean, default=False)
    validation_comment = db.Column(db.Text, default=None)

    validated_by = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=True
    )

    validated_at = db.Column(db.DateTime)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # 🔹 Back reference
    ticket = db.relationship(
        "Ticket",
        back_populates="documents"
    )

    validator = db.relationship(
        "User",
        foreign_keys=[validated_by],
        backref="validated_documents"
    )

    def __repr__(self):
        return f"<Document {self.document_type} ticket={self.ticket_id}>"
    
    def validate_document_type(self):
        """Valider le type de document"""
        if not DocumentType.is_valid(self.document_type):
            raise ValueError(f"Invalid document type: {self.document_type}")
    
    def to_dict(self):
        """Convertir le document en dictionnaire"""
        return {
            'id': self.id,
            'ticket_id': self.ticket_id,
            'document_type': self.document_type.value,
            'file_path': self.file_path,
            'is_validated': self.is_validated,
            'validation_comment': self.validation_comment,
            'validated_by': self.validated_by,
            'validated_at': self.validated_at.isoformat() if self.validated_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
