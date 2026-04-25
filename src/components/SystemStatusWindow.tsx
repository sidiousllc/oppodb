import { useEffect, useState, useCallback } from "react";

type CheckStatus = "ok" | "degraded" | "down" | "unknown";
interface HealthCheck {
  component: string;
  status: CheckStatus;
  latency_ms: number;
  detail?: string;
}
interface HealthResponse {
  status: CheckStatus;
  generated_at: string;
  duration_ms: number;
  checks: HealthCheck[];
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const HEALTH_URL = `${SUPABASE_URL}/functions/v1/system-status`;

const STATUS_LABEL: Record<CheckStatus, string> = {
  ok: "OK",
  degraded: "Degraded",
  down: "Down",
  unknown: "Unknown",
};

const COMPONENT_LABELS: Record<string, string> = {
  database: "Database",
  auth: "Auth",
  candidates: "Candidates",
  districts: "Districts",
  polling: "Polling",
  congress: "Congress",
  "election-results": "Election Results",
  intel: "Intel Hub",
  messaging: "Messaging Hub",
  "maga-files": "MAGA Files",
  "narrative-reports": "Narrative Reports",
  "sync-pipeline": "Sync Pipeline",
  "docs-wiki": "Wiki Pages",
  "public-api": "Public API",
};

function StatusPill({ status }: { status: CheckStatus }) {
  const cls =
    status === "ok"
      ? "bg-[hsl(120_60%_35%)] text-white"
      : status === "degraded"
      ? "bg-[hsl(45_90%_50%)] text-black"
      : status === "unknown"
      ? "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
      : "bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]";
  return (
    <span className={`px-1.5 py-[1px] text-[10px] font-bold uppercase ${cls}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

interface Props {
  /** "status" shows full per-component table; "health" shows a compact summary. */
  variant?: "status" | "health";
}

export function SystemStatusWindow({ variant = "status" }: Props) {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(HEALTH_URL, { headers: { Accept: "application/json" } });

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const errJson = await res.json();
          msg = errJson.message || errJson.error || msg;
        } catch {}
        // Build a graceful-degradation response when the function isn't deployed yet
        setData({
          status: "unknown",
          generated_at: new Date().toISOString(),
          duration_ms: 0,
          checks: [],
        });
        setError(`Status service unavailable (${msg}). Deploy /system-status to enable monitoring.`);
        return;
      }

      const json = await res.json();

      // Gracefully handle unexpected response shapes
      if (!json || typeof json.status !== "string") {
        setData({
          status: "unknown",
          generated_at: new Date().toISOString(),
          duration_ms: 0,
          checks: [],
        });
        setError("Unexpected response from status service.");
        return;
      }

      setData({
        ...json,
        status: (["ok", "degraded", "down"].includes(json.status) ? json.status : "unknown") as CheckStatus,
        checks: Array.isArray(json.checks) ? json.checks : [],
      });
      setError(null);
    } catch (e: any) {
      setData({
        status: "unknown",
        generated_at: new Date().toISOString(),
        duration_ms: 0,
        checks: [],
      });
      setError(String(e?.message || e) || "Network error reaching status service.");
    } finally {
      setLoading(false);
      setLastFetch(new Date());
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const id = setInterval(fetchHealth, 30_000);
    return () => clearInterval(id);
  }, [fetchHealth]);

  return (
    <div className="p-2 text-[11px] space-y-2 bg-[hsl(var(--win98-face))] h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 win98-sunken px-2 py-1">
        <div className="flex items-center gap-2 min-w-0">
          {data ? (
            <StatusPill status={data.status} />
          ) : (
            <span className="text-[hsl(var(--muted-foreground))]">…</span>
          )}
          <span className="truncate text-[10px] text-[hsl(var(--muted-foreground))]">
            {data
              ? data.status === "unknown"
                ? "Status unavailable"
                : `Probed in ${data.duration_ms}ms · ${new Date(data.generated_at).toLocaleTimeString()}`
              : loading
              ? "Checking…"
              : "No data"}
          </span>
        </div>
        <button onClick={fetchHealth} disabled={loading} className="win98-button text-[10px] px-2 py-[1px]">
          {loading ? "…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="win98-sunken bg-[hsl(var(--destructive)/0.12)] text-[hsl(var(--destructive))] px-2 py-1 text-[10px]">
          {error}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto win98-sunken bg-[hsl(var(--win98-light))]">
        {data?.checks && data.checks.length > 0 ? (
          variant === "health" ? (
            <ul className="divide-y divide-[hsl(var(--win98-shadow))]">
              {data.checks.map((c) => (
                <li key={c.component} className="flex items-center justify-between px-2 py-1">
                  <span className="font-bold">{COMPONENT_LABELS[c.component] ?? c.component}</span>
                  <StatusPill status={c.status} />
                </li>
              ))}
            </ul>
          ) : (
            <table className="w-full border-collapse text-[10px]">
              <thead className="bg-[hsl(var(--win98-face))] sticky top-0">
                <tr>
                  <th className="text-left p-1 border-b border-[hsl(var(--win98-shadow))]">Component</th>
                  <th className="text-left p-1 border-b border-[hsl(var(--win98-shadow))] w-[80px]">Status</th>
                  <th className="text-right p-1 border-b border-[hsl(var(--win98-shadow))] w-[60px]">Latency</th>
                </tr>
              </thead>
              <tbody>
                {data.checks.map((c) => (
                  <tr key={c.component} className="border-b border-[hsl(var(--win98-shadow))] align-top">
                    <td className="p-1">
                      <div className="font-bold">{COMPONENT_LABELS[c.component] ?? c.component}</div>
                      <div className="font-mono text-[9px] text-[hsl(var(--muted-foreground))]">{c.component}</div>
                      {c.detail && (
                        <div className="text-[9px] text-[hsl(var(--destructive))] mt-[2px]">{c.detail}</div>
                      )}
                    </td>
                    <td className="p-1"><StatusPill status={c.status} /></td>
                    <td className="p-1 text-right font-mono">{c.latency_ms}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          <div className="flex items-center justify-center h-full text-[11px] text-[hsl(var(--muted-foreground))] p-4 text-center">
            {loading ? "Checking system status…" : "No status data available."}
          </div>
        )}
      </div>

      {/* Statusbar */}
      <div className="win98-sunken px-2 py-[2px] text-[9px] text-[hsl(var(--muted-foreground))] flex justify-between">
        <span>{lastFetch ? `Refreshed ${lastFetch.toLocaleTimeString()}` : "—"}</span>
        <span>Auto-refresh 30s</span>
      </div>
    </div>
  );
}
