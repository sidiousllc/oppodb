import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3, TrendingUp, TrendingDown, ExternalLink, Filter, RefreshCw,
  Search, ArrowUpDown,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Cell, ScatterChart, Scatter, ZAxis,
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

function sourceColor(s: string) {
  return s === "polymarket" ? "hsl(260, 60%, 55%)" : "hsl(200, 70%, 50%)";
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
    const poly = markets.filter((m) => m.source === "polymarket");
    const kal = markets.filter((m) => m.source === "kalshi");
    return [
      { name: "Polymarket", count: poly.length, avgProb: poly.length ? poly.reduce((s, m) => s + (m.yes_price ?? 0), 0) / poly.length * 100 : 0 },
      { name: "Kalshi", count: kal.length, avgProb: kal.length ? kal.reduce((s, m) => s + (m.yes_price ?? 0), 0) / kal.length * 100 : 0 },
    ];
  }, [markets]);

  const categoryBreakdown = useMemo(() => {
    const cats: Record<string, number> = {};
    markets.forEach((m) => { cats[m.category] = (cats[m.category] || 0) + 1; });
    return Object.entries(cats)
      .map(([cat, count]) => ({ name: cat, count }))
      .sort((a, b) => b.count - a.count);
  }, [markets]);

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
          <div key={i} className="rounded-xl border border-border bg-card p-6 animate-pulse">
            <div className="h-4 w-48 bg-muted rounded mb-3" />
            <div className="h-32 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Prediction Markets
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time odds from Polymarket &amp; Kalshi
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync Markets"}
        </button>
      </div>

      {/* ── Stats Row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Markets", value: markets.length },
          { label: "Polymarket", value: markets.filter((m) => m.source === "polymarket").length },
          { label: "Kalshi", value: markets.filter((m) => m.source === "kalshi").length },
          { label: "With State", value: markets.filter((m) => m.state_abbr).length },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-2xl font-display font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4">
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
              className="text-xs pl-8 pr-3 py-1.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground w-48 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          {/* Category */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-border bg-background text-foreground"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          {/* Source */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-border bg-background text-foreground"
          >
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          {/* State */}
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-border bg-background text-foreground"
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
        <div className="rounded-xl border border-border bg-card p-4">
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
        <div className="rounded-xl border border-border bg-card p-4">
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
                      backgroundColor: s.name === "Polymarket" ? "hsl(260, 60%, 55%)" : "hsl(200, 70%, 50%)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
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

      {/* ── Markets Table ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4">
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
                <tr key={m.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-2 px-2">
                    <span
                      className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
                      style={{ backgroundColor: sourceColor(m.source) }}
                    >
                      {m.source === "polymarket" ? "PM" : "KA"}
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
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Data Sources</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <a
            href="https://polymarket.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-border p-2.5 hover:bg-muted/50 transition-colors group"
          >
            <span className="inline-block h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: "hsl(260, 60%, 55%)" }} />
            <span className="text-xs font-medium text-foreground group-hover:text-primary">Polymarket</span>
            <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground/40 group-hover:text-muted-foreground" />
          </a>
          <a
            href="https://kalshi.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-border p-2.5 hover:bg-muted/50 transition-colors group"
          >
            <span className="inline-block h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: "hsl(200, 70%, 50%)" }} />
            <span className="text-xs font-medium text-foreground group-hover:text-primary">Kalshi</span>
            <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground/40 group-hover:text-muted-foreground" />
          </a>
        </div>
      </div>
    </div>
  );
}
