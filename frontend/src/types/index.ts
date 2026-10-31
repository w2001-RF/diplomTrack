export type UserRole = 'STUDENT' | 'AGENT' | 'ADMIN';

export type FormationType = 'LUS' | 'MUS';

export type TicketStatus = 
  | 'CREATED'
  | 'DOSSIER_EN_COURS'
  | 'PIECES_COMPLETES'
  | 'EN_ATTENTE_REPONSE'
  | 'REPONSE_RECUE'
  | 'DOSSIER_CLOTURE'
  | 'BLOQUE_PIECE_MANQUANTE'
  | 'REJETE'
  | 'ARCHIVE';

export type DocumentType = 
  | 'BAC'
  | 'BAC_PLUS_2'
  | 'CIN'
  | 'CONTRAT'
  | 'RECU_PAIEMENT'
  | 'RETOUR_CFC'
  | 'PV_DIPLOME'
  | 'ATTESTATION_INSC';

export type DocumentStatus = 'PENDING' | 'VALIDATED' | 'REJECTED';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface Student {
  id: string;
  cne: string;
  nom: string;
  prenom: string;
  typeFormation: FormationType;
  formation: string;
  anneeUniversitaire: string;
  professeurResponsable: string;
  email: string;
  phone?: string;
}

export interface Milestone {
  id: string;
  code: TicketStatus;
  label: string;
  ordre: number;
  delaiMax: number; // in days
}

export interface Document {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  fileName: string;
  uploadedAt: string;
  validatedBy?: string;
  ticketId: string;
}

export interface Ticket {
  id: string;
  reference: string;
  status: TicketStatus;
  currentMilestoneId: string;
  student: Student;
  documents: Document[];
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  type: 'STATUS_CHANGE' | 'DOCUMENT_VALIDATED' | 'DOCUMENT_REJECTED' | 'DELAY_EXCEEDED' | 'MESSAGE';
  message: string;
  recipientId: string;
  sentAt: string;
  read: boolean;
}

export const MILESTONES: Milestone[] = [
  { id: '1', code: 'CREATED', label: 'Ticket créé', ordre: 1, delaiMax: 1 },
  { id: '2', code: 'DOSSIER_EN_COURS', label: 'Dossier en cours', ordre: 2, delaiMax: 7 },
  { id: '3', code: 'PIECES_COMPLETES', label: 'Pièces complètes', ordre: 3, delaiMax: 3 },
  { id: '5', code: 'EN_ATTENTE_REPONSE', label: 'En attente réponse', ordre: 6, delaiMax: 14 },
  { id: '6', code: 'REPONSE_RECUE', label: 'Réponse reçue', ordre: 7, delaiMax: 3 },
  { id: '7', code: 'DOSSIER_CLOTURE', label: 'Dossier clôturé', ordre: 8, delaiMax: 0 },
];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  BAC: 'Baccalauréat',
  BAC_PLUS_2: 'BAC+2',
  CIN: 'Carte d\'identité nationale',
  CONTRAT: 'Contrat',
  RECU_PAIEMENT: 'Reçu de paiement',
  RETOUR_CFC: 'Retour CFC',
  PV_DIPLOME: 'PV Diplôme',
  ATTESTATION_INSC: 'Attestation d\'inscription',
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  CREATED: 'Créé',
  DOSSIER_EN_COURS: 'Dossier en cours',
  PIECES_COMPLETES: 'Pièces complètes',
  EN_ATTENTE_REPONSE: 'En attente de réponse',
  REPONSE_RECUE: 'Réponse reçue',
  DOSSIER_CLOTURE: 'Clôturé',
  BLOQUE_PIECE_MANQUANTE: 'Bloqué - Pièce manquante',
  REJETE: 'Rejeté',
  ARCHIVE: 'Archivé',
};
