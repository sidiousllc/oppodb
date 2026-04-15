
-- International Legislation table
CREATE TABLE public.international_legislation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '', -- legislature name (e.g. "European Parliament", "UK Parliament")
  bill_number TEXT,
  bill_type TEXT NOT NULL DEFAULT 'bill', -- law, bill, regulation, budget, resolution, directive, executive_order, decree
  status TEXT NOT NULL DEFAULT 'introduced', -- introduced, passed, enacted, rejected, pending, in_committee, royal_assent
  introduced_date DATE,
  enacted_date DATE,
  sponsor TEXT,
  summary TEXT NOT NULL DEFAULT '',
  full_text_url TEXT,
  source TEXT NOT NULL DEFAULT 'national', -- EU Parliament, UK Parliament, national, UN, etc.
  source_url TEXT,
  policy_area TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.international_legislation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read international_legislation"
  ON public.international_legislation FOR SELECT
  TO public USING (true);

CREATE POLICY "Service role can manage international_legislation"
  ON public.international_legislation FOR ALL
  TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_intl_leg_country ON public.international_legislation (country_code);
CREATE INDEX idx_intl_leg_type ON public.international_legislation (bill_type);
CREATE INDEX idx_intl_leg_tags ON public.international_legislation USING GIN (tags);

-- International Policy Issues table
CREATE TABLE public.international_policy_issues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'governance', -- economy, security, health, environment, human_rights, trade, immigration, education, technology, governance, energy, defense
  severity TEXT NOT NULL DEFAULT 'medium', -- critical, high, medium, low
  status TEXT NOT NULL DEFAULT 'active', -- active, resolved, escalating, monitoring, stalled
  description TEXT NOT NULL DEFAULT '',
  sources JSONB NOT NULL DEFAULT '[]', -- [{name, url, date}]
  started_date DATE,
  resolved_date DATE,
  affected_regions TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.international_policy_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read international_policy_issues"
  ON public.international_policy_issues FOR SELECT
  TO public USING (true);

CREATE POLICY "Service role can manage international_policy_issues"
  ON public.international_policy_issues FOR ALL
  TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_intl_issues_country ON public.international_policy_issues (country_code);
CREATE INDEX idx_intl_issues_category ON public.international_policy_issues (category);
CREATE INDEX idx_intl_issues_severity ON public.international_policy_issues (severity);
CREATE INDEX idx_intl_issues_tags ON public.international_policy_issues USING GIN (tags);
