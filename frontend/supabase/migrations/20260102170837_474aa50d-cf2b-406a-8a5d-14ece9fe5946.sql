-- Create milestone history table to track changes
CREATE TABLE public.ticket_milestone_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  from_milestone_id UUID REFERENCES public.milestones(id),
  to_milestone_id UUID NOT NULL REFERENCES public.milestones(id),
  changed_by UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.ticket_milestone_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all milestone history"
ON public.ticket_milestone_history
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents can view and insert milestone history"
ON public.ticket_milestone_history
FOR SELECT
USING (has_role(auth.uid(), 'agent'));

CREATE POLICY "Agents can insert milestone history"
ON public.ticket_milestone_history
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'agent'));

CREATE POLICY "Students can view their own ticket milestone history"
ON public.ticket_milestone_history
FOR SELECT
USING (
  ticket_id IN (
    SELECT t.id FROM tickets t
    JOIN students s ON t.student_id = s.id
    WHERE s.user_id = auth.uid()
  )
);

-- Create index for faster queries
CREATE INDEX idx_ticket_milestone_history_ticket_id ON public.ticket_milestone_history(ticket_id);
CREATE INDEX idx_ticket_milestone_history_changed_at ON public.ticket_milestone_history(changed_at DESC);