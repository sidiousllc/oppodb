-- Fix UPDATE policy to prevent user_id reassignment
DROP POLICY IF EXISTS "Users can update own integrations" ON public.user_integrations;
CREATE POLICY "Users can update own integrations"
  ON public.user_integrations FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Lock down user_roles INSERT/UPDATE/DELETE to admin only (fixes privilege escalation finding)
DROP POLICY IF EXISTS "Admins can manage user_roles" ON public.user_roles;
CREATE POLICY "Admins can manage user_roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Restrict role_group_members SELECT to authenticated users only (fixes public exposure finding)
DROP POLICY IF EXISTS "Anyone can read role_group_members" ON public.role_group_members;
CREATE POLICY "Authenticated can read role_group_members"
  ON public.role_group_members FOR SELECT TO authenticated
  USING (true);