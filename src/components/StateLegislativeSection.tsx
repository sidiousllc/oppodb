import { useState, useMemo, useCallback } from "react";
import {
  type StateLegislativeProfile,
  type ChamberFilter,
  searchStateLegislative,
  ALL_STATE_ABBRS,
  STATE_NAMES,
} from "@/data/stateLegislativeIntel";
import { MapPin, ChevronRight, Users, Building2, Landmark, ArrowLeft, Search, TrendingUp, Home, GraduationCap, DollarSign, Vote, Download } from "lucide-react";
import { StateLegBoundaryMap } from "./StateLegBoundaryMap";
import { StateLegOverviewMap } from "./StateLegOverviewMap";
import { ElectionResultsSection } from "./ElectionResultsSection";
import { syncElectionResults, hasSyncCheckpoint, clearSyncCheckpoint, type SyncReport } from "@/data/electionResults";
import { SyncResultsPanel } from "./SyncResultsPanel";
import { exportStateLegPDF } from "@/lib/stateLegExport";
import { StatePollingPanel } from "@/components/StatePollingPanel";
import { AreaFinancePanel } from "@/components/AreaFinancePanel";

// ─── Card ───────────────────────────────────────────────────────────────────

function StateLegCard({
  district,
  onClick,
}: {
  district: StateLegislativeProfile;
  onClick: (d: StateLegislativeProfile) => void;
}) {
  const isHouse = district.chamber === "house";
  const chamberColor = isHouse ? "210 80% 50%" : "280 60% 50%";
  const label = isHouse ? "House" : "Senate";
  const num = district.district_number;

  return (
    <div
      className="candidate-card animate-fade-in cursor-pointer"
      onClick={() => onClick(district)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `hsl(${chamberColor} / 0.1)` }}
          >
            {isHouse ? (
              <Building2 className="h-5 w-5" style={{ color: `hsl(${chamberColor})` }} />
            ) : (
              <Landmark className="h-5 w-5" style={{ color: `hsl(${chamberColor})` }} />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display text-base font-semibold text-foreground">
                {district.state_abbr} {label} {num}
              </h3>
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide border"
                style={{
                  backgroundColor: `hsl(${chamberColor} / 0.1)`,
                  color: `hsl(${chamberColor})`,
                  borderColor: `hsl(${chamberColor} / 0.25)`,
                }}
              >
                {label}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="tag tag-governor">{district.state}</span>
              {district.population && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {district.population.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-3" />
      </div>
      {/* Quick stats row */}
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {district.median_income && (
          <span className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            ${district.median_income.toLocaleString()}
          </span>
        )}
        {district.education_bachelor_pct && (
          <span className="flex items-center gap-1">
            <GraduationCap className="h-3 w-3" />
            {district.education_bachelor_pct}% BA+
          </span>
        )}
        {district.owner_occupied_pct && (
          <span className="flex items-center gap-1">
            <Home className="h-3 w-3" />
            {district.owner_occupied_pct}% own
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Detail View ────────────────────────────────────────────────────────────

function StatLegDetail({
  district,
  onBack,
}: {
  district: StateLegislativeProfile;
  onBack: () => void;
}) {
  const isHouse = district.chamber === "house";
  const chamberColor = isHouse ? "210 80% 50%" : "280 60% 50%";
  const label = isHouse ? "House" : "Senate";

  const statRow = (lbl: string, value: string | number | null | undefined, suffix = "") => {
    if (value === null || value === undefined) return null;
    return (
      <div className="flex items-center justify-between py-2 border-b border-border/50">
        <span className="text-sm text-muted-foreground">{lbl}</span>
        <span className="text-sm font-medium text-foreground">
          {typeof value === "number" ? value.toLocaleString() : value}{suffix}
        </span>
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to State Legislative Districts
      </button>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `hsl(${chamberColor} / 0.1)` }}
          >
            {isHouse ? (
              <Building2 className="h-6 w-6" style={{ color: `hsl(${chamberColor})` }} />
            ) : (
              <Landmark className="h-6 w-6" style={{ color: `hsl(${chamberColor})` }} />
            )}
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">
              {district.state_abbr} {label} District {district.district_number}
            </h2>
            <p className="text-sm text-muted-foreground">{district.state}</p>
          </div>
        </div>
        <button
          onClick={() => exportStateLegPDF(district)}
          className="win98-button text-[10px] flex items-center gap-1 shrink-0"
        >
          <Download className="h-3 w-3" />
          PDF
        </button>
      </div>

      {/* State Polling */}
      <StatePollingPanel stateAbbr={district.state_abbr} />

      {/* Campaign Finance */}
      <AreaFinancePanel stateAbbr={district.state_abbr} title={`Campaign Finance — ${district.state}`} />

      {/* Election History */}
      <div className="mb-6">
        <ElectionResultsSection
          stateAbbr={district.state_abbr}
          chamber={district.chamber}
          districtNumber={district.district_number}
        />
      </div>

      {/* District Boundary Map */}
      <div className="mb-6">
        <StateLegBoundaryMap
          stateAbbr={district.state_abbr}
          stateName={district.state}
          chamber={district.chamber as "house" | "senate"}
          districtNumber={district.district_number}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Demographics */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-display text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Demographics
          </h3>
          {statRow("Population", district.population)}
          {statRow("Median Age", district.median_age)}
          {statRow("Total Households", district.total_households)}
          {statRow("Avg Household Size", district.avg_household_size)}
          {statRow("Veteran Population", district.veteran_pct, "%")}
          {statRow("Foreign Born", district.foreign_born_pct, "%")}
        </div>

        {/* Economics */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-display text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Economics
          </h3>
          {statRow("Median Income", district.median_income ? `$${district.median_income.toLocaleString()}` : null)}
          {statRow("Poverty Rate", district.poverty_rate, "%")}
          {statRow("Unemployment", district.unemployment_rate, "%")}
          {statRow("Uninsured", district.uninsured_pct, "%")}
          {statRow("Median Home Value", district.median_home_value ? `$${district.median_home_value.toLocaleString()}` : null)}
          {statRow("Median Rent", district.median_rent ? `$${district.median_rent.toLocaleString()}` : null)}
          {statRow("Owner-Occupied", district.owner_occupied_pct, "%")}
        </div>

        {/* Race & Ethnicity */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-display text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Race & Ethnicity
          </h3>
          {district.white_pct !== null && (
            <DemographicBar label="White" pct={district.white_pct!} color="220 15% 60%" />
          )}
          {district.black_pct !== null && (
            <DemographicBar label="Black" pct={district.black_pct!} color="210 60% 45%" />
          )}
          {district.hispanic_pct !== null && (
            <DemographicBar label="Hispanic" pct={district.hispanic_pct!} color="30 80% 50%" />
          )}
          {district.asian_pct !== null && (
            <DemographicBar label="Asian" pct={district.asian_pct!} color="160 50% 45%" />
          )}
        </div>

        {/* Education */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-display text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            Education & Housing
          </h3>
          {statRow("Bachelor's Degree+", district.education_bachelor_pct, "%")}
          {statRow("Owner-Occupied Housing", district.owner_occupied_pct, "%")}
          {statRow("Median Home Value", district.median_home_value ? `$${district.median_home_value.toLocaleString()}` : null)}
          {statRow("Median Rent", district.median_rent ? `$${district.median_rent.toLocaleString()}` : null)}
        </div>
      </div>
    </div>
  );
}

function DemographicBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="mb-2.5">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: `hsl(${color})` }}
        />
      </div>
    </div>
  );
}

// ─── Main Section ───────────────────────────────────────────────────────────

interface StateLegislativeSectionProps {
  districts: StateLegislativeProfile[];
  loading: boolean;
  onSync: (state?: string, chamber?: string) => void;
  syncing: boolean;
}

export function StateLegislativeSection({
  districts,
  loading,
  onSync,
  syncing,
}: StateLegislativeSectionProps) {
  const [search, setSearch] = useState("");
  const [selectedState, setSelectedState] = useState<string>("all");
  const [chamberFilter, setChamberFilter] = useState<ChamberFilter>("all");
  const [selectedDistrict, setSelectedDistrict] = useState<StateLegislativeProfile | null>(null);
  const [syncingElections, setSyncingElections] = useState(false);
  const [syncProgress, setSyncProgress] = useState("");
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null);
  const canResume = hasSyncCheckpoint();

  const filtered = useMemo(() => {
    let results = districts;
    if (selectedState !== "all") {
      results = results.filter((d) => d.state_abbr === selectedState);
    }
    if (chamberFilter !== "all") {
      results = results.filter((d) => d.chamber === chamberFilter);
    }
    if (search) {
      results = searchStateLegislative(results, search);
    }
    return results;
  }, [districts, selectedState, chamberFilter, search]);

  const stateStats = useMemo(() => {
    const states = new Set(districts.map((d) => d.state_abbr));
    const houseCount = districts.filter((d) => d.chamber === "house").length;
    const senateCount = districts.filter((d) => d.chamber === "senate").length;
    return { stateCount: states.size, houseCount, senateCount, total: districts.length };
  }, [districts]);

  const handleSync = useCallback(() => {
    const state = selectedState !== "all" ? selectedState : undefined;
    const chamber = chamberFilter !== "all" ? chamberFilter : undefined;
    onSync(state, chamber);
  }, [selectedState, chamberFilter, onSync]);

  const handleElectionSync = useCallback(async (resume = false) => {
    setSyncingElections(true);
    setSyncProgress("");
    setSyncReport(null);
    try {
      const state = selectedState !== "all" ? selectedState : undefined;
      const result = await syncElectionResults(state, (completed, total, currentState) => {
        if (currentState === "done") {
          setSyncProgress("Complete!");
        } else {
          setSyncProgress(`${currentState} (${completed + 1}/${total})`);
        }
      }, resume);
      setSyncReport(result);
      console.log("Election sync result:", result);
    } catch (e) {
      console.error("Election sync error:", e);
    } finally {
      setSyncingElections(false);
      setTimeout(() => setSyncProgress(""), 3000);
    }
  }, [selectedState]);

  if (selectedDistrict) {
    return (
      <StatLegDetail
        district={selectedDistrict}
        onBack={() => setSelectedDistrict(null)}
      />
    );
  }

  return (
    <div>
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{stateStats.total.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total Districts</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{stateStats.stateCount}</p>
          <p className="text-xs text-muted-foreground">States</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold" style={{ color: "hsl(210, 80%, 50%)" }}>{stateStats.houseCount.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">House Districts</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold" style={{ color: "hsl(280, 60%, 50%)" }}>{stateStats.senateCount.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Senate Districts</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* State selector */}
        <select
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground"
        >
          <option value="all">All States</option>
          {ALL_STATE_ABBRS.filter(a => a !== "DC").map((abbr) => (
            <option key={abbr} value={abbr}>
              {abbr} — {STATE_NAMES[abbr]}
            </option>
          ))}
        </select>

        {/* Chamber toggle */}
        <div className="inline-flex rounded-lg border border-border overflow-hidden">
          {(["all", "house", "senate"] as ChamberFilter[]).map((ch) => (
            <button
              key={ch}
              onClick={() => setChamberFilter(ch)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                ch !== "all" ? "border-l border-border" : ""
              } ${
                chamberFilter === ch
                  ? "bg-foreground text-background"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {ch === "all" ? "Both Chambers" : ch === "house" ? "House" : "Senate"}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px] rounded-lg border border-border bg-card px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search districts…"
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>

        {/* Sync buttons */}
        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {syncing ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Syncing…
            </>
          ) : (
            <>Sync from Census</>
          )}
        </button>
        <button
          onClick={() => handleElectionSync(false)}
          disabled={syncingElections}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
        >
          {syncingElections ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
              {syncProgress || "Syncing Elections…"}
            </>
          ) : (
            <>
              <Vote className="h-3 w-3" />
              Sync Election Results
            </>
          )}
        </button>
        {canResume && !syncingElections && (
          <button
            onClick={() => handleElectionSync(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            Resume Sync
          </button>
        )}
      </div>

      {/* Sync results panel */}
      {syncReport && (
        <div className="mb-4">
          <SyncResultsPanel report={syncReport} onClose={() => setSyncReport(null)} />
        </div>
      )}

      {/* Results count */}
      <p className="text-sm text-muted-foreground mb-3">
        {filtered.length.toLocaleString()} districts
        {selectedState !== "all" && ` in ${STATE_NAMES[selectedState] || selectedState}`}
        {chamberFilter !== "all" && ` (${chamberFilter})`}
      </p>

      {/* State overview map — shown when a specific state is selected */}
      {selectedState !== "all" && !loading && (
        <StateLegOverviewMap
          stateAbbr={selectedState}
          onDistrictClick={(chamber, districtNumber) => {
            const match = districts.find(
              (d) => d.state_abbr === selectedState && d.chamber === chamber && d.district_number === districtNumber
            );
            if (match) setSelectedDistrict(match);
          }}
        />
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            <span className="text-sm">Loading state legislative districts…</span>
          </div>
        </div>
      )}

      {!loading && districts.length === 0 && (
        <div className="text-center py-16">
          <MapPin className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="font-display text-lg font-semibold text-foreground mb-1">
            No state legislative data yet
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Click "Sync from Census" to pull demographic data for all ~9,300 state legislative districts from the Census ACS 5-Year survey.
          </p>
          <button
            onClick={() => onSync()}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {syncing ? "Syncing…" : "Sync All State Legislative Data"}
          </button>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.slice(0, 200).map((d) => (
            <StateLegCard
              key={`${d.district_id}-${d.chamber}`}
              district={d}
              onClick={setSelectedDistrict}
            />
          ))}
        </div>
      )}

      {!loading && filtered.length > 200 && (
        <p className="text-center text-xs text-muted-foreground mt-4">
          Showing 200 of {filtered.length.toLocaleString()} districts. Use filters to narrow results.
        </p>
      )}

      {!loading && filtered.length === 0 && districts.length > 0 && (
        <div className="text-center py-16">
          <p className="text-muted-foreground">No districts match your search.</p>
        </div>
      )}
    </div>
  );
}
