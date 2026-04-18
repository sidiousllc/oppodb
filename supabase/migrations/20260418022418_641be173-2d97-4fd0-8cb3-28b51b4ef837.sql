CREATE TABLE IF NOT EXISTS public.ai_generation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature TEXT NOT NULL,
  subject_type TEXT,
  subject_ref  TEXT,
  model TEXT,
  prompt_summary TEXT,
  output JSONB NOT NULL DEFAULT '{}'::jsonb,
  supersedes UUID REFERENCES public.ai_generation_history(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  trigger_source TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  duration_ms INTEGER,
  token_usage JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_gen_history_feature_idx ON public.ai_generation_history (feature, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_gen_history_subject_idx ON public.ai_generation_history (subject_type, subject_ref, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_gen_history_user_idx    ON public.ai_generation_history (triggered_by, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_gen_history_created_idx ON public.ai_generation_history (created_at DESC);

ALTER TABLE public.ai_generation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_history_select_authenticated"
  ON public.ai_generation_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "ai_history_admin_delete"
  ON public.ai_generation_history FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "ai_history_admin_update"
  ON public.ai_generation_history FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

COMMENT ON TABLE  public.ai_generation_history IS 'Unified version log for every AI-generated output across the app.';