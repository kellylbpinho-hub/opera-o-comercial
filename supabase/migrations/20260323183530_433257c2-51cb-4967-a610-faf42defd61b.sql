
-- Tighten contacts insert to set owner
DROP POLICY IF EXISTS "Users can insert contacts" ON public.contacts;
CREATE POLICY "Users can insert contacts" ON public.contacts
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid() OR owner_user_id IS NULL OR public.has_role(auth.uid(), 'admin')
  );
