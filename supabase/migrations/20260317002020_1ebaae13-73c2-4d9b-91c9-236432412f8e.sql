-- Drop the overly permissive update policy
DROP POLICY IF EXISTS "Users can update own mail" ON public.user_mail;

-- Senders can only soft-delete their own sent mail
CREATE POLICY "Senders can soft-delete own mail"
ON public.user_mail
FOR UPDATE
TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

-- Recipients can mark mail as read or soft-delete
CREATE POLICY "Recipients can update own received mail"
ON public.user_mail
FOR UPDATE
TO authenticated
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

-- Revoke general UPDATE and grant only safe columns
REVOKE UPDATE ON public.user_mail FROM authenticated;
GRANT UPDATE(deleted_by_sender) ON public.user_mail TO authenticated;
GRANT UPDATE(deleted_by_recipient, read_at) ON public.user_mail TO authenticated;