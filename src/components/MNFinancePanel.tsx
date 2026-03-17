import { useState, useCallback } from "react";
import {
  DollarSign, Users, Building2, Landmark, ChevronDown, ChevronUp,
  Search, TrendingUp, TrendingDown, ExternalLink, Gavel, PieChart,
  ArrowLeft, Receipt, UserCheck, Banknote
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TopItem {
  name: string;
  amount: number;
}

interface CandidateFinance {
  committee_name: string;
  candidate_name: string;
  reg_num: string;
  chamber: "house" | "senate" | "governor" | "other";
  total_contributions: number;
  total_expenditures: number;
  net_cash: number;
  contribution_count: number;
  expenditure_count: number;
  in_kind_total: number;
  years_active: string[];
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

// ─── Components ─────────────────────────────────────────────────────────────

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
    <div className="candidate-card animate-fade-in cursor-pointer" onClick={onClick}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-xs font-semibold text-foreground">{candidate.candidate_name}</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border" style={{
              color: chamberColor(candidate.chamber),
              borderColor: `${chamberColor(candidate.chamber)}40`,
              backgroundColor: `${chamberColor(candidate.chamber)}10`,
            }}>
              {chamberLabel(candidate.chamber)}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">{candidate.committee_name}</p>
          <div className="flex items-center gap-3 mt-1.5 text-[11px]">
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" style={{ color: "hsl(150, 60%, 40%)" }} />
              <span className="font-bold">{fmt(candidate.total_contributions)}</span>
              <span className="text-muted-foreground">raised</span>
            </span>
            <span className="flex items-center gap-1">
              <TrendingDown className="h-3 w-3" style={{ color: "hsl(0, 60%, 50%)" }} />
              <span className="font-bold">{fmt(candidate.total_expenditures)}</span>
              <span className="text-muted-foreground">spent</span>
            </span>
            <span className={`font-bold ${netPositive ? "text-primary" : "text-destructive"}`}>
              {netPositive ? "+" : ""}{fmt(candidate.net_cash)}
            </span>
          </div>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
      </div>
    </div>
  );
}

function CandidateDetailView({ candidate, onBack }: { candidate: CandidateFinance; onBack: () => void }) {
  const netPositive = candidate.net_cash >= 0;
  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to list
      </button>

      <div className="flex items-center gap-2 flex-wrap mb-2">
        <h2 className="font-display text-lg font-bold text-foreground">{candidate.candidate_name}</h2>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border" style={{
          color: chamberColor(candidate.chamber),
          borderColor: `${chamberColor(candidate.chamber)}40`,
          backgroundColor: `${chamberColor(candidate.chamber)}10`,
        }}>
          {chamberLabel(candidate.chamber)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">{candidate.committee_name} • Active: {candidate.years_active.join(", ")}</p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <StatCard
          label="Total Raised"
          value={fmt(candidate.total_contributions)}
          icon={<TrendingUp className="h-4 w-4" style={{ color: "hsl(150, 60%, 40%)" }} />}
          color="hsl(150, 60%, 40%)"
        />
        <StatCard
          label="Total Spent"
          value={fmt(candidate.total_expenditures)}
          icon={<TrendingDown className="h-4 w-4" style={{ color: "hsl(0, 60%, 50%)" }} />}
          color="hsl(0, 60%, 50%)"
        />
        <StatCard
          label="Net Position"
          value={`${netPositive ? "+" : ""}${fmt(candidate.net_cash)}`}
          icon={<Banknote className="h-4 w-4 text-primary" />}
          color="hsl(var(--primary))"
        />
        <StatCard
          label="In-Kind"
          value={fmt(candidate.in_kind_total)}
          icon={<Receipt className="h-4 w-4" style={{ color: "hsl(45, 70%, 50%)" }} />}
          color="hsl(45, 70%, 50%)"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{candidate.contribution_count.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">Itemized Contributions</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{candidate.expenditure_count.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">Itemized Expenditures</p>
        </div>
      </div>

      {/* Contributor types */}
      <TopItemsList items={candidate.contributor_types} label="Contributions by Type" />

      {/* Top Contributors */}
      <div className="mt-3">
        <TopItemsList items={candidate.top_contributors} label="Top Contributors (>$200)" />
      </div>

      {/* Expenditure types */}
      <div className="mt-3">
        <TopItemsList items={candidate.expenditure_types} label="Expenditures by Type" />
      </div>

      {/* Top Vendors */}
      <div className="mt-3">
        <TopItemsList items={candidate.top_vendors} label="Top Vendors/Payees" />
      </div>
    </div>
  );
}

// ─── Main Panel ─────────────────────────────────────────────────────────────

export function MNFinancePanel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CandidateFinance[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [chamber, setChamber] = useState<ChamberFilter>("all");
  const [year, setYear] = useState("");
  const [search, setSearch] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateFinance | null>(null);
  const [fetched, setFetched] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedCandidate(null);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const params = new URLSearchParams();
      if (chamber !== "all") params.set("chamber", chamber);
      if (year) params.set("year", year);
      if (search) params.set("search", search);

      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/mn-cfb-finance?${params.toString()}`,
        { headers: { "Content-Type": "application/json" } }
      );
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || "Failed to fetch");

      setCandidates(data.candidates || []);
      setSummary(data.summary || null);
      setFetched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [chamber, year, search]);

  if (selectedCandidate) {
    return <CandidateDetailView candidate={selectedCandidate} onBack={() => setSelectedCandidate(null)} />;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <DollarSign className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-bold text-foreground">Minnesota Campaign Finance</h2>
      </div>

      <div className="rounded-lg border border-border bg-card/50 p-3 mb-4 text-xs text-muted-foreground">
        <p>
          Itemized contributions and expenditures over $200 from the{" "}
          <a href="https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
            MN Campaign Finance Board <ExternalLink className="h-3 w-3" />
          </a>
          {" "}(2015–present). Click any candidate for detailed breakdowns.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="inline-flex rounded-lg border border-border overflow-hidden">
          {(["all", "house", "senate", "governor"] as ChamberFilter[]).map((ch, i) => (
            <button
              key={ch}
              onClick={() => setChamber(ch)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${i > 0 ? "border-l border-border" : ""} ${
                chamber === ch ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {ch === "all" ? "All" : chamberLabel(ch)}
            </button>
          ))}
        </div>

        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground"
        >
          <option value="">All Years</option>
          {["2025", "2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015"].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <div className="flex items-center gap-2 flex-1 min-w-[160px] rounded-lg border border-border bg-card px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchData()}
            placeholder="Search candidates…"
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Loading…
            </>
          ) : "Fetch Data"}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            <span className="text-sm">Fetching MN Campaign Finance Board data…</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive mb-4">
          {error}
        </div>
      )}

      {/* Summary */}
      {!loading && summary && fetched && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <StatCard
              label="Total Raised"
              value={fmt(summary.total_raised)}
              icon={<TrendingUp className="h-4 w-4" style={{ color: "hsl(150, 60%, 40%)" }} />}
              color="hsl(150, 60%, 40%)"
            />
            <StatCard
              label="Total Spent"
              value={fmt(summary.total_spent)}
              icon={<TrendingDown className="h-4 w-4" style={{ color: "hsl(0, 60%, 50%)" }} />}
              color="hsl(0, 60%, 50%)"
            />
            <StatCard
              label="Candidates"
              value={String(summary.candidate_count)}
              icon={<Users className="h-4 w-4 text-primary" />}
            />
          </div>

          <p className="text-sm text-muted-foreground mb-3">{candidates.length} candidates</p>

          <div className="grid gap-2 sm:grid-cols-2">
            {candidates.map((c) => (
              <CandidateCard key={c.reg_num} candidate={c} onClick={() => setSelectedCandidate(c)} />
            ))}
          </div>

          {candidates.length === 0 && (
            <div className="text-center py-12">
              <DollarSign className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No candidates found for these filters.</p>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!loading && !fetched && !error && (
        <div className="text-center py-16">
          <DollarSign className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="font-display text-lg font-semibold text-foreground mb-1">MN Campaign Finance Data</h3>
          <p className="text-sm text-muted-foreground">Select filters and click "Fetch Data" to load campaign finance reports from the Minnesota CFB.</p>
        </div>
      )}
    </div>
  );
}
