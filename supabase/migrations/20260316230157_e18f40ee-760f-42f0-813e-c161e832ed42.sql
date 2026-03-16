
-- Campaign finance data table for FEC/OpenSecrets data
CREATE TABLE public.campaign_finance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_name TEXT NOT NULL,
  candidate_slug TEXT,
  office TEXT NOT NULL DEFAULT 'house',
  state_abbr TEXT NOT NULL,
  district TEXT,
  party TEXT,
  cycle INTEGER NOT NULL DEFAULT 2026,
  source TEXT NOT NULL DEFAULT 'FEC',
  source_url TEXT,
  total_raised NUMERIC,
  total_spent NUMERIC,
  cash_on_hand NUMERIC,
  total_debt NUMERIC,
  individual_contributions NUMERIC,
  pac_contributions NUMERIC,
  self_funding NUMERIC,
  small_dollar_pct NUMERIC,
  large_donor_pct NUMERIC,
  out_of_state_pct NUMERIC,
  top_industries JSONB DEFAULT '[]'::jsonb,
  top_contributors JSONB DEFAULT '[]'::jsonb,
  quarterly_data JSONB DEFAULT '[]'::jsonb,
  filing_date DATE,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaign_finance ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Anyone can read campaign_finance"
ON public.campaign_finance FOR SELECT
USING (true);

-- Admin write
CREATE POLICY "Admins can insert campaign_finance"
ON public.campaign_finance FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update campaign_finance"
ON public.campaign_finance FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete campaign_finance"
ON public.campaign_finance FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes
CREATE INDEX idx_campaign_finance_slug ON public.campaign_finance(candidate_slug);
CREATE INDEX idx_campaign_finance_state ON public.campaign_finance(state_abbr);
CREATE INDEX idx_campaign_finance_office ON public.campaign_finance(office);
CREATE INDEX idx_campaign_finance_cycle ON public.campaign_finance(cycle);
