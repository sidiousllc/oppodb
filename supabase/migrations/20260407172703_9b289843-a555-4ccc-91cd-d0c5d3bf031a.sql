-- Create user activity logs table
CREATE TABLE public.user_activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  activity_type text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for efficient admin queries
CREATE INDEX idx_user_activity_logs_user_id ON public.user_activity_logs (user_id);
CREATE INDEX idx_user_activity_logs_type ON public.user_activity_logs (activity_type);
CREATE INDEX idx_user_activity_logs_created ON public.user_activity_logs (created_at DESC);

-- Enable RLS
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read all logs
CREATE POLICY "Admins can read all activity logs"
ON public.user_activity_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can insert their own logs
CREATE POLICY "Users can insert own activity logs"
ON public.user_activity_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Service role can manage all logs
CREATE POLICY "Service role can manage activity logs"
ON public.user_activity_logs
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);