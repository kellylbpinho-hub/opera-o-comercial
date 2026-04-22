-- Consolidate duplicate "Forte Plástico" industry: keep FORTE_PLASTICO, remove FORTE
DO $$
DECLARE
  correct_id uuid;
  dup_id uuid;
BEGIN
  SELECT id INTO correct_id FROM public.industries WHERE key = 'FORTE_PLASTICO' LIMIT 1;
  SELECT id INTO dup_id     FROM public.industries WHERE key = 'FORTE'           LIMIT 1;

  IF correct_id IS NULL OR dup_id IS NULL OR correct_id = dup_id THEN
    RAISE NOTICE 'Nothing to consolidate (correct=%, dup=%)', correct_id, dup_id;
    RETURN;
  END IF;

  -- Remap any references from the duplicate to the correct industry
  UPDATE public.contacts        SET industry_id = correct_id WHERE industry_id = dup_id;
  UPDATE public.daily_batches   SET industry_id = correct_id WHERE industry_id = dup_id;
  UPDATE public.industry_modes  SET industry_id = correct_id WHERE industry_id = dup_id;

  -- Templates: avoid creating duplicates (same stage+category+mode) when remapping
  DELETE FROM public.templates t1
  WHERE t1.industry_id = dup_id
    AND EXISTS (
      SELECT 1 FROM public.templates t2
      WHERE t2.industry_id = correct_id
        AND t2.stage = t1.stage
        AND t2.category = t1.category
        AND COALESCE(t2.industry_mode_id::text, '') = COALESCE(t1.industry_mode_id::text, '')
    );
  UPDATE public.templates SET industry_id = correct_id WHERE industry_id = dup_id;

  -- Finally, remove the duplicate industry record
  DELETE FROM public.industries WHERE id = dup_id;
END $$;