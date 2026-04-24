import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { STATE_ABBR_TO_NAME } from "@/lib/stateAbbreviations";
import { ArrowLeft, Loader2, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const JURISDICTIONS = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

interface Row {
  abbr: string;
  name: string;
  briefingCount: number;
  uniqueSources: number;
  latest: string | null;
  daysSince: number | null;
}

const STALE_DAYS = 7;

const daysSince = (raw: string | null): number | null => {
  if (!raw) return null;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
};

const formatRelative = (days: number | null): string => {
  if (days === null) return "—";
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return `${Math.floor(days / 365)} yr ago`;
};

type StatusFilter = "all" | "zero" | "stale" | "ok";

export default function LocalFeedsValidation() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const refreshState = async (abbr: string) => {
    setRefreshing((prev) => new Set(prev).add(abbr));
    try {
      const { data, error: err } = await supabase.functions.invoke("intel-briefing", {
        body: { scopes: ["local"], state: abbr },
      });
      if (err) throw err;
      const newCount = data?.inserted_local ?? data?.inserted ?? 0;
      toast.success(`${abbr}: ${newCount} new local ${newCount === 1 ? "briefing" : "briefings"}`);
      await load();
    } catch (e) {
      toast.error(`Failed to refresh ${abbr}: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setRefreshing((prev) => {
        const next = new Set(prev);
        next.delete(abbr);
        return next;
      });
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);

    // Pull all local briefings (capped) and aggregate client-side
    const { data, error: err } = await supabase
      .from("intel_briefings")
      .select("region, source_name, published_at")
      .eq("scope", "local")
      .limit(10000);

    if (err) {
      setError(err.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const map = new Map<string, { count: number; sources: Set<string>; latest: string | null }>();
    for (const abbr of JURISDICTIONS) {
      map.set(abbr, { count: 0, sources: new Set(), latest: null });
    }

    for (const b of data ?? []) {
      const key = (b.region ?? "").toUpperCase();
      if (!map.has(key)) continue;
      const entry = map.get(key)!;
      entry.count += 1;
      if (b.source_name) entry.sources.add(b.source_name);
      if (b.published_at) {
        if (!entry.latest || b.published_at > entry.latest) entry.latest = b.published_at;
      }
    }

    const out: Row[] = JURISDICTIONS.map((abbr) => {
      const e = map.get(abbr)!;
      return {
        abbr,
        name: STATE_ABBR_TO_NAME[abbr] ?? abbr,
        briefingCount: e.count,
        uniqueSources: e.sources.size,
        latest: e.latest,
        daysSince: daysSince(e.latest),
      };
    });

    setRows(out);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const zero = rows.filter((r) => r.briefingCount === 0);
    const stale = rows.filter(
      (r) => r.briefingCount > 0 && r.daysSince !== null && r.daysSince > STALE_DAYS,
    );
    const covered = rows.length - zero.length;
    const totalBriefings = rows.reduce((sum, r) => sum + r.briefingCount, 0);
    const totalSources = rows.reduce((sum, r) => sum + r.uniqueSources, 0);
    return { zero, stale, covered, totalBriefings, totalSources };
  }, [rows]);

  const formatDate = (raw: string | null) => {
    if (!raw) return "—";
    try {
      return new Date(raw).toLocaleDateString(undefined, {
        month: "short", day: "numeric", year: "numeric",
      });
    } catch {
      return raw;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Local Feeds Validation</h1>
              <p className="text-sm text-muted-foreground">
                Per-state coverage of imported local news briefings (scope = local).
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            Refresh
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <SummaryCard label="Jurisdictions" value={`${stats.covered} / ${rows.length}`} hint="With ≥1 briefing" />
          <SummaryCard label="Zero-feed states" value={String(stats.zero.length)} hint="Need attention" tone={stats.zero.length > 0 ? "warn" : "ok"} />
          <SummaryCard label={`Stale (>${STALE_DAYS}d)`} value={String(stats.stale.length)} hint="No recent articles" tone={stats.stale.length > 0 ? "warn" : "ok"} />
          <SummaryCard label="Total briefings" value={stats.totalBriefings.toLocaleString()} hint="Across all states" />
          <SummaryCard label="Unique sources" value={stats.totalSources.toLocaleString()} hint="Distinct outlets" />
        </div>

        {/* Zero-feed callout */}
        {!loading && stats.zero.length > 0 && (
          <div className="mb-4 p-4 rounded-lg border border-destructive/40 bg-destructive/10">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-destructive">
                  {stats.zero.length} jurisdiction{stats.zero.length === 1 ? "" : "s"} with zero local feeds
                </p>
                <p className="text-muted-foreground mt-1">
                  {stats.zero.map((r) => r.abbr).join(", ")}
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">State</th>
                <th className="px-3 py-2 text-right font-semibold">Briefings</th>
                <th className="px-3 py-2 text-right font-semibold">Unique sources</th>
                <th className="px-3 py-2 text-right font-semibold">Latest</th>
                <th className="px-3 py-2 text-right font-semibold">Last updated</th>
                <th className="px-3 py-2 text-center font-semibold">Status</th>
                <th className="px-3 py-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    Loading…
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const zero = r.briefingCount === 0;
                  const stale = !zero && r.daysSince !== null && r.daysSince > STALE_DAYS;
                  const isRefreshing = refreshing.has(r.abbr);
                  return (
                    <tr
                      key={r.abbr}
                      className={`border-t border-border ${zero ? "bg-destructive/5" : stale ? "bg-destructive/[0.03]" : ""}`}
                    >
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs text-muted-foreground mr-2">{r.abbr}</span>
                        <Link
                          to={`/admin/local-feeds/${r.abbr}`}
                          className={`hover:underline ${zero ? "text-destructive font-semibold" : "text-primary"}`}
                        >
                          {r.name}
                        </Link>
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums ${zero ? "text-destructive font-bold" : ""}`}>
                        {r.briefingCount}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {r.uniqueSources}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {formatDate(r.latest)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${
                          stale ? "text-destructive/80 font-semibold" : "text-muted-foreground"
                        }`}
                        title={r.latest ?? undefined}
                      >
                        {formatRelative(r.daysSince)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {zero ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-destructive">
                            <AlertTriangle className="h-3 w-3" />
                            Zero feeds
                          </span>
                        ) : stale ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-destructive/80">
                            <AlertTriangle className="h-3 w-3" />
                            Stale
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-primary">
                            <CheckCircle2 className="h-3 w-3" />
                            OK
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px]"
                          disabled={isRefreshing}
                          onClick={() => refreshState(r.abbr)}
                        >
                          {isRefreshing ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3 mr-1" />
                          )}
                          Refresh
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label, value, hint, tone,
}: { label: string; value: string; hint?: string; tone?: "ok" | "warn" }) {
  const toneClass =
    tone === "warn"
      ? "border-destructive/40 bg-destructive/5"
      : tone === "ok"
      ? "border-primary/40 bg-primary/5"
      : "border-border bg-card";
  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}
