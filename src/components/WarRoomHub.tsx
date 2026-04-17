import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";

interface WarRoom {
  id: string;
  name: string;
  description: string;
  race_scope: string | null;
  owner_id: string;
}
interface Msg { id: string; user_id: string; body: string; created_at: string }

export function WarRoomHub() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<WarRoom[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newScope, setNewScope] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");

  const loadRooms = useCallback(async () => {
    const { data } = await supabase.from("war_rooms").select("*").order("updated_at", { ascending: false });
    setRooms((data || []) as WarRoom[]);
  }, []);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    let cancelled = false;
    supabase.from("war_room_messages").select("*").eq("war_room_id", activeId).order("created_at", { ascending: true }).limit(200)
      .then(({ data }) => { if (!cancelled) setMessages((data || []) as Msg[]); });
    const ch = supabase.channel(`war-${activeId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "war_room_messages", filter: `war_room_id=eq.${activeId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Msg]))
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [activeId]);

  async function createRoom() {
    if (!newName.trim() || !user) return;
    const { data, error } = await supabase.from("war_rooms").insert({
      owner_id: user.id, name: newName.trim(), race_scope: newScope.trim() || null,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setRooms((prev) => [data as WarRoom, ...prev]);
    setActiveId((data as WarRoom).id);
    setCreating(false); setNewName(""); setNewScope("");
    toast.success("War room created");
  }

  async function send() {
    if (!draft.trim() || !activeId || !user) return;
    const body = draft.trim();
    setDraft("");
    const { error } = await supabase.from("war_room_messages").insert({ war_room_id: activeId, user_id: user.id, body });
    if (error) toast.error(error.message);
  }

  async function deleteRoom(id: string) {
    if (!confirm("Delete this war room?")) return;
    const { error } = await supabase.from("war_rooms").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRooms((prev) => prev.filter((r) => r.id !== id));
    if (activeId === id) setActiveId(null);
  }

  const active = rooms.find((r) => r.id === activeId);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[12px] font-bold flex items-center gap-1"><Users className="h-3 w-3" /> War Rooms</h3>
        <button onClick={() => setCreating(true)} className="win98-button text-[10px] px-2 py-0.5 flex items-center gap-1">
          <Plus className="h-3 w-3" /> New
        </button>
      </div>

      {creating && (
        <div className="win98-raised bg-[hsl(var(--win98-face))] p-2 space-y-1">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Room name" className="win98-input text-[10px] px-1 py-0.5 w-full" />
          <input value={newScope} onChange={(e) => setNewScope(e.target.value)} placeholder="Race scope (e.g. TX-15)" className="win98-input text-[10px] px-1 py-0.5 w-full" />
          <div className="flex gap-1">
            <button onClick={createRoom} className="win98-button text-[10px] px-2 py-0.5">Create</button>
            <button onClick={() => setCreating(false)} className="win98-button text-[10px] px-2 py-0.5">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-1 win98-raised bg-white p-1 max-h-[400px] overflow-y-auto">
          {rooms.length === 0 && <div className="text-[10px] text-[hsl(var(--muted-foreground))] p-2">No war rooms yet.</div>}
          {rooms.map((r) => (
            <div key={r.id} className={`flex items-center gap-1 px-1 py-1 text-[10px] cursor-pointer ${activeId === r.id ? "bg-[hsl(var(--win98-titlebar))] text-white" : "hover:bg-[hsl(var(--win98-face))]"}`}
              onClick={() => setActiveId(r.id)}>
              <span className="flex-1 truncate"><span className="font-bold">{r.name}</span>{r.race_scope ? ` · ${r.race_scope}` : ""}</span>
              {r.owner_id === user?.id && (
                <button onClick={(e) => { e.stopPropagation(); deleteRoom(r.id); }} className="opacity-60 hover:opacity-100">
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="col-span-2 win98-raised bg-white flex flex-col" style={{ minHeight: 400, maxHeight: 400 }}>
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-[10px] text-[hsl(var(--muted-foreground))]">Select a war room</div>
          ) : (
            <>
              <div className="border-b border-[hsl(var(--win98-shadow))] p-1 text-[10px] font-bold flex items-center justify-between">
                <span>{active.name}{active.race_scope ? ` — ${active.race_scope}` : ""}</span>
                <button onClick={() => setActiveId(null)}><X className="h-3 w-3" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-1 space-y-1">
                {messages.length === 0 && <div className="text-[10px] text-[hsl(var(--muted-foreground))] text-center mt-4">No messages yet.</div>}
                {messages.map((m) => (
                  <div key={m.id} className={`text-[10px] p-1 ${m.user_id === user?.id ? "bg-blue-50 ml-8" : "bg-gray-50 mr-8"}`}>
                    <div className="opacity-60 text-[8px]">{new Date(m.created_at).toLocaleTimeString()}</div>
                    <div>{m.body}</div>
                  </div>
                ))}
              </div>
              <div className="border-t border-[hsl(var(--win98-shadow))] p-1 flex gap-1">
                <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Type a message..." className="win98-input text-[10px] px-1 py-0.5 flex-1" />
                <button onClick={send} className="win98-button text-[10px] px-2 py-0.5">Send</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
