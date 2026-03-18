
-- Table for presidential and senate election returns from MIT Election Lab
CREATE TABLE IF NOT EXISTS public.mit_election_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  state text NOT NULL,
  state_po text NOT NULL,
  office text NOT NULL, -- 'US PRESIDENT', 'US SENATE'
  district text DEFAULT 'statewide',
  county_name text,
  county_fips text,
  stage text NOT NULL DEFAULT 'gen',
  special boolean NOT NULL DEFAULT false,
  candidate text NOT NULL,
  party text,
  writein boolean NOT NULL DEFAULT false,
  candidatevotes integer,
  totalvotes integer,
  source text NOT NULL DEFAULT 'mit_election_lab',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_mit_election_state_year ON public.mit_election_results (state_po, year);
CREATE INDEX IF NOT EXISTS idx_mit_election_office ON public.mit_election_results (office, year);
CREATE INDEX IF NOT EXISTS idx_mit_election_candidate ON public.mit_election_results USING gin (candidate gin_trgm_ops);

-- Unique constraint for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_mit_election_unique 
ON public.mit_election_results (year, state_po, office, district, candidate, party, COALESCE(county_fips, ''))
WHERE stage = 'gen';

-- RLS
ALTER TABLE public.mit_election_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read mit_election_results"
ON public.mit_election_results FOR SELECT TO public
USING (true);

CREATE POLICY "Service role can manage mit_election_results"
ON public.mit_election_results FOR ALL TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
