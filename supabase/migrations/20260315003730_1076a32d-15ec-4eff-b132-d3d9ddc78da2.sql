-- API request logs for analytics
CREATE TABLE public.api_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  status_code int NOT NULL DEFAULT 200,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their own logs
CREATE POLICY "Users can read own api_request_logs"
ON public.api_request_logs FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Indexes for analytics queries
CREATE INDEX idx_api_request_logs_user ON public.api_request_logs(user_id, created_at DESC);
CREATE INDEX idx_api_request_logs_key ON public.api_request_logs(api_key_id, created_at DESC);

-- Updated log function (replaces simple increment)
CREATE OR REPLACE FUNCTION public.log_api_request(p_key_id uuid, p_user_id uuid, p_endpoint text, p_status int DEFAULT 200)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.api_request_logs (api_key_id, user_id, endpoint, status_code)
  VALUES (p_key_id, p_user_id, p_endpoint, p_status);
  
  UPDATE public.api_keys
  SET request_count = request_count + 1, last_used_at = now()
  WHERE id = p_key_id;
END;
$$;