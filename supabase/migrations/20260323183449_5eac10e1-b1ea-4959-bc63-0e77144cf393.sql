
-- Tighten batch_items insert to require authenticated + valid batch ownership
DROP POLICY IF EXISTS "Authenticated users can insert batch items" ON public.daily_batch_items;
CREATE POLICY "Users can insert batch items" ON public.daily_batch_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.daily_batches db
      WHERE db.id = batch_id
      AND (db.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

DROP POLICY IF EXISTS "Authenticated users can read batch items" ON public.daily_batch_items;
CREATE POLICY "Users can read batch items" ON public.daily_batch_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.daily_batches db
      WHERE db.id = batch_id
      AND (db.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

DROP POLICY IF EXISTS "Authenticated users can update batch items" ON public.daily_batch_items;
CREATE POLICY "Users can update batch items" ON public.daily_batch_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.daily_batches db
      WHERE db.id = batch_id
      AND (db.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- Tighten batches insert
DROP POLICY IF EXISTS "Authenticated users can insert batches" ON public.daily_batches;
CREATE POLICY "Users can insert batches" ON public.daily_batches
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can read batches" ON public.daily_batches;
CREATE POLICY "Users can read batches" ON public.daily_batches
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
