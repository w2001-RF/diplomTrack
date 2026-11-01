// Types for new database tables

export interface Grade {
  id: string;
  name: string;
  code: string | null;
  created_at: string;
}

export interface Departement {
  id: string;
  departement_name: string;
  chef_professor_id: string | null;
  created_at: string;
}

export interface Chronology {
  id: string;
  ticket_id: string;
  milestone_id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  ended_at: string | null;
  comment: string | null;
  blocked_reason: string | null;
  performed_by: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  performed_by: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string | null;
  route: string | null;
  ip_address: string | null;
  created_at: string;
}

// Extended profile with new fields
export interface ExtendedProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  phone_number: string | null;
  is_active: boolean;
  must_reset_password: boolean;
  created_at: string;
  updated_at: string;
}

// Extended student with new fields
export interface ExtendedStudent {
  id: string;
  user_id: number | null;
  first_name: string;
  last_name: string;
  num_apogee: number;
  email: string;
  formation_id: number;
  formation?: formationRow;
  acadelic_year: string;
  created_at: string;
}

// Extended milestone with new fields
export interface ExtendedMilestone {
  id: string;
  code: string;
  label: string;
  ordre: number;
  delai_max: number;
  description: string | null;
  is_terminal: boolean;
  created_at: string;
}

// Extended app settings
export interface AppConfig {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
  warning_delay_days: number;
  alerts_email: string | null;
  notification_template_student: string | null;
  notification_template_agent: string | null;
  created_at: string;
  updated_at: string;
}

// Professor with relations
export interface ProfessorWithRelations extends Professor {
  departement?: Departement | null;
  grade?: Grade | null;
}

// Formation with relations
export interface FormationWithRelations extends Formation {
  formation_type?: FormationType | null;
  professor_responsible?: Professor | null;
  contact_professor?: Professor | null;
}

// Chronology with relations
export interface ChronologyWithRelations extends Chronology {
  milestone?: ExtendedMilestone | null;
  performer?: ExtendedProfile | null;
}


export interface formationTypeRow {
  id: number;
  code: string;
  label: string;
};

export interface professorResponsibleRow {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
};

export interface formationRow {
  id: string;
  formation_name: string;
  description: string;
  formation_type: formationTypeRow;
  professeur_responsable?: professorResponsibleRow;
  created_at: string;
};

export interface StudentRow {
  id: string;
  user_id: number | null;
  first_name: string;
  last_name: string;
  num_apogee: number;
  email: string;
  formation_id: number;
  formation?: formationRow;
  academic_year: string;
  created_at: string;
};