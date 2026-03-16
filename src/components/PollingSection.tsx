import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { fetchPollingData, getSourceInfo, POLLING_SOURCES, POLL_TYPES, type PollEntry } from "@/data/pollingData";
import IssuePollingSection from "@/components/IssuePollingSection";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, ExternalLink, TrendingDown, TrendingUp, Minus, Filter, RefreshCw, Download, FileText, FileSpreadsheet } from "lucide-react";
import { exportPollingCSV, exportPollingPDF } from "@/lib/pollingExport";

// ─── useInView Hook ─────────────────────────────────────────────────────────

function useInView(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        obs.disconnect();
      }
    }, { threshold: 0.15, ...options });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, inView };
}

// ─── AnimatedCard wrapper ───────────────────────────────────────────────────

function AnimatedCard({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${className}`}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(20px)",
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateShort(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
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
        style={{ width: `${(a / total) * 100}%`, backgroundColor: "hsl(150, 55%, 45%)" }}
      />
      <div
        className="transition-all duration-300"
        style={{ width: `${(d / total) * 100}%`, backgroundColor: "hsl(0, 65%, 50%)" }}
      />
    </div>
  );
}

// ─── Multi-Source Approval Trend Chart (SVG) ────────────────────────────────

function MultiSourceTrendChart({ polls }: { polls: PollEntry[] }) {
  const { ref, inView } = useInView();
  const [hoveredPoint, setHoveredPoint] = useState<{ source: string; date: string; value: number; x: number; y: number } | null>(null);

  const approvalBySource = useMemo(() => {
    const map = new Map<string, PollEntry[]>();
    polls
      .filter((p) => p.poll_type === "approval" && p.candidate_or_topic === "Trump Approval")
      .forEach((p) => {
        if (!map.has(p.source)) map.set(p.source, []);
        map.get(p.source)!.push(p);
      });
    // Sort each source's polls by date
    map.forEach((v) => v.sort((a, b) => a.date_conducted.localeCompare(b.date_conducted)));
    return map;
  }, [polls]);

  if (approvalBySource.size === 0) return null;

  const allDates = polls
    .filter((p) => p.poll_type === "approval" && p.candidate_or_topic === "Trump Approval")
    .map((p) => p.date_conducted)
    .sort();
  const minDate = allDates[0];
  const maxDate = allDates[allDates.length - 1];
  const dateRange = new Date(maxDate).getTime() - new Date(minDate).getTime() || 1;

  const W = 700;
  const H = 280;
  const PAD = { top: 20, right: 20, bottom: 40, left: 45 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // Y-axis: approval values
  const allVals = polls
    .filter((p) => p.poll_type === "approval" && p.candidate_or_topic === "Trump Approval" && p.approve_pct !== null)
    .map((p) => p.approve_pct!);
  const minVal = Math.floor(Math.min(...allVals) - 3);
  const maxVal = Math.ceil(Math.max(...allVals) + 3);
  const valRange = maxVal - minVal || 1;

  const dateToX = (d: string) => PAD.left + ((new Date(d).getTime() - new Date(minDate).getTime()) / dateRange) * plotW;
  const valToY = (v: number) => PAD.top + plotH - ((v - minVal) / valRange) * plotH;

  // Y-axis ticks
  const yTicks: number[] = [];
  for (let v = Math.ceil(minVal / 5) * 5; v <= maxVal; v += 5) yTicks.push(v);

  // X-axis: monthly ticks
  const xTicks: { date: string; label: string }[] = [];
  const start = new Date(minDate);
  const end = new Date(maxDate);
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    const d = cur.toISOString().split("T")[0];
    xTicks.push({ date: d, label: cur.toLocaleDateString("en-US", { month: "short" }) });
    cur.setMonth(cur.getMonth() + 1);
  }

  return (
    <div ref={ref} className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h3 className="font-display text-sm font-semibold text-foreground mb-1">
        Approval Rating Trend by Source
      </h3>
      <p className="text-xs text-muted-foreground mb-3">
        Presidential approval tracked across {approvalBySource.size} polling sources
      </p>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[500px]" style={{ maxHeight: 320 }}>
          {/* Grid lines */}
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} y1={valToY(v)} x2={W - PAD.right} y2={valToY(v)} stroke="hsl(var(--border))" strokeWidth={0.5} />
              <text x={PAD.left - 6} y={valToY(v) + 3.5} textAnchor="end" fontSize={10} fill="hsl(var(--muted-foreground))">{v}%</text>
            </g>
          ))}
          {/* 50% reference line */}
          {minVal < 50 && maxVal > 50 && (
            <line x1={PAD.left} y1={valToY(50)} x2={W - PAD.right} y2={valToY(50)} stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />
          )}
          {/* X-axis ticks */}
          {xTicks.map((t) => (
            <text key={t.date} x={dateToX(t.date)} y={H - 8} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">{t.label}</text>
          ))}
          {/* Source lines */}
          {Array.from(approvalBySource.entries()).map(([sourceId, sourcePolls]) => {
            const src = getSourceInfo(sourceId);
            const color = `hsl(${src.color})`;
            const points = sourcePolls
              .filter((p) => p.approve_pct !== null)
              .map((p) => ({ x: dateToX(p.date_conducted), y: valToY(p.approve_pct!), date: p.date_conducted, val: p.approve_pct! }));
            if (points.length < 2) return null;
            const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
            return (
              <g key={sourceId}>
                <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.8}
                  style={{
                    strokeDasharray: inView ? "none" : "2000",
                    strokeDashoffset: inView ? 0 : 2000,
                    transition: "stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                />
                {points.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={hoveredPoint?.source === sourceId && hoveredPoint?.date === p.date ? 5 : 3}
                    fill={color}
                    stroke="hsl(var(--card))"
                    strokeWidth={1.5}
                    style={{ cursor: "pointer", opacity: inView ? 1 : 0, transition: `opacity 0.3s ease ${1000 + i * 100}ms` }}
                    onMouseEnter={() => setHoveredPoint({ source: sourceId, date: p.date, value: p.val, x: p.x, y: p.y })}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                ))}
              </g>
            );
          })}
          {/* Tooltip */}
          {hoveredPoint && (
            <g>
              <rect
                x={hoveredPoint.x + 10}
                y={hoveredPoint.y - 28}
                width={120}
                height={32}
                rx={6}
                fill="hsl(var(--popover))"
                stroke="hsl(var(--border))"
                strokeWidth={1}
              />
              <text x={hoveredPoint.x + 18} y={hoveredPoint.y - 14} fontSize={10} fontWeight="600" fill="hsl(var(--foreground))">
                {getSourceInfo(hoveredPoint.source).name}
              </text>
              <text x={hoveredPoint.x + 18} y={hoveredPoint.y - 2} fontSize={9} fill="hsl(var(--muted-foreground))">
                {hoveredPoint.value}% · {formatDateShort(hoveredPoint.date)}
              </text>
            </g>
          )}
        </svg>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3">
        {Array.from(approvalBySource.keys()).map((sourceId) => {
          const src = getSourceInfo(sourceId);
          return (
            <div key={sourceId} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: `hsl(${src.color})` }} />
              <span className="text-[10px] font-medium text-muted-foreground">{src.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Source Comparison Dot Plot ──────────────────────────────────────────────

function SourceDotPlot({ latestBySource }: { latestBySource: PollEntry[] }) {
  if (latestBySource.length === 0) return null;

  const sorted = [...latestBySource].sort((a, b) => (b.approve_pct ?? 0) - (a.approve_pct ?? 0));
  const barH = 36;
  const W = 500;
  const H = sorted.length * barH + 40;
  const LEFT = 130;
  const RIGHT = 40;
  const plotW = W - LEFT - RIGHT;
  const minPct = 30;
  const maxPct = 55;
  const range = maxPct - minPct;
  const pctToX = (v: number) => LEFT + ((v - minPct) / range) * plotW;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h3 className="font-display text-sm font-semibold text-foreground mb-1">
        Source-by-Source Approval Comparison
      </h3>
      <p className="text-xs text-muted-foreground mb-3">
        Latest approval rating from each polling source (dot plot)
      </p>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[400px]">
          {/* Grid lines */}
          {[35, 40, 45, 50].map((v) => (
            <g key={v}>
              <line x1={pctToX(v)} y1={15} x2={pctToX(v)} y2={H - 20} stroke="hsl(var(--border))" strokeWidth={0.5} />
              <text x={pctToX(v)} y={H - 5} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">{v}%</text>
            </g>
          ))}
          {/* 50% line */}
          <line x1={pctToX(50)} y1={15} x2={pctToX(50)} y2={H - 20} stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 3" opacity={0.4} />
          {sorted.map((poll, i) => {
            const src = getSourceInfo(poll.source);
            const color = `hsl(${src.color})`;
            const y = 15 + i * barH + barH / 2;
            const approveX = pctToX(poll.approve_pct ?? 0);
            const disapproveX = pctToX(poll.disapprove_pct ?? 0);
            return (
              <g key={poll.id}>
                {/* Source label */}
                <text x={LEFT - 8} y={y + 4} textAnchor="end" fontSize={11} fontWeight="500" fill="hsl(var(--foreground))">
                  {src.name}
                </text>
                {/* Connector line */}
                <line x1={Math.min(approveX, disapproveX)} y1={y} x2={Math.max(approveX, disapproveX)} y2={y} stroke="hsl(var(--border))" strokeWidth={2} />
                {/* Approve dot */}
                <circle cx={approveX} cy={y} r={6} fill="hsl(150, 55%, 45%)" stroke="hsl(var(--card))" strokeWidth={2} />
                <text x={approveX} y={y - 10} textAnchor="middle" fontSize={9} fontWeight="700" fill="hsl(150, 55%, 45%)">
                  {poll.approve_pct}%
                </text>
                {/* Disapprove dot */}
                <circle cx={disapproveX} cy={y} r={6} fill="hsl(0, 65%, 50%)" stroke="hsl(var(--card))" strokeWidth={2} />
                {/* Color indicator */}
                <rect x={4} y={y - 5} width={10} height={10} rx={2} fill={color} />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "hsl(150, 55%, 45%)" }} /> Approve</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "hsl(0, 65%, 50%)" }} /> Disapprove</span>
      </div>
    </div>
  );
}

// ─── Generic Ballot Comparison Chart ────────────────────────────────────────

function GenericBallotChart({ polls }: { polls: PollEntry[] }) {
  const { ref, inView } = useInView();
  if (polls.length === 0) return null;

  // Latest generic ballot per source
  const bySource = new Map<string, PollEntry>();
  polls.forEach((p) => {
    const ex = bySource.get(p.source);
    if (!ex || p.date_conducted > ex.date_conducted) bySource.set(p.source, p);
  });
  const entries = Array.from(bySource.values()).sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0));

  // Cross-source average
  const getDem = (p: PollEntry) => p.favor_pct ?? p.approve_pct ?? 0;
  const getRep = (p: PollEntry) => p.oppose_pct ?? p.disapprove_pct ?? 0;
  const avgDem = Math.round((entries.reduce((s, p) => s + getDem(p), 0) / entries.length) * 10) / 10;
  const avgRep = Math.round((entries.reduce((s, p) => s + getRep(p), 0) / entries.length) * 10) / 10;
  const avgMargin = Math.round((avgDem - avgRep) * 10) / 10;
  const avgTotal = avgDem + avgRep || 100;

  return (
    <div ref={ref} className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h3 className="font-display text-sm font-semibold text-foreground mb-1">
        Generic Congressional Ballot
      </h3>
      <p className="text-xs text-muted-foreground mb-3">
        Cross-source average of {entries.length} polls
      </p>

      {/* Average headline bar */}
      <div className="mb-4 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Polling Average</span>
          <MarginBadge margin={avgMargin} />
        </div>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl font-display font-bold" style={{ color: "hsl(210, 80%, 50%)" }}>D {avgDem}%</span>
          <span className="text-muted-foreground">–</span>
          <span className="text-2xl font-display font-bold" style={{ color: "hsl(0, 75%, 50%)" }}>R {avgRep}%</span>
        </div>
        <div className="flex h-6 w-full overflow-hidden rounded-md bg-muted">
          <div
            className="flex items-center justify-end pr-2 transition-all duration-1000"
            style={{ width: inView ? `${(avgDem / avgTotal) * 100}%` : "0%", backgroundColor: "hsl(210, 80%, 50%)" }}
          >
            <span className="text-[10px] font-bold text-white">{avgDem}%</span>
          </div>
          <div
            className="flex items-center justify-start pl-2 transition-all duration-1000"
            style={{ width: inView ? `${(avgRep / avgTotal) * 100}%` : "0%", backgroundColor: "hsl(0, 75%, 50%)" }}
          >
            <span className="text-[10px] font-bold text-white">{avgRep}%</span>
          </div>
        </div>
      </div>

      {/* Per-source breakdown */}
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">By Source</p>
      <div className="space-y-2.5">
        {entries.map((poll, idx) => {
          const src = getSourceInfo(poll.source);
          const dem = getDem(poll);
          const rep = getRep(poll);
          const total = dem + rep || 100;
          return (
            <div key={poll.id} style={{ opacity: inView ? 1 : 0, transform: inView ? "translateX(0)" : "translateX(-20px)", transition: `all 0.5s ease ${idx * 80}ms` }}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: `hsl(${src.color})` }} />
                  <span className="text-xs font-medium text-foreground">{src.name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold" style={{ color: "hsl(210, 80%, 50%)" }}>D {dem}%</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-bold" style={{ color: "hsl(0, 75%, 50%)" }}>R {rep}%</span>
                  <MarginBadge margin={poll.margin} />
                </div>
              </div>
              <div className="flex h-4 w-full overflow-hidden rounded-md bg-muted">
                <div
                  className="flex items-center justify-end pr-1"
                  style={{ width: inView ? `${(dem / total) * 100}%` : "0%", backgroundColor: "hsl(210, 80%, 50%)", transition: `width 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${idx * 80 + 200}ms` }}
                >
                  <span className="text-[8px] font-bold text-white" style={{ opacity: inView ? 1 : 0, transition: `opacity 0.3s ease ${idx * 80 + 600}ms` }}>{dem}%</span>
                </div>
                <div
                  className="flex items-center justify-start pl-1"
                  style={{ width: inView ? `${(rep / total) * 100}%` : "0%", backgroundColor: "hsl(0, 75%, 50%)", transition: `width 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${idx * 80 + 300}ms` }}
                >
                  <span className="text-[8px] font-bold text-white" style={{ opacity: inView ? 1 : 0, transition: `opacity 0.3s ease ${idx * 80 + 600}ms` }}>{rep}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Issue Polling Butterfly Chart ──────────────────────────────────────────

function IssueButterflyChart({ polls }: { polls: PollEntry[] }) {
  const { ref, inView } = useInView();
  if (polls.length === 0) return null;

  // Deduplicate: latest per topic across sources
  const byTopic = new Map<string, PollEntry[]>();
  polls.forEach((p) => {
    if (!byTopic.has(p.candidate_or_topic)) byTopic.set(p.candidate_or_topic, []);
    byTopic.get(p.candidate_or_topic)!.push(p);
  });

  const topics = Array.from(byTopic.entries()).sort((a, b) => {
    const aMargin = a[1][0]?.margin ?? 0;
    const bMargin = b[1][0]?.margin ?? 0;
    return aMargin - bMargin;
  });

  return (
    <div ref={ref} className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h3 className="font-display text-sm font-semibold text-foreground mb-1">
        Issue Polling Overview
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Approve vs disapprove on key issues (butterfly chart)
      </p>
      <div className="space-y-3">
        {topics.map(([topic, topicPolls], idx) => {
          // Average across sources for the topic
          const avgApprove = topicPolls.reduce((s, p) => s + (p.approve_pct ?? p.favor_pct ?? 0), 0) / topicPolls.length;
          const avgDisapprove = topicPolls.reduce((s, p) => s + (p.disapprove_pct ?? p.oppose_pct ?? 0), 0) / topicPolls.length;
          const margin = avgApprove - avgDisapprove;
          const maxBar = 80; // max percentage width
          const approveW = (avgApprove / maxBar) * 100;
          const disapproveW = (avgDisapprove / maxBar) * 100;
          const sourceNames = topicPolls.map((p) => getSourceInfo(p.source).name);

          return (
            <div key={topic} className="group" style={{ opacity: inView ? 1 : 0, transform: inView ? "translateY(0)" : "translateY(10px)", transition: `all 0.5s ease ${idx * 80}ms` }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-foreground">{topic}</span>
                <div className="flex items-center gap-2">
                  <MarginBadge margin={Math.round(margin * 10) / 10} />
                  <span className="text-[9px] text-muted-foreground hidden group-hover:inline">
                    {sourceNames.join(", ")}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                {/* Approve bar (left to right) */}
                <div className="flex-1 flex justify-end">
                  <div
                    className="h-6 rounded-l-md flex items-center justify-end pr-1.5"
                    style={{
                      width: inView ? `${Math.min(approveW, 100)}%` : "0%",
                      backgroundColor: "hsl(150, 55%, 45%)",
                      minWidth: inView ? 30 : 0,
                      transition: `all 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${idx * 80 + 200}ms`,
                    }}
                  >
                    <span className="text-[10px] font-bold text-white" style={{ opacity: inView ? 1 : 0, transition: `opacity 0.3s ease ${idx * 80 + 600}ms` }}>{Math.round(avgApprove)}%</span>
                  </div>
                </div>
                {/* Center divider */}
                <div className="w-px h-6 bg-border" />
                {/* Disapprove bar (right) */}
                <div className="flex-1">
                  <div
                    className="h-6 rounded-r-md flex items-center pl-1.5"
                    style={{
                      width: inView ? `${Math.min(disapproveW, 100)}%` : "0%",
                      backgroundColor: "hsl(0, 65%, 50%)",
                      minWidth: inView ? 30 : 0,
                      transition: `all 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${idx * 80 + 300}ms`,
                    }}
                  >
                    <span className="text-[10px] font-bold text-white" style={{ opacity: inView ? 1 : 0, transition: `opacity 0.3s ease ${idx * 80 + 600}ms` }}>{Math.round(avgDisapprove)}%</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-6 mt-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-8 rounded-sm" style={{ backgroundColor: "hsl(150, 55%, 45%)" }} /> Approve / Favor</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-8 rounded-sm" style={{ backgroundColor: "hsl(0, 65%, 50%)" }} /> Disapprove / Oppose</span>
      </div>
    </div>
  );
}

// ─── Approval Gauge ─────────────────────────────────────────────────────────

function ApprovalGauge({ approve, disapprove, margin }: { approve: number; disapprove: number; margin: number }) {
  const { ref, inView } = useInView();
  const radius = 60;
  const strokeW = 12;
  const cx = 80;
  const cy = 80;
  const circumference = Math.PI * radius; // half circle
  const approveArc = inView ? (approve / 100) * circumference : 0;
  const disapproveArc = inView ? (disapprove / 100) * circumference : 0;

  return (
    <div ref={ref} className="flex flex-col items-center">
      <svg width={160} height={100} viewBox="0 0 160 100">
        {/* Background arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
        {/* Approve arc (from left) */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="hsl(150, 55%, 45%)"
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={`${approveArc} ${circumference}`}
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
        {/* Disapprove arc (from right) */}
        <path
          d={`M ${cx + radius} ${cy} A ${radius} ${radius} 0 0 0 ${cx - radius} ${cy}`}
          fill="none"
          stroke="hsl(0, 65%, 50%)"
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={`${disapproveArc} ${circumference}`}
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.4, 0, 0.2, 1) 0.2s" }}
        />
        {/* Center text */}
        <text x={cx} y={cy - 10} textAnchor="middle" fontSize={24} fontWeight="800" fill="hsl(var(--foreground))"
          style={{ opacity: inView ? 1 : 0, transition: "opacity 0.5s ease 0.8s" }}>
          {approve}%
        </text>
        <text x={cx} y={cy + 6} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))"
          style={{ opacity: inView ? 1 : 0, transition: "opacity 0.5s ease 1s" }}>
          approve
        </text>
      </svg>
      <MarginBadge margin={margin} />
    </div>
  );
}

// ─── Favorability Trend Chart ───────────────────────────────────────────────

function FavorabilityChart({ polls }: { polls: PollEntry[] }) {
  const favPolls = polls.filter((p) => p.poll_type === "favorability");
  if (favPolls.length < 2) return null;

  const sorted = [...favPolls].sort((a, b) => a.date_conducted.localeCompare(b.date_conducted));
  const W = 700;
  const H = 280;
  const PAD = { top: 20, right: 20, bottom: 40, left: 45 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const allVals = sorted.flatMap((p) => [p.favor_pct ?? 0, p.oppose_pct ?? 0]);
  const minVal = Math.floor(Math.min(...allVals) - 3);
  const maxVal = Math.ceil(Math.max(...allVals) + 3);
  const valRange = maxVal - minVal || 1;

  const dateRange = new Date(sorted[sorted.length - 1].date_conducted).getTime() - new Date(sorted[0].date_conducted).getTime() || 1;
  const dateToX = (d: string) => PAD.left + ((new Date(d).getTime() - new Date(sorted[0].date_conducted).getTime()) / dateRange) * plotW;
  const valToY = (v: number) => PAD.top + plotH - ((v - minVal) / valRange) * plotH;

  const favPath = sorted.map((p, i) => `${i === 0 ? "M" : "L"} ${dateToX(p.date_conducted)} ${valToY(p.favor_pct ?? 0)}`).join(" ");
  const unfavPath = sorted.map((p, i) => `${i === 0 ? "M" : "L"} ${dateToX(p.date_conducted)} ${valToY(p.oppose_pct ?? 0)}`).join(" ");

  // Area fill
  const favAreaPath = favPath + ` L ${dateToX(sorted[sorted.length - 1].date_conducted)} ${PAD.top + plotH} L ${dateToX(sorted[0].date_conducted)} ${PAD.top + plotH} Z`;
  const unfavAreaPath = unfavPath + ` L ${dateToX(sorted[sorted.length - 1].date_conducted)} ${PAD.top + plotH} L ${dateToX(sorted[0].date_conducted)} ${PAD.top + plotH} Z`;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h3 className="font-display text-sm font-semibold text-foreground mb-1">
        Favorability Tracking
      </h3>
      <p className="text-xs text-muted-foreground mb-3">
        Favorable vs unfavorable over time ({sorted.length} data points from {new Set(sorted.map((p) => p.source)).size} sources)
      </p>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[500px]" style={{ maxHeight: 320 }}>
          {/* Y gridlines */}
          {(() => {
            const ticks: number[] = [];
            for (let v = Math.ceil(minVal / 5) * 5; v <= maxVal; v += 5) ticks.push(v);
            return ticks;
          })().map((v) => (
            <g key={v}>
              <line x1={PAD.left} y1={valToY(v)} x2={W - PAD.right} y2={valToY(v)} stroke="hsl(var(--border))" strokeWidth={0.5} />
              <text x={PAD.left - 6} y={valToY(v) + 3.5} textAnchor="end" fontSize={10} fill="hsl(var(--muted-foreground))">{v}%</text>
            </g>
          ))}
          {/* 50% reference */}
          {minVal < 50 && maxVal > 50 && (
            <line x1={PAD.left} y1={valToY(50)} x2={W - PAD.right} y2={valToY(50)} stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 3" opacity={0.4} />
          )}
          {/* X-axis monthly ticks */}
          {(() => {
            const ticks: { date: string; label: string }[] = [];
            const s = new Date(sorted[0].date_conducted);
            const e = new Date(sorted[sorted.length - 1].date_conducted);
            const c = new Date(s.getFullYear(), s.getMonth(), 1);
            while (c <= e) {
              const d = c.toISOString().split("T")[0];
              const showYear = c.getMonth() === 0 || ticks.length === 0;
              ticks.push({ date: d, label: c.toLocaleDateString("en-US", { month: "short", ...(showYear ? { year: "2-digit" } : {}) }) });
              c.setMonth(c.getMonth() + 1);
            }
            return ticks;
          })().map((t) => (
            <text key={t.date} x={dateToX(t.date)} y={H - 8} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">{t.label}</text>
          ))}
          {/* Area fills */}
          <path d={unfavAreaPath} fill="hsl(0, 65%, 50%)" opacity={0.06} />
          <path d={favAreaPath} fill="hsl(150, 55%, 45%)" opacity={0.06} />
          {/* Lines */}
          <path d={unfavPath} fill="none" stroke="hsl(0, 65%, 50%)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          <path d={favPath} fill="none" stroke="hsl(150, 55%, 45%)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {/* Dots */}
          {sorted.map((p, i) => (
            <g key={i}>
              <circle cx={dateToX(p.date_conducted)} cy={valToY(p.favor_pct ?? 0)} r={3.5} fill="hsl(150, 55%, 45%)" stroke="hsl(var(--card))" strokeWidth={1.5} />
              <circle cx={dateToX(p.date_conducted)} cy={valToY(p.oppose_pct ?? 0)} r={3.5} fill="hsl(0, 65%, 50%)" stroke="hsl(var(--card))" strokeWidth={1.5} />
            </g>
          ))}
          {/* Start/end value labels */}
          {sorted.length > 0 && (
            <>
              <text x={dateToX(sorted[0].date_conducted) + 8} y={valToY(sorted[0].favor_pct ?? 0) - 6} fontSize={9} fontWeight={600} fill="hsl(150, 55%, 45%)">{sorted[0].favor_pct}%</text>
              <text x={dateToX(sorted[sorted.length - 1].date_conducted) - 8} y={valToY(sorted[sorted.length - 1].favor_pct ?? 0) - 6} textAnchor="end" fontSize={9} fontWeight={600} fill="hsl(150, 55%, 45%)">{sorted[sorted.length - 1].favor_pct}%</text>
              <text x={dateToX(sorted[0].date_conducted) + 8} y={valToY(sorted[0].oppose_pct ?? 0) + 12} fontSize={9} fontWeight={600} fill="hsl(0, 65%, 50%)">{sorted[0].oppose_pct}%</text>
              <text x={dateToX(sorted[sorted.length - 1].date_conducted) - 8} y={valToY(sorted[sorted.length - 1].oppose_pct ?? 0) + 12} textAnchor="end" fontSize={9} fontWeight={600} fill="hsl(0, 65%, 50%)">{sorted[sorted.length - 1].oppose_pct}%</text>
            </>
          )}
        </svg>
      </div>
      <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-6 rounded-sm" style={{ backgroundColor: "hsl(150, 55%, 45%)" }} /> Favorable</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-6 rounded-sm" style={{ backgroundColor: "hsl(0, 65%, 50%)" }} /> Unfavorable</span>
        {sorted.length > 0 && (
          <span className="ml-auto">
            Latest: {sorted[sorted.length - 1].favor_pct}% fav / {sorted[sorted.length - 1].oppose_pct}% unfav · {getSourceInfo(sorted[sorted.length - 1].source).name}
          </span>
        )}
      </div>
    </div>
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
      {/* Filters + Export */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
       <div className="flex flex-wrap gap-4 items-center flex-1">
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
       {/* Update + Export Buttons */}
       <div className="flex items-center gap-1.5 shrink-0">
         <button
           onClick={seedData}
           disabled={seeding}
           className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors shadow-sm disabled:opacity-50"
           title="Update polling data from all sources"
         >
           <RefreshCw className={`h-3.5 w-3.5 ${seeding ? "animate-spin" : ""}`} />
           {seeding ? "Updating…" : "Update Data"}
         </button>
         <button
           onClick={() => exportPollingCSV(filtered)}
           className="win98-button text-[10px] flex items-center gap-1"
           title="Export as CSV"
         >
           <FileSpreadsheet className="h-3 w-3" />
           CSV
         </button>
         <button
           onClick={() => exportPollingPDF(filtered)}
           className="win98-button text-[10px] flex items-center gap-1"
           title="Export as PDF"
         >
           <FileText className="h-3 w-3" />
           PDF
         </button>
       </div>
      </div>

      {/* ─── Summary Cards with Gauge ──────────────────────────────────────── */}
      {avgApproval && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Approval Gauge */}
          <AnimatedCard delay={0}>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col items-center justify-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Cross-Source Average
            </p>
            <ApprovalGauge approve={avgApproval.approve} disapprove={avgApproval.disapprove} margin={avgApproval.margin} />
            <div className="flex justify-between w-full mt-2 text-xs text-muted-foreground">
              <span style={{ color: "hsl(150, 55%, 45%)" }}>Approve {avgApproval.approve}%</span>
              <span style={{ color: "hsl(0, 65%, 50%)" }}>Disapprove {avgApproval.disapprove}%</span>
            </div>
          </div>
          </AnimatedCard>

          {/* Generic ballot summary */}
          {genericBallotPolls.length > 0 && (() => {
            const latest = genericBallotPolls[0];
            return (
              <AnimatedCard delay={100}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Generic Ballot (Latest)
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
                <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted mb-2">
                  <div className="transition-all duration-500" style={{ width: `${((latest.favor_pct ?? 0) / ((latest.favor_pct ?? 0) + (latest.oppose_pct ?? 0) || 100)) * 100}%`, backgroundColor: "hsl(210, 80%, 50%)" }} />
                  <div className="transition-all duration-500" style={{ width: `${((latest.oppose_pct ?? 0) / ((latest.favor_pct ?? 0) + (latest.oppose_pct ?? 0) || 100)) * 100}%`, backgroundColor: "hsl(0, 75%, 50%)" }} />
                </div>
                <MarginBadge margin={latest.margin} />
                <p className="text-[10px] text-muted-foreground mt-2">
                  {getSourceInfo(latest.source).name} · {formatDate(latest.date_conducted)}
                </p>
              </AnimatedCard>
            );
          })()}

          {/* Source count */}
          <AnimatedCard delay={200}>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Data Coverage
            </p>
            <div className="text-3xl font-display font-bold text-foreground">{new Set(polls.map((p) => p.source)).size}</div>
            <p className="text-xs text-muted-foreground">active polling sources</p>
            <div className="text-2xl font-display font-bold text-foreground mt-2">{polls.length}</div>
            <p className="text-xs text-muted-foreground">total polls tracked</p>
          </div>
          </AnimatedCard>

          {/* Poll types breakdown */}
          <AnimatedCard delay={300}>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Polls by Type
            </p>
            <div className="space-y-2">
              {POLL_TYPES.map((t) => {
                const count = polls.filter((p) => p.poll_type === t.id).length;
                if (count === 0) return null;
                const pct = (count / polls.length) * 100;
                return (
                  <div key={t.id}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-muted-foreground">{t.label}</span>
                      <span className="font-bold text-foreground">{count}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary/60 transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          </AnimatedCard>
        </div>
      )}

      {/* ─── Multi-Source Trend Chart ─────────────────────────────────────── */}
      <MultiSourceTrendChart polls={polls} />

      {/* ─── Charts Row: Dot Plot + Generic Ballot ───────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SourceDotPlot latestBySource={latestBySource} />
        <GenericBallotChart polls={genericBallotPolls} />
      </div>

      {/* ─── Favorability + Issue Charts ─────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <FavorabilityChart polls={polls} />
        <IssueButterflyChart polls={issuePolls} />
      </div>

      {/* ─── Issue Polling Deep Dive ──────────────────────────────────────── */}
      <IssuePollingSection polls={polls} />

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
                          <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: `hsl(${src.color})` }} />
                          <span className="font-medium text-foreground">{src.name}</span>
                          {poll.partisan_lean && (
                            <span className="text-[9px] rounded-sm px-1.5 py-0.5 bg-muted text-muted-foreground font-medium">{poll.partisan_lean}</span>
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
                          <a href={poll.source_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
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
                        <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: `hsl(${src.color})` }} />
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
                      <span className="font-bold" style={{ color: "hsl(150, 55%, 45%)" }}>{primaryPct ?? "—"}%</span>
                      <span className="text-muted-foreground mx-1">/</span>
                      <span className="font-bold" style={{ color: "hsl(0, 65%, 50%)" }}>{secondaryPct ?? "—"}%</span>
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
              <span className="inline-block h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: `hsl(${s.color})` }} />
              <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">{s.name}</span>
              <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
