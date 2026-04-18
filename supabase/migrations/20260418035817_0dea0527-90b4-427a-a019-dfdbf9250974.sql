-- Attach the missing trigger that auto-adds the war room owner as a member.
-- Without this, the post-insert SELECT (filtered by is_war_room_member) returns
-- nothing and the client surfaces it as an RLS violation.

DROP TRIGGER IF EXISTS add_war_room_owner_as_member_trigger ON public.war_rooms;

CREATE TRIGGER add_war_room_owner_as_member_trigger
AFTER INSERT ON public.war_rooms
FOR EACH ROW
EXECUTE FUNCTION public.add_war_room_owner_as_member();

-- Also attach the touch trigger on messages (also missing per inspection).
DROP TRIGGER IF EXISTS touch_war_room_on_message_trigger ON public.war_room_messages;

CREATE TRIGGER touch_war_room_on_message_trigger
AFTER INSERT ON public.war_room_messages
FOR EACH ROW
EXECUTE FUNCTION public.touch_war_room_on_message();