import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingUp, TrendingDown, Building2, Users } from "lucide-react";

interface FinanceRow {
  id: string;
  candidate_name: string;
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

export function CampaignFinancePanel({ candidateSlug }: { candidateSlug: string }) {
  const [records, setRecords] = useState<FinanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("campaign_finance")
        .select("*")
        .eq("candidate_slug", candidateSlug)
        .order("source", { ascending: true });
      setRecords((data as FinanceRow[] | null) ?? []);
      setLoading(false);
    }
    load();
  }, [candidateSlug]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 mb-6 animate-pulse">
        <div className="h-4 w-48 bg-muted rounded mb-3" />
        <div className="h-24 bg-muted rounded" />
      </div>
    );
  }
  if (records.length === 0) return null;

  const primary = records[0];
  const industries = (primary.top_industries as any[] | null) ?? [];
  const contributors = (primary.top_contributors as any[] | null) ?? [];

  return (
    <div className="rounded-xl border border-border bg-card p-6 mb-6">
      <h2 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        <DollarSign className="h-5 w-5 text-primary" />
        Campaign Finance — {primary.cycle} Cycle
      </h2>

      {/* Top-line numbers */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-4">
        {[
          { label: "Total Raised", value: primary.total_raised, color: "hsl(150, 55%, 45%)" },
          { label: "Total Spent", value: primary.total_spent, color: "hsl(0, 65%, 50%)" },
          { label: "Cash on Hand", value: primary.cash_on_hand, color: "hsl(210, 80%, 50%)" },
          { label: "Total Debt", value: primary.total_debt, color: "hsl(30, 80%, 50%)" },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-muted/20 p-3 text-center">
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{item.label}</p>
            <p className="text-xl font-display font-bold" style={{ color: item.color }}>
              {formatMoney(item.value)}
            </p>
          </div>
        ))}
      </div>

      {/* Funding breakdown */}
      <div className="grid gap-4 sm:grid-cols-2 mb-4">
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
            <Users className="inline h-3 w-3 mr-1" />Funding Sources
          </p>
          <div className="space-y-2">
            {[
              { label: "Individual", value: primary.individual_contributions, total: primary.total_raised },
              { label: "PAC", value: primary.pac_contributions, total: primary.total_raised },
              { label: "Self-Funding", value: primary.self_funding, total: primary.total_raised },
            ].map((item) => {
              const pct = item.value && item.total ? Math.round((item.value / item.total) * 100) : null;
              return (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-xs text-foreground">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">{formatMoney(item.value)}</span>
                    {pct != null && <span className="text-[9px] text-muted-foreground">({pct}%)</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Donor Profile</p>
          <div className="space-y-2">
            <PctBar label="Small Dollar" pct={primary.small_dollar_pct} color="hsl(150, 55%, 45%)" />
            <PctBar label="Large Donor" pct={primary.large_donor_pct} color="hsl(30, 80%, 50%)" />
            <PctBar label="Out of State" pct={primary.out_of_state_pct} color="hsl(280, 60%, 55%)" />
          </div>
        </div>
      </div>

      {/* Top Industries & Contributors */}
      <div className="grid gap-4 sm:grid-cols-2">
        {industries.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              <Building2 className="inline h-3 w-3 mr-1" />Top Industries
            </p>
            <div className="space-y-1.5">
              {industries.slice(0, 5).map((ind: any, i: number) => {
                const maxAmt = industries[0]?.amount ?? 1;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-foreground">{ind.name}</span>
                      <span className="font-bold">{formatMoney(ind.amount)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-primary/60" style={{ width: `${(ind.amount / maxAmt) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {contributors.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Top Contributors</p>
            <div className="space-y-1.5">
              {contributors.slice(0, 5).map((c: any, i: number) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-foreground">{c.name}</span>
                  <span className="font-bold">{formatMoney(c.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sources */}
      <p className="text-[9px] text-muted-foreground mt-3 border-t border-border pt-2">
        Sources: {records.map(r => r.source).join(", ")} · Filed {primary.filing_date} · {primary.cycle} cycle
      </p>
    </div>
  );
}
