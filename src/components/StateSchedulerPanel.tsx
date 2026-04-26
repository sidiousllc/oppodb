import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface StateSchedule {
  state: string;
  refresh_hours: number;
  health_threshold: number;
  health_score: number;
  last_sync_at: string | null;
  enabled: boolean;
  last_alerted_at: string | null;
}

interface ScheduleUpdate {
  state_abbr: string;
  refresh_hours: number;
  health_threshold: number;
  health_window_hours?: number;
  channels?: string[];
  enabled?: boolean;
}

const ALL_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
  "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
  "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

function HealthPill({ score }: { score: number }) {
  const cls = score >= 70 ? "bg-green-600 text-white"
    : score >= 40 ? "bg-yellow-500 text-black"
    : "bg-red-600 text-white";
  return (
    <span className={`px-1.5 py-[2px] text-[10px] font-bold rounded ${cls}`}>
      {score}
    </span>
  );
}

function StateRow({
  schedule,
  onUpdate,
}: {
  schedule: StateSchedule;
  onUpdate: (patch: Partial<ScheduleUpdate>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async (patch: Partial<ScheduleUpdate>) => {
    setSaving(true);
    const { error } = await supabase.functions.invoke("state-health-scheduler", {
      method: "PUT",
      body: JSON.stringify({ state_abbr: schedule.state, ...patch }),
    });
    setSaving(false);
    if (!error) onUpdate(patch);
  };

  return (
    <div className="border border-[hsl(var(--win98-shadow))] bg-white text-[11px]">
      {/* Compact row */}
      <div className="flex items-center gap-2 px-2 py-1 hover:bg-[hsl(var(--win98-face))] cursor-pointer"
           onClick={() => setExpanded((v) => !v)}>
        <input type="checkbox" checked={schedule.enabled} readOnly className="win98-input" />
        <span className="font-bold w-8">{schedule.state}</span>
        <HealthPill score={schedule.health_score} />
        <span className="text-[hsl(var(--muted-foreground))]">
          refresh every {schedule.refresh_hours}h
        </span>
        <span className="text-[hsl(var(--muted-foreground))]">
          alert &lt;{schedule.health_threshold}
        </span>
        <span className="text-[hsl(var(--muted-foreground))] ml-auto">
          {schedule.last_sync_at
            ? new Date(schedule.last_sync_at).toLocaleString()
            : "—"}
        </span>
        <span className="text-[9px] text-[hsl(var(--muted-foreground))]">
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="px-4 py-2 border-t border-[hsl(var(--win98-shadow))] bg-[hsl(var(--win98-face))] space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2">
              <span className="w-28 text-right text-[10px]">Refresh interval</span>
              <select
                className="win98-input text-[10px]"
                value={schedule.refresh_hours}
                disabled={saving}
                onChange={(e) => handleSave({ refresh_hours: parseInt(e.target.value) })}
              >
                <option value={1}>1 hour</option>
                <option value={2}>2 hours</option>
                <option value={3}>3 hours</option>
                <option value={6}>6 hours</option>
                <option value={12}>12 hours</option>
                <option value={24}>24 hours</option>
                <option value={48}>48 hours</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="w-28 text-right text-[10px]">Alert threshold</span>
              <select
                className="win98-input text-[10px]"
                value={schedule.health_threshold}
                disabled={saving}
                onChange={(e) => handleSave({ health_threshold: parseInt(e.target.value) })}
              >
                <option value={30}>Below 30%</option>
                <option value={40}>Below 40%</option>
                <option value={50}>Below 50%</option>
                <option value={60}>Below 60% (default)</option>
                <option value={70}>Below 70%</option>
                <option value={80}>Below 80%</option>
                <option value={90}>Below 90%</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="w-28 text-right text-[10px]">Health window</span>
              <select
                className="win98-input text-[10px]"
                value={schedule.health_threshold}
                onChange={() => {}}
                disabled
                title="Computed from refresh interval"
              >
                <option value={schedule.refresh_hours * 4}>
                  Last {schedule.refresh_hours * 4}h
                </option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="w-28 text-right text-[10px]">Enabled</span>
              <input
                type="checkbox"
                className="win98-input"
                checked={schedule.enabled}
                disabled={saving}
                onChange={(e) => handleSave({ enabled: e.target.checked })}
              />
            </label>
          </div>
          <div className="text-[9px] text-[hsl(var(--muted-foreground))]">
            Last alerted: {schedule.last_alerted_at ? new Date(schedule.last_alerted_at).toLocaleString() : "Never"}
          </div>
        </div>
      )}
    </div>
  );
}

export function StateSchedulerPanel() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<StateSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "healthy" | "warn" | "critical">("all");
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchSchedules = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("state-health-scheduler", {
      method: "GET",
    });
    if (error || !data) {
      setMsg({ type: "error", text: "Failed to load schedules" });
    } else {
      setSchedules(data.schedules || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  const handleUpdate = (state: string, patch: Partial<ScheduleUpdate>) => {
    setSchedules((prev) =>
      prev.map((s) => s.state === state ? { ...s, ...patch } as StateSchedule : s)
    );
    setMsg({ type: "success", text: `Updated ${state}` });
    setTimeout(() => setMsg(null), 2500);
  };

  const filtered = schedules.filter((s) => {
    if (search && !s.state.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "healthy") return s.health_score >= 70;
    if (filter === "warn") return s.health_score >= 40 && s.health_score < 70;
    if (filter === "critical") return s.health_score < 40;
    return true;
  });

  const counts = {
    all: schedules.length,
    healthy: schedules.filter((s) => s.health_score >= 70).length,
    warn: schedules.filter((s) => s.health_score >= 40 && s.health_score < 70).length,
    critical: schedules.filter((s) => s.health_score < 40).length,
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h3 className="text-[12px] font-bold">State Scheduler</h3>
        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
          Per-state auto-refresh intervals and health alerts
        </span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 text-[10px]">
        {(["all","healthy","warn","critical"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-1 border border-[hsl(var(--win98-shadow))] ${
              filter === f
                ? "bg-[hsl(var(--win98-face))] font-bold"
                : "bg-white"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
          </button>
        ))}
        <input
          className="win98-input text-[10px] ml-auto w-32"
          placeholder="Search state…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {msg && (
        <div className={`text-[10px] p-1.5 border ${
          msg.type === "error" ? "bg-red-50 border-red-400 text-red-700"
            : "bg-green-50 border-green-400 text-green-700"
        }`}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Loading…</p>
      ) : (
        <div className="win98-sunken bg-white max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-[10px] p-2 text-[hsl(var(--muted-foreground))]">No states match.</p>
          ) : (
            filtered.map((s) => (
              <StateRow
                key={s.state}
                schedule={s}
                onUpdate={(patch) => handleUpdate(s.state, patch)}
              />
            ))
          )}
        </div>
      )}

      <p className="text-[9px] text-[hsl(var(--muted-foreground))]">
        Health score = sync success rate × recency factor, evaluated over the health window.
        Alerts fire when score drops below threshold and cooldown has expired.
      </p>
    </div>
  );
}