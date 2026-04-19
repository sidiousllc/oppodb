import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Vote, Trophy, TrendingUp, ChevronDown, ChevronUp, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const PARTY_COLORS: Record<string, string> = {
  DEMOCRAT: "hsl(var(--primary))",
  REPUBLICAN: "hsl(0 72% 51%)",
  LIBERTARIAN: "hsl(45 93% 47%)",
  GREEN: "hsl(142 71% 45%)",
  default: "hsl(var(--muted-foreground))",
};

function getPartyColor(party: string | null): string {
  if (!party) return PARTY_COLORS.default;
  const upper = party.toUpperCase();
  for (const [key, color] of Object.entries(PARTY_COLORS)) {
    if (upper.includes(key)) return color;
  }
  return PARTY_COLORS.default;
}

function getPartyLabel(party: string | null): string {
  if (!party) return "?";
  const upper = party.toUpperCase();
  if (upper.includes("DEMOCRAT")) return "D";
  if (upper.includes("REPUBLICAN")) return "R";
  if (upper.includes("LIBERTARIAN")) return "L";
  if (upper.includes("GREEN")) return "G";
  return party.substring(0, 3).toUpperCase();
}

interface MITRecord {
  year: number;
  candidate: string;
  party: string | null;
  candidatevotes: number | null;
  totalvotes: number | null;
  writein: boolean;
  special: boolean;
  stage: string;
}

interface ElectionCycle {
  year: number;
  special: boolean;
  candidates: MITRecord[];
  totalVotes: number;
}

function groupByCycle(records: MITRecord[]): ElectionCycle[] {
  const map = new Map<string, ElectionCycle>();
  for (const r of records) {
    const key = `${r.year}-${r.special}`;
    if (!map.has(key)) {
      map.set(key, { year: r.year, special: r.special, candidates: [], totalVotes: 0 });
    }
    const cycle = map.get(key)!;
    cycle.candidates.push(r);
    if (r.totalvotes && r.totalvotes > cycle.totalVotes) cycle.totalVotes = r.totalvotes;
  }
  // Sort candidates within each cycle by votes desc
  for (const cycle of map.values()) {
    cycle.candidates.sort((a, b) => (b.candidatevotes || 0) - (a.candidatevotes || 0));
  }
  return Array.from(map.values()).sort((a, b) => b.year - a.year);
}

function CycleCard({ cycle }: { cycle: ElectionCycle }) {
  const [expanded, setExpanded] = useState(false);
  const topCandidates = cycle.candidates.slice(0, 3);
  const rest = cycle.candidates.slice(3);
  const winner = cycle.candidates[0]; // highest vote-getter

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
        <div className="flex items-center gap-2">
          <Vote className="h-4 w-4 text-primary" />
          <span className="font-display text-sm font-semibold text-foreground">
            {cycle.year} {cycle.special ? "Special" : "General"}
          </span>
        </div>
        {cycle.totalVotes > 0 && (
          <span className="text-xs text-muted-foreground">
            {cycle.totalVotes.toLocaleString()} votes
          </span>
        )}
      </div>
      <div className="divide-y divide-border/50">
        {topCandidates.map((c, i) => (
          <CandidateRow key={`${c.candidate}-${i}`} record={c} isWinner={i === 0} totalVotes={cycle.totalVotes} />
        ))}
        {rest.length > 0 && expanded &&
          rest.map((c, i) => (
            <CandidateRow key={`${c.candidate}-${i}`} record={c} isWinner={false} totalVotes={cycle.totalVotes} />
          ))}
      </div>
      {rest.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors border-t border-border/50"
        >
          {expanded ? (
            <><ChevronUp className="h-3 w-3" /> Show fewer</>
          ) : (
            <><ChevronDown className="h-3 w-3" /> {rest.length} more candidates</>
          )}
        </button>
      )}
    </div>
  );
}

function CandidateRow({ record, isWinner, totalVotes }: { record: MITRecord; isWinner: boolean; totalVotes: number }) {
  const color = getPartyColor(record.party);
  const label = getPartyLabel(record.party);
  const pct = record.candidatevotes && totalVotes > 0
    ? ((record.candidatevotes / totalVotes) * 100).toFixed(1)
    : null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {label}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground truncate">{record.candidate}</span>
          {isWinner && <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
          {record.writein && <span className="text-[10px] text-muted-foreground italic">(write-in)</span>}
        </div>
        {record.party && <span className="text-xs text-muted-foreground">{record.party}</span>}
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-semibold text-foreground">{pct ? `${pct}%` : "—"}</div>
        {record.candidatevotes != null && (
          <div className="text-[11px] text-muted-foreground">{record.candidatevotes.toLocaleString()}</div>
        )}
      </div>
      <div className="w-16 shrink-0">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(parseFloat(pct || "0"), 100)}%`,
              backgroundColor: color,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function TrendDots({ cycles }: { cycles: ElectionCycle[] }) {
  if (cycles.length < 2) return null;
  const winners = cycles.map((c) => ({
    year: c.year,
    party: c.candidates[0]?.party || null,
  }));

  return (
    <div className="flex items-center gap-2 mb-3 px-1">
      <TrendingUp className="h-4 w-4 text-primary shrink-0" />
      <div className="flex items-center gap-1.5 flex-wrap">
        {winners.map((w, i) => (
          <span key={w.year} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getPartyColor(w.party) }} />
            <span className="text-xs text-muted-foreground">{w.year}</span>
            {i < winners.length - 1 && <span className="text-xs text-muted-foreground/50 mx-0.5">→</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

interface MITElectionHistoryPanelProps {
  districtId: string; // e.g. "CA-12"
}

export function MITElectionHistoryPanel({ districtId }: MITElectionHistoryPanelProps) {
  const [records, setRecords] = useState<MITRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const parts = districtId.split("-");
  const stateAbbr = parts[0] || "";
  const rawDistrict = parts[1] || "0";
  const districtNum = rawDistrict === "AL" ? "0" : rawDistrict;

  const fetchData = () => {
    setLoading(true);
    supabase
      .from("mit_election_results")
      .select("year,candidate,party,candidatevotes,totalvotes,writein,special,stage")
      .eq("state_po", stateAbbr)
      .eq("office", "US HOUSE")
      .eq("district", districtNum === "0" ? "statewide" : districtNum)
      .eq("stage", "gen")
      .order("year", { ascending: false })
      .order("candidatevotes", { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (error) console.error("MIT election fetch error:", error);
        setRecords((data || []) as MITRecord[]);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, [stateAbbr, districtNum]);

  const cycles = useMemo(() => groupByCycle(records), [records]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        `mit-election-sync?dataset=house&state=${stateAbbr}&min_year=2000`
      );
      if (error) {
        toast.error("Sync failed: " + error.message);
      } else if (data?.fallback) {
        // Upstream (Harvard Dataverse) is temporarily unavailable — show existing cached data
        toast.warning("Election history source temporarily unavailable. Showing cached data.");
        fetchData();
      } else {
        toast.success(`Synced ${data?.total_synced || 0} House election records for ${stateAbbr}`);
        fetchData();
      }
    } catch (e) {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 mb-6">
        <h3 className="font-display text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Vote className="h-4 w-4 text-primary" />
          MIT Election Lab History
        </h3>
        <div className="flex items-center gap-2 text-muted-foreground py-6 justify-center">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          <span className="text-xs">Loading historical data…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm font-semibold text-foreground flex items-center gap-2">
          <Vote className="h-4 w-4 text-primary" />
          Historical Elections (MIT)
          {cycles.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              ({cycles.length} {cycles.length === 1 ? "cycle" : "cycles"})
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <a
            href="https://electionlab.mit.edu/data"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            MIT Election Lab
          </a>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync"}
          </button>
        </div>
      </div>

      {cycles.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          No historical election data available yet. Click "Sync" to fetch data from MIT Election Lab.
        </p>
      ) : (
        <>
          <TrendDots cycles={cycles} />
          <div className="space-y-3">
            {cycles.map((cycle) => (
              <CycleCard key={`${cycle.year}-${cycle.special}`} cycle={cycle} />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3 text-center">
            Source: MIT Election Data + Science Lab via Harvard Dataverse (1976–2024)
          </p>
        </>
      )}
    </div>
  );
}
