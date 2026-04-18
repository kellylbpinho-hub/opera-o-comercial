ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS industry_tags text[] DEFAULT ARRAY[]::text[];

CREATE INDEX IF NOT EXISTS idx_contacts_industry_tags ON public.contacts USING GIN (industry_tags);