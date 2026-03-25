import { memo, useMemo } from "react";
import { DollarSign, Swords, TrendingUp } from "lucide-react";
import { getCookRating, getCookRatingColor, type CookRating } from "@/data/cookRatings";
import { getEffectivePVI, formatPVI, getPVIColor } from "@/data/cookPVI";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FinanceEntry {
  candidate_name: string;
  state_abbr: string;
  district: string | null;
  total_raised: number | null;
  party: string | null;
}

interface CompetitiveRacesSidebarProps {
  consensusRatings: Map<string, string>;
  dbFinance: Map<string, FinanceEntry[]>;
  onSelectDistrict: (districtId: string) => void;
}

const COMPETITIVENESS_ORDER: Record<string, number> = {
  "Toss Up": 1, "Toss-Up": 1, "Tossup": 1,
  "Lean D": 2, "Lean R": 2,
  "Likely D": 3, "Likely R": 3,
};

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

const RATING_DOT_COLORS: Record<string, string> = {
  "Toss Up": "45 80% 50%",
  "Toss-Up": "45 80% 50%",
  "Tossup": "45 80% 50%",
  "Lean D": "210 55% 60%",
  "Lean R": "0 55% 60%",
  "Likely D": "210 80% 45%",
  "Likely R": "0 80% 45%",
};

function CompetitiveRacesSidebarInner({
  consensusRatings,
  dbFinance,
  onSelectDistrict,
}: CompetitiveRacesSidebarProps) {
  const competitiveRaces = useMemo(() => {
    const races: {
      districtId: string;
      rating: string;
      cookRating: CookRating | null;
      pvi: number | null;
      totalRaised: number;
      topCandidate: { name: string; raised: number; party: string | null } | null;
      candidateCount: number;
    }[] = [];

    for (const [did, rating] of consensusRatings) {
      const order = COMPETITIVENESS_ORDER[rating];
      if (!order) continue; // skip Solid/safe seats

      const finance = dbFinance.get(did) || [];
      const totalRaised = finance.reduce((sum, f) => sum + (f.total_raised || 0), 0);
      const top = finance.length > 0
        ? { name: finance[0].candidate_name, raised: finance[0].total_raised || 0, party: finance[0].party }
        : null;
      const effective = getEffectivePVI(did);

      races.push({
        districtId: did,
        rating,
        cookRating: getCookRating(did),
        pvi: effective?.score ?? null,
        totalRaised,
        topCandidate: top,
        candidateCount: finance.length,
      });
    }

    // Sort: most competitive first, then by total raised descending
    races.sort((a, b) => {
      const aOrder = COMPETITIVENESS_ORDER[a.rating] || 99;
      const bOrder = COMPETITIVENESS_ORDER[b.rating] || 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return b.totalRaised - a.totalRaised;
    });

    return races;
  }, [consensusRatings, dbFinance]);

  const tossUpCount = competitiveRaces.filter(r => COMPETITIVENESS_ORDER[r.rating] === 1).length;
  const leanCount = competitiveRaces.filter(r => COMPETITIVENESS_ORDER[r.rating] === 2).length;
  const likelyCount = competitiveRaces.filter(r => COMPETITIVENESS_ORDER[r.rating] === 3).length;

  if (competitiveRaces.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">No competitive race data available.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card flex flex-col h-full max-h-[600px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
          <Swords className="h-4 w-4 text-primary" />
          Competitive Races
        </h3>
        <div className="flex gap-3 mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "hsl(45, 80%, 50%)" }} />
            {tossUpCount} Toss Up
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "hsl(0, 55%, 60%)" }} />
            {leanCount} Lean
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "hsl(210, 80%, 45%)" }} />
            {likelyCount} Likely
          </span>
        </div>
      </div>

      {/* Race list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="divide-y divide-border">
          {competitiveRaces.map((race, i) => (
            <button
              key={race.districtId}
              onClick={() => onSelectDistrict(race.districtId)}
              className="w-full px-4 py-2.5 text-left hover:bg-muted/50 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground w-5 shrink-0">
                  {i + 1}
                </span>
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: `hsl(${RATING_DOT_COLORS[race.rating] || "220, 15%, 85%"})` }}
                />
                <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                  {race.districtId}
                </span>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {race.rating}
                </span>
              </div>

              <div className="flex items-center gap-2 mt-1 ml-7">
                {race.pvi !== null && (
                  <span
                    className="text-[10px] font-medium"
                    style={{ color: `hsl(${getPVIColor(race.pvi)})` }}
                  >
                    {formatPVI(race.pvi)}
                  </span>
                )}

                {race.totalRaised > 0 && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <DollarSign className="h-2.5 w-2.5" />
                    {formatMoney(race.totalRaised)} total
                  </span>
                )}
              </div>

              {race.topCandidate && race.topCandidate.raised > 0 && (
                <div className="flex items-center gap-1 mt-0.5 ml-7">
                  <TrendingUp className="h-2.5 w-2.5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                    {race.topCandidate.name}
                    {race.topCandidate.party ? ` (${race.topCandidate.party})` : ""}
                  </span>
                  <span className="text-[10px] font-medium text-foreground">
                    {formatMoney(race.topCandidate.raised)}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border shrink-0">
        <p className="text-[9px] text-muted-foreground">
          Ranked by competitiveness · Click to view district
        </p>
      </div>
    </div>
  );
}

export const CompetitiveRacesSidebar = memo(CompetitiveRacesSidebarInner);
