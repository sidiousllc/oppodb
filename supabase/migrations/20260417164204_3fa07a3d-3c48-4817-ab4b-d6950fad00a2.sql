
-- Scheduled report email delivery
CREATE TABLE IF NOT EXISTS public.report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  cadence TEXT NOT NULL DEFAULT 'weekly', -- daily | weekly | monthly
  recipients TEXT[] NOT NULL DEFAULT '{}',
  subject TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own schedules"
  ON public.report_schedules FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Admins manage all schedules"
  ON public.report_schedules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_report_schedules_next_run ON public.report_schedules(next_run_at) WHERE enabled = true;

CREATE TRIGGER report_schedules_updated_at
  BEFORE UPDATE ON public.report_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_reports_updated_at();

-- Allow public viewing of reports flagged is_public via RLS.
-- (Existing reports table already has user_has_report_access; add public policy.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reports' AND policyname = 'Anyone can read public reports'
  ) THEN
    CREATE POLICY "Anyone can read public reports"
      ON public.reports FOR SELECT
      TO anon, authenticated
      USING (is_public = true);
  END IF;
END $$;
