import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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

const STATUS_LABEL: Record<CheckStatus, string> = {
  ok: "OK",
  degraded: "Degraded",
  down: "Down",
};

const COMPONENT_LABELS: Record<string, string> = {
  database: "Database",
  "api-gateway": "Public API",
  "mcp-server": "MCP Server",
  "candidates": "Candidates",
  districts: "Districts",
  polling: "Polling",
  messaging: "Messaging",
  intel: "Intel Hub",
  international: "International",
  reports: "Reports Hub",
  sync: "Sync Status",
  "docs-registry": "Docs Registry",
};

function StatusPill({ status }: { status: CheckStatus }) {
  const cls =
    status === "ok"
      ? "bg-[hsl(120_60%_35%)] text-white"
      : status === "degraded"
      ? "bg-[hsl(45_90%_50%)] text-black"
      : "bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]";
  return (
    <span className={`px-1.5 py-[px] text-[10px] font-bold uppercase ${cls}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

interface Props {
  variant?: "status" | "health";
}

export function SystemStatusWindow({ variant = "status" }: Props) {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    const start = Date.now();
    const checks: HealthCheck[] = [];

    const SUPABASE_PROJECT = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
    const SUPABASE_URL = `https://${SUPABASE_PROJECT}.supabase.co`;
    const API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

    // ── Server checks (HTTP) ──────────────────────────────────────────────
    const serverChecks = [
      {
        component: "api-gateway",
        check: async () => {
          const t0 = Date.now();
          try {
            // Try unauthenticated public-api - it returns 401 or a valid JSON response
            const res = await fetch(`${SUPABASE_URL}/functions/v1/public-api/health`, {
              headers: { Accept: "application/json" },
            });
            if (res.status === 401 || res.status === 200) {
              return { ok: true, detail: `HTTP ${res.status}`, latency_ms: Date.now() - t0 };
            }
            return { ok: false, detail: `HTTP ${res.status}`, latency_ms: Date.now() - t0 };
          } catch (err: any) {
            return { ok: false, detail: err.message };
          }
        },
      },
      {
        component: "mcp-server",
        check: async () => {
          const t0 = Date.now();
          try {
            // MCP server health - returns JSON or error
            const res = await fetch(`${SUPABASE_URL}/functions/v1/mcp-server/rpc`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
              body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
            });
            if (res.ok || res.status === 401 || res.status === 400) {
              return { ok: true, detail: `HTTP ${res.status}`, latency_ms: Date.now() - t0 };
            }
            return { ok: false, detail: `HTTP ${res.status}`, latency_ms: Date.now() - t0 };
          } catch (err: any) {
            return { ok: false, detail: err.message };
          }
        },
      },
    ];

    // ── Database checks (Supabase client) ───────────────────────────────
    const dbChecks = [
      {
        component: "database",
        check: async () => {
          const { error } = await supabase.from("sync_run_log").select("id").limit(1);
          if (error) throw new Error(error.message);
          return { ok: true };
        },
      },
      {
        component: "candidates",
        check: async () => {
          const { count, error } = await supabase
            .from("candidates")
            .select("id", { count: "exact", head: true })
            .limit(1);
          if (error) throw new Error(error.message);
          return { ok: true, detail: count !== null ? `${count} records` : undefined };
        },
      },
      {
        component: "districts",
        check: async () => {
          const { count, error } = await supabase
            .from("district_profiles")
            .select("id", { count: "exact", head: true })
            .limit(1);
          if (error) throw new Error(error.message);
          return { ok: true, detail: count !== null ? `${count} records` : undefined };
        },
      },
      {
        component: "polling",
        check: async () => {
          const { count, error } = await supabase
            .from("polling_data")
            .select("id", { count: "exact", head: true })
            .limit(1);
          if (error) throw new Error(error.message);
          return { ok: true, detail: count !== null ? `${count} records` : undefined };
        },
      },
      {
        component: "messaging",
        check: async () => {
          const { count, error } = await supabase
            .from("messaging_guidance")
            .select("id", { count: "exact", head: true })
            .limit(1);
          if (error) throw new Error(error.message);
          return { ok: true, detail: count !== null ? `${count} records` : undefined };
        },
      },
      {
        component: "intel",
        check: async () => {
          const { count, error } = await supabase
            .from("intel_briefings")
            .select("id", { count: "exact", head: true })
            .limit(1);
          if (error) throw new Error(error.message);
          return { ok: true, detail: count !== null ? `${count} records` : undefined };
        },
      },
      {
        component: "international",
        check: async () => {
          const { count, error } = await supabase
            .from("international_profiles")
            .select("id", { count: "exact", head: true })
            .limit(1);
          if (error) throw new Error(error.message);
          return { ok: true, detail: count !== null ? `${count} records` : undefined };
        },
      },
      {
        component: "reports",
        check: async () => {
          const { count, error } = await supabase
            .from("narrative_reports")
            .select("id", { count: "exact", head: true })
            .limit(1);
          if (error) throw new Error(error.message);
          return { ok: true, detail: count !== null ? `${count} records` : undefined };
        },
      },
      {
        component: "sync",
        check: async () => {
          const { data, error } = await supabase
            .from("sync_run_log")
            .select("id,source,status,started_at")
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (error) throw new Error(error.message);
          if (!data) return { ok: true, detail: "No sync runs recorded yet" };
          const detail = `${data.source}: ${data.status} at ${new Date(data.started_at).toLocaleString()}`;
          return { ok: data.status === "completed", detail };
        },
      },
      {
        component: "docs-registry",
        check: async () => {
          const { count, error } = await supabase
            .from("wiki_pages")
            .select("id", { count: "exact", head: true })
            .limit(1);
          if (error) throw new Error(error.message);
          return { ok: true, detail: count !== null ? `${count} pages` : undefined };
        },
      },
    ];

    // Run server checks and db checks in parallel
    const allChecks = [...serverChecks, ...dbChecks];
    await Promise.all(
      allChecks.map(async (check) => {
        const t0 = Date.now();
        try {
          const result = await check.check();
          checks.push({
            component: check.component,
            status: result.ok ? "ok" : "down",
            latency_ms: result.latency_ms ?? Date.now() - t0,
            detail: result.detail,
          });
        } catch (err: any) {
          checks.push({
            component: check.component,
            status: "down",
            latency_ms: Date.now() - t0,
            detail: err?.message || String(err),
          });
        }
      })
    );

    const overall: CheckStatus =
      checks.every((c) => c.status === "ok")
        ? "ok"
        : checks.some((c) => c.status === "down")
        ? "down"
        : "degraded";

    setData({
      status: overall,
      generated_at: new Date().toISOString(),
      duration_ms: Date.now() - start,
      checks,
    });
    setError(null);
    setLoading(false);
    setLastFetch(new Date());
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
              ? `Probed in ${data.duration_ms}ms · ${new Date(data.generated_at).toLocaleTimeString()}`
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
        {variant === "health" ? (
          <ul className="divide-y divide-[hsl(var(--win98-shadow))]">
            {(data?.checks ?? []).map((c) => (
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
              {(data?.checks ?? []).map((c) => (
                <tr key={c.component} className="border-b border-[hsl(var(--win98-shadow))] align-top">
                  <td className="p-1">
                    <div className="font-bold">{COMPONENT_LABELS[c.component] ?? c.component}</div>
                    <div className="font-mono text-[9px] text-[hsl(var(--muted-foreground))]">{c.component}</div>
                    {c.detail && (
                      <div className="text-[9px] text-[hsl(var(--muted-foreground))] mt-[2px]">{c.detail}</div>
                    )}
                  </td>
                  <td className="p-1"><StatusPill status={c.status} /></td>
                  <td className="p-1 text-right font-mono">{c.latency_ms}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Statusbar */}
      <div className="win98-sunken px-2 py-[2px] text-[9px] text-[hsl(var(--muted-foreground))] flex justify-between">
        <span>{lastFetch ? "Refreshed " + lastFetch.toLocaleTimeString() : "-"}</span>
        <span>Auto-refresh 30s</span>
      </div>
    </div>
  );
}