import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";

type CheckStatus = "ok" | "degraded" | "down";
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
const HEALTH_URL = `${SUPABASE_URL}/functions/v1/public-api/health`;

const STATUS_LABEL: Record<CheckStatus, string> = {
  ok: "Operational",
  degraded: "Degraded",
  down: "Down",
};

const STATUS_COLOR: Record<CheckStatus, string> = {
  ok: "bg-[hsl(var(--success,142_70%_45%))] text-white",
  degraded: "bg-[hsl(45_90%_55%))] text-black",
  down: "bg-[hsl(var(--destructive))] text-destructive-foreground",
};

const COMPONENT_LABELS: Record<string, string> = {
  "database": "Database (Lovable Cloud)",
  "docs-registry": "Documentation Registry",
  "docs-wiki": "Wiki Pages",
  "docs-export": "Versioned Docs Export",
  "ai-gateway": "Lovable AI Gateway",
  "sync-pipeline": "Scheduled Sync Pipeline",
};

export default function StatusPage() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(HEALTH_URL, { headers: { Accept: "application/json" } });
      const json = await res.json();
      setData(json as HealthResponse);
      setError(null);
    } catch (e: any) {
      setError(String(e?.message || e));
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
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">System Status</h1>
            <p className="text-sm text-muted-foreground">
              Live health of OppoDB components. Refreshes every 30s.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchHealth} className="win98-button text-xs px-3 py-1" disabled={loading}>
              {loading ? "Checking…" : "Refresh"}
            </button>
            <Link to="/" className="win98-button text-xs px-3 py-1">Home</Link>
          </div>
        </header>

        {data && (
          <div className="border-2 border-foreground/20 bg-card p-4">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 text-sm font-bold ${STATUS_COLOR[data.status]}`}>
                {STATUS_LABEL[data.status].toUpperCase()}
              </span>
              <span className="text-sm text-muted-foreground">
                Probed in {data.duration_ms}ms · {new Date(data.generated_at).toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="border-2 border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            Failed to load health: {error}
          </div>
        )}

        <div className="space-y-2">
          {data?.checks.map((c) => (
            <div key={c.component} className="flex items-center justify-between border border-foreground/15 bg-card p-3">
              <div>
                <div className="font-semibold text-foreground">
                  {COMPONENT_LABELS[c.component] ?? c.component}
                </div>
                <div className="text-xs text-muted-foreground font-mono">{c.component}</div>
                {c.detail && (
                  <div className="text-xs text-destructive mt-1">{c.detail}</div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{c.latency_ms}ms</span>
                <span className={`px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[c.status]}`}>
                  {STATUS_LABEL[c.status]}
                </span>
              </div>
            </div>
          ))}
        </div>

        <footer className="border-t border-foreground/15 pt-3 text-xs text-muted-foreground space-y-1">
          {lastFetch && <div>Last refresh: {lastFetch.toLocaleTimeString()}</div>}
          <div>
            REST: <code className="bg-muted px-1">GET {HEALTH_URL}</code>
          </div>
          <div>
            MCP: call tool <code className="bg-muted px-1">get_system_health</code>
          </div>
        </footer>
      </div>
    </div>
  );
}
