
-- Add LegiScan people_id to candidate_profiles for cross-referencing
ALTER TABLE public.candidate_profiles
ADD COLUMN legiscan_people_id integer,
ADD COLUMN legiscan_state text;

-- Index for quick lookups
CREATE INDEX idx_candidate_profiles_legiscan ON public.candidate_profiles (legiscan_people_id) WHERE legiscan_people_id IS NOT NULL;
