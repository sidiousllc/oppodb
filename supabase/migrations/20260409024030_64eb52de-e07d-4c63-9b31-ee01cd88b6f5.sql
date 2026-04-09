-- Create messaging_guidance table
CREATE TABLE public.messaging_guidance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'Navigator Research',
  source_url text,
  author text,
  published_date date,
  summary text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  issue_areas text[] NOT NULL DEFAULT '{}',
  research_type text NOT NULL DEFAULT 'message-guidance',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.messaging_guidance ENABLE ROW LEVEL SECURITY;

-- Anyone can read
CREATE POLICY "Anyone can read messaging_guidance"
  ON public.messaging_guidance FOR SELECT
  TO public
  USING (true);

-- Admins and moderators can insert
CREATE POLICY "Admins and mods can insert messaging_guidance"
  ON public.messaging_guidance FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- Admins and moderators can update
CREATE POLICY "Admins and mods can update messaging_guidance"
  ON public.messaging_guidance FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- Only admins can delete
CREATE POLICY "Admins can delete messaging_guidance"
  ON public.messaging_guidance FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Index on slug for fast lookups
CREATE INDEX idx_messaging_guidance_slug ON public.messaging_guidance (slug);

-- GIN index on issue_areas for tag filtering
CREATE INDEX idx_messaging_guidance_issue_areas ON public.messaging_guidance USING GIN (issue_areas);