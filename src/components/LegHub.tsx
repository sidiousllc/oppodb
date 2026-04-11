import { useState, useMemo, useCallback } from "react";
import { Scale, Landmark, Globe, GitCompareArrows } from "lucide-react";
import { StateLegislativeSection } from "@/components/StateLegislativeSection";
import { LegislationSection } from "@/components/LegislationSection";
import { DistrictCard } from "@/components/DistrictCard";
import { DistrictDetail } from "@/components/DistrictDetail";
import { DistrictMap, type PVIFilter, PVI_FILTER_OPTIONS } from "@/components/DistrictMap";
import { DistrictCompare } from "@/components/DistrictCompare";
import { searchDistricts, syncCensusData, fetchAllDistricts, type DistrictProfile } from "@/data/districtIntel";
import { syncCongressionalElections } from "@/data/congressionalElections";
import { getCookRating, getCookRatingColor, COOK_RATING_ORDER, type CookRating } from "@/data/cookRatings";
import { candidateDistrictMap } from "@/data/candidateDistricts";
import type { StateLegislativeProfile } from "@/data/stateLegislativeIntel";

type LegHubTab = "district-intel" | "state-legislative" | "legislation";

interface LegHubProps {
  stateLegDistricts: StateLegislativeProfile[];
  stateLegLoading: boolean;
  onStateLegSync: (stateAbbr?: string, chamber?: string) => void;
  stateLegSyncing: boolean;
  districts: DistrictProfile[];
  onDistrictsChange: (districts: DistrictProfile[]) => void;
  search: string;
  onSelectSlug: (slug: string | null) => void;
  selectedSlug: string | null;
  onNavigateToCandidate: (slug: string) => void;
}

const ALL_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
  "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
  "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

export function LegHub({
  stateLegDistricts, stateLegLoading, onStateLegSync, stateLegSyncing,
  districts, onDistrictsChange, search, onSelectSlug, selectedSlug, onNavigateToCandidate,
}: LegHubProps) {
  const [tab, setTab] = useState<LegHubTab>("district-intel");

  // District Intel state
  const [trackedOnly, setTrackedOnly] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [cookFilter, setCookFilter] = useState<CookRating | "all">("all");
  const [pviFilter, setPviFilter] = useState<PVIFilter>("all");
  const [censusSyncing, setCensusSyncing] = useState(false);
  const [electionSyncing, setElectionSyncing] = useState(false);
  const [electionSyncProgress, setElectionSyncProgress] = useState("");

  const trackedDistrictIds = useMemo(() => new Set(
    Object.values(candidateDistrictMap)
      .map(v => v.district_id)
      .filter((id): id is string => id !== null)
  ), []);

  const filteredDistricts = useMemo(() => {
    let results = searchDistricts(districts, search);
    if (trackedOnly) results = results.filter(d => trackedDistrictIds.has(d.district_id));
    if (cookFilter !== "all") results = results.filter(d => getCookRating(d.district_id) === cookFilter);
    return results;
  }, [search, districts, trackedOnly, trackedDistrictIds, cookFilter]);

  const selectedDistrict = selectedSlug ? districts.find(d => d.district_id === selectedSlug) : null;

  const handleCensusSync = useCallback(async () => {
    setCensusSyncing(true);
    try {
      const result = await syncCensusData();
      if (result.success) {
        const fresh = await fetchAllDistricts();
        onDistrictsChange(fresh);
      } else {
        console.error("Census sync failed:", result.error);
      }
    } catch (e) {
      console.error("Census sync error:", e);
    } finally {
      setCensusSyncing(false);
    }
  }, [onDistrictsChange]);

  const handleBulkElectionSync = useCallback(async () => {
    setElectionSyncing(true);
    let totalUpserted = 0;
    try {
      for (let i = 0; i < ALL_STATES.length; i++) {
        const st = ALL_STATES[i];
        setElectionSyncProgress(`${st} (${i + 1}/${ALL_STATES.length})`);
        try {
          const result = await syncCongressionalElections(st);
          if (result.success) totalUpserted += result.upserted;
        } catch {
          console.warn(`Election sync failed for ${st}`);
        }
        if (i < ALL_STATES.length - 1) await new Promise(r => setTimeout(r, 500));
      }
      setElectionSyncProgress(`Done — ${totalUpserted} results synced`);
      setTimeout(() => setElectionSyncProgress(""), 4000);
    } catch (e) {
      console.error("Bulk election sync error:", e);
      setElectionSyncProgress("Error");
    } finally {
      setElectionSyncing(false);
    }
  }, []);

  // District Intel detail view
  if (tab === "district-intel" && compareMode) {
    return (
      <div className="space-y-2">
        {renderHeader()}
        <DistrictCompare districts={districts} onBack={() => setCompareMode(false)} />
      </div>
    );
  }

  if (tab === "district-intel" && selectedDistrict) {
    return (
      <div className="space-y-2">
        {renderHeader()}
        <DistrictDetail
          district={selectedDistrict}
          onBack={() => onSelectSlug(null)}
          onSelectCandidate={onNavigateToCandidate}
        />
      </div>
    );
  }

  function renderHeader() {
    return (
      <>
        <div className="flex items-center gap-2 mb-1">
          <Scale className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold text-foreground">LegHub</h2>
        </div>
        <div className="flex gap-1 mb-2">
          <button
            onClick={() => { setTab("district-intel"); onSelectSlug(null); setCompareMode(false); }}
            className={`win98-button text-[10px] flex items-center gap-1 ${tab === "district-intel" ? "font-bold" : ""}`}
          >
            <Globe className="h-3 w-3" />
            District Intel ({districts.length})
          </button>
          <button
            onClick={() => setTab("state-legislative")}
            className={`win98-button text-[10px] flex items-center gap-1 ${tab === "state-legislative" ? "font-bold" : ""}`}
          >
            <Landmark className="h-3 w-3" />
            State Legislatures ({stateLegDistricts.length})
          </button>
          <button
            onClick={() => setTab("legislation")}
            className={`win98-button text-[10px] flex items-center gap-1 ${tab === "legislation" ? "font-bold" : ""}`}
          >
            <Scale className="h-3 w-3" />
            Legislation
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-2">
      {renderHeader()}

      {tab === "district-intel" && (
        <>
          <div className="mt-2 mb-1 flex flex-wrap items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{filteredDistricts.length} district profiles</p>
              <button
                onClick={() => setTrackedOnly(v => !v)}
                className={`win98-button text-[10px] flex items-center gap-1 ${trackedOnly ? "font-bold" : ""}`}
              >
                <span className={`h-2 w-2 border ${trackedOnly ? "bg-[hsl(var(--win98-titlebar))]" : ""}`} />
                Tracked only
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCompareMode(true)}
                className="win98-button text-[10px] flex items-center gap-1"
              >
                <GitCompareArrows className="h-3 w-3" />
                Compare
              </button>
              <button
                onClick={handleCensusSync}
                disabled={censusSyncing}
                className="win98-button text-[10px] flex items-center gap-1 disabled:opacity-50"
              >
                {censusSyncing ? "Syncing…" : "Census Sync"}
              </button>
              <button
                onClick={handleBulkElectionSync}
                disabled={electionSyncing}
                className="win98-button text-[10px] flex items-center gap-1 disabled:opacity-50"
              >
                {electionSyncing ? electionSyncProgress : electionSyncProgress || "Sync Elections"}
              </button>
            </div>
          </div>

          {/* Cook filter */}
          <div className="mb-2 flex flex-wrap gap-1">
            <button
              onClick={() => setCookFilter("all")}
              className={`win98-button text-[9px] px-1 py-0 ${cookFilter === "all" ? "font-bold" : ""}`}
            >
              All Ratings
            </button>
            {COOK_RATING_ORDER.map((rating) => {
              const color = getCookRatingColor(rating);
              const isActive = cookFilter === rating;
              return (
                <button
                  key={rating}
                  onClick={() => setCookFilter(isActive ? "all" : rating)}
                  className="win98-button text-[9px] px-1 py-0"
                  style={{
                    backgroundColor: isActive ? `hsl(${color})` : undefined,
                    color: isActive ? "white" : `hsl(${color})`,
                    fontWeight: isActive ? 700 : 400,
                  }}
                >
                  {rating}
                </button>
              );
            })}
          </div>

          {/* PVI filter */}
          <div className="mb-2 flex flex-wrap gap-1 items-center">
            <span className="text-[9px] font-bold mr-1">PVI:</span>
            {PVI_FILTER_OPTIONS.map((opt) => {
              const isActive = pviFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setPviFilter(isActive && opt.id !== "all" ? "all" : opt.id)}
                  className="win98-button text-[9px] px-1 py-0"
                  style={opt.color ? {
                    backgroundColor: isActive ? `hsl(${opt.color})` : undefined,
                    color: isActive ? "white" : `hsl(${opt.color})`,
                    fontWeight: isActive ? 700 : 400,
                  } : {
                    fontWeight: isActive ? 700 : 400,
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Map */}
          {districts.length > 0 && (
            <div className="mb-3 win98-sunken bg-white p-2">
              <p className="text-[11px] font-bold mb-1">Congressional District Map</p>
              <DistrictMap districts={districts} onSelectDistrict={onSelectSlug} pviFilter={pviFilter} />
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {filteredDistricts.map(d => (
              <DistrictCard key={d.district_id} district={d} onClick={onSelectSlug} />
            ))}
          </div>
          {filteredDistricts.length === 0 && (
            <div className="text-center py-8">
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">No districts match your search.</p>
            </div>
          )}
        </>
      )}

      {tab === "state-legislative" && (
        <StateLegislativeSection
          districts={stateLegDistricts}
          loading={stateLegLoading}
          onSync={onStateLegSync}
          syncing={stateLegSyncing}
        />
      )}
      {tab === "legislation" && <LegislationSection />}
    </div>
  );
}
