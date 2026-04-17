CREATE TABLE public.messaging_audience_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  messaging_slug text NOT NULL,
  effectiveness_score numeric NOT NULL DEFAULT 0,
  audience_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  segment_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  resonance_factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT 'google/gemini-2.5-pro',
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (messaging_slug)
);
ALTER TABLE public.messaging_audience_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read messaging audience" ON public.messaging_audience_analyses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage messaging audience" ON public.messaging_audience_analyses FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_messaging_audience_slug ON public.messaging_audience_analyses(messaging_slug);
CREATE TRIGGER trg_msg_aud_updated BEFORE UPDATE ON public.messaging_audience_analyses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.messaging_impact_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  messaging_slug text NOT NULL,
  scope text NOT NULL DEFAULT 'national',
  scope_ref text DEFAULT NULL,
  summary text NOT NULL DEFAULT '',
  amplifies jsonb NOT NULL DEFAULT '[]'::jsonb,
  undermines jsonb NOT NULL DEFAULT '[]'::jsonb,
  affected_groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  political_impact text DEFAULT '',
  media_impact text DEFAULT '',
  recommended_channels jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text NOT NULL DEFAULT 'google/gemini-2.5-pro',
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX msg_impact_uniq ON public.messaging_impact_analyses (messaging_slug, scope, COALESCE(scope_ref, ''));
ALTER TABLE public.messaging_impact_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read messaging impact" ON public.messaging_impact_analyses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage messaging impact" ON public.messaging_impact_analyses FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_messaging_impact_slug ON public.messaging_impact_analyses(messaging_slug);
CREATE TRIGGER trg_msg_imp_updated BEFORE UPDATE ON public.messaging_impact_analyses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();