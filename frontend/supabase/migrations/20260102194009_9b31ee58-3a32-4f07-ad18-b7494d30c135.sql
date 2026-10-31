-- Create app_settings table for admin configuration
CREATE TABLE public.app_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage app_settings
CREATE POLICY "Admins can manage app_settings"
ON public.app_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- All authenticated users can read settings (for notification templates etc)
CREATE POLICY "Authenticated users can view settings"
ON public.app_settings
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Insert default settings
INSERT INTO public.app_settings (key, value, description) VALUES
  ('warning_delay_days', '7', 'Délai d''alerte en jours avant expiration'),
  ('alerts_email', 'admin@uit.ac.ma', 'Email pour recevoir les alertes système'),
  ('notification_template_student', 'Bonjour {nom}, votre dossier {reference} a été mis à jour.', 'Template de notification pour les étudiants'),
  ('notification_template_agent', 'Nouveau dossier {reference} assigné pour traitement.', 'Template de notification pour les agents'),
  ('max_upload_size_mb', '10', 'Taille maximale des fichiers en MB'),
  ('auto_archive_days', '365', 'Jours avant archivage automatique des dossiers clôturés');

-- Create trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();