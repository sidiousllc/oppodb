
CREATE TABLE public.intel_briefings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope TEXT NOT NULL DEFAULT 'national',
  category TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  source_name TEXT NOT NULL DEFAULT '',
  source_url TEXT,
  published_at TIMESTAMPTZ,
  region TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.intel_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read intel briefings"
  ON public.intel_briefings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage intel briefings"
  ON public.intel_briefings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_intel_briefings_scope ON public.intel_briefings(scope);
CREATE INDEX idx_intel_briefings_published ON public.intel_briefings(published_at DESC);
