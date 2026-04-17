-- Polling alert subscriptions
CREATE TABLE public.polling_alert_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'all', -- 'all' | 'state' | 'topic' | 'candidate'
  scope_value TEXT, -- state abbr, topic, or candidate name
  poll_types TEXT[] NOT NULL DEFAULT ARRAY['approval','issue','horserace'],
  min_margin_change NUMERIC DEFAULT 3, -- only alert if margin shifts by this much
  cadence TEXT NOT NULL DEFAULT 'instant', -- 'instant' | 'daily' | 'weekly'
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.polling_alert_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own polling alerts"
  ON public.polling_alert_subscriptions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all polling alerts"
  ON public.polling_alert_subscriptions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_polling_alerts_updated_at
  BEFORE UPDATE ON public.polling_alert_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_reports_updated_at();

CREATE INDEX idx_polling_alerts_next_run ON public.polling_alert_subscriptions(next_run_at) WHERE enabled = true;

-- Per-user email notification preferences (fine-tuning)
CREATE TABLE public.email_notification_preferences (
  user_id UUID PRIMARY KEY,
  polling_alerts BOOLEAN NOT NULL DEFAULT true,
  forecast_changes BOOLEAN NOT NULL DEFAULT true,
  scheduled_reports BOOLEAN NOT NULL DEFAULT true,
  intel_briefings BOOLEAN NOT NULL DEFAULT false,
  digest_frequency TEXT NOT NULL DEFAULT 'instant', -- 'instant' | 'daily' | 'weekly' | 'off'
  quiet_hours_start INTEGER, -- 0-23, null = none
  quiet_hours_end INTEGER,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own email prefs"
  ON public.email_notification_preferences FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_email_prefs_updated_at
  BEFORE UPDATE ON public.email_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_reports_updated_at();