import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";
import { stateAbbrToName } from "@/lib/stateAbbreviations";
import { getCandidatesForDistrict } from "@/data/candidateDistricts";
import { getCandidateBySlug } from "@/data/candidates";

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

      // Build matchers for the district based on its ID, e.g. "TX-12" or "TX-AL".
      const parts = districtId.split("-");
      const stateAbbr = parts[0]?.toUpperCase() ?? "";
      const districtNum = parts[1] ?? "";
      const stateName = stateAbbr ? stateAbbrToName(stateAbbr) : "";
      const numNoPad = districtNum.replace(/^0+/, "") || districtNum;
      const ordinal = (() => {
        const n = parseInt(numNoPad, 10);
        if (!isFinite(n)) return "";
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
      })();

      // Zero-padded 2-digit form (e.g. "08")
      const padded2 = districtNum.length === 1 ? `0${districtNum}` : districtNum;

      // District-name patterns we look for inside `candidate_or_topic` (case-insensitive).
      const patterns: string[] = [
        districtId.toUpperCase(),                         // CO-08 / TX-12
        `${stateAbbr}-${numNoPad}`,                       // CO-8 / TX-12 (unpadded)
        `${stateAbbr}-${padded2}`,                        // CO-08 (padded)
        `${stateAbbr} ${numNoPad}`,                       // CO 8
        `${stateAbbr} ${padded2}`,                        // CO 08
        `${stateAbbr}${districtNum}`,                     // CO08 / TX12
        `${stateAbbr}${numNoPad}`,                        // CO8
        ...(stateName ? [
          `${stateName} ${numNoPad}`,                     // Colorado 8
          `${stateName}-${numNoPad}`,                     // Colorado-8
          `${stateName}'s ${ordinal}`,                    // Colorado's 8th
          `${stateName} ${ordinal}`,                      // Colorado 8th
          `${stateName} ${ordinal} congressional`,
          `${stateName} ${ordinal} district`,
        ] : []),
      ].filter(Boolean);

      // Candidate names tied to this district (head-to-head / favorability matches).
      const candidateNames: string[] = [];
      try {
        const slugs = getCandidatesForDistrict(districtId) ?? [];
        slugs.forEach((slug) => {
          const c = getCandidateBySlug(slug);
          if (c?.name) candidateNames.push(c.name);
        });
      } catch {
        /* ignore */
      }

      // Fetch all polling data — we'll filter client-side using multiple strategies.
      const { data } = await supabase
        .from("polling_data")
        .select("id, source, poll_type, candidate_or_topic, date_conducted, approve_pct, disapprove_pct, favor_pct, oppose_pct, margin, sample_size, sample_type, methodology, raw_data")
        .order("date_conducted", { ascending: false });

      const lowerPatterns = patterns.map((p) => p.toLowerCase());
      const lowerCandidates = candidateNames.map((n) => n.toLowerCase());

      const filtered = (data ?? []).filter((p: any) => {
        const rd = p.raw_data as any;

        // 1) Explicit district scope match (original behavior)
        if (rd?.scope === "district" && rd?.district_id === districtId) return true;

        // 2) raw_data fields that may carry state + district numbers
        const rdState = (rd?.state_abbr || rd?.state || "").toString().toUpperCase();
        const rdDistrict = (rd?.district || rd?.district_number || "").toString().replace(/^0+/, "");
        if (rdState === stateAbbr && rdDistrict && rdDistrict === numNoPad) return true;

        // 3) Topic / question text mentions the district
        const topic = (p.candidate_or_topic || "").toString().toLowerCase();
        const question = (rd?.question || "").toString().toLowerCase();
        const haystack = `${topic} ${question}`;
        if (lowerPatterns.some((pat) => haystack.includes(pat))) return true;

        // 4) Topic mentions a known candidate from this district (favorability/H2H)
        if (lowerCandidates.length > 0 && lowerCandidates.some((c) => topic.includes(c))) return true;

        return false;
      });

      // De-duplicate by id (in case of overlapping match strategies)
      const seen = new Set<string>();
      const deduped = filtered.filter((p: any) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });

      setPolls(deduped);
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

  // Any polls matched by district pattern not already rendered in the curated buckets above
  const otherPolls = useMemo(() => {
    const usedIds = new Set<string>([
      ...allApproval.map(p => p.id),
      ...ballotPolls.map(p => p.id),
      ...candidatePolls.map(p => p.id),
    ]);
    return polls.filter(p => !usedIds.has(p.id));
  }, [polls, allApproval, ballotPolls, candidatePolls]);

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

      {/* All other matched district polls (head-to-head, district-specific, etc.) */}
      {otherPolls.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] mb-1">
            MATCHED DISTRICT POLLS ({otherPolls.length})
          </p>
          <div className="space-y-1 max-h-[260px] overflow-y-auto">
            {otherPolls.map(p => {
              const rd = p.raw_data as any;
              const fav = p.favor_pct ?? p.approve_pct;
              const opp = p.oppose_pct ?? p.disapprove_pct;
              const favLabel = p.favor_pct != null ? "fav" : "app";
              const oppLabel = p.oppose_pct != null ? "opp" : "dis";
              return (
                <div key={p.id} className="win98-sunken p-2 rounded">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold flex-1 truncate">{p.candidate_or_topic}</span>
                    <MarginBadge margin={p.margin} />
                  </div>
                  {(fav != null || opp != null) && (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        {fav != null && (
                          <span className="text-xs font-bold" style={{ color: "hsl(150, 55%, 45%)" }}>
                            {fav}% {favLabel}
                          </span>
                        )}
                        {opp != null && (
                          <>
                            <span className="text-[9px] text-[hsl(var(--muted-foreground))]">/</span>
                            <span className="text-xs font-bold" style={{ color: "hsl(0, 65%, 50%)" }}>
                              {opp}% {oppLabel}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex h-[5px] w-full overflow-hidden win98-sunken">
                        <div style={{ width: `${fav ?? 0}%`, background: "hsl(150, 55%, 45%)" }} />
                        <div style={{ width: `${100 - (fav ?? 0) - (opp ?? 0)}%`, background: "hsl(var(--win98-light))" }} />
                        <div style={{ width: `${opp ?? 0}%`, background: "hsl(0, 65%, 50%)" }} />
                      </div>
                    </>
                  )}
                  <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-1">
                    {p.source} · {formatFullDate(p.date_conducted)}
                    {p.sample_size ? ` · n=${p.sample_size.toLocaleString()}` : ""}
                    {p.sample_type ? ` ${p.sample_type}` : ""}
                    {p.poll_type ? ` · ${p.poll_type}` : ""}
                  </p>
                  {rd?.question && (
                    <p className="text-[9px] text-[hsl(var(--muted-foreground))] italic mt-0.5 line-clamp-2">
                      "{rd.question}"
                    </p>
                  )}
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
