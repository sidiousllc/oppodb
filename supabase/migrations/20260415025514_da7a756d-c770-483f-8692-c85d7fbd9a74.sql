
-- Add social media and district offices columns to congress_members
ALTER TABLE public.congress_members
ADD COLUMN IF NOT EXISTS social_media jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS district_offices jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS fec_ids text[] DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS opensecrets_id text,
ADD COLUMN IF NOT EXISTS votesmart_id integer,
ADD COLUMN IF NOT EXISTS wikipedia text,
ADD COLUMN IF NOT EXISTS ballotpedia text,
ADD COLUMN IF NOT EXISTS contact_form text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS office_address text;

-- Inspector General reports table
CREATE TABLE public.ig_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspector text NOT NULL,
  inspector_url text,
  agency text NOT NULL,
  agency_name text NOT NULL,
  report_id text NOT NULL,
  title text NOT NULL,
  url text,
  published_on date,
  type text DEFAULT 'report',
  summary text DEFAULT '',
  topic text,
  pdf_url text,
  landing_url text,
  year integer,
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(inspector, report_id)
);

ALTER TABLE public.ig_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ig_reports" ON public.ig_reports
  FOR SELECT TO public USING (true);

CREATE POLICY "Service role can manage ig_reports" ON public.ig_reports
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Federal spending table (USASpending.gov contracts & grants)
CREATE TABLE public.federal_spending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  award_type text NOT NULL DEFAULT 'contract',
  recipient_name text NOT NULL,
  recipient_state text,
  recipient_district text,
  awarding_agency text,
  funding_agency text,
  description text DEFAULT '',
  award_amount numeric,
  total_obligation numeric,
  period_of_performance_start date,
  period_of_performance_end date,
  fiscal_year integer,
  naics_code text,
  naics_description text,
  cfda_number text,
  cfda_title text,
  place_of_performance_state text,
  place_of_performance_district text,
  award_id text,
  source text DEFAULT 'USASpending.gov',
  source_url text,
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(award_type, award_id)
);

ALTER TABLE public.federal_spending ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read federal_spending" ON public.federal_spending
  FOR SELECT TO public USING (true);

CREATE POLICY "Service role can manage federal_spending" ON public.federal_spending
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Congressional Record speeches table
CREATE TABLE public.congressional_record (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bioguide_id text,
  speaker_name text NOT NULL,
  chamber text NOT NULL,
  date date NOT NULL,
  title text DEFAULT '',
  content text DEFAULT '',
  volume integer,
  number integer,
  pages text,
  congress integer,
  session integer,
  category text DEFAULT 'speech',
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(bioguide_id, date, title)
);

ALTER TABLE public.congressional_record ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read congressional_record" ON public.congressional_record
  FOR SELECT TO public USING (true);

CREATE POLICY "Service role can manage congressional_record" ON public.congressional_record
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
