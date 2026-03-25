import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchPollingData, getSourceInfo, POLLING_SOURCES, type PollEntry } from "@/data/pollingData";
import { cookRatings, getCookRatingColor, type CookRating } from "@/data/cookRatings";
import { getCurrentPVI, formatPVI, getPVIColor } from "@/data/cookPVI";
import { candidates } from "@/data/candidates";
import { magaFiles } from "@/data/magaFiles";
import { BarChart3, TrendingDown, TrendingUp, Minus, MapPin, Users, AlertTriangle, FileText, Compass, Scale } from "lucide-react";
import type { DistrictProfile } from "@/data/districtIntel";


interface DashboardProps {
  onNavigateSection: (section: string, slug?: string) => void;
  candidateCount: number;
  districtCount: number;
  districts?: DistrictProfile[];
}

export function Dashboard({ onNavigateSection, candidateCount, districtCount, districts = [] }: DashboardProps) {
  const [polls, setPolls] = useState<PollEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPollingData().then((data) => {
      setPolls(data);
      setLoading(false);
    });
  }, []);

  // ─── Polling calculations ───────────────────────────────────────────
  const approvalPolls = useMemo(() =>
    polls.filter(p => p.poll_type === "approval" && p.candidate_or_topic === "Trump Approval"),
    [polls]
  );

  const genericBallotPolls = useMemo(() =>
    polls.filter(p => p.poll_type === "generic-ballot"),
    [polls]
  );

  // Cross-source average (latest per source)
  const crossSourceAvg = useMemo(() => {
    const latestBySource = new Map<string, PollEntry>();
    for (const p of approvalPolls) {
      const existing = latestBySource.get(p.source);
      if (!existing || p.date_conducted > existing.date_conducted) {
        latestBySource.set(p.source, p);
      }
    }
    const entries = Array.from(latestBySource.values());
    if (entries.length === 0) return null;
    const avgApprove = entries.reduce((s, p) => s + (p.approve_pct || 0), 0) / entries.length;
    const avgDisapprove = entries.reduce((s, p) => s + (p.disapprove_pct || 0), 0) / entries.length;
    return {
      approve: Math.round(avgApprove * 10) / 10,
      disapprove: Math.round(avgDisapprove * 10) / 10,
      margin: Math.round((avgApprove - avgDisapprove) * 10) / 10,
      sourceCount: entries.length,
    };
  }, [approvalPolls]);

  // Cross-source generic ballot average (latest per source)
  const genericBallotAvg = useMemo(() => {
    const latestBySource = new Map<string, PollEntry>();
    for (const p of genericBallotPolls) {
      const existing = latestBySource.get(p.source);
      if (!existing || p.date_conducted > existing.date_conducted) {
        latestBySource.set(p.source, p);
      }
    }
    const entries = Array.from(latestBySource.values());
    if (entries.length === 0) return null;
    const avgDem = entries.reduce((s, p) => s + (p.favor_pct || 0), 0) / entries.length;
    const avgRep = entries.reduce((s, p) => s + (p.oppose_pct || 0), 0) / entries.length;
    const margin = avgDem - avgRep;
    return {
      dem: Math.round(avgDem * 10) / 10,
      rep: Math.round(avgRep * 10) / 10,
      margin: Math.round(margin * 10) / 10,
      sourceCount: entries.length,
    };
  }, [genericBallotPolls]);

  // Approval trend by source (latest from each)
  const approvalBySource = useMemo(() => {
    const latestBySource = new Map<string, PollEntry>();
    for (const p of approvalPolls) {
      const existing = latestBySource.get(p.source);
      if (!existing || p.date_conducted > existing.date_conducted) {
        latestBySource.set(p.source, p);
      }
    }
    return Array.from(latestBySource.values())
      .sort((a, b) => (a.margin || 0) - (b.margin || 0));
  }, [approvalPolls]);

  // ─── District calculations (DB-backed with static fallback) ─────────
  const [dbTossUps, setDbTossUps] = useState<string[] | null>(null);

  useEffect(() => {
    // Load toss-up races from DB forecasts (consensus across sources)
    supabase
      .from("election_forecasts")
      .select("state_abbr, district, rating")
      .eq("cycle", 2026)
      .eq("race_type", "house")
      .in("rating", ["Toss Up", "Toss-Up", "Tossup"])
      .then(({ data }) => {
        if (data && data.length > 0) {
          const ids = [...new Set(data.map((f: any) => {
            const d = (f.district || "AL").padStart(2, "0");
            return `${f.state_abbr}-${d}`;
          }))].sort();
          setDbTossUps(ids as string[]);
        }
      });
  }, []);

  const tossUpDistricts = useMemo(() => {
    if (dbTossUps && dbTossUps.length > 0) return dbTossUps;
    // Fallback to static Cook ratings
    return Object.entries(cookRatings)
      .filter(([_, rating]) => rating === "Toss Up")
      .map(([id]) => id)
      .sort();
  }, [dbTossUps]);

  const evenPVIDistricts = useMemo(() => {
    return Object.entries(cookRatings)
      .map(([id]) => ({ id, pvi: getCurrentPVI(id) }))
      .filter(d => d.pvi === 0)
      .map(d => d.id)
      .sort();
  }, []);

  // ─── Quick stats ────────────────────────────────────────────────────
  const quickStats = [
    { label: "Candidate Profiles", value: candidateCount, emoji: "👥", section: "candidates" },
    { label: "District Profiles", value: districtCount, emoji: "🧭", section: "district-intel" },
    { label: "MAGA Files", value: magaFiles.length, emoji: "⚠️", section: "maga-files" },
    { label: "Toss Up Races", value: tossUpDistricts.length, emoji: "🎯", section: "district-intel" },
  ];

  return (
    <div className="space-y-4">
      {/* Quick stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {quickStats.map((stat) => (
          <button
            key={stat.label}
            onClick={() => onNavigateSection(stat.section)}
            className="candidate-card text-center hover:bg-[hsl(var(--win98-light))]"
          >
            <span className="text-xl block">{stat.emoji}</span>
            <span className="text-lg font-bold block">{stat.value}</span>
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{stat.label}</span>
          </button>
        ))}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="h-4 w-4" />
          <h2 className="text-sm font-bold">📊 Polling Overview</h2>
          <button
            onClick={() => onNavigateSection("polling")}
            className="ml-auto win98-button text-[10px]"
          >
            View All Polling →
          </button>
        </div>

        {loading ? (
          <div className="text-center py-6 text-[11px] text-[hsl(var(--muted-foreground))]">Loading polling data...</div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-3">
            {/* Cross-Source Average */}
            <div className="candidate-card">
              <div className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] mb-1">CROSS-SOURCE AVERAGE</div>
              {crossSourceAvg ? (
                <>
                  <div className="flex items-end gap-3 mb-1">
                    <div>
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Approve</span>
                      <span className="text-lg font-bold block" style={{ color: "hsl(150, 60%, 40%)" }}>
                        {crossSourceAvg.approve}%
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Disapprove</span>
                      <span className="text-lg font-bold block" style={{ color: "hsl(0, 60%, 50%)" }}>
                        {crossSourceAvg.disapprove}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px]">
                    {crossSourceAvg.margin > 0 ? (
                      <TrendingUp className="h-3 w-3" style={{ color: "hsl(150, 60%, 40%)" }} />
                    ) : (
                      <TrendingDown className="h-3 w-3" style={{ color: "hsl(0, 60%, 50%)" }} />
                    )}
                    <span className="font-bold" style={{ color: crossSourceAvg.margin > 0 ? "hsl(150, 60%, 40%)" : "hsl(0, 60%, 50%)" }}>
                      {crossSourceAvg.margin > 0 ? "+" : ""}{crossSourceAvg.margin}
                    </span>
                    <span className="text-[hsl(var(--muted-foreground))]">net • {crossSourceAvg.sourceCount} sources</span>
                  </div>
                  {/* Mini bar */}
                  <div className="mt-2 h-[6px] w-full bg-[hsl(var(--win98-light))] win98-sunken overflow-hidden flex">
                    <div style={{ width: `${crossSourceAvg.approve}%`, background: "hsl(150, 60%, 40%)" }} />
                    <div style={{ width: `${100 - crossSourceAvg.approve - crossSourceAvg.disapprove}%`, background: "hsl(var(--win98-light))" }} />
                    <div style={{ width: `${crossSourceAvg.disapprove}%`, background: "hsl(0, 60%, 50%)" }} />
                  </div>
                </>
              ) : (
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">No data available</span>
              )}
            </div>

            {/* Generic Ballot */}
            <div className="candidate-card">
              <div className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] mb-1">GENERIC BALLOT (CROSS-SOURCE AVG)</div>
              {genericBallotAvg ? (
                <>
                  <div className="flex items-end gap-3 mb-1">
                    <div>
                      <span className="text-[10px]" style={{ color: "hsl(210, 80%, 45%)" }}>Dem</span>
                      <span className="text-lg font-bold block" style={{ color: "hsl(210, 80%, 45%)" }}>
                        {genericBallotAvg.dem}%
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px]" style={{ color: "hsl(0, 70%, 50%)" }}>Rep</span>
                      <span className="text-lg font-bold block" style={{ color: "hsl(0, 70%, 50%)" }}>
                        {genericBallotAvg.rep}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="font-bold" style={{ color: genericBallotAvg.margin > 0 ? "hsl(210, 80%, 45%)" : "hsl(0, 70%, 50%)" }}>
                      {genericBallotAvg.margin > 0 ? "D" : "R"}+{Math.abs(genericBallotAvg.margin)}
                    </span>
                    <span className="text-[hsl(var(--muted-foreground))]">
                      • {genericBallotAvg.sourceCount} sources
                    </span>
                  </div>
                  <div className="mt-2 h-[6px] w-full bg-[hsl(var(--win98-light))] win98-sunken overflow-hidden flex">
                    <div style={{ width: `${genericBallotAvg.dem}%`, background: "hsl(210, 80%, 45%)" }} />
                    <div style={{ width: `${100 - genericBallotAvg.dem - genericBallotAvg.rep}%`, background: "hsl(var(--win98-light))" }} />
                    <div style={{ width: `${genericBallotAvg.rep}%`, background: "hsl(0, 70%, 50%)" }} />
                  </div>
                </>
              ) : (
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">No data available</span>
              )}
            </div>

            {/* Approval by Source */}
            <div className="candidate-card">
              <div className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] mb-1">APPROVAL BY SOURCE</div>
              <div className="space-y-[3px] max-h-[120px] overflow-y-auto">
                {approvalBySource.map((poll) => {
                  const info = getSourceInfo(poll.source);
                  return (
                    <div key={poll.source} className="flex items-center gap-1 text-[10px]">
                      <span
                        className="w-[6px] h-[6px] rounded-full shrink-0"
                        style={{ background: `hsl(${info.color})` }}
                      />
                      <span className="truncate flex-1" title={info.name}>{info.name}</span>
                      <span className="font-bold" style={{ color: (poll.approve_pct || 0) >= 45 ? "hsl(150, 60%, 40%)" : "hsl(0, 60%, 50%)" }}>
                        {poll.approve_pct}%
                      </span>
                      <span className="w-[28px] text-right font-mono" style={{ color: (poll.margin || 0) > 0 ? "hsl(150, 50%, 40%)" : "hsl(0, 50%, 50%)" }}>
                        {(poll.margin || 0) > 0 ? "+" : ""}{poll.margin}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ COMPETITIVE DISTRICTS SECTION ═══ */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Compass className="h-4 w-4" />
          <h2 className="text-sm font-bold">🎯 Competitive Districts</h2>
          <button
            onClick={() => onNavigateSection("district-intel")}
            className="ml-auto win98-button text-[10px]"
          >
            View All Districts →
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {/* Toss Up districts */}
          <div className="candidate-card">
            <div className="flex items-center gap-1 mb-2">
              <span
                className="inline-block w-[8px] h-[8px] rounded-full"
                style={{ background: `hsl(${getCookRatingColor("Toss Up")})` }}
              />
              <span className="text-[10px] font-bold">TOSS UP ({tossUpDistricts.length}){dbTossUps ? " • Live" : " • Cook"}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {tossUpDistricts.map((id) => {
                const pvi = getCurrentPVI(id);
                return (
                  <button
                    key={id}
                    onClick={() => onNavigateSection("district-intel", id)}
                    className="win98-button text-[10px] px-1.5 py-0.5 flex items-center gap-1"
                    title={`${id} — PVI: ${pvi !== null ? formatPVI(pvi) : "N/A"}`}
                  >
                    <span
                      className="w-[5px] h-[5px] rounded-full"
                      style={{ background: `hsl(${getCookRatingColor("Toss Up")})` }}
                    />
                    {id}
                    {pvi !== null && (
                      <span className="text-[8px] opacity-70">{formatPVI(pvi)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* EVEN PVI districts */}
          <div className="candidate-card">
            <div className="flex items-center gap-1 mb-2">
              <span
                className="inline-block w-[8px] h-[8px] rounded-full"
                style={{ background: `hsl(${getPVIColor(0)})` }}
              />
              <span className="text-[10px] font-bold">EVEN PVI ({evenPVIDistricts.length})</span>
            </div>
            {evenPVIDistricts.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {evenPVIDistricts.map((id) => {
                  const rating = cookRatings[id] || null;
                  return (
                    <button
                      key={id}
                      onClick={() => onNavigateSection("district-intel", id)}
                      className="win98-button text-[10px] px-1.5 py-0.5 flex items-center gap-1"
                      title={`${id} — Cook: ${rating || "N/A"}`}
                    >
                      <span
                        className="w-[5px] h-[5px] rounded-full"
                        style={{ background: `hsl(${getPVIColor(0)})` }}
                      />
                      {id}
                      {rating && (
                        <span
                          className="text-[8px]"
                          style={{ color: `hsl(${getCookRatingColor(rating)})` }}
                        >
                          {rating}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <span className="text-[10px] text-[hsl(var(--muted-foreground))] italic">
                No districts with exactly EVEN PVI score
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ═══ QUICK NAVIGATION ═══ */}
      <div>
        <h2 className="text-sm font-bold mb-2">📂 Quick Navigation</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Candidate Profiles", emoji: "👥", section: "candidates" },
            { label: "MAGA Files", emoji: "⚠️", section: "maga-files" },
            { label: "Local Impact", emoji: "🌐", section: "local-impact" },
            { label: "Narrative Reports", emoji: "📄", section: "narratives" },
            { label: "District Intel", emoji: "🧭", section: "district-intel" },
            { label: "State Legislatures", emoji: "⚖️", section: "state-legislative" },
            { label: "Polling Data", emoji: "📊", section: "polling" },
            { label: "Campaign Finance", emoji: "💰", section: "campaign-finance" },
            { label: "Research Tools", emoji: "🔬", section: "research-tools" },
            { label: "Live Elections", emoji: "🏛️", section: "live-elections" },
            { label: "Legislation", emoji: "📜", section: "legislation" },
            { label: "Voter Data", emoji: "🗳️", section: "voter-data" },
            { label: "Documentation", emoji: "📖", section: "documentation" },
          ].map((item) => (
            <button
              key={item.section}
              onClick={() => onNavigateSection(item.section)}
              className="candidate-card flex items-center gap-2 hover:bg-[hsl(var(--win98-light))]"
            >
              <span className="text-lg">{item.emoji}</span>
              <span className="text-[11px] font-bold">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
