import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Trash2, Bell, Webhook } from "lucide-react";
import { toast } from "sonner";
import { OfflineSectionStatus } from "@/components/OfflineSectionStatus";

interface Rule {
  id: string;
  name: string;
  entity_type: string | null;
  entity_id: string | null;
  event_types: string[];
  keywords: string[];
  channels: string[];
  webhook_endpoint_id: string | null;
  enabled: boolean;
  trigger_count: number;
  last_triggered_at: string | null;
}
interface Webhook { id: string; name: string; channel: string; url: string; enabled: boolean }
interface Watch { id: string; entity_type: string; entity_id: string; label: string | null; alert_on_change: boolean }
interface Notif { id: string; title: string; body: string; category: string; read_at: string | null; created_at: string; link: string | null }

const EVENT_TYPES = ["rating_changed", "new_poll", "new_bill_action", "finance_filed", "news_match", "created", "updated"];

export function AlertsHub() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"inbox" | "rules" | "watch" | "webhooks">("inbox");

  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [watches, setWatches] = useState<Watch[]>([]);

  const loadAll = useCallback(async () => {
    const [n, r, w, wt] = await Promise.all([
      supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("alert_rules").select("*").order("created_at", { ascending: false }),
      supabase.from("webhook_endpoints").select("*").order("created_at", { ascending: false }),
      supabase.from("watchlist_items").select("*").order("created_at", { ascending: false }),
    ]);
    setNotifs((n.data || []) as Notif[]);
    setRules((r.data || []) as Rule[]);
    setWebhooks((w.data || []) as Webhook[]);
    setWatches((wt.data || []) as Watch[]);
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`notif-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (p) => setNotifs((prev) => [p.new as Notif, ...prev]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    setNotifs((p) => p.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  }
  async function markAllRead() {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
    setNotifs((p) => p.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
  }
  async function deleteNotif(id: string) {
    await supabase.from("notifications").delete().eq("id", id);
    setNotifs((p) => p.filter((n) => n.id !== id));
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><OfflineSectionStatus label="Alerts" tables={["alert_rules","notifications","watchlist_items","webhook_endpoints"]} /></div>
      <div className="flex gap-1 border-b border-[hsl(var(--win98-shadow))]">
        {(["inbox", "rules", "watch", "webhooks"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`text-[10px] px-2 py-1 ${tab === t ? "bg-[hsl(var(--win98-face))] win98-raised font-bold" : "opacity-70"}`}>
            {t === "inbox" ? `📥 Inbox (${notifs.filter((n) => !n.read_at).length})` : t === "rules" ? "🔔 Rules" : t === "watch" ? "👁️ Watchlist" : "🔗 Webhooks"}
          </button>
        ))}
      </div>

      {tab === "inbox" && (
        <div className="space-y-1">
          <div className="flex justify-between">
            <h3 className="text-[12px] font-bold">Notifications</h3>
            <button onClick={markAllRead} className="win98-button text-[10px] px-2 py-0.5">Mark all read</button>
          </div>
          {notifs.length === 0 && <div className="text-[10px] opacity-60 text-center py-4">No notifications.</div>}
          {notifs.map((n) => (
            <div key={n.id} className={`p-2 border ${n.read_at ? "border-[hsl(var(--win98-shadow))] bg-white" : "border-blue-500 bg-blue-50"}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-[10px] font-bold">{n.title}</div>
                  <div className="text-[10px] whitespace-pre-line">{n.body}</div>
                  <div className="text-[8px] opacity-60 mt-1">{new Date(n.created_at).toLocaleString()} · {n.category}</div>
                </div>
                <div className="flex gap-1">
                  {!n.read_at && <button onClick={() => markRead(n.id)} className="text-[9px] win98-button px-1 py-0">✓</button>}
                  <button onClick={() => deleteNotif(n.id)} className="text-[9px] win98-button px-1 py-0"><Trash2 className="h-2.5 w-2.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "rules" && <RulesTab rules={rules} setRules={setRules} webhooks={webhooks} userId={user?.id} />}
      {tab === "watch" && <WatchTab watches={watches} setWatches={setWatches} userId={user?.id} />}
      {tab === "webhooks" && <WebhooksTab webhooks={webhooks} setWebhooks={setWebhooks} userId={user?.id} />}
    </div>
  );
}

function RulesTab({ rules, setRules, webhooks, userId }: { rules: Rule[]; setRules: (r: Rule[]) => void; webhooks: Webhook[]; userId?: string }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", entity_type: "global", entity_id: "", keywords: "", event_types: [] as string[], channels: ["in_app"] as string[], webhook_endpoint_id: "" });

  async function save() {
    if (!draft.name || !userId) return;
    const { data, error } = await supabase.from("alert_rules").insert({
      user_id: userId, name: draft.name,
      entity_type: draft.entity_type || null, entity_id: draft.entity_id || null,
      keywords: draft.keywords.split(",").map((k) => k.trim()).filter(Boolean),
      event_types: draft.event_types,
      channels: draft.channels,
      webhook_endpoint_id: draft.webhook_endpoint_id || null,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setRules([data as Rule, ...rules]);
    setAdding(false); toast.success("Rule created");
  }

  async function toggle(r: Rule) {
    await supabase.from("alert_rules").update({ enabled: !r.enabled }).eq("id", r.id);
    setRules(rules.map((x) => x.id === r.id ? { ...x, enabled: !r.enabled } : x));
  }
  async function remove(id: string) {
    if (!confirm("Delete this rule?")) return;
    await supabase.from("alert_rules").delete().eq("id", id);
    setRules(rules.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <h3 className="text-[12px] font-bold flex items-center gap-1"><Bell className="h-3 w-3" /> Alert Rules</h3>
        <button onClick={() => setAdding(true)} className="win98-button text-[10px] px-2 py-0.5"><Plus className="h-3 w-3 inline" /> New</button>
      </div>
      {adding && (
        <div className="win98-raised bg-[hsl(var(--win98-face))] p-2 grid grid-cols-2 gap-1">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Rule name *" className="win98-input text-[10px] px-1 py-0.5 col-span-2" />
          <select value={draft.entity_type} onChange={(e) => setDraft({ ...draft, entity_type: e.target.value })} className="win98-input text-[10px] px-1 py-0.5">
            <option value="global">Anywhere</option><option value="candidate">Candidate</option><option value="district">District</option>
            <option value="bill">Bill</option><option value="race">Race</option>
          </select>
          <input value={draft.entity_id} onChange={(e) => setDraft({ ...draft, entity_id: e.target.value })} placeholder="Entity ID/slug" className="win98-input text-[10px] px-1 py-0.5" />
          <input value={draft.keywords} onChange={(e) => setDraft({ ...draft, keywords: e.target.value })} placeholder="Keywords (comma-sep)" className="win98-input text-[10px] px-1 py-0.5 col-span-2" />
          <div className="col-span-2 text-[10px]">
            Event types:
            <div className="flex flex-wrap gap-1 mt-1">
              {EVENT_TYPES.map((et) => (
                <label key={et} className="flex items-center gap-0.5 text-[9px]">
                  <input type="checkbox" checked={draft.event_types.includes(et)} onChange={(e) => setDraft({ ...draft, event_types: e.target.checked ? [...draft.event_types, et] : draft.event_types.filter((x) => x !== et) })} />
                  {et}
                </label>
              ))}
            </div>
          </div>
          <div className="col-span-2 text-[10px]">
            Channels:
            <div className="flex gap-2 mt-1">
              {["in_app", "email", "webhook"].map((c) => (
                <label key={c} className="flex items-center gap-0.5 text-[9px]">
                  <input type="checkbox" checked={draft.channels.includes(c)} onChange={(e) => setDraft({ ...draft, channels: e.target.checked ? [...draft.channels, c] : draft.channels.filter((x) => x !== c) })} />
                  {c}
                </label>
              ))}
            </div>
          </div>
          {draft.channels.includes("webhook") && (
            <select value={draft.webhook_endpoint_id} onChange={(e) => setDraft({ ...draft, webhook_endpoint_id: e.target.value })} className="win98-input text-[10px] px-1 py-0.5 col-span-2">
              <option value="">Select webhook...</option>
              {webhooks.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.channel})</option>)}
            </select>
          )}
          <div className="col-span-2 flex gap-1">
            <button onClick={save} className="win98-button text-[10px] px-2 py-0.5">Save</button>
            <button onClick={() => setAdding(false)} className="win98-button text-[10px] px-2 py-0.5">Cancel</button>
          </div>
        </div>
      )}
      {rules.map((r) => (
        <div key={r.id} className="win98-raised bg-white p-2 text-[10px]">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="font-bold">{r.name} {!r.enabled && <span className="text-red-600">(disabled)</span>}</div>
              <div className="opacity-80">
                {r.entity_type}{r.entity_id ? `:${r.entity_id}` : ""} · events: {r.event_types?.join(", ") || "any"}
                {r.keywords?.length ? ` · keywords: ${r.keywords.join(", ")}` : ""}
              </div>
              <div className="opacity-60 text-[9px]">channels: {r.channels.join(", ")} · triggered {r.trigger_count}× {r.last_triggered_at ? `· last ${new Date(r.last_triggered_at).toLocaleString()}` : ""}</div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => toggle(r)} className="win98-button text-[9px] px-1 py-0">{r.enabled ? "Disable" : "Enable"}</button>
              <button onClick={() => remove(r.id)} className="win98-button text-[9px] px-1 py-0"><Trash2 className="h-2.5 w-2.5" /></button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function WatchTab({ watches, setWatches, userId }: { watches: Watch[]; setWatches: (w: Watch[]) => void; userId?: string }) {
  const [adding, setAdding] = useState(false);
  const [d, setD] = useState({ entity_type: "candidate", entity_id: "", label: "" });
  async function add() {
    if (!d.entity_id || !userId) return;
    const { data, error } = await supabase.from("watchlist_items").insert({ user_id: userId, ...d }).select().single();
    if (error) { toast.error(error.message); return; }
    setWatches([data as Watch, ...watches]);
    setAdding(false); setD({ entity_type: "candidate", entity_id: "", label: "" });
  }
  async function remove(id: string) {
    await supabase.from("watchlist_items").delete().eq("id", id);
    setWatches(watches.filter((w) => w.id !== id));
  }
  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <h3 className="text-[12px] font-bold">👁️ Watchlist</h3>
        <button onClick={() => setAdding(true)} className="win98-button text-[10px] px-2 py-0.5"><Plus className="h-3 w-3 inline" /> Add</button>
      </div>
      {adding && (
        <div className="win98-raised bg-[hsl(var(--win98-face))] p-2 flex gap-1">
          <select value={d.entity_type} onChange={(e) => setD({ ...d, entity_type: e.target.value })} className="win98-input text-[10px] px-1 py-0.5">
            <option value="candidate">Candidate</option><option value="district">District</option><option value="bill">Bill</option>
            <option value="race">Race</option><option value="committee">Committee</option><option value="country">Country</option>
          </select>
          <input value={d.entity_id} onChange={(e) => setD({ ...d, entity_id: e.target.value })} placeholder="ID/slug" className="win98-input text-[10px] px-1 py-0.5 flex-1" />
          <input value={d.label} onChange={(e) => setD({ ...d, label: e.target.value })} placeholder="Label" className="win98-input text-[10px] px-1 py-0.5 flex-1" />
          <button onClick={add} className="win98-button text-[10px] px-2 py-0.5">Add</button>
          <button onClick={() => setAdding(false)} className="win98-button text-[10px] px-2 py-0.5">X</button>
        </div>
      )}
      {watches.map((w) => (
        <div key={w.id} className="flex items-center gap-2 win98-raised bg-white p-1 text-[10px]">
          <span className="font-bold">{w.entity_type}</span>
          <span>{w.entity_id}</span>
          {w.label && <span className="opacity-70">— {w.label}</span>}
          <span className="flex-1" />
          <button onClick={() => remove(w.id)} className="win98-button text-[9px] px-1 py-0"><Trash2 className="h-2.5 w-2.5" /></button>
        </div>
      ))}
    </div>
  );
}

function WebhooksTab({ webhooks, setWebhooks, userId }: { webhooks: Webhook[]; setWebhooks: (w: Webhook[]) => void; userId?: string }) {
  const [adding, setAdding] = useState(false);
  const [d, setD] = useState({ name: "", channel: "slack", url: "" });
  async function add() {
    if (!d.url || !userId) return;
    const { data, error } = await supabase.from("webhook_endpoints").insert({ user_id: userId, ...d }).select().single();
    if (error) { toast.error(error.message); return; }
    setWebhooks([data as Webhook, ...webhooks]);
    setAdding(false); setD({ name: "", channel: "slack", url: "" });
  }
  async function remove(id: string) {
    await supabase.from("webhook_endpoints").delete().eq("id", id);
    setWebhooks(webhooks.filter((w) => w.id !== id));
  }
  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <h3 className="text-[12px] font-bold flex items-center gap-1"><Webhook className="h-3 w-3" /> Webhooks</h3>
        <button onClick={() => setAdding(true)} className="win98-button text-[10px] px-2 py-0.5"><Plus className="h-3 w-3 inline" /> Add</button>
      </div>
      {adding && (
        <div className="win98-raised bg-[hsl(var(--win98-face))] p-2 grid grid-cols-3 gap-1">
          <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Name" className="win98-input text-[10px] px-1 py-0.5" />
          <select value={d.channel} onChange={(e) => setD({ ...d, channel: e.target.value })} className="win98-input text-[10px] px-1 py-0.5">
            <option value="slack">Slack</option><option value="discord">Discord</option><option value="generic">Generic</option>
          </select>
          <input value={d.url} onChange={(e) => setD({ ...d, url: e.target.value })} placeholder="Webhook URL" className="win98-input text-[10px] px-1 py-0.5 col-span-3" />
          <div className="col-span-3 flex gap-1">
            <button onClick={add} className="win98-button text-[10px] px-2 py-0.5">Save</button>
            <button onClick={() => setAdding(false)} className="win98-button text-[10px] px-2 py-0.5">Cancel</button>
          </div>
        </div>
      )}
      {webhooks.map((w) => (
        <div key={w.id} className="flex items-center gap-2 win98-raised bg-white p-1 text-[10px]">
          <span className="font-bold">{w.name}</span>
          <span className="opacity-70">[{w.channel}]</span>
          <span className="flex-1 truncate opacity-60 text-[9px]">{w.url}</span>
          <button onClick={() => remove(w.id)} className="win98-button text-[9px] px-1 py-0"><Trash2 className="h-2.5 w-2.5" /></button>
        </div>
      ))}
    </div>
  );
}
