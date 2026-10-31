-- Add RLS policies for admin to delete notifications
CREATE POLICY "Admins can manage all notifications"
ON public.notifications
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Add RLS policy for admin to delete profiles
CREATE POLICY "Admins can manage all profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Add RLS policy for admin to delete students
CREATE POLICY "Admins can delete students"
ON public.students
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));