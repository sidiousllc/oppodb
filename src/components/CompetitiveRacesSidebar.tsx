import { memo, useMemo, useState } from "react";
import { DollarSign, Swords, TrendingUp, RefreshCw } from "lucide-react";
import { getCookRating, getCookRatingColor, type CookRating } from "@/data/cookRatings";
import { getEffectivePVI, formatPVI, getPVIColor } from "@/data/cookPVI";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  onRefresh?: () => void;
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
  onRefresh,
}: CompetitiveRacesSidebarProps) {
  const [syncing, setSyncing] = useState(false);

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
      if (!order) continue;

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

  async function handleSync() {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("forecast-sync", {
        method: "POST",
      });
      if (error) throw error;
      toast.success("Competitive districts updated", {
        description: data?.upserted != null
          ? `${data.upserted} forecasts synced`
          : "Forecast data refreshed",
      });
      onRefresh?.();
    } catch (e: any) {
      console.error("Forecast sync error:", e);
      toast.error("Sync failed", { description: e?.message || "Could not update forecasts" });
    } finally {
      setSyncing(false);
    }
  }

  if (competitiveRaces.length === 0) {
    return (
      <div className="candidate-card p-3">
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">No competitive race data available.</p>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="win98-button text-[9px] mt-2 flex items-center gap-1"
        >
          <RefreshCw className={`h-2.5 w-2.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Update Competitive Districts"}
        </button>
      </div>
    );
  }

  return (
    <div className="candidate-card flex flex-col h-full max-h-[600px]">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[hsl(var(--win98-shadow))] bg-[hsl(var(--win98-face))] shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
            <Swords className="h-3.5 w-3.5" />
            Competitive Races
          </h3>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="win98-button text-[8px] px-1.5 py-0 h-[16px] flex items-center gap-0.5"
            title="Update competitive districts"
          >
            <RefreshCw className={`h-2.5 w-2.5 ${syncing ? "animate-spin" : ""}`} />
            Update
          </button>
        </div>
        <div className="flex gap-2 mt-1.5 text-[9px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
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
        <div className="divide-y divide-[hsl(var(--win98-light))]">
          {competitiveRaces.map((race, i) => (
            <button
              key={race.districtId}
              onClick={() => onSelectDistrict(race.districtId)}
              className="w-full px-3 py-2 text-left hover:bg-[hsl(var(--win98-light))] transition-colors group"
            >
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-[hsl(var(--muted-foreground))] w-4 shrink-0">
                  {i + 1}
                </span>
                <span
                  className="inline-block h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: `hsl(${RATING_DOT_COLORS[race.rating] || "220, 15%, 85%"})` }}
                />
                <span className="text-[10px] font-bold text-foreground">
                  {race.districtId}
                </span>
                <span className="text-[9px] text-[hsl(var(--muted-foreground))] ml-auto">
                  {race.rating}
                </span>
              </div>

              <div className="flex items-center gap-2 mt-0.5 ml-6">
                {race.pvi !== null && (
                  <span
                    className="text-[9px] font-medium"
                    style={{ color: `hsl(${getPVIColor(race.pvi)})` }}
                  >
                    {formatPVI(race.pvi)}
                  </span>
                )}

                {race.totalRaised > 0 && (
                  <span className="text-[9px] text-[hsl(var(--muted-foreground))] flex items-center gap-0.5">
                    <DollarSign className="h-2.5 w-2.5" />
                    {formatMoney(race.totalRaised)} total
                  </span>
                )}
              </div>

              {race.topCandidate && race.topCandidate.raised > 0 && (
                <div className="flex items-center gap-1 mt-0.5 ml-6">
                  <TrendingUp className="h-2.5 w-2.5 text-[hsl(var(--muted-foreground))]" />
                  <span className="text-[9px] text-[hsl(var(--muted-foreground))] truncate max-w-[110px]">
                    {race.topCandidate.name}
                    {race.topCandidate.party ? ` (${race.topCandidate.party})` : ""}
                  </span>
                  <span className="text-[9px] font-medium text-foreground">
                    {formatMoney(race.topCandidate.raised)}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-[hsl(var(--win98-shadow))] bg-[hsl(var(--win98-face))] shrink-0">
        <p className="text-[8px] text-[hsl(var(--muted-foreground))]">
          Ranked by competitiveness · Click to view district
        </p>
      </div>
    </div>
  );
}

export const CompetitiveRacesSidebar = memo(CompetitiveRacesSidebarInner);
