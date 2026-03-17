-- Congress.gov Members
CREATE TABLE public.congress_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bioguide_id text UNIQUE NOT NULL,
  name text NOT NULL,
  first_name text,
  last_name text,
  party text,
  state text,
  district text,
  chamber text NOT NULL DEFAULT 'house',
  congress integer,
  terms jsonb DEFAULT '[]'::jsonb,
  leadership jsonb DEFAULT '[]'::jsonb,
  depiction_url text,
  official_url text,
  candidate_slug text,
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Congress.gov Bills (federal)
CREATE TABLE public.congress_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id text UNIQUE NOT NULL,
  congress integer NOT NULL,
  bill_type text NOT NULL,
  bill_number integer NOT NULL,
  title text NOT NULL,
  short_title text,
  introduced_date date,
  latest_action_text text,
  latest_action_date date,
  origin_chamber text,
  policy_area text,
  sponsor_bioguide_id text,
  sponsor_name text,
  cosponsor_count integer DEFAULT 0,
  cosponsors jsonb DEFAULT '[]'::jsonb,
  committees jsonb DEFAULT '[]'::jsonb,
  subjects jsonb DEFAULT '[]'::jsonb,
  actions jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'introduced',
  congress_url text,
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Congress Committees
CREATE TABLE public.congress_committees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_code text UNIQUE NOT NULL,
  name text NOT NULL,
  chamber text NOT NULL,
  committee_type text,
  parent_system_code text,
  url text,
  subcommittees jsonb DEFAULT '[]'::jsonb,
  members jsonb DEFAULT '[]'::jsonb,
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Roll Call Votes
CREATE TABLE public.congress_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id text UNIQUE NOT NULL,
  congress integer NOT NULL,
  session integer NOT NULL,
  chamber text NOT NULL,
  roll_number integer NOT NULL,
  vote_date date,
  question text,
  description text,
  result text,
  bill_id text,
  yea_total integer DEFAULT 0,
  nay_total integer DEFAULT 0,
  not_voting_total integer DEFAULT 0,
  present_total integer DEFAULT 0,
  member_votes jsonb DEFAULT '[]'::jsonb,
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.congress_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.congress_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.congress_committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.congress_votes ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Anyone can read congress_members" ON public.congress_members FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can read congress_bills" ON public.congress_bills FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can read congress_committees" ON public.congress_committees FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can read congress_votes" ON public.congress_votes FOR SELECT TO public USING (true);

-- Service role write policies
CREATE POLICY "Service role can manage congress_members" ON public.congress_members FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role can manage congress_bills" ON public.congress_bills FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role can manage congress_committees" ON public.congress_committees FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role can manage congress_votes" ON public.congress_votes FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Indexes
CREATE INDEX idx_congress_members_bioguide ON public.congress_members(bioguide_id);
CREATE INDEX idx_congress_members_state ON public.congress_members(state);
CREATE INDEX idx_congress_bills_congress ON public.congress_bills(congress);
CREATE INDEX idx_congress_bills_sponsor ON public.congress_bills(sponsor_bioguide_id);
CREATE INDEX idx_congress_votes_chamber ON public.congress_votes(chamber, congress);
CREATE INDEX idx_congress_committees_chamber ON public.congress_committees(chamber);