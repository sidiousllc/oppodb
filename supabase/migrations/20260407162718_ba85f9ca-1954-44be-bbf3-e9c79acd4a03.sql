
-- Create trade_history table for logging all prediction market trades
CREATE TABLE public.trade_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('polymarket', 'kalshi', 'predictit')),
  market_id TEXT,
  market_title TEXT,
  side TEXT NOT NULL,
  price NUMERIC,
  quantity NUMERIC,
  total_cost NUMERIC,
  order_type TEXT DEFAULT 'limit',
  order_id TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  pnl NUMERIC,
  fees NUMERIC,
  raw_response JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  settled_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.trade_history ENABLE ROW LEVEL SECURITY;

-- Users can read their own trades
CREATE POLICY "Users can read own trades"
  ON public.trade_history
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- All authenticated users can read all trades (public trade feed for DataHub)
CREATE POLICY "Authenticated users can read all trades"
  ON public.trade_history
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert (edge function logs trades server-side)
CREATE POLICY "Service role can insert trades"
  ON public.trade_history
  FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');

-- Only service role can update (for settling trades, updating PnL)
CREATE POLICY "Service role can update trades"
  ON public.trade_history
  FOR UPDATE
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Index for fast user lookups
CREATE INDEX idx_trade_history_user_id ON public.trade_history (user_id);

-- Index for market-based queries in DataHub
CREATE INDEX idx_trade_history_market ON public.trade_history (platform, market_id);

-- Index for time-based queries
CREATE INDEX idx_trade_history_created ON public.trade_history (created_at DESC);
