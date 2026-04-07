import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from "react";
import { fetchPollingData, getSourceInfo, POLLING_SOURCES, POLL_TYPES, type PollEntry } from "@/data/pollingData";
import IssuePollingSection from "@/components/IssuePollingSection";
const PredictionMarketsPanel = lazy(() => import("@/components/PredictionMarketsPanel"));
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, ExternalLink, TrendingDown, TrendingUp, Minus, Filter, RefreshCw, Download, FileText, FileSpreadsheet } from "lucide-react";
import { exportPollingCSV, exportPollingPDF } from "@/lib/pollingExport";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from "recharts";

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

function AnimatedCard({ children, className = "", delay = 0 }: {children: React.ReactNode;className?: string;delay?: number;}) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${className}`}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(20px)",
        transitionDelay: `${delay}ms`
      }}>
      
      {children}
    </div>);

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

function MarginBadge({ margin }: {margin: number | null;}) {
  if (margin === null) return null;
  const Icon = margin > 0 ? TrendingUp : margin < 0 ? TrendingDown : Minus;
  const label = margin > 0 ? `+${margin.toFixed(1)}` : margin.toFixed(1);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold"
      style={{
        backgroundColor: `${marginColor(margin)}20`,
        color: marginColor(margin)
      }}>
      
      <Icon className="h-3 w-3" />
      {label}
    </span>);

}

function ApprovalBar({ approve, disapprove }: {approve: number | null;disapprove: number | null;}) {
  if (approve === null && disapprove === null) return null;
  const a = approve ?? 0;
  const d = disapprove ?? 0;
  const total = a + d || 100;
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="transition-all duration-300"
        style={{ width: `${a / total * 100}%`, backgroundColor: "hsl(150, 55%, 45%)" }} />
      
      <div
        className="transition-all duration-300"
        style={{ width: `${d / total * 100}%`, backgroundColor: "hsl(0, 65%, 50%)" }} />
      
    </div>);

}

// ─── Reusable Poll Picker Panel ─────────────────────────────────────────────

export function usePollPicker(polls: PollEntry[], filterFn?: (p: PollEntry) => boolean) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPicker, setShowPicker] = useState(false);
  const isAll = selectedIds.size === 0;

  const uniquePolls = useMemo(() => {
    const filtered = filterFn ? polls.filter(filterFn) : polls;
    const seen = new Map<string, {id: string;source: string;date: string;topic: string;}>();
    filtered.forEach((p) => {
      const key = `${p.source}|${p.date_conducted}`;
      if (!seen.has(key)) seen.set(key, { id: key, source: p.source, date: p.date_conducted, topic: p.candidate_or_topic });
    });
    return [...seen.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [polls, filterFn]);

  const filteredPolls = useMemo(() => {
    const base = filterFn ? polls.filter(filterFn) : polls;
    if (isAll) return base;
    return base.filter((p) => selectedIds.has(`${p.source}|${p.date_conducted}`));
  }, [polls, selectedIds, isAll, filterFn]);

  const toggle = (id: string) => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);else next.add(id);
    return next;
  });

  return { selectedIds, setSelectedIds, showPicker, setShowPicker, isAll, uniquePolls, filteredPolls, toggle };
}

export function PollPickerButton({ showPicker, setShowPicker, isAll, count }: {showPicker: boolean;setShowPicker: (v: boolean) => void;isAll: boolean;count: number;}) {
  return (
    <button
      onClick={() => setShowPicker(!showPicker)}
      className={`rounded-full px-2.5 py-1 text-[10px] font-bold border transition-colors flex items-center gap-1 ${
      showPicker ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border hover:bg-muted/80"}`
      }>
      
      <Filter className="h-3 w-3" />
      Polls {!isAll && `(${count})`}
    </button>);

}

export function PollPickerDropdown({ uniquePolls, selectedIds, isAll, toggle, setSelectedIds





}: {uniquePolls: {id: string;source: string;date: string;topic: string;}[];selectedIds: Set<string>;isAll: boolean;toggle: (id: string) => void;setSelectedIds: (v: Set<string>) => void;}) {
  return (
    <div className="mb-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Select Polls</span>
        <div className="flex gap-2">
          <button onClick={() => setSelectedIds(new Set())} className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors ${isAll ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>All</button>
          <button onClick={() => setSelectedIds(new Set(uniquePolls.map((p) => p.id)))} className="text-[10px] font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground hover:bg-accent transition-colors">Select All</button>
          <button onClick={() => setSelectedIds(new Set())} className="text-[10px] font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground hover:bg-accent transition-colors">Clear</button>
        </div>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 max-h-40 overflow-y-auto">
        {uniquePolls.map((poll) => {
          const checked = isAll || selectedIds.has(poll.id);
          return (
            <label key={poll.id} className={`flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors text-xs ${checked && !isAll ? "bg-primary/10 border border-primary/30" : "bg-card border border-border hover:bg-muted/50"}`}>
              <input type="checkbox" checked={checked} onChange={() => toggle(poll.id)} className="accent-[hsl(var(--primary))] h-3 w-3 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="font-semibold text-foreground">{getSourceInfo(poll.source).name}</span>
                <span className="text-muted-foreground ml-1">{formatDate(poll.date)}</span>
              </div>
            </label>);

        })}
      </div>
    </div>);

}

function MultiSourceTrendChart({ polls }: {polls: PollEntry[];}) {
  const { ref, inView } = useInView();
  const [hoveredBar, setHoveredBar] = useState<{source: string; approve: number; disapprove: number; margin: number; x: number; y: number;} | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{source: string; date: string; value: number; x: number; y: number;} | null>(null);
  const [hiddenSources, setHiddenSources] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<"approve" | "disapprove" | "margin" | "name">("approve");
  const [viewMode, setViewMode] = useState<"bars" | "trend">("bars");
  const [zoomMonths, setZoomMonths] = useState<number>(0);

  const approvalFilter = useCallback((p: PollEntry) => p.poll_type === "approval" && p.candidate_or_topic === "Trump Approval", []);
  const picker = usePollPicker(polls, approvalFilter);

  const latestBySource = useMemo(() => {
    const map = new Map<string, PollEntry>();
    picker.filteredPolls
      .filter((p) => p.poll_type === "approval" && p.candidate_or_topic === "Trump Approval" && p.approve_pct !== null)
      .forEach((p) => {
        const ex = map.get(p.source);
        if (!ex || p.date_conducted > ex.date_conducted) map.set(p.source, p);
      });
    return map;
  }, [picker.filteredPolls]);

  const approvalBySource = useMemo(() => {
    const map = new Map<string, PollEntry[]>();
    picker.filteredPolls
      .filter((p) => p.poll_type === "approval" && p.candidate_or_topic === "Trump Approval")
      .forEach((p) => {
        if (!map.has(p.source)) map.set(p.source, []);
        map.get(p.source)!.push(p);
      });
    map.forEach((v) => v.sort((a, b) => a.date_conducted.localeCompare(b.date_conducted)));
    return map;
  }, [picker.filteredPolls]);

  const allSourceIds = useMemo(() => Array.from(latestBySource.keys()).sort(), [latestBySource]);

  const toggleSource = useCallback((id: string) => {
    setHiddenSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => setHiddenSources(new Set()), []);
  const deselectAll = useCallback(() => setHiddenSources(new Set(allSourceIds)), [allSourceIds]);

  const visibleEntries = useMemo(() => {
    const entries = Array.from(latestBySource.entries()).filter(([k]) => !hiddenSources.has(k));
    entries.sort((a, b) => {
      if (sortBy === "approve") return (b[1].approve_pct ?? 0) - (a[1].approve_pct ?? 0);
      if (sortBy === "disapprove") return (b[1].disapprove_pct ?? 0) - (a[1].disapprove_pct ?? 0);
      if (sortBy === "margin") return (b[1].margin ?? 0) - (a[1].margin ?? 0);
      return getSourceInfo(a[0]).name.localeCompare(getSourceInfo(b[0]).name);
    });
    return entries;
  }, [latestBySource, hiddenSources, sortBy]);

  const visibleSources = useMemo(() => {
    const map = new Map<string, PollEntry[]>();
    approvalBySource.forEach((v, k) => {
      if (!hiddenSources.has(k)) map.set(k, v);
    });
    return map;
  }, [approvalBySource, hiddenSources]);

  if (latestBySource.size === 0) return null;

  const W = 700;
  const H = 300;
  const barGroupW = Math.min(50, Math.max(20, (W - 60) / visibleEntries.length - 8));
  const barChartW = visibleEntries.length * (barGroupW + 8) + 60;
  const PAD = { top: 20, right: 20, bottom: 70, left: 45 };
  const plotH = H - PAD.top - PAD.bottom;
  const trendPAD = { top: 20, right: 20, bottom: 40, left: 45 };
  const trendPlotW = W - trendPAD.left - trendPAD.right;
  const trendPlotH = H - trendPAD.top - trendPAD.bottom;

  const allDates = picker.filteredPolls
    .filter((p) => p.poll_type === "approval" && p.candidate_or_topic === "Trump Approval")
    .map((p) => p.date_conducted).sort();
  const absoluteMin = allDates[0] ?? "2025-01-01";
  const absoluteMax = allDates[allDates.length - 1] ?? "2026-12-31";
  let trendMinDate = absoluteMin;
  const trendMaxDate = absoluteMax;
  if (zoomMonths > 0) {
    const cutoff = new Date(trendMaxDate);
    cutoff.setMonth(cutoff.getMonth() - zoomMonths);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    if (cutoffStr > absoluteMin) trendMinDate = cutoffStr;
  }
  const trendDateRange = new Date(trendMaxDate).getTime() - new Date(trendMinDate).getTime() || 1;

  const trendVisiblePolls = picker.filteredPolls.filter(
    (p) => p.poll_type === "approval" && p.candidate_or_topic === "Trump Approval" && p.approve_pct !== null && p.date_conducted >= trendMinDate && !hiddenSources.has(p.source)
  );
  const barVals = visibleEntries.flatMap(([, p]) => [p.approve_pct ?? 0, p.disapprove_pct ?? 0]);
  if (barVals.length === 0) barVals.push(30, 60);
  const trendVals = trendVisiblePolls.map((p) => p.approve_pct!);
  if (trendVals.length === 0) trendVals.push(30, 60);

  const activeVals = viewMode === "bars" ? barVals : trendVals;
  const minVal = Math.floor(Math.min(...activeVals) - 3);
  const maxVal = Math.ceil(Math.max(...activeVals) + 3);
  const valRange = maxVal - minVal || 1;

  const valToY = (v: number) => PAD.top + plotH - (v - minVal) / valRange * plotH;
  const trendValToY = (v: number) => trendPAD.top + trendPlotH - (v - minVal) / valRange * trendPlotH;
  const trendDateToX = (d: string) => trendPAD.left + (new Date(d).getTime() - new Date(trendMinDate).getTime()) / trendDateRange * trendPlotW;

  const yTicks: number[] = [];
  for (let v = Math.ceil(minVal / 5) * 5; v <= maxVal; v += 5) yTicks.push(v);

  const xTicks: {date: string; label: string}[] = [];
  if (viewMode === "trend") {
    const cur = new Date(new Date(trendMinDate).getFullYear(), new Date(trendMinDate).getMonth(), 1);
    const end = new Date(trendMaxDate);
    while (cur <= end) {
      const d = cur.toISOString().split("T")[0];
      if (d >= trendMinDate) xTicks.push({ date: d, label: cur.toLocaleDateString("en-US", { month: "short" }) });
      cur.setMonth(cur.getMonth() + 1);
    }
  }

  const sortOptions: { label: string; value: typeof sortBy }[] = [
    { label: "Approve ↓", value: "approve" },
    { label: "Disapprove ↓", value: "disapprove" },
    { label: "Margin ↓", value: "margin" },
    { label: "Name A-Z", value: "name" },
  ];
  const zoomOptions = [
    { label: "All", value: 0 },
    { label: "3M", value: 3 },
    { label: "6M", value: 6 },
    { label: "1Y", value: 12 },
    { label: "2Y", value: 24 },
  ];

  return (
    <div ref={ref} className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="font-display text-sm font-semibold text-foreground">
            {viewMode === "bars" ? "Approval Rating by Source" : "Approval Rating Trend by Source"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {viewMode === "bars"
              ? (picker.isAll ? `Latest approval from ${visibleEntries.length} of ${latestBySource.size} sources` : `${picker.selectedIds.size} poll${picker.selectedIds.size !== 1 ? "s" : ""} selected`)
              : (picker.isAll ? `Tracked across ${visibleSources.size} of ${approvalBySource.size} sources` : `${picker.selectedIds.size} poll${picker.selectedIds.size !== 1 ? "s" : ""} selected`)}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <div className="flex rounded-lg border border-border overflow-hidden mr-1">
            <button onClick={() => setViewMode("bars")} className={`px-2 py-0.5 text-[10px] font-bold transition-colors ${viewMode === "bars" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>By Source</button>
            <button onClick={() => setViewMode("trend")} className={`px-2 py-0.5 text-[10px] font-bold transition-colors ${viewMode === "trend" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>Trend</button>
          </div>
          <PollPickerButton showPicker={picker.showPicker} setShowPicker={picker.setShowPicker} isAll={picker.isAll} count={picker.selectedIds.size} />
          {viewMode === "bars" && sortOptions.map((opt) =>
            <button key={opt.value} onClick={() => setSortBy(opt.value)} className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${sortBy === opt.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>{opt.label}</button>
          )}
          {viewMode === "trend" && zoomOptions.map((opt) =>
            <button key={opt.value} onClick={() => setZoomMonths(opt.value)} className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${zoomMonths === opt.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>{opt.label}</button>
          )}
          <button onClick={() => setShowFilters(!showFilters)} className={`ml-1 p-1 rounded transition-colors ${showFilters ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`} title="Filter sources">
            <Filter className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {picker.showPicker && <PollPickerDropdown uniquePolls={picker.uniquePolls} selectedIds={picker.selectedIds} isAll={picker.isAll} toggle={picker.toggle} setSelectedIds={picker.setSelectedIds} />}

      {showFilters &&
        <div className="mb-3 p-2 rounded-lg border border-border bg-muted/30">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold text-muted-foreground">FILTER SOURCES</span>
            <button onClick={selectAll} className="text-[9px] text-primary hover:underline">Select All</button>
            <button onClick={deselectAll} className="text-[9px] text-primary hover:underline">Deselect All</button>
            <span className="text-[9px] text-muted-foreground ml-auto">{viewMode === "bars" ? visibleEntries.length : visibleSources.size}/{allSourceIds.length} visible</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {allSourceIds.map((id) => {
              const src = getSourceInfo(id);
              const active = !hiddenSources.has(id);
              return (
                <button key={id} onClick={() => toggleSource(id)} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium transition-all ${active ? "bg-card border border-border shadow-sm" : "opacity-40 bg-transparent border border-transparent"}`}>
                  <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: `hsl(${src.color})` }} />
                  {src.name}
                </button>);
            })}
          </div>
        </div>
      }

      <div className="overflow-x-auto">
        {viewMode === "bars" && (
          <svg viewBox={`0 0 ${Math.max(W, barChartW)} ${H}`} className="w-full min-w-[500px]" style={{ maxHeight: 340 }}>
            {yTicks.map((v) =>
              <g key={v}>
                <line x1={PAD.left} y1={valToY(v)} x2={Math.max(W, barChartW) - PAD.right} y2={valToY(v)} stroke="hsl(var(--border))" strokeWidth={0.5} />
                <text x={PAD.left - 6} y={valToY(v) + 3.5} textAnchor="end" fontSize={10} fill="hsl(var(--muted-foreground))">{v}%</text>
              </g>
            )}
            {minVal < 50 && maxVal > 50 &&
              <line x1={PAD.left} y1={valToY(50)} x2={Math.max(W, barChartW) - PAD.right} y2={valToY(50)} stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />
            }
            {visibleEntries.map(([sourceId, poll], i) => {
              const src = getSourceInfo(sourceId);
              const groupX = PAD.left + 10 + i * (barGroupW + 8);
              const halfBar = barGroupW / 2 - 1;
              const approve = poll.approve_pct ?? 0;
              const disapprove = poll.disapprove_pct ?? 0;
              const approveH = (approve - minVal) / valRange * plotH;
              const disapproveH = (disapprove - minVal) / valRange * plotH;
              const baseY = PAD.top + plotH;
              return (
                <g key={sourceId} onMouseEnter={() => setHoveredBar({ source: sourceId, approve, disapprove, margin: approve - disapprove, x: groupX + barGroupW / 2, y: valToY(Math.max(approve, disapprove)) })} onMouseLeave={() => setHoveredBar(null)} style={{ cursor: "pointer" }}>
                  <rect x={groupX} y={baseY - approveH} width={halfBar} height={inView ? approveH : 0} rx={2} fill="hsl(150, 55%, 45%)" opacity={0.85} style={{ transition: "height 0.8s ease, y 0.8s ease" }} />
                  <rect x={groupX + halfBar + 2} y={baseY - disapproveH} width={halfBar} height={inView ? disapproveH : 0} rx={2} fill="hsl(0, 65%, 50%)" opacity={0.85} style={{ transition: "height 0.8s ease, y 0.8s ease" }} />
                  <text x={groupX + halfBar / 2} y={baseY - approveH - 3} textAnchor="middle" fontSize={8} fontWeight="600" fill="hsl(150, 55%, 45%)">{approve}%</text>
                  <text x={groupX + halfBar + 2 + halfBar / 2} y={baseY - disapproveH - 3} textAnchor="middle" fontSize={8} fontWeight="600" fill="hsl(0, 65%, 50%)">{disapprove}%</text>
                  <text x={groupX + barGroupW / 2} y={H - PAD.bottom + 8} textAnchor="end" fontSize={9} fill={`hsl(${src.color})`} fontWeight="500" transform={`rotate(-45, ${groupX + barGroupW / 2}, ${H - PAD.bottom + 8})`}>
                    {src.name.length > 14 ? src.name.slice(0, 13) + "…" : src.name}
                  </text>
                </g>
              );
            })}
            {hoveredBar && (
              <g>
                <rect x={Math.min(hoveredBar.x + 10, Math.max(W, barChartW) - 145)} y={Math.max(hoveredBar.y - 50, 5)} width={130} height={44} rx={6} fill="hsl(var(--popover))" stroke="hsl(var(--border))" strokeWidth={1} />
                <text x={Math.min(hoveredBar.x + 18, Math.max(W, barChartW) - 137)} y={Math.max(hoveredBar.y - 50, 5) + 14} fontSize={10} fontWeight="600" fill="hsl(var(--foreground))">{getSourceInfo(hoveredBar.source).name}</text>
                <text x={Math.min(hoveredBar.x + 18, Math.max(W, barChartW) - 137)} y={Math.max(hoveredBar.y - 50, 5) + 26} fontSize={9} fill="hsl(150, 55%, 45%)">Approve: {hoveredBar.approve}%</text>
                <text x={Math.min(hoveredBar.x + 18, Math.max(W, barChartW) - 137)} y={Math.max(hoveredBar.y - 50, 5) + 38} fontSize={9} fill="hsl(0, 65%, 50%)">Disapprove: {hoveredBar.disapprove}% (net {hoveredBar.margin > 0 ? "+" : ""}{hoveredBar.margin.toFixed(1)})</text>
              </g>
            )}
          </svg>
        )}

        {viewMode === "trend" && (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[500px]" style={{ maxHeight: 340 }}>
            {yTicks.map((v) =>
              <g key={v}>
                <line x1={trendPAD.left} y1={trendValToY(v)} x2={W - trendPAD.right} y2={trendValToY(v)} stroke="hsl(var(--border))" strokeWidth={0.5} />
                <text x={trendPAD.left - 6} y={trendValToY(v) + 3.5} textAnchor="end" fontSize={10} fill="hsl(var(--muted-foreground))">{v}%</text>
              </g>
            )}
            {minVal < 50 && maxVal > 50 &&
              <line x1={trendPAD.left} y1={trendValToY(50)} x2={W - trendPAD.right} y2={trendValToY(50)} stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />
            }
            {xTicks.map((t) =>
              <text key={t.date} x={trendDateToX(t.date)} y={H - 8} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">{t.label}</text>
            )}
            {Array.from(visibleSources.entries()).map(([sourceId, sourcePolls]) => {
              const src = getSourceInfo(sourceId);
              const color = `hsl(${src.color})`;
              const points = sourcePolls
                .filter((p) => p.approve_pct !== null && p.date_conducted >= trendMinDate)
                .map((p) => ({ x: trendDateToX(p.date_conducted), y: trendValToY(p.approve_pct!), date: p.date_conducted, val: p.approve_pct! }));
              if (points.length < 2) return null;
              const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
              return (
                <g key={sourceId}>
                  <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.8}
                    style={{ strokeDasharray: inView ? "none" : "2000", strokeDashoffset: inView ? 0 : 2000, transition: "stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)" }} />
                  {points.map((p, i) =>
                    <circle key={i} cx={p.x} cy={p.y} r={hoveredPoint?.source === sourceId && hoveredPoint?.date === p.date ? 5 : 3}
                      fill={color} stroke="hsl(var(--card))" strokeWidth={1.5}
                      style={{ cursor: "pointer", opacity: inView ? 1 : 0, transition: `opacity 0.3s ease ${1000 + i * 100}ms` }}
                      onMouseEnter={() => setHoveredPoint({ source: sourceId, date: p.date, value: p.val, x: p.x, y: p.y })}
                      onMouseLeave={() => setHoveredPoint(null)} />
                  )}
                </g>
              );
            })}
            {hoveredPoint && (
              <g>
                <rect x={hoveredPoint.x + 10} y={hoveredPoint.y - 28} width={120} height={32} rx={6} fill="hsl(var(--popover))" stroke="hsl(var(--border))" strokeWidth={1} />
                <text x={hoveredPoint.x + 18} y={hoveredPoint.y - 14} fontSize={10} fontWeight="600" fill="hsl(var(--foreground))">{getSourceInfo(hoveredPoint.source).name}</text>
                <text x={hoveredPoint.x + 18} y={hoveredPoint.y - 2} fontSize={9} fill="hsl(var(--muted-foreground))">{hoveredPoint.value}% · {formatDateShort(hoveredPoint.date)}</text>
              </g>
            )}
          </svg>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3">
        {viewMode === "bars" ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-5 rounded" style={{ backgroundColor: "hsl(150, 55%, 45%)" }} />
              <span className="text-[10px] font-medium text-muted-foreground">Approve</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-5 rounded" style={{ backgroundColor: "hsl(0, 65%, 50%)" }} />
              <span className="text-[10px] font-medium text-muted-foreground">Disapprove</span>
            </div>
          </>
        ) : (
          Array.from(visibleSources.keys()).map((sourceId) => {
            const src = getSourceInfo(sourceId);
            return (
              <div key={sourceId} className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: `hsl(${src.color})` }} />
                <span className="text-[10px] font-medium text-muted-foreground">{src.name}</span>
              </div>
            );
          })
        )}
      </div>
    </div>);
}

// ─── Source Comparison Dot Plot ──────────────────────────────────────────────

function SourceDotPlot({ latestBySource }: {latestBySource: PollEntry[];}) {
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
  const pctToX = (v: number) => LEFT + (v - minPct) / range * plotW;

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
          {[35, 40, 45, 50].map((v) =>
          <g key={v}>
              <line x1={pctToX(v)} y1={15} x2={pctToX(v)} y2={H - 20} stroke="hsl(var(--border))" strokeWidth={0.5} />
              <text x={pctToX(v)} y={H - 5} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">{v}%</text>
            </g>
          )}
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
              </g>);

          })}
        </svg>
      </div>
      <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "hsl(150, 55%, 45%)" }} /> Approve</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "hsl(0, 65%, 50%)" }} /> Disapprove</span>
      </div>
    </div>);

}

// ─── Generic Ballot Comparison Chart ────────────────────────────────────────

function GenericBallotChart({ polls }: {polls: PollEntry[];}) {
  const { ref, inView } = useInView();
  const ballotFilter = useCallback((p: PollEntry) => p.poll_type === "generic_ballot", []);
  const picker = usePollPicker(polls, ballotFilter);

  if (picker.filteredPolls.length === 0) return null;

  // Latest generic ballot per source
  const bySource = new Map<string, PollEntry>();
  picker.filteredPolls.forEach((p) => {
    const ex = bySource.get(p.source);
    if (!ex || p.date_conducted > ex.date_conducted) bySource.set(p.source, p);
  });
  const entries = Array.from(bySource.values()).sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0));

  // Cross-source average
  const getDem = (p: PollEntry) => p.favor_pct ?? p.approve_pct ?? 0;
  const getRep = (p: PollEntry) => p.oppose_pct ?? p.disapprove_pct ?? 0;
  const avgDem = Math.round(entries.reduce((s, p) => s + getDem(p), 0) / entries.length * 10) / 10;
  const avgRep = Math.round(entries.reduce((s, p) => s + getRep(p), 0) / entries.length * 10) / 10;
  const avgMargin = Math.round((avgDem - avgRep) * 10) / 10;
  const avgTotal = avgDem + avgRep || 100;

  return (
    <div ref={ref} className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-display text-sm font-semibold text-foreground">
          Generic Congressional Ballot
        </h3>
        <PollPickerButton showPicker={picker.showPicker} setShowPicker={picker.setShowPicker} isAll={picker.isAll} count={picker.selectedIds.size} />
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {picker.isAll ? `Cross-source average of ${entries.length} polls` : `${picker.selectedIds.size} poll${picker.selectedIds.size !== 1 ? "s" : ""} selected`}
      </p>
      {picker.showPicker && <PollPickerDropdown uniquePolls={picker.uniquePolls} selectedIds={picker.selectedIds} isAll={picker.isAll} toggle={picker.toggle} setSelectedIds={picker.setSelectedIds} />}

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
            style={{ width: inView ? `${avgDem / avgTotal * 100}%` : "0%", backgroundColor: "hsl(210, 80%, 50%)" }}>
            
            <span className="text-[10px] font-bold text-white">{avgDem}%</span>
          </div>
          <div
            className="flex items-center justify-start pl-2 transition-all duration-1000"
            style={{ width: inView ? `${avgRep / avgTotal * 100}%` : "0%", backgroundColor: "hsl(0, 75%, 50%)" }}>
            
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
                  style={{ width: inView ? `${dem / total * 100}%` : "0%", backgroundColor: "hsl(210, 80%, 50%)", transition: `width 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${idx * 80 + 200}ms` }}>
                  
                  <span className="text-[8px] font-bold text-white" style={{ opacity: inView ? 1 : 0, transition: `opacity 0.3s ease ${idx * 80 + 600}ms` }}>{dem}%</span>
                </div>
                <div
                  className="flex items-center justify-start pl-1"
                  style={{ width: inView ? `${rep / total * 100}%` : "0%", backgroundColor: "hsl(0, 75%, 50%)", transition: `width 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${idx * 80 + 300}ms` }}>
                  
                  <span className="text-[8px] font-bold text-white" style={{ opacity: inView ? 1 : 0, transition: `opacity 0.3s ease ${idx * 80 + 600}ms` }}>{rep}%</span>
                </div>
              </div>
            </div>);

        })}
      </div>
    </div>);

}

// ─── Generic Ballot Trend Chart (D vs R over time) ──────────────────────────

function GenericBallotTrendChart({ polls }: {polls: PollEntry[];}) {
  const { ref, inView } = useInView();
  const [hoveredPoint, setHoveredPoint] = useState<{label: string;x: number;y: number;} | null>(null);

  const ballotFilter = useCallback((p: PollEntry) => p.poll_type === "generic_ballot", []);
  const picker = usePollPicker(polls, ballotFilter);

  const getDem = (p: PollEntry) => p.favor_pct ?? p.approve_pct ?? 0;
  const getRep = (p: PollEntry) => p.oppose_pct ?? p.disapprove_pct ?? 0;

  const monthlyAvg = useMemo(() => {
    const buckets = new Map<string, {demSum: number;repSum: number;count: number;}>();
    picker.filteredPolls.forEach((p) => {
      const d = new Date(p.date_conducted + "T00:00:00");
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!buckets.has(key)) buckets.set(key, { demSum: 0, repSum: 0, count: 0 });
      const b = buckets.get(key)!;
      b.demSum += getDem(p);
      b.repSum += getRep(p);
      b.count += 1;
    });
    return Array.from(buckets.entries()).
    map(([month, b]) => ({
      month,
      dem: Math.round(b.demSum / b.count * 10) / 10,
      rep: Math.round(b.repSum / b.count * 10) / 10,
      margin: Math.round((b.demSum - b.repSum) / b.count * 10) / 10
    })).
    sort((a, b) => a.month.localeCompare(b.month));
  }, [picker.filteredPolls]);

  if (monthlyAvg.length < 2) return null;

  const W = 700,H = 280;
  const PAD = { top: 20, right: 40, bottom: 40, left: 45 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const allVals = monthlyAvg.flatMap((m) => [m.dem, m.rep]);
  const minVal = Math.floor(Math.min(...allVals) - 3);
  const maxVal = Math.ceil(Math.max(...allVals) + 3);
  const valRange = maxVal - minVal || 1;

  const xStep = plotW / (monthlyAvg.length - 1);
  const toX = (i: number) => PAD.left + i * xStep;
  const toY = (v: number) => PAD.top + plotH - (v - minVal) / valRange * plotH;

  const yTicks: number[] = [];
  for (let v = Math.ceil(minVal / 5) * 5; v <= maxVal; v += 5) yTicks.push(v);

  const demPath = monthlyAvg.map((m, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(m.dem)}`).join(" ");
  const repPath = monthlyAvg.map((m, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(m.rep)}`).join(" ");

  const areaPath = `${monthlyAvg.map((m, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(m.dem)}`).join(" ")} ${[...monthlyAvg].reverse().map((m, i) => `L${toX(monthlyAvg.length - 1 - i)},${toY(m.rep)}`).join(" ")} Z`;

  const latest = monthlyAvg[monthlyAvg.length - 1];

  return (
    <AnimatedCard>
      <div ref={ref} className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h3 className="font-display text-sm font-semibold text-foreground">Generic Ballot Trend</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {picker.isAll ? "Monthly D vs R average across all sources" : `${picker.selectedIds.size} poll${picker.selectedIds.size !== 1 ? "s" : ""} selected`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PollPickerButton showPicker={picker.showPicker} setShowPicker={picker.setShowPicker} isAll={picker.isAll} count={picker.selectedIds.size} />
            <span className="text-sm font-display font-bold" style={{ color: "hsl(210, 80%, 50%)" }}>D {latest.dem}%</span>
            <span className="text-muted-foreground text-xs">vs</span>
            <span className="text-sm font-display font-bold" style={{ color: "hsl(0, 75%, 50%)" }}>R {latest.rep}%</span>
            <MarginBadge margin={latest.margin} />
          </div>
        </div>
        {picker.showPicker && <PollPickerDropdown uniquePolls={picker.uniquePolls} selectedIds={picker.selectedIds} isAll={picker.isAll} toggle={picker.toggle} setSelectedIds={picker.setSelectedIds} />}
        <div className="overflow-x-auto" style={{ minWidth: 500 }}>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 280 }} onMouseLeave={() => setHoveredPoint(null)}>
            {yTicks.map((v) =>
            <g key={v}>
                <line x1={PAD.left} x2={W - PAD.right} y1={toY(v)} y2={toY(v)} stroke="hsl(var(--border))" strokeWidth={0.5} strokeDasharray={v === 50 ? "0" : "3,3"} />
                <text x={PAD.left - 6} y={toY(v) + 3} textAnchor="end" fontSize={9} fill="hsl(var(--muted-foreground))">{v}%</text>
              </g>
            )}
            {monthlyAvg.map((m, i) =>
            <text key={m.month} x={toX(i)} y={H - PAD.bottom + 20} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">
                {new Date(m.month + "-01T00:00:00").toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
              </text>
            )}
            <path d={areaPath} fill="hsl(270, 50%, 60%)" opacity={0.06} />
            <path d={demPath} fill="none" stroke="hsl(210, 80%, 50%)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: inView ? "0" : "2000", strokeDashoffset: inView ? "0" : "2000", transition: "stroke-dashoffset 1.5s ease" }} />
            <path d={repPath} fill="none" stroke="hsl(0, 75%, 50%)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: inView ? "0" : "2000", strokeDashoffset: inView ? "0" : "2000", transition: "stroke-dashoffset 1.5s ease 0.3s" }} />
            {monthlyAvg.map((m, i) =>
            <g key={m.month}>
                <rect x={toX(i) - xStep / 2} y={PAD.top} width={xStep} height={plotH} fill="transparent"
              onMouseEnter={() => setHoveredPoint({ label: `${new Date(m.month + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" })}: D ${m.dem}% / R ${m.rep}% (${m.margin > 0 ? "D+" : "R+"}${Math.abs(m.margin)})`, x: toX(i), y: Math.min(toY(m.dem), toY(m.rep)) - 12 })} />
                <circle cx={toX(i)} cy={toY(m.dem)} r={3} fill="hsl(210, 80%, 50%)" style={{ opacity: inView ? 1 : 0, transition: `opacity 0.3s ease ${i * 60}ms` }} />
                <circle cx={toX(i)} cy={toY(m.rep)} r={3} fill="hsl(0, 75%, 50%)" style={{ opacity: inView ? 1 : 0, transition: `opacity 0.3s ease ${i * 60 + 300}ms` }} />
              </g>
            )}
            {hoveredPoint &&
            <g>
                <rect x={Math.max(PAD.left, Math.min(hoveredPoint.x - 105, W - PAD.right - 210))} y={hoveredPoint.y - 18} width={210} height={18} rx={4} fill="hsl(var(--popover))" stroke="hsl(var(--border))" strokeWidth={0.5} />
                <text x={Math.max(PAD.left + 105, Math.min(hoveredPoint.x, W - PAD.right - 105))} y={hoveredPoint.y - 6} textAnchor="middle" fontSize={9} fontWeight={600} fill="hsl(var(--popover-foreground))">{hoveredPoint.label}</text>
              </g>
            }
            <text x={toX(monthlyAvg.length - 1) + 6} y={toY(latest.dem) + 3} fontSize={10} fontWeight={700} fill="hsl(210, 80%, 50%)">D {latest.dem}%</text>
            <text x={toX(monthlyAvg.length - 1) + 6} y={toY(latest.rep) + 3} fontSize={10} fontWeight={700} fill="hsl(0, 75%, 50%)">R {latest.rep}%</text>
          </svg>
        </div>
        <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-6 rounded-sm" style={{ backgroundColor: "hsl(210, 80%, 50%)" }} /> Democrat</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-6 rounded-sm" style={{ backgroundColor: "hsl(0, 75%, 50%)" }} /> Republican</span>
          <span className="ml-auto">{monthlyAvg.length} months tracked</span>
        </div>
      </div>
    </AnimatedCard>);

}

// ─── Issue Polling Butterfly Chart ──────────────────────────────────────────

function IssueButterflyChart({ polls }: {polls: PollEntry[];}) {
  const { ref, inView } = useInView();
  const issueFilter = useCallback((p: PollEntry) => p.poll_type === "issue", []);
  const picker = usePollPicker(polls, issueFilter);

  if (picker.filteredPolls.length === 0) return null;

  // Deduplicate: latest per topic across sources
  const byTopic = new Map<string, PollEntry[]>();
  picker.filteredPolls.forEach((p) => {
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
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-display text-sm font-semibold text-foreground">
          Issue Polling Overview
        </h3>
        <PollPickerButton showPicker={picker.showPicker} setShowPicker={picker.setShowPicker} isAll={picker.isAll} count={picker.selectedIds.size} />
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {picker.isAll ? "Approve vs disapprove on key issues (butterfly chart)" : `${picker.selectedIds.size} poll${picker.selectedIds.size !== 1 ? "s" : ""} selected`}
      </p>
      {picker.showPicker && <PollPickerDropdown uniquePolls={picker.uniquePolls} selectedIds={picker.selectedIds} isAll={picker.isAll} toggle={picker.toggle} setSelectedIds={picker.setSelectedIds} />}
      <div className="space-y-3">
        {topics.map(([topic, topicPolls], idx) => {
          // Average across sources for the topic
          const avgApprove = topicPolls.reduce((s, p) => s + (p.approve_pct ?? p.favor_pct ?? 0), 0) / topicPolls.length;
          const avgDisapprove = topicPolls.reduce((s, p) => s + (p.disapprove_pct ?? p.oppose_pct ?? 0), 0) / topicPolls.length;
          const margin = avgApprove - avgDisapprove;
          const maxBar = 80; // max percentage width
          const approveW = avgApprove / maxBar * 100;
          const disapproveW = avgDisapprove / maxBar * 100;
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
                      transition: `all 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${idx * 80 + 200}ms`
                    }}>
                    
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
                      transition: `all 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${idx * 80 + 300}ms`
                    }}>
                    
                    <span className="text-[10px] font-bold text-white" style={{ opacity: inView ? 1 : 0, transition: `opacity 0.3s ease ${idx * 80 + 600}ms` }}>{Math.round(avgDisapprove)}%</span>
                  </div>
                </div>
              </div>
            </div>);

        })}
      </div>
      <div className="flex items-center justify-center gap-6 mt-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-8 rounded-sm" style={{ backgroundColor: "hsl(150, 55%, 45%)" }} /> Approve / Favor</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-8 rounded-sm" style={{ backgroundColor: "hsl(0, 65%, 50%)" }} /> Disapprove / Oppose</span>
      </div>
    </div>);

}

// ─── Approval Gauge ─────────────────────────────────────────────────────────

function ApprovalGauge({ approve, disapprove, margin }: {approve: number;disapprove: number;margin: number;}) {
  const { ref, inView } = useInView();
  const radius = 60;
  const strokeW = 12;
  const cx = 80;
  const cy = 80;
  const circumference = Math.PI * radius; // half circle
  const approveArc = inView ? approve / 100 * circumference : 0;
  const disapproveArc = inView ? disapprove / 100 * circumference : 0;

  return (
    <div ref={ref} className="flex flex-col items-center">
      <svg width={160} height={100} viewBox="0 0 160 100">
        {/* Background arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeW}
          strokeLinecap="round" />
        
        {/* Approve arc (from left) */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="hsl(150, 55%, 45%)"
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={`${approveArc} ${circumference}`}
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.4, 0, 0.2, 1)" }} />
        
        {/* Disapprove arc (from right) */}
        <path
          d={`M ${cx + radius} ${cy} A ${radius} ${radius} 0 0 0 ${cx - radius} ${cy}`}
          fill="none"
          stroke="hsl(0, 65%, 50%)"
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={`${disapproveArc} ${circumference}`}
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.4, 0, 0.2, 1) 0.2s" }} />
        
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
    </div>);

}

// ─── Favorability Trend Chart ───────────────────────────────────────────────

function FavorabilityChart({ polls }: {polls: PollEntry[];}) {
  const { ref, inView } = useInView();
  const [zoomMonths, setZoomMonths] = useState<number>(0);

  const favFilter = useCallback((p: PollEntry) => p.poll_type === "favorability", []);
  const picker = usePollPicker(polls, favFilter);

  const favPolls = picker.filteredPolls.filter((p) => p.poll_type === "favorability");
  if (favPolls.length < 2) return null;

  const allSorted = [...favPolls].sort((a, b) => a.date_conducted.localeCompare(b.date_conducted));
  const absoluteMax = allSorted[allSorted.length - 1].date_conducted;

  let minDateStr = allSorted[0].date_conducted;
  if (zoomMonths > 0) {
    const cutoff = new Date(absoluteMax);
    cutoff.setMonth(cutoff.getMonth() - zoomMonths);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    if (cutoffStr > allSorted[0].date_conducted) minDateStr = cutoffStr;
  }
  const sorted = allSorted.filter((p) => p.date_conducted >= minDateStr);
  if (sorted.length < 2) return null;

  const latest = sorted[sorted.length - 1];

  // Build chart data — aggregate by date (average if multiple polls same day)
  const byDate = new Map<string, { fav: number[]; unfav: number[]; sources: string[] }>();
  sorted.forEach((p) => {
    const entry = byDate.get(p.date_conducted) ?? { fav: [], unfav: [], sources: [] };
    if (p.favor_pct != null) entry.fav.push(p.favor_pct);
    if (p.oppose_pct != null) entry.unfav.push(p.oppose_pct);
    entry.sources.push(getSourceInfo(p.source).name);
    byDate.set(p.date_conducted, entry);
  });

  const chartData = Array.from(byDate.entries()).map(([date, v]) => ({
    date,
    dateLabel: new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }),
    favorable: Math.round(v.fav.reduce((a, b) => a + b, 0) / v.fav.length * 10) / 10,
    unfavorable: Math.round(v.unfav.reduce((a, b) => a + b, 0) / v.unfav.length * 10) / 10,
    sources: v.sources.join(", "),
  }));

  const zoomOptions = [
    { label: "All", value: 0 },
    { label: "3M", value: 3 },
    { label: "6M", value: 6 },
    { label: "1Y", value: 12 },
    { label: "2Y", value: 24 },
  ];

  return (
    <AnimatedCard>
      <div ref={ref} className="rounded-xl border border-border bg-card p-5 shadow-sm text-left h-full">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h3 className="font-display text-sm font-semibold text-foreground">Favorability Tracking</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {picker.isAll
                ? `${sorted.length} data points from ${new Set(sorted.map((p) => p.source)).size} sources`
                : `${picker.selectedIds.size} poll${picker.selectedIds.size !== 1 ? "s" : ""} selected`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-display font-bold" style={{ color: "hsl(150, 55%, 45%)" }}>Fav {latest.favor_pct}%</span>
            <span className="text-muted-foreground text-xs">vs</span>
            <span className="text-sm font-display font-bold" style={{ color: "hsl(0, 65%, 50%)" }}>Unfav {latest.oppose_pct}%</span>
            <MarginBadge margin={(latest.favor_pct ?? 0) - (latest.oppose_pct ?? 0)} />
          </div>
        </div>
        <div className="flex items-center gap-1 flex-wrap mb-3">
          <PollPickerButton showPicker={picker.showPicker} setShowPicker={picker.setShowPicker} isAll={picker.isAll} count={picker.selectedIds.size} />
          {zoomOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setZoomMonths(opt.value)}
              className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${
                zoomMonths === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {picker.showPicker && (
          <PollPickerDropdown
            uniquePolls={picker.uniquePolls}
            selectedIds={picker.selectedIds}
            isAll={picker.isAll}
            toggle={picker.toggle}
            setSelectedIds={picker.setSelectedIds}
          />
        )}
        <div className="w-full" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="favGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(150, 55%, 45%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(150, 55%, 45%)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="unfavGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 65%, 50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(0, 65%, 50%)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={["dataMin - 5", "dataMax + 5"]}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickFormatter={(v: number) => `${v}%`}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 11,
                  color: "hsl(var(--popover-foreground))",
                }}
                labelFormatter={(label: string) => label}
                formatter={(value: number, name: string) => [
                  `${value}%`,
                  name === "favorable" ? "Favorable" : "Unfavorable",
                ]}
              />
              <ReferenceLine y={50} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 3" opacity={0.4} />
              <Area
                type="monotone"
                dataKey="favorable"
                stroke="hsl(150, 55%, 45%)"
                strokeWidth={2.5}
                fill="url(#favGrad)"
                dot={{ r: 3, fill: "hsl(150, 55%, 45%)", strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--background))" }}
                isAnimationActive={inView}
                animationDuration={1500}
              />
              <Area
                type="monotone"
                dataKey="unfavorable"
                stroke="hsl(0, 65%, 50%)"
                strokeWidth={2.5}
                fill="url(#unfavGrad)"
                dot={{ r: 3, fill: "hsl(0, 65%, 50%)", strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--background))" }}
                isAnimationActive={inView}
                animationDuration={1500}
                animationBegin={300}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-6 rounded-sm" style={{ backgroundColor: "hsl(150, 55%, 45%)" }} /> Favorable</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-6 rounded-sm" style={{ backgroundColor: "hsl(0, 65%, 50%)" }} /> Unfavorable</span>
          <span className="ml-auto">{sorted.length} data points tracked</span>
        </div>
      </div>
    </AnimatedCard>
  );
}

// ─── Demographic Breakdown Chart ────────────────────────────────────────────

const DEMO_GROUPS = [
{ id: "party", label: "Party ID", colors: { Republican: "hsl(0, 75%, 50%)", Independent: "hsl(45, 80%, 50%)", Democrat: "hsl(210, 80%, 50%)" } },
{ id: "age", label: "Age", colors: {} },
{ id: "gender", label: "Gender", colors: {} },
{ id: "race", label: "Race/Ethnicity", colors: {} },
{ id: "education", label: "Education", colors: {} },
{ id: "region", label: "Region", colors: {} }] as
const;

type DemoEntry = {demographic: string;approve: number;disapprove: number;margin: number;count: number;};

function DemographicBreakdownChart({ polls }: {polls: PollEntry[];}) {
  const { ref, inView } = useInView();
  const [activeGroup, setActiveGroup] = useState<string>("party");
  const [selectedPollIds, setSelectedPollIds] = useState<Set<string>>(new Set()); // empty = all
  const [showPollPicker, setShowPollPicker] = useState(false);

  // Get all polls that have demographic data
  const demoPollsList = useMemo(() => {
    const seen = new Map<string, {id: string;source: string;date: string;topic: string;}>();
    polls.forEach((p) => {
      const rd = p.raw_data as any;
      if (!rd || !rd.demographic || !rd.group_type) return;
      const key = `${p.source}|${p.date_conducted}`;
      if (!seen.has(key)) {
        seen.set(key, { id: key, source: p.source, date: p.date_conducted, topic: p.candidate_or_topic });
      }
    });
    return [...seen.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [polls]);

  const isAllSelected = selectedPollIds.size === 0;

  const filteredPolls = useMemo(() => {
    if (isAllSelected) return polls;
    return polls.filter((p) => {
      const key = `${p.source}|${p.date_conducted}`;
      return selectedPollIds.has(key);
    });
  }, [polls, selectedPollIds, isAllSelected]);

  const togglePoll = (id: string) => {
    setSelectedPollIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);else
      next.add(id);
      return next;
    });
  };

  // Extract polls that have demographic raw_data
  const demoData = useMemo(() => {
    const map = new Map<string, Map<string, {totalApprove: number;totalDisapprove: number;count: number;}>>();
    filteredPolls.forEach((p) => {
      const rd = p.raw_data as any;
      if (!rd || !rd.demographic || !rd.group_type) return;
      if (!map.has(rd.group_type)) map.set(rd.group_type, new Map());
      const group = map.get(rd.group_type)!;
      if (!group.has(rd.demographic)) group.set(rd.demographic, { totalApprove: 0, totalDisapprove: 0, count: 0 });
      const entry = group.get(rd.demographic)!;
      entry.totalApprove += p.approve_pct ?? 0;
      entry.totalDisapprove += p.disapprove_pct ?? 0;
      entry.count += 1;
    });
    const result = new Map<string, DemoEntry[]>();
    map.forEach((demos, groupType) => {
      const entries: DemoEntry[] = [];
      demos.forEach((val, demo) => {
        const approve = Math.round(val.totalApprove / val.count);
        const disapprove = Math.round(val.totalDisapprove / val.count);
        entries.push({ demographic: demo, approve, disapprove, margin: approve - disapprove, count: val.count });
      });
      entries.sort((a, b) => b.margin - a.margin);
      result.set(groupType, entries);
    });
    return result;
  }, [filteredPolls]);

  const entries = demoData.get(activeGroup) ?? [];
  if (demoPollsList.length === 0) return null;

  const maxVal = Math.max(...entries.flatMap((e) => [e.approve, e.disapprove]), 100);
  const groupConfig = DEMO_GROUPS.find((g) => g.id === activeGroup);

  const activeSourceCount = new Set(filteredPolls.filter((p) => {
    const rd = p.raw_data as any;
    return rd?.group_type === activeGroup;
  }).map((p) => p.source)).size;

  return (
    <AnimatedCard>
      <div ref={ref} className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="font-display text-sm font-semibold text-foreground">
              Demographic Breakdown — Approval
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isAllSelected ? "Cross-source average" : `${selectedPollIds.size} poll${selectedPollIds.size !== 1 ? "s" : ""} selected`} by demographic group
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowPollPicker(!showPollPicker)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold border transition-colors flex items-center gap-1 ${
              showPollPicker ?
              "bg-primary text-primary-foreground border-primary" :
              "bg-muted text-muted-foreground border-border hover:bg-muted/80"}`
              }>
              
              <Filter className="h-3 w-3" />
              Polls {!isAllSelected && `(${selectedPollIds.size})`}
            </button>
            <div className="flex flex-wrap gap-1">
              {DEMO_GROUPS.filter((g) => demoData.has(g.id)).map((g) =>
              <button
                key={g.id}
                onClick={() => setActiveGroup(g.id)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold border transition-colors ${
                activeGroup === g.id ?
                "bg-foreground text-background border-foreground" :
                "bg-muted text-muted-foreground border-border hover:bg-muted/80"}`
                }>
                
                  {g.label}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Poll picker */}
        {showPollPicker &&
        <div className="mb-4 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Select Polls</span>
              <div className="flex gap-2">
                <button
                onClick={() => setSelectedPollIds(new Set())}
                className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors ${
                isAllSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`
                }>
                
                  All
                </button>
                <button
                onClick={() => setSelectedPollIds(new Set(demoPollsList.map((p) => p.id)))}
                className="text-[10px] font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground hover:bg-accent transition-colors">
                
                  Select All
                </button>
                <button
                onClick={() => setSelectedPollIds(new Set())}
                className="text-[10px] font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground hover:bg-accent transition-colors">
                
                  Clear
                </button>
              </div>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 max-h-40 overflow-y-auto">
              {demoPollsList.map((poll) => {
              const checked = isAllSelected || selectedPollIds.has(poll.id);
              return (
                <label
                  key={poll.id}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors text-xs ${
                  checked && !isAllSelected ? "bg-primary/10 border border-primary/30" : "bg-card border border-border hover:bg-muted/50"}`
                  }>
                  
                    <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePoll(poll.id)}
                    className="accent-[hsl(var(--primary))] h-3 w-3 shrink-0" />
                  
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-foreground">{getSourceInfo(poll.source).name}</span>
                      <span className="text-muted-foreground ml-1">{formatDate(poll.date)}</span>
                    </div>
                  </label>);

            })}
            </div>
          </div>
        }

        {entries.length === 0 ?
        <p className="text-xs text-muted-foreground text-center py-6">No demographic data for selected polls in this group.</p> :

        <div className="space-y-2">
            {entries.map((entry, i) => {
            const partyColors = (groupConfig as any)?.colors ?? {};
            const barColor = partyColors[entry.demographic] ?? `hsl(${210 + i * 40}, 60%, 50%)`;
            const approveW = entry.approve / maxVal * 100;
            const disapproveW = entry.disapprove / maxVal * 100;

            return (
              <div
                key={entry.demographic}
                className="transition-all duration-500"
                style={{
                  opacity: inView ? 1 : 0,
                  transform: inView ? "translateX(0)" : "translateX(-20px)",
                  transitionDelay: `${i * 60}ms`
                }}>
                
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-foreground w-28 shrink-0 text-right">
                      {entry.demographic}
                    </span>
                    <div className="flex-1 flex items-center gap-1">
                      <div className="flex h-5 flex-1 overflow-hidden rounded bg-muted/40">
                        <div
                        className="h-full rounded-l transition-all duration-700 flex items-center justify-end pr-1"
                        style={{ width: `${approveW}%`, backgroundColor: "hsl(150, 55%, 45%)" }}>
                        
                          {approveW > 12 && <span className="text-[9px] font-bold text-white">{entry.approve}%</span>}
                        </div>
                        <div
                        className="h-full rounded-r transition-all duration-700 flex items-center pl-1"
                        style={{ width: `${disapproveW}%`, backgroundColor: "hsl(0, 65%, 50%)" }}>
                        
                          {disapproveW > 12 && <span className="text-[9px] font-bold text-white">{entry.disapprove}%</span>}
                        </div>
                      </div>
                      <MarginBadge margin={entry.margin} />
                    </div>
                  </div>
                </div>);

          })}
          </div>
        }

        <div className="flex items-center gap-4 mt-4 text-[10px] text-muted-foreground border-t border-border pt-3">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-6 rounded-sm" style={{ backgroundColor: "hsl(150, 55%, 45%)" }} /> Approve
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-6 rounded-sm" style={{ backgroundColor: "hsl(0, 65%, 50%)" }} /> Disapprove
          </span>
          <span className="ml-auto">
            {isAllSelected ? `Averaged across ${activeSourceCount} sources` : `From ${selectedPollIds.size} selected poll${selectedPollIds.size !== 1 ? "s" : ""}`}
          </span>
        </div>
      </div>
    </AnimatedCard>);

}

// ─── Main Component ─────────────────────────────────────────────────────────

export function PollingSection() {
  const [polls, setPolls] = useState<PollEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"polling" | "markets">("polling");

  useEffect(() => {
    loadPolls();
  }, []);

  async function loadPolls() {
    setLoading(true);
    const data = await fetchPollingData();
    setPolls(data);
    setLoading(false);
  }

  const [syncing, setSyncing] = useState(false);

  async function seedData() {
    setSeeding(true);
    try {
      await supabase.functions.invoke("seed-polling", { body: { force: true } });
      await loadPolls();
    } catch (e) {
      console.error("Seed error:", e);
    }
    setSeeding(false);
  }

  async function syncLiveSources() {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("polling-sync", {
        body: { maxSources: 8 },
      });
      console.log("Polling sync result:", data);
      if (error) console.error("Sync error:", error);
      await loadPolls();
    } catch (e) {
      console.error("Sync error:", e);
    }
    setSyncing(false);
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
      </div>);

  }

  if (polls.length === 0) {
    return (
      <div className="text-center py-16">
        <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground mb-4">No polling data available yet.</p>
        <button
          onClick={seedData}
          disabled={seeding}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
          
          {seeding ?
          <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Seeding data…
            </> :

          <>
              <RefreshCw className="h-3.5 w-3.5" />
              Load polling data from all sources
            </>
          }
        </button>
      </div>);

  }

  return (
    <div className="space-y-6">
      {/* Tab Toggle */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1 w-fit">
        <button
          onClick={() => setActiveTab("polling")}
          className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${activeTab === "polling" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          📊 Polling Data
        </button>
        <button
          onClick={() => setActiveTab("markets")}
          className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${activeTab === "markets" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          📈 Prediction Markets
        </button>
      </div>

      {activeTab === "markets" ? (
        <Suspense fallback={<div className="flex items-center justify-center py-20"><span className="text-sm text-muted-foreground">Loading prediction markets…</span></div>}>
          <PredictionMarketsPanel />
        </Suspense>
      ) : (
      <>
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
                sourceFilter === "all" ?
                "bg-foreground text-background border-foreground" :
                "bg-muted text-muted-foreground border-border hover:bg-muted/80"}`
                }>
                
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
                      borderColor: isActive ? `hsl(${s.color})` : `hsl(${s.color} / 0.25)`
                    }}>
                    
                  {s.name}
                </button>);

              })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Type:</span>
          <div className="flex flex-wrap gap-1">
            <button
                onClick={() => setTypeFilter("all")}
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold border transition-colors ${
                typeFilter === "all" ?
                "bg-foreground text-background border-foreground" :
                "bg-muted text-muted-foreground border-border hover:bg-muted/80"}`
                }>
                
              All
            </button>
            {POLL_TYPES.map((t) =>
              <button
                key={t.id}
                onClick={() => setTypeFilter(typeFilter === t.id ? "all" : t.id)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold border transition-colors ${
                typeFilter === t.id ?
                "bg-foreground text-background border-foreground" :
                "bg-muted text-muted-foreground border-border hover:bg-muted/80"}`
                }>
                
                {t.label}
              </button>
              )}
          </div>
        </div>
       </div>
       {/* Update + Export Buttons */}
       <div className="flex items-center gap-1.5 shrink-0">
         <button
            onClick={syncLiveSources}
            disabled={syncing || seeding}
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/5 px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent/10 transition-colors shadow-sm disabled:opacity-50"
            title="Scrape live polling data from 20+ sources">
            
           <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
           {syncing ? "Syncing…" : "Sync Live"}
         </button>
         <button
            onClick={seedData}
            disabled={seeding || syncing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors shadow-sm disabled:opacity-50"
            title="Update polling data from all sources">
            
           <RefreshCw className={`h-3.5 w-3.5 ${seeding ? "animate-spin" : ""}`} />
           {seeding ? "Updating…" : "Update Data"}
         </button>
         <button
            onClick={() => exportPollingCSV(filtered)}
            className="win98-button text-[10px] flex items-center gap-1"
            title="Export as CSV">
            
           <FileSpreadsheet className="h-3 w-3" />
           CSV
         </button>
         <button
            onClick={() => exportPollingPDF(filtered)}
            className="win98-button text-[10px] flex items-center gap-1"
            title="Export as PDF">
            
           <FileText className="h-3 w-3" />
           PDF
         </button>
       </div>
      </div>

      {/* ─── Summary Cards with Gauge ──────────────────────────────────────── */}
      {avgApproval &&
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

          {/* Generic ballot cross-source average */}
          {genericBallotPolls.length > 0 && (() => {
          const validPolls = genericBallotPolls.filter((p) => p.favor_pct != null && p.oppose_pct != null);
          if (validPolls.length === 0) return null;
          const avgDem = Math.round(validPolls.reduce((s, p) => s + (p.favor_pct ?? 0), 0) / validPolls.length * 10) / 10;
          const avgRep = Math.round(validPolls.reduce((s, p) => s + (p.oppose_pct ?? 0), 0) / validPolls.length * 10) / 10;
          const avgMargin = Math.round((avgDem - avgRep) * 10) / 10;
          const total = avgDem + avgRep || 100;
          const sourceCount = new Set(validPolls.map((p) => p.source)).size;
          return (
            <AnimatedCard delay={100}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Generic Ballot (Avg of {sourceCount} source{sourceCount !== 1 ? "s" : ""})
                </p>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-2xl font-display font-bold" style={{ color: "hsl(210, 80%, 50%)" }}>
                    D {avgDem}%
                  </span>
                  <span className="text-muted-foreground">vs</span>
                  <span className="text-2xl font-display font-bold" style={{ color: "hsl(0, 75%, 50%)" }}>
                    R {avgRep}%
                  </span>
                </div>
                <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted mb-2">
                  <div className="transition-all duration-500" style={{ width: `${avgDem / total * 100}%`, backgroundColor: "hsl(210, 80%, 50%)" }} />
                  <div className="transition-all duration-500" style={{ width: `${avgRep / total * 100}%`, backgroundColor: "hsl(0, 75%, 50%)" }} />
                </div>
                <MarginBadge margin={avgMargin} />
                <p className="text-[10px] text-muted-foreground mt-2">
                  Cross-source average · {validPolls.length} poll{validPolls.length !== 1 ? "s" : ""}
                </p>
              </AnimatedCard>);

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
                const pct = count / polls.length * 100;
                return (
                  <div key={t.id}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-muted-foreground">{t.label}</span>
                      <span className="font-bold text-foreground">{count}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary/60 transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>);

              })}
            </div>
          </div>
          </AnimatedCard>
        </div>
      }

      {/* ─── Multi-Source Trend Chart ─────────────────────────────────────── */}
      <MultiSourceTrendChart polls={polls} />

      {/* ─── Charts Row: Dot Plot + Issue Butterfly ────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SourceDotPlot latestBySource={latestBySource} />
        <IssueButterflyChart polls={issuePolls} />
      </div>

      {/* ─── Generic Ballot + Favorability ────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <GenericBallotChart polls={genericBallotPolls} />
        <FavorabilityChart polls={polls} />
      </div>

      {/* ─── Generic Ballot Trend ─────────────────────────────────────────── */}
      <GenericBallotTrendChart polls={genericBallotPolls} />

      {/* ─── Demographic Breakdown ───────────────────────────────────────── */}
      <DemographicBreakdownChart polls={polls} />

      {/* ─── Issue Polling Deep Dive ──────────────────────────────────────── */}
      <IssuePollingSection polls={polls} />

      {/* ─── Source Comparison Table ──────────────────────────────────────── */}
      {latestBySource.length > 0 &&
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
                          {poll.partisan_lean &&
                        <span className="text-[9px] rounded-sm px-1.5 py-0.5 bg-muted text-muted-foreground font-medium">{poll.partisan_lean}</span>
                        }
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
                        {poll.sample_type && poll.sample_type !== "Average" &&
                      <span className="ml-1 text-muted-foreground/60">({poll.sample_type})</span>
                      }
                      </td>
                      <td className="py-3 px-3 text-center text-xs text-muted-foreground">
                        {formatDate(poll.date_conducted)}
                        {poll.end_date && poll.end_date !== poll.date_conducted &&
                      <span> – {formatDate(poll.end_date)}</span>
                      }
                      </td>
                      <td className="py-3 px-3">
                        {poll.source_url &&
                      <a href={poll.source_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                      }
                      </td>
                    </tr>);

              })}
              </tbody>
            </table>
          </div>
        </div>
      }

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
            className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-50 transition-colors">
            
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
                  </tr>);

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
          {POLLING_SOURCES.map((s) =>
          <a
            key={s.id}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-border p-2.5 hover:bg-muted/50 transition-colors group">
            
              <span className="inline-block h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: `hsl(${s.color})` }} />
              <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">{s.name}</span>
              <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
            </a>
          )}
        </div>
      </div>
    </>
      )}
    </div>);

}