
CREATE TABLE public.district_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id text NOT NULL UNIQUE,
  state text NOT NULL DEFAULT '',
  population integer,
  median_age numeric(5,1),
  median_income integer,
  education_bachelor_pct numeric(5,1),
  top_issues text[] NOT NULL DEFAULT '{}',
  voting_patterns jsonb DEFAULT '{}',
  raw_data jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.district_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read district profiles"
  ON public.district_profiles
  FOR SELECT
  TO public
  USING (true);
