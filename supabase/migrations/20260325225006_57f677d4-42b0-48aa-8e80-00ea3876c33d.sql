
DROP POLICY IF EXISTS "Anyone can read role_groups" ON public.role_groups;

CREATE POLICY "Authenticated can read role_groups"
  ON public.role_groups
  FOR SELECT
  TO authenticated
  USING (true);
