-- Helper to invite a member to a war room by email.
-- SECURITY DEFINER so it can read auth.users; restricted to the room's owner.
CREATE OR REPLACE FUNCTION public.invite_war_room_member_by_email(
  _room_id uuid,
  _email text,
  _role text DEFAULT 'viewer'
)
RETURNS TABLE(user_id uuid, role text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _is_owner boolean;
  _target_id uuid;
  _normalized_email text := lower(btrim(_email));
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF _role NOT IN ('viewer','editor','owner') THEN
    RAISE EXCEPTION 'Invalid role: %', _role USING ERRCODE = '22023';
  END IF;
  IF _role = 'owner' THEN
    RAISE EXCEPTION 'Cannot assign owner role via invite' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.war_rooms WHERE id = _room_id AND owner_id = _caller
  ) INTO _is_owner;

  IF NOT _is_owner THEN
    RAISE EXCEPTION 'Only the war room owner can invite members' USING ERRCODE = '42501';
  END IF;

  IF _normalized_email IS NULL OR _normalized_email = '' THEN
    RAISE EXCEPTION 'Email is required' USING ERRCODE = '22023';
  END IF;

  SELECT u.id INTO _target_id
  FROM auth.users u
  WHERE lower(u.email) = _normalized_email
  LIMIT 1;

  IF _target_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, _role, 'user_not_found'::text;
    RETURN;
  END IF;

  INSERT INTO public.war_room_members (war_room_id, user_id, role)
  VALUES (_room_id, _target_id, _role)
  ON CONFLICT (war_room_id, user_id)
    DO UPDATE SET role = EXCLUDED.role
  RETURNING public.war_room_members.user_id, public.war_room_members.role, 'added'::text
  INTO user_id, role, status;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.invite_war_room_member_by_email(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invite_war_room_member_by_email(uuid, text, text) TO authenticated;

-- Helper to list members of a war room (with display_name) for any member of that room.
CREATE OR REPLACE FUNCTION public.list_war_room_members(_room_id uuid)
RETURNS TABLE(user_id uuid, role text, display_name text, added_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_war_room_member(_room_id, _caller) THEN
    RAISE EXCEPTION 'Not a member of this war room' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT m.user_id, m.role, p.display_name, m.added_at
  FROM public.war_room_members m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.war_room_id = _room_id
  ORDER BY m.added_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_war_room_members(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_war_room_members(uuid) TO authenticated;

-- Bump war_rooms.updated_at when a new message is posted, so the sidebar
-- ordering by updated_at reflects recent activity.
CREATE OR REPLACE FUNCTION public.touch_war_room_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.war_rooms
  SET updated_at = now()
  WHERE id = NEW.war_room_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_war_room_messages_touch_room ON public.war_room_messages;
CREATE TRIGGER trg_war_room_messages_touch_room
AFTER INSERT ON public.war_room_messages
FOR EACH ROW
EXECUTE FUNCTION public.touch_war_room_on_message();

-- Add a length cap on message body (DoS / abuse protection)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'war_room_messages_body_max_len'
  ) THEN
    ALTER TABLE public.war_room_messages
      ADD CONSTRAINT war_room_messages_body_max_len
      CHECK (length(body) <= 4000);
  END IF;
END $$;

-- Add a length cap on war room name and race_scope
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'war_rooms_name_len') THEN
    ALTER TABLE public.war_rooms
      ADD CONSTRAINT war_rooms_name_len CHECK (length(btrim(name)) BETWEEN 1 AND 120);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'war_rooms_scope_len') THEN
    ALTER TABLE public.war_rooms
      ADD CONSTRAINT war_rooms_scope_len CHECK (race_scope IS NULL OR length(race_scope) <= 60);
  END IF;
END $$;