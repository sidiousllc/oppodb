
-- Forecast history table: logs every rating change
CREATE TABLE public.election_forecast_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id uuid NOT NULL,
  source text NOT NULL,
  race_type text NOT NULL DEFAULT 'house',
  state_abbr text NOT NULL,
  district text,
  cycle integer NOT NULL DEFAULT 2026,
  old_rating text,
  new_rating text,
  changed_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast lookups by race
CREATE INDEX idx_forecast_history_race ON public.election_forecast_history (source, race_type, state_abbr, district, cycle);
CREATE INDEX idx_forecast_history_changed ON public.election_forecast_history (changed_at DESC);

-- RLS
ALTER TABLE public.election_forecast_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read forecast history"
  ON public.election_forecast_history FOR SELECT TO public
  USING (true);

CREATE POLICY "Service role can manage forecast history"
  ON public.election_forecast_history FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Trigger function: record rating changes
CREATE OR REPLACE FUNCTION public.track_forecast_rating_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  -- Only log when rating actually changes (or is set for the first time)
  IF (TG_OP = 'INSERT') OR (OLD.rating IS DISTINCT FROM NEW.rating) THEN
    INSERT INTO public.election_forecast_history (
      forecast_id, source, race_type, state_abbr, district, cycle, old_rating, new_rating
    ) VALUES (
      NEW.id,
      NEW.source,
      NEW.race_type,
      NEW.state_abbr,
      NEW.district,
      NEW.cycle,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.rating END,
      NEW.rating
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to election_forecasts
CREATE TRIGGER on_forecast_rating_change
  AFTER INSERT OR UPDATE ON public.election_forecasts
  FOR EACH ROW
  EXECUTE FUNCTION public.track_forecast_rating_change();
