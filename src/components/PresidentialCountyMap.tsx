import { useState, useEffect, useMemo, useCallback, memo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { supabase } from "@/integrations/supabase/client";
import { Vote, ChevronLeft, ChevronRight, Loader2, ExternalLink, ZoomIn, ZoomOut } from "lucide-react";

// ─── Constants ──────────────────────────────────────────────────────────────

const COUNTY_GEO_URL = `${import.meta.env.BASE_URL}counties-10m.json`;

const ELECTION_YEARS = [2024, 2020, 2016, 2012, 2008, 2004, 2000];

const PARTY_COLORS = {
  dem: { strong: "hsl(210 80% 40%)", lean: "hsl(210 55% 60%)", light: "hsl(210 40% 75%)" },
  rep: { strong: "hsl(0 75% 42%)", lean: "hsl(0 55% 58%)", light: "hsl(0 40% 72%)" },
  other: { strong: "hsl(45 70% 45%)", lean: "hsl(45 50% 60%)", light: "hsl(45 35% 75%)" },
  none: "hsl(var(--muted))",
};

// State FIPS codes
const STATE_FIPS: Record<string, string> = {
  AL:"01",AK:"02",AZ:"04",AR:"05",CA:"06",CO:"08",CT:"09",DE:"10",FL:"12",GA:"13",
  HI:"15",ID:"16",IL:"17",IN:"18",IA:"19",KS:"20",KY:"21",LA:"22",ME:"23",MD:"24",
  MA:"25",MI:"26",MN:"27",MS:"28",MO:"29",MT:"30",NE:"31",NV:"32",NH:"33",NJ:"34",
  NM:"35",NY:"36",NC:"37",ND:"38",OH:"39",OK:"40",OR:"41",PA:"42",RI:"44",SC:"45",
  SD:"46",TN:"47",TX:"48",UT:"49",VT:"50",VA:"51",WA:"53",WV:"54",WI:"55",WY:"56",
  DC:"11",
};

// State centers for zoom
const STATE_CENTERS: Record<string, [number, number]> = {
  AL:[-86.9,32.8],AK:[-153.5,63.6],AZ:[-111.9,34.2],AR:[-92.4,34.8],CA:[-119.7,37.3],
  CO:[-105.5,39],CT:[-72.7,41.6],DE:[-75.5,39],FL:[-81.7,28.1],GA:[-83.5,32.7],
  HI:[-155.5,20],ID:[-114.7,44.2],IL:[-89.4,40],IN:[-86.3,39.8],IA:[-93.5,42],
  KS:[-98.5,38.5],KY:[-84.8,37.8],LA:[-91.9,31],ME:[-69.4,45.4],MD:[-76.6,39],
  MA:[-71.8,42.3],MI:[-84.7,44.3],MN:[-94.3,46.3],MS:[-89.7,32.7],MO:[-92.5,38.5],
  MT:[-109.6,46.9],NE:[-99.8,41.5],NV:[-116.6,39.3],NH:[-71.6,43.7],NJ:[-74.4,40.1],
  NM:[-106,34.5],NY:[-75.5,43],NC:[-79.4,35.6],ND:[-100.5,47.5],OH:[-82.8,40.4],
  OK:[-97.5,35.5],OR:[-120.5,44],PA:[-77.6,41.2],RI:[-71.5,41.7],SC:[-80.9,34],
  SD:[-100.2,44.4],TN:[-86.3,35.8],TX:[-99.4,31.5],UT:[-111.7,39.3],VT:[-72.6,44.1],
  VA:[-79.4,37.5],WA:[-120.7,47.5],WV:[-80.6,38.6],WI:[-89.8,44.6],WY:[-107.6,43],
  DC:[-77,38.9],
};

const STATE_ZOOMS: Record<string, number> = {
  AL:5,AK:2.5,AZ:5,AR:5.5,CA:4,CO:5,CT:9,DE:10,FL:4.5,GA:5,HI:5,ID:4.5,IL:4.5,
  IN:5,IA:5,KS:5,KY:5.5,LA:5.5,ME:5,MD:7,MA:8,MI:4.5,MN:4,MS:5,MO:4.5,MT:4.5,
  NE:5,NV:4,NH:7,NJ:7,NM:4.5,NY:4.5,NC:5,ND:5,OH:5.5,OK:5,OR:4.5,PA:5.5,RI:12,
  SC:6,SD:5,TN:5.5,TX:3.5,UT:5,VT:7,VA:5,WA:5,WV:6,WI:4.5,WY:5,DC:14,
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface CountyResult {
  county_fips: string;
  county_name: string;
  candidate: string;
  party: string | null;
  candidatevotes: number;
  totalvotes: number;
}

interface CountyWinner {
  county_name: string;
  winner: string;
  party: string;
  margin: number; // 0-100
  dem_pct: number;
  rep_pct: number;
  total_votes: number;
}

// ─── Data fetch ─────────────────────────────────────────────────────────────

async function fetchCountyResults(
  stateAbbr: string,
  year: number,
): Promise<Map<string, CountyWinner>> {
  const stateFips = STATE_FIPS[stateAbbr];
  if (!stateFips) return new Map();

  const { data, error } = await supabase
    .from("mit_election_results")
    .select("county_fips,county_name,candidate,party,candidatevotes,totalvotes")
    .eq("state_po", stateAbbr)
    .eq("office", "US PRESIDENT")
    .eq("year", year)
    .eq("stage", "gen")
    .not("county_fips", "is", null)
    .order("candidatevotes", { ascending: false });

  if (error || !data) return new Map();

  // Group by county_fips, determine winner
  const byCounty = new Map<string, CountyResult[]>();
  for (const r of data as CountyResult[]) {
    if (!r.county_fips) continue;
    const fips = r.county_fips.padStart(5, "0");
    if (!byCounty.has(fips)) byCounty.set(fips, []);
    byCounty.get(fips)!.push(r);
  }

  const winners = new Map<string, CountyWinner>();
  for (const [fips, candidates] of byCounty) {
    candidates.sort((a, b) => (b.candidatevotes || 0) - (a.candidatevotes || 0));
    const top = candidates[0];
    const totalVotes = top.totalvotes || candidates.reduce((s, c) => s + (c.candidatevotes || 0), 0);
    
    const demCandidate = candidates.find(c => c.party?.toUpperCase().includes("DEMOCRAT"));
    const repCandidate = candidates.find(c => c.party?.toUpperCase().includes("REPUBLICAN"));
    const demVotes = demCandidate?.candidatevotes || 0;
    const repVotes = repCandidate?.candidatevotes || 0;
    const demPct = totalVotes > 0 ? (demVotes / totalVotes) * 100 : 0;
    const repPct = totalVotes > 0 ? (repVotes / totalVotes) * 100 : 0;
    const margin = Math.abs(demPct - repPct);

    winners.set(fips, {
      county_name: top.county_name || fips,
      winner: top.candidate,
      party: top.party?.toUpperCase() || "",
      margin,
      dem_pct: Math.round(demPct * 10) / 10,
      rep_pct: Math.round(repPct * 10) / 10,
      total_votes: totalVotes,
    });
  }

  return winners;
}

function getCountyColor(winner: CountyWinner | undefined): string {
  if (!winner) return PARTY_COLORS.none;
  const isDem = winner.party.includes("DEMOCRAT");
  const isRep = winner.party.includes("REPUBLICAN");
  const palette = isDem ? PARTY_COLORS.dem : isRep ? PARTY_COLORS.rep : PARTY_COLORS.other;
  
  if (typeof palette === "string") return palette;
  if (winner.margin > 20) return palette.strong;
  if (winner.margin > 8) return palette.lean;
  return palette.light;
}

// ─── Tooltip ────────────────────────────────────────────────────────────────

function Tooltip({ winner, x, y }: { winner: CountyWinner; x: number; y: number }) {
  return (
    <div
      className="pointer-events-none fixed z-50 rounded-lg border border-border bg-popover px-3 py-2 shadow-lg text-xs"
      style={{ left: x + 12, top: y - 10 }}
    >
      <p className="font-display font-bold text-foreground text-sm">{winner.county_name}</p>
      <div className="flex items-center gap-3 mt-1">
        <span style={{ color: PARTY_COLORS.dem.strong }} className="font-semibold">
          D {winner.dem_pct}%
        </span>
        <span style={{ color: PARTY_COLORS.rep.strong }} className="font-semibold">
          R {winner.rep_pct}%
        </span>
      </div>
      <p className="text-muted-foreground mt-0.5">
        {winner.total_votes.toLocaleString()} total votes
      </p>
      <p className="text-muted-foreground">
        Winner: {winner.winner} ({winner.margin.toFixed(1)}pt margin)
      </p>
    </div>
  );
}

// ─── Legend ──────────────────────────────────────────────────────────────────

function Legend() {
  const items = [
    { label: "Strong D (20+)", color: PARTY_COLORS.dem.strong },
    { label: "Lean D (8–20)", color: PARTY_COLORS.dem.lean },
    { label: "Tilt D (<8)", color: PARTY_COLORS.dem.light },
    { label: "Tilt R (<8)", color: PARTY_COLORS.rep.light },
    { label: "Lean R (8–20)", color: PARTY_COLORS.rep.lean },
    { label: "Strong R (20+)", color: PARTY_COLORS.rep.strong },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

// ─── Summary Bar ────────────────────────────────────────────────────────────

function SummaryBar({ winners }: { winners: Map<string, CountyWinner> }) {
  const demCounties = Array.from(winners.values()).filter(w => w.party.includes("DEMOCRAT")).length;
  const repCounties = Array.from(winners.values()).filter(w => w.party.includes("REPUBLICAN")).length;
  const total = winners.size;
  if (total === 0) return null;
  const demPct = (demCounties / total) * 100;

  return (
    <div className="mt-3">
      <div className="h-3 rounded-full overflow-hidden flex">
        <div style={{ width: `${demPct}%`, backgroundColor: PARTY_COLORS.dem.strong }} className="transition-all" />
        <div style={{ width: `${100 - demPct}%`, backgroundColor: PARTY_COLORS.rep.strong }} className="transition-all" />
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
        <span style={{ color: PARTY_COLORS.dem.strong }} className="font-semibold">
          D: {demCounties} counties
        </span>
        <span className="text-muted-foreground">{total} total</span>
        <span style={{ color: PARTY_COLORS.rep.strong }} className="font-semibold">
          R: {repCounties} counties
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface PresidentialCountyMapProps {
  stateAbbr: string;
}

export function PresidentialCountyMap({ stateAbbr }: PresidentialCountyMapProps) {
  const [year, setYear] = useState(2024);
  const [winners, setWinners] = useState<Map<string, CountyWinner>>(new Map());
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ winner: CountyWinner; x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);

  const stateFips = STATE_FIPS[stateAbbr] || "";
  const center = STATE_CENTERS[stateAbbr] || [-98.5, 39.8];
  const baseZoom = STATE_ZOOMS[stateAbbr] || 5;

  useEffect(() => {
    setLoading(true);
    setTooltip(null);
    fetchCountyResults(stateAbbr, year)
      .then(setWinners)
      .finally(() => setLoading(false));
  }, [stateAbbr, year]);

  const handleMouseEnter = useCallback((fips: string, event: React.MouseEvent) => {
    const w = winners.get(fips);
    if (w) setTooltip({ winner: w, x: event.clientX, y: event.clientY });
  }, [winners]);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (tooltip) setTooltip(prev => prev ? { ...prev, x: event.clientX, y: event.clientY } : null);
  }, [tooltip]);

  const yearIdx = ELECTION_YEARS.indexOf(year);
  const canPrev = yearIdx < ELECTION_YEARS.length - 1;
  const canNext = yearIdx > 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm font-semibold text-foreground flex items-center gap-2">
          <Vote className="h-4 w-4 text-primary" />
          Presidential Results by County
        </h3>
        <a
          href="https://electionlab.mit.edu/data"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          MIT Election Lab
        </a>
      </div>

      {/* Year selector */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <button
          onClick={() => canPrev && setYear(ELECTION_YEARS[yearIdx + 1])}
          disabled={!canPrev}
          className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1">
          {ELECTION_YEARS.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                y === year
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
        <button
          onClick={() => canNext && setYear(ELECTION_YEARS[yearIdx - 1])}
          disabled={!canNext}
          className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Map */}
      <div className="relative rounded-lg border border-border overflow-hidden bg-muted/20" style={{ height: 360 }}>
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}

        {!loading && winners.size === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-muted-foreground text-xs">
            <span className="text-3xl mb-2">🗳️</span>
            <p>No county data for {stateAbbr} in {year}.</p>
            <p className="text-[10px] mt-1">Sync "President (County)" data from the Voter Data → Election History tab.</p>
          </div>
        )}

        <ComposableMap
          projection="geoAlbersUsa"
          projectionConfig={{ scale: 1000 }}
          className="w-full h-full"
          style={{ width: "100%", height: "100%" }}
        >
          <ZoomableGroup
            center={center as [number, number]}
            zoom={baseZoom * zoom}
            minZoom={baseZoom * 0.5}
            maxZoom={baseZoom * 4}
          >
            <Geographies geography={COUNTY_GEO_URL}>
              {({ geographies }) =>
                geographies
                  .filter((geo) => {
                    const fips = geo.id?.toString().padStart(5, "0") || "";
                    return fips.startsWith(stateFips);
                  })
                  .map((geo) => {
                    const fips = geo.id?.toString().padStart(5, "0") || "";
                    const winner = winners.get(fips);
                    const fillColor = getCountyColor(winner);

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={fillColor}
                        stroke="hsl(var(--border))"
                        strokeWidth={0.3}
                        style={{
                          default: { outline: "none" },
                          hover: { outline: "none", strokeWidth: 1, stroke: "hsl(var(--foreground))" },
                          pressed: { outline: "none" },
                        }}
                        onMouseEnter={(e) => handleMouseEnter(fips, e as unknown as React.MouseEvent)}
                        onMouseMove={handleMouseMove as any}
                        onMouseLeave={handleMouseLeave}
                      />
                    );
                  })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>

        {/* Zoom controls */}
        <div className="absolute bottom-2 right-2 flex flex-col gap-1">
          <button
            onClick={() => setZoom(z => Math.min(z * 1.3, 4))}
            className="flex items-center justify-center h-7 w-7 rounded-md bg-card border border-border shadow-sm hover:bg-muted transition-colors"
          >
            <ZoomIn className="h-3.5 w-3.5 text-foreground" />
          </button>
          <button
            onClick={() => setZoom(z => Math.max(z / 1.3, 0.5))}
            className="flex items-center justify-center h-7 w-7 rounded-md bg-card border border-border shadow-sm hover:bg-muted transition-colors"
          >
            <ZoomOut className="h-3.5 w-3.5 text-foreground" />
          </button>
        </div>
      </div>

      {tooltip && <Tooltip {...tooltip} />}

      <Legend />
      <SummaryBar winners={winners} />

      <p className="text-[10px] text-muted-foreground mt-3 text-center">
        County-level presidential returns from MIT Election Data + Science Lab (2000–2024)
      </p>
    </div>
  );
}
