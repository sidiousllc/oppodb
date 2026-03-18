
CREATE TABLE public.election_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  race_type text NOT NULL DEFAULT 'house',
  state_abbr text NOT NULL,
  district text,
  rating text,
  dem_win_prob numeric,
  rep_win_prob numeric,
  dem_vote_share numeric,
  rep_vote_share numeric,
  margin numeric,
  cycle integer NOT NULL DEFAULT 2026,
  last_updated date,
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source, race_type, state_abbr, district, cycle)
);

ALTER TABLE public.election_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read election_forecasts"
  ON public.election_forecasts FOR SELECT
  TO public USING (true);

CREATE POLICY "Service role can manage election_forecasts"
  ON public.election_forecasts FOR ALL
  TO public USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY "Admins can manage election_forecasts"
  ON public.election_forecasts FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
