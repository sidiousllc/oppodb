import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { STATE_ABBR_TO_NAME } from "@/lib/stateAbbreviations";
import {
  ArrowLeft, ExternalLink, Loader2, Rss, RefreshCw,
  CheckCircle2, AlertTriangle, Clock, Search, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface SourceRow {
  name: string;
  rssUrl: string;
  state: string | null;
}

interface HealthRow {
  name: string;
  rssUrl: string;
  state: string | null;
  ok: boolean;
  status: number;
  ms: number;
  items: number;
  error: string | null;
}

const formatRelative = (iso: string | null): string => {
  if (!iso) return "Never";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
};

export default function LocalFeedsStateSources() {
  const { abbr: rawAbbr } = useParams<{ abbr: string }>();
  const abbr = (rawAbbr || "").toUpperCase();
  const stateName = STATE_ABBR_TO_NAME[abbr] ?? abbr;

  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [health, setHealth] = useState<Record<string, HealthRow>>({});
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase.functions.invoke("intel-briefing", {
        body: { action: "list_local_sources", state: abbr },
      });
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setSources([]);
      } else {
        setSources((data?.sources as SourceRow[]) ?? []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [abbr]);

  const runHealthCheck = async () => {
    setProbing(true);
    try {
      const { data, error: err } = await supabase.functions.invoke("intel-briefing", {
        body: { action: "probe_local_sources", state: abbr },
      });
      if (err) throw err;
      const map: Record<string, HealthRow> = {};
      for (const r of (data?.sources as HealthRow[]) ?? []) {
        map[r.rssUrl] = r;
      }
      setHealth(map);
      setCheckedAt(data?.checkedAt ?? new Date().toISOString());
      toast.success(
        `${abbr}: ${data?.healthy ?? 0} healthy, ${data?.failed ?? 0} failed`,
      );
    } catch (e) {
      toast.error(`Health check failed: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setProbing(false);
    }
  };

  const hostOf = (url: string) => {
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch { return url; }
  };

  const healthyCount = Object.values(health).filter((h) => h.ok).length;
  const failedCount = Object.values(health).filter((h) => !h.ok).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/local-feeds">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                {stateName} <span className="text-muted-foreground font-mono text-base">({abbr})</span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Local RSS sources configured for this jurisdiction.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={runHealthCheck}
            disabled={probing || loading || sources.length === 0}
          >
            {probing ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            {Object.keys(health).length === 0 ? "Check feed health" : "Re-check health"}
          </Button>
        </div>

        {/* Health summary banner */}
        {Object.keys(health).length > 0 && (
          <div className="mb-4 p-3 rounded-lg border border-border bg-muted/30 flex items-center gap-4 flex-wrap text-sm">
            <span className="inline-flex items-center gap-1 text-primary">
              <CheckCircle2 className="h-4 w-4" />
              <strong>{healthyCount}</strong> healthy
            </span>
            <span className="inline-flex items-center gap-1 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <strong>{failedCount}</strong> failed
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground text-xs ml-auto">
              <Clock className="h-3 w-3" />
              Last checked {formatRelative(checkedAt)}
            </span>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading sources…
          </div>
        )}

        {error && !loading && (
          <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {!loading && !error && sources.length === 0 && (
          <div className="p-6 rounded-lg border border-border bg-muted/30 text-sm text-muted-foreground text-center">
            No local sources are configured for {stateName}.
          </div>
        )}

        {!loading && sources.length > 0 && (
          <>
            <p className="text-xs text-muted-foreground mb-3">
              {sources.length} source{sources.length === 1 ? "" : "s"} configured
              {Object.keys(health).length === 0 && " — click \"Check feed health\" to probe each feed"}
            </p>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Source</th>
                    <th className="px-3 py-2 text-left font-semibold">Domain</th>
                    <th className="px-3 py-2 text-center font-semibold">Status</th>
                    <th className="px-3 py-2 text-right font-semibold">HTTP</th>
                    <th className="px-3 py-2 text-right font-semibold">Items</th>
                    <th className="px-3 py-2 text-right font-semibold">Latency</th>
                    <th className="px-3 py-2 text-right font-semibold">Last checked</th>
                    <th className="px-3 py-2 text-right font-semibold">Feed</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s) => {
                    const h = health[s.rssUrl];
                    const checked = !!h;
                    const ok = h?.ok;
                    return (
                      <tr
                        key={s.rssUrl}
                        className={`border-t border-border ${checked && !ok ? "bg-destructive/5" : ""}`}
                      >
                        <td className="px-3 py-2 font-medium">{s.name}</td>
                        <td className="px-3 py-2 text-muted-foreground font-mono text-xs">
                          {hostOf(s.rssUrl)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {!checked ? (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          ) : ok ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-primary">
                              <CheckCircle2 className="h-3 w-3" />
                              OK
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] text-destructive"
                              title={h.error ?? undefined}
                            >
                              <AlertTriangle className="h-3 w-3" />
                              {h.error && h.error.length > 24 ? `${h.error.slice(0, 24)}…` : h.error || "Failed"}
                            </span>
                          )}
                        </td>
                        <td
                          className={`px-3 py-2 text-right tabular-nums text-xs ${
                            checked && !ok ? "text-destructive" : "text-muted-foreground"
                          }`}
                        >
                          {checked ? (h.status || "—") : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                          {checked ? h.items : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                          {checked ? `${h.ms}ms` : "—"}
                        </td>
                        <td
                          className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground"
                          title={checkedAt ?? undefined}
                        >
                          {formatRelative(checkedAt)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <a
                            href={s.rssUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Rss className="h-3 w-3" />
                            RSS
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
