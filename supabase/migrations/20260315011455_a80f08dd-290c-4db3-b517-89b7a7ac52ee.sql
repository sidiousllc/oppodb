CREATE TABLE public.congressional_election_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_abbr text NOT NULL,
  district_number text NOT NULL,
  election_year integer NOT NULL,
  election_date date,
  election_type text NOT NULL DEFAULT 'general',
  candidate_name text NOT NULL,
  party text,
  votes integer,
  vote_pct numeric,
  is_winner boolean DEFAULT false,
  is_incumbent boolean DEFAULT false,
  is_write_in boolean DEFAULT false,
  total_votes integer,
  source text DEFAULT 'openelections',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(state_abbr, district_number, election_year, election_type, candidate_name)
);

ALTER TABLE public.congressional_election_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read congressional election results"
  ON public.congressional_election_results
  FOR SELECT TO public
  USING (true);

CREATE INDEX idx_cong_election_state_district 
  ON public.congressional_election_results(state_abbr, district_number);
CREATE INDEX idx_cong_election_year 
  ON public.congressional_election_results(election_year DESC);