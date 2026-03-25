import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, Search, Building2, TrendingUp, ArrowLeft, Filter } from "lucide-react";

interface FinanceRow {
  id: string;
  candidate_name: string;
  candidate_slug: string | null;
  office: string;
  state_abbr: string;
  district: string | null;
  party: string | null;
  cycle: number;
  source: string;
  total_raised: number | null;
  total_spent: number | null;
  cash_on_hand: number | null;
  total_debt: number | null;
  individual_contributions: number | null;
  pac_contributions: number | null;
  self_funding: number | null;
  small_dollar_pct: number | null;
  large_donor_pct: number | null;
  out_of_state_pct: number | null;
  top_industries: any;
  top_contributors: any;
  filing_date: string | null;
  raw_data: any;
}

function formatMoney(n: number | null) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

type OfficeFilter = "all" | "house" | "senate" | "governor" | "state_aggregate";
type SortKey = "total_raised" | "total_spent" | "cash_on_hand" | "candidate_name";

export function CampaignFinanceSection({ onNavigateSlug }: { onNavigateSlug?: (slug: string) => boolean }) {
  const [records, setRecords] = useState<FinanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [officeFilter, setOfficeFilter] = useState<OfficeFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("total_raised");
  const [selectedRecord, setSelectedRecord] = useState<FinanceRow | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      // Fetch all records in batches to avoid the 1000-row limit
      const all: FinanceRow[] = [];
      const PAGE_SIZE = 1000;
      let from = 0;
      let done = false;
      while (!done) {
        const { data } = await supabase
          .from("campaign_finance")
          .select("*")
          .order("total_raised", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        const batch = (data as FinanceRow[] | null) ?? [];
        all.push(...batch);
        if (batch.length < PAGE_SIZE) done = true;
        else from += PAGE_SIZE;
      }
      setRecords(all);
      setLoading(false);
    }
    load();
  }, []);

  // Separate candidates from state aggregates
  const candidateRecords = useMemo(() =>
    records.filter(r => !(r.raw_data as any)?.type?.includes("state_aggregate")),
  [records]);

  const stateRecords = useMemo(() =>
    records.filter(r => (r.raw_data as any)?.type === "state_aggregate"),
  [records]);

  // Deduplicate by slug (take first = FEC source)
  const uniqueCandidates = useMemo(() => {
    const seen = new Set<string>();
    return candidateRecords.filter(r => {
      const key = r.candidate_slug || r.candidate_name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [candidateRecords]);

  const filtered = useMemo(() => {
    let list = officeFilter === "state_aggregate" ? stateRecords : uniqueCandidates;
    if (officeFilter !== "all" && officeFilter !== "state_aggregate") {
      list = list.filter(r => r.office === officeFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.candidate_name.toLowerCase().includes(q) ||
        r.state_abbr.toLowerCase().includes(q) ||
        (r.district || "").toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sortBy === "candidate_name") return a.candidate_name.localeCompare(b.candidate_name);
      return (b[sortBy] ?? 0) - (a[sortBy] ?? 0);
    });
  }, [uniqueCandidates, stateRecords, officeFilter, search, sortBy]);

  // Stats
  const totalRaised = useMemo(() => uniqueCandidates.reduce((s, r) => s + (r.total_raised ?? 0), 0), [uniqueCandidates]);
  const avgRaised = uniqueCandidates.length ? totalRaised / uniqueCandidates.length : 0;

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse">
            <div className="h-4 w-40 bg-muted rounded mb-2" />
            <div className="h-16 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (selectedRecord) {
    return <RecordDetail record={selectedRecord} allRecords={records} onBack={() => setSelectedRecord(null)} onNavigateSlug={onNavigateSlug} />;
  }

  return (
    <div>
      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-4">
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Total Tracked</p>
          <p className="text-2xl font-display font-bold text-foreground">{uniqueCandidates.length}</p>
          <p className="text-[10px] text-muted-foreground">candidates</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Total Raised</p>
          <p className="text-2xl font-display font-bold" style={{ color: "hsl(150, 55%, 45%)" }}>{formatMoney(totalRaised)}</p>
          <p className="text-[10px] text-muted-foreground">all candidates</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Avg Raised</p>
          <p className="text-2xl font-display font-bold" style={{ color: "hsl(210, 80%, 50%)" }}>{formatMoney(avgRaised)}</p>
          <p className="text-[10px] text-muted-foreground">per candidate</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">States Tracked</p>
          <p className="text-2xl font-display font-bold text-foreground">{stateRecords.length}</p>
          <p className="text-[10px] text-muted-foreground">state aggregates</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search candidates, states, districts…"
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-background"
          />
        </div>
        <div className="flex gap-1">
          {([
            { id: "all", label: "All" },
            { id: "house", label: "House" },
            { id: "senate", label: "Senate" },
            { id: "governor", label: "Gov" },
            { id: "state_aggregate", label: "By State" },
          ] as { id: OfficeFilter; label: string }[]).map(f => (
            <button
              key={f.id}
              onClick={() => setOfficeFilter(f.id)}
              className={`win98-button text-[10px] ${officeFilter === f.id ? "font-bold" : ""}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as SortKey)}
          className="text-[10px] border border-border rounded px-2 py-1 bg-background"
        >
          <option value="total_raised">Sort: Raised ↓</option>
          <option value="total_spent">Sort: Spent ↓</option>
          <option value="cash_on_hand">Sort: Cash ↓</option>
          <option value="candidate_name">Sort: Name A-Z</option>
        </select>
      </div>

      {/* Results */}
      <div className="space-y-1.5">
        {filtered.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">No campaign finance records found.</div>
        )}
        {filtered.map(r => {
          const isState = (r.raw_data as any)?.type === "state_aggregate";
          return (
            <button
              key={r.id}
              onClick={() => setSelectedRecord(r)}
              className="w-full text-left rounded-lg border border-border bg-card p-3 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">{isState ? "🗺️" : r.office === "senate" ? "🏛️" : r.office === "governor" ? "👔" : "🏠"}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-foreground truncate">
                      {isState ? `${r.state_abbr} — All Races` : r.candidate_name}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {!isState && <>{r.party && `(${r.party}) `}{r.district || r.state_abbr} · </>}
                      {r.source} · {r.cycle}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-bold" style={{ color: "hsl(150, 55%, 45%)" }}>{formatMoney(r.total_raised)}</div>
                    <div className="text-[9px] text-muted-foreground">raised</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold" style={{ color: "hsl(210, 80%, 50%)" }}>{formatMoney(r.cash_on_hand)}</div>
                    <div className="text-[9px] text-muted-foreground">cash</div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-[9px] text-muted-foreground mt-3 border-t border-border pt-2">
        Sources: FEC filings, OpenSecrets.org · 2026 cycle data
      </p>
    </div>
  );
}

function RecordDetail({ record, allRecords, onBack, onNavigateSlug }: {
  record: FinanceRow;
  allRecords: FinanceRow[];
  onBack: () => void;
  onNavigateSlug?: (slug: string) => boolean;
}) {
  const isState = (record.raw_data as any)?.type === "state_aggregate";
  const industries = (record.top_industries as any[] | null) ?? [];
  const contributors = (record.top_contributors as any[] | null) ?? [];

  // For state aggregates, show candidate breakdown
  const stateCandidates = isState
    ? allRecords.filter(r => r.state_abbr === record.state_abbr && !(r.raw_data as any)?.type?.includes("state_aggregate"))
    : [];

  // Dedup
  const uniqueStateCandidates = useMemo(() => {
    const seen = new Set<string>();
    return stateCandidates.filter(r => {
      const key = r.candidate_slug || r.candidate_name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [stateCandidates]);

  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to all finance data
      </button>

      <div className="rounded-xl border border-border bg-card p-6 mb-4">
        <h2 className="font-display text-lg font-bold text-foreground mb-1 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          {isState ? `${record.state_abbr} — Statewide Finance Summary` : record.candidate_name}
        </h2>
        {!isState && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            {record.party && <span>({record.party})</span>}
            <span>{record.district || record.state_abbr}</span>
            <span>·</span>
            <span className="capitalize">{record.office}</span>
            {record.candidate_slug && onNavigateSlug && (
              <>
                <span>·</span>
                <button
                  onClick={() => onNavigateSlug(record.candidate_slug!)}
                  className="text-primary hover:underline text-xs"
                >
                  View Profile →
                </button>
              </>
            )}
          </div>
        )}

        {/* Top-line numbers */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-4">
          {[
            { label: "Total Raised", value: record.total_raised, color: "hsl(150, 55%, 45%)" },
            { label: "Total Spent", value: record.total_spent, color: "hsl(0, 65%, 50%)" },
            { label: "Cash on Hand", value: record.cash_on_hand, color: "hsl(210, 80%, 50%)" },
            { label: "Total Debt", value: record.total_debt, color: "hsl(30, 80%, 50%)" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-border bg-muted/20 p-3 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{item.label}</p>
              <p className="text-xl font-display font-bold" style={{ color: item.color }}>{formatMoney(item.value)}</p>
            </div>
          ))}
        </div>

        {/* Funding breakdown (only for candidates) */}
        {!isState && (
          <div className="grid gap-4 sm:grid-cols-2 mb-4">
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Funding Sources</p>
              {[
                { label: "Individual", value: record.individual_contributions },
                { label: "PAC", value: record.pac_contributions },
                { label: "Self-Funding", value: record.self_funding },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between mb-1">
                  <span className="text-xs text-foreground">{item.label}</span>
                  <span className="text-xs font-bold">{formatMoney(item.value)}</span>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Donor Profile</p>
              <div className="space-y-2">
                {[
                  { label: "Small Dollar", pct: record.small_dollar_pct, color: "hsl(150, 55%, 45%)" },
                  { label: "Large Donor", pct: record.large_donor_pct, color: "hsl(30, 80%, 50%)" },
                  { label: "Out of State", pct: record.out_of_state_pct, color: "hsl(280, 60%, 55%)" },
                ].map(item => item.pct != null ? (
                  <div key={item.label} className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-20 shrink-0">{item.label}</span>
                    <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
                    </div>
                    <span className="text-[10px] font-bold w-8 text-right">{item.pct}%</span>
                  </div>
                ) : null)}
              </div>
            </div>
          </div>
        )}

        {/* Industries & Contributors */}
        <div className="grid gap-4 sm:grid-cols-2">
          {industries.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                <Building2 className="inline h-3 w-3 mr-1" />Top Industries
              </p>
              {industries.slice(0, 5).map((ind: any, i: number) => {
                const maxAmt = industries[0]?.amount ?? 1;
                return (
                  <div key={i} className="mb-1.5">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span>{ind.name}</span>
                      <span className="font-bold">{formatMoney(ind.amount)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-primary/60" style={{ width: `${(ind.amount / maxAmt) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {contributors.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Top Contributors</p>
              {contributors.slice(0, 5).map((c: any, i: number) => (
                <div key={i} className="flex justify-between text-xs mb-1">
                  <span>{c.name}</span>
                  <span className="font-bold">{formatMoney(c.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* State candidates breakdown */}
        {isState && uniqueStateCandidates.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Candidates in {record.state_abbr} ({uniqueStateCandidates.length})
            </p>
            <div className="space-y-1">
              {uniqueStateCandidates.sort((a, b) => (b.total_raised ?? 0) - (a.total_raised ?? 0)).map(c => (
                <div key={c.id} className="flex items-center justify-between text-xs rounded-lg border border-border p-2">
                  <div>
                    <span className="font-bold">{c.candidate_name}</span>
                    <span className="text-muted-foreground ml-1">({c.party}) {c.district}</span>
                  </div>
                  <span className="font-bold" style={{ color: "hsl(150, 55%, 45%)" }}>{formatMoney(c.total_raised)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="text-[9px] text-muted-foreground border-t border-border pt-2">
        Sources: {record.source} · Filed {record.filing_date} · {record.cycle} cycle
      </p>
    </div>
  );
}
