
-- 1) profiles table first
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'rep' CHECK (role IN ('admin','rep')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role
  );
END;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'rep');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2) industries
CREATE TABLE public.industries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  territory_type TEXT NOT NULL CHECK (territory_type IN ('METRO_ONLY','ALL_16')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.industries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read industries" ON public.industries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert industries" ON public.industries FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update industries" ON public.industries FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete industries" ON public.industries FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3) industry_modes
CREATE TABLE public.industry_modes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_id UUID NOT NULL REFERENCES public.industries(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true
);
ALTER TABLE public.industry_modes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read modes" ON public.industry_modes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert modes" ON public.industry_modes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update modes" ON public.industry_modes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4) regions
CREATE TABLE public.regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read regions" ON public.regions FOR SELECT TO authenticated USING (true);

-- 5) cities
CREATE TABLE public.cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  name TEXT UNIQUE NOT NULL,
  uf TEXT NOT NULL DEFAULT 'PA',
  is_kapazi_allowed BOOLEAN DEFAULT false,
  priority TEXT NOT NULL CHECK (priority IN ('P0','P1','P2')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read cities" ON public.cities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert cities" ON public.cities FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update cities" ON public.cities FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 6) contacts
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_id UUID NOT NULL REFERENCES public.industries(id),
  industry_mode_id UUID REFERENCES public.industry_modes(id),
  category TEXT NOT NULL CHECK (category IN ('ATIVO','INATIVO','NOVO_MAPS','NOVO_MANUAL')),
  company_name TEXT NOT NULL,
  company_name_normalized TEXT,
  contact_name TEXT,
  phone_raw TEXT,
  phone_normalized TEXT,
  whatsapp_link TEXT,
  instagram TEXT,
  website TEXT,
  address TEXT,
  neighborhood TEXT,
  city_id UUID REFERENCES public.cities(id),
  city_name TEXT,
  region_name TEXT,
  uf TEXT DEFAULT 'PA',
  niche TEXT,
  channel TEXT,
  last_order_date DATE,
  days_without_buying INT,
  source TEXT CHECK (source IN ('BASE_ATIVOS','BASE_INATIVOS','MAPS','MANUAL','INSTAGRAM')),
  status TEXT NOT NULL DEFAULT 'NAO_CONTATADO' CHECK (status IN ('NAO_CONTATADO','CONTATADO','RESPONDEU','QUALIFICADO','SEM_INTERESSE','SEM_RESPOSTA')),
  owner_user_id UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read contacts" ON public.contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update contacts" ON public.contacts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete contacts" ON public.contacts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_contacts_phone ON public.contacts(phone_normalized);
CREATE INDEX idx_contacts_company_city ON public.contacts(company_name_normalized, city_name);

-- 7) interactions
CREATE TABLE public.interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  channel TEXT NOT NULL CHECK (channel IN ('WHATSAPP','INSTAGRAM','LIGACAO','EMAIL','OUTRO')),
  stage TEXT CHECK (stage IN ('D0','D2','D5','D7','OBJECAO','OUTRO')),
  message_text TEXT,
  sent_at TIMESTAMPTZ,
  reply_text TEXT,
  reply_at TIMESTAMPTZ,
  outcome TEXT CHECK (outcome IN ('SEM_RESPOSTA','INTERESSADO','PEDIU_CATALOGO','PEDIU_PRECO','JA_TEM_FORNECEDOR','NAO_INTERESSA','OUTRO')),
  next_action_at TIMESTAMPTZ,
  next_action_type TEXT CHECK (next_action_type IN ('FOLLOWUP','LIGAR','ENVIAR_CATALOGO','VISITA','OUTRO')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read interactions" ON public.interactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert interactions" ON public.interactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update interactions" ON public.interactions FOR UPDATE TO authenticated USING (true);

-- 8) templates
CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_id UUID NOT NULL REFERENCES public.industries(id),
  industry_mode_id UUID REFERENCES public.industry_modes(id),
  category TEXT NOT NULL CHECK (category IN ('NOVO_MAPS','INATIVO','ATIVO')),
  stage TEXT NOT NULL CHECK (stage IN ('D0','D2','D5','D7','OBJECAO_JA_TENHO_FORNECEDOR')),
  template_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read templates" ON public.templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert templates" ON public.templates FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update templates" ON public.templates FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete templates" ON public.templates FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 9) daily_batches
CREATE TABLE public.daily_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_id UUID NOT NULL REFERENCES public.industries(id),
  industry_mode_id UUID REFERENCES public.industry_modes(id),
  city_id UUID NOT NULL REFERENCES public.cities(id),
  city_name TEXT,
  batch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES public.profiles(id),
  target_new_maps INT DEFAULT 15,
  target_inactive INT DEFAULT 10,
  target_active INT DEFAULT 5,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read batches" ON public.daily_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert batches" ON public.daily_batches FOR INSERT TO authenticated WITH CHECK (true);

-- 10) daily_batch_items
CREATE TABLE public.daily_batch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.daily_batches(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id),
  lane TEXT NOT NULL DEFAULT 'A_CONTATAR' CHECK (lane IN ('A_CONTATAR','CONTATADO','RESPONDEU','QUALIFICADO','SEM_INTERESSE')),
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_batch_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read batch items" ON public.daily_batch_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert batch items" ON public.daily_batch_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update batch items" ON public.daily_batch_items FOR UPDATE TO authenticated USING (true);
