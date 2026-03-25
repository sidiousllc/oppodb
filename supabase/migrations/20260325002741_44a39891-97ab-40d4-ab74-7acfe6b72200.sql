
-- Fix winred_donations RLS: restrict SELECT to admin/moderator only
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'winred_donations' AND schemaname = 'public')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.winred_donations', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.winred_donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage winred_donations"
  ON public.winred_donations FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admin and moderator can read winred_donations"
  ON public.winred_donations FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = 'public';
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = 'public';
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = 'public';
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = 'public';
ALTER FUNCTION public.track_forecast_rating_change() SET search_path = 'public';
