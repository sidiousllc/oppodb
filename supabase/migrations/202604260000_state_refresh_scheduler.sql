-- State-level refresh scheduler & health alerting
-- Stores per-state refresh intervals and health thresholds.
-- The `state-health-scheduler` edge function reads this table and
-- fires in-app notifications (or webhooks) when a state's health
-- drops below its configured threshold.

CREATE TABLE public.state_refresh_schedules (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  state_abbr      TEXT          NOT NULL UNIQUE,  -- 'MN', 'PA', etc.
  refresh_hours   INTEGER       NOT NULL DEFAULT 6,
  health_threshold INTEGER      NOT NULL DEFAULT 70,  -- 0-100; alert when score falls below
  health_window_hours INTEGER   NOT NULL DEFAULT 24,  -- window for evaluating sync health
  channels        TEXT[]        NOT NULL DEFAULT ARRAY['in_app'],
  enabled         BOOLEAN       NOT NULL DEFAULT true,
  last_alerted_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE public.state_refresh_schedules ENABLE ROW LEVEL SECURITY;

-- Users manage their own schedules
CREATE POLICY "Users manage their own state schedules"
  ON public.state_refresh_schedules FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins view all state schedules"
  ON public.state_refresh_schedules FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_state_schedules_updated_at
  BEFORE UPDATE ON public.state_refresh_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_reports_updated_at();

-- Index for the scheduler's active-state lookup
CREATE INDEX idx_state_schedules_enabled ON public.state_refresh_schedules(state_abbr) WHERE enabled = true;

-- Log of health checks and alerts
CREATE TABLE public.state_health_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  state_abbr        TEXT        NOT NULL,
  health_score      INTEGER     NOT NULL,  -- 0-100
  sync_successes    INTEGER     NOT NULL DEFAULT 0,
  sync_failures     INTEGER     NOT NULL DEFAULT 0,
  last_sync_at      TIMESTAMPTZ,
  alert_sent        BOOLEAN     NOT NULL DEFAULT false,
  alert_channels    TEXT[],
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_state_health_log_state_time
  ON public.state_health_log(state_abbr, created_at DESC);

-- Seed default schedules for all 50 states with sensible defaults
INSERT INTO public.state_refresh_schedules (state_abbr, refresh_hours, health_threshold, health_window_hours)
SELECT abbr, 6, 60, 24
FROM (VALUES
  ('AL'),('AK'),('AZ'),('AR'),('CA'),('CO'),('CT'),('DE'),('FL'),('GA'),
  ('HI'),('ID'),('IL'),('IN'),('IA'),('KS'),('KY'),('LA'),('ME'),('MD'),
  ('MA'),('MI'),('MN'),('MS'),('MO'),('MT'),('NE'),('NV'),('NH'),('NJ'),
  ('NM'),('NY'),('NC'),('ND'),('OH'),('OK'),('OR'),('PA'),('RI'),('SC'),
  ('SD'),('TN'),('TX'),('UT'),('VT'),('VA'),('WA'),('WV'),('WI'),('WY')
) AS s(abbr)
ON CONFLICT (state_abbr) DO NOTHING;