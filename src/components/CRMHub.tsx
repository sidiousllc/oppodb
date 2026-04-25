import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { OfflineSectionStatus } from "@/components/OfflineSectionStatus";
import { OfflineSectionDownloadButton } from "@/components/OfflineSectionDownloadButton";

interface Stakeholder {
  id: string;
  name: string;
  type: string;
  organization: string | null;
  email: string | null;
  phone: string | null;
  party: string | null;
  state_abbr: string | null;
  influence_score: number;
  tags: string[];
  notes: string;
}
interface Interaction {
  id: string;
  stakeholder_id: string;
  interaction_type: string;
  subject: string;
  body: string;
  occurred_at: string;
  outcome: string | null;
}

export function CRMHub() {
  const { user } = useAuth();
  const [list, setList] = useState<Stakeholder[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", type: "donor", organization: "", email: "", phone: "", state_abbr: "", party: "" });
  const [intDraft, setIntDraft] = useState({ interaction_type: "note", subject: "", body: "" });

  const load = useCallback(async () => {
    const { data } = await supabase.from("stakeholders").select("*").order("updated_at", { ascending: false });
    setList((data || []) as Stakeholder[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!activeId) { setInteractions([]); return; }
    supabase.from("stakeholder_interactions").select("*").eq("stakeholder_id", activeId).order("occurred_at", { ascending: false })
      .then(({ data }) => setInteractions((data || []) as Interaction[]));
  }, [activeId]);

  async function add() {
    if (!draft.name.trim() || !user) return;
    const { data, error } = await supabase.from("stakeholders").insert({ owner_id: user.id, ...draft }).select().single();
    if (error) { toast.error(error.message); return; }
    setList((p) => [data as Stakeholder, ...p]);
    setAdding(false); setDraft({ name: "", type: "donor", organization: "", email: "", phone: "", state_abbr: "", party: "" });
    toast.success("Stakeholder added");
  }

  async function addInteraction() {
    if (!intDraft.body.trim() || !activeId || !user) return;
    const { data, error } = await supabase.from("stakeholder_interactions").insert({
      stakeholder_id: activeId, user_id: user.id, ...intDraft,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setInteractions((p) => [data as Interaction, ...p]);
    setIntDraft({ interaction_type: "note", subject: "", body: "" });
  }

  async function remove(id: string) {
    if (!confirm("Delete this stakeholder?")) return;
    const { error } = await supabase.from("stakeholders").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setList((p) => p.filter((s) => s.id !== id));
    if (activeId === id) setActiveId(null);
  }

  const active = list.find((s) => s.id === activeId);

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2 items-center"><OfflineSectionDownloadButton label="CRM" tables={["stakeholders","stakeholder_interactions","entity_notes"]} /><OfflineSectionStatus label="CRM" tables={["stakeholders","stakeholder_interactions","entity_notes"]} /></div>
      <div className="flex items-center justify-between">
        <h3 className="text-[12px] font-bold">🤝 Stakeholders CRM</h3>
        <button onClick={() => setAdding(true)} className="win98-button text-[10px] px-2 py-0.5 flex items-center gap-1">
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>

      {adding && (
        <div className="win98-raised bg-[hsl(var(--win98-face))] p-2 grid grid-cols-2 gap-1">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name *" className="win98-input text-[10px] px-1 py-0.5" />
          <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} className="win98-input text-[10px] px-1 py-0.5">
            <option value="donor">Donor</option><option value="journalist">Journalist</option><option value="staffer">Staffer</option>
            <option value="elected">Elected</option><option value="lobbyist">Lobbyist</option><option value="activist">Activist</option><option value="contact">Contact</option>
          </select>
          <input value={draft.organization} onChange={(e) => setDraft({ ...draft, organization: e.target.value })} placeholder="Organization" className="win98-input text-[10px] px-1 py-0.5" />
          <input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="Email" className="win98-input text-[10px] px-1 py-0.5" />
          <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="Phone" className="win98-input text-[10px] px-1 py-0.5" />
          <input value={draft.state_abbr} onChange={(e) => setDraft({ ...draft, state_abbr: e.target.value.toUpperCase() })} maxLength={2} placeholder="State" className="win98-input text-[10px] px-1 py-0.5" />
          <input value={draft.party} onChange={(e) => setDraft({ ...draft, party: e.target.value })} placeholder="Party" className="win98-input text-[10px] px-1 py-0.5" />
          <div className="col-span-2 flex gap-1">
            <button onClick={add} className="win98-button text-[10px] px-2 py-0.5">Save</button>
            <button onClick={() => setAdding(false)} className="win98-button text-[10px] px-2 py-0.5">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-1 win98-raised bg-white p-1 max-h-[450px] overflow-y-auto">
          {list.length === 0 && <div className="text-[10px] text-[hsl(var(--muted-foreground))] p-2">No stakeholders yet.</div>}
          {list.map((s) => (
            <div key={s.id} className={`px-1 py-1 text-[10px] cursor-pointer flex items-center gap-1 ${activeId === s.id ? "bg-[hsl(var(--win98-titlebar))] text-white" : "hover:bg-[hsl(var(--win98-face))]"}`}
              onClick={() => setActiveId(s.id)}>
              <span className="flex-1 truncate">
                <span className="font-bold">{s.name}</span>
                <span className="opacity-70"> · {s.type}{s.state_abbr ? ` · ${s.state_abbr}` : ""}</span>
              </span>
              <button onClick={(e) => { e.stopPropagation(); remove(s.id); }} className="opacity-60 hover:opacity-100">
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="col-span-2 win98-raised bg-white p-2 max-h-[450px] overflow-y-auto">
          {!active ? (
            <div className="text-[10px] text-[hsl(var(--muted-foreground))] text-center mt-12">Select a stakeholder</div>
          ) : (
            <div className="space-y-2">
              <div>
                <div className="text-[12px] font-bold">{active.name}</div>
                <div className="text-[10px] opacity-80">
                  {active.type}{active.organization ? ` @ ${active.organization}` : ""}
                  {active.party ? ` · ${active.party}` : ""}{active.state_abbr ? ` · ${active.state_abbr}` : ""}
                </div>
                <div className="text-[10px]">{active.email && <span>📧 {active.email} </span>}{active.phone && <span>📞 {active.phone}</span>}</div>
              </div>
              <div className="border-t border-[hsl(var(--win98-shadow))] pt-2">
                <div className="text-[10px] font-bold mb-1">Log interaction</div>
                <div className="grid grid-cols-3 gap-1 mb-1">
                  <select value={intDraft.interaction_type} onChange={(e) => setIntDraft({ ...intDraft, interaction_type: e.target.value })} className="win98-input text-[10px] px-1 py-0.5">
                    <option value="note">Note</option><option value="call">Call</option><option value="meeting">Meeting</option>
                    <option value="email">Email</option><option value="event">Event</option>
                  </select>
                  <input value={intDraft.subject} onChange={(e) => setIntDraft({ ...intDraft, subject: e.target.value })} placeholder="Subject" className="win98-input text-[10px] px-1 py-0.5 col-span-2" />
                </div>
                <textarea value={intDraft.body} onChange={(e) => setIntDraft({ ...intDraft, body: e.target.value })} placeholder="Details..." className="win98-input text-[10px] px-1 py-0.5 w-full" rows={2} />
                <button onClick={addInteraction} className="win98-button text-[10px] px-2 py-0.5 mt-1">Log</button>
              </div>
              <div className="border-t border-[hsl(var(--win98-shadow))] pt-2 space-y-1">
                <div className="text-[10px] font-bold">History</div>
                {interactions.length === 0 && <div className="text-[10px] opacity-60">No interactions logged.</div>}
                {interactions.map((i) => (
                  <div key={i.id} className="text-[10px] bg-gray-50 border border-[hsl(var(--win98-shadow))] p-1">
                    <div className="opacity-60 text-[9px]">{new Date(i.occurred_at).toLocaleString()} · {i.interaction_type}</div>
                    {i.subject && <div className="font-bold">{i.subject}</div>}
                    <div>{i.body}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
