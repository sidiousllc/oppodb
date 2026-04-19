CREATE TABLE IF NOT EXISTS public.user_layout_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  layout_key TEXT NOT NULL,
  "order" JSONB NOT NULL DEFAULT '[]'::jsonb,
  hidden JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, layout_key)
);

ALTER TABLE public.user_layout_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own layout prefs"
  ON public.user_layout_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own layout prefs"
  ON public.user_layout_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own layout prefs"
  ON public.user_layout_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own layout prefs"
  ON public.user_layout_preferences FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER user_layout_preferences_updated_at
  BEFORE UPDATE ON public.user_layout_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_user_layout_preferences_user_key
  ON public.user_layout_preferences (user_id, layout_key);