
-- Create enums for ticket statuses, formation types, and document types
CREATE TYPE public.ticket_status AS ENUM (
  'CREATED',
  'DOSSIER_EN_COURS',
  'PIECES_COMPLETES',
  'VALIDATION_CFC',
  'ENVOYE_DEPARTEMENT_DIPLOMES',
  'EN_ATTENTE_REPONSE',
  'REPONSE_RECUE',
  'DOSSIER_CLOTURE',
  'BLOQUE_PIECE_MANQUANTE',
  'REJETE',
  'ARCHIVE'
);

CREATE TYPE public.formation_type AS ENUM ('LUS', 'MUS');

CREATE TYPE public.document_type AS ENUM (
  'BAC',
  'BAC_PLUS_2',
  'CIN',
  'CONTRAT',
  'RECU_PAIEMENT',
  'RETOUR_CFC',
  'PV_DIPLOME',
  'ATTESTATION_INSC'
);

CREATE TYPE public.document_status AS ENUM ('PENDING', 'VALIDATED', 'REJECTED');

-- Create students table
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  cne TEXT NOT NULL UNIQUE,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  type_formation formation_type NOT NULL,
  formation TEXT NOT NULL,
  annee_universitaire TEXT NOT NULL,
  professeur_responsable TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create milestones table (reference for workflow stages)
CREATE TABLE public.milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code ticket_status NOT NULL UNIQUE,
  label TEXT NOT NULL,
  ordre INTEGER NOT NULL,
  delai_max INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create tickets table
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  status ticket_status NOT NULL DEFAULT 'CREATED',
  current_milestone_id UUID REFERENCES public.milestones(id),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create documents table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  type document_type NOT NULL,
  status document_status NOT NULL DEFAULT 'PENDING',
  file_name TEXT NOT NULL,
  file_url TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for students table
CREATE POLICY "Students can view their own record"
ON public.students FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Students can update their own record"
ON public.students FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Agents can view all students"
ON public.students FOR SELECT
USING (public.has_role(auth.uid(), 'agent'));

CREATE POLICY "Admins can view all students"
ON public.students FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all students"
ON public.students FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for milestones (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view milestones"
ON public.milestones FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage milestones"
ON public.milestones FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for tickets table
CREATE POLICY "Students can view their own tickets"
ON public.tickets FOR SELECT
USING (
  student_id IN (
    SELECT id FROM public.students WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Students can create tickets for themselves"
ON public.tickets FOR INSERT
WITH CHECK (
  student_id IN (
    SELECT id FROM public.students WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Agents can view all tickets"
ON public.tickets FOR SELECT
USING (public.has_role(auth.uid(), 'agent'));

CREATE POLICY "Agents can update tickets"
ON public.tickets FOR UPDATE
USING (public.has_role(auth.uid(), 'agent'));

CREATE POLICY "Admins can manage all tickets"
ON public.tickets FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for documents table
CREATE POLICY "Students can view their own documents"
ON public.documents FOR SELECT
USING (
  ticket_id IN (
    SELECT t.id FROM public.tickets t
    JOIN public.students s ON t.student_id = s.id
    WHERE s.user_id = auth.uid()
  )
);

CREATE POLICY "Students can upload documents to their tickets"
ON public.documents FOR INSERT
WITH CHECK (
  ticket_id IN (
    SELECT t.id FROM public.tickets t
    JOIN public.students s ON t.student_id = s.id
    WHERE s.user_id = auth.uid()
  )
);

CREATE POLICY "Agents can view all documents"
ON public.documents FOR SELECT
USING (public.has_role(auth.uid(), 'agent'));

CREATE POLICY "Agents can update documents"
ON public.documents FOR UPDATE
USING (public.has_role(auth.uid(), 'agent'));

CREATE POLICY "Admins can manage all documents"
ON public.documents FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create triggers for updated_at
CREATE TRIGGER update_students_updated_at
BEFORE UPDATE ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default milestones
INSERT INTO public.milestones (code, label, ordre, delai_max) VALUES
  ('CREATED', 'Ticket créé', 1, 1),
  ('DOSSIER_EN_COURS', 'Dossier en cours', 2, 7),
  ('PIECES_COMPLETES', 'Pièces complètes', 3, 3),
  ('VALIDATION_CFC', 'Validation CFC', 4, 5),
  ('ENVOYE_DEPARTEMENT_DIPLOMES', 'Envoyé au Département', 5, 2),
  ('EN_ATTENTE_REPONSE', 'En attente réponse', 6, 14),
  ('REPONSE_RECUE', 'Réponse reçue', 7, 3),
  ('DOSSIER_CLOTURE', 'Dossier clôturé', 8, 0),
  ('BLOQUE_PIECE_MANQUANTE', 'Bloqué - Pièce manquante', 9, 0),
  ('REJETE', 'Rejeté', 10, 0),
  ('ARCHIVE', 'Archivé', 11, 0);

-- Function to generate ticket reference
CREATE OR REPLACE FUNCTION public.generate_ticket_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.reference := 'TKT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
    LPAD(CAST((SELECT COUNT(*) + 1 FROM public.tickets WHERE DATE(created_at) = CURRENT_DATE) AS TEXT), 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_ticket_reference_trigger
BEFORE INSERT ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.generate_ticket_reference();
