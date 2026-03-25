
-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can read user_invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Public can read user_invitations" ON public.user_invitations;

-- Check existing policies and drop any permissive SELECT for anon/public
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'user_invitations' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_invitations', pol.policyname);
  END LOOP;
END $$;

-- Admins can read all invitations
CREATE POLICY "Admins can read all invitations"
  ON public.user_invitations
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Anon users can only look up a specific invitation by token (for validation flow)
CREATE POLICY "Anon can validate specific token"
  ON public.user_invitations
  FOR SELECT
  TO anon
  USING (false);
