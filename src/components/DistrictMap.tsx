import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { Search, X } from "lucide-react";
import { type DistrictProfile } from "@/data/districtIntel";
import { getCurrentPVI, formatPVI, getPVIColor, hasPVIShift } from "@/data/cookPVI";
import {
  getCookRating,
  getCookRatingColor,
  COOK_RATING_ORDER,
  COOK_RATING_COLORS,
  type CookRating,
} from "@/data/cookRatings";

// ─── Data Sources ───────────────────────────────────────────────────────────
const STATE_GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

// Esri Living Atlas — 118th Congressional Districts (reliable, CORS-enabled)
const CD_GEO_URL =
  "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_118th_Congressional_Districts/FeatureServer/0/query?" +
  new URLSearchParams({
    where: "1=1",
    outFields: "STATE_ABBR,CDFIPS,DISTRICTID",
    f: "geojson",
    outSR: "4326",
    returnGeometry: "true",
    resultRecordCount: "500",
  }).toString();

// ─── Types & Exports ────────────────────────────────────────────────────────

export type ColorMode = "cook" | "pvi";
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

/** Build district ID from Esri fields (e.g. "AL-01", "WY-AL") */
function toDistrictId(stateAbbr: string, cdfips: string): string | null {
  if (!stateAbbr) return null;
  if (cdfips === "00" || cdfips === "98") return `${stateAbbr}-AL`;
  return `${stateAbbr}-${cdfips}`;
}

function matchesPVIFilter(districtId: string, filter: PVIFilter): boolean {
  if (filter === "all") return true;
  const pvi = getCurrentPVI(districtId);
  if (pvi === null) return false;
  switch (filter) {
    case "strong-d": return pvi <= -8;
    case "lean-d": return pvi >= -7 && pvi <= -1;
    case "swing": return pvi === 0;
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

// ─── GeoJSON Cache ──────────────────────────────────────────────────────────

interface DistrictGeoJSON {
  type: string;
  features: Array<{
    type: string;
    properties: Record<string, string>;
    geometry: unknown;
  }>;
}

let cachedGeoJSON: DistrictGeoJSON | null = null;
let fetchPromise: Promise<DistrictGeoJSON | null> | null = null;

async function fetchDistrictGeo(): Promise<DistrictGeoJSON | null> {
  if (cachedGeoJSON) return cachedGeoJSON;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch(CD_GEO_URL)
    .then(async (res) => {
      if (!res.ok) return null;
      const data = await res.json();
      if (data.error || !data.features) return null;
      cachedGeoJSON = data as DistrictGeoJSON;
      return cachedGeoJSON;
    })
    .catch(() => null);

  return fetchPromise;
}

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
}

const DistrictMapInner = ({ districts, onSelectDistrict, pviFilter = "all" }: DistrictMapProps) => {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [geoData, setGeoData] = useState<DistrictGeoJSON | null>(cachedGeoJSON);
  const [loading, setLoading] = useState(!cachedGeoJSON);
  const [colorMode, setColorMode] = useState<ColorMode>("cook");
  const [zoomState, setZoomState] = useState<{ center: [number, number]; zoom: number }>({
    center: [-96, 38],
    zoom: 1,
  });
  const [zoomedStateAbbr, setZoomedStateAbbr] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedDistrict, setHighlightedDistrict] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cachedGeoJSON) {
      setGeoData(cachedGeoJSON);
      setLoading(false);
      return;
    }
    fetchDistrictGeo().then((data) => {
      setGeoData(data);
      setLoading(false);
    });
  }, []);

  const districtLookup = useMemo(() => {
    const map = new Map<string, DistrictProfile>();
    districts.forEach((d) => map.set(d.district_id, d));
    return map;
  }, [districts]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  const getDistrictFill = useCallback(
    (districtId: string | null): string => {
      if (!districtId) return "hsl(220, 15%, 90%)";

      // Highlight selected district from search
      if (highlightedDistrict && districtId === highlightedDistrict) {
        return "hsl(45, 100%, 55%)";
      }

      // PVI filter: dim non-matching districts
      if (pviFilter !== "all" && !matchesPVIFilter(districtId, pviFilter)) {
        return "hsl(220, 5%, 92%)";
      }

      if (colorMode === "pvi") {
        const pvi = getCurrentPVI(districtId);
        if (pvi !== null) return `hsl(${getPVIColor(pvi)})`;
        return "hsl(220, 15%, 88%)";
      }

      // Cook rating mode
      const rating = getCookRating(districtId);
      if (rating) return `hsl(${getCookRatingColor(rating)})`;
      return "hsl(220, 15%, 85%)";
    },
    [pviFilter, colorMode, highlightedDistrict]
  );

  const handleDistrictHover = useCallback(
    (stateAbbr: string, cdfips: string) => {
      const districtId = toDistrictId(stateAbbr, cdfips);
      if (!districtId) return;
      const tracked = districtLookup.get(districtId);
      setTooltip({
        districtId,
        rating: getCookRating(districtId),
        pvi: getCurrentPVI(districtId),
        shift: hasPVIShift(districtId),
        topIssues: tracked?.top_issues || [],
      });
    },
    [districtLookup]
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
  }, [zoomState, zoomedStateAbbr]);

  // Districts in the zoomed state for the search overlay
  const stateDistricts = useMemo(() => {
    if (!zoomedStateAbbr || !geoData) return [];
    const ids = new Set<string>();
    geoData.features.forEach((f) => {
      if (f.properties?.STATE_ABBR === zoomedStateAbbr) {
        const did = toDistrictId(f.properties.STATE_ABBR, f.properties.CDFIPS);
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
      const pvi = getCurrentPVI(id);
      const profile = districtLookup.get(id);
      return (
        id.toLowerCase().includes(q) ||
        (rating && rating.toLowerCase().includes(q)) ||
        (pvi !== null && formatPVI(pvi).toLowerCase().includes(q)) ||
        (profile?.top_issues || []).some((i) => i.toLowerCase().includes(q))
      );
    });
  }, [searchQuery, stateDistricts, districtLookup]);

  const handleResetZoom = useCallback(() => {
    setZoomState({ center: [-96, 38], zoom: 1 });
    setZoomedStateAbbr(null);
    setSearchQuery("");
    setHighlightedDistrict(null);
  }, []);

  const isZoomed = zoomState.zoom > 1;

  return (
    <div className="relative" onMouseMove={handleMouseMove}>
      {/* Controls bar */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        {/* Color mode toggle */}
        <div className="inline-flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setColorMode("cook")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              colorMode === "cook"
                ? "bg-foreground text-background"
                : "bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            Cook Ratings
          </button>
          <button
            onClick={() => setColorMode("pvi")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-border ${
              colorMode === "pvi"
                ? "bg-foreground text-background"
                : "bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            PVI Scores
          </button>
        </div>

        {/* Zoom reset */}
        {isZoomed && (
          <button
            onClick={() => setZoomState({ center: [-96, 38], zoom: 1 })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Reset zoom
          </button>
        )}

        <p className="text-[10px] text-muted-foreground">
          Click a state to zoom in
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            <span className="text-sm">Loading district boundaries…</span>
          </div>
        </div>
      )}

      {!loading && geoData && (
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
            {/* Congressional district polygons */}
            <Geographies geography={geoData}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const stateAbbr = geo.properties?.STATE_ABBR;
                  const cdfips = geo.properties?.CDFIPS;
                  const districtId = toDistrictId(stateAbbr, cdfips);

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={getDistrictFill(districtId)}
                      stroke="hsl(0, 0%, 100%)"
                      strokeWidth={0.3}
                      onMouseEnter={() => handleDistrictHover(stateAbbr, cdfips)}
                      onMouseLeave={() => setTooltip(null)}
                      onClick={() => {
                        if (districtId) onSelectDistrict(districtId);
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

            {/* State boundary overlay — clickable for zoom */}
            <Geographies geography={STATE_GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  // Extract state name from topology and find abbreviation
                  const geoName = geo.properties?.name;
                  const stateAbbr = Object.entries(STATE_NAME_TO_ABBR).find(
                    ([name]) => name === geoName
                  )?.[1];

                  return (
                    <Geography
                      key={`state-${geo.rsmKey}`}
                      geography={geo}
                      fill="transparent"
                      stroke="hsl(220, 20%, 60%)"
                      strokeWidth={0.7}
                      onClick={() => {
                        if (stateAbbr) handleStateClick(stateAbbr);
                      }}
                      style={{
                        default: { outline: "none", cursor: "pointer" },
                        hover: {
                          outline: "none",
                          stroke: "hsl(var(--foreground))",
                          strokeWidth: 1.5,
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
      )}

      {!loading && !geoData && (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          Could not load district boundaries. Try refreshing the page.
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none rounded-lg border border-border bg-card px-3 py-2 shadow-lg max-w-[220px]"
          style={{
            left: tooltipPos.x + 14,
            top: tooltipPos.y - 50,
          }}
        >
          <p className="font-display text-sm font-semibold text-foreground">
            {tooltip.districtId}
          </p>
          {tooltip.rating && (
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: `hsl(${getCookRatingColor(tooltip.rating)})` }}
              />
              <span className="text-xs font-medium text-foreground">
                {tooltip.rating}
              </span>
            </div>
          )}
          {tooltip.pvi !== null && (
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: `hsl(${getPVIColor(tooltip.pvi)})` }}
              />
              <span className="text-xs font-medium text-foreground">
                PVI: {formatPVI(tooltip.pvi)}
              </span>
            </div>
          )}
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
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: `hsl(${COOK_RATING_COLORS[rating]})` }}
                />
                <span className="text-xs text-muted-foreground">{rating}</span>
              </div>
            ))}
          </>
        ) : (
          <>
            {PVI_LEGEND_ENTRIES.map((entry) => (
              <div key={entry.label} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: `hsl(${entry.color})` }}
                />
                <span className="text-xs text-muted-foreground">{entry.label}</span>
              </div>
            ))}
          </>
        )}
        <div className="flex items-center gap-1.5 border-l border-border pl-3 ml-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: "hsl(220, 15%, 85%)" }}
          />
          <span className="text-xs text-muted-foreground">No data</span>
        </div>
      </div>
    </div>
  );
};

// State name → abbreviation for zoom targets from us-atlas topology
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

export const DistrictMap = memo(DistrictMapInner);
