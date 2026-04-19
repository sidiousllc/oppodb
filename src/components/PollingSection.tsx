import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from "react";
import { fetchPollingData, getSourceInfo, POLLING_SOURCES, POLL_TYPES, type PollEntry } from "@/data/pollingData";
import IssuePollingSection from "@/components/IssuePollingSection";
import { PollDetailWindow } from "@/components/PollDetailWindow";
const PredictionMarketsPanel = lazy(() => import("@/components/PredictionMarketsPanel"));
import { CampaignFinanceSection } from "@/components/CampaignFinanceSection";
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
      className={`win98-button text-[9px] flex items-center gap-1 ${showPicker ? "font-bold bg-white" : ""}`
      }>
      
      <Filter className="h-3 w-3" />
      Polls {!isAll && `(${count})`}
    </button>);

}

export function PollPickerDropdown({ uniquePolls, selectedIds, isAll, toggle, setSelectedIds





}: {uniquePolls: {id: string;source: string;date: string;topic: string;}[];selectedIds: Set<string>;isAll: boolean;toggle: (id: string) => void;setSelectedIds: (v: Set<string>) => void;}) {
  return (
    <div className="mb-3 win98-sunken bg-[hsl(var(--win98-light))] p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Select Polls</span>
        <div className="flex gap-2">
          <button onClick={() => setSelectedIds(new Set())} className={`win98-button text-[9px] ${isAll ? "font-bold bg-white" : ""}`}>All</button>
          <button onClick={() => setSelectedIds(new Set(uniquePolls.map((p) => p.id)))} className="text-[10px] font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground hover:bg-accent transition-colors">Select All</button>
          <button onClick={() => setSelectedIds(new Set())} className="text-[10px] font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground hover:bg-accent transition-colors">Clear</button>
        </div>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 max-h-40 overflow-y-auto">
        {uniquePolls.map((poll) => {
          const checked = isAll || selectedIds.has(poll.id);
          return (
            <label key={poll.id} className={`flex items-center gap-2 px-1.5 py-1 cursor-pointer text-[10px] ${checked && !isAll ? "bg-white win98-sunken" : "bg-[hsl(var(--win98-face))] win98-raised hover:bg-[hsl(var(--win98-light))]"}`}>
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

function MultiSourceTrendChart({ polls, onSelectPoll }: {polls: PollEntry[]; onSelectPoll?: (p: PollEntry) => void;}) {
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
    <div ref={ref} className="candidate-card p-4">
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
          <div className="flex gap-0.5 mr-1">
            <button onClick={() => setViewMode("bars")} className={`win98-button text-[9px] ${viewMode === "bars" ? "font-bold bg-white" : ""}`}>By Source</button>
            <button onClick={() => setViewMode("trend")} className={`win98-button text-[9px] ${viewMode === "trend" ? "font-bold bg-white" : ""}`}>Trend</button>
          </div>
          <PollPickerButton showPicker={picker.showPicker} setShowPicker={picker.setShowPicker} isAll={picker.isAll} count={picker.selectedIds.size} />
          {viewMode === "bars" && sortOptions.map((opt) =>
            <button key={opt.value} onClick={() => setSortBy(opt.value)} className={`win98-button text-[9px] ${sortBy === opt.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>{opt.label}</button>
          )}
          {viewMode === "trend" && zoomOptions.map((opt) =>
            <button key={opt.value} onClick={() => setZoomMonths(opt.value)} className={`win98-button text-[9px] ${zoomMonths === opt.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>{opt.label}</button>
          )}
          <button onClick={() => setShowFilters(!showFilters)} className={`ml-1 p-1 rounded transition-colors ${showFilters ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`} title="Filter sources">
            <Filter className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {picker.showPicker && <PollPickerDropdown uniquePolls={picker.uniquePolls} selectedIds={picker.selectedIds} isAll={picker.isAll} toggle={picker.toggle} setSelectedIds={picker.setSelectedIds} />}

      {showFilters &&
        <div className="mb-3 p-2 win98-sunken bg-[hsl(var(--win98-light))]">
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
                <button key={id} onClick={() => toggleSource(id)} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium transition-all ${active ? "bg-white border-2 border-[hsl(var(--win98-shadow))]" : "opacity-40 bg-[hsl(var(--win98-face))]"}`}>
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
                <g key={sourceId} onMouseEnter={() => setHoveredBar({ source: sourceId, approve, disapprove, margin: approve - disapprove, x: groupX + barGroupW / 2, y: valToY(Math.max(approve, disapprove)) })} onMouseLeave={() => setHoveredBar(null)} onClick={() => onSelectPoll?.(poll)} style={{ cursor: "pointer" }}>
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
    <div className="candidate-card p-4">
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
    <div ref={ref} className="candidate-card p-4">
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
      <div className="mb-3 win98-sunken bg-[hsl(var(--win98-light))] p-2">
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
      <div ref={ref} className="candidate-card p-5">
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

function IssueButterflyChart({ polls, onSelectPoll }: {polls: PollEntry[]; onSelectPoll?: (p: PollEntry) => void;}) {
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
    <div ref={ref} className="candidate-card p-4">
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
            <div key={topic} className="group cursor-pointer" onClick={() => onSelectPoll?.(topicPolls[0])} style={{ opacity: inView ? 1 : 0, transform: inView ? "translateY(0)" : "translateY(10px)", transition: `all 0.5s ease ${idx * 80}ms` }}>
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
      <div ref={ref} className="candidate-card p-5 text-left h-full">
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
              className={`win98-button text-[9px] ${
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
                  borderRadius: 0,
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
  { id: "age", label: "Age", colors: { "18-29": "hsl(200, 70%, 50%)", "30-49": "hsl(160, 60%, 45%)", "50-64": "hsl(35, 70%, 50%)", "65+": "hsl(0, 55%, 50%)" } },
  { id: "gender", label: "Gender", colors: { Men: "hsl(210, 65%, 50%)", Women: "hsl(330, 65%, 50%)" } },
  { id: "race", label: "Race/Ethnicity", colors: { White: "hsl(30, 40%, 55%)", Black: "hsl(260, 55%, 50%)", "Hispanic/Latino": "hsl(15, 70%, 50%)", Asian: "hsl(180, 55%, 45%)" } },
  { id: "education", label: "Education", colors: { "College Grad+": "hsl(220, 65%, 50%)", "Some College": "hsl(150, 50%, 45%)", "No College": "hsl(35, 60%, 50%)" } },
  { id: "region", label: "Region", colors: { Northeast: "hsl(210, 70%, 50%)", Midwest: "hsl(150, 55%, 45%)", South: "hsl(0, 60%, 50%)", West: "hsl(45, 70%, 50%)" } },
] as const;

type DemoEntry = { demographic: string; approve: number; disapprove: number; margin: number; count: number };

function DemoRingChart({ entries, groupColors }: { entries: DemoEntry[]; groupColors: Record<string, string> }) {
  if (entries.length === 0) return null;
  const cx = 70, cy = 70, r = 55, strokeW = 14;
  const circumference = 2 * Math.PI * r;
  const total = entries.length;
  const segmentArc = circumference / total;
  const gap = 4;

  return (
    <div className="flex flex-col items-center">
      <svg width={140} height={140} viewBox="0 0 140 140">
        {entries.map((entry, i) => {
          const color = groupColors[entry.demographic] || `hsl(${210 + i * 50}, 60%, 50%)`;
          const approveRatio = entry.approve / 100;
          const arcLen = (segmentArc - gap) * approveRatio;
          const offset = i * segmentArc + gap / 2;
          const rotation = -90 + (offset / circumference) * 360;
          return (
            <g key={entry.demographic}>
              {/* Background arc */}
              <circle
                cx={cx} cy={cy} r={r}
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth={strokeW}
                strokeDasharray={`${segmentArc - gap} ${circumference - segmentArc + gap}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${cx} ${cy})`}
                opacity={0.3}
              />
              {/* Filled arc */}
              <circle
                cx={cx} cy={cy} r={r}
                fill="none"
                stroke={color}
                strokeWidth={strokeW}
                strokeDasharray={`${arcLen} ${circumference - arcLen}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${cx} ${cy})`}
                strokeLinecap="round"
                style={{ transition: "stroke-dasharray 0.8s ease" }}
              />
            </g>
          );
        })}
        {/* Center label */}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={18} fontWeight={800} fill="hsl(var(--foreground))">
          {Math.round(entries.reduce((s, e) => s + e.approve, 0) / entries.length)}%
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">
          avg approve
        </text>
      </svg>
      {/* Mini legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-2">
        {entries.map((entry, i) => {
          const color = groupColors[entry.demographic] || `hsl(${210 + i * 50}, 60%, 50%)`;
          return (
            <span key={entry.demographic} className="flex items-center gap-1 text-[9px] text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              {entry.demographic}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function DemographicBreakdownChart({ polls, onSelectPoll }: { polls: PollEntry[]; onSelectPoll?: (p: PollEntry) => void }) {
  const { ref, inView } = useInView();
  const [activeGroup, setActiveGroup] = useState<string>("party");
  const [selectedPollIds, setSelectedPollIds] = useState<Set<string>>(new Set());
  const [showPollPicker, setShowPollPicker] = useState(false);

  const demoPollsList = useMemo(() => {
    const seen = new Map<string, { id: string; source: string; date: string; topic: string }>();
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
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const demoData = useMemo(() => {
    const map = new Map<string, Map<string, { totalApprove: number; totalDisapprove: number; count: number }>>();
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
  const groupColors = (groupConfig as any)?.colors ?? {};

  const activeSourceCount = new Set(filteredPolls.filter((p) => {
    const rd = p.raw_data as any;
    return rd?.group_type === activeGroup;
  }).map((p) => p.source)).size;

  // Compute the widest margin gap for the summary
  const biggestGap = entries.length > 0 ? entries.reduce((max, e) => Math.abs(e.margin) > Math.abs(max.margin) ? e : max, entries[0]) : null;

  return (
    <AnimatedCard>
      <div ref={ref} className="candidate-card p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="font-display text-sm font-semibold text-foreground flex items-center gap-2">
              📊 Demographic Breakdown — Approval
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isAllSelected ? `Cross-source average from ${activeSourceCount} source${activeSourceCount !== 1 ? "s" : ""}` : `${selectedPollIds.size} poll${selectedPollIds.size !== 1 ? "s" : ""} selected`} by demographic group
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowPollPicker(!showPollPicker)}
              className={`win98-button text-[9px] flex items-center gap-1 ${showPollPicker ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border hover:bg-muted/80"}`}
            >
              <Filter className="h-3 w-3" />
              Polls {!isAllSelected && `(${selectedPollIds.size})`}
            </button>
            <div className="flex flex-wrap gap-1">
              {DEMO_GROUPS.filter((g) => demoData.has(g.id)).map((g) => (
                <button
                  key={g.id}
                  onClick={() => setActiveGroup(g.id)}
                  className={`win98-button px-2.5 py-1 text-[9px] ${activeGroup === g.id ? "bg-foreground text-background border-foreground" : "bg-muted text-muted-foreground border-border hover:bg-muted/80"}`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {showPollPicker && (
          <div className="mb-3 win98-sunken bg-[hsl(var(--win98-light))] p-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Select Polls</span>
              <div className="flex gap-2">
                <button onClick={() => setSelectedPollIds(new Set())} className={`win98-button text-[9px] ${isAllSelected ? "font-bold bg-white" : ""}`}>All</button>
                <button onClick={() => setSelectedPollIds(new Set(demoPollsList.map((p) => p.id)))} className="text-[10px] font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground hover:bg-accent transition-colors">Select All</button>
                <button onClick={() => setSelectedPollIds(new Set())} className="text-[10px] font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground hover:bg-accent transition-colors">Clear</button>
              </div>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 max-h-40 overflow-y-auto">
              {demoPollsList.map((poll) => {
                const checked = isAllSelected || selectedPollIds.has(poll.id);
                return (
                  <label key={poll.id} className={`flex items-center gap-2 px-1.5 py-1 cursor-pointer text-[10px] ${checked && !isAllSelected ? "bg-white win98-sunken" : "bg-[hsl(var(--win98-face))] win98-raised hover:bg-[hsl(var(--win98-light))]"}`}>
                    <input type="checkbox" checked={checked} onChange={() => togglePoll(poll.id)} className="accent-[hsl(var(--primary))] h-3 w-3 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-foreground">{getSourceInfo(poll.source).name}</span>
                      <span className="text-muted-foreground ml-1">{formatDate(poll.date)}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No demographic data for selected polls in this group.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_160px]">
            {/* Bar chart */}
            <div className="space-y-2">
              {entries.map((entry, i) => {
                const color = groupColors[entry.demographic] ?? `hsl(${210 + i * 40}, 60%, 50%)`;
                const approveW = entry.approve / maxVal * 100;
                const disapproveW = entry.disapprove / maxVal * 100;

                return (
                  <div
                    key={entry.demographic}
                    className="transition-all duration-500 cursor-pointer hover:bg-muted/30 rounded px-1 -mx-1"
                    onClick={() => {
                      const demoPoll = filteredPolls.find((p) => {
                        const rd = p.raw_data as any;
                        return rd?.group_type === activeGroup && rd?.demographic === entry.demographic;
                      });
                      if (demoPoll && onSelectPoll) onSelectPoll(demoPoll);
                    }}
                    style={{
                      opacity: inView ? 1 : 0,
                      transform: inView ? "translateX(0)" : "translateX(-20px)",
                      transitionDelay: `${i * 60}ms`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-foreground w-28 shrink-0 text-right flex items-center justify-end gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        {entry.demographic}
                      </span>
                      <div className="flex-1 flex items-center gap-1">
                        <div className="flex h-6 flex-1 overflow-hidden rounded bg-muted/40">
                          <div
                            className="h-full rounded-l transition-all duration-700 flex items-center justify-end pr-1"
                            style={{ width: `${approveW}%`, backgroundColor: "hsl(150, 55%, 45%)" }}
                          >
                            {approveW > 12 && <span className="text-[9px] font-bold text-white">{entry.approve}%</span>}
                          </div>
                          <div
                            className="h-full rounded-r transition-all duration-700 flex items-center pl-1"
                            style={{ width: `${disapproveW}%`, backgroundColor: "hsl(0, 65%, 50%)" }}
                          >
                            {disapproveW > 12 && <span className="text-[9px] font-bold text-white">{entry.disapprove}%</span>}
                          </div>
                        </div>
                        <MarginBadge margin={entry.margin} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Ring summary chart */}
            <div className="hidden lg:flex flex-col items-center justify-center">
              <DemoRingChart entries={entries} groupColors={groupColors} />
            </div>
          </div>
        )}

        {/* Key insight callout */}
        {biggestGap && entries.length > 1 && (
          <div className="mt-3 win98-sunken bg-[hsl(var(--win98-light))] px-3 py-2 text-[10px] text-foreground">
            <span className="font-bold">Key gap:</span> {biggestGap.demographic} shows {biggestGap.margin > 0 ? "+" : ""}{biggestGap.margin}pt margin ({biggestGap.approve}% approve / {biggestGap.disapprove}% disapprove) — the widest split in {groupConfig?.label ?? "this group"}.
          </div>
        )}

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
    </AnimatedCard>
  );
}

// ─── Pollster Consistency Heatmap ────────────────────────────────────────────

function PollsterHeatmap({ polls, onSelectPoll }: { polls: PollEntry[]; onSelectPoll?: (p: PollEntry) => void }) {
  const { ref, inView } = useInView();
  const [topicFilter, setTopicFilter] = useState<string>("all");

  // Build the universe of approval-style topics available
  const availableTopics = useMemo(() => {
    const topics = new Map<string, number>();
    polls.forEach((p) => {
      if (p.poll_type === "approval" && p.approve_pct != null && p.candidate_or_topic) {
        topics.set(p.candidate_or_topic, (topics.get(p.candidate_or_topic) ?? 0) + 1);
      }
    });
    return Array.from(topics.entries()).sort((a, b) => b[1] - a[1]);
  }, [polls]);

  const heatData = useMemo(() => {
    // Include ALL approval polls (across topics) to maximize data density.
    // Optionally filter to a single topic via the dropdown.
    const approval = polls.filter(
      (p) =>
        p.poll_type === "approval" &&
        p.approve_pct != null &&
        (topicFilter === "all" || p.candidate_or_topic === topicFilter),
    );
    const sources = new Set<string>();
    const months = new Set<string>();
    // Aggregate: store sum + count + samples for proper averaging & tooltips
    const agg = new Map<string, { sum: number; count: number; sumDis: number; countDis: number; polls: PollEntry[] }>();

    approval.forEach((p) => {
      const d = new Date(p.date_conducted + "T00:00:00");
      if (isNaN(d.getTime())) return;
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      sources.add(p.source);
      months.add(month);
      const key = `${p.source}|${month}`;
      const cur = agg.get(key) ?? { sum: 0, count: 0, sumDis: 0, countDis: 0, polls: [] };
      cur.sum += p.approve_pct ?? 0;
      cur.count += 1;
      if (p.disapprove_pct != null) {
        cur.sumDis += p.disapprove_pct;
        cur.countDis += 1;
      }
      cur.polls.push(p);
      agg.set(key, cur);
    });

    // Flat avg map for color rendering
    const map = new Map<string, number>();
    const detail = new Map<string, { avg: number; disAvg: number | null; count: number; polls: PollEntry[] }>();
    agg.forEach((v, k) => {
      const avg = v.sum / v.count;
      const disAvg = v.countDis > 0 ? v.sumDis / v.countDis : null;
      map.set(k, avg);
      detail.set(k, { avg, disAvg, count: v.count, polls: v.polls });
    });

    const sortedMonths = Array.from(months).sort();
    // Sort sources by total poll count desc (most prolific first), tie-break by name
    const sourceCounts = new Map<string, number>();
    approval.forEach((p) => sourceCounts.set(p.source, (sourceCounts.get(p.source) ?? 0) + 1));
    const sortedSources = Array.from(sources).sort((a, b) => {
      const diff = (sourceCounts.get(b) ?? 0) - (sourceCounts.get(a) ?? 0);
      if (diff !== 0) return diff;
      return getSourceInfo(a).name.localeCompare(getSourceInfo(b).name);
    });

    return {
      sortedMonths,
      sortedSources,
      map,
      detail,
      totalPolls: approval.length,
      sourceCounts,
    };
  }, [polls, topicFilter]);

  if (heatData.sortedSources.length < 2 || heatData.sortedMonths.length < 2) return null;

  const cellW = Math.min(60, 600 / heatData.sortedMonths.length);
  const cellH = 28;
  const LEFT = 130;
  const TOP = 30;
  const W = LEFT + heatData.sortedMonths.length * cellW + 20;
  const H = TOP + heatData.sortedSources.length * cellH + 10;

  function heatColor(v: number | undefined): string {
    if (v == null) return "hsl(var(--muted))";
    if (v >= 50) return `hsl(150, ${Math.min(70, (v - 50) * 5 + 30)}%, ${55 - (v - 50)}%)`;
    return `hsl(0, ${Math.min(70, (50 - v) * 4 + 20)}%, ${50 + (50 - v) * 0.5}%)`;
  }

  return (
    <AnimatedCard>
      <div ref={ref} className="candidate-card p-5">
        <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
          <div>
            <h3 className="font-display text-sm font-semibold text-foreground">
              Pollster Approval Heatmap
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Monthly approval by source — darker green = higher, red = lower. Hover or click a cell for details.
            </p>
          </div>
          {availableTopics.length > 1 && (
            <select
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
              className="win98-sunken text-[10px] bg-background text-foreground px-1.5 py-1"
              title="Filter heatmap by approval topic"
            >
              <option value="all">All approval topics ({heatData.totalPolls})</option>
              {availableTopics.map(([t, n]) => (
                <option key={t} value={t}>{t} ({n})</option>
              ))}
            </select>
          )}
        </div>
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 500, maxHeight: 600 }}>
            {/* Month headers — show every Nth label if many months to avoid clutter */}
            {heatData.sortedMonths.map((m, i) => {
              const showLabel = heatData.sortedMonths.length <= 18 || i % Math.ceil(heatData.sortedMonths.length / 18) === 0;
              if (!showLabel) return null;
              return (
                <text
                  key={m}
                  x={LEFT + i * cellW + cellW / 2}
                  y={TOP - 8}
                  textAnchor="middle"
                  fontSize={9}
                  fill="hsl(var(--muted-foreground))"
                >
                  {new Date(m + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
                </text>
              );
            })}
            {/* Rows */}
            {heatData.sortedSources.map((src, si) => {
              const srcInfo = getSourceInfo(src);
              const srcCount = heatData.sourceCounts.get(src) ?? 0;
              return (
                <g key={src}>
                  <text
                    x={LEFT - 8}
                    y={TOP + si * cellH + cellH / 2 + 4}
                    textAnchor="end"
                    fontSize={10}
                    fontWeight={500}
                    fill="hsl(var(--foreground))"
                  >
                    <title>{srcInfo.name} — {srcCount} polls</title>
                    {srcInfo.name.length > 16 ? srcInfo.name.slice(0, 15) + "…" : srcInfo.name}
                  </text>
                  {heatData.sortedMonths.map((m, mi) => {
                    const cellKey = `${src}|${m}`;
                    const val = heatData.map.get(cellKey);
                    const det = heatData.detail.get(cellKey);
                    const monthLabel = new Date(m + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" });
                    const handleClick = () => {
                      if (det && det.polls.length > 0 && onSelectPoll) {
                        const mostRecent = [...det.polls].sort((a, b) => b.date_conducted.localeCompare(a.date_conducted))[0];
                        onSelectPoll(mostRecent);
                      }
                    };
                    return (
                      <g key={m}>
                        <rect
                          x={LEFT + mi * cellW}
                          y={TOP + si * cellH}
                          width={cellW - 2}
                          height={cellH - 2}
                          rx={3}
                          fill={heatColor(val)}
                          opacity={inView ? 0.85 : 0}
                          style={{
                            transition: `opacity 0.5s ease ${(si * heatData.sortedMonths.length + mi) * 20}ms`,
                            cursor: det ? "pointer" : "default",
                          }}
                          onClick={handleClick}
                        >
                          {det && (
                            <title>
                              {`${srcInfo.name} · ${monthLabel}\nApprove: ${val!.toFixed(1)}%${det.disAvg != null ? `\nDisapprove: ${det.disAvg.toFixed(1)}%\nNet: ${(val! - det.disAvg) >= 0 ? "+" : ""}${(val! - det.disAvg).toFixed(1)}pt` : ""}\n${det.count} poll${det.count !== 1 ? "s" : ""} this month${onSelectPoll ? "\nClick for details" : ""}`}
                            </title>
                          )}
                        </rect>
                        {val != null && (
                          <text
                            x={LEFT + mi * cellW + (cellW - 2) / 2}
                            y={TOP + si * cellH + cellH / 2 + 1}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={9}
                            fontWeight={600}
                            fill={val >= 46 ? "white" : val <= 38 ? "white" : "hsl(var(--foreground))"}
                            opacity={inView ? 1 : 0}
                            style={{
                              transition: `opacity 0.3s ease ${(si * heatData.sortedMonths.length + mi) * 20 + 200}ms`,
                              pointerEvents: "none",
                            }}
                          >
                            {Math.round(val)}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>
        <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-8 rounded" style={{ background: "linear-gradient(90deg, hsl(0, 50%, 55%), hsl(45, 50%, 70%), hsl(150, 55%, 45%))" }} />
            Low → High approval
          </span>
          <span>·</span>
          <span>{heatData.totalPolls.toLocaleString()} polls</span>
          <span>·</span>
          <span>{heatData.sortedSources.length} sources × {heatData.sortedMonths.length} months</span>
          <span>·</span>
          <span>{Math.round((heatData.detail.size / (heatData.sortedSources.length * heatData.sortedMonths.length)) * 100)}% coverage</span>
        </div>
      </div>
    </AnimatedCard>
  );
}

// ─── Rolling Average Trend ──────────────────────────────────────────────────

function RollingAverageTrend({ polls }: { polls: PollEntry[] }) {
  const { ref, inView } = useInView();

  const chartData = useMemo(() => {
    const approval = polls
      .filter((p) => p.poll_type === "approval" && p.candidate_or_topic === "Trump Approval" && p.approve_pct != null)
      .sort((a, b) => a.date_conducted.localeCompare(b.date_conducted));
    if (approval.length < 5) return [];

    // Compute 7-day rolling average by grouping by date
    const byDate = new Map<string, number[]>();
    approval.forEach((p) => {
      if (!byDate.has(p.date_conducted)) byDate.set(p.date_conducted, []);
      byDate.get(p.date_conducted)!.push(p.approve_pct!);
    });
    const daily = Array.from(byDate.entries())
      .map(([date, vals]) => ({ date, avg: vals.reduce((a, b) => a + b, 0) / vals.length }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Rolling 7-point average
    return daily.map((d, i) => {
      const window = daily.slice(Math.max(0, i - 6), i + 1);
      const rollingAvg = window.reduce((s, w) => s + w.avg, 0) / window.length;
      return {
        date: d.date,
        dateLabel: new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }),
        raw: Math.round(d.avg * 10) / 10,
        rolling: Math.round(rollingAvg * 10) / 10,
      };
    });
  }, [polls]);

  if (chartData.length < 5) return null;

  const latest = chartData[chartData.length - 1];
  const earliest = chartData[0];
  const change = Math.round((latest.rolling - earliest.rolling) * 10) / 10;

  return (
    <AnimatedCard>
      <div ref={ref} className="candidate-card p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h3 className="font-display text-sm font-semibold text-foreground">
              Rolling Average — Approval Trend
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              7-point rolling average across all sources · {chartData.length} data points
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-display font-bold text-foreground">
              {latest.rolling}%
            </span>
            <MarginBadge margin={change} />
          </div>
        </div>
        <div className="w-full" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="rollingGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
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
                domain={["dataMin - 3", "dataMax + 3"]}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickFormatter={(v: number) => `${v}%`}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 0,
                  fontSize: 11,
                }}
                formatter={(value: number, name: string) => [
                  `${value}%`,
                  name === "rolling" ? "7-pt Rolling Avg" : "Daily Average",
                ]}
              />
              <ReferenceLine y={50} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 3" opacity={0.4} />
              <Area
                type="monotone"
                dataKey="raw"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1}
                fill="none"
                dot={{ r: 2, fill: "hsl(var(--muted-foreground))", strokeWidth: 0 }}
                opacity={0.4}
                isAnimationActive={inView}
                animationDuration={1200}
              />
              <Area
                type="monotone"
                dataKey="rolling"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                fill="url(#rollingGrad)"
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--background))" }}
                isAnimationActive={inView}
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-6 rounded-sm bg-primary" /> Rolling Average
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-6 rounded-sm" style={{ backgroundColor: "hsl(var(--muted-foreground))", opacity: 0.4 }} /> Daily
          </span>
          <span className="ml-auto">
            {earliest.dateLabel} → {latest.dateLabel}
          </span>
        </div>
      </div>
    </AnimatedCard>
  );
}

// ─── Methodology & Sample Distribution ──────────────────────────────────────

function MethodologyBreakdown({ polls }: { polls: PollEntry[] }) {
  const { ref, inView } = useInView();

  const { methods, sampleTypes } = useMemo(() => {
    const mMap = new Map<string, number>();
    const sMap = new Map<string, number>();
    polls.forEach((p) => {
      const m = p.methodology || "Unknown";
      mMap.set(m, (mMap.get(m) || 0) + 1);
      const s = p.sample_type || "Unknown";
      sMap.set(s, (sMap.get(s) || 0) + 1);
    });
    return {
      methods: Array.from(mMap.entries()).sort((a, b) => b[1] - a[1]),
      sampleTypes: Array.from(sMap.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [polls]);

  const { avgSampleSize, medianMoE } = useMemo(() => {
    const sizes = polls.filter((p) => p.sample_size != null).map((p) => p.sample_size!);
    const moes = polls.filter((p) => p.margin_of_error != null).map((p) => p.margin_of_error!);
    return {
      avgSampleSize: sizes.length ? Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length) : null,
      medianMoE: moes.length ? Math.round(moes.sort((a, b) => a - b)[Math.floor(moes.length / 2)] * 10) / 10 : null,
    };
  }, [polls]);

  const METH_COLORS = [
    "hsl(210, 70%, 50%)", "hsl(150, 55%, 45%)", "hsl(30, 80%, 50%)",
    "hsl(280, 55%, 50%)", "hsl(350, 60%, 50%)", "hsl(180, 55%, 42%)",
    "hsl(45, 70%, 48%)", "hsl(0, 50%, 55%)",
  ];

  return (
    <AnimatedCard>
      <div ref={ref} className="candidate-card p-5">
        <h3 className="font-display text-sm font-semibold text-foreground mb-1">
          Methodology & Sample Quality
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          How polls are conducted and who is sampled
        </p>

        {/* Key stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="win98-sunken bg-[hsl(var(--win98-light))] p-3 text-center">
            <p className="text-lg font-display font-bold text-foreground">{polls.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Total Polls</p>
          </div>
          <div className="win98-sunken bg-[hsl(var(--win98-light))] p-3 text-center">
            <p className="text-lg font-display font-bold text-foreground">{methods.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Methods</p>
          </div>
          <div className="win98-sunken bg-[hsl(var(--win98-light))] p-3 text-center">
            <p className="text-lg font-display font-bold text-foreground">{avgSampleSize ? avgSampleSize.toLocaleString() : "—"}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Avg Sample</p>
          </div>
          <div className="win98-sunken bg-[hsl(var(--win98-light))] p-3 text-center">
            <p className="text-lg font-display font-bold text-foreground">{medianMoE ? `±${medianMoE}%` : "—"}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Median MoE</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Methodology */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">By Methodology</p>
            <div className="space-y-2">
              {methods.map(([method, count], i) => {
                const pct = (count / polls.length) * 100;
                return (
                  <div key={method}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="font-medium text-foreground">{method}</span>
                      <span className="text-muted-foreground">{count} ({Math.round(pct)}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: inView ? `${pct}%` : "0%",
                          backgroundColor: METH_COLORS[i % METH_COLORS.length],
                          transitionDelay: `${i * 80}ms`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Sample Type */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">By Sample Type</p>
            <div className="space-y-2">
              {sampleTypes.map(([type, count], i) => {
                const pct = (count / polls.length) * 100;
                return (
                  <div key={type}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="font-medium text-foreground">{type}</span>
                      <span className="text-muted-foreground">{count} ({Math.round(pct)}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: inView ? `${pct}%` : "0%",
                          backgroundColor: METH_COLORS[(i + 3) % METH_COLORS.length],
                          transitionDelay: `${i * 80}ms`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AnimatedCard>
  );
}

// ─── Pollster Spread / Outlier Detection ────────────────────────────────────

function PollsterSpreadChart({ polls }: { polls: PollEntry[] }) {
  const { ref, inView } = useInView();

  const spreadData = useMemo(() => {
    const approval = polls.filter(
      (p) => p.poll_type === "approval" && p.candidate_or_topic === "Trump Approval" && p.approve_pct != null
    );
    // Group by source — compute avg, min, max, range
    const bySource = new Map<string, number[]>();
    approval.forEach((p) => {
      if (!bySource.has(p.source)) bySource.set(p.source, []);
      bySource.get(p.source)!.push(p.approve_pct!);
    });

    return Array.from(bySource.entries())
      .filter(([, vals]) => vals.length >= 2)
      .map(([source, vals]) => {
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        return {
          source,
          name: getSourceInfo(source).name,
          color: getSourceInfo(source).color,
          avg: Math.round(avg * 10) / 10,
          min,
          max,
          range: max - min,
          count: vals.length,
        };
      })
      .sort((a, b) => a.avg - b.avg);
  }, [polls]);

  if (spreadData.length < 3) return null;

  const globalAvg = spreadData.reduce((s, d) => s + d.avg, 0) / spreadData.length;
  const barH = 32;
  const W = 550;
  const LEFT = 130;
  const RIGHT = 40;
  const TOP = 20;
  const H = TOP + spreadData.length * barH + 20;
  const plotW = W - LEFT - RIGHT;
  const allVals = spreadData.flatMap((d) => [d.min, d.max]);
  const minPct = Math.floor(Math.min(...allVals) - 2);
  const maxPct = Math.ceil(Math.max(...allVals) + 2);
  const range = maxPct - minPct || 1;
  const toX = (v: number) => LEFT + ((v - minPct) / range) * plotW;

  return (
    <AnimatedCard>
      <div ref={ref} className="candidate-card p-5">
        <h3 className="font-display text-sm font-semibold text-foreground mb-1">
          Pollster Variability & Spread
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Range of approval readings per pollster — wider bars indicate more variation
        </p>
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 450, maxHeight: 500 }}>
            {/* Grid */}
            {[35, 40, 45, 50].filter((v) => v >= minPct && v <= maxPct).map((v) => (
              <g key={v}>
                <line x1={toX(v)} y1={TOP} x2={toX(v)} y2={H - 15} stroke="hsl(var(--border))" strokeWidth={0.5} />
                <text x={toX(v)} y={H - 3} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">{v}%</text>
              </g>
            ))}
            {/* Global average line */}
            <line x1={toX(globalAvg)} y1={TOP} x2={toX(globalAvg)} y2={H - 15} stroke="hsl(var(--primary))" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.6} />
            <text x={toX(globalAvg)} y={TOP - 4} textAnchor="middle" fontSize={9} fontWeight={600} fill="hsl(var(--primary))">Avg {Math.round(globalAvg * 10) / 10}%</text>

            {spreadData.map((d, i) => {
              const y = TOP + i * barH + barH / 2;
              return (
                <g key={d.source} opacity={inView ? 1 : 0} style={{ transition: `opacity 0.5s ease ${i * 60}ms` }}>
                  <text x={LEFT - 8} y={y + 4} textAnchor="end" fontSize={10} fontWeight={500} fill="hsl(var(--foreground))">
                    {d.name.length > 16 ? d.name.slice(0, 15) + "…" : d.name}
                  </text>
                  {/* Range bar */}
                  <rect
                    x={toX(d.min)}
                    y={y - 5}
                    width={Math.max(2, toX(d.max) - toX(d.min))}
                    height={10}
                    rx={3}
                    fill={`hsl(${d.color})`}
                    opacity={0.25}
                  />
                  {/* Min dot */}
                  <circle cx={toX(d.min)} cy={y} r={4} fill={`hsl(${d.color})`} stroke="hsl(var(--card))" strokeWidth={1.5} />
                  {/* Max dot */}
                  <circle cx={toX(d.max)} cy={y} r={4} fill={`hsl(${d.color})`} stroke="hsl(var(--card))" strokeWidth={1.5} />
                  {/* Avg dot */}
                  <circle cx={toX(d.avg)} cy={y} r={5} fill={`hsl(${d.color})`} stroke="white" strokeWidth={2} />
                  {/* Label */}
                  <text x={toX(d.max) + 8} y={y + 4} fontSize={9} fill="hsl(var(--muted-foreground))">
                    {d.avg}% (±{d.range})
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">● Average</span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-6 rounded-sm bg-primary/25" /> Range (min–max)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-6 rounded-sm bg-primary" style={{ opacity: 0.6 }} /> Overall Avg
          </span>
        </div>
      </div>
    </AnimatedCard>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function PollingSection() {
  const [polls, setPolls] = useState<PollEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [topicFilter, setTopicFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [sampleTypeFilter, setSampleTypeFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [marginMin, setMarginMin] = useState<string>("");
  const [marginMax, setMarginMax] = useState<string>("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sortCol, setSortCol] = useState<string>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [tableSearch, setTableSearch] = useState("");
  const [colFilterSource, setColFilterSource] = useState("all");
  const [colFilterTopic, setColFilterTopic] = useState("all");
  const [colFilterType, setColFilterType] = useState("all");
  const [colFilterMethod, setColFilterMethod] = useState("all");
  const [colFilterDateFrom, setColFilterDateFrom] = useState("");
  const [colFilterDateTo, setColFilterDateTo] = useState("");
  const [selectedPoll, setSelectedPoll] = useState<PollEntry | null>(null);
  const [activeTab, setActiveTab] = useState<"polling" | "markets" | "finance">("polling");

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
      if (topicFilter !== "all" && p.candidate_or_topic !== topicFilter) return false;
      if (methodFilter !== "all" && (p.methodology || "Unknown") !== methodFilter) return false;
      if (sampleTypeFilter !== "all" && (p.sample_type || "Unknown") !== sampleTypeFilter) return false;
      if (dateFrom && p.date_conducted < dateFrom) return false;
      if (dateTo && p.date_conducted > dateTo) return false;
      if (marginMin !== "" && (p.margin === null || p.margin < Number(marginMin))) return false;
      if (marginMax !== "" && (p.margin === null || p.margin > Number(marginMax))) return false;
      return true;
    });
  }, [polls, sourceFilter, typeFilter, topicFilter, methodFilter, sampleTypeFilter, dateFrom, dateTo, marginMin, marginMax]);

  // Unique values for filter dropdowns
  const uniqueTopics = useMemo(() => Array.from(new Set(polls.map((p) => p.candidate_or_topic))).sort(), [polls]);
  const uniqueMethods = useMemo(() => Array.from(new Set(polls.map((p) => p.methodology || "Unknown"))).sort(), [polls]);
  const uniqueSampleTypes = useMemo(() => Array.from(new Set(polls.map((p) => p.sample_type || "Unknown"))).sort(), [polls]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (sourceFilter !== "all") c++;
    if (typeFilter !== "all") c++;
    if (topicFilter !== "all") c++;
    if (methodFilter !== "all") c++;
    if (sampleTypeFilter !== "all") c++;
    if (dateFrom) c++;
    if (dateTo) c++;
    if (marginMin !== "") c++;
    if (marginMax !== "") c++;
    return c;
  }, [sourceFilter, typeFilter, topicFilter, methodFilter, sampleTypeFilter, dateFrom, dateTo, marginMin, marginMax]);

  function clearAllFilters() {
    setSourceFilter("all");
    setTypeFilter("all");
    setTopicFilter("all");
    setMethodFilter("all");
    setSampleTypeFilter("all");
    setDateFrom("");
    setDateTo("");
    setMarginMin("");
    setMarginMax("");
  }

  // Table-level unique values for column filters
  const tableUniqueSources = useMemo(() => Array.from(new Set(filtered.map((p) => p.source))).sort(), [filtered]);
  const tableUniqueTopics = useMemo(() => Array.from(new Set(filtered.map((p) => p.candidate_or_topic))).sort(), [filtered]);
  const tableUniqueTypes = useMemo(() => Array.from(new Set(filtered.map((p) => p.poll_type))).sort(), [filtered]);
  const tableUniqueMethods = useMemo(() => Array.from(new Set(filtered.map((p) => p.methodology || "Unknown"))).sort(), [filtered]);

  // Sorting for the All Polls table
  const sortedFiltered = useMemo(() => {
    let arr = [...filtered];
    // Apply table search
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase();
      arr = arr.filter((p) =>
        p.source.toLowerCase().includes(q) ||
        p.candidate_or_topic.toLowerCase().includes(q) ||
        p.poll_type.toLowerCase().includes(q) ||
        (p.methodology || "").toLowerCase().includes(q) ||
        p.date_conducted.includes(q) ||
        (p.sample_type || "").toLowerCase().includes(q)
      );
    }
    // Apply column filters
    if (colFilterSource !== "all") arr = arr.filter((p) => p.source === colFilterSource);
    if (colFilterTopic !== "all") arr = arr.filter((p) => p.candidate_or_topic === colFilterTopic);
    if (colFilterType !== "all") arr = arr.filter((p) => p.poll_type === colFilterType);
    if (colFilterMethod !== "all") arr = arr.filter((p) => (p.methodology || "Unknown") === colFilterMethod);
    if (colFilterDateFrom) arr = arr.filter((p) => p.date_conducted >= colFilterDateFrom);
    if (colFilterDateTo) arr = arr.filter((p) => p.date_conducted <= colFilterDateTo);

    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "source": cmp = a.source.localeCompare(b.source); break;
        case "topic": cmp = a.candidate_or_topic.localeCompare(b.candidate_or_topic); break;
        case "type": cmp = a.poll_type.localeCompare(b.poll_type); break;
        case "result": cmp = ((a.approve_pct ?? a.favor_pct ?? 0) - (b.approve_pct ?? b.favor_pct ?? 0)); break;
        case "margin": cmp = ((a.margin ?? 0) - (b.margin ?? 0)); break;
        case "sample": cmp = ((a.sample_size ?? 0) - (b.sample_size ?? 0)); break;
        case "moe": cmp = ((a.margin_of_error ?? 0) - (b.margin_of_error ?? 0)); break;
        case "method": cmp = (a.methodology || "").localeCompare(b.methodology || ""); break;
        case "date": default: cmp = a.date_conducted.localeCompare(b.date_conducted); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortCol, sortDir, tableSearch, colFilterSource, colFilterTopic, colFilterType, colFilterMethod, colFilterDateFrom, colFilterDateTo]);

  const tableFilterActive = tableSearch.trim() !== "" || colFilterSource !== "all" || colFilterTopic !== "all" || colFilterType !== "all" || colFilterMethod !== "all" || colFilterDateFrom !== "" || colFilterDateTo !== "";

  function clearTableFilters() {
    setTableSearch("");
    setColFilterSource("all");
    setColFilterTopic("all");
    setColFilterType("all");
    setColFilterMethod("all");
    setColFilterDateFrom("");
    setColFilterDateTo("");
  }

  function toggleSort(col: string) {
    if (sortCol === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  }

  function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return <span className="text-muted-foreground/30 ml-0.5">↕</span>;
    return <span className="ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

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
          className="win98-button px-3 py-1 text-[10px] disabled:opacity-50">
          
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
    <div className="space-y-3">
      {/* DataHub Header */}
      <div className="win98-sunken bg-[hsl(var(--win98-light))] px-3 py-2 mb-1">
        <div className="flex items-center gap-2 text-[11px]">
          <BarChart3 className="h-4 w-4" />
          <span className="font-bold">DataHub</span>
          <span className="text-[hsl(var(--muted-foreground))]">— Polling data &amp; prediction markets aggregated from 30+ sources</span>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-0.5 mb-1">
        <button
          onClick={() => setActiveTab("polling")}
          className={`win98-button text-[10px] px-3 py-1 ${activeTab === "polling" ? "font-bold bg-white" : ""}`}
        >
          📊 Polling Data
        </button>
        <button
          onClick={() => setActiveTab("markets")}
          className={`win98-button text-[10px] px-3 py-1 ${activeTab === "markets" ? "font-bold bg-white" : ""}`}
        >
          📈 Prediction Markets
        </button>
        <button
          onClick={() => setActiveTab("finance")}
          className={`win98-button text-[10px] px-3 py-1 ${activeTab === "finance" ? "font-bold bg-white" : ""}`}
        >
          💰 Campaign Finance
        </button>
      </div>

      {activeTab === "finance" ? (
        <CampaignFinanceSection />
      ) : activeTab === "markets" ? (
        <Suspense fallback={<div className="flex items-center justify-center py-20"><span className="text-sm text-muted-foreground">Loading prediction markets…</span></div>}>
          <PredictionMarketsPanel />
        </Suspense>
      ) : (
      <>
      {/* Filters + Export */}
      <div className="candidate-card p-3 space-y-3">
       {/* Row 1: Source + Type + toggle */}
       <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-4 items-center flex-1">
         <div className="flex items-center gap-2">
           <Filter className="h-3.5 w-3.5 text-muted-foreground" />
           <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Source:</span>
           <div className="flex flex-wrap gap-1">
             <button
                 onClick={() => setSourceFilter("all")}
                 className={`win98-button px-2.5 py-1 text-[9px] ${
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
                     className="win98-button text-[9px]"
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
                 className={`win98-button px-2.5 py-1 text-[9px] ${
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
                 className={`win98-button px-2.5 py-1 text-[9px] ${
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
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`win98-button text-[9px] px-2 py-0.5 flex items-center gap-1 ${showAdvancedFilters ? "bg-primary text-primary-foreground" : ""}`}
          >
            <Filter className="h-3 w-3" />
            Filters{activeFilterCount > 2 ? ` (${activeFilterCount})` : ""}
          </button>
          {activeFilterCount > 0 && (
            <button onClick={clearAllFilters} className="win98-button text-[9px] px-2 py-0.5 text-destructive">
              Clear All
            </button>
          )}
          <button
             onClick={syncLiveSources}
             disabled={syncing || seeding}
             className="win98-button text-[9px] px-2 py-0.5 disabled:opacity-50"
             title="Scrape live polling data from 20+ sources">
           <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
           {syncing ? "Syncing…" : "Sync Live"}
          </button>
          <button
             onClick={seedData}
             disabled={seeding || syncing}
             className="win98-button text-[9px] px-2 py-0.5 disabled:opacity-50"
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

       {/* Row 2: Advanced filters */}
       {showAdvancedFilters && (
         <div className="border-t border-border pt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
           {/* Topic */}
           <div>
             <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Topic</label>
             <select
               value={topicFilter}
               onChange={(e) => setTopicFilter(e.target.value)}
               className="w-full win98-sunken text-xs px-2 py-1.5 bg-background text-foreground"
             >
               <option value="all">All Topics</option>
               {uniqueTopics.map((t) => <option key={t} value={t}>{t}</option>)}
             </select>
           </div>
           {/* Method */}
           <div>
             <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Methodology</label>
             <select
               value={methodFilter}
               onChange={(e) => setMethodFilter(e.target.value)}
               className="w-full win98-sunken text-xs px-2 py-1.5 bg-background text-foreground"
             >
               <option value="all">All Methods</option>
               {uniqueMethods.map((m) => <option key={m} value={m}>{m}</option>)}
             </select>
           </div>
           {/* Sample Type */}
           <div>
             <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Sample Type</label>
             <select
               value={sampleTypeFilter}
               onChange={(e) => setSampleTypeFilter(e.target.value)}
               className="w-full win98-sunken text-xs px-2 py-1.5 bg-background text-foreground"
             >
               <option value="all">All Sample Types</option>
               {uniqueSampleTypes.map((s) => <option key={s} value={s}>{s}</option>)}
             </select>
           </div>
           {/* Date Range */}
           <div>
             <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Date Range</label>
             <div className="flex items-center gap-1">
               <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="win98-sunken text-[10px] px-1.5 py-1 bg-background text-foreground flex-1 min-w-0" />
               <span className="text-[9px] text-muted-foreground">to</span>
               <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="win98-sunken text-[10px] px-1.5 py-1 bg-background text-foreground flex-1 min-w-0" />
             </div>
           </div>
           {/* Margin Range */}
           <div>
             <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Margin Range</label>
             <div className="flex items-center gap-1">
               <input type="number" value={marginMin} onChange={(e) => setMarginMin(e.target.value)} placeholder="Min" className="win98-sunken text-[10px] px-1.5 py-1 bg-background text-foreground flex-1 min-w-0 w-12" />
               <span className="text-[9px] text-muted-foreground">to</span>
               <input type="number" value={marginMax} onChange={(e) => setMarginMax(e.target.value)} placeholder="Max" className="win98-sunken text-[10px] px-1.5 py-1 bg-background text-foreground flex-1 min-w-0 w-12" />
             </div>
           </div>
         </div>
       )}

       {/* Active filter summary */}
       {activeFilterCount > 0 && (
         <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
           <span>Showing <strong className="text-foreground">{filtered.length}</strong> of {polls.length} polls</span>
           <span className="text-muted-foreground/40">·</span>
           <span>{activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} active</span>
         </div>
       )}
      </div>

      {/* ─── Summary Cards with Gauge ──────────────────────────────────────── */}
      {avgApproval &&
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Approval Gauge */}
          <AnimatedCard delay={0}>
          <div className="candidate-card p-4 flex flex-col items-center justify-center">
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
          <div className="candidate-card p-4">
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
          <div className="candidate-card p-4">
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
      <MultiSourceTrendChart polls={polls} onSelectPoll={(p) => setSelectedPoll(p)} />

      {/* ─── Rolling Average Trend ────────────────────────────────────────── */}
      <RollingAverageTrend polls={polls} />

      {/* ─── Demographic Breakdown ───────────────────────────────────────── */}
      <DemographicBreakdownChart polls={polls} onSelectPoll={(p) => setSelectedPoll(p)} />

      {/* ─── Charts Row: Dot Plot + Issue Butterfly ────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SourceDotPlot latestBySource={latestBySource} />
        <IssueButterflyChart polls={issuePolls} onSelectPoll={(p) => setSelectedPoll(p)} />
      </div>

      {/* ─── Pollster Heatmap ─────────────────────────────────────────────── */}
      <PollsterHeatmap polls={polls} onSelectPoll={(p) => setSelectedPoll(p)} />

      {/* ─── Generic Ballot + Favorability ────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <GenericBallotChart polls={genericBallotPolls} />
        <FavorabilityChart polls={polls} />
      </div>

      {/* ─── Generic Ballot Trend ─────────────────────────────────────────── */}
      <GenericBallotTrendChart polls={genericBallotPolls} />

      {/* ─── Pollster Variability + Methodology ───────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PollsterSpreadChart polls={polls} />
        <MethodologyBreakdown polls={polls} />
      </div>

      {/* ─── Issue Polling Deep Dive ──────────────────────────────────────── */}
      <IssuePollingSection polls={polls} onSelectPoll={(p) => setSelectedPoll(p)} />

      {/* ─── Source Comparison Table ──────────────────────────────────────── */}
      {latestBySource.length > 0 &&
      <div className="candidate-card overflow-hidden">
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
                <tr className="border-b border-[hsl(var(--win98-shadow))] bg-[hsl(var(--win98-face))]">
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Source</th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(150, 55%, 45%)" }}>Approve</th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(0, 65%, 50%)" }}>Disapprove</th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Margin</th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sample</th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody>
                {latestBySource.map((poll) => {
                const src = getSourceInfo(poll.source);
                return (
                  <tr
                    key={poll.id}
                    onClick={() => setSelectedPoll(poll)}
                    className="border-b border-border last:border-0 hover:bg-[hsl(var(--win98-light))] transition-colors cursor-pointer"
                    title="Click to view full poll details"
                  >
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
                      <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedPoll(poll)}
                            className="win98-button text-[10px] px-2 py-0.5"
                            title="View full poll details"
                          >
                            View
                          </button>
                          {poll.source_url &&
                        <a href={poll.source_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" title="Open original source">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                        }
                        </div>
                      </td>
                    </tr>);

              })}
              </tbody>
            </table>
          </div>
        </div>
      }

      {/* ─── All Polls Table ─────────────────────────────────────────────── */}
      <div className="candidate-card overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground">
                All Polls ({sortedFiltered.length}{tableFilterActive ? ` of ${filtered.length}` : ""})
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Complete polling data from all sources — click column headers to sort
              </p>
            </div>
            <div className="flex items-center gap-2">
              {tableFilterActive && (
                <button onClick={clearTableFilters} className="win98-button text-[9px] px-2 py-0.5 text-destructive">
                  ✕ Clear filters
                </button>
              )}
              <button
                onClick={seedData}
                disabled={seeding}
                className="win98-button text-[9px] px-2 py-0.5 disabled:opacity-50">
                <RefreshCw className={`h-3 w-3 ${seeding ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
          {/* Search bar */}
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Search polls by source, topic, type, method…"
              className="w-full win98-sunken text-xs py-1.5 pl-8 pr-3 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
        </div>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
           <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[hsl(var(--win98-face))] z-10">
              <tr className="border-b border-[hsl(var(--win98-shadow))] bg-[hsl(var(--win98-face))]">
                <th className="text-left py-2 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("source")}>Source<SortIcon col="source" /></th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("topic")}>Topic<SortIcon col="topic" /></th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("type")}>Type<SortIcon col="type" /></th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("result")}>Result<SortIcon col="result" /></th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("margin")}>Margin<SortIcon col="margin" /></th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("sample")}>Sample<SortIcon col="sample" /></th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("moe")}>MoE<SortIcon col="moe" /></th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("method")}>Method<SortIcon col="method" /></th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("date")}>Date<SortIcon col="date" /></th>
                <th className="py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider"></th>
              </tr>
              {/* Column filter row */}
              <tr className="border-b border-[hsl(var(--win98-shadow))] bg-[hsl(var(--win98-face))]">
                <th className="py-1 px-4">
                  <select value={colFilterSource} onChange={(e) => setColFilterSource(e.target.value)} className="win98-sunken text-[9px] w-full bg-background text-foreground py-0.5 px-1">
                    <option value="all">All</option>
                    {tableUniqueSources.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </th>
                <th className="py-1 px-3">
                  <select value={colFilterTopic} onChange={(e) => setColFilterTopic(e.target.value)} className="win98-sunken text-[9px] w-full bg-background text-foreground py-0.5 px-1">
                    <option value="all">All</option>
                    {tableUniqueTopics.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </th>
                <th className="py-1 px-3">
                  <select value={colFilterType} onChange={(e) => setColFilterType(e.target.value)} className="win98-sunken text-[9px] w-full bg-background text-foreground py-0.5 px-1">
                    <option value="all">All</option>
                    {tableUniqueTypes.map((t) => <option key={t} value={t}>{POLL_TYPES.find((pt) => pt.id === t)?.label ?? t}</option>)}
                  </select>
                </th>
                <th className="py-1 px-3"></th>
                <th className="py-1 px-3"></th>
                <th className="py-1 px-3"></th>
                <th className="py-1 px-3"></th>
                <th className="py-1 px-3">
                  <select value={colFilterMethod} onChange={(e) => setColFilterMethod(e.target.value)} className="win98-sunken text-[9px] w-full bg-background text-foreground py-0.5 px-1">
                    <option value="all">All</option>
                    {tableUniqueMethods.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </th>
                <th className="py-1 px-3">
                  <div className="flex gap-1">
                    <input type="date" value={colFilterDateFrom} onChange={(e) => setColFilterDateFrom(e.target.value)} className="win98-sunken text-[9px] bg-background text-foreground py-0.5 px-0.5 w-[85px]" title="From date" />
                    <input type="date" value={colFilterDateTo} onChange={(e) => setColFilterDateTo(e.target.value)} className="win98-sunken text-[9px] bg-background text-foreground py-0.5 px-0.5 w-[85px]" title="To date" />
                  </div>
                </th>
                <th className="py-1 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {sortedFiltered.map((poll) => {
                const src = getSourceInfo(poll.source);
                const primaryPct = poll.approve_pct ?? poll.favor_pct;
                const secondaryPct = poll.disapprove_pct ?? poll.oppose_pct;
                return (
                  <tr key={poll.id} className="border-b border-border last:border-0 hover:bg-[hsl(var(--win98-light))] transition-colors cursor-pointer" onClick={() => setSelectedPoll(poll)}>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: `hsl(${src.color})` }} />
                        <span className="text-xs font-medium text-foreground">{src.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-foreground max-w-[160px] truncate" title={poll.candidate_or_topic}>{poll.candidate_or_topic}</td>
                    <td className="py-2.5 px-3">
                      <span className="inline-block win98-sunken px-1 py-0 text-[8px] font-medium text-muted-foreground">
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
                    <td className="py-2.5 px-3 text-center text-xs text-muted-foreground whitespace-nowrap">
                      {poll.sample_size ? `n=${poll.sample_size.toLocaleString()}` : "—"}
                      {poll.sample_type && poll.sample_type !== "Unknown" && (
                        <span className="ml-0.5 text-muted-foreground/60">({poll.sample_type})</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center text-xs text-muted-foreground">
                      {poll.margin_of_error ? `±${poll.margin_of_error}%` : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">
                      {poll.methodology || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-center text-xs text-muted-foreground">
                      {formatDate(poll.date_conducted)}
                      {poll.end_date && poll.end_date !== poll.date_conducted && (
                        <span className="text-muted-foreground/50"> – {formatDate(poll.end_date)}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {poll.source_url && (
                        <a href={poll.source_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </td>
                  </tr>);

              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Source Attribution ───────────────────────────────────────────── */}
      <div className="candidate-card p-4">
        <h3 className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Data Sources
        </h3>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {POLLING_SOURCES.map((s) =>
          <a
            key={s.id}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="candidate-card p-2 flex items-center gap-2 hover:bg-[hsl(var(--win98-light))] group">
            
              <span className="inline-block h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: `hsl(${s.color})` }} />
              <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">{s.name}</span>
              <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
            </a>
          )}
        </div>
      </div>
      {selectedPoll && (
        <PollDetailWindow
          poll={selectedPoll}
          allPolls={polls}
          onClose={() => setSelectedPoll(null)}
          onSelectPoll={(p) => setSelectedPoll(p)}
        />
      )}
    </>
      )}
    </div>);

}