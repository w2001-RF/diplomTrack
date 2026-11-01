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

export type DocumentStatus = 'PENDING' | 'VALIDATED' | 'REJECTED';

export type DocumentType =
  | 'BAC'
  | 'BAC_PLUS_2'
  | 'BAC_PLUS_3'
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
  | 'VALIDATION_CFC'
  | 'ENVOYE_DEPARTEMENT_DIPLOMES'
  | 'BLOQUE_PIECE_MANQUANTE'
  | 'REJETE'
  | 'ARCHIVE';

export type NotificationType = 'info' | 'warning' | 'error' | 'success';

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

/** GET /api/app_settings */
export interface AppSettingRow {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
  alerts_email: string | null;
  warning_delay_days: number | null;
  notification_template_agent: string | null;
  notification_template_student: string | null;
  created_at: string;
  updated_at: string;
}
export type AppSettingUpdate = Partial<AppSettingRow>;

/** /api/documents */
export interface DocumentRow {
  id: string;
  ticket_id: string;
  type: DocumentType;
  file_name: string;
  file_url: string | null;
  status: DocumentStatus;
  rejection_reason: string | null;
  validated_at: string | null;
  validated_by: string | null;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
}
export type DocumentInsert = Pick<DocumentRow, 'ticket_id' | 'type' | 'file_name'> & Partial<DocumentRow>;
export type DocumentUpdate = Partial<DocumentRow>;

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

/** /api/students */
export interface StudentRow {
  id: number;
  user_id: string;
  first_name: string;
  last_name: string;
  num_apogee: string;
  email: string;
  phone: string | null;
  formation_id: number | null;
  academic_year: string;
  created_at: string;
  updated_at: string;
}
export type StudentInsert = Pick<StudentRow, 'first_name' | 'last_name' | 'num_apogee' | 'email' | 'academic_year'> &
  Partial<StudentRow>;
export type StudentUpdate = Partial<StudentRow>;

/** GET /api/ticket_milestone_history */
export interface MilestoneHistoryRow {
  id: string;
  ticket_id: string;
  from_milestone_id: string | null;
  to_milestone_id: string;
  changed_by: string;
  changed_at: string;
  notes: string | null;
}
export type MilestoneHistoryInsert = Pick<MilestoneHistoryRow, 'ticket_id' | 'to_milestone_id' | 'changed_by'> &
  Partial<MilestoneHistoryRow>;

/** /api/tickets */
export interface TicketRow {
  id: string;
  reference: string;
  student_id: string;
  status: TicketStatus;
  current_milestone_id: string | null;
  created_at: string;
  updated_at: string;
}
export type TicketInsert = Pick<TicketRow, 'student_id'> & Partial<TicketRow>;
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
