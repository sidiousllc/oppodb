-- Phase 3: Forecasting
CREATE TABLE public.forecast_scenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  cycle INTEGER NOT NULL DEFAULT 2026,
  race_type TEXT NOT NULL DEFAULT 'house',
  assumptions JSONB NOT NULL DEFAULT '{}'::jsonb,
  rating_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  national_swing NUMERIC,
  projected_seats JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.forecast_simulations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scenario_id UUID REFERENCES public.forecast_scenarios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  iterations INTEGER NOT NULL DEFAULT 10000,
  results JSONB NOT NULL DEFAULT '{}'::jsonb,
  dem_win_pct NUMERIC,
  rep_win_pct NUMERIC,
  median_dem_seats INTEGER,
  median_rep_seats INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.polling_aggregates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  race_type TEXT NOT NULL,
  state_abbr TEXT NOT NULL,
  district TEXT,
  cycle INTEGER NOT NULL DEFAULT 2026,
  candidate_a TEXT,
  candidate_b TEXT,
  margin NUMERIC,
  candidate_a_pct NUMERIC,
  candidate_b_pct NUMERIC,
  undecided_pct NUMERIC,
  poll_count INTEGER NOT NULL DEFAULT 0,
  weighted_method TEXT NOT NULL DEFAULT 'pollster_rating',
  last_poll_date DATE,
  trend_30d NUMERIC,
  raw_data JSONB,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (race_type, state_abbr, district, cycle)
);

CREATE TABLE public.election_night_streams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  election_date DATE NOT NULL,
  race_type TEXT NOT NULL,
  state_abbr TEXT NOT NULL,
  district TEXT,
  county_fips TEXT,
  precinct TEXT,
  candidate_name TEXT NOT NULL,
  party TEXT,
  votes INTEGER,
  vote_pct NUMERIC,
  precincts_reporting_pct NUMERIC,
  is_called BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'AP',
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_data JSONB
);

CREATE INDEX idx_election_night_state_date ON public.election_night_streams(state_abbr, election_date);

-- Phase 4: Investigations
CREATE TABLE public.lobbying_disclosures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  filing_uuid TEXT UNIQUE,
  registrant_name TEXT NOT NULL,
  client_name TEXT,
  filing_year INTEGER,
  filing_period TEXT,
  amount NUMERIC,
  issues JSONB DEFAULT '[]'::jsonb,
  lobbyists JSONB DEFAULT '[]'::jsonb,
  govt_entities JSONB DEFAULT '[]'::jsonb,
  filing_date DATE,
  source TEXT NOT NULL DEFAULT 'Senate LDA',
  source_url TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lobbying_registrant ON public.lobbying_disclosures(registrant_name);
CREATE INDEX idx_lobbying_client ON public.lobbying_disclosures(client_name);

CREATE TABLE public.gov_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  award_id TEXT UNIQUE,
  recipient_name TEXT NOT NULL,
  recipient_uei TEXT,
  recipient_state TEXT,
  recipient_district TEXT,
  awarding_agency TEXT,
  award_amount NUMERIC,
  award_type TEXT,
  description TEXT,
  start_date DATE,
  end_date DATE,
  fiscal_year INTEGER,
  naics_code TEXT,
  source TEXT NOT NULL DEFAULT 'USAspending',
  source_url TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contracts_recipient ON public.gov_contracts(recipient_name);
CREATE INDEX idx_contracts_state ON public.gov_contracts(recipient_state);

CREATE TABLE public.court_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id TEXT UNIQUE,
  court TEXT NOT NULL,
  case_name TEXT NOT NULL,
  case_number TEXT,
  filed_date DATE,
  closed_date DATE,
  nature_of_suit TEXT,
  parties JSONB DEFAULT '[]'::jsonb,
  judge TEXT,
  status TEXT,
  docket_url TEXT,
  source TEXT NOT NULL DEFAULT 'CourtListener',
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_court_cases_name ON public.court_cases(case_name);

-- Entity graph
CREATE TABLE public.entity_relationships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_label TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_label TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  weight NUMERIC,
  amount NUMERIC,
  metadata JSONB DEFAULT '{}'::jsonb,
  observed_at DATE,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id, target_type, target_id, relationship_type)
);

CREATE INDEX idx_entity_rel_source ON public.entity_relationships(source_type, source_id);
CREATE INDEX idx_entity_rel_target ON public.entity_relationships(target_type, target_id);
CREATE INDEX idx_entity_rel_type ON public.entity_relationships(relationship_type);

CREATE TABLE public.graph_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  root_entity_type TEXT NOT NULL,
  root_entity_id TEXT NOT NULL,
  graph_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  filters JSONB DEFAULT '{}'::jsonb,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.forecast_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polling_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_night_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lobbying_disclosures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gov_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_snapshots ENABLE ROW LEVEL SECURITY;

-- Forecast scenarios: owners + shared
CREATE POLICY "Users view own or shared scenarios" ON public.forecast_scenarios FOR SELECT TO authenticated USING (auth.uid() = user_id OR is_shared = true OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own scenarios" ON public.forecast_scenarios FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own scenarios" ON public.forecast_scenarios FOR UPDATE TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users delete own scenarios" ON public.forecast_scenarios FOR DELETE TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

-- Simulations
CREATE POLICY "Users view own simulations" ON public.forecast_simulations FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own simulations" ON public.forecast_simulations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own simulations" ON public.forecast_simulations FOR DELETE TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

-- Polling aggregates: read-all, admin-write
CREATE POLICY "Authenticated read polling aggregates" ON public.polling_aggregates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage polling aggregates" ON public.polling_aggregates FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Election night streams
CREATE POLICY "Authenticated read election streams" ON public.election_night_streams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage election streams" ON public.election_night_streams FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Lobbying / Contracts / Court cases
CREATE POLICY "Authenticated read lobbying" ON public.lobbying_disclosures FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage lobbying" ON public.lobbying_disclosures FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read contracts" ON public.gov_contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage contracts" ON public.gov_contracts FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read court cases" ON public.court_cases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage court cases" ON public.court_cases FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Entity graph
CREATE POLICY "Authenticated read entity relationships" ON public.entity_relationships FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage entity relationships" ON public.entity_relationships FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own or shared graph snapshots" ON public.graph_snapshots FOR SELECT TO authenticated USING (auth.uid() = user_id OR is_shared = true OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own graph snapshots" ON public.graph_snapshots FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own graph snapshots" ON public.graph_snapshots FOR UPDATE TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users delete own graph snapshots" ON public.graph_snapshots FOR DELETE TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER trg_forecast_scenarios_updated BEFORE UPDATE ON public.forecast_scenarios FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_lobbying_updated BEFORE UPDATE ON public.lobbying_disclosures FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_contracts_updated BEFORE UPDATE ON public.gov_contracts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_court_cases_updated BEFORE UPDATE ON public.court_cases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_graph_snapshots_updated BEFORE UPDATE ON public.graph_snapshots FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();