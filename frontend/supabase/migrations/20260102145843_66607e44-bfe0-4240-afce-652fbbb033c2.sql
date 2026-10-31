-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);

-- System can insert notifications (via service role or triggers)
CREATE POLICY "Service role can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Create function to notify on ticket status change
CREATE OR REPLACE FUNCTION public.notify_ticket_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  student_user_id UUID;
  ticket_ref TEXT;
BEGIN
  -- Get the student's user_id and ticket reference
  SELECT s.user_id, NEW.reference INTO student_user_id, ticket_ref
  FROM students s
  WHERE s.id = NEW.student_id;

  -- Insert notification if status changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO notifications (user_id, title, message, type, ticket_id)
    VALUES (
      student_user_id,
      'Statut de ticket mis à jour',
      'Le statut de votre ticket ' || ticket_ref || ' a été changé en ' || NEW.status,
      'info',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for ticket status changes
CREATE TRIGGER on_ticket_status_change
  AFTER UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_ticket_status_change();