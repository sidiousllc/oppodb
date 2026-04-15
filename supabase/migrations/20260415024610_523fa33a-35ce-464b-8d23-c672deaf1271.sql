
CREATE TABLE public.fara_registrants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number text NOT NULL,
  registrant_name text NOT NULL,
  address text,
  state text,
  country text,
  registration_date date,
  termination_date date,
  status text NOT NULL DEFAULT 'active',
  foreign_principals jsonb NOT NULL DEFAULT '[]'::jsonb,
  short_form_agents jsonb NOT NULL DEFAULT '[]'::jsonb,
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL DEFAULT 'DOJ FARA',
  source_url text,
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(registration_number)
);

ALTER TABLE public.fara_registrants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read fara_registrants" ON public.fara_registrants
  FOR SELECT TO public USING (true);

CREATE POLICY "Service role can manage fara_registrants" ON public.fara_registrants
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TABLE public.state_legislative_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  openstates_id text NOT NULL,
  state_abbr text NOT NULL,
  session text NOT NULL,
  identifier text NOT NULL,
  title text NOT NULL,
  subjects text[] NOT NULL DEFAULT '{}',
  classification text[] NOT NULL DEFAULT '{}',
  latest_action_date date,
  latest_action_description text,
  first_action_date date,
  sponsor_name text,
  sponsor_party text,
  status text DEFAULT 'introduced',
  source_url text,
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(openstates_id)
);

ALTER TABLE public.state_legislative_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read state_legislative_bills" ON public.state_legislative_bills
  FOR SELECT TO public USING (true);

CREATE POLICY "Service role can manage state_legislative_bills" ON public.state_legislative_bills
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TABLE public.state_legislators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  openstates_id text NOT NULL,
  name text NOT NULL,
  first_name text,
  last_name text,
  party text,
  state_abbr text NOT NULL,
  chamber text NOT NULL DEFAULT 'lower',
  district text,
  image_url text,
  email text,
  capitol_office jsonb DEFAULT '{}'::jsonb,
  committees jsonb DEFAULT '[]'::jsonb,
  source_url text,
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(openstates_id)
);

ALTER TABLE public.state_legislators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read state_legislators" ON public.state_legislators
  FOR SELECT TO public USING (true);

CREATE POLICY "Service role can manage state_legislators" ON public.state_legislators
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
