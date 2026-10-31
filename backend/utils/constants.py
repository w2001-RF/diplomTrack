VALID_TRANSITIONS = {
    "CREATED": ["DOSSIER_EN_COURS", "ATTENTE_DIPLOME", "ATTENTE_CORRECTION_DOCS"],
    
    # Workflow de correction de documents
    "ATTENTE_CORRECTION_DOCS": ["DOCS_CORRIGES_SOUMIS"],
    "DOCS_CORRIGES_SOUMIS": ["DOSSIER_EN_COURS", "ATTENTE_CORRECTION_DOCS"],  # Peut retourner si encore invalide
    
    # Workflow ATTESTATION
    "ATTENTE_DIPLOME": ["DIPLOME_DEPOSE"],
    "DIPLOME_DEPOSE": ["DIPLOME_ENVOYE_CENTRE"],
    "DIPLOME_ENVOYE_CENTRE": ["VALIDATION_CENTRE_RECUE"],
    "VALIDATION_CENTRE_RECUE": ["DOSSIER_EN_COURS"],
    
    # Workflow normal
    "DOSSIER_EN_COURS": ["ATTENTE_DIPLOME", "ATTENTE_CORRECTION_DOCS", "PIECES_COMPLETES", "ATTENTE_CORRECTION_DOCS"],  # Peut retourner en correction
    "PIECES_COMPLETES": ["EN_ATTENTE_REPONSE"],
    "EN_ATTENTE_REPONSE": ["REPONSE_RECUE"],
    "REPONSE_RECUE": ["DOSSIER_CLOTURE"]
}

# Milestones spécifiques au workflow ATTESTATION
ATTESTATION_WORKFLOW_MILESTONES = [
    "ATTENTE_DIPLOME",
    "DIPLOME_DEPOSE",
    "DIPLOME_ENVOYE_CENTRE",
    "VALIDATION_CENTRE_RECUE"
]

# Milestones spécifiques au workflow de correction
CORRECTION_WORKFLOW_MILESTONES = [
    "ATTENTE_CORRECTION_DOCS",
    "DOCS_CORRIGES_SOUMIS"
]

# Documents auto-validés (pour référence)
AUTO_VALIDATED_DOCUMENTS = [
    "BAC",
    "CIN",
    "CONTRAT",
    "RECU_PAIEMENT",
    "ATTESTATION_INSC",
    "BAC_PLUS_2",
    "BAC_PLUS_3"
]

class DocumentType:
    """Types de documents autorisés dans le système"""
    BAC = "BAC"
    BAC_PLUS_2 = "BAC+2"
    BAC_PLUS_3 = "BAC+3"
    CIN = "CIN"
    CONTRAT = "CONTRAT"
    RECU_PAIEMENT = "RECU_PAIEMENT"
    RETOUR_CFC = "RETOUR_CFC"
    PV_DIPLOME = "PV_DIPLOME"
    ATTESTATION_INSC = "ATTESTATION_INSC"
    
    @classmethod
    def all(cls):
        """Retourne tous les types de documents"""
        return [
            cls.BAC,
            cls.CIN,
            cls.CONTRAT,
            cls.RECU_PAIEMENT,
            cls.ATTESTATION_INSC,
            cls.BAC_PLUS_2,
            cls.BAC_PLUS_3,
            cls.RETOUR_CFC,
            cls.PV_DIPLOME,
        ]
    
    @classmethod
    def get_documents_by_formation_type(cls, formation_type_code):
        """Retourne tous les types de documents selon formation_type"""
        docs = cls.all()
        
        if formation_type_code == "LUS":
            docs.remove(cls.BAC_PLUS_3)
        elif formation_type_code == "MUS":
            docs.remove(cls.BAC_PLUS_2)
        
        return docs
    
    
    @classmethod
    def is_valid(cls, document_type):
        """Vérifie si le type de document est valide"""
        return document_type in cls.all()
    
    @classmethod
    def get_label(cls, document_type):
        """Retourne le label lisible du type de document"""
        labels = {
            cls.BAC: "Baccalauréat",
            cls.CIN: "Carte d'Identité Nationale",
            cls.CONTRAT: "Contrat",
            cls.RECU_PAIEMENT: "Reçu de Paiement",
            cls.ATTESTATION_INSC: "Attestation d'Inscription",
            cls.BAC_PLUS_2: "Diplôme BAC+2",
            cls.BAC_PLUS_3: "Diplôme BAC+3",
            cls.RETOUR_CFC: "Retour CFC",
            cls.PV_DIPLOME: "PV de Diplôme",
        }
        return labels.get(document_type, document_type)
    
    @classmethod
    def for_formation_type(cls, formation_type_code: str):
        """Get required documents for a formation type"""
        global AUTO_VALIDATED_DOCUMENTS
        base_docs = AUTO_VALIDATED_DOCUMENTS.copy()
        
        if formation_type_code == "LUS":
            return base_docs + [cls.BAC_PLUS_2]
        elif formation_type_code == "MUS":
            return base_docs + [cls.BAC_PLUS_3]
        
        return base_docs
    
    @classmethod
    def get_auto_validated_docs(cls):
        """Get Auto Validated Documents"""

        auto_validated_docs = [
            cls.BAC,
            cls.CIN,
            cls.CONTRAT,
            cls.RECU_PAIEMENT,
            cls.ATTESTATION_INSC,
            cls.BAC_PLUS_2,
            cls.BAC_PLUS_3
        ]
        
        return auto_validated_docs