-- Voter File Infrastructure

-- Voter registration statistics by state (aggregate, not individual-level)
CREATE TABLE IF NOT EXISTS public.state_voter_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL,
  state_fips TEXT NOT NULL,
  report_date DATE NOT NULL,
  total_registered INTEGER,
  total_eligible INTEGER,
  registration_rate NUMERIC(5,2),
  party_democrat INTEGER,
  party_republican INTEGER,
  party_independent INTEGER,
  party_other INTEGER,
  turnout_primary_2024 INTEGER,
  turnout_general_2024 INTEGER,
  source TEXT,
  source_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(state, report_date)
);

-- Individual voter records (from states with public data)
CREATE TABLE IF NOT EXISTS public.voter_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id TEXT,
  state TEXT NOT NULL,
  state_fips TEXT,
  county TEXT,
  first_name TEXT,
  middle_name TEXT,
  last_name TEXT,
  suffix TEXT,
  full_name TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  zip_code TEXT,
  party TEXT,
  registration_date DATE,
  registration_status TEXT,
  congressional_district TEXT,
  state_house_district TEXT,
  state_senate_district TEXT,
  precinct TEXT,
  date_of_birth NUMERIC,
  gender TEXT,
  race TEXT,
  vote_primary_2024 BOOLEAN,
  vote_general_2024 BOOLEAN,
  vote_primary_2022 BOOLEAN,
  vote_general_2022 BOOLEAN,
  vote_primary_2020 BOOLEAN,
  vote_general_2020 BOOLEAN,
  vote_primary_2018 BOOLEAN,
  vote_general_2018 BOOLEAN,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  source TEXT,
  source_file TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voter_records_state ON voter_records(state);
CREATE INDEX idx_voter_records_county ON voter_records(state, county);
CREATE INDEX idx_voter_records_precinct ON voter_records(state, congressional_district);
CREATE INDEX idx_voter_records_party ON voter_records(state, party);

-- Voter data source tracking
CREATE TABLE IF NOT EXISTS public.voter_data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL UNIQUE,
  state_fips TEXT NOT NULL,
  has_public_data BOOLEAN DEFAULT FALSE,
  data_url TEXT,
  data_format TEXT,
  refresh_frequency TEXT,
  last_fetched TIMESTAMPTZ,
  record_count INTEGER,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voter portal lookup logs
CREATE TABLE IF NOT EXISTS public.voter_lookup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  search_type TEXT NOT NULL,
  state TEXT,
  input_data JSONB,
  result_count INTEGER,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- State voter portal API endpoints (for lookup feature)
CREATE TABLE IF NOT EXISTS public.state_voter_portals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL UNIQUE,
  state_fips TEXT NOT NULL,
  portal_name TEXT,
  lookup_url TEXT,
  api_endpoint TEXT,
  api_type TEXT,
  requires_api_key BOOLEAN DEFAULT FALSE,
  api_key_env_var TEXT,
  rate_limit TEXT,
  has_district_lookup BOOLEAN DEFAULT FALSE,
  has_voter_status_lookup BOOLEAN DEFAULT FALSE,
  has_sample_ballot BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE state_voter_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE voter_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE voter_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE voter_lookup_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_voter_portals ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can read state_voter_stats"
  ON state_voter_stats FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage state_voter_stats"
  ON state_voter_stats FOR ALL TO service_role USING (true);

CREATE POLICY "Authenticated users can read voter_data_sources"
  ON voter_data_sources FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage voter_data_sources"
  ON voter_data_sources FOR ALL TO service_role USING (true);

CREATE POLICY "Authenticated users can read state_voter_portals"
  ON state_voter_portals FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage state_voter_portals"
  ON state_voter_portals FOR ALL TO service_role USING (true);

CREATE POLICY "Authenticated users can insert voter_lookup_logs"
  ON voter_lookup_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can read their own lookup logs"
  ON voter_lookup_logs FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can read voter records"
  ON voter_records FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage voter records"
  ON voter_records FOR ALL TO service_role USING (true);
