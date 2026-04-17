# War Rooms — Collaborative Intelligence Spaces

War Rooms are private, RLS-protected collaboration spaces where teams share notes, run alerts together, and chat in real-time over a focused topic (a candidate, a district, an election night, an investigation).

---

## Data Model

### `war_rooms`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `owner_id` | uuid | `auth.users.id` of creator |
| `name` | text | Display name |
| `description` | text | Optional |
| `entity_type` / `entity_id` | text | Optional anchor (e.g. `candidate`/`andy-ogles`) |
| `created_at` / `updated_at` | timestamptz | `updated_at` bumped by `touch_war_room_on_message()` trigger |

### `war_room_members`
| Column | Type | Notes |
|--------|------|-------|
| `war_room_id` | uuid → war_rooms | |
| `user_id` | uuid → auth.users | |
| `role` | text | `owner` / `editor` / `viewer` |
| `added_at` | timestamptz | |
| Unique (`war_room_id`, `user_id`) | | |

### `war_room_messages`
| Column | Type | Notes |
|--------|------|-------|
| `war_room_id` | uuid | |
| `user_id` | uuid | sender |
| `body` | text | message body |
| `attachments` | jsonb | `[{name, url, mime}]` |
| `created_at` | timestamptz | |

### `war_room_notes`
Shared rich-text notes scoped to the room (CRUD by editors+).

---

## Security Architecture

The previous in-app implementation suffered from RLS recursion (war_rooms ↔ war_room_members policies referencing each other). The fix uses **two SECURITY DEFINER helper functions**:

```sql
is_war_room_member(_room_id, _user_id) -> boolean
war_room_role(_room_id, _user_id)      -> text  -- 'owner'|'editor'|'viewer'|null
```

These bypass RLS internally so policies can call them without recursion. Example policy:

```sql
CREATE POLICY "Members can read war room messages"
  ON war_room_messages FOR SELECT
  USING (public.is_war_room_member(war_room_id, auth.uid()));
```

### Owner auto-membership
A trigger (`add_war_room_owner_as_member`) inserts the owner into `war_room_members` with role `owner` immediately after war room creation, ensuring the owner can read their own room without race conditions.

### Email invites
`invite_war_room_member_by_email(_room_id, _email, _role)` (SECURITY DEFINER) resolves the email against `auth.users`, checks the caller is the owner, validates the role (cannot invite as `owner`), and upserts the membership. Returns `{user_id, role, status}` where status is `added` or `user_not_found`.

### Member listing
`list_war_room_members(_room_id)` joins `war_room_members` with `profiles` for display names. Caller must be a member or call fails with `42501`.

---

## API Surface

| Endpoint | Method | Notes |
|----------|--------|-------|
| `/public-api/war-rooms` | GET | List rooms caller owns or is a member of |
| `/public-api/war-rooms?id=` | GET | Single room |
| `/public-api/war-room-members?room_id=` | GET | Wraps `list_war_room_members()` |
| `/public-api/war-room-messages?room_id=&limit=` | GET | Paginated messages, member-only |

### MCP Tools
- `list_war_rooms` — returns owner + member rooms for the caller
- `get_war_room_messages` — message feed (member-only)

---

## Realtime

`war_room_messages` is added to the `supabase_realtime` publication. The chat UI subscribes via:

```typescript
supabase.channel(`war-room-${roomId}`)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'war_room_messages', filter: `war_room_id=eq.${roomId}` }, handleNewMessage)
  .subscribe();
```

---

## UI

`WarRoomHub` (sidebar entry) lists rooms grouped by Owned / Member. Detail view: Chat | Notes | Members | Alerts tabs.

---

## Related

- [MessagingHub](MessagingHub) — non-room messaging
- [Authentication and User Management](Authentication-and-User-Management)
