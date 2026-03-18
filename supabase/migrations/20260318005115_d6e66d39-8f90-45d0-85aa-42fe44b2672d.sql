
-- Table to store per-user API credentials for external services
CREATE TABLE public.user_integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  service text NOT NULL,
  api_key_encrypted text NOT NULL,
  slug text DEFAULT '',
  display_name text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, service)
);

-- Enable RLS
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own integrations
CREATE POLICY "Users can read own integrations"
  ON public.user_integrations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own integrations"
  ON public.user_integrations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own integrations"
  ON public.user_integrations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own integrations"
  ON public.user_integrations FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
