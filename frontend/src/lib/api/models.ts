// Domain types for the Flask API (backend/).
//
// Hand-maintained: keep them in sync with the Marshmallow schemas in
// backend/schemas/ and the serializers in backend/routes/. Ids are typed as
// strings because the UI treats them as opaque route params, even though the
// backend uses integer primary keys.

import type { UserRole } from '@/constants/roles';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type AppRole = UserRole;

/** DocumentType in backend/utils/constants.py */
export type DocumentType =
  | 'BAC'
  | 'BAC+2'
  | 'BAC+3'
  | 'CIN'
  | 'CONTRAT'
  | 'RECU_PAIEMENT'
  | 'RETOUR_CFC'
  | 'PV_DIPLOME'
  | 'ATTESTATION_INSC';

/**
 * Milestone codes. The workflow graph lives in backend/utils/constants.py
 * (VALID_TRANSITIONS); the last group is still referenced by the UI but is
 * not part of that graph.
 */
export type TicketStatus =
  | 'CREATED'
  | 'DOSSIER_EN_COURS'
  | 'ATTENTE_CORRECTION_DOCS'
  | 'DOCS_CORRIGES_SOUMIS'
  | 'ATTENTE_DIPLOME'
  | 'DIPLOME_DEPOSE'
  | 'DIPLOME_ENVOYE_CENTRE'
  | 'VALIDATION_CENTRE_RECUE'
  | 'PIECES_COMPLETES'
  | 'EN_ATTENTE_REPONSE'
  | 'REPONSE_RECUE'
  | 'DOSSIER_CLOTURE'
  | 'BLOQUE_PIECE_MANQUANTE'
  | 'REJETE'
  | 'ARCHIVE';

export type NotificationType = 'info' | 'warning' | 'error' | 'success';

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

/**
 * GET /api/app_settings: one row per setting of the single AppConfig record
 * (AppSettingSerializer.serialize_field in backend/routes/data_routes.py)
 */
export interface AppSettingRow {
  id: string;
  key: string;
  value: string | number | boolean | null;
  type: 'string' | 'integer' | 'boolean' | 'text' | 'datetime' | string;
  description: string | null;
}
/** PATCH /api/app_settings/<id> takes {<key>: value} */
export type AppSettingUpdate = Record<string, unknown>;

/** /api/documents (DocumentSchema in backend/schemas/document_schema.py) */
export interface DocumentRow {
  id: number;
  ticket_id: number;
  document_type: DocumentType;
  /** Stored file name, or null until a file is uploaded */
  file_path: string | null;
  is_validated: boolean;
  validation_comment: string | null;
  validated_by: number | null;
  validated_at: string | null;
  created_at: string;
}

/** GET /api/milestones (MilestoneSerializer in backend/routes/data_routes.py) */
export interface MilestoneRow {
  id: string;
  code: TicketStatus;
  label: string;
  description: string | null;
  order: number;
  is_terminal: boolean | null;
}

/** /api/notifications (scoped to the current user by the JWT) */
export interface NotificationRow {
  id: string;
  user_id: string;
  ticket_id: string | null;
  type: NotificationType | string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

/** /api/profiles */
export interface ProfileRow {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  phone_number: string | null;
  is_active: boolean | null;
  must_reset_password: boolean | null;
  created_at: string;
  updated_at: string;
}
export type ProfileUpdate = Partial<ProfileRow>;

/** Nested professor (ProfessorMiniSchema in backend/schemas/ticket_schema.py) */
export interface ProfessorSummary {
  id: number;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  departement?: { id: number; name: string } | null;
}

/** Nested formation (FormationMiniSchema in backend/schemas/ticket_schema.py) */
export interface FormationSummary {
  id: number;
  formation_name: string;
  description?: string | null;
  formation_type?: { id?: number; code: string; label?: string } | null;
  professor_responsible?: ProfessorSummary | null;
}

/** /api/students */
export interface StudentRow {
  id: number;
  user_id: number | null;
  first_name: string;
  last_name: string;
  num_apogee: number | null;
  email: string | null;
  phone: string | null;
  formation_id: number | null;
  formation?: FormationSummary | null;
  academic_year: string;
  created_at: string;
  updated_at: string;
}
export type StudentInsert = Pick<StudentRow, 'first_name' | 'last_name' | 'num_apogee' | 'email' | 'academic_year'> &
  Partial<StudentRow>;
export type StudentUpdate = Partial<StudentRow>;

/** GET /api/ticket_milestone_history (ChronologieSerializer.serialize_transition) */
export interface MilestoneHistoryRow {
  id: string;
  ticket_id: string;
  from_milestone: MilestoneRow | null;
  to_milestone: MilestoneRow;
  changed_by: string;
  changed_at: string;
  notes: string | null;
  status?: string;
  blocked_reason?: string | null;
}
export type MilestoneHistoryInsert = Pick<MilestoneHistoryRow, 'ticket_id' | 'changed_by'> & Partial<MilestoneHistoryRow>;

/** /api/tickets */
export interface TicketRow {
  id: string;
  reference: string;
  student_id: string;
  /** Coarse state from the API (OPEN | PENDING | COMPLETED); use current_milestone.code for the workflow position */
  status: TicketStatus | 'OPEN' | 'PENDING' | 'COMPLETED';
  current_milestone_id: string | null;
  current_milestone?: Pick<MilestoneRow, 'id' | 'code' | 'label'> & Partial<MilestoneRow> | null;
  diploma_validation_type?: DiplomaValidationType | null;
  /** GET /api/tickets/<id> only */
  chronologies?: ChronologyRow[];
  created_at: string;
  updated_at: string;
}

export type DiplomaValidationType = 'DIPLOMA' | 'ATTESTATION';

/** A milestone a ticket went through (TicketFormatter.format_chronologies) */
export interface ChronologyRow {
  id: number;
  ticket_id: number;
  milestone_id: number;
  milestone: MilestoneRow;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  comment: string | null;
}
/** POST /api/tickets (TicketCreateSchema) */
export interface TicketInsert {
  student_id: number | string;
  initial_milestone_code: string;
  created_at?: string;
  comment?: string;
}
export type TicketUpdate = Partial<TicketRow>;

/** GET /api/user_roles */
export interface UserRoleRow {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}
export type UserRoleInsert = Pick<UserRoleRow, 'user_id' | 'role'> & Partial<UserRoleRow>;
export type UserRoleUpdate = Partial<UserRoleRow>;
