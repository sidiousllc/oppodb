import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Sync Preferences Panel
 * ----------------------
 * Lets each user override the auto-sync cadence (default 15 min) and
 * enable/disable per-source refreshes for the data hubs they care about.
 *
 * Backed by the `user_sync_preferences` table (RLS: per-user).
 * The global cron job (every 15 min) drives server-side data ingestion;
 * these preferences control how frequently the *client* refreshes its
 * cached views from the database.
 */

const SOURCES: Array<{ id: string; label: string; emoji: string; description: string }> = [
  { id: "all", label: "All sections (master)", emoji: "🌐", description: "Master cadence — overridden by per-source settings below" },
  { id: "polling", label: "Polling Data", emoji: "📊", description: "DataHub → Polling, alerts" },
  { id: "prediction_markets", label: "Prediction Markets", emoji: "📈", description: "DataHub → Markets, trading" },
  { id: "campaign_finance", label: "Campaign Finance", emoji: "💰", description: "Federal + state CFB" },
  { id: "congress", label: "Congress (members/bills/votes)", emoji: "🏛️", description: "Congress.gov + LegiScan" },
  { id: "intel", label: "Intel Briefings", emoji: "📰", description: "Multi-partisan news clusters" },
  { id: "geopolitics", label: "International Geopolitics", emoji: "🌍", description: "AI-cached country briefs (heavy)" },
  { id: "forecasts", label: "Election Forecasts", emoji: "🔮", description: "Cook, Sabato, Inside Elections" },
  { id: "elections", label: "Election Results", emoji: "🗳️", description: "MIT historical + congressional" },
  { id: "lobbying", label: "Lobbying & Contracts", emoji: "🏢", description: "OpenSecrets + USAspending" },
  { id: "courts", label: "Court Records", emoji: "⚖️", description: "CourtListener / PACER" },
];

type Pref = { source: string; interval_minutes: number; enabled: boolean };

export function SyncPreferencesPanel() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Record<string, Pref>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [lastRuns, setLastRuns] = useState<Record<string, { status: string; finished_at: string | null }>>({});
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: prefRows }, { data: runRows }] = await Promise.all([
        supabase.from("user_sync_preferences").select("source,interval_minutes,enabled").eq("user_id", user.id),
        supabase.from("sync_run_log").select("source,status,finished_at").order("started_at", { ascending: false }).limit(200),
      ]);
      const map: Record<string, Pref> = {};
      (prefRows || []).forEach((r) => { map[r.source] = r as Pref; });
      // hydrate defaults for any source not yet set
      SOURCES.forEach((s) => {
        if (!map[s.id]) map[s.id] = { source: s.id, interval_minutes: 15, enabled: true };
      });
      setPrefs(map);
      const runMap: Record<string, { status: string; finished_at: string | null }> = {};
      (runRows || []).forEach((r) => {
        if (!runMap[r.source]) runMap[r.source] = { status: r.status, finished_at: r.finished_at };
      });
      setLastRuns(runMap);
      setLoading(false);
    })();
  }, [user]);

  const updatePref = async (sourceId: string, patch: Partial<Pref>) => {
    if (!user) return;
    const next = { ...prefs[sourceId], ...patch };
    setPrefs((p) => ({ ...p, [sourceId]: next }));
    setSaving(sourceId);
    const { error } = await supabase
      .from("user_sync_preferences")
      .upsert(
        { user_id: user.id, source: sourceId, interval_minutes: next.interval_minutes, enabled: next.enabled },
        { onConflict: "user_id,source" },
      );
    if (error) setMsg({ type: "error", text: error.message });
    else setMsg({ type: "success", text: `Updated ${sourceId} preferences.` });
    setSaving(null);
    setTimeout(() => setMsg(null), 2500);
  };

  if (loading) return <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Loading sync preferences…</p>;

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
        The global server cron syncs data <b>every 15 minutes</b>. Use the controls below to override how often <i>your</i> app
        re-fetches from each data source. Disable any source you don't use to save bandwidth.
      </p>
      {msg && (
        <div className={`text-[10px] p-1.5 border ${msg.type === "error" ? "bg-[#fff0f0] border-red-400 text-red-700" : "bg-[#f0fff0] border-green-400 text-green-700"}`}>
          {msg.text}
        </div>
      )}
      <div className="win98-sunken bg-white">
        <table className="w-full text-[10px]">
          <thead className="bg-[hsl(var(--win98-face))]">
            <tr>
              <th className="text-left px-2 py-1">Source</th>
              <th className="text-left px-2 py-1">Interval</th>
              <th className="text-left px-2 py-1">Enabled</th>
              <th className="text-left px-2 py-1">Last Run</th>
            </tr>
          </thead>
          <tbody>
            {SOURCES.map((s) => {
              const p = prefs[s.id];
              const last = lastRuns[s.id];
              return (
                <tr key={s.id} className="border-t border-[hsl(var(--win98-shadow))]">
                  <td className="px-2 py-1">
                    <div className="font-bold">{s.emoji} {s.label}</div>
                    <div className="text-[9px] text-[hsl(var(--muted-foreground))]">{s.description}</div>
                  </td>
                  <td className="px-2 py-1">
                    <select
                      value={p.interval_minutes}
                      onChange={(e) => updatePref(s.id, { interval_minutes: parseInt(e.target.value) })}
                      disabled={saving === s.id}
                      className="win98-input text-[10px]"
                    >
                      <option value={5}>5 min</option>
                      <option value={15}>15 min (default)</option>
                      <option value={30}>30 min</option>
                      <option value={60}>1 hour</option>
                      <option value={180}>3 hours</option>
                      <option value={360}>6 hours</option>
                      <option value={720}>12 hours</option>
                      <option value={1440}>24 hours</option>
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="checkbox"
                      checked={p.enabled}
                      disabled={saving === s.id}
                      onChange={(e) => updatePref(s.id, { enabled: e.target.checked })}
                    />
                  </td>
                  <td className="px-2 py-1 text-[9px] text-[hsl(var(--muted-foreground))]">
                    {last ? (
                      <>
                        <span className={last.status === "success" ? "text-green-700" : "text-red-700"}>{last.status}</span>
                        <br />
                        {last.finished_at ? new Date(last.finished_at).toLocaleString() : "—"}
                      </>
                    ) : "Never"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
