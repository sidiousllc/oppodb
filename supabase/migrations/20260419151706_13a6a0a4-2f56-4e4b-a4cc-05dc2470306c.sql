DROP POLICY IF EXISTS ai_history_select_authenticated ON public.ai_generation_history;

CREATE POLICY ai_history_select_own_or_admin
  ON public.ai_generation_history
  FOR SELECT
  TO authenticated
  USING (
    triggered_by = auth.uid()
    OR triggered_by IS NULL
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );