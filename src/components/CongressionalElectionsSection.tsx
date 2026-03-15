import { useState, useEffect, useMemo } from "react";
import {
  type CongressionalElectionResult,
  type CongressionalElectionCycle,
  fetchCongressionalElectionResults,
  groupCongressionalByCycle,
  syncCongressionalElections,
} from "@/data/congressionalElections";
import { Vote, Trophy, Users, TrendingUp, ChevronDown, ChevronUp, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";
import { exportElectionResultsPDF } from "@/lib/electionExport";

const PARTY_COLORS: Record<string, string> = {
  DEM: "hsl(var(--primary))",
  REP: "hsl(0 72% 51%)",
  LIB: "hsl(45 93% 47%)",
  GRN: "hsl(142 71% 45%)",
  IND: "hsl(var(--muted-foreground))",
  default: "hsl(var(--muted-foreground))",
};

function getPartyColor(party: string | null): string {
  if (!party) return PARTY_COLORS.default;
  const upper = party.toUpperCase();
  if (upper.includes("DEM")) return PARTY_COLORS.DEM;
  if (upper.includes("REP")) return PARTY_COLORS.REP;
  if (upper.includes("LIB")) return PARTY_COLORS.LIB;
  if (upper.includes("GRN") || upper.includes("GREEN")) return PARTY_COLORS.GRN;
  if (upper.includes("IND")) return PARTY_COLORS.IND;
  return PARTY_COLORS.default;
}

function getPartyLabel(party: string | null): string {
  if (!party) return "?";
  const upper = party.toUpperCase();
  if (upper.includes("DEM")) return "D";
  if (upper.includes("REP")) return "R";
  if (upper.includes("LIB")) return "L";
  if (upper.includes("GRN") || upper.includes("GREEN")) return "G";
  if (upper.includes("IND")) return "I";
  return party.substring(0, 3).toUpperCase();
}

function CandidateRow({ candidate }: { candidate: CongressionalElectionResult }) {
  const color = getPartyColor(candidate.party);
  const partyLabel = getPartyLabel(candidate.party);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {partyLabel}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground truncate">
            {candidate.candidate_name}
          </span>
          {candidate.is_winner && (
            <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          )}
          {candidate.is_write_in && (
            <span className="text-[10px] text-muted-foreground italic">(write-in)</span>
          )}
        </div>
        {candidate.party && (
          <span className="text-xs text-muted-foreground">{candidate.party}</span>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-semibold text-foreground">
          {candidate.vote_pct != null ? `${candidate.vote_pct}%` : "—"}
        </div>
        {candidate.votes != null && (
          <div className="text-[11px] text-muted-foreground">
            {candidate.votes.toLocaleString()}
          </div>
        )}
      </div>
      <div className="w-16 shrink-0">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(candidate.vote_pct || 0, 100)}%`,
              backgroundColor: color,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function CycleCard({ cycle }: { cycle: CongressionalElectionCycle }) {
  const [expanded, setExpanded] = useState(false);
  const topCandidates = cycle.candidates.slice(0, 3);
  const remainingCandidates = cycle.candidates.slice(3);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
        <div className="flex items-center gap-2">
          <Vote className="h-4 w-4 text-primary" />
          <span className="font-display text-sm font-semibold text-foreground">
            {cycle.year} {cycle.type.charAt(0).toUpperCase() + cycle.type.slice(1)}
          </span>
          {cycle.date && (
            <span className="text-xs text-muted-foreground">
              {new Date(cycle.date + "T00:00:00").toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
        {cycle.totalVotes > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            {cycle.totalVotes.toLocaleString()} votes
          </span>
        )}
      </div>
      <div className="divide-y divide-border/50">
        {topCandidates.map((c, i) => (
          <CandidateRow key={`${c.candidate_name}-${i}`} candidate={c} />
        ))}
        {remainingCandidates.length > 0 && expanded &&
          remainingCandidates.map((c, i) => (
            <CandidateRow key={`${c.candidate_name}-${i}`} candidate={c} />
          ))}
      </div>
      {remainingCandidates.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors border-t border-border/50"
        >
          {expanded ? (
            <><ChevronUp className="h-3 w-3" /> Show fewer</>
          ) : (
            <><ChevronDown className="h-3 w-3" /> {remainingCandidates.length} more candidates</>
          )}
        </button>
      )}
    </div>
  );
}

function TrendSummary({ cycles }: { cycles: CongressionalElectionCycle[] }) {
  if (cycles.length < 2) return null;
  const winnerByYear = cycles.map((c) => {
    const winner = c.candidates.find((cand) => cand.is_winner);
    return { year: c.year, party: winner?.party || null };
  });

  return (
    <div className="flex items-center gap-2 mb-3 px-1">
      <TrendingUp className="h-4 w-4 text-primary shrink-0" />
      <div className="flex items-center gap-1.5 flex-wrap">
        {winnerByYear.map((w, i) => (
          <span key={w.year} className="flex items-center gap-1">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: getPartyColor(w.party) }}
            />
            <span className="text-xs text-muted-foreground">{w.year}</span>
            {i < winnerByYear.length - 1 && (
              <span className="text-xs text-muted-foreground/50 mx-0.5">→</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

interface CongressionalElectionsSectionProps {
  districtId: string; // e.g. "CA-12"
}

export function CongressionalElectionsSection({ districtId }: CongressionalElectionsSectionProps) {
  const [results, setResults] = useState<CongressionalElectionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Parse district ID: "CA-12" -> state="CA", district="12"
  const parts = districtId.split("-");
  const stateAbbr = parts[0] || "";
  const districtNumber = parts[1] || "0";
  // Handle at-large: "AL" district number -> "0" for OpenElections
  const normalizedDistrict = districtNumber === "AL" ? "0" : districtNumber;

  useEffect(() => {
    setLoading(true);
    fetchCongressionalElectionResults(stateAbbr, normalizedDistrict)
      .then(setResults)
      .finally(() => setLoading(false));
  }, [stateAbbr, normalizedDistrict]);

  const cycles = useMemo(() => groupCongressionalByCycle(results), [results]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncCongressionalElections(stateAbbr);
      if (result.success) {
        toast.success(`Synced ${result.upserted} election results for ${stateAbbr}`);
        // Refresh data
        const fresh = await fetchCongressionalElectionResults(stateAbbr, normalizedDistrict);
        setResults(fresh);
      } else {
        toast.error(result.error || "Sync failed");
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
          Election History
        </h3>
        <div className="flex items-center gap-2 text-muted-foreground py-6 justify-center">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          <span className="text-xs">Loading election results…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm font-semibold text-foreground flex items-center gap-2">
          <Vote className="h-4 w-4 text-primary" />
          Election History
          {cycles.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              ({cycles.length} {cycles.length === 1 ? "cycle" : "cycles"})
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {cycles.length > 0 && (
            <button
              onClick={() => exportElectionResultsPDF(
                cycles,
                `${districtId} Congressional Elections`,
                `Congressional District • U.S. House`,
              )}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            >
              <Download className="h-3 w-3" />
              PDF
            </button>
          )}
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
          No election results available yet. Click "Sync" to fetch data from OpenElections.
        </p>
      ) : (
        <>
          <TrendSummary cycles={cycles} />
          <div className="space-y-3">
            {cycles.map((cycle) => (
              <CycleCard key={`${cycle.year}-${cycle.type}`} cycle={cycle} />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3 text-center">
            Source:{" "}
            <a
              href="https://openelections.net"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              OpenElections
            </a>
          </p>
        </>
      )}
    </div>
  );
}
