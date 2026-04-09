import { Win98Window } from "@/components/Win98Window";
import {
  TrendingUp, TrendingDown, ExternalLink, DollarSign, BarChart3,
  Clock, MapPin, Tag, User, Activity, Globe,
} from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip,
} from "recharts";

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

interface Props {
  market: MarketRow;
  allMarkets: MarketRow[];
  onClose: () => void;
}

const SOURCE_COLORS: Record<string, string> = {
  polymarket: "hsl(260, 60%, 55%)",
  kalshi: "hsl(200, 70%, 50%)",
  metaculus: "hsl(150, 60%, 45%)",
  manifold: "hsl(340, 65%, 50%)",
  predictit: "hsl(30, 80%, 50%)",
};

const SOURCE_NAMES: Record<string, string> = {
  polymarket: "Polymarket",
  kalshi: "Kalshi",
  metaculus: "Metaculus",
  manifold: "Manifold",
  predictit: "PredictIt",
};

function pct(v: number | null) {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function volLabel(v: number | null) {
  if (v == null) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function probColor(p: number | null) {
  if (p == null) return "hsl(var(--muted-foreground))";
  if (p >= 0.7) return "hsl(150, 55%, 45%)";
  if (p >= 0.4) return "hsl(45, 80%, 50%)";
  return "hsl(0, 65%, 50%)";
}

export function MarketDetailWindow({ market, allMarkets, onClose }: Props) {
  const m = market;
  const yesP = (m.yes_price ?? 0) * 100;
  const noP = (m.no_price ?? 0) * 100;
  const impliedProb = m.yes_price != null && m.no_price != null
    ? ((m.yes_price / (m.yes_price + m.no_price)) * 100)
    : yesP;
  const spread = m.yes_price != null && m.no_price != null
    ? Math.abs(100 - (m.yes_price + m.no_price) * 100)
    : null;

  // Pie data for Yes/No
  const outcomePie = [
    { name: "Yes", value: yesP, color: "hsl(150, 55%, 45%)" },
    { name: "No", value: noP, color: "hsl(0, 65%, 50%)" },
  ].filter(d => d.value > 0);

  // Cross-platform comparison: find same market on other platforms
  const crossPlatform = allMarkets.filter(other => {
    if (other.id === m.id) return false;
    const key1 = (m.candidate_name || m.title).toLowerCase().trim();
    const key2 = (other.candidate_name || other.title).toLowerCase().trim();
    return key1 === key2 || (m.candidate_name && other.candidate_name &&
      m.candidate_name.toLowerCase() === other.candidate_name.toLowerCase());
  });

  const crossPlatformData = [
    { source: SOURCE_NAMES[m.source] || m.source, probability: yesP, color: SOURCE_COLORS[m.source] || "hsl(var(--muted-foreground))" },
    ...crossPlatform.map(o => ({
      source: SOURCE_NAMES[o.source] || o.source,
      probability: (o.yes_price ?? 0) * 100,
      color: SOURCE_COLORS[o.source] || "hsl(var(--muted-foreground))",
    })),
  ];

  // Related markets in same category + state
  const related = allMarkets.filter(other =>
    other.id !== m.id &&
    other.category === m.category &&
    (m.state_abbr ? other.state_abbr === m.state_abbr : true)
  ).slice(0, 8);

  // Liquidity-to-volume ratio
  const liqVolRatio = m.volume && m.liquidity && m.volume > 0
    ? ((m.liquidity / m.volume) * 100).toFixed(1) : null;

  return (
    <Win98Window
      title={`Market: ${m.title.slice(0, 60)}`}
      icon={<TrendingUp className="h-3.5 w-3.5 text-white" />}
      onClose={onClose}
      defaultPosition={{ x: Math.max(40, window.innerWidth / 2 - 350), y: 40 }}
      defaultSize={{ width: 700, height: Math.min(window.innerHeight - 80, 720) }}
      minSize={{ width: 400, height: 300 }}
      statusBar={<span>Market ID: {m.market_id} · {m.status}</span>}
    >
      <div className="p-4 space-y-4 text-xs">
        {/* Title & Source Badge */}
        <div>
          <div className="flex items-start gap-2">
            <span
              className="inline-block px-1.5 py-0.5 win98-raised text-[9px] font-bold text-white shrink-0 mt-0.5"
              style={{ backgroundColor: SOURCE_COLORS[m.source] || "hsl(var(--muted-foreground))" }}
            >
              {(SOURCE_NAMES[m.source] || m.source).toUpperCase()}
            </span>
            <h2 className="font-display text-base font-bold text-foreground leading-tight">{m.title}</h2>
          </div>
          {m.candidate_name && (
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
              <User className="h-3.5 w-3.5" /> {m.candidate_name}
            </p>
          )}
        </div>

        {/* Probability Gauge */}
        <div className="candidate-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Current Probability</span>
            <span className="text-2xl font-display font-bold" style={{ color: probColor(m.yes_price) }}>
              {pct(m.yes_price)}
            </span>
          </div>
          <div className="h-4 rounded-full bg-muted overflow-hidden flex">
            <div
              className="h-full transition-all duration-500 flex items-center justify-center"
              style={{ width: `${yesP}%`, backgroundColor: "hsl(150, 55%, 45%)" }}
            >
              {yesP > 15 && <span className="text-[9px] font-bold text-white">YES {yesP.toFixed(1)}%</span>}
            </div>
            <div
              className="h-full transition-all duration-500 flex items-center justify-center"
              style={{ width: `${noP}%`, backgroundColor: "hsl(0, 65%, 50%)" }}
            >
              {noP > 15 && <span className="text-[9px] font-bold text-white">NO {noP.toFixed(1)}%</span>}
            </div>
          </div>
          {spread != null && (
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Implied probability: {impliedProb.toFixed(1)}% · Spread (vig): {spread.toFixed(1)}%
            </p>
          )}
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { icon: DollarSign, label: "Volume", value: volLabel(m.volume) },
            { icon: Activity, label: "Liquidity", value: volLabel(m.liquidity) },
            { icon: Tag, label: "Category", value: m.category.charAt(0).toUpperCase() + m.category.slice(1) },
            { icon: MapPin, label: "State", value: m.state_abbr || "National" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="candidate-card p-3 text-center">
              <Icon className="h-4 w-4 mx-auto text-primary mb-1" />
              <p className="font-bold text-foreground text-sm">{value}</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>

        {/* Additional Details */}
        <div className="candidate-card p-4 space-y-2">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Details</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Yes Price:</span>
              <span className="font-bold" style={{ color: probColor(m.yes_price) }}>{pct(m.yes_price)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">No Price:</span>
              <span className="font-bold text-foreground">{pct(m.no_price)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Volume:</span>
              <span className="font-bold text-foreground">{volLabel(m.volume)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Liquidity:</span>
              <span className="font-bold text-foreground">{volLabel(m.liquidity)}</span>
            </div>
            {liqVolRatio && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Liq/Vol Ratio:</span>
                <span className="font-bold text-foreground">{liqVolRatio}%</span>
              </div>
            )}
            {m.district && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">District:</span>
                <span className="font-bold text-foreground">{m.district}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className={`font-bold ${m.status === "active" ? "text-[hsl(150,55%,45%)]" : "text-muted-foreground"}`}>
                {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Source:</span>
              <span className="font-bold text-foreground">{SOURCE_NAMES[m.source] || m.source}</span>
            </div>
          </div>
          <div className="pt-2 border-t border-border mt-2 space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Last Traded: {fmtDate(m.last_traded_at)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Last Updated: {fmtDate(m.updated_at)}</span>
            </div>
          </div>
        </div>

        {/* Yes/No Pie + Cross-Platform Comparison */}
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Outcome Pie */}
          <div className="candidate-card p-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Outcome Split</h3>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={outcomePie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={60}
                  label={({ name, value }: any) => `${name} ${value.toFixed(1)}%`}
                  labelLine={false} style={{ fontSize: 10 }}
                >
                  {outcomePie.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <RechartsTooltip contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  formatter={(v: number) => [`${v.toFixed(1)}%`, ""]} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Cross-Platform */}
          {crossPlatformData.length > 1 ? (
            <div className="candidate-card p-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Cross-Platform Prices</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={crossPlatformData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="source" tick={{ fontSize: 9 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} tickFormatter={(v: number) => `${v}%`} />
                  <RechartsTooltip contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                    formatter={(v: number) => [`${v.toFixed(1)}%`, "Probability"]} />
                  <Bar dataKey="probability" radius={[4, 4, 0, 0]}>
                    {crossPlatformData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-[9px] text-muted-foreground mt-1">
                Spread: {(Math.max(...crossPlatformData.map(d => d.probability)) - Math.min(...crossPlatformData.map(d => d.probability))).toFixed(1)}% — potential arbitrage
              </p>
            </div>
          ) : (
            <div className="candidate-card p-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Platform Exclusive</h3>
              <div className="flex items-center justify-center h-32">
                <div className="text-center text-muted-foreground">
                  <Globe className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-[10px]">Only available on {SOURCE_NAMES[m.source] || m.source}</p>
                  <p className="text-[9px] mt-0.5">No cross-platform comparison available</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Market Link */}
        {m.market_url && (
          <a
            href={m.market_url}
            target="_blank"
            rel="noopener noreferrer"
            className="win98-button text-[10px] flex items-center gap-1.5 w-fit"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View on {SOURCE_NAMES[m.source] || m.source}
          </a>
        )}

        {/* Related Markets */}
        {related.length > 0 && (
          <div className="candidate-card p-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Related Markets ({related.length})
            </h3>
            <div className="space-y-1.5">
              {related.map(r => (
                <div key={r.id} className="flex items-center gap-2 py-1 border-b border-[hsl(var(--win98-light))] last:border-0">
                  <span
                    className="inline-block px-1 py-0 win98-raised text-[8px] font-bold text-white shrink-0"
                    style={{ backgroundColor: SOURCE_COLORS[r.source] || "hsl(var(--muted-foreground))" }}
                  >
                    {(SOURCE_NAMES[r.source] || r.source).slice(0, 2).toUpperCase()}
                  </span>
                  <span className="flex-1 truncate text-foreground">{r.title}</span>
                  <span className="font-bold shrink-0" style={{ color: probColor(r.yes_price) }}>
                    {pct(r.yes_price)}
                  </span>
                  <span className="text-muted-foreground shrink-0">{volLabel(r.volume)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Market ID & Metadata */}
        <div className="candidate-card p-3">
          <h3 className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Metadata</h3>
          <div className="grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
            <span>Market ID: <span className="font-mono text-foreground">{m.market_id}</span></span>
            <span>Internal ID: <span className="font-mono text-foreground">{m.id.slice(0, 8)}…</span></span>
          </div>
        </div>
      </div>
    </Win98Window>
  );
}
