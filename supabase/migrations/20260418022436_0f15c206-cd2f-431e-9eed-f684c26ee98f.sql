DROP POLICY IF EXISTS "ai_history_admin_update" ON public.ai_generation_history;
DROP POLICY IF EXISTS "ai_history_admin_delete" ON public.ai_generation_history;

CREATE POLICY "ai_history_admin_update"
  ON public.ai_generation_history FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "ai_history_admin_delete"
  ON public.ai_generation_history FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));