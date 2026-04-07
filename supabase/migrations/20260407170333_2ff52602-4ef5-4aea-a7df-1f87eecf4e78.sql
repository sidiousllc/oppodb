-- Drop the overly permissive policy that lets all authenticated users read all trades
DROP POLICY IF EXISTS "Authenticated users can read all trades" ON public.trade_history;

-- Add admin policy for full visibility
CREATE POLICY "Admins can read all trades" ON public.trade_history
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
