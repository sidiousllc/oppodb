
-- Generic state-level campaign finance candidates table (PA, MI, and future states)
CREATE TABLE public.state_cfb_candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state_abbr TEXT NOT NULL,
  reg_num TEXT NOT NULL,
  committee_name TEXT NOT NULL,
  candidate_name TEXT NOT NULL,
  chamber TEXT NOT NULL DEFAULT 'other',
  office TEXT DEFAULT NULL,
  party TEXT DEFAULT NULL,
  total_contributions NUMERIC NOT NULL DEFAULT 0,
  total_expenditures NUMERIC NOT NULL DEFAULT 0,
  net_cash NUMERIC NOT NULL DEFAULT 0,
  contribution_count INTEGER NOT NULL DEFAULT 0,
  expenditure_count INTEGER NOT NULL DEFAULT 0,
  in_kind_total NUMERIC NOT NULL DEFAULT 0,
  top_contributors JSONB NOT NULL DEFAULT '[]',
  contributor_types JSONB NOT NULL DEFAULT '[]',
  expenditure_types JSONB NOT NULL DEFAULT '[]',
  top_vendors JSONB NOT NULL DEFAULT '[]',
  years_active TEXT[] NOT NULL DEFAULT '{}',
  yearly_breakdown JSONB NOT NULL DEFAULT '[]',
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(state_abbr, reg_num)
);

-- Enable RLS
ALTER TABLE public.state_cfb_candidates ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can read state CFB candidates"
  ON public.state_cfb_candidates FOR SELECT
  USING (true);

-- Service role can manage
CREATE POLICY "Service role can manage state CFB candidates"
  ON public.state_cfb_candidates FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Indexes for fast lookups
CREATE INDEX idx_state_cfb_state ON public.state_cfb_candidates(state_abbr);
CREATE INDEX idx_state_cfb_name_trgm ON public.state_cfb_candidates USING GIN(candidate_name gin_trgm_ops);
CREATE INDEX idx_state_cfb_contributions ON public.state_cfb_candidates(total_contributions DESC);
