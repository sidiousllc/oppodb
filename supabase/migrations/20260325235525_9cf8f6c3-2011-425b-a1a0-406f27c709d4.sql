
-- Drop the partial unique index that PostgREST can't use for upserts
DROP INDEX IF EXISTS idx_mit_election_unique;

-- Create a regular (non-partial) unique constraint that PostgREST can use
CREATE UNIQUE INDEX idx_mit_election_upsert
  ON public.mit_election_results (year, state_po, office, district, candidate, COALESCE(party, ''), COALESCE(county_fips, ''));
