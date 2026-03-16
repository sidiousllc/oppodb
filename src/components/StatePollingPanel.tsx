import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface PollRow {
  id: string;
  source: string;
  poll_type: string;
  candidate_or_topic: string;
  date_conducted: string;
  approve_pct: number | null;
  disapprove_pct: number | null;
  margin: number | null;
  sample_size: number | null;
  raw_data: Record<string, unknown>;
}

function MarginBadge({ margin }: { margin: number | null }) {
  if (margin === null) return null;
  const positive = margin > 0;
  const Icon = positive ? TrendingUp : margin < 0 ? TrendingDown : Minus;
  const label = positive ? `+${margin}` : String(margin);
  const color = positive ? "hsl(150, 55%, 45%)" : margin < 0 ? "hsl(0, 65%, 50%)" : "hsl(var(--muted-foreground))";
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: `${color}15`, color }}>
      <Icon className="h-2.5 w-2.5" />{label}
    </span>
  );
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function StatePollingPanel({ stateAbbr }: { stateAbbr: string }) {
  const [polls, setPolls] = useState<PollRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("polling_data")
        .select("id, source, poll_type, candidate_or_topic, date_conducted, approve_pct, disapprove_pct, margin, sample_size, raw_data")
        .order("date_conducted", { ascending: false });

      const filtered = (data ?? []).filter((p: any) => {
        const rd = p.raw_data as any;
        return rd?.scope === "state" && rd?.state_abbr === stateAbbr;
      });
      setPolls(filtered);
      setLoading(false);
    }
    load();
  }, [stateAbbr]);

  const approvalPolls = useMemo(() => polls.filter((p) => p.poll_type === "approval"), [polls]);
  const issuePolls = useMemo(() => polls.filter((p) => p.poll_type === "issue"), [polls]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 mb-6 animate-pulse">
        <div className="h-4 w-40 bg-muted rounded mb-3" />
        <div className="h-20 bg-muted rounded" />
      </div>
    );
  }

  if (polls.length === 0) return null;

  const latestApproval = approvalPolls[0];

  return (
    <div className="rounded-xl border border-border bg-card p-6 mb-6">
      <h2 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        State Polling — {stateAbbr}
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Approval */}
        {latestApproval && (
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Trump Approval — {stateAbbr}
            </p>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl font-display font-bold" style={{ color: "hsl(150, 55%, 45%)" }}>
                {latestApproval.approve_pct}%
              </span>
              <span className="text-muted-foreground">/</span>
              <span className="text-2xl font-display font-bold" style={{ color: "hsl(0, 65%, 50%)" }}>
                {latestApproval.disapprove_pct}%
              </span>
              <MarginBadge margin={latestApproval.margin} />
            </div>
            <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full"
                style={{
                  width: `${((latestApproval.approve_pct ?? 0) / ((latestApproval.approve_pct ?? 0) + (latestApproval.disapprove_pct ?? 0) || 100)) * 100}%`,
                  backgroundColor: "hsl(150, 55%, 45%)",
                }}
              />
              <div
                className="h-full"
                style={{
                  width: `${((latestApproval.disapprove_pct ?? 0) / ((latestApproval.approve_pct ?? 0) + (latestApproval.disapprove_pct ?? 0) || 100)) * 100}%`,
                  backgroundColor: "hsl(0, 65%, 50%)",
                }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              {latestApproval.source} · {formatDate(latestApproval.date_conducted)} · n={latestApproval.sample_size?.toLocaleString()}
            </p>
          </div>
        )}

        {/* Issue Polling */}
        {issuePolls.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Issue Approval — {stateAbbr}
            </p>
            <div className="space-y-2">
              {issuePolls.map((p) => {
                const total = (p.approve_pct ?? 0) + (p.disapprove_pct ?? 0) || 100;
                return (
                  <div key={p.id}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-medium text-foreground">{p.candidate_or_topic}</span>
                      <MarginBadge margin={p.margin} />
                    </div>
                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full" style={{ width: `${((p.approve_pct ?? 0) / total) * 100}%`, backgroundColor: "hsl(150, 55%, 45%)" }} />
                      <div className="h-full" style={{ width: `${((p.disapprove_pct ?? 0) / total) * 100}%`, backgroundColor: "hsl(0, 65%, 50%)" }} />
                    </div>
                    <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                      <span style={{ color: "hsl(150, 55%, 45%)" }}>{p.approve_pct}% approve</span>
                      <span style={{ color: "hsl(0, 65%, 50%)" }}>{p.disapprove_pct}% disapprove</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Approval Trend */}
      {approvalPolls.length > 1 && (
        <div className="mt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Approval Trend</p>
          <div className="space-y-1.5">
            {approvalPolls.map((p) => {
              const total = (p.approve_pct ?? 0) + (p.disapprove_pct ?? 0) || 100;
              return (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-20 shrink-0">{formatDate(p.date_conducted)}</span>
                  <div className="flex-1 flex h-3 overflow-hidden rounded-full bg-muted">
                    <div className="h-full" style={{ width: `${((p.approve_pct ?? 0) / total) * 100}%`, backgroundColor: "hsl(150, 55%, 45%)" }} />
                    <div className="h-full" style={{ width: `${((p.disapprove_pct ?? 0) / total) * 100}%`, backgroundColor: "hsl(0, 65%, 50%)" }} />
                  </div>
                  <span className="text-[10px] font-bold w-16 text-right shrink-0">
                    <span style={{ color: "hsl(150, 55%, 45%)" }}>{p.approve_pct}%</span>
                    <span className="text-muted-foreground"> / </span>
                    <span style={{ color: "hsl(0, 65%, 50%)" }}>{p.disapprove_pct}%</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[9px] text-muted-foreground mt-3 border-t border-border pt-2">
        Source: Civiqs state-level tracking polls among registered voters.
      </p>
    </div>
  );
}
