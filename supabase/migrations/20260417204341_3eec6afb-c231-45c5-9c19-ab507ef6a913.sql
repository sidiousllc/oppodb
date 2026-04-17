-- Add structured geopolitics cache to international_profiles.
-- Stores alliances/blocs, rivalries/conflicts, military posture, trade,
-- and a list of sources used to generate the brief.
ALTER TABLE public.international_profiles
  ADD COLUMN IF NOT EXISTS geopolitics jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS geopolitics_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS geopolitics_model text;

CREATE INDEX IF NOT EXISTS idx_intl_profiles_geopolitics_generated_at
  ON public.international_profiles (geopolitics_generated_at);