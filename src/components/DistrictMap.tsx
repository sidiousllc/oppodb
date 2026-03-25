import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { Search, X, Users, DollarSign, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CompetitiveRacesSidebar } from "@/components/CompetitiveRacesSidebar";
import { type DistrictProfile } from "@/data/districtIntel";
import { getEffectivePVI, formatPVI, getPVIColor, hasPVIShift } from "@/data/cookPVI";
import {
  getCookRating,
  getCookRatingColor,
  COOK_RATING_ORDER,
  COOK_RATING_COLORS,
  type CookRating,
} from "@/data/cookRatings";

// ─── Data Sources ───────────────────────────────────────────────────────────
// Use local static file only — no external CDN calls
const LOCAL_CD_GEO = "/us-cd-118.json";

// ─── Types & Exports ────────────────────────────────────────────────────────

export type ColorMode = "cook" | "pvi" | "forecast";
export type PVIFilter = "all" | "strong-d" | "lean-d" | "swing" | "lean-r" | "strong-r";

export const PVI_FILTER_OPTIONS: { id: PVIFilter; label: string; color: string }[] = [
  { id: "all", label: "All", color: "" },
  { id: "strong-d", label: "Strong D (D+8+)", color: "210 80% 45%" },
  { id: "lean-d", label: "Lean D (D+1–7)", color: "210 50% 65%" },
  { id: "swing", label: "Swing (±0)", color: "45 80% 50%" },
  { id: "lean-r", label: "Lean R (R+1–7)", color: "0 50% 65%" },
  { id: "strong-r", label: "Strong R (R+8+)", color: "0 80% 45%" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeDistrictCode(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  if (!digits) return null;
  return digits.padStart(2, "0").slice(-2);
}

function toDistrictId(stateAbbrRaw: unknown, cdfipsRaw: unknown, districtIdRaw?: unknown): string | null {
  const stateAbbr = String(stateAbbrRaw ?? "").trim().toUpperCase();
  if (!stateAbbr) return null;

  let code = normalizeDistrictCode(cdfipsRaw);
  if (!code) {
    const districtDigits = normalizeDistrictCode(districtIdRaw);
    if (districtDigits) code = districtDigits;
  }
  if (!code) return null;

  if (code === "00" || code === "98") return `${stateAbbr}-AL`;
  return `${stateAbbr}-${code}`;
}

function matchesPVIFilter(districtId: string, filter: PVIFilter): boolean {
  if (filter === "all") return true;
  const effective = getEffectivePVI(districtId);
  const pvi = effective?.score ?? null;
  if (pvi === null) return false;
  switch (filter) {
    case "strong-d": return pvi <= -8;
    case "lean-d": return pvi >= -7 && pvi <= -1;
    case "swing": return pvi >= -2 && pvi <= 2;
    case "lean-r": return pvi >= 1 && pvi <= 7;
    case "strong-r": return pvi >= 8;
    default: return true;
  }
}

// PVI color gradient entries for legend
const PVI_LEGEND_ENTRIES = [
  { label: "D+15+", color: "210 100% 35%" },
  { label: "D+8–14", color: "210 80% 45%" },
  { label: "D+3–7", color: "210 65% 55%" },
  { label: "D+1–2", color: "210 50% 65%" },
  { label: "EVEN", color: "45 80% 50%" },
  { label: "R+1–2", color: "0 50% 65%" },
  { label: "R+3–7", color: "0 65% 55%" },
  { label: "R+8–14", color: "0 80% 45%" },
  { label: "R+15+", color: "0 85% 38%" },
];

// Forecast rating → color
const FORECAST_COLORS: Record<string, string> = {
  "Solid D": "210 100% 35%",
  "Likely D": "210 80% 45%",
  "Lean D": "210 55% 60%",
  "Toss Up": "45 80% 50%",
  "Toss-Up": "45 80% 50%",
  "Tossup": "45 80% 50%",
  "Lean R": "0 55% 60%",
  "Likely R": "0 80% 45%",
  "Solid R": "0 85% 38%",
};

// Approximate state centroids for zoom targets
const STATE_CENTERS: Record<string, { coords: [number, number]; zoom: number }> = {
  AL: { coords: [-86.9, 32.8], zoom: 5 }, AK: { coords: [-153.5, 63.6], zoom: 2.5 },
  AZ: { coords: [-111.9, 34.2], zoom: 5 }, AR: { coords: [-92.4, 34.8], zoom: 5.5 },
  CA: { coords: [-119.7, 37.3], zoom: 4 }, CO: { coords: [-105.5, 39.0], zoom: 5 },
  CT: { coords: [-72.7, 41.6], zoom: 9 }, DE: { coords: [-75.5, 39.0], zoom: 10 },
  FL: { coords: [-81.7, 28.1], zoom: 4.5 }, GA: { coords: [-83.5, 32.7], zoom: 5 },
  HI: { coords: [-155.5, 20.0], zoom: 5 }, ID: { coords: [-114.7, 44.2], zoom: 4.5 },
  IL: { coords: [-89.4, 40.0], zoom: 4.5 }, IN: { coords: [-86.3, 39.8], zoom: 5 },
  IA: { coords: [-93.5, 42.0], zoom: 5 }, KS: { coords: [-98.5, 38.5], zoom: 5 },
  KY: { coords: [-84.8, 37.8], zoom: 5.5 }, LA: { coords: [-91.9, 31.0], zoom: 5.5 },
  ME: { coords: [-69.4, 45.4], zoom: 5 }, MD: { coords: [-76.6, 39.0], zoom: 7 },
  MA: { coords: [-71.8, 42.3], zoom: 8 }, MI: { coords: [-84.7, 44.3], zoom: 4.5 },
  MN: { coords: [-94.3, 46.3], zoom: 4 }, MS: { coords: [-89.7, 32.7], zoom: 5 },
  MO: { coords: [-92.5, 38.5], zoom: 4.5 }, MT: { coords: [-109.6, 46.9], zoom: 4.5 },
  NE: { coords: [-99.8, 41.5], zoom: 5 }, NV: { coords: [-116.6, 39.3], zoom: 4 },
  NH: { coords: [-71.6, 43.7], zoom: 7 }, NJ: { coords: [-74.4, 40.1], zoom: 7 },
  NM: { coords: [-106.0, 34.5], zoom: 4.5 }, NY: { coords: [-75.5, 43.0], zoom: 4.5 },
  NC: { coords: [-79.4, 35.6], zoom: 5 }, ND: { coords: [-100.5, 47.5], zoom: 5 },
  OH: { coords: [-82.8, 40.4], zoom: 5.5 }, OK: { coords: [-97.5, 35.5], zoom: 5 },
  OR: { coords: [-120.5, 44.0], zoom: 4.5 }, PA: { coords: [-77.6, 41.2], zoom: 5.5 },
  RI: { coords: [-71.5, 41.7], zoom: 12 }, SC: { coords: [-80.9, 34.0], zoom: 6 },
  SD: { coords: [-100.2, 44.4], zoom: 5 }, TN: { coords: [-86.3, 35.8], zoom: 5.5 },
  TX: { coords: [-99.4, 31.5], zoom: 3.5 }, UT: { coords: [-111.7, 39.3], zoom: 5 },
  VT: { coords: [-72.6, 44.1], zoom: 7 }, VA: { coords: [-79.4, 37.5], zoom: 5 },
  WA: { coords: [-120.7, 47.5], zoom: 5 }, WV: { coords: [-80.6, 38.6], zoom: 6 },
  WI: { coords: [-89.8, 44.6], zoom: 4.5 }, WY: { coords: [-107.6, 43.0], zoom: 5 },
  DC: { coords: [-77.0, 38.9], zoom: 14 },
};

const STATE_NAME_TO_ABBR: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
  Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
  Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK",
  Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
  Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI",
  Wyoming: "WY", "District of Columbia": "DC",
};

// ─── DB Data Types ──────────────────────────────────────────────────────────

interface ForecastEntry {
  state_abbr: string;
  district: string | null;
  source: string;
  rating: string | null;
}

interface DemographicEntry {
  district_id: string;
  population: number | null;
  median_income: number | null;
  top_issues: string[];
}

interface FinanceEntry {
  candidate_name: string;
  state_abbr: string;
  district: string | null;
  total_raised: number | null;
  party: string | null;
}

// ─── GeoJSON ────────────────────────────────────────────────────────────────

interface DistrictGeoJSON {
  type: string;
  features: Array<{
    type: string;
    properties: Record<string, unknown>;
    geometry: unknown;
  }>;
}

let districtGeoCache: DistrictGeoJSON | null = null;

// ─── Component ──────────────────────────────────────────────────────────────

interface DistrictMapProps {
  districts: DistrictProfile[];
  onSelectDistrict: (districtId: string) => void;
  pviFilter?: PVIFilter;
}

interface TooltipData {
  districtId: string;
  rating: CookRating | null;
  pvi: number | null;
  shift: { shifted: boolean; delta: number };
  topIssues: string[];
  population: number | null;
  medianIncome: number | null;
  forecasts: { source: string; rating: string }[];
  finance: { name: string; raised: number; party: string | null }[];
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

const DistrictMapInner = ({ districts, onSelectDistrict, pviFilter = "all" }: DistrictMapProps) => {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [geoData, setGeoData] = useState<DistrictGeoJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadLabel, setLoadLabel] = useState("Loading district boundaries…");
  const [colorMode, setColorMode] = useState<ColorMode>("cook");
  const [zoomState, setZoomState] = useState<{ center: [number, number]; zoom: number }>({
    center: [-96, 38],
    zoom: 1,
  });
  const [zoomedStateAbbr, setZoomedStateAbbr] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedDistrict, setHighlightedDistrict] = useState<string | null>(null);
  const [competitiveOnly, setCompetitiveOnly] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // DB-sourced data
  const [dbForecasts, setDbForecasts] = useState<Map<string, ForecastEntry[]>>(new Map());
  const [dbDemographics, setDbDemographics] = useState<Map<string, DemographicEntry>>(new Map());
  const [dbFinance, setDbFinance] = useState<Map<string, FinanceEntry[]>>(new Map());
  const [consensusRatings, setConsensusRatings] = useState<Map<string, string>>(new Map());

  // Load GeoJSON from local static file
  useEffect(() => {
    let cancelled = false;
    setLoadProgress(10);
    setLoadLabel("Loading district boundaries…");

    (async () => {
      if (districtGeoCache) {
        if (!cancelled) { setGeoData(districtGeoCache); setLoading(false); setLoadProgress(100); }
        return;
      }
      try {
        setLoadProgress(30);
        const res = await fetch(LOCAL_CD_GEO);
        if (!res.ok) throw new Error("Failed to load local GeoJSON");
        setLoadProgress(60);
        setLoadLabel("Parsing geometry…");
        const data = await res.json();
        districtGeoCache = data;
        if (!cancelled) {
          setGeoData(data);
          setLoadProgress(100);
          setLoadLabel("Ready");
          setLoading(false);
        }
      } catch {
        if (!cancelled) { setLoading(false); setLoadLabel("Failed to load map data"); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load DB data in parallel
  useEffect(() => {
    const loadForecasts = async () => {
      const { data } = await supabase
        .from("election_forecasts")
        .select("state_abbr, district, source, rating")
        .eq("cycle", 2026)
        .eq("race_type", "house");
      if (!data) return;

      const map = new Map<string, ForecastEntry[]>();
      const scoreMap: Record<string, number> = {
        "Solid D": 1, "Likely D": 2, "Lean D": 3,
        "Toss Up": 4, "Toss-Up": 4, "Tossup": 4,
        "Lean R": 5, "Likely R": 6, "Solid R": 7,
      };
      const reverseScore: Record<number, string> = {
        1: "Solid D", 2: "Likely D", 3: "Lean D", 4: "Toss Up",
        5: "Lean R", 6: "Likely R", 7: "Solid R",
      };

      for (const f of data) {
        const did = `${f.state_abbr}-${(f.district || "AL").padStart(2, "0")}`;
        if (!map.has(did)) map.set(did, []);
        map.get(did)!.push(f);
      }

      // Calculate consensus
      const consensus = new Map<string, string>();
      for (const [did, entries] of map) {
        const scores = entries
          .map(e => scoreMap[e.rating || ""])
          .filter(Boolean);
        if (scores.length) {
          const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
          consensus.set(did, reverseScore[avg] || "Toss Up");
        }
      }

      setDbForecasts(map);
      setConsensusRatings(consensus);
    };

    const loadDemographics = async () => {
      const { data } = await supabase
        .from("district_profiles")
        .select("district_id, population, median_income, top_issues");
      if (!data) return;
      const map = new Map<string, DemographicEntry>();
      for (const d of data) {
        // Normalize district_id (AK-00 → AK-AL)
        let did = d.district_id;
        if (did.endsWith("-00")) did = did.replace("-00", "-AL");
        map.set(did, { ...d, district_id: did });
      }
      setDbDemographics(map);
    };

    const loadFinance = async () => {
      const { data } = await supabase
        .from("campaign_finance")
        .select("candidate_name, state_abbr, district, total_raised, party")
        .eq("cycle", 2026)
        .eq("office", "house")
        .not("total_raised", "is", null)
        .order("total_raised", { ascending: false });
      if (!data) return;
      const map = new Map<string, FinanceEntry[]>();
      for (const f of data) {
        const did = `${f.state_abbr}-${(f.district || "AL").padStart(2, "0")}`;
        if (!map.has(did)) map.set(did, []);
        map.get(did)!.push(f);
      }
      setDbFinance(map);
    };

    loadForecasts();
    loadDemographics();
    loadFinance();
  }, []);

  const districtLookup = useMemo(() => {
    const map = new Map<string, DistrictProfile>();
    districts.forEach((d) => map.set(d.district_id, d));
    return map;
  }, [districts]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  const COMPETITIVE_RATINGS = useMemo(() => new Set([
    "Toss Up", "Toss-Up", "Tossup", "Lean D", "Lean R", "Likely D", "Likely R",
  ]), []);

  const isCompetitive = useCallback((districtId: string): boolean => {
    const consensus = consensusRatings.get(districtId);
    if (consensus && COMPETITIVE_RATINGS.has(consensus)) return true;
    const cook = getCookRating(districtId);
    if (cook && COMPETITIVE_RATINGS.has(cook)) return true;
    return false;
  }, [consensusRatings, COMPETITIVE_RATINGS]);

  const getDistrictFill = useCallback(
    (districtId: string | null): string => {
      if (!districtId) return "hsl(220, 15%, 90%)";

      if (highlightedDistrict && districtId === highlightedDistrict) {
        return "hsl(45, 100%, 55%)";
      }

      // Competitive filter: gray out non-competitive districts
      if (competitiveOnly && !isCompetitive(districtId)) {
        return "hsl(220, 5%, 94%)";
      }

      if (pviFilter !== "all" && !matchesPVIFilter(districtId, pviFilter)) {
        return "hsl(220, 5%, 92%)";
      }

      if (colorMode === "forecast") {
        const consensus = consensusRatings.get(districtId);
        if (consensus && FORECAST_COLORS[consensus]) {
          return `hsl(${FORECAST_COLORS[consensus]})`;
        }
        const rating = getCookRating(districtId);
        if (rating) return `hsl(${getCookRatingColor(rating)})`;
        return "hsl(220, 15%, 88%)";
      }

      if (colorMode === "pvi") {
        const effective = getEffectivePVI(districtId);
        if (effective) return `hsl(${getPVIColor(effective.score)})`;
        return "hsl(220, 15%, 88%)";
      }

      const rating = getCookRating(districtId);
      if (rating) return `hsl(${getCookRatingColor(rating)})`;
      return "hsl(220, 15%, 85%)";
    },
    [pviFilter, colorMode, highlightedDistrict, consensusRatings, competitiveOnly, isCompetitive]
  );

  const handleDistrictHover = useCallback(
    (stateAbbr: string, cdfips: string, districtRaw?: string) => {
      const districtId = toDistrictId(stateAbbr, cdfips, districtRaw);
      if (!districtId) return;
      const tracked =
        districtLookup.get(districtId) ||
        districtLookup.get(districtId.replace("-AL", "-00"));
      const effective = getEffectivePVI(districtId);
      const demo = dbDemographics.get(districtId);
      const forecasts = (dbForecasts.get(districtId) || [])
        .filter(f => f.rating)
        .map(f => ({ source: f.source, rating: f.rating! }));
      const finance = (dbFinance.get(districtId) || [])
        .slice(0, 4)
        .map(f => ({ name: f.candidate_name, raised: f.total_raised || 0, party: f.party }));

      setTooltip({
        districtId,
        rating: getCookRating(districtId),
        pvi: effective?.score ?? null,
        shift: hasPVIShift(districtId),
        topIssues: demo?.top_issues || tracked?.top_issues || [],
        population: demo?.population ?? null,
        medianIncome: demo?.median_income ?? null,
        forecasts,
        finance,
      });
    },
    [districtLookup, dbDemographics, dbForecasts, dbFinance]
  );

  const handleStateClick = useCallback((stateAbbr: string) => {
    const target = STATE_CENTERS[stateAbbr];
    if (!target) return;

    if (zoomState.zoom > 1 && zoomedStateAbbr === stateAbbr) {
      setZoomState({ center: [-96, 38], zoom: 1 });
      setZoomedStateAbbr(null);
      setSearchQuery("");
      setHighlightedDistrict(null);
    } else {
      setZoomState({ center: target.coords, zoom: target.zoom });
      setZoomedStateAbbr(stateAbbr);
      setSearchQuery("");
      setHighlightedDistrict(null);
    }
  }, [zoomState.zoom, zoomedStateAbbr]);

  const stateDistricts = useMemo(() => {
    if (!zoomedStateAbbr || !geoData) return [];
    const ids = new Set<string>();
    geoData.features.forEach((f) => {
      if (f.properties?.STATE_ABBR === zoomedStateAbbr) {
        const did = toDistrictId(
          f.properties.STATE_ABBR,
          f.properties.CDFIPS,
          f.properties.DISTRICTID
        );
        if (did) ids.add(did);
      }
    });
    return Array.from(ids).sort();
  }, [zoomedStateAbbr, geoData]);

  const filteredStateDistricts = useMemo(() => {
    if (!searchQuery.trim()) return stateDistricts;
    const q = searchQuery.toLowerCase();
    return stateDistricts.filter((id) => {
      const rating = getCookRating(id);
      const pvi = getEffectivePVI(id)?.score ?? null;
      const profile = districtLookup.get(id);
      const consensus = consensusRatings.get(id);
      return (
        id.toLowerCase().includes(q) ||
        (rating && rating.toLowerCase().includes(q)) ||
        (consensus && consensus.toLowerCase().includes(q)) ||
        (pvi !== null && formatPVI(pvi).toLowerCase().includes(q)) ||
        (profile?.top_issues || []).some((i) => i.toLowerCase().includes(q))
      );
    });
  }, [searchQuery, stateDistricts, districtLookup, consensusRatings]);

  const handleResetZoom = useCallback(() => {
    setZoomState({ center: [-96, 38], zoom: 1 });
    setZoomedStateAbbr(null);
    setSearchQuery("");
    setHighlightedDistrict(null);
  }, []);

  const isZoomed = zoomState.zoom > 1;

  // Stats summary
  const mapStats = useMemo(() => {
    const tossUps = Array.from(consensusRatings.entries()).filter(
      ([, r]) => r === "Toss Up" || r === "Toss-Up" || r === "Tossup"
    ).length;
    const totalForecasts = dbForecasts.size;
    const totalDemos = dbDemographics.size;
    return { tossUps, totalForecasts, totalDemos };
  }, [consensusRatings, dbForecasts, dbDemographics]);

  return (
    <div className="flex gap-4">
      <div className="flex-1 min-w-0 relative" onMouseMove={handleMouseMove}>
      {/* Stats bar */}
      <div className="flex items-center gap-4 mb-3 px-1 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1">
          <BarChart3 className="h-3 w-3" />
          {mapStats.totalForecasts} forecasted
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {mapStats.totalDemos} demographics
        </span>
        {mapStats.tossUps > 0 && (
          <span className="flex items-center gap-1 text-amber-600 font-medium">
            ⚔ {mapStats.tossUps} Toss Ups
          </span>
        )}
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="inline-flex rounded-lg border border-border overflow-hidden">
          {(["cook", "forecast", "pvi"] as ColorMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setColorMode(mode)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-border first:border-l-0 ${
                colorMode === mode
                  ? "bg-foreground text-background"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode === "cook" ? "Cook Ratings" : mode === "forecast" ? "Consensus" : "PVI Scores"}
            </button>
          ))}
        </div>

        <button
          onClick={() => setCompetitiveOnly(!competitiveOnly)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border ${
            competitiveOnly
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-muted-foreground border-border hover:text-foreground"
          }`}
        >
          <Swords className="h-3 w-3" />
          Competitive Only
        </button>

        {isZoomed && (
          <button
            onClick={handleResetZoom}
            className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Reset zoom
          </button>
        )}

        <p className="text-[10px] text-muted-foreground">
          Click a state to zoom · Click a district for details
        </p>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            <span className="text-sm">{loadLabel}</span>
          </div>
          <div className="w-64 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${loadProgress}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{loadProgress}%</span>
        </div>
      )}

      {!loading && geoData && (
        <>
          <ComposableMap
            projection="geoAlbersUsa"
            projectionConfig={{ scale: 1000 }}
            width={800}
            height={500}
            className="w-full h-auto"
          >
            <ZoomableGroup
              center={zoomState.center}
              zoom={zoomState.zoom}
              onMoveEnd={({ coordinates, zoom }) =>
                setZoomState({ center: coordinates as [number, number], zoom })
              }
              minZoom={1}
              maxZoom={20}
            >
              <Geographies geography={geoData}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const stateAbbr = geo.properties?.STATE_ABBR;
                    const cdfips = geo.properties?.CDFIPS;
                    const districtRaw = geo.properties?.DISTRICTID;
                    const districtId = toDistrictId(stateAbbr, cdfips, districtRaw);

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={getDistrictFill(districtId)}
                        stroke={highlightedDistrict === districtId ? "hsl(45, 100%, 40%)" : "hsl(0, 0%, 100%)"}
                        strokeWidth={highlightedDistrict === districtId ? 2 : 0.3}
                        onMouseEnter={() => handleDistrictHover(stateAbbr, cdfips, districtRaw)}
                        onMouseLeave={() => setTooltip(null)}
                        onClick={() => {
                          if (districtId) {
                            if (zoomState.zoom <= 1) {
                              // Zoom to state first
                              const st = districtId.split("-")[0];
                              handleStateClick(st);
                            } else {
                              onSelectDistrict(districtId);
                            }
                          }
                        }}
                        style={{
                          default: { outline: "none" },
                          hover: {
                            outline: "none",
                            strokeWidth: 1.2,
                            stroke: "hsl(var(--foreground))",
                            cursor: "pointer",
                          },
                          pressed: { outline: "none" },
                        }}
                      />
                    );
                  })
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>

          {/* Search overlay when zoomed */}
          {isZoomed && zoomedStateAbbr && (
            <div className="absolute top-14 right-3 z-40 w-72 rounded-xl border border-border bg-card/95 backdrop-blur-sm shadow-lg">
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
                <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={`Search ${zoomedStateAbbr} districts…`}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setHighlightedDistrict(null);
                  }}
                  className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(""); setHighlightedDistrict(null); }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className="max-h-52 overflow-y-auto">
                {filteredStateDistricts.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-muted-foreground text-center">No districts found</p>
                ) : (
                  filteredStateDistricts.map((did) => {
                    const rating = getCookRating(did);
                    const consensus = consensusRatings.get(did);
                    const effectivePvi = getEffectivePVI(did);
                    const pvi = effectivePvi?.score ?? null;
                    const demo = dbDemographics.get(did);
                    const isHighlighted = highlightedDistrict === did;
                    return (
                      <button
                        key={did}
                        onClick={() => setHighlightedDistrict(did)}
                        onDoubleClick={() => onSelectDistrict(did)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/60 ${
                          isHighlighted ? "bg-accent/20 border-l-2 border-primary" : ""
                        }`}
                      >
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: consensus
                              ? `hsl(${FORECAST_COLORS[consensus] || "220, 15%, 85%"})`
                              : rating
                                ? `hsl(${getCookRatingColor(rating)})`
                                : "hsl(220, 15%, 85%)",
                          }}
                        />
                        <span className="text-xs font-semibold text-foreground">{did}</span>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {consensus || rating || "N/A"}
                        </span>
                        {pvi !== null && (
                          <span className="text-[10px] font-medium" style={{ color: `hsl(${getPVIColor(pvi)})` }}>
                            {formatPVI(pvi)}
                          </span>
                        )}
                        {demo?.population && (
                          <span className="text-[10px] text-muted-foreground">
                            {(demo.population / 1000).toFixed(0)}K
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
              <div className="px-3 py-1.5 border-t border-border">
                <p className="text-[10px] text-muted-foreground">
                  Click to highlight · Double-click to view details
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {!loading && !geoData && (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          Could not load district boundaries. Try refreshing the page.
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none rounded-lg border border-border bg-card px-3 py-2.5 shadow-lg max-w-[280px]"
          style={{
            left: tooltipPos.x + 14,
            top: tooltipPos.y - 60,
          }}
        >
          <p className="font-display text-sm font-bold text-foreground">
            {tooltip.districtId}
          </p>

          {/* Ratings row */}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {tooltip.rating && (
              <div className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: `hsl(${getCookRatingColor(tooltip.rating)})` }} />
                <span className="text-xs font-medium text-foreground">{tooltip.rating}</span>
              </div>
            )}
            {tooltip.pvi !== null && (
              <div className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: `hsl(${getPVIColor(tooltip.pvi)})` }} />
                <span className="text-xs font-medium text-foreground">PVI: {formatPVI(tooltip.pvi)}</span>
              </div>
            )}
          </div>

          {tooltip.shift.shifted && (
            <div className="mt-1">
              <span
                className="text-xs font-medium"
                style={{ color: tooltip.shift.delta > 0 ? "hsl(0, 80%, 45%)" : "hsl(210, 80%, 45%)" }}
              >
                {tooltip.shift.delta > 0 ? "↗" : "↙"} Shifting{" "}
                {tooltip.shift.delta > 0 ? "R" : "D"}+{Math.abs(tooltip.shift.delta)} since 2012
              </span>
            </div>
          )}

          {/* Demographics */}
          {(tooltip.population || tooltip.medianIncome) && (
            <div className="mt-1.5 flex gap-3 text-xs text-muted-foreground">
              {tooltip.population && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {(tooltip.population / 1000).toFixed(0)}K pop.
                </span>
              )}
              {tooltip.medianIncome && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  {formatMoney(tooltip.medianIncome)} income
                </span>
              )}
            </div>
          )}

          {/* Forecasts from multiple sources */}
          {tooltip.forecasts.length > 0 && (
            <div className="mt-1.5 border-t border-border pt-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Forecasts</p>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                {tooltip.forecasts.map((f, i) => (
                  <span key={i} className="text-xs text-foreground">
                    <span className="text-muted-foreground">{f.source.replace("Cook Political Report", "Cook").replace("Inside Elections", "IE").replace("Sabato's Crystal Ball", "Sabato")}:</span>{" "}
                    <span className="font-medium">{f.rating}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Finance */}
          {tooltip.finance.length > 0 && (
            <div className="mt-1.5 border-t border-border pt-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Top Fundraisers</p>
              {tooltip.finance.slice(0, 2).map((f, i) => (
                <div key={i} className="text-xs text-foreground flex justify-between">
                  <span>{f.name} {f.party ? `(${f.party})` : ""}</span>
                  <span className="font-medium">{formatMoney(f.raised)}</span>
                </div>
              ))}
            </div>
          )}

          {tooltip.topIssues.length > 0 && (
            <div className="mt-1.5 border-t border-border pt-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Top Issues</p>
              <p className="text-xs text-foreground">{tooltip.topIssues.slice(0, 3).join(", ")}</p>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 px-1">
        {colorMode === "cook" ? (
          <>
            {COOK_RATING_ORDER.map((rating) => (
              <div key={rating} className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: `hsl(${COOK_RATING_COLORS[rating]})` }} />
                <span className="text-xs text-muted-foreground">{rating}</span>
              </div>
            ))}
          </>
        ) : colorMode === "forecast" ? (
          <>
            {Object.entries(FORECAST_COLORS).filter(([k]) => !["Toss-Up", "Tossup"].includes(k)).map(([label, color]) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: `hsl(${color})` }} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </>
        ) : (
          <>
            {PVI_LEGEND_ENTRIES.map((entry) => (
              <div key={entry.label} className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: `hsl(${entry.color})` }} />
                <span className="text-xs text-muted-foreground">{entry.label}</span>
              </div>
            ))}
          </>
        )}
        <div className="flex items-center gap-1.5 border-l border-border pl-3 ml-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "hsl(220, 15%, 85%)" }} />
          <span className="text-xs text-muted-foreground">No data</span>
        </div>
      </div>
      </div>

      {/* Competitive Races Sidebar */}
      <div className="hidden lg:block w-72 shrink-0">
        <CompetitiveRacesSidebar
          consensusRatings={consensusRatings}
          dbFinance={dbFinance}
          onSelectDistrict={onSelectDistrict}
        />
      </div>
    </div>
  );
};

export const DistrictMap = memo(DistrictMapInner);
