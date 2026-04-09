
-- Remove role column from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- Update handle_new_user to not reference role anymore
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'rep')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
