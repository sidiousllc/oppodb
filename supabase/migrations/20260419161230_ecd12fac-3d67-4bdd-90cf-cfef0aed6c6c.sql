-- Default owner_id to the current authenticated user
ALTER TABLE public.war_rooms ALTER COLUMN owner_id SET DEFAULT auth.uid();

-- Recreate INSERT policy scoped to authenticated users
DROP POLICY IF EXISTS "Owner inserts war room" ON public.war_rooms;

CREATE POLICY "Authenticated users create their own war rooms"
ON public.war_rooms
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());