import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingUp, TrendingDown, Building2, Users, Landmark, ChevronDown, ChevronUp, User } from "lucide-react";
import { getCandidatesForDistrict, getCandidatesForState, candidateDistrictMap } from "@/data/candidateDistricts";

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
}

interface CandidateInfo {
  slug: string;
  name: string;
  district_id: string | null;
  type: string;
  finance?: FinanceRow;
}

function formatMoney(n: number | null) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function PctBar({ label, pct, color }: { label: string; pct: number | null; color: string }) {
  if (pct == null) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-24 shrink-0">{label}</span>
      <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-bold w-8 text-right">{pct}%</span>
    </div>
  );
}

const partyColor = (p: string | null) => {
  if (!p) return "hsl(var(--muted-foreground))";
  const lower = p.toLowerCase();
  if (lower === "r" || lower === "republican") return "hsl(0, 75%, 50%)";
  if (lower === "d" || lower === "democrat" || lower === "democratic") return "hsl(210, 80%, 50%)";
  return "hsl(var(--muted-foreground))";
};

function slugToName(slug: string): string {
  return slug
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface AreaFinancePanelProps {
  stateAbbr: string;
  districtId?: string;
  title?: string;
}

export function AreaFinancePanel({ stateAbbr, districtId, title }: AreaFinancePanelProps) {
  const [records, setRecords] = useState<FinanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [candidateProfiles, setCandidateProfiles] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      setLoading(true);

      // Load finance data
      const { data } = await supabase
        .from("campaign_finance")
        .select("*")
        .eq("state_abbr", stateAbbr)
        .order("total_raised", { ascending: false, nullsFirst: false });
      setRecords((data as FinanceRow[] | null) ?? []);

      // Load candidate profile names for cross-referencing
      const districtCandidateSlugs = districtId ? getCandidatesForDistrict(districtId) : [];
      const stateCandidateSlugs = getCandidatesForState(stateAbbr);
      const allSlugs = [...new Set([...districtCandidateSlugs, ...stateCandidateSlugs])];

      if (allSlugs.length > 0) {
        const { data: profiles } = await supabase
          .from("candidate_profiles")
          .select("slug, name")
          .in("slug", allSlugs)
          .eq("is_subpage", false);
        const nameMap: Record<string, string> = {};
        for (const p of profiles || []) {
          nameMap[p.slug] = p.name;
        }
        setCandidateProfiles(nameMap);
      }

      setLoading(false);
    }
    load();
  }, [stateAbbr, districtId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 mb-6 animate-pulse">
        <div className="h-4 w-48 bg-muted rounded mb-3" />
        <div className="h-24 bg-muted rounded" />
      </div>
    );
  }

  // Build a merged candidate list for the district
  const districtNum = districtId?.split("-")[1];
  const knownDistrictSlugs = districtId ? getCandidatesForDistrict(districtId) : [];

  // Finance records that match the district
  const districtFinanceRecords = districtId
    ? records.filter(r => r.office !== "all" && r.district === districtId)
    : [];

  // Build merged candidate info for the district
  const districtCandidates: CandidateInfo[] = [];
  const seenSlugs = new Set<string>();

  // First: candidates with finance data for this district
  for (const r of districtFinanceRecords) {
    const slug = r.candidate_slug || "";
    seenSlugs.add(slug);
    districtCandidates.push({
      slug,
      name: r.candidate_name,
      district_id: r.district,
      type: r.office,
      finance: r,
    });
  }

  // Second: known candidates from candidateDistricts that don't have finance records
  for (const slug of knownDistrictSlugs) {
    if (seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);

    // Try to find finance data by slug across the state
    const financeBySlug = records.find(r => r.candidate_slug === slug);
    const info = candidateDistrictMap[slug];
    districtCandidates.push({
      slug,
      name: candidateProfiles[slug] || financeBySlug?.candidate_name || slugToName(slug),
      district_id: info?.district_id || districtId || null,
      type: info?.type || "house",
      finance: financeBySlug || undefined,
    });
  }

  // Statewide races
  const stateAggregate = records.find(r => r.office === "all");
  const senateRecords = records.filter(r => r.office === "senate");
  const governorRecords = records.filter(r => r.office === "governor");
  const houseRecords = records.filter(r => r.office === "house" && (!districtId || r.district !== districtId));

  // If no data at all
  if (records.length === 0 && districtCandidates.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-6 mb-6">
      <h2 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        <DollarSign className="h-5 w-5 text-primary" />
        {title || (districtId ? `Campaign Finance — ${districtId}` : `Campaign Finance — ${stateAbbr}`)}
      </h2>

      {/* State aggregate summary */}
      {stateAggregate && (
        <div className="rounded-lg border border-border bg-muted/20 p-4 mb-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
            {stateAbbr} Statewide Totals · {stateAggregate.cycle} Cycle
          </p>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total Raised", value: stateAggregate.total_raised, color: "hsl(150, 55%, 45%)" },
              { label: "Total Spent", value: stateAggregate.total_spent, color: "hsl(0, 65%, 50%)" },
              { label: "Cash on Hand", value: stateAggregate.cash_on_hand, color: "hsl(210, 80%, 50%)" },
              { label: "PAC Money", value: stateAggregate.pac_contributions, color: "hsl(30, 80%, 50%)" },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{item.label}</p>
                <p className="text-xl font-display font-bold" style={{ color: item.color }}>
                  {formatMoney(item.value)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1.5">
            <PctBar label="Small Dollar" pct={stateAggregate.small_dollar_pct} color="hsl(150, 55%, 45%)" />
            <PctBar label="Out of State" pct={stateAggregate.out_of_state_pct} color="hsl(280, 60%, 55%)" />
          </div>
          {(() => {
            const industries = (stateAggregate.top_industries as any[] | null) ?? [];
            if (industries.length === 0) return null;
            return (
              <div className="mt-3 pt-3 border-t border-border/50">
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  <Building2 className="inline h-3 w-3 mr-1" />Top Industries
                </p>
                <div className="flex flex-wrap gap-2">
                  {industries.slice(0, 4).map((ind: any, i: number) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[10px] rounded-full border border-border px-2 py-0.5 bg-muted/40">
                      {ind.name}: <strong>{formatMoney(ind.amount)}</strong>
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* District candidates — merged view */}
      {districtCandidates.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
            <User className="h-3 w-3" />
            {districtId} Candidates
          </p>
          <div className="space-y-2">
            {districtCandidates.map((c) =>
              c.finance ? (
                <CandidateFinanceRow key={c.slug || c.name} record={c.finance} displayName={c.name} />
              ) : (
                <div key={c.slug} className="rounded-lg border border-border bg-muted/10 p-3 flex items-center gap-3">
                  <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-foreground">{c.name}</span>
                    <span className="ml-2 text-[10px] text-muted-foreground capitalize">({c.type})</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground italic">No FEC data available</span>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Senate races */}
      {senateRecords.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
            <Landmark className="h-3 w-3" />Senate Races
          </p>
          <div className="space-y-2">
            {senateRecords.map((r) => (
              <CandidateFinanceRow key={r.id} record={r} />
            ))}
          </div>
        </div>
      )}

      {/* Governor races */}
      {governorRecords.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Governor Races
          </p>
          <div className="space-y-2">
            {governorRecords.map((r) => (
              <CandidateFinanceRow key={r.id} record={r} />
            ))}
          </div>
        </div>
      )}

      {/* House races — collapsible since there can be many */}
      {houseRecords.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 hover:text-foreground transition-colors"
          >
            <Building2 className="h-3 w-3" />
            Other House Races ({houseRecords.length})
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {expanded && (
            <div className="space-y-2">
              {houseRecords.map((r) => (
                <CandidateFinanceRow key={r.id} record={r} />
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-[9px] text-muted-foreground mt-3 border-t border-border pt-2">
        Sources: FEC, OpenSecrets · {stateAggregate?.cycle ?? records[0]?.cycle ?? 2026} cycle
      </p>
    </div>
  );
}

function CandidateFinanceRow({ record: r, displayName }: { record: FinanceRow; displayName?: string }) {
  const [open, setOpen] = useState(false);
  const industries = (r.top_industries as any[] | null) ?? [];
  const contributors = (r.top_contributors as any[] | null) ?? [];
  const name = displayName || r.candidate_name;

  return (
    <div className="rounded-lg border border-border bg-muted/10 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/30 transition-colors"
      >
        <span
          className="inline-block h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: partyColor(r.party) }}
        />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-foreground">{name}</span>
          {r.district && (
            <span className="ml-2 text-[10px] text-muted-foreground">{r.district}</span>
          )}
          <span className="ml-2 text-[10px] text-muted-foreground">({r.party || "?"})</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-xs font-bold" style={{ color: "hsl(150, 55%, 45%)" }}>
              {formatMoney(r.total_raised)}
            </p>
            <p className="text-[9px] text-muted-foreground">raised</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold" style={{ color: "hsl(210, 80%, 50%)" }}>
              {formatMoney(r.cash_on_hand)}
            </p>
            <p className="text-[9px] text-muted-foreground">COH</p>
          </div>
          {open ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-0 border-t border-border/50">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-3 mt-3">
            {[
              { label: "Total Raised", value: r.total_raised, color: "hsl(150, 55%, 45%)" },
              { label: "Total Spent", value: r.total_spent, color: "hsl(0, 65%, 50%)" },
              { label: "Cash on Hand", value: r.cash_on_hand, color: "hsl(210, 80%, 50%)" },
              { label: "Total Debt", value: r.total_debt, color: "hsl(30, 80%, 50%)" },
            ].map((item) => (
              <div key={item.label} className="rounded-md border border-border bg-background p-2 text-center">
                <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">{item.label}</p>
                <p className="text-base font-display font-bold" style={{ color: item.color }}>
                  {formatMoney(item.value)}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 mb-2">
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Funding Sources</p>
              <div className="space-y-1.5">
                {[
                  { label: "Individual", value: r.individual_contributions, total: r.total_raised },
                  { label: "PAC", value: r.pac_contributions, total: r.total_raised },
                  { label: "Self-Funding", value: r.self_funding, total: r.total_raised },
                ].map((item) => {
                  const pct = item.value && item.total ? Math.round((item.value / item.total) * 100) : null;
                  return (
                    <div key={item.label} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{item.label}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold">{formatMoney(item.value)}</span>
                        {pct != null && <span className="text-[9px] text-muted-foreground">({pct}%)</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Donor Profile</p>
              <div className="space-y-1.5">
                <PctBar label="Small Dollar" pct={r.small_dollar_pct} color="hsl(150, 55%, 45%)" />
                <PctBar label="Large Donor" pct={r.large_donor_pct} color="hsl(30, 80%, 50%)" />
                <PctBar label="Out of State" pct={r.out_of_state_pct} color="hsl(280, 60%, 55%)" />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {industries.length > 0 && (
              <div className="rounded-md border border-border bg-background p-3">
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  <Building2 className="inline h-3 w-3 mr-1" />Top Industries
                </p>
                <div className="space-y-1">
                  {industries.slice(0, 5).map((ind: any, i: number) => {
                    const maxAmt = industries[0]?.amount ?? 1;
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-foreground">{ind.name}</span>
                          <span className="font-bold">{formatMoney(ind.amount)}</span>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-primary/60" style={{ width: `${(ind.amount / maxAmt) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {contributors.length > 0 && (
              <div className="rounded-md border border-border bg-background p-3">
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Top Contributors</p>
                <div className="space-y-1">
                  {contributors.slice(0, 5).map((c: any, i: number) => (
                    <div key={i} className="flex justify-between text-[10px]">
                      <span className="text-foreground">{c.name}</span>
                      <span className="font-bold">{formatMoney(c.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
