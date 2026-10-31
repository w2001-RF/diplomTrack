
-- =========================
-- Nouvelles tables Master Data
-- =========================

-- Table grades (pour les grades des professeurs)
CREATE TABLE IF NOT EXISTS public.grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    code TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table formation_types (remplace l'enum formation_type)
CREATE TABLE IF NOT EXISTS public.formation_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table departements
CREATE TABLE IF NOT EXISTS public.departements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    departement_name TEXT NOT NULL UNIQUE,
    chef_professor_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table professors
CREATE TABLE IF NOT EXISTS public.professors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    speciality TEXT,
    departement_id UUID REFERENCES public.departements(id) ON DELETE SET NULL,
    grade_id UUID REFERENCES public.grades(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ajouter la FK pour chef_professor_id après création de professors
ALTER TABLE public.departements 
ADD CONSTRAINT fk_departements_chef_professor 
FOREIGN KEY (chef_professor_id) REFERENCES public.professors(id) ON DELETE SET NULL;

-- Table formations (nouvelle structure)
CREATE TABLE IF NOT EXISTS public.formations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    formation_name TEXT NOT NULL,
    description TEXT,
    formation_type_id UUID NOT NULL REFERENCES public.formation_types(id),
    professor_responsible_id UUID NOT NULL REFERENCES public.professors(id),
    contact_professor_id UUID REFERENCES public.professors(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (formation_name, formation_type_id)
);

-- =========================
-- Table chronologies (historique détaillé des tickets)
-- =========================
CREATE TABLE IF NOT EXISTS public.chronologies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    milestone_id UUID NOT NULL REFERENCES public.milestones(id),
    status TEXT NOT NULL DEFAULT 'DONE',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    comment TEXT,
    blocked_reason TEXT,
    performed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- Table audit_logs
-- =========================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    performed_by UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    description TEXT,
    route TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- Modifications aux tables existantes
-- =========================

-- Ajouter les colonnes manquantes à profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN DEFAULT false;

-- Ajouter num_apogee et formation_id à students
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS num_apogee INTEGER UNIQUE,
ADD COLUMN IF NOT EXISTS formation_id UUID REFERENCES public.formations(id);

-- Ajouter description et is_terminal à milestones
ALTER TABLE public.milestones 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS is_terminal BOOLEAN DEFAULT false;

-- Modifier app_settings pour correspondre à app_config
ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS warning_delay_days INTEGER DEFAULT 14,
ADD COLUMN IF NOT EXISTS alerts_email TEXT,
ADD COLUMN IF NOT EXISTS notification_template_student TEXT,
ADD COLUMN IF NOT EXISTS notification_template_agent TEXT;

-- =========================
-- RLS Policies pour nouvelles tables
-- =========================

-- Grades
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view grades"
ON public.grades FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage grades"
ON public.grades FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Formation Types
ALTER TABLE public.formation_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view formation_types"
ON public.formation_types FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage formation_types"
ON public.formation_types FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Departements
ALTER TABLE public.departements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view departements"
ON public.departements FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage departements"
ON public.departements FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Professors
ALTER TABLE public.professors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view professors"
ON public.professors FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage professors"
ON public.professors FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Formations
ALTER TABLE public.formations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view formations"
ON public.formations FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage formations"
ON public.formations FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Chronologies
ALTER TABLE public.chronologies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all chronologies"
ON public.chronologies FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents can view and insert chronologies"
ON public.chronologies FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'agent'));

CREATE POLICY "Agents can insert chronologies"
ON public.chronologies FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'agent'));

CREATE POLICY "Students can view their own ticket chronologies"
ON public.chronologies FOR SELECT
TO authenticated
USING (
    ticket_id IN (
        SELECT t.id FROM tickets t
        JOIN students s ON t.student_id = s.id
        WHERE s.user_id = auth.uid()
    )
);

-- Audit Logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all audit_logs"
ON public.audit_logs FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents can insert audit_logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'agent'));

-- =========================
-- Fonction pour calculer les jours dans le milestone actuel
-- =========================
CREATE OR REPLACE FUNCTION public.get_days_in_current_milestone(p_ticket_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        EXTRACT(DAY FROM (now() - (
            SELECT MAX(created_at) 
            FROM chronologies 
            WHERE ticket_id = p_ticket_id
        )))::INTEGER,
        EXTRACT(DAY FROM (now() - (
            SELECT created_at 
            FROM tickets 
            WHERE id = p_ticket_id
        )))::INTEGER
    )
$$;

-- =========================
-- Indexes pour performance
-- =========================
CREATE INDEX IF NOT EXISTS idx_students_num_apogee ON public.students(num_apogee);
CREATE INDEX IF NOT EXISTS idx_students_email ON public.students(email);
CREATE INDEX IF NOT EXISTS idx_chronologies_ticket_id ON public.chronologies(ticket_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_professors_departement ON public.professors(departement_id);
CREATE INDEX IF NOT EXISTS idx_formations_type ON public.formations(formation_type_id);

-- =========================
-- Enable Realtime
-- =========================
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chronologies;
