import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Trash2, Users, X, UserPlus, Send, LogOut, Crown } from "lucide-react";
import { toast } from "sonner";
import { OfflineSectionStatus } from "@/components/OfflineSectionStatus";
import { OfflineSectionDownloadButton } from "@/components/OfflineSectionDownloadButton";

interface WarRoom {
  id: string;
  name: string;
  description: string;
  race_scope: string | null;
  owner_id: string;
  updated_at?: string;
}
interface Msg {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
}
interface Member {
  user_id: string;
  role: string;
  display_name: string | null;
  added_at: string;
}

const MAX_MESSAGE_LEN = 4000;
const MAX_NAME_LEN = 120;
const MAX_SCOPE_LEN = 60;

export function WarRoomHub() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<WarRoom[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newScope, setNewScope] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Members panel
  const [members, setMembers] = useState<Member[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"viewer" | "editor">("viewer");
  const [inviting, setInviting] = useState(false);

  const loadRooms = useCallback(async () => {
    const { data, error } = await supabase
      .from("war_rooms")
      .select("id,name,description,race_scope,owner_id,updated_at")
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error("Couldn't load war rooms", { description: error.message });
      return;
    }
    setRooms((data || []) as WarRoom[]);
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  // Load messages + subscribe to realtime for the active room.
  // De-duplicates so the optimistic INSERT echo doesn't show duplicates.
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setMembers([]);
      setShowMembers(false);
      return;
    }
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("war_room_messages")
        .select("id,user_id,body,created_at")
        .eq("war_room_id", activeId)
        .order("created_at", { ascending: true })
        .limit(500);
      if (cancelled) return;
      if (error) {
        toast.error("Couldn't load messages", { description: error.message });
        setMessages([]);
        return;
      }
      setMessages((data || []) as Msg[]);
    })();

    const ch = supabase
      .channel(`war-${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "war_room_messages",
          filter: `war_room_id=eq.${activeId}`,
        },
        (payload) => {
          const next = payload.new as Msg;
          setMessages((prev) =>
            prev.some((m) => m.id === next.id) ? prev : [...prev, next]
          );
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [activeId]);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  // Load members when opening member panel
  const loadMembers = useCallback(async (roomId: string) => {
    const { data, error } = await supabase.rpc("list_war_room_members", { _room_id: roomId });
    if (error) {
      toast.error("Couldn't load members", { description: error.message });
      return;
    }
    setMembers((data || []) as Member[]);
  }, []);

  useEffect(() => {
    if (showMembers && activeId) loadMembers(activeId);
  }, [showMembers, activeId, loadMembers]);

  async function createRoom() {
    if (!user) {
      toast.error("You must be signed in");
      return;
    }
    const trimmed = newName.trim();
    if (trimmed.length < 1 || trimmed.length > MAX_NAME_LEN) {
      toast.error(`Name must be 1–${MAX_NAME_LEN} characters`);
      return;
    }
    const scope = newScope.trim().slice(0, MAX_SCOPE_LEN) || null;

    setSubmitting(true);
    // Insert without chained .select() — the SELECT RLS sometimes fires before the
    // owner-membership trigger commits, which can cause the returned row to be
    // filtered out by the "Read war rooms if member or owner" policy. Insert first,
    // then re-fetch by id.
    const { data: inserted, error: insertErr } = await supabase
      .from("war_rooms")
      .insert({ owner_id: user.id, name: trimmed, race_scope: scope })
      .select("id")
      .maybeSingle();

    if (insertErr || !inserted) {
      setSubmitting(false);
      console.error("[war-rooms] create failed", insertErr);
      toast.error("Couldn't create war room", {
        description: insertErr?.message || "The server did not return the new room. Please try again.",
      });
      return;
    }

    // Defensive: ensure owner is a member even if the trigger didn't fire.
    await supabase
      .from("war_room_members")
      .upsert(
        { war_room_id: inserted.id, user_id: user.id, role: "owner" },
        { onConflict: "war_room_id,user_id" }
      );

    const { data: room } = await supabase
      .from("war_rooms")
      .select("id,name,description,race_scope,owner_id,updated_at")
      .eq("id", inserted.id)
      .maybeSingle();

    setSubmitting(false);

    if (!room) {
      // Created, but read-back failed — refresh the list to recover.
      await loadRooms();
      setActiveId(inserted.id);
    } else {
      setRooms((prev) => [room as WarRoom, ...prev.filter((r) => r.id !== room.id)]);
      setActiveId((room as WarRoom).id);
    }
    setCreating(false);
    setNewName("");
    setNewScope("");
    toast.success("War room created");
  }

  async function send() {
    if (!user) {
      toast.error("You must be signed in");
      return;
    }
    if (!activeId) return;
    const body = draft.trim();
    if (!body) return;
    if (body.length > MAX_MESSAGE_LEN) {
      toast.error(`Message too long (max ${MAX_MESSAGE_LEN} characters)`);
      return;
    }
    setSending(true);
    // Keep draft until we know the insert succeeded — don't lose user input on errors.
    const { error } = await supabase
      .from("war_room_messages")
      .insert({ war_room_id: activeId, user_id: user.id, body });
    setSending(false);

    if (error) {
      toast.error("Couldn't send message", { description: error.message });
      return;
    }
    setDraft("");
    // Bump room ordering locally (server trigger also does this)
    setRooms((prev) => {
      const idx = prev.findIndex((r) => r.id === activeId);
      if (idx === -1) return prev;
      const updated = { ...prev[idx], updated_at: new Date().toISOString() };
      return [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
    });
  }

  async function deleteRoom(id: string) {
    if (!window.confirm("Delete this war room? All messages and members will be removed.")) return;
    const { error } = await supabase.from("war_rooms").delete().eq("id", id);
    if (error) {
      toast.error("Couldn't delete war room", { description: error.message });
      return;
    }
    setRooms((prev) => prev.filter((r) => r.id !== id));
    if (activeId === id) setActiveId(null);
    toast.success("War room deleted");
  }

  async function leaveRoom(id: string) {
    if (!user) return;
    if (!window.confirm("Leave this war room? You'll lose access until re-invited.")) return;
    const { error } = await supabase
      .from("war_room_members")
      .delete()
      .eq("war_room_id", id)
      .eq("user_id", user.id);
    if (error) {
      toast.error("Couldn't leave war room", { description: error.message });
      return;
    }
    setRooms((prev) => prev.filter((r) => r.id !== id));
    if (activeId === id) setActiveId(null);
    toast.success("Left war room");
  }

  async function inviteMember() {
    if (!activeId) return;
    const email = inviteEmail.trim();
    if (!email || !email.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    setInviting(true);
    const { data, error } = await supabase.rpc("invite_war_room_member_by_email", {
      _room_id: activeId,
      _email: email,
      _role: inviteRole,
    });
    setInviting(false);

    if (error) {
      toast.error("Couldn't invite member", { description: error.message });
      return;
    }
    const result = (data as Array<{ user_id: string | null; status: string }> | null)?.[0];
    if (!result || result.status === "user_not_found") {
      toast.error("No user found with that email", {
        description: "They must have an account first.",
      });
      return;
    }
    toast.success("Member added");
    setInviteEmail("");
    loadMembers(activeId);
  }

  async function removeMember(userId: string) {
    if (!activeId) return;
    if (!window.confirm("Remove this member from the war room?")) return;
    const { error } = await supabase
      .from("war_room_members")
      .delete()
      .eq("war_room_id", activeId)
      .eq("user_id", userId);
    if (error) {
      toast.error("Couldn't remove member", { description: error.message });
      return;
    }
    toast.success("Member removed");
    loadMembers(activeId);
  }

  const active = rooms.find((r) => r.id === activeId);
  const isOwner = active?.owner_id === user?.id;
  const memberCountLabel =
    members.length > 0 ? `${members.length} member${members.length === 1 ? "" : "s"}` : "";

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2 items-center"><OfflineSectionDownloadButton label="War Rooms" tables={["war_rooms","war_room_members","war_room_messages","entity_notes"]} /><OfflineSectionStatus label="War Rooms" tables={["war_rooms","war_room_members","war_room_messages","entity_notes"]} /></div>
      <div className="flex items-center justify-between">
        <h3 className="text-[12px] font-bold flex items-center gap-1">
          <Users className="h-3 w-3" /> War Rooms
        </h3>
        <button
          onClick={() => setCreating(true)}
          className="win98-button text-[10px] px-2 py-0.5 flex items-center gap-1"
        >
          <Plus className="h-3 w-3" /> New
        </button>
      </div>

      {creating && (
        <div className="win98-raised bg-[hsl(var(--win98-face))] p-2 space-y-1">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value.slice(0, MAX_NAME_LEN))}
            placeholder="Room name (required)"
            maxLength={MAX_NAME_LEN}
            className="win98-input text-[10px] px-1 py-0.5 w-full"
            autoFocus
          />
          <input
            value={newScope}
            onChange={(e) => setNewScope(e.target.value.slice(0, MAX_SCOPE_LEN))}
            placeholder="Race scope (e.g. TX-15) — optional"
            maxLength={MAX_SCOPE_LEN}
            className="win98-input text-[10px] px-1 py-0.5 w-full"
            onKeyDown={(e) => e.key === "Enter" && createRoom()}
          />
          <div className="flex gap-1">
            <button
              onClick={createRoom}
              disabled={submitting || !newName.trim()}
              className="win98-button text-[10px] px-2 py-0.5 disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => {
                setCreating(false);
                setNewName("");
                setNewScope("");
              }}
              className="win98-button text-[10px] px-2 py-0.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {/* Room list */}
        <div className="col-span-1 win98-raised bg-white p-1 max-h-[400px] overflow-y-auto">
          {rooms.length === 0 && (
            <div className="text-[10px] text-[hsl(var(--muted-foreground))] p-2">
              No war rooms yet. Create one to start collaborating.
            </div>
          )}
          {rooms.map((r) => {
            const owned = r.owner_id === user?.id;
            return (
              <div
                key={r.id}
                className={`flex items-center gap-1 px-1 py-1 text-[10px] cursor-pointer ${
                  activeId === r.id
                    ? "bg-[hsl(var(--win98-titlebar))] text-white"
                    : "hover:bg-[hsl(var(--win98-face))]"
                }`}
                onClick={() => setActiveId(r.id)}
              >
                {owned && <Crown className="h-2.5 w-2.5 flex-shrink-0" />}
                <span className="flex-1 truncate">
                  <span className="font-bold">{r.name}</span>
                  {r.race_scope ? ` · ${r.race_scope}` : ""}
                </span>
                {owned ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteRoom(r.id);
                    }}
                    className="opacity-60 hover:opacity-100"
                    title="Delete war room"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      leaveRoom(r.id);
                    }}
                    className="opacity-60 hover:opacity-100"
                    title="Leave war room"
                  >
                    <LogOut className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Conversation panel */}
        <div
          className="col-span-2 win98-raised bg-white flex flex-col"
          style={{ minHeight: 400, maxHeight: 400 }}
        >
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-[10px] text-[hsl(var(--muted-foreground))]">
              Select a war room
            </div>
          ) : (
            <>
              <div className="border-b border-[hsl(var(--win98-shadow))] p-1 text-[10px] font-bold flex items-center justify-between gap-1">
                <span className="truncate flex items-center gap-1">
                  {isOwner && <Crown className="h-2.5 w-2.5" />}
                  {active.name}
                  {active.race_scope ? ` — ${active.race_scope}` : ""}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowMembers((v) => !v)}
                    className="win98-button text-[9px] px-1 py-0 flex items-center gap-0.5"
                    title="Members"
                  >
                    <Users className="h-2.5 w-2.5" />
                    {memberCountLabel || "Members"}
                  </button>
                  <button onClick={() => setActiveId(null)} title="Close">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {showMembers && (
                <div className="border-b border-[hsl(var(--win98-shadow))] bg-[hsl(var(--win98-face))] p-1.5 space-y-1">
                  <div className="text-[10px] font-bold flex items-center gap-1">
                    <Users className="h-3 w-3" /> Members
                  </div>
                  <div className="max-h-[80px] overflow-y-auto space-y-0.5">
                    {members.length === 0 && (
                      <div className="text-[9px] text-[hsl(var(--muted-foreground))]">
                        Loading…
                      </div>
                    )}
                    {members.map((m) => (
                      <div
                        key={m.user_id}
                        className="flex items-center gap-1 text-[10px] bg-white px-1 py-0.5"
                      >
                        {m.role === "owner" && <Crown className="h-2.5 w-2.5" />}
                        <span className="flex-1 truncate">
                          {m.display_name || m.user_id.slice(0, 8)}
                        </span>
                        <span className="text-[9px] text-[hsl(var(--muted-foreground))]">
                          {m.role}
                        </span>
                        {isOwner && m.user_id !== user?.id && m.role !== "owner" && (
                          <button
                            onClick={() => removeMember(m.user_id)}
                            className="opacity-60 hover:opacity-100"
                            title="Remove member"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {isOwner && (
                    <div className="flex flex-wrap gap-1 pt-1 border-t border-[hsl(var(--win98-shadow))]">
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="invite by email"
                        className="win98-input text-[10px] px-1 py-0.5 flex-1 min-w-[120px]"
                        onKeyDown={(e) => e.key === "Enter" && inviteMember()}
                      />
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as "viewer" | "editor")}
                        className="win98-input text-[10px] px-1 py-0.5"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                      </select>
                      <button
                        onClick={inviteMember}
                        disabled={inviting}
                        className="win98-button text-[10px] px-2 py-0.5 flex items-center gap-1 disabled:opacity-50"
                      >
                        <UserPlus className="h-2.5 w-2.5" />
                        {inviting ? "Adding…" : "Add"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-1 space-y-1">
                {messages.length === 0 && (
                  <div className="text-[10px] text-[hsl(var(--muted-foreground))] text-center mt-4">
                    No messages yet. Start the conversation.
                  </div>
                )}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`text-[10px] p-1 ${
                      m.user_id === user?.id ? "bg-blue-50 ml-8" : "bg-gray-50 mr-8"
                    }`}
                  >
                    <div className="opacity-60 text-[8px]">
                      {new Date(m.created_at).toLocaleTimeString()}
                    </div>
                    <div className="whitespace-pre-wrap break-words">{m.body}</div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-[hsl(var(--win98-shadow))] p-1 flex gap-1">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, MAX_MESSAGE_LEN))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={`Type a message... (${draft.length}/${MAX_MESSAGE_LEN})`}
                  maxLength={MAX_MESSAGE_LEN}
                  className="win98-input text-[10px] px-1 py-0.5 flex-1"
                  disabled={sending}
                />
                <button
                  onClick={send}
                  disabled={sending || !draft.trim()}
                  className="win98-button text-[10px] px-2 py-0.5 flex items-center gap-1 disabled:opacity-50"
                >
                  <Send className="h-2.5 w-2.5" />
                  {sending ? "…" : "Send"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
