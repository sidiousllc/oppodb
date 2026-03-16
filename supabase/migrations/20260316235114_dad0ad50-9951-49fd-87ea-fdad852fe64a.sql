-- Add unique constraint for campaign_finance upsert
CREATE UNIQUE INDEX IF NOT EXISTS campaign_finance_slug_state_cycle_office_idx
ON public.campaign_finance (candidate_slug, state_abbr, cycle, office);
