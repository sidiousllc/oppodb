
-- International country profiles
CREATE TABLE public.international_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code TEXT NOT NULL,
  country_name TEXT NOT NULL,
  continent TEXT NOT NULL,
  region TEXT,
  population BIGINT,
  median_age NUMERIC,
  gdp NUMERIC,
  gdp_per_capita NUMERIC,
  unemployment_rate NUMERIC,
  poverty_rate NUMERIC,
  government_type TEXT,
  head_of_state TEXT,
  head_of_government TEXT,
  ruling_party TEXT,
  opposition_parties JSONB DEFAULT '[]'::jsonb,
  last_election_date DATE,
  next_election_date DATE,
  election_type TEXT,
  election_results JSONB DEFAULT '{}'::jsonb,
  major_industries TEXT[],
  trade_partners JSONB DEFAULT '[]'::jsonb,
  currency TEXT,
  inflation_rate NUMERIC,
  human_dev_index NUMERIC,
  press_freedom_rank INTEGER,
  corruption_index NUMERIC,
  capital TEXT,
  official_languages TEXT[],
  area_sq_km NUMERIC,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(country_code)
);

ALTER TABLE public.international_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read international_profiles"
  ON public.international_profiles FOR SELECT TO public
  USING (true);

CREATE POLICY "Service role can manage international_profiles"
  ON public.international_profiles FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- International election history
CREATE TABLE public.international_elections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code TEXT NOT NULL,
  election_year INTEGER NOT NULL,
  election_type TEXT NOT NULL DEFAULT 'general',
  election_date DATE,
  candidates JSONB DEFAULT '[]'::jsonb,
  results JSONB DEFAULT '{}'::jsonb,
  turnout_pct NUMERIC,
  winner_name TEXT,
  winner_party TEXT,
  source TEXT,
  source_url TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.international_elections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read international_elections"
  ON public.international_elections FOR SELECT TO public
  USING (true);

CREATE POLICY "Service role can manage international_elections"
  ON public.international_elections FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- International leaders
CREATE TABLE public.international_leaders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code TEXT NOT NULL,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  party TEXT,
  in_office_since DATE,
  term_ends DATE,
  previous_positions JSONB DEFAULT '[]'::jsonb,
  bio TEXT,
  image_url TEXT,
  controversies JSONB DEFAULT '[]'::jsonb,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.international_leaders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read international_leaders"
  ON public.international_leaders FOR SELECT TO public
  USING (true);

CREATE POLICY "Service role can manage international_leaders"
  ON public.international_leaders FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Indexes
CREATE INDEX idx_intl_profiles_country ON public.international_profiles(country_code);
CREATE INDEX idx_intl_profiles_continent ON public.international_profiles(continent);
CREATE INDEX idx_intl_elections_country ON public.international_elections(country_code);
CREATE INDEX idx_intl_leaders_country ON public.international_leaders(country_code);
