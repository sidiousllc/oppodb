import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Trash2, Bell, Webhook, Activity, StickyNote, Brain, Network, Clock, Play, Loader2 } from "lucide-react";

type SubTab = "alerts" | "webhooks" | "activity" | "notes" | "ai" | "graph" | "cron";

export function Phase5AdminTab() {
  const [sub, setSub] = useState<SubTab>("alerts");

  const subs: Array<{ id: SubTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: "alerts", label: "Alert Rules", icon: Bell },
    { id: "webhooks", label: "Webhooks", icon: Webhook },
    { id: "activity", label: "Activity Feed", icon: Activity },
    { id: "notes", label: "Notes", icon: StickyNote },
    { id: "ai", label: "AI Cache", icon: Brain },
    { id: "graph", label: "Entity Graph", icon: Network },
    { id: "cron", label: "Cron / Dispatch", icon: Clock },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-3 border-b border-[hsl(var(--win98-shadow))] pb-2">
        {subs.map(s => (
          <button
            key={s.id}
            onClick={() => setSub(s.id)}
            className={`win98-button text-[10px] flex items-center gap-1 ${sub === s.id ? "font-bold bg-white" : ""}`}
          >
            <s.icon className="h-3 w-3" />{s.label}
          </button>
        ))}
      </div>
      {sub === "alerts" && <AlertRulesAdmin />}
      {sub === "webhooks" && <WebhooksAdmin />}
      {sub === "activity" && <ActivityAdmin />}
      {sub === "notes" && <NotesAdmin />}
      {sub === "ai" && <AiCacheAdmin />}
      {sub === "graph" && <GraphAdmin />}
      {sub === "cron" && <CronAdmin />}
    </div>
  );
}

// ─── Alert Rules ─────────────────────────────────────────────────────────────
function AlertRulesAdmin() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("alert_rules").select("*").order("created_at", { ascending: false }).limit(500);
    setRules(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (id: string, enabled: boolean) => {
    const { error } = await supabase.from("alert_rules").update({ enabled: !enabled }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Updated"); load(); }
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this alert rule?")) return;
    const { error } = await supabase.from("alert_rules").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };
  const dispatchTest = async () => {
    const { data, error } = await supabase.functions.invoke("dispatch-alerts");
    if (error) toast.error(error.message); else toast.success(`Dispatched: ${JSON.stringify(data)}`);
  };

  const filtered = rules.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.user_id.includes(search));

  if (loading) return <div className="text-[10px] py-4">Loading...</div>;
  return (
    <div>
      <div className="flex justify-between items-center mb-2 gap-2">
        <input className="win98-input flex-1 text-[10px]" placeholder="Search by name or user_id..." value={search} onChange={e => setSearch(e.target.value)} />
        <button className="win98-button text-[10px] flex items-center gap-1" onClick={dispatchTest}><Play className="h-3 w-3" />Force Dispatch</button>
        <button className="win98-button text-[10px]" onClick={load}><RefreshCw className="h-3 w-3" /></button>
      </div>
      <div className="text-[9px] text-[hsl(var(--muted-foreground))] mb-1">{filtered.length} of {rules.length} rules</div>
      <div className="win98-sunken bg-white max-h-[500px] overflow-auto">
        <table className="w-full text-[10px]">
          <thead className="sticky top-0 bg-[hsl(var(--win98-face))]">
            <tr><th className="text-left px-2 py-1">Name</th><th className="text-left px-2 py-1">User</th><th className="text-left px-2 py-1">Scope</th><th className="text-left px-2 py-1">Channels</th><th className="text-left px-2 py-1">Triggers</th><th className="text-left px-2 py-1">Enabled</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-b border-[hsl(var(--win98-light))]">
                <td className="px-2 py-1 font-bold">{r.name}</td>
                <td className="px-2 py-1 text-[9px]">{r.user_id.slice(0, 8)}</td>
                <td className="px-2 py-1 text-[9px]">{r.entity_type || "global"}{r.entity_id ? `:${r.entity_id.slice(0, 12)}` : ""}</td>
                <td className="px-2 py-1 text-[9px]">{(r.channels || []).join(", ")}</td>
                <td className="px-2 py-1 text-center">{r.trigger_count}</td>
                <td className="px-2 py-1"><input type="checkbox" checked={r.enabled} onChange={() => toggle(r.id, r.enabled)} /></td>
                <td className="px-2 py-1"><button onClick={() => remove(r.id)} className="text-red-600"><Trash2 className="h-3 w-3" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Webhooks ────────────────────────────────────────────────────────────────
function WebhooksAdmin() {
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("webhook_endpoints").select("*").order("created_at", { ascending: false }).limit(500);
    setEndpoints(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    if (!confirm("Delete this webhook endpoint?")) return;
    const { error } = await supabase.from("webhook_endpoints").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };
  const toggle = async (id: string, enabled: boolean) => {
    const { error } = await supabase.from("webhook_endpoints").update({ enabled: !enabled }).eq("id", id);
    if (error) toast.error(error.message); else load();
  };
  const test = async (ep: any) => {
    setTesting(ep.id);
    try {
      const body = ep.channel === "slack" || ep.channel === "discord"
        ? { text: `🔔 ORDB Admin Test from ${ep.name}`, content: `🔔 ORDB Admin Test from ${ep.name}` }
        : { test: true, name: ep.name, ts: new Date().toISOString() };
      const r = await fetch(ep.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) toast.success(`Test sent (HTTP ${r.status})`);
      else toast.error(`Webhook returned HTTP ${r.status}`);
    } catch (e: any) {
      toast.error(`Failed: ${e.message}`);
    } finally { setTesting(null); }
  };

  if (loading) return <div className="text-[10px] py-4">Loading...</div>;
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px]">{endpoints.length} webhook endpoints</span>
        <button className="win98-button text-[10px]" onClick={load}><RefreshCw className="h-3 w-3" /></button>
      </div>
      <div className="win98-sunken bg-white max-h-[500px] overflow-auto">
        <table className="w-full text-[10px]">
          <thead className="sticky top-0 bg-[hsl(var(--win98-face))]"><tr><th className="text-left px-2 py-1">Name</th><th className="text-left px-2 py-1">Channel</th><th className="text-left px-2 py-1">URL</th><th className="text-left px-2 py-1">User</th><th className="text-left px-2 py-1">Enabled</th><th></th></tr></thead>
          <tbody>
            {endpoints.map(e => (
              <tr key={e.id} className="border-b border-[hsl(var(--win98-light))]">
                <td className="px-2 py-1 font-bold">{e.name}</td>
                <td className="px-2 py-1">{e.channel}</td>
                <td className="px-2 py-1 text-[9px] truncate max-w-[280px]" title={e.url}>{e.url}</td>
                <td className="px-2 py-1 text-[9px]">{e.user_id.slice(0, 8)}</td>
                <td className="px-2 py-1"><input type="checkbox" checked={e.enabled} onChange={() => toggle(e.id, e.enabled)} /></td>
                <td className="px-2 py-1 flex gap-1">
                  <button className="win98-button text-[9px] px-1" disabled={testing === e.id} onClick={() => test(e)}>
                    {testing === e.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Test"}
                  </button>
                  <button onClick={() => remove(e.id)} className="text-red-600"><Trash2 className="h-3 w-3" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Activity ────────────────────────────────────────────────────────────────
function ActivityAdmin() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("entity_activity").select("*").order("created_at", { ascending: false }).limit(500);
    setActivities(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    if (!confirm("Delete this activity entry?")) return;
    const { error } = await supabase.from("entity_activity").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };

  const filtered = activities.filter(a => !filter || a.summary.toLowerCase().includes(filter.toLowerCase()) || a.entity_type === filter || a.event_type === filter);

  if (loading) return <div className="text-[10px] py-4">Loading...</div>;
  return (
    <div>
      <div className="flex gap-2 mb-2">
        <input className="win98-input flex-1 text-[10px]" placeholder="Filter (summary, entity_type, event_type)..." value={filter} onChange={e => setFilter(e.target.value)} />
        <button className="win98-button text-[10px]" onClick={load}><RefreshCw className="h-3 w-3" /></button>
      </div>
      <div className="text-[9px] text-[hsl(var(--muted-foreground))] mb-1">{filtered.length} of {activities.length} (last 500)</div>
      <div className="win98-sunken bg-white max-h-[500px] overflow-auto">
        <table className="w-full text-[10px]">
          <thead className="sticky top-0 bg-[hsl(var(--win98-face))]"><tr><th className="text-left px-2 py-1">When</th><th className="text-left px-2 py-1">Type</th><th className="text-left px-2 py-1">Event</th><th className="text-left px-2 py-1">Summary</th><th></th></tr></thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.id} className="border-b border-[hsl(var(--win98-light))]">
                <td className="px-2 py-1 text-[9px]">{new Date(a.created_at).toLocaleString()}</td>
                <td className="px-2 py-1 text-[9px]">{a.entity_type}</td>
                <td className="px-2 py-1 text-[9px]">{a.event_type}</td>
                <td className="px-2 py-1">{a.summary}</td>
                <td className="px-2 py-1"><button onClick={() => remove(a.id)} className="text-red-600"><Trash2 className="h-3 w-3" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Notes ───────────────────────────────────────────────────────────────────
function NotesAdmin() {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharedOnly, setSharedOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("entity_notes").select("*").order("created_at", { ascending: false }).limit(500);
    if (sharedOnly) q = q.eq("is_shared", true);
    const { data } = await q;
    setNotes(data || []);
    setLoading(false);
  }, [sharedOnly]);
  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    if (!confirm("Moderate (delete) this note?")) return;
    const { error } = await supabase.from("entity_notes").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };
  const toggleShared = async (id: string, isShared: boolean) => {
    const { error } = await supabase.from("entity_notes").update({ is_shared: !isShared }).eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  if (loading) return <div className="text-[10px] py-4">Loading...</div>;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <label className="text-[10px] flex items-center gap-1"><input type="checkbox" checked={sharedOnly} onChange={e => setSharedOnly(e.target.checked)} /> Shared only</label>
        <span className="text-[10px] flex-1">{notes.length} notes</span>
        <button className="win98-button text-[10px]" onClick={load}><RefreshCw className="h-3 w-3" /></button>
      </div>
      <div className="space-y-2 max-h-[500px] overflow-auto">
        {notes.map(n => (
          <div key={n.id} className="win98-raised bg-white p-2 text-[10px]">
            <div className="flex justify-between items-start gap-2 mb-1">
              <div className="text-[9px] text-[hsl(var(--muted-foreground))]">
                <b>{n.entity_type}</b>:{n.entity_id} · user {n.user_id.slice(0, 8)} · {new Date(n.created_at).toLocaleString()}
                {n.is_shared && <span className="ml-1 text-blue-700 font-bold">[SHARED]</span>}
                {n.mentions?.length > 0 && <span className="ml-1">@{n.mentions.length}</span>}
              </div>
              <div className="flex gap-1">
                <button className="win98-button text-[9px] px-1" onClick={() => toggleShared(n.id, n.is_shared)}>{n.is_shared ? "Make private" : "Make shared"}</button>
                <button onClick={() => remove(n.id)} className="text-red-600"><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
            <div className="whitespace-pre-wrap">{n.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AI Cache ────────────────────────────────────────────────────────────────
function AiCacheAdmin() {
  const [type, setType] = useState<"vulnerability_scores" | "talking_points" | "bill_impact_analyses">("vulnerability_scores");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from(type).select("*").order("updated_at", { ascending: false }).limit(300);
    setRows(data || []);
    setLoading(false);
  }, [type]);
  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    if (!confirm("Delete this cached analysis?")) return;
    const { error } = await supabase.from(type).delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };

  const regenerateOne = async (row: any) => {
    setWorking(row.id);
    try {
      if (type === "vulnerability_scores") {
        const { error } = await supabase.functions.invoke("vulnerability-score", { body: { candidate_slug: row.candidate_slug, force: true } });
        if (error) throw error;
      } else if (type === "talking_points") {
        const { error } = await supabase.functions.invoke("talking-points", { body: { subject_type: row.subject_type, subject_ref: row.subject_ref, audience: row.audience, angle: row.angle, force: true } });
        if (error) throw error;
      } else {
        const { error } = await supabase.functions.invoke("bill-impact", { body: { bill_id: row.bill_id, scope: row.scope, scope_ref: row.scope_ref, force: true } });
        if (error) throw error;
      }
      toast.success("Regenerated");
      load();
    } catch (e: any) {
      toast.error(`Failed: ${e.message}`);
    } finally { setWorking(null); }
  };

  const bulkRegenerate = async () => {
    if (!confirm(`Bulk regenerate ALL ${rows.length} ${type}? This may take a long time and consume AI credits.`)) return;
    setWorking("bulk");
    let ok = 0, fail = 0;
    for (const row of rows) {
      try {
        if (type === "vulnerability_scores") {
          await supabase.functions.invoke("vulnerability-score", { body: { candidate_slug: row.candidate_slug, force: true } });
        } else if (type === "talking_points") {
          await supabase.functions.invoke("talking-points", { body: { subject_type: row.subject_type, subject_ref: row.subject_ref, audience: row.audience, angle: row.angle, force: true } });
        } else {
          await supabase.functions.invoke("bill-impact", { body: { bill_id: row.bill_id, scope: row.scope, scope_ref: row.scope_ref, force: true } });
        }
        ok++;
      } catch { fail++; }
    }
    toast.success(`Bulk done: ${ok} ok, ${fail} failed`);
    setWorking(null);
    load();
  };

  if (loading) return <div className="text-[10px] py-4">Loading...</div>;
  return (
    <div>
      <div className="flex gap-2 mb-2 items-center flex-wrap">
        <select className="win98-input text-[10px]" value={type} onChange={e => setType(e.target.value as any)}>
          <option value="vulnerability_scores">Vulnerability Scores</option>
          <option value="talking_points">Talking Points</option>
          <option value="bill_impact_analyses">Bill Impact</option>
        </select>
        <span className="text-[10px] flex-1">{rows.length} cached</span>
        <button className="win98-button text-[10px]" onClick={load}><RefreshCw className="h-3 w-3" /></button>
        <button className="win98-button text-[10px] font-bold" disabled={working === "bulk"} onClick={bulkRegenerate}>
          {working === "bulk" ? <Loader2 className="h-3 w-3 animate-spin" /> : "🔄 Bulk Regenerate All"}
        </button>
      </div>
      <div className="win98-sunken bg-white max-h-[500px] overflow-auto">
        <table className="w-full text-[10px]">
          <thead className="sticky top-0 bg-[hsl(var(--win98-face))]"><tr><th className="text-left px-2 py-1">Subject</th><th className="text-left px-2 py-1">Model</th><th className="text-left px-2 py-1">Updated</th><th></th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-[hsl(var(--win98-light))]">
                <td className="px-2 py-1 font-bold">
                  {type === "vulnerability_scores" && r.candidate_slug}
                  {type === "talking_points" && `${r.subject_type}:${r.subject_ref} (${r.audience}/${r.angle})`}
                  {type === "bill_impact_analyses" && `bill:${r.bill_id} scope:${r.scope}${r.scope_ref ? ":" + r.scope_ref : ""}`}
                </td>
                <td className="px-2 py-1 text-[9px]">{r.model}</td>
                <td className="px-2 py-1 text-[9px]">{new Date(r.updated_at).toLocaleString()}</td>
                <td className="px-2 py-1 flex gap-1">
                  <button className="win98-button text-[9px] px-1" disabled={working === r.id} onClick={() => regenerateOne(r)}>
                    {working === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Regenerate"}
                  </button>
                  <button onClick={() => remove(r.id)} className="text-red-600"><Trash2 className="h-3 w-3" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Graph ───────────────────────────────────────────────────────────────────
function GraphAdmin() {
  const [edges, setEdges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newEdge, setNewEdge] = useState({ source_type: "candidate", source_id: "", source_label: "", target_type: "donor", target_id: "", target_label: "", relationship_type: "donation", weight: "1", amount: "", source: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("entity_relationships").select("*").order("created_at", { ascending: false }).limit(500);
    setEdges(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    if (!confirm("Delete this relationship edge?")) return;
    const { error } = await supabase.from("entity_relationships").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };
  const create = async () => {
    if (!newEdge.source_id || !newEdge.target_id || !newEdge.source_label || !newEdge.target_label) {
      toast.error("Source/target ID + labels required"); return;
    }
    const { error } = await supabase.from("entity_relationships").insert({
      source_type: newEdge.source_type, source_id: newEdge.source_id, source_label: newEdge.source_label,
      target_type: newEdge.target_type, target_id: newEdge.target_id, target_label: newEdge.target_label,
      relationship_type: newEdge.relationship_type,
      weight: parseFloat(newEdge.weight) || 1,
      amount: newEdge.amount ? parseFloat(newEdge.amount) : null,
      source: newEdge.source || "manual",
    });
    if (error) toast.error(error.message); else { toast.success("Edge created"); setShowNew(false); load(); }
  };

  const filtered = edges.filter(e => !search || e.source_label.toLowerCase().includes(search.toLowerCase()) || e.target_label.toLowerCase().includes(search.toLowerCase()) || e.relationship_type === search);

  if (loading) return <div className="text-[10px] py-4">Loading...</div>;
  return (
    <div>
      <div className="flex gap-2 mb-2">
        <input className="win98-input flex-1 text-[10px]" placeholder="Filter labels or relationship_type..." value={search} onChange={e => setSearch(e.target.value)} />
        <button className="win98-button text-[10px]" onClick={() => setShowNew(!showNew)}>{showNew ? "Cancel" : "+ Add Edge"}</button>
        <button className="win98-button text-[10px]" onClick={load}><RefreshCw className="h-3 w-3" /></button>
      </div>
      {showNew && (
        <div className="win98-raised bg-[hsl(var(--win98-face))] p-2 mb-2 grid grid-cols-3 gap-1 text-[10px]">
          <input className="win98-input" placeholder="source_type" value={newEdge.source_type} onChange={e => setNewEdge({ ...newEdge, source_type: e.target.value })} />
          <input className="win98-input" placeholder="source_id" value={newEdge.source_id} onChange={e => setNewEdge({ ...newEdge, source_id: e.target.value })} />
          <input className="win98-input" placeholder="source_label" value={newEdge.source_label} onChange={e => setNewEdge({ ...newEdge, source_label: e.target.value })} />
          <input className="win98-input" placeholder="target_type" value={newEdge.target_type} onChange={e => setNewEdge({ ...newEdge, target_type: e.target.value })} />
          <input className="win98-input" placeholder="target_id" value={newEdge.target_id} onChange={e => setNewEdge({ ...newEdge, target_id: e.target.value })} />
          <input className="win98-input" placeholder="target_label" value={newEdge.target_label} onChange={e => setNewEdge({ ...newEdge, target_label: e.target.value })} />
          <input className="win98-input" placeholder="relationship_type" value={newEdge.relationship_type} onChange={e => setNewEdge({ ...newEdge, relationship_type: e.target.value })} />
          <input className="win98-input" placeholder="weight" value={newEdge.weight} onChange={e => setNewEdge({ ...newEdge, weight: e.target.value })} />
          <input className="win98-input" placeholder="amount (optional)" value={newEdge.amount} onChange={e => setNewEdge({ ...newEdge, amount: e.target.value })} />
          <input className="win98-input col-span-2" placeholder="source (e.g. 'manual', 'fec')" value={newEdge.source} onChange={e => setNewEdge({ ...newEdge, source: e.target.value })} />
          <button className="win98-button font-bold" onClick={create}>Create Edge</button>
        </div>
      )}
      <div className="text-[9px] text-[hsl(var(--muted-foreground))] mb-1">{filtered.length} of {edges.length} edges</div>
      <div className="win98-sunken bg-white max-h-[450px] overflow-auto">
        <table className="w-full text-[10px]">
          <thead className="sticky top-0 bg-[hsl(var(--win98-face))]"><tr><th className="text-left px-2 py-1">Source</th><th className="text-left px-2 py-1">→</th><th className="text-left px-2 py-1">Target</th><th className="text-left px-2 py-1">Type</th><th className="text-left px-2 py-1">Wt/Amt</th><th></th></tr></thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id} className="border-b border-[hsl(var(--win98-light))]">
                <td className="px-2 py-1"><b>{e.source_label}</b><div className="text-[9px] text-[hsl(var(--muted-foreground))]">{e.source_type}</div></td>
                <td className="px-2 py-1 text-[9px]">{e.relationship_type}</td>
                <td className="px-2 py-1"><b>{e.target_label}</b><div className="text-[9px] text-[hsl(var(--muted-foreground))]">{e.target_type}</div></td>
                <td className="px-2 py-1 text-[9px]">{e.source}</td>
                <td className="px-2 py-1 text-[9px]">w={e.weight}{e.amount ? ` $${e.amount}` : ""}</td>
                <td className="px-2 py-1"><button onClick={() => remove(e.id)} className="text-red-600"><Trash2 className="h-3 w-3" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Cron / Dispatch ─────────────────────────────────────────────────────────
function CronAdmin() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("alert_dispatch_log").select("*").order("created_at", { ascending: false }).limit(200);
    setLogs(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const dispatch = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("dispatch-alerts");
    setRunning(false);
    if (error) toast.error(error.message); else { toast.success(`Dispatch result: ${JSON.stringify(data)}`); load(); }
  };

  const stats = {
    last24h: logs.filter(l => Date.now() - new Date(l.created_at).getTime() < 86400000).length,
    sent: logs.filter(l => l.status === "sent").length,
    failed: logs.filter(l => l.status === "failed").length,
    lastSent: logs.find(l => l.status === "sent")?.created_at,
  };

  if (loading) return <div className="text-[10px] py-4">Loading...</div>;
  return (
    <div>
      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="win98-raised p-2 text-center"><div className="text-[9px] text-[hsl(var(--muted-foreground))]">Last 24h</div><div className="text-base font-bold">{stats.last24h}</div></div>
        <div className="win98-raised p-2 text-center"><div className="text-[9px] text-[hsl(var(--muted-foreground))]">Sent (200)</div><div className="text-base font-bold text-green-700">{stats.sent}</div></div>
        <div className="win98-raised p-2 text-center"><div className="text-[9px] text-[hsl(var(--muted-foreground))]">Failed</div><div className="text-base font-bold text-red-700">{stats.failed}</div></div>
        <div className="win98-raised p-2 text-center"><div className="text-[9px] text-[hsl(var(--muted-foreground))]">Last Sent</div><div className="text-[10px] font-bold">{stats.lastSent ? new Date(stats.lastSent).toLocaleString() : "Never"}</div></div>
      </div>
      <div className="flex gap-2 mb-2">
        <button className="win98-button text-[10px] font-bold flex items-center gap-1" disabled={running} onClick={dispatch}>
          {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} Run Dispatch Now
        </button>
        <button className="win98-button text-[10px]" onClick={load}><RefreshCw className="h-3 w-3" /></button>
        <span className="text-[9px] self-center text-[hsl(var(--muted-foreground))]">Cron runs dispatch-alerts every 5 minutes via pg_cron</span>
      </div>
      <div className="win98-sunken bg-white max-h-[400px] overflow-auto">
        <table className="w-full text-[10px]">
          <thead className="sticky top-0 bg-[hsl(var(--win98-face))]"><tr><th className="text-left px-2 py-1">When</th><th className="text-left px-2 py-1">Channel</th><th className="text-left px-2 py-1">Status</th><th className="text-left px-2 py-1">User</th><th className="text-left px-2 py-1">Error</th></tr></thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id} className="border-b border-[hsl(var(--win98-light))]">
                <td className="px-2 py-1 text-[9px]">{new Date(l.created_at).toLocaleString()}</td>
                <td className="px-2 py-1 text-[9px]">{l.channel}</td>
                <td className={`px-2 py-1 text-[9px] font-bold ${l.status === "sent" ? "text-green-700" : "text-red-700"}`}>{l.status}</td>
                <td className="px-2 py-1 text-[9px]">{l.user_id?.slice(0, 8)}</td>
                <td className="px-2 py-1 text-[9px] text-red-700 truncate max-w-[260px]">{l.error}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
