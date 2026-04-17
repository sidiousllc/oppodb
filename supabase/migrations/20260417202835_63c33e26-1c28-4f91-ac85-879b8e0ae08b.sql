-- 1. Default owner_id to the calling user so client cannot mismatch
ALTER TABLE public.war_rooms
  ALTER COLUMN owner_id SET DEFAULT auth.uid();

-- 2. Restrict war_room_members.role to a known set
ALTER TABLE public.war_room_members
  DROP CONSTRAINT IF EXISTS war_room_members_role_check;
ALTER TABLE public.war_room_members
  ADD CONSTRAINT war_room_members_role_check
  CHECK (role IN ('owner', 'editor', 'viewer'));

-- 3. Auto-add the owner as a member with role='owner' on war_room creation
CREATE OR REPLACE FUNCTION public.add_war_room_owner_as_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.war_room_members (war_room_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (war_room_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_war_rooms_add_owner_member ON public.war_rooms;
CREATE TRIGGER trg_war_rooms_add_owner_member
  AFTER INSERT ON public.war_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.add_war_room_owner_as_member();

-- 4. Backfill: ensure every existing owner has a member row
INSERT INTO public.war_room_members (war_room_id, user_id, role)
SELECT wr.id, wr.owner_id, 'owner'
FROM public.war_rooms wr
ON CONFLICT (war_room_id, user_id) DO NOTHING;

-- 5. Allow members to view their own membership row
DROP POLICY IF EXISTS "Members can view own membership" ON public.war_room_members;
CREATE POLICY "Members can view own membership"
  ON public.war_room_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 6. Allow members (non-owners) to leave a war room
DROP POLICY IF EXISTS "Members can leave war room" ON public.war_room_members;
CREATE POLICY "Members can leave war room"
  ON public.war_room_members
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND role <> 'owner'
  );

-- 7. Prevent owner_id from being reassigned away from the current user
DROP POLICY IF EXISTS "Owner updates war room" ON public.war_rooms;
CREATE POLICY "Owner updates war room"
  ON public.war_rooms
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 8. Tighten war_room_messages: ensure body is not blank (defense-in-depth)
ALTER TABLE public.war_room_messages
  DROP CONSTRAINT IF EXISTS war_room_messages_body_not_blank;
ALTER TABLE public.war_room_messages
  ADD CONSTRAINT war_room_messages_body_not_blank
  CHECK (length(btrim(body)) > 0);