-- Generic AI tables for District Intel, State Legislative Districts, and Legislation bills
-- subject_type: 'district' | 'state_leg' | 'legislation'
-- subject_ref: district_id (e.g. 'MN-02'), state_leg id (UUID), or bill_id

CREATE TABLE public.subject_audience_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL,
  subject_ref text NOT NULL,
  effectiveness_score numeric NOT NULL DEFAULT 0,
  audience_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  segment_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  resonance_factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT 'google/gemini-2.5-pro',
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_type, subject_ref)
);
ALTER TABLE public.subject_audience_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read subject audience" ON public.subject_audience_analyses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage subject audience" ON public.subject_audience_analyses FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_subject_audience_lookup ON public.subject_audience_analyses(subject_type, subject_ref);
CREATE TRIGGER trg_subj_aud_updated BEFORE UPDATE ON public.subject_audience_analyses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.subject_impact_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL,
  subject_ref text NOT NULL,
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
CREATE UNIQUE INDEX subj_impact_uniq ON public.subject_impact_analyses (subject_type, subject_ref, scope, COALESCE(scope_ref, ''));
ALTER TABLE public.subject_impact_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read subject impact" ON public.subject_impact_analyses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage subject impact" ON public.subject_impact_analyses FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_subject_impact_lookup ON public.subject_impact_analyses(subject_type, subject_ref);
CREATE TRIGGER trg_subj_imp_updated BEFORE UPDATE ON public.subject_impact_analyses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();