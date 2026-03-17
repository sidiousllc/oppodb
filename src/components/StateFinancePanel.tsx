import { useState, useCallback } from "react";
import {
  DollarSign, Users, Building2, Landmark, ChevronDown, ChevronUp,
  Search, TrendingUp, TrendingDown, ExternalLink, PieChart,
  ArrowLeft, Receipt, Banknote, RefreshCw, AlertCircle, BarChart3
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TopItem { name: string; amount: number }

interface CandidateFinance {
  committee_name: string;
  candidate_name: string;
  reg_num: string;
  chamber: string;
  office?: string;
  party?: string;
  total_contributions: number;
  total_expenditures: number;
  net_cash: number;
  contribution_count: number;
  expenditure_count: number;
  in_kind_total: number;
  years_active: string[];
  yearly_breakdown: Array<{ year: string; contributions: number; expenditures: number }>;
  top_contributors: TopItem[];
  contributor_types: TopItem[];
  expenditure_types: TopItem[];
  top_vendors: TopItem[];
}

interface SummaryData {
  total_raised: number;
  total_spent: number;
  candidate_count: number;
}

type ChamberFilter = "all" | "house" | "senate" | "governor";

const STATE_META: Record<string, { name: string; flag: string; source: string; source_url: string }> = {
  PA: { name: "Pennsylvania", flag: "🏛️", source: "PA Dept. of State", source_url: "https://www.pa.gov/agencies/dos/resources/voting-and-elections-resources/campaign-finance-data" },
  MI: { name: "Michigan", flag: "🏛️", source: "MI Secretary of State", source_url: "https://miboecfr.nictusa.com/cfr/dumpall/cfrdetail/" },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number | null): string {
  if (n == null) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function chamberColor(ch: string): string {
  if (ch === "house") return "hsl(210, 80%, 50%)";
  if (ch === "senate") return "hsl(280, 60%, 50%)";
  if (ch === "governor") return "hsl(25, 80%, 50%)";
  return "hsl(var(--muted-foreground))";
}

function chamberLabel(ch: string): string {
  if (ch === "house") return "House";
  if (ch === "senate") return "Senate";
  if (ch === "governor") return "Governor";
  return "Other";
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
      <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color || "hsl(var(--primary))"}15` }}>
        {icon}
      </div>
      <div>
        <p className="text-lg font-bold text-foreground">{value}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function TopItemsList({ items, label }: { items: TopItem[]; label: string }) {
  if (!items || items.length === 0) return null;
  const max = items[0]?.amount || 1;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h4 className="font-display text-sm font-semibold text-foreground mb-2">{label}</h4>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-4 shrink-0">{i + 1}.</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-foreground truncate">{item.name}</span>
                <span className="font-bold text-foreground shrink-0">{fmt(item.amount)}</span>
              </div>
              <div className="h-1 w-full bg-muted rounded-full overflow-hidden mt-0.5">
                <div className="h-full bg-primary/60 rounded-full" style={{ width: `${(item.amount / max) * 100}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CandidateCard({ candidate, onClick }: { candidate: CandidateFinance; onClick: () => void }) {
  const netPositive = candidate.net_cash >= 0;
  return (
    <div
      className="rounded-xl border border-border bg-card p-4 cursor-pointer hover:border-primary/40 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-foreground text-sm truncate">{candidate.candidate_name}</p>
          <p className="text-[10px] text-muted-foreground truncate">{candidate.committee_name}</p>
        </div>
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
          style={{ backgroundColor: `${chamberColor(candidate.chamber)}20`, color: chamberColor(candidate.chamber) }}
        >
          {chamberLabel(candidate.chamber)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div>
          <p className="text-[9px] text-muted-foreground">Raised</p>
          <p className="text-sm font-bold" style={{ color: "hsl(150, 55%, 45%)" }}>{fmt(candidate.total_contributions)}</p>
        </div>
        <div>
          <p className="text-[9px] text-muted-foreground">Spent</p>
          <p className="text-sm font-bold" style={{ color: "hsl(0, 65%, 50%)" }}>{fmt(candidate.total_expenditures)}</p>
        </div>
        <div>
          <p className="text-[9px] text-muted-foreground">Net</p>
          <p className={`text-sm font-bold ${netPositive ? "text-foreground" : "text-destructive"}`}>{fmt(candidate.net_cash)}</p>
        </div>
      </div>
      {candidate.party && (
        <p className="text-[9px] text-muted-foreground mt-1">Party: {candidate.party}</p>
      )}
    </div>
  );
}

function YearOverYearChart({ data }: { data: Array<{ year: string; contributions: number; expenditures: number; contribution_count?: number; expenditure_count?: number }> }) {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => Math.max(d.contributions, d.expenditures)), 1);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h4 className="font-display text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        Year-over-Year Fundraising
      </h4>

      <div className="flex items-center gap-4 mb-3 text-[10px]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "hsl(150, 60%, 45%)" }} />
          Contributions
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "hsl(0, 55%, 55%)" }} />
          Expenditures
        </span>
      </div>

      <div className="space-y-2">
        {data.map((d) => {
          const contribPct = (d.contributions / maxVal) * 100;
          const expendPct = (d.expenditures / maxVal) * 100;
          const net = d.contributions - d.expenditures;
          const netPositive = net >= 0;

          return (
            <div key={d.year} className="group">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[11px] font-bold text-foreground w-10 shrink-0">{d.year}</span>
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <div className="h-3.5 rounded-sm transition-all duration-300" style={{
                      width: `${Math.max(contribPct, 1)}%`,
                      backgroundColor: "hsl(150, 60%, 45%)",
                    }} />
                    <span className="text-[10px] font-medium text-foreground shrink-0">{fmt(d.contributions)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3.5 rounded-sm transition-all duration-300" style={{
                      width: `${Math.max(expendPct, 1)}%`,
                      backgroundColor: "hsl(0, 55%, 55%)",
                    }} />
                    <span className="text-[10px] font-medium text-foreground shrink-0">{fmt(d.expenditures)}</span>
                  </div>
                </div>
                <span className={`text-[10px] font-bold shrink-0 w-14 text-right ${netPositive ? "text-primary" : "text-destructive"}`}>
                  {netPositive ? "+" : ""}{fmt(net)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {data.length >= 2 && (() => {
        const latest = data[data.length - 1];
        const prev = data[data.length - 2];
        const changePct = prev.contributions > 0
          ? ((latest.contributions - prev.contributions) / prev.contributions * 100)
          : 0;
        const isUp = changePct >= 0;
        return (
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {prev.year} → {latest.year} change
            </span>
            <span className={`text-xs font-bold flex items-center gap-1 ${isUp ? "text-primary" : "text-destructive"}`}>
              {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {isUp ? "+" : ""}{changePct.toFixed(1)}%
            </span>
          </div>
        );
      })()}
    </div>
  );
}

function CandidateDetailView({ candidate, onBack }: { candidate: CandidateFinance; onBack: () => void }) {
  return (
    <div className="space-y-4 animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-1 text-xs text-primary hover:underline">
        <ArrowLeft className="h-3 w-3" /> Back to list
      </button>

      <div>
        <h3 className="font-display text-lg font-bold text-foreground">{candidate.candidate_name}</h3>
        <p className="text-xs text-muted-foreground">{candidate.committee_name}</p>
        <div className="flex gap-2 mt-1">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: `${chamberColor(candidate.chamber)}20`, color: chamberColor(candidate.chamber) }}>
            {chamberLabel(candidate.chamber)}
          </span>
          {candidate.party && <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full">{candidate.party}</span>}
          {candidate.years_active?.length > 0 && (
            <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full">{candidate.years_active.join(", ")}</span>
          )}
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Raised" value={fmt(candidate.total_contributions)} icon={<TrendingUp className="h-4 w-4" style={{ color: "hsl(150, 55%, 45%)" }} />} color="hsl(150, 55%, 45%)" />
        <StatCard label="Total Spent" value={fmt(candidate.total_expenditures)} icon={<TrendingDown className="h-4 w-4" style={{ color: "hsl(0, 65%, 50%)" }} />} color="hsl(0, 65%, 50%)" />
        <StatCard label="Net Cash" value={fmt(candidate.net_cash)} icon={<Banknote className="h-4 w-4" style={{ color: "hsl(210, 80%, 50%)" }} />} color="hsl(210, 80%, 50%)" />
        <StatCard label="Transactions" value={`${(candidate.contribution_count + candidate.expenditure_count).toLocaleString()}`} icon={<Receipt className="h-4 w-4" style={{ color: "hsl(280, 60%, 50%)" }} />} color="hsl(280, 60%, 50%)" />
      </div>

      {/* Year-over-Year Chart */}
      <YearOverYearChart data={candidate.yearly_breakdown || []} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TopItemsList items={candidate.top_contributors || []} label="Top Contributors" />
        <TopItemsList items={candidate.top_vendors || []} label="Top Vendors" />
      </div>

      {(candidate.expenditure_types?.length > 0) && (
        <TopItemsList items={candidate.expenditure_types} label="Expenditure Categories" />
      )}
    </div>
  );
}

// ─── Main Panel ─────────────────────────────────────────────────────────────

export function StateFinancePanel({ stateAbbr }: { stateAbbr: "PA" | "MI" }) {
  const [candidates, setCandidates] = useState<CandidateFinance[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chamber, setChamber] = useState<ChamberFilter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CandidateFinance | null>(null);
  const [fetched, setFetched] = useState(false);

  const meta = STATE_META[stateAbbr];

  const fetchData = useCallback(async (ch?: ChamberFilter, s?: string) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ state: stateAbbr, chamber: ch || chamber, search: s ?? search });
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/state-cfb-finance?${params}`,
        { headers: { "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      const data = await resp.json();
      if (!data.success) throw new Error(data.error);
      setCandidates(data.candidates || []);
      setSummary(data.summary || null);
      setFetched(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [stateAbbr, chamber, search]);

  const triggerSync = useCallback(async () => {
    setSyncing(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/state-cfb-finance?action=sync&state=${stateAbbr}`,
        { headers: { "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      const data = await resp.json();
      if (!data.success) throw new Error(data.error);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  }, [stateAbbr]);

  if (selected) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <CandidateDetailView candidate={selected} onBack={() => setSelected(null)} />
        <p className="text-[9px] text-muted-foreground mt-4 border-t border-border pt-2">
          Source: {meta.source} ·{" "}
          <a href={meta.source_url} target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-0.5">
            Data Portal <ExternalLink className="h-2 w-2" />
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" />
          {meta.flag} {meta.name} Campaign Finance
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={triggerSync}
            disabled={syncing}
            className="px-3 py-1.5 text-[10px] font-bold rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync from State"}
          </button>
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="px-3 py-1.5 text-[10px] font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Loading…" : "Fetch Data"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 mb-4 flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {fetched && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search candidates…"
                value={search}
                onChange={e => { setSearch(e.target.value); fetchData(undefined, e.target.value); }}
                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {(["all", "house", "senate", "governor"] as ChamberFilter[]).map(ch => (
              <button
                key={ch}
                onClick={() => { setChamber(ch); fetchData(ch); }}
                className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-colors ${
                  chamber === ch ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                }`}
              >
                {ch === "all" ? "All" : chamberLabel(ch)}
              </button>
            ))}
          </div>

          {/* Summary */}
          {summary && (
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 mb-4">
              <StatCard label="Total Raised" value={fmt(summary.total_raised)} icon={<TrendingUp className="h-4 w-4" style={{ color: "hsl(150, 55%, 45%)" }} />} color="hsl(150, 55%, 45%)" />
              <StatCard label="Total Spent" value={fmt(summary.total_spent)} icon={<TrendingDown className="h-4 w-4" style={{ color: "hsl(0, 65%, 50%)" }} />} color="hsl(0, 65%, 50%)" />
              <StatCard label="Candidates" value={summary.candidate_count.toLocaleString()} icon={<Users className="h-4 w-4 text-primary" />} />
            </div>
          )}

          {/* Candidate grid */}
          {candidates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No data yet. Click "Sync from State" to import data, then "Fetch Data" after a minute.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-[600px] overflow-y-auto pr-1">
              {candidates.map(c => (
                <CandidateCard key={c.reg_num} candidate={c} onClick={() => setSelected(c)} />
              ))}
            </div>
          )}
        </>
      )}

      {!fetched && !loading && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Click "Fetch Data" to load cached {meta.name} campaign finance data,
          or "Sync from State" to import fresh data.
        </div>
      )}

      <p className="text-[9px] text-muted-foreground mt-3 border-t border-border pt-2">
        Source: {meta.source} ·{" "}
        <a href={meta.source_url} target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-0.5">
          Data Portal <ExternalLink className="h-2 w-2" />
        </a>
      </p>
    </div>
  );
}
