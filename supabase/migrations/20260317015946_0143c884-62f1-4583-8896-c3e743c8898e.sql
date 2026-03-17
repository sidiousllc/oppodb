
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE public.mn_cfb_candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reg_num TEXT NOT NULL UNIQUE,
  committee_name TEXT NOT NULL,
  candidate_name TEXT NOT NULL,
  chamber TEXT NOT NULL DEFAULT 'other',
  total_contributions NUMERIC NOT NULL DEFAULT 0,
  total_expenditures NUMERIC NOT NULL DEFAULT 0,
  net_cash NUMERIC NOT NULL DEFAULT 0,
  contribution_count INTEGER NOT NULL DEFAULT 0,
  expenditure_count INTEGER NOT NULL DEFAULT 0,
  in_kind_total NUMERIC NOT NULL DEFAULT 0,
  years_active TEXT[] NOT NULL DEFAULT '{}',
  top_contributors JSONB NOT NULL DEFAULT '[]',
  contributor_types JSONB NOT NULL DEFAULT '[]',
  expenditure_types JSONB NOT NULL DEFAULT '[]',
  top_vendors JSONB NOT NULL DEFAULT '[]',
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mn_cfb_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read MN CFB candidates"
ON public.mn_cfb_candidates FOR SELECT USING (true);

CREATE POLICY "Service role can manage MN CFB candidates"
ON public.mn_cfb_candidates FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_mn_cfb_candidates_chamber ON public.mn_cfb_candidates(chamber);
CREATE INDEX idx_mn_cfb_candidates_name ON public.mn_cfb_candidates USING gin(candidate_name gin_trgm_ops);
