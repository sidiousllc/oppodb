import { useState, useEffect, useMemo } from "react";
import { fetchPollingData, getSourceInfo, POLLING_SOURCES, POLL_TYPES, type PollEntry } from "@/data/pollingData";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, ExternalLink, TrendingDown, TrendingUp, Minus, Filter, RefreshCw } from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function marginColor(margin: number | null): string {
  if (margin === null) return "hsl(var(--muted-foreground))";
  if (margin > 5) return "hsl(150, 60%, 40%)";
  if (margin > 0) return "hsl(150, 40%, 50%)";
  if (margin > -5) return "hsl(0, 50%, 55%)";
  return "hsl(0, 70%, 45%)";
}

function MarginBadge({ margin }: { margin: number | null }) {
  if (margin === null) return null;
  const Icon = margin > 0 ? TrendingUp : margin < 0 ? TrendingDown : Minus;
  const label = margin > 0 ? `+${margin.toFixed(1)}` : margin.toFixed(1);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold"
      style={{
        backgroundColor: `${marginColor(margin)}20`,
        color: marginColor(margin),
      }}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function ApprovalBar({ approve, disapprove }: { approve: number | null; disapprove: number | null }) {
  if (approve === null && disapprove === null) return null;
  const a = approve ?? 0;
  const d = disapprove ?? 0;
  const total = a + d || 100;
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="transition-all duration-300"
        style={{
          width: `${(a / total) * 100}%`,
          backgroundColor: "hsl(150, 55%, 45%)",
        }}
      />
      <div
        className="transition-all duration-300"
        style={{
          width: `${(d / total) * 100}%`,
          backgroundColor: "hsl(0, 65%, 50%)",
        }}
      />
    </div>
  );
}

// ─── Sparkline-like trend chart (pure SVG) ──────────────────────────────────

function TrendLine({ data, valueKey }: { data: PollEntry[]; valueKey: "approve_pct" | "favor_pct" }) {
  if (data.length < 2) return null;
  const sorted = [...data].sort((a, b) => a.date_conducted.localeCompare(b.date_conducted));
  const values = sorted.map((d) => (d[valueKey] as number) ?? 0);
  const min = Math.min(...values) - 2;
  const max = Math.max(...values) + 2;
  const range = max - min || 1;
  const w = 200;
  const h = 40;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });

  const lastVal = values[values.length - 1];
  const firstVal = values[0];
  const trending = lastVal > firstVal ? "hsl(150, 55%, 45%)" : "hsl(0, 65%, 50%)";

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10" preserveAspectRatio="none">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={trending}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {values.map((v, i) => {
        const x = (i / (values.length - 1)) * w;
        const y = h - ((v - min) / range) * h;
        return <circle key={i} cx={x} cy={y} r={2.5} fill={trending} />;
      })}
    </svg>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function PollingSection() {
  const [polls, setPolls] = useState<PollEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    loadPolls();
  }, []);

  async function loadPolls() {
    setLoading(true);
    const data = await fetchPollingData();
    setPolls(data);
    setLoading(false);
  }

  async function seedData() {
    setSeeding(true);
    try {
      await supabase.functions.invoke("seed-polling");
      await loadPolls();
    } catch (e) {
      console.error("Seed error:", e);
    }
    setSeeding(false);
  }

  const filtered = useMemo(() => {
    return polls.filter((p) => {
      if (sourceFilter !== "all" && p.source !== sourceFilter) return false;
      if (typeFilter !== "all" && p.poll_type !== typeFilter) return false;
      return true;
    });
  }, [polls, sourceFilter, typeFilter]);

  // Group by poll type for summary cards
  const approvalPolls = useMemo(
    () => filtered.filter((p) => p.poll_type === "approval" && p.candidate_or_topic === "Trump Approval"),
    [filtered]
  );
  const genericBallotPolls = useMemo(
    () => filtered.filter((p) => p.poll_type === "generic-ballot"),
    [filtered]
  );
  const issuePolls = useMemo(
    () => filtered.filter((p) => p.poll_type === "issue"),
    [filtered]
  );

  // Latest approval by source for comparison
  const latestBySource = useMemo(() => {
    const map = new Map<string, PollEntry>();
    approvalPolls.forEach((p) => {
      const existing = map.get(p.source);
      if (!existing || p.date_conducted > existing.date_conducted) {
        map.set(p.source, p);
      }
    });
    return Array.from(map.values()).sort((a, b) => (a.margin ?? 0) - (b.margin ?? 0));
  }, [approvalPolls]);

  // Average approval across all sources (latest only)
  const avgApproval = useMemo(() => {
    if (latestBySource.length === 0) return null;
    const avg = latestBySource.reduce((sum, p) => sum + (p.approve_pct ?? 0), 0) / latestBySource.length;
    const avgDis = latestBySource.reduce((sum, p) => sum + (p.disapprove_pct ?? 0), 0) / latestBySource.length;
    return { approve: Math.round(avg * 10) / 10, disapprove: Math.round(avgDis * 10) / 10, margin: Math.round((avg - avgDis) * 10) / 10 };
  }, [latestBySource]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-muted-foreground">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          <span className="text-sm">Loading polling data…</span>
        </div>
      </div>
    );
  }

  if (polls.length === 0) {
    return (
      <div className="text-center py-16">
        <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground mb-4">No polling data available yet.</p>
        <button
          onClick={seedData}
          disabled={seeding}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {seeding ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Seeding data…
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5" />
              Load polling data from all sources
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Source:</span>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setSourceFilter("all")}
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold border transition-colors ${
                sourceFilter === "all"
                  ? "bg-foreground text-background border-foreground"
                  : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
              }`}
            >
              All
            </button>
            {POLLING_SOURCES.map((s) => {
              const isActive = sourceFilter === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSourceFilter(isActive ? "all" : s.id)}
                  className="rounded-full px-2.5 py-1 text-[10px] font-bold border transition-all"
                  style={{
                    backgroundColor: isActive ? `hsl(${s.color})` : `hsl(${s.color} / 0.08)`,
                    color: isActive ? "white" : `hsl(${s.color})`,
                    borderColor: isActive ? `hsl(${s.color})` : `hsl(${s.color} / 0.25)`,
                  }}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Type:</span>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setTypeFilter("all")}
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold border transition-colors ${
                typeFilter === "all"
                  ? "bg-foreground text-background border-foreground"
                  : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
              }`}
            >
              All
            </button>
            {POLL_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTypeFilter(typeFilter === t.id ? "all" : t.id)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold border transition-colors ${
                  typeFilter === t.id
                    ? "bg-foreground text-background border-foreground"
                    : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Summary Cards ─────────────────────────────────────────────────── */}
      {avgApproval && (
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Cross-source average */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Cross-Source Average
            </p>
            <div className="flex items-baseline gap-3 mb-2">
              <span className="text-3xl font-display font-bold text-foreground">{avgApproval.approve}%</span>
              <span className="text-sm text-muted-foreground">approve</span>
            </div>
            <ApprovalBar approve={avgApproval.approve} disapprove={avgApproval.disapprove} />
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span style={{ color: "hsl(150, 55%, 45%)" }}>Approve {avgApproval.approve}%</span>
              <span style={{ color: "hsl(0, 65%, 50%)" }}>Disapprove {avgApproval.disapprove}%</span>
            </div>
            <div className="mt-2">
              <MarginBadge margin={avgApproval.margin} />
            </div>
          </div>

          {/* Generic ballot summary */}
          {genericBallotPolls.length > 0 && (() => {
            const latest = genericBallotPolls[0];
            return (
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Generic Ballot
                </p>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-2xl font-display font-bold" style={{ color: "hsl(210, 80%, 50%)" }}>
                    D {latest.favor_pct ?? "—"}%
                  </span>
                  <span className="text-muted-foreground">vs</span>
                  <span className="text-2xl font-display font-bold" style={{ color: "hsl(0, 75%, 50%)" }}>
                    R {latest.oppose_pct ?? "—"}%
                  </span>
                </div>
                <MarginBadge margin={latest.margin} />
                <p className="text-[10px] text-muted-foreground mt-2">
                  {getSourceInfo(latest.source).name} · {formatDate(latest.date_conducted)}
                </p>
              </div>
            );
          })()}

          {/* Approval trend sparkline */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Approval Trend (All Sources)
            </p>
            <TrendLine data={approvalPolls} valueKey="approve_pct" />
            <p className="text-[10px] text-muted-foreground mt-1">
              {approvalPolls.length} polls from {new Set(approvalPolls.map((p) => p.source)).size} sources
            </p>
          </div>
        </div>
      )}

      {/* ─── Source Comparison Table ──────────────────────────────────────── */}
      {latestBySource.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-display text-sm font-semibold text-foreground">
              Latest Presidential Approval by Source
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comparing the most recent poll from each source
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Source</th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(150, 55%, 45%)" }}>Approve</th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(0, 65%, 50%)" }}>Disapprove</th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Margin</th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sample</th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="py-2.5 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {latestBySource.map((poll) => {
                  const src = getSourceInfo(poll.source);
                  return (
                    <tr key={poll.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: `hsl(${src.color})` }}
                          />
                          <span className="font-medium text-foreground">{src.name}</span>
                          {poll.partisan_lean && (
                            <span className="text-[9px] rounded-sm px-1.5 py-0.5 bg-muted text-muted-foreground font-medium">
                              {poll.partisan_lean}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="font-bold text-foreground">{poll.approve_pct ?? "—"}%</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="font-bold text-foreground">{poll.disapprove_pct ?? "—"}%</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <MarginBadge margin={poll.margin} />
                      </td>
                      <td className="py-3 px-3 text-center text-muted-foreground text-xs">
                        {poll.sample_size ? `n=${poll.sample_size.toLocaleString()}` : "—"}
                        {poll.sample_type && poll.sample_type !== "Average" && (
                          <span className="ml-1 text-muted-foreground/60">({poll.sample_type})</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center text-xs text-muted-foreground">
                        {formatDate(poll.date_conducted)}
                        {poll.end_date && poll.end_date !== poll.date_conducted && (
                          <span> – {formatDate(poll.end_date)}</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {poll.source_url && (
                          <a
                            href={poll.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Issue Polling ────────────────────────────────────────────────── */}
      {issuePolls.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-display text-sm font-semibold text-foreground">
              Issue-Specific Polling
            </h3>
          </div>
          <div className="grid gap-0 divide-y divide-border">
            {issuePolls.map((poll) => {
              const src = getSourceInfo(poll.source);
              return (
                <div key={poll.id} className="p-4 flex items-center gap-4 hover:bg-muted/20 transition-colors">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: `hsl(${src.color})` }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm">{poll.candidate_or_topic}</p>
                    <p className="text-xs text-muted-foreground">{src.name} · {formatDate(poll.date_conducted)}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="w-32">
                      <ApprovalBar approve={poll.approve_pct} disapprove={poll.disapprove_pct} />
                    </div>
                    <div className="text-right min-w-[80px]">
                      <span className="text-xs font-bold" style={{ color: "hsl(150, 55%, 45%)" }}>
                        {poll.approve_pct ?? poll.favor_pct ?? "—"}%
                      </span>
                      <span className="text-muted-foreground mx-1">/</span>
                      <span className="text-xs font-bold" style={{ color: "hsl(0, 65%, 50%)" }}>
                        {poll.disapprove_pct ?? poll.oppose_pct ?? "—"}%
                      </span>
                    </div>
                    <MarginBadge margin={poll.margin} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── All Polls Table ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-display text-sm font-semibold text-foreground">
              All Polls ({filtered.length})
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Complete polling data from all sources
            </p>
          </div>
          <button
            onClick={seedData}
            disabled={seeding}
            className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${seeding ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-2 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Source</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Topic</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Result</th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Margin</th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((poll) => {
                const src = getSourceInfo(poll.source);
                const primaryPct = poll.approve_pct ?? poll.favor_pct;
                const secondaryPct = poll.disapprove_pct ?? poll.oppose_pct;
                return (
                  <tr key={poll.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: `hsl(${src.color})` }}
                        />
                        <span className="text-xs font-medium text-foreground">{src.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-foreground">{poll.candidate_or_topic}</td>
                    <td className="py-2.5 px-3">
                      <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {POLL_TYPES.find((t) => t.id === poll.poll_type)?.label ?? poll.poll_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-xs">
                      <span className="font-bold" style={{ color: "hsl(150, 55%, 45%)" }}>
                        {primaryPct ?? "—"}%
                      </span>
                      <span className="text-muted-foreground mx-1">/</span>
                      <span className="font-bold" style={{ color: "hsl(0, 65%, 50%)" }}>
                        {secondaryPct ?? "—"}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <MarginBadge margin={poll.margin} />
                    </td>
                    <td className="py-2.5 px-3 text-center text-xs text-muted-foreground">
                      {formatDate(poll.date_conducted)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Source Attribution ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h3 className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Data Sources
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {POLLING_SOURCES.map((s) => (
            <a
              key={s.id}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-border p-2.5 hover:bg-muted/50 transition-colors group"
            >
              <span
                className="inline-block h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: `hsl(${s.color})` }}
              />
              <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                {s.name}
              </span>
              <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
