CREATE TABLE public.state_voter_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL UNIQUE,
  total_registered integer DEFAULT 0,
  total_eligible integer DEFAULT 0,
  registration_rate numeric DEFAULT 0,
  turnout_general_2024 numeric,
  source text DEFAULT 'EAVS',
  source_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.state_voter_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read state_voter_stats"
  ON public.state_voter_stats FOR SELECT
  TO public USING (true);

CREATE POLICY "Service role can manage state_voter_stats"
  ON public.state_voter_stats FOR ALL
  TO public USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');