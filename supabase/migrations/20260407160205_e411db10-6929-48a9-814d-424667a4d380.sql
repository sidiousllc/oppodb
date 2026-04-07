
CREATE TABLE public.user_market_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('polymarket', 'kalshi', 'predictit')),
  encrypted_key TEXT NOT NULL,
  encrypted_secret TEXT,
  encrypted_passphrase TEXT,
  label TEXT NOT NULL DEFAULT 'Default',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform)
);

ALTER TABLE public.user_market_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own credentials"
  ON public.user_market_credentials FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own credentials"
  ON public.user_market_credentials FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own credentials"
  ON public.user_market_credentials FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own credentials"
  ON public.user_market_credentials FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
