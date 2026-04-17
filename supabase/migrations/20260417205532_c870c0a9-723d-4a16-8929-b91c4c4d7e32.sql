-- User-level sync preferences (overrides global cron cadence per source)
CREATE TABLE IF NOT EXISTS public.user_sync_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL,            -- e.g. 'all', 'congress', 'polling', 'geopolitics', etc.
  interval_minutes integer NOT NULL DEFAULT 15 CHECK (interval_minutes >= 5 AND interval_minutes <= 1440),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source)
);

CREATE INDEX IF NOT EXISTS idx_user_sync_prefs_user ON public.user_sync_preferences(user_id);

ALTER TABLE public.user_sync_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync prefs"
  ON public.user_sync_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sync prefs"
  ON public.user_sync_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sync prefs"
  ON public.user_sync_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sync prefs"
  ON public.user_sync_preferences FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_sync_prefs_updated_at
  BEFORE UPDATE ON public.user_sync_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Global sync run log (read-only for users, written by scheduled-sync)
CREATE TABLE IF NOT EXISTS public.sync_run_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  status text NOT NULL DEFAULT 'success',  -- success | error | partial | skipped
  rows_synced integer DEFAULT 0,
  error_message text,
  duration_ms integer,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sync_run_log_source_started ON public.sync_run_log(source, started_at DESC);

ALTER TABLE public.sync_run_log ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read sync status; only service role writes
CREATE POLICY "Authenticated users can view sync run log"
  ON public.sync_run_log FOR SELECT
  TO authenticated
  USING (true);
