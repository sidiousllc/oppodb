import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";

interface PollRow {
  id: string;
  source: string;
  poll_type: string;
  candidate_or_topic: string;
  date_conducted: string;
  approve_pct: number | null;
  disapprove_pct: number | null;
  favor_pct: number | null;
  oppose_pct: number | null;
  margin: number | null;
  sample_size: number | null;
  sample_type: string | null;
  methodology: string | null;
  raw_data: any;
}

function MarginBadge({ margin }: { margin: number | null }) {
  if (margin === null) return null;
  const positive = margin > 0;
  const Icon = positive ? TrendingUp : margin < 0 ? TrendingDown : Minus;
  const label = positive ? `+${margin}` : String(margin);
  const color = positive ? "hsl(150, 55%, 45%)" : margin < 0 ? "hsl(0, 65%, 50%)" : "hsl(var(--muted-foreground))";
  return (
    <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-bold" style={{ backgroundColor: `${color}15`, color }}>
      <Icon className="h-2.5 w-2.5" />{label}
    </span>
  );
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatFullDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function DistrictPollingPanel({ districtId }: { districtId: string }) {
  const [polls, setPolls] = useState<PollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      // Fetch all polling data that could be district-scoped
      const { data } = await supabase
        .from("polling_data")
        .select("id, source, poll_type, candidate_or_topic, date_conducted, approve_pct, disapprove_pct, favor_pct, oppose_pct, margin, sample_size, sample_type, methodology, raw_data")
        .order("date_conducted", { ascending: false });

      const filtered = (data ?? []).filter((p: any) => {
        const rd = p.raw_data as any;
        return rd?.scope === "district" && rd?.district_id === districtId;
      });
      setPolls(filtered);
      setLoading(false);
    }
    load();
  }, [districtId]);

  const approvalPolls = useMemo(() =>
    polls.filter(p => p.poll_type === "approval" && p.candidate_or_topic === "Trump Approval"),
    [polls]
  );
  const historicalApproval = useMemo(() =>
    polls.filter(p => p.poll_type === "approval" && p.candidate_or_topic === "Presidential Approval"),
    [polls]
  );
  const ballotPolls = useMemo(() =>
    polls.filter(p => p.poll_type === "generic_ballot"),
    [polls]
  );
  const candidatePolls = useMemo(() =>
    polls.filter(p => p.poll_type === "favorability"),
    [polls]
  );

  const allApproval = useMemo(() => [...approvalPolls, ...historicalApproval], [approvalPolls, historicalApproval]);

  if (loading) {
    return (
      <div className="candidate-card mb-3 animate-pulse">
        <div className="h-4 w-40 bg-[hsl(var(--win98-light))] rounded mb-3" />
        <div className="h-16 bg-[hsl(var(--win98-light))] rounded" />
      </div>
    );
  }

  if (polls.length === 0) return null;

  const latestApproval = approvalPolls[0];
  const latestBallot = ballotPolls[0];

  return (
    <div className="candidate-card mb-3">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="h-4 w-4" />
        <h2 className="text-sm font-bold">📊 District Polling — {districtId}</h2>
        <span className="text-[9px] text-[hsl(var(--muted-foreground))] ml-auto">{polls.length} polls</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {/* Trump Approval */}
        {latestApproval && (
          <div className="win98-sunken p-2 rounded">
            <p className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] mb-1">TRUMP APPROVAL</p>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg font-bold" style={{ color: "hsl(150, 55%, 45%)" }}>{latestApproval.approve_pct}%</span>
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">/</span>
              <span className="text-lg font-bold" style={{ color: "hsl(0, 65%, 50%)" }}>{latestApproval.disapprove_pct}%</span>
              <MarginBadge margin={latestApproval.margin} />
            </div>
            <div className="flex h-[6px] w-full overflow-hidden win98-sunken">
              <div style={{ width: `${latestApproval.approve_pct}%`, background: "hsl(150, 55%, 45%)" }} />
              <div style={{ width: `${100 - (latestApproval.approve_pct || 0) - (latestApproval.disapprove_pct || 0)}%`, background: "hsl(var(--win98-light))" }} />
              <div style={{ width: `${latestApproval.disapprove_pct}%`, background: "hsl(0, 65%, 50%)" }} />
            </div>
            <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-1">
              {latestApproval.source} · {formatFullDate(latestApproval.date_conducted)} · n={latestApproval.sample_size?.toLocaleString()} {latestApproval.sample_type}
            </p>
          </div>
        )}

        {/* Generic Ballot */}
        {latestBallot && (() => {
          const rd = latestBallot.raw_data as any;
          const dem = rd?.dem_pct ?? latestBallot.favor_pct ?? 0;
          const rep = rd?.rep_pct ?? latestBallot.oppose_pct ?? 0;
          return (
            <div className="win98-sunken p-2 rounded">
              <p className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] mb-1">GENERIC BALLOT</p>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg font-bold" style={{ color: "hsl(210, 80%, 50%)" }}>D {dem}%</span>
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">vs</span>
                <span className="text-lg font-bold" style={{ color: "hsl(0, 75%, 50%)" }}>R {rep}%</span>
                <MarginBadge margin={latestBallot.margin} />
              </div>
              <div className="flex h-[6px] w-full overflow-hidden win98-sunken">
                <div style={{ width: `${dem}%`, background: "hsl(210, 80%, 50%)" }} />
                <div style={{ width: `${100 - dem - rep}%`, background: "hsl(var(--win98-light))" }} />
                <div style={{ width: `${rep}%`, background: "hsl(0, 75%, 50%)" }} />
              </div>
              <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-1">
                {latestBallot.source} · {formatFullDate(latestBallot.date_conducted)} · n={latestBallot.sample_size?.toLocaleString()} {latestBallot.sample_type}
              </p>
            </div>
          );
        })()}
      </div>

      {/* Candidate Favorability */}
      {candidatePolls.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] mb-1">CANDIDATE FAVORABILITY</p>
          <div className="space-y-1">
            {/* Group by candidate, show latest */}
            {Array.from(new Map(candidatePolls.map(p => [p.candidate_or_topic, p])).values()).map(p => (
              <div key={p.id} className="flex items-center gap-2 text-[10px]">
                <span className="font-bold w-32 truncate">{p.candidate_or_topic}</span>
                <span style={{ color: "hsl(150, 55%, 45%)" }}>{p.approve_pct}% fav</span>
                <span className="text-[hsl(var(--muted-foreground))]">/</span>
                <span style={{ color: "hsl(0, 65%, 50%)" }}>{p.disapprove_pct}% unfav</span>
                <MarginBadge margin={p.margin} />
                <span className="text-[hsl(var(--muted-foreground))] ml-auto text-[9px]">{formatDate(p.date_conducted)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historical Approval Trend */}
      {allApproval.length > 1 && (
        <div className="mt-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1 text-[10px] font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-1"
          >
            {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            APPROVAL HISTORY ({allApproval.length} polls, 2012–present)
          </button>
          {showHistory && (
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {allApproval
                .sort((a, b) => b.date_conducted.localeCompare(a.date_conducted))
                .map(p => {
                  const rd = p.raw_data as any;
                  const cycle = rd?.cycle || "";
                  const president = rd?.president || (p.candidate_or_topic === "Trump Approval" ? "Trump" : "");
                  return (
                    <div key={p.id} className="flex items-center gap-2 text-[10px]">
                      <span className="w-16 text-[hsl(var(--muted-foreground))] shrink-0">{formatDate(p.date_conducted)}</span>
                      {president && <span className="text-[9px] w-12 shrink-0 font-bold opacity-60">{president}</span>}
                      <div className="flex-1 flex h-[5px] overflow-hidden win98-sunken">
                        <div style={{ width: `${p.approve_pct}%`, background: "hsl(150, 55%, 45%)" }} />
                        <div style={{ width: `${100 - (p.approve_pct || 0) - (p.disapprove_pct || 0)}%`, background: "hsl(var(--win98-light))" }} />
                        <div style={{ width: `${p.disapprove_pct}%`, background: "hsl(0, 65%, 50%)" }} />
                      </div>
                      <span className="w-14 text-right shrink-0">
                        <span style={{ color: "hsl(150, 55%, 45%)" }}>{p.approve_pct}</span>
                        <span className="text-[hsl(var(--muted-foreground))]">/</span>
                        <span style={{ color: "hsl(0, 65%, 50%)" }}>{p.disapprove_pct}</span>
                      </span>
                      <span className="text-[9px] text-[hsl(var(--muted-foreground))] w-16 shrink-0">{p.source}</span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Ballot History */}
      {ballotPolls.length > 1 && (
        <div className="mt-2">
          <p className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] mb-1">BALLOT HISTORY</p>
          <div className="space-y-1">
            {ballotPolls.map(p => {
              const rd = p.raw_data as any;
              const dem = rd?.dem_pct ?? p.favor_pct ?? 0;
              const rep = rd?.rep_pct ?? p.oppose_pct ?? 0;
              return (
                <div key={p.id} className="flex items-center gap-2 text-[10px]">
                  <span className="w-16 text-[hsl(var(--muted-foreground))] shrink-0">{formatDate(p.date_conducted)}</span>
                  <div className="flex-1 flex h-[5px] overflow-hidden win98-sunken">
                    <div style={{ width: `${dem}%`, background: "hsl(210, 80%, 50%)" }} />
                    <div style={{ width: `${100 - dem - rep}%`, background: "hsl(var(--win98-light))" }} />
                    <div style={{ width: `${rep}%`, background: "hsl(0, 75%, 50%)" }} />
                  </div>
                  <span className="w-14 text-right shrink-0">
                    <span style={{ color: "hsl(210, 80%, 50%)" }}>D{dem}</span>
                    <span className="text-[hsl(var(--muted-foreground))]">/</span>
                    <span style={{ color: "hsl(0, 75%, 50%)" }}>R{rep}</span>
                  </span>
                  <span className="text-[9px] text-[hsl(var(--muted-foreground))] w-16 shrink-0">{p.source}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-2 pt-1 border-t border-[hsl(var(--border))]">
        Sources: Civiqs, Emerson College, NYT/Siena district-level tracking. Historical data 2012–present.
      </p>
    </div>
  );
}
