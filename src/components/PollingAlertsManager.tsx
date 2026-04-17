// Self-serve UI for polling email alerts + email fine-tuning preferences.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Bell, BellOff, Plus, Trash2, Loader2, Send, Settings } from "lucide-react";

interface Sub {
  id: string;
  scope: string;
  scope_value: string | null;
  poll_types: string[];
  min_margin_change: number;
  cadence: string;
  enabled: boolean;
  email: string;
  last_sent_at: string | null;
}

interface Prefs {
  polling_alerts: boolean;
  forecast_changes: boolean;
  scheduled_reports: boolean;
  intel_briefings: boolean;
  digest_frequency: string;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  timezone: string;
}

const DEFAULT_PREFS: Prefs = {
  polling_alerts: true, forecast_changes: true, scheduled_reports: true, intel_briefings: false,
  digest_frequency: "instant", quiet_hours_start: null, quiet_hours_end: null, timezone: "UTC",
};

export function PollingAlertsManager() {
  const { user } = useAuth();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    scope: "all", scope_value: "", cadence: "daily", min_margin_change: 3,
    poll_types: ["approval", "issue", "horserace"],
  });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from("polling_alert_subscriptions" as any).select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("email_notification_preferences" as any).select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    setSubs((s ?? []) as any);
    if (p) setPrefs(p as any);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const create = async () => {
    if (!user) return;
    setBusy("create");
    const { error } = await supabase.from("polling_alert_subscriptions" as any).insert({
      user_id: user.id,
      email: user.email!,
      scope: draft.scope,
      scope_value: draft.scope_value || null,
      cadence: draft.cadence,
      min_margin_change: draft.min_margin_change,
      poll_types: draft.poll_types,
    });
    setBusy(null);
    if (error) toast.error(error.message);
    else { toast.success("Alert created"); setDraft({ ...draft, scope_value: "" }); load(); }
  };

  const remove = async (id: string) => {
    await supabase.from("polling_alert_subscriptions" as any).delete().eq("id", id);
    load();
  };
  const toggle = async (id: string, enabled: boolean) => {
    await supabase.from("polling_alert_subscriptions" as any).update({ enabled }).eq("id", id);
    load();
  };
  const sendNow = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.functions.invoke("polling-alerts-dispatch", { body: { subscription_id: id, force: true } });
    setBusy(null);
    if (error) toast.error(error.message); else toast.success("Alert dispatched");
    load();
  };

  const savePrefs = async (next: Prefs) => {
    if (!user) return;
    setPrefs(next);
    const { error } = await supabase.from("email_notification_preferences" as any).upsert({ user_id: user.id, ...next });
    if (error) toast.error(error.message); else toast.success("Preferences saved");
  };

  const togglePollType = (t: string) => {
    setDraft((d) => ({
      ...d,
      poll_types: d.poll_types.includes(t) ? d.poll_types.filter((x) => x !== t) : [...d.poll_types, t],
    }));
  };

  if (loading) return <div className="text-xs text-muted-foreground p-4">Loading alerts…</div>;

  return (
    <div className="space-y-4">
      {/* Email preferences */}
      <div className="border border-border rounded p-3 bg-card">
        <div className="flex items-center gap-2 text-sm font-bold mb-3">
          <Settings size={14} /> Email Notification Preferences
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {([
            ["polling_alerts", "Polling alerts"],
            ["forecast_changes", "Forecast rating changes"],
            ["scheduled_reports", "Scheduled report deliveries"],
            ["intel_briefings", "Intel briefings"],
          ] as const).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs[k] as boolean}
                onChange={(e) => savePrefs({ ...prefs, [k]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
          <label className="flex flex-col gap-1">
            Digest
            <select
              value={prefs.digest_frequency}
              onChange={(e) => savePrefs({ ...prefs, digest_frequency: e.target.value })}
              className="border border-border bg-background rounded px-2 py-1"
            >
              <option value="instant">Instant</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="off">Off (pause all)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Quiet from (h)
            <input
              type="number" min={0} max={23}
              value={prefs.quiet_hours_start ?? ""}
              onChange={(e) => savePrefs({ ...prefs, quiet_hours_start: e.target.value === "" ? null : Number(e.target.value) })}
              className="border border-border bg-background rounded px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            Quiet to (h)
            <input
              type="number" min={0} max={23}
              value={prefs.quiet_hours_end ?? ""}
              onChange={(e) => savePrefs({ ...prefs, quiet_hours_end: e.target.value === "" ? null : Number(e.target.value) })}
              className="border border-border bg-background rounded px-2 py-1"
            />
          </label>
        </div>
      </div>

      {/* Create polling alert */}
      <div className="border border-border rounded p-3 bg-card">
        <div className="flex items-center gap-2 text-sm font-bold mb-3">
          <Bell size={14} /> Create Polling Alert
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="flex flex-col gap-1">
            Scope
            <select
              value={draft.scope}
              onChange={(e) => setDraft({ ...draft, scope: e.target.value })}
              className="border border-border bg-background rounded px-2 py-1"
            >
              <option value="all">All polls</option>
              <option value="state">By state (e.g. PA)</option>
              <option value="topic">By topic keyword</option>
              <option value="candidate">By candidate name</option>
            </select>
          </label>
          {draft.scope !== "all" && (
            <label className="flex flex-col gap-1">
              {draft.scope === "state" ? "State abbr" : draft.scope === "topic" ? "Topic" : "Candidate"}
              <input
                value={draft.scope_value}
                onChange={(e) => setDraft({ ...draft, scope_value: e.target.value })}
                className="border border-border bg-background rounded px-2 py-1"
                placeholder={draft.scope === "state" ? "PA" : draft.scope === "topic" ? "immigration" : "Trump"}
              />
            </label>
          )}
          <label className="flex flex-col gap-1">
            Cadence
            <select
              value={draft.cadence}
              onChange={(e) => setDraft({ ...draft, cadence: e.target.value })}
              className="border border-border bg-background rounded px-2 py-1"
            >
              <option value="instant">Instant (hourly check)</option>
              <option value="daily">Daily digest</option>
              <option value="weekly">Weekly digest</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Min margin shift (pts)
            <input
              type="number" min={0} step={0.5}
              value={draft.min_margin_change}
              onChange={(e) => setDraft({ ...draft, min_margin_change: Number(e.target.value) })}
              className="border border-border bg-background rounded px-2 py-1"
            />
          </label>
        </div>
        <div className="flex gap-3 mt-2 text-xs">
          {["approval", "issue", "horserace"].map((t) => (
            <label key={t} className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={draft.poll_types.includes(t)} onChange={() => togglePollType(t)} />
              {t}
            </label>
          ))}
        </div>
        <button
          onClick={create}
          disabled={busy === "create"}
          className="mt-3 text-xs flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
        >
          {busy === "create" ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Create alert
        </button>
      </div>

      {/* Existing subscriptions */}
      <div className="border border-border rounded p-3 bg-card">
        <div className="text-sm font-bold mb-2">Your Polling Alerts ({subs.length})</div>
        {subs.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">No alerts yet.</div>
        ) : (
          <div className="space-y-2">
            {subs.map((s) => (
              <div key={s.id} className="border border-border rounded p-2 text-xs flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-bold">
                    {s.scope === "all" ? "All polls" : `${s.scope}: ${s.scope_value}`}
                    <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded ${s.enabled ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>
                      {s.enabled ? "active" : "paused"}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    {s.cadence} · types: {s.poll_types.join(", ")} · ≥{s.min_margin_change}pt shift
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Last sent: {s.last_sent_at ? new Date(s.last_sent_at).toLocaleString() : "never"} → {s.email}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => sendNow(s.id)} disabled={busy === s.id}
                    className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 border border-border rounded hover:bg-accent disabled:opacity-50">
                    {busy === s.id ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />} Test
                  </button>
                  <button onClick={() => toggle(s.id, !s.enabled)}
                    className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 border border-border rounded hover:bg-accent">
                    {s.enabled ? <BellOff size={10} /> : <Bell size={10} />} {s.enabled ? "Pause" : "Resume"}
                  </button>
                  <button onClick={() => remove(s.id)}
                    className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 border border-border rounded hover:bg-destructive/20 text-destructive">
                    <Trash2 size={10} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
