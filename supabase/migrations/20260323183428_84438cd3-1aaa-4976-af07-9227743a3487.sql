
-- 1) Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'rep')),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Only admins can manage user_roles, users can read their own
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, role FROM public.profiles
ON CONFLICT (user_id, role) DO NOTHING;

-- 3) Update has_role function to use user_roles table
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4) Auto-assign 'rep' role on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'rep');
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'rep')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 5) Add soft delete to contacts
ALTER TABLE public.contacts ADD COLUMN deleted_at timestamptz DEFAULT NULL;

-- 6) Add unique constraint on daily_batches to prevent duplicate batches
ALTER TABLE public.daily_batches ADD CONSTRAINT unique_batch_per_day
  UNIQUE (industry_id, city_id, batch_date);

-- 7) Update RLS on contacts: rep sees only own records
DROP POLICY IF EXISTS "Authenticated users can read contacts" ON public.contacts;
CREATE POLICY "Users can read contacts" ON public.contacts
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR owner_user_id = auth.uid()
    OR owner_user_id IS NULL
  );

DROP POLICY IF EXISTS "Authenticated users can update contacts" ON public.contacts;
CREATE POLICY "Users can update contacts" ON public.contacts
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR owner_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Authenticated users can insert contacts" ON public.contacts;
CREATE POLICY "Users can insert contacts" ON public.contacts
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 8) Update RLS on interactions: rep sees only own
DROP POLICY IF EXISTS "Authenticated users can read interactions" ON public.interactions;
CREATE POLICY "Users can read interactions" ON public.interactions
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Authenticated users can update interactions" ON public.interactions;
CREATE POLICY "Users can update interactions" ON public.interactions
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Authenticated users can insert interactions" ON public.interactions;
CREATE POLICY "Users can insert interactions" ON public.interactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 9) Prevent reps from updating their own role in profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
