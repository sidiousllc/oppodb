import { useState, useEffect, useMemo } from "react";
import { MarketTradingPanel } from "@/components/MarketTradingPanel";
import { TradeHistoryPanel } from "@/components/TradeHistoryPanel";
import { MarketDetailWindow } from "@/components/MarketDetailWindow";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3, TrendingUp, TrendingDown, ExternalLink, Filter, RefreshCw,
  Search, ArrowUpDown, PieChart as PieIcon, Activity, Layers, Target,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Cell, ScatterChart, Scatter, ZAxis,
  PieChart, Pie, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  AreaChart, Area, LineChart, Line, Legend,
} from "recharts";

/* ── types ───────────────────────────────────────────────────────────── */

interface MarketRow {
  id: string;
  market_id: string;
  source: string;
  title: string;
  category: string;
  state_abbr: string | null;
  district: string | null;
  candidate_name: string | null;
  yes_price: number | null;
  no_price: number | null;
  volume: number | null;
  liquidity: number | null;
  last_traded_at: string | null;
  market_url: string | null;
  status: string;
  updated_at: string;
}

/* ── constants ───────────────────────────────────────────────────────── */

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "president", label: "President" },
  { value: "senate", label: "Senate" },
  { value: "house", label: "House" },
  { value: "governor", label: "Governor" },
  { value: "general", label: "General" },
];

const SOURCES = [
  { value: "all", label: "All Sources" },
  { value: "polymarket", label: "Polymarket" },
  { value: "kalshi", label: "Kalshi" },
  { value: "metaculus", label: "Metaculus" },
  { value: "manifold", label: "Manifold" },
  { value: "predictit", label: "PredictIt" },
];

/* ── helpers ─────────────────────────────────────────────────────────── */

function pctLabel(v: number | null) {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function volLabel(v: number | null) {
  if (v == null) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const SOURCE_COLORS: Record<string, string> = {
  polymarket: "hsl(260, 60%, 55%)",
  kalshi: "hsl(200, 70%, 50%)",
  metaculus: "hsl(150, 60%, 45%)",
  manifold: "hsl(340, 65%, 50%)",
  predictit: "hsl(30, 80%, 50%)",
};
const SOURCE_LABELS: Record<string, string> = {
  polymarket: "PM", kalshi: "KA", metaculus: "MC", manifold: "MF", predictit: "PI",
};
function sourceColor(s: string) {
  return SOURCE_COLORS[s] || "hsl(var(--muted-foreground))";
}

function probColor(p: number | null) {
  if (p == null) return "hsl(var(--muted-foreground))";
  if (p >= 0.7) return "hsl(150, 55%, 45%)";
  if (p >= 0.4) return "hsl(45, 80%, 50%)";
  return "hsl(0, 65%, 50%)";
}

/* ── Component ───────────────────────────────────────────────────────── */

export default function PredictionMarketsPanel() {
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<"yes_price" | "volume" | "title">("volume");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [stateFilter, setStateFilter] = useState("all");
  const [selectedMarket, setSelectedMarket] = useState<MarketRow | null>(null);

  /* ── load data ─────────────────────────────────────────────────────── */

  async function loadMarkets() {
    setLoading(true);
    const { data } = await supabase
      .from("prediction_markets")
      .select("*")
      .eq("status", "active")
      .order("volume", { ascending: false })
      .limit(500);
    setMarkets((data as MarketRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { loadMarkets(); }, []);

  /* ── sync ──────────────────────────────────────────────────────────── */

  async function handleSync() {
    setSyncing(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/prediction-markets-sync`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        }
      );
      await loadMarkets();
    } catch (e) {
      console.error("Sync error:", e);
    }
    setSyncing(false);
  }

  /* ── derived data ──────────────────────────────────────────────────── */

  const states = useMemo(() => {
    const s = new Set(markets.map((m) => m.state_abbr).filter(Boolean) as string[]);
    return ["all", ...Array.from(s).sort()];
  }, [markets]);

  const filtered = useMemo(() => {
    let f = markets;
    if (categoryFilter !== "all") f = f.filter((m) => m.category === categoryFilter);
    if (sourceFilter !== "all") f = f.filter((m) => m.source === sourceFilter);
    if (stateFilter !== "all") f = f.filter((m) => m.state_abbr === stateFilter);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      f = f.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          (m.candidate_name && m.candidate_name.toLowerCase().includes(q)) ||
          (m.state_abbr && m.state_abbr.toLowerCase().includes(q))
      );
    }
    f = [...f].sort((a, b) => {
      const av = a[sortField] ?? 0;
      const bv = b[sortField] ?? 0;
      if (typeof av === "string" && typeof bv === "string")
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return f;
  }, [markets, categoryFilter, sourceFilter, stateFilter, searchTerm, sortField, sortDir]);

  /* ── chart data ────────────────────────────────────────────────────── */

  const topMarkets = useMemo(
    () =>
      filtered.slice(0, 15).map((m) => ({
        name: m.title.length > 40 ? m.title.slice(0, 37) + "…" : m.title,
        probability: (m.yes_price ?? 0) * 100,
        volume: m.volume ?? 0,
        source: m.source,
        fullTitle: m.title,
      })),
    [filtered]
  );

  const sourceBreakdown = useMemo(() => {
    const sources = ["polymarket", "kalshi", "metaculus", "manifold", "predictit"];
    const labels: Record<string, string> = { polymarket: "Polymarket", kalshi: "Kalshi", metaculus: "Metaculus", manifold: "Manifold", predictit: "PredictIt" };
    return sources.map(src => {
      const items = markets.filter(m => m.source === src);
      return {
        name: labels[src] || src,
        source: src,
        count: items.length,
        avgProb: items.length ? items.reduce((s, m) => s + (m.yes_price ?? 0), 0) / items.length * 100 : 0,
        totalVolume: items.reduce((s, m) => s + (m.volume ?? 0), 0),
      };
    }).filter(s => s.count > 0);
  }, [markets]);

  const categoryBreakdown = useMemo(() => {
    const cats: Record<string, number> = {};
    markets.forEach((m) => { cats[m.category] = (cats[m.category] || 0) + 1; });
    return Object.entries(cats)
      .map(([cat, count]) => ({ name: cat, count }))
      .sort((a, b) => b.count - a.count);
  }, [markets]);

  /* ── Scatter: Volume vs Probability ──────────────────────────────── */
  const scatterData = useMemo(() =>
    filtered
      .filter(m => m.yes_price != null && m.volume != null && (m.volume ?? 0) > 0)
      .map(m => ({
        probability: (m.yes_price ?? 0) * 100,
        volume: m.volume ?? 0,
        source: m.source,
        title: m.title.length > 50 ? m.title.slice(0, 47) + "…" : m.title,
        liquidity: m.liquidity ?? 0,
      })),
    [filtered]
  );

  /* ── Probability Distribution Histogram ──────────────────────────── */
  const probDistribution = useMemo(() => {
    const buckets = Array.from({ length: 10 }, (_, i) => ({
      range: `${i * 10}-${(i + 1) * 10}%`,
      count: 0,
      rangeStart: i * 10,
    }));
    filtered.forEach(m => {
      const p = (m.yes_price ?? 0) * 100;
      const idx = Math.min(Math.floor(p / 10), 9);
      buckets[idx].count++;
    });
    return buckets;
  }, [filtered]);

  /* ── Cross-Source Price Comparison ───────────────────────────────── */
  const crossSourceComparison = useMemo(() => {
    const titleMap = new Map<string, Map<string, number>>();
    markets.forEach(m => {
      if (m.yes_price == null) return;
      const key = (m.candidate_name || m.title).toLowerCase().trim();
      if (!titleMap.has(key)) titleMap.set(key, new Map());
      titleMap.get(key)!.set(m.source, (m.yes_price ?? 0) * 100);
    });
    const result: any[] = [];
    titleMap.forEach((sources, key) => {
      if (sources.size >= 2) {
        const entry: any = { name: key.length > 30 ? key.slice(0, 27) + "…" : key };
        sources.forEach((prob, src) => { entry[src] = prob; });
        const vals = [...sources.values()];
        entry.spread = Math.max(...vals) - Math.min(...vals);
        result.push(entry);
      }
    });
    return result.sort((a, b) => (b.spread ?? 0) - (a.spread ?? 0)).slice(0, 12);
  }, [markets]);

  /* ── Category Donut Data ─────────────────────────────────────────── */
  const CAT_COLORS = ["hsl(210, 70%, 50%)", "hsl(0, 65%, 50%)", "hsl(150, 55%, 45%)", "hsl(45, 80%, 50%)", "hsl(280, 55%, 55%)", "hsl(30, 70%, 50%)"];
  const categoryDonut = useMemo(() =>
    categoryBreakdown.map((c, i) => ({ ...c, color: CAT_COLORS[i % CAT_COLORS.length] })),
    [categoryBreakdown]
  );

  /* ── Source Radar (multi-metric) ─────────────────────────────────── */
  const sourceRadar = useMemo(() => {
    const maxCount = Math.max(...sourceBreakdown.map(s => s.count), 1);
    const maxVol = Math.max(...sourceBreakdown.map(s => s.totalVolume), 1);
    return sourceBreakdown.map(s => ({
      source: s.name,
      markets: (s.count / maxCount) * 100,
      volume: (s.totalVolume / maxVol) * 100,
      avgProb: s.avgProb,
    }));
  }, [sourceBreakdown]);

  /* ── Highest/Lowest Probability Markets ──────────────────────────── */
  const extremeMarkets = useMemo(() => {
    const withPrice = filtered.filter(m => m.yes_price != null && m.yes_price > 0 && m.yes_price < 1);
    const sorted = [...withPrice].sort((a, b) => (b.yes_price ?? 0) - (a.yes_price ?? 0));
    const high = sorted.slice(0, 5).map(m => ({
      name: m.title.length > 45 ? m.title.slice(0, 42) + "…" : m.title,
      probability: (m.yes_price ?? 0) * 100,
      source: m.source,
    }));
    const low = sorted.slice(-5).reverse().map(m => ({
      name: m.title.length > 45 ? m.title.slice(0, 42) + "…" : m.title,
      probability: (m.yes_price ?? 0) * 100,
      source: m.source,
    }));
    return { high, low };
  }, [filtered]);

  /* ── Volume by Category ──────────────────────────────────────────── */
  const volumeByCategory = useMemo(() => {
    const cats: Record<string, number> = {};
    markets.forEach(m => { cats[m.category] = (cats[m.category] || 0) + (m.volume ?? 0); });
    return Object.entries(cats)
      .map(([name, volume]) => ({ name, volume }))
      .sort((a, b) => b.volume - a.volume);
  }, [markets]);

  /* ── Source Volume Pie ───────────────────────────────────────────── */
  const sourceVolumePie = useMemo(() =>
    sourceBreakdown.map(s => ({
      name: s.name,
      value: s.totalVolume,
      color: SOURCE_COLORS[s.source] || "hsl(var(--muted-foreground))",
    })).filter(s => s.value > 0),
    [sourceBreakdown]
  );

  /* ── Probability Heatmap Grid (state × category) ─────────────────── */
  const stateHeatmap = useMemo(() => {
    const stateMap = new Map<string, { count: number; avgProb: number; totalProb: number }>();
    filtered.forEach(m => {
      if (!m.state_abbr || m.yes_price == null) return;
      const entry = stateMap.get(m.state_abbr) || { count: 0, avgProb: 0, totalProb: 0 };
      entry.count++;
      entry.totalProb += (m.yes_price ?? 0) * 100;
      entry.avgProb = entry.totalProb / entry.count;
      stateMap.set(m.state_abbr, entry);
    });
    return [...stateMap.entries()]
      .map(([state, data]) => ({ state, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [filtered]);

  /* ── toggle sort ───────────────────────────────────────────────────── */

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  }

  /* ── render ────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="candidate-card p-6 animate-pulse">
            <div className="h-4 w-48 bg-muted rounded mb-3" />
            <div className="h-32 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Prediction Markets
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time odds from Polymarket, Kalshi, Metaculus, Manifold &amp; PredictIt
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="win98-button text-[9px] disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync Markets"}
        </button>
      </div>

      {/* ── Stats Row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Markets", value: markets.length },
          { label: "Sources", value: new Set(markets.map(m => m.source)).size },
          { label: "With State", value: markets.filter((m) => m.state_abbr).length },
          { label: "Active", value: markets.filter((m) => m.status === "active").length },
        ].map((s) => (
          <div key={s.label} className="candidate-card p-4 text-center">
            <p className="text-2xl font-display font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ───────────────────────────────────────────────────── */}
      <div className="candidate-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filters</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search markets…"
              className="win98-input text-[10px] pl-8 pr-3 w-48"
            />
          </div>
          {/* Category */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="win98-input text-[10px]"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          {/* Source */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="win98-input text-[10px]"
          >
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          {/* State */}
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="win98-input text-[10px]"
          >
            {states.map((s) => (
              <option key={s} value={s}>{s === "all" ? "All States" : s}</option>
            ))}
          </select>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Showing {filtered.length} of {markets.length} markets
        </p>
      </div>

      {/* ── Probability Bar Chart ─────────────────────────────────────── */}
      {topMarkets.length > 0 && (
        <div className="candidate-card p-4">
          <h3 className="font-display text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Top Markets by Probability
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(200, topMarkets.length * 32)}>
            <BarChart data={topMarkets} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 9 }} />
              <RechartsTooltip
                contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                formatter={(v: number) => [`${v.toFixed(1)}%`, "Probability"]}
                labelFormatter={(l: string, payload: any[]) => payload[0]?.payload?.fullTitle || l}
              />
              <Bar dataKey="probability" radius={[0, 4, 4, 0]}>
                {topMarkets.map((m, i) => (
                  <Cell key={i} fill={probColor(m.probability / 100)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Source & Category Breakdown ────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="candidate-card p-4">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
            Source Breakdown
          </h3>
          <div className="space-y-3">
            {sourceBreakdown.map((s) => (
              <div key={s.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-foreground">{s.name}</span>
                  <span className="text-muted-foreground">{s.count} markets · avg {s.avgProb.toFixed(0)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${markets.length ? (s.count / markets.length) * 100 : 0}%`,
                      backgroundColor: SOURCE_COLORS[s.source] || "hsl(var(--muted-foreground))",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="candidate-card p-4">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
            Category Breakdown
          </h3>
          <div className="space-y-2">
            {categoryBreakdown.map((c) => (
              <div key={c.name} className="flex justify-between items-center text-xs">
                <span className="font-medium text-foreground capitalize">{c.name}</span>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 rounded-full bg-primary/60" style={{ width: `${Math.max(16, (c.count / (markets.length || 1)) * 200)}px` }} />
                  <span className="text-muted-foreground w-8 text-right">{c.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Scatter: Volume vs Probability ────────────────────────────── */}
      {scatterData.length > 0 && (
        <div className="candidate-card p-4">
          <h3 className="font-display text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Volume vs. Probability
          </h3>
          <p className="text-[10px] text-muted-foreground mb-2">Each dot is a market — size = liquidity, color = platform</p>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" dataKey="probability" name="Probability" unit="%" tick={{ fontSize: 10 }} domain={[0, 100]} />
              <YAxis type="number" dataKey="volume" name="Volume" tick={{ fontSize: 10 }} tickFormatter={(v: number) => volLabel(v)} />
              <ZAxis type="number" dataKey="liquidity" range={[30, 400]} />
              <RechartsTooltip
                contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                formatter={(v: any, name: string) => [name === "Volume" ? volLabel(v as number) : `${v}%`, name]}
                labelFormatter={(_: any, payload: any[]) => payload?.[0]?.payload?.title || ""}
              />
              {["polymarket", "kalshi", "metaculus", "manifold", "predictit"].map(src => {
                const d = scatterData.filter(s => s.source === src);
                return d.length > 0 ? (
                  <Scatter key={src} name={src} data={d} fill={SOURCE_COLORS[src] || "hsl(var(--muted-foreground))"} opacity={0.7} />
                ) : null;
              })}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Probability Distribution + Category Donut ─────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="candidate-card p-4">
          <h3 className="font-display text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Probability Distribution
          </h3>
          <p className="text-[10px] text-muted-foreground mb-2">Markets per probability bucket</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={probDistribution} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="range" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <RechartsTooltip contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: number) => [v, "Markets"]} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {probDistribution.map((b, i) => (
                  <Cell key={i} fill={probColor(b.rangeStart / 100)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="candidate-card p-4">
          <h3 className="font-display text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <PieIcon className="h-4 w-4 text-primary" />
            Markets by Category
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={categoryDonut} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2} label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 9 }}>
                {categoryDonut.map((c: any, i: number) => (
                  <Cell key={i} fill={c.color} />
                ))}
              </Pie>
              <RechartsTooltip contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: number) => [v, "Markets"]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Volume by Category + Source Volume Pie ────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="candidate-card p-4">
          <h3 className="font-display text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Volume by Category
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={volumeByCategory} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => volLabel(v)} />
              <RechartsTooltip contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: number) => [volLabel(v), "Volume"]} />
              <Bar dataKey="volume" radius={[4, 4, 0, 0]}>
                {volumeByCategory.map((_, i) => (
                  <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="candidate-card p-4">
          <h3 className="font-display text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <PieIcon className="h-4 w-4 text-primary" />
            Volume by Source
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={sourceVolumePie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 9 }}>
                {sourceVolumePie.map((s: any, i: number) => (
                  <Cell key={i} fill={s.color} />
                ))}
              </Pie>
              <RechartsTooltip contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: number) => [volLabel(v), "Volume"]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Source Radar Chart ─────────────────────────────────────────── */}
      {sourceRadar.length >= 3 && (
        <div className="candidate-card p-4">
          <h3 className="font-display text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Platform Comparison (Radar)
          </h3>
          <p className="text-[10px] text-muted-foreground mb-2">Normalized: market count, volume, avg probability</p>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={sourceRadar}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="source" tick={{ fontSize: 10 }} />
              <PolarRadiusAxis tick={{ fontSize: 9 }} domain={[0, 100]} />
              <Radar name="Markets" dataKey="markets" stroke="hsl(210, 70%, 50%)" fill="hsl(210, 70%, 50%)" fillOpacity={0.15} />
              <Radar name="Volume" dataKey="volume" stroke="hsl(150, 55%, 45%)" fill="hsl(150, 55%, 45%)" fillOpacity={0.15} />
              <Radar name="Avg Prob" dataKey="avgProb" stroke="hsl(45, 80%, 50%)" fill="hsl(45, 80%, 50%)" fillOpacity={0.15} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
              <RechartsTooltip contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Cross-Source Price Comparison ──────────────────────────────── */}
      {crossSourceComparison.length > 0 && (
        <div className="candidate-card p-4">
          <h3 className="font-display text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-primary" />
            Cross-Platform Price Comparison
          </h3>
          <p className="text-[10px] text-muted-foreground mb-2">Markets on multiple platforms — sorted by spread</p>
          <ResponsiveContainer width="100%" height={Math.max(200, crossSourceComparison.length * 32)}>
            <BarChart data={crossSourceComparison} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} />
              <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 9 }} />
              <RechartsTooltip contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: number) => [`${v.toFixed(1)}%`, ""]} />
              {["polymarket", "kalshi", "metaculus", "manifold", "predictit"].map(src => (
                <Bar key={src} dataKey={src} name={src.charAt(0).toUpperCase() + src.slice(1)} fill={SOURCE_COLORS[src]} radius={[0, 2, 2, 0]} barSize={8} />
              ))}
              <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Highest & Lowest Probability ──────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {extremeMarkets.high.length > 0 && (
          <div className="candidate-card p-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-[hsl(150,55%,45%)]" />
              Highest Probability
            </h3>
            <div className="space-y-2">
              {extremeMarkets.high.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs font-bold w-6 text-muted-foreground">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="h-5 rounded bg-muted/40 overflow-hidden">
                      <div className="h-full rounded flex items-center px-1.5" style={{ width: `${m.probability}%`, backgroundColor: "hsl(150, 55%, 45%)" }}>
                        <span className="text-[9px] font-bold text-white truncate">{m.name}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-foreground w-12 text-right">{m.probability.toFixed(1)}%</span>
                  <span className="inline-block px-1 py-0 win98-raised text-[8px] font-bold text-white" style={{ backgroundColor: sourceColor(m.source) }}>
                    {SOURCE_LABELS[m.source] || m.source.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {extremeMarkets.low.length > 0 && (
          <div className="candidate-card p-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <TrendingDown className="h-3.5 w-3.5 text-[hsl(0,65%,50%)]" />
              Lowest Probability
            </h3>
            <div className="space-y-2">
              {extremeMarkets.low.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs font-bold w-6 text-muted-foreground">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="h-5 rounded bg-muted/40 overflow-hidden">
                      <div className="h-full rounded flex items-center px-1.5" style={{ width: `${Math.max(m.probability, 3)}%`, backgroundColor: "hsl(0, 65%, 50%)" }}>
                        <span className="text-[9px] font-bold text-white truncate">{m.name}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-foreground w-12 text-right">{m.probability.toFixed(1)}%</span>
                  <span className="inline-block px-1 py-0 win98-raised text-[8px] font-bold text-white" style={{ backgroundColor: sourceColor(m.source) }}>
                    {SOURCE_LABELS[m.source] || m.source.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── State Coverage Heatmap ─────────────────────────────────────── */}
      {stateHeatmap.length > 0 && (
        <div className="candidate-card p-4">
          <h3 className="font-display text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            State Coverage Heatmap
          </h3>
          <p className="text-[10px] text-muted-foreground mb-3">States with most active markets — intensity = avg probability</p>
          <div className="flex flex-wrap gap-1.5">
            {stateHeatmap.map(s => {
              const intensity = s.avgProb / 100;
              const bg = `hsla(210, 70%, ${55 - intensity * 25}%, ${0.3 + intensity * 0.6})`;
              return (
                <div key={s.state} className="win98-raised px-2.5 py-2 text-center min-w-[52px]" style={{ backgroundColor: bg }} title={`${s.state}: ${s.count} markets, avg ${s.avgProb.toFixed(1)}%`}>
                  <span className="text-xs font-bold text-foreground block">{s.state}</span>
                  <span className="text-[9px] text-muted-foreground">{s.count} mkts</span>
                  <span className="text-[9px] font-semibold text-foreground block">{s.avgProb.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Markets Table ─────────────────────────────────────────────── */}
      <div className="candidate-card p-4">
        <h3 className="font-display text-sm font-bold text-foreground mb-3">
          All Markets ({filtered.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 text-muted-foreground font-semibold">Source</th>
                <th
                  className="text-left py-2 px-2 text-muted-foreground font-semibold cursor-pointer hover:text-foreground"
                  onClick={() => toggleSort("title")}
                >
                  <span className="flex items-center gap-1">Market <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="text-left py-2 px-2 text-muted-foreground font-semibold">Category</th>
                <th className="text-left py-2 px-2 text-muted-foreground font-semibold">State</th>
                <th
                  className="text-right py-2 px-2 text-muted-foreground font-semibold cursor-pointer hover:text-foreground"
                  onClick={() => toggleSort("yes_price")}
                >
                  <span className="flex items-center gap-1 justify-end">Yes <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="text-right py-2 px-2 text-muted-foreground font-semibold">No</th>
                <th
                  className="text-right py-2 px-2 text-muted-foreground font-semibold cursor-pointer hover:text-foreground"
                  onClick={() => toggleSort("volume")}
                >
                  <span className="flex items-center gap-1 justify-end">Volume <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="text-right py-2 px-2 text-muted-foreground font-semibold">Updated</th>
                <th className="py-2 px-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((m) => (
                <tr key={m.id} className="border-b border-[hsl(var(--win98-light))] hover:bg-[hsl(var(--win98-light))] transition-colors cursor-pointer" onClick={() => setSelectedMarket(m)}>
                  <td className="py-2 px-2">
                    <span
                      className="inline-block px-1 py-0 win98-raised text-[9px] font-bold text-white"
                      style={{ backgroundColor: sourceColor(m.source) }}
                    >
                      {SOURCE_LABELS[m.source] || m.source.slice(0, 2).toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2 px-2 max-w-[300px]">
                    <span className="font-medium text-foreground line-clamp-2">{m.title}</span>
                    {m.candidate_name && (
                      <span className="block text-[10px] text-muted-foreground">{m.candidate_name}</span>
                    )}
                  </td>
                  <td className="py-2 px-2 capitalize text-muted-foreground">{m.category}</td>
                  <td className="py-2 px-2 text-muted-foreground">{m.state_abbr || "—"}</td>
                  <td className="py-2 px-2 text-right font-bold" style={{ color: probColor(m.yes_price) }}>
                    {pctLabel(m.yes_price)}
                  </td>
                  <td className="py-2 px-2 text-right text-muted-foreground">{pctLabel(m.no_price)}</td>
                  <td className="py-2 px-2 text-right text-muted-foreground">{volLabel(m.volume)}</td>
                  <td className="py-2 px-2 text-right text-muted-foreground">{formatDate(m.updated_at)}</td>
                  <td className="py-2 px-2">
                    {m.market_url && (
                      <a href={m.market_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              No markets found. Try syncing or adjusting filters.
            </p>
          )}
        </div>
      </div>

      {/* ── Source Attribution ─────────────────────────────────────────── */}
      <div className="candidate-card p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Data Sources</h3>
        <div className="grid gap-1.5 sm:grid-cols-3">
          {[
            { name: "Polymarket", url: "https://polymarket.com", color: SOURCE_COLORS.polymarket },
            { name: "Kalshi", url: "https://kalshi.com", color: SOURCE_COLORS.kalshi },
            { name: "Metaculus", url: "https://www.metaculus.com", color: SOURCE_COLORS.metaculus },
            { name: "Manifold", url: "https://manifold.markets", color: SOURCE_COLORS.manifold },
            { name: "PredictIt", url: "https://www.predictit.org", color: SOURCE_COLORS.predictit },
          ].map((src) => (
            <a
              key={src.name}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="candidate-card p-2 flex items-center gap-2 hover:bg-[hsl(var(--win98-light))] group"
            >
              <span className="inline-block h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: src.color }} />
              <span className="text-xs font-medium text-foreground group-hover:text-primary">{src.name}</span>
              <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground/40 group-hover:text-muted-foreground" />
            </a>
          ))}
        </div>
      </div>

      {/* Trade History */}
      <TradeHistoryPanel />

      {/* Trading Panel */}
      <div className="mt-4">
        <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Trade & Portfolio
        </h3>
        <MarketTradingPanel />
      </div>
    </div>
  );
}
