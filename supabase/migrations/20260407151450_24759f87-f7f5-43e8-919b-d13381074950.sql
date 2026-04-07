
CREATE TABLE public.prediction_markets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  market_id text NOT NULL,
  source text NOT NULL DEFAULT 'polymarket',
  title text NOT NULL,
  category text NOT NULL DEFAULT 'house',
  state_abbr text,
  district text,
  candidate_name text,
  yes_price numeric,
  no_price numeric,
  volume numeric DEFAULT 0,
  liquidity numeric DEFAULT 0,
  last_traded_at timestamp with time zone,
  market_url text,
  status text NOT NULL DEFAULT 'active',
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(source, market_id)
);

ALTER TABLE public.prediction_markets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read prediction_markets"
ON public.prediction_markets FOR SELECT
TO public USING (true);

CREATE POLICY "Service role can manage prediction_markets"
ON public.prediction_markets FOR ALL
TO public USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE INDEX idx_prediction_markets_source ON public.prediction_markets(source);
CREATE INDEX idx_prediction_markets_category ON public.prediction_markets(category);
CREATE INDEX idx_prediction_markets_state ON public.prediction_markets(state_abbr);
