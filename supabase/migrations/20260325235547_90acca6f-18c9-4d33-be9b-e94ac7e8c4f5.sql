
-- Drop the COALESCE-based index (PostgREST can't use expression indexes for onConflict)
DROP INDEX IF EXISTS idx_mit_election_upsert;

-- Create a plain unique index on the raw columns
-- We'll ensure the function sends '' instead of null for party and county_fips
CREATE UNIQUE INDEX idx_mit_election_upsert
  ON public.mit_election_results (year, state_po, office, district, candidate, party, county_fips);

-- Set existing nulls to empty string so the unique index works
UPDATE public.mit_election_results SET party = '' WHERE party IS NULL;
UPDATE public.mit_election_results SET county_fips = '' WHERE county_fips IS NULL;
UPDATE public.mit_election_results SET district = 'statewide' WHERE district IS NULL;

-- Make these columns NOT NULL with defaults
ALTER TABLE public.mit_election_results ALTER COLUMN party SET DEFAULT '';
ALTER TABLE public.mit_election_results ALTER COLUMN county_fips SET DEFAULT '';
ALTER TABLE public.mit_election_results ALTER COLUMN district SET DEFAULT 'statewide';
