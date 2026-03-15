-- API keys table
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  name text NOT NULL DEFAULT 'Default',
  last_used_at timestamp with time zone,
  request_count bigint NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  revoked_at timestamp with time zone,
  UNIQUE(key_hash)
);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Users can read their own keys
CREATE POLICY "Users can read own api_keys"
ON public.api_keys FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Users can create own api_keys
CREATE POLICY "Users can create own api_keys"
ON public.api_keys FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update (revoke) their own keys
CREATE POLICY "Users can update own api_keys"
ON public.api_keys FOR UPDATE TO authenticated
USING (user_id = auth.uid());

-- Users can delete their own keys
CREATE POLICY "Users can delete own api_keys"
ON public.api_keys FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Index for fast key lookups by hash
CREATE INDEX idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX idx_api_keys_user_id ON public.api_keys(user_id);

-- Function to validate API key (used by edge function, security definer to bypass RLS)
CREATE OR REPLACE FUNCTION public.validate_api_key(p_key_hash text)
RETURNS TABLE(user_id uuid, key_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ak.user_id, ak.id as key_id
  FROM public.api_keys ak
  WHERE ak.key_hash = p_key_hash
    AND ak.revoked_at IS NULL
  LIMIT 1;
$$;

-- Function to increment request count
CREATE OR REPLACE FUNCTION public.increment_api_key_usage(p_key_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.api_keys
  SET request_count = request_count + 1,
      last_used_at = now()
  WHERE id = p_key_id;
$$;