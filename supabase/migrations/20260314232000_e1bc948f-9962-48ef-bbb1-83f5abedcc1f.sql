
-- State legislative district profiles (state house & state senate)
CREATE TABLE public.state_legislative_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id text NOT NULL,
  chamber text NOT NULL CHECK (chamber IN ('house', 'senate')),
  state text NOT NULL DEFAULT '',
  state_abbr text NOT NULL DEFAULT '',
  district_number text NOT NULL DEFAULT '',
  population integer,
  median_age numeric,
  median_income integer,
  education_bachelor_pct numeric,
  poverty_rate numeric,
  unemployment_rate numeric,
  white_pct numeric,
  black_pct numeric,
  hispanic_pct numeric,
  asian_pct numeric,
  owner_occupied_pct numeric,
  median_home_value integer,
  median_rent integer,
  veteran_pct numeric,
  foreign_born_pct numeric,
  uninsured_pct numeric,
  total_households integer,
  avg_household_size numeric,
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (district_id, chamber)
);

-- Enable RLS
ALTER TABLE public.state_legislative_profiles ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can read state_legislative_profiles"
  ON public.state_legislative_profiles FOR SELECT TO public
  USING (true);

-- Admins can manage
CREATE POLICY "Admins can insert state_legislative_profiles"
  ON public.state_legislative_profiles FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update state_legislative_profiles"
  ON public.state_legislative_profiles FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete state_legislative_profiles"
  ON public.state_legislative_profiles FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for fast lookups
CREATE INDEX idx_state_leg_state ON public.state_legislative_profiles(state_abbr);
CREATE INDEX idx_state_leg_chamber ON public.state_legislative_profiles(chamber);
CREATE INDEX idx_state_leg_district ON public.state_legislative_profiles(district_id);
