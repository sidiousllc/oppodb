import { useState, useEffect, useMemo, useCallback, memo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { type DistrictProfile } from "@/data/districtIntel";
import { getCurrentPVI, formatPVI, getPVIColor, hasPVIShift } from "@/data/cookPVI";
import {
  getCookRating,
  getCookRatingColor,
  COOK_RATING_ORDER,
  COOK_RATING_COLORS,
  type CookRating,
} from "@/data/cookRatings";

// State boundary base layer
const STATE_GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

// Congressional districts from Census TIGERweb — simplified geometry for performance
const CD_GEO_URL =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/0/query?" +
  new URLSearchParams({
    where: "1=1",
    outFields: "BASENAME,STATEFP,CD118FP",
    f: "geojson",
    outSR: "4326",
    returnGeometry: "true",
    maxAllowableOffset: "0.03",
  }).toString();

// FIPS → state abbreviation
const FIPS_TO_STATE: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA",
  "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL",
  "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN",
  "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME",
  "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
  "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
  "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
  "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
  "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI",
  "56": "WY",
};

/** Convert Census FIPS codes to our district ID format (e.g. "AL-01", "WY-AL") */
function toDistrictId(statefp: string, cd: string): string | null {
  const state = FIPS_TO_STATE[statefp];
  if (!state) return null;
  if (cd === "00" || cd === "98") return `${state}-AL`;
  return `${state}-${cd}`;
}

export type PVIFilter = "all" | "strong-d" | "lean-d" | "swing" | "lean-r" | "strong-r";

export const PVI_FILTER_OPTIONS: { id: PVIFilter; label: string; color: string }[] = [
  { id: "all", label: "All", color: "" },
  { id: "strong-d", label: "Strong D (D+8+)", color: "210 80% 45%" },
  { id: "lean-d", label: "Lean D (D+1–7)", color: "210 50% 65%" },
  { id: "swing", label: "Swing (±0)", color: "45 80% 50%" },
  { id: "lean-r", label: "Lean R (R+1–7)", color: "0 50% 65%" },
  { id: "strong-r", label: "Strong R (R+8+)", color: "0 80% 45%" },
];

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

// Cache the GeoJSON globally so it survives re-renders
let cachedGeoJSON: GeoJSON.FeatureCollection | null = null;
let fetchPromise: Promise<GeoJSON.FeatureCollection | null> | null = null;

async function fetchDistrictGeo(): Promise<GeoJSON.FeatureCollection | null> {
  if (cachedGeoJSON) return cachedGeoJSON;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch(CD_GEO_URL)
    .then(async (res) => {
      if (!res.ok) return null;
      const data = await res.json();
      if (data.error || !data.features) return null;
      cachedGeoJSON = data as GeoJSON.FeatureCollection;
      return cachedGeoJSON;
    })
    .catch(() => null);

  return fetchPromise;
}

const DistrictMapInner = ({ districts, onSelectDistrict, pviFilter = "all" }: DistrictMapProps) => {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(cachedGeoJSON);
  const [loading, setLoading] = useState(!cachedGeoJSON);

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

  // Build a lookup for tracked district data
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

      const rating = getCookRating(districtId);

      // PVI filter: dim districts that don't match
      if (pviFilter !== "all" && !matchesPVIFilter(districtId, pviFilter)) {
        return "hsl(220, 5%, 92%)";
      }

      if (rating) {
        return `hsl(${getCookRatingColor(rating)})`;
      }
      return "hsl(220, 15%, 85%)";
    },
    [pviFilter]
  );

  const handleDistrictHover = useCallback(
    (statefp: string, cd: string) => {
      const districtId = toDistrictId(statefp, cd);
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

  return (
    <div className="relative" onMouseMove={handleMouseMove}>
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            <span className="text-sm">Loading district boundaries…</span>
          </div>
        </div>
      )}

      {!loading && (
        <ComposableMap
          projection="geoAlbersUsa"
          projectionConfig={{ scale: 1000 }}
          width={800}
          height={500}
          className="w-full h-auto"
        >
          <ZoomableGroup>
            {/* Congressional district boundaries */}
            {geoData && (
              <Geographies geography={geoData}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const statefp = geo.properties?.STATEFP;
                    const cd = geo.properties?.CD118FP;
                    const districtId = toDistrictId(statefp, cd);

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={getDistrictFill(districtId)}
                        stroke="hsl(0, 0%, 100%)"
                        strokeWidth={0.3}
                        onMouseEnter={() => handleDistrictHover(statefp, cd)}
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
            )}

            {/* State boundary overlay lines */}
            <Geographies geography={STATE_GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="none"
                    stroke="hsl(220, 20%, 70%)"
                    strokeWidth={0.7}
                    style={{
                      default: { outline: "none", pointerEvents: "none" },
                      hover: { outline: "none", pointerEvents: "none" },
                      pressed: { outline: "none", pointerEvents: "none" },
                    }}
                  />
                ))
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
      )}

      {/* Fallback if GeoJSON failed to load */}
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

      {/* Cook Rating Legend */}
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 px-1">
        {COOK_RATING_ORDER.map((rating) => (
          <div key={rating} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: `hsl(${COOK_RATING_COLORS[rating]})` }}
            />
            <span className="text-xs text-muted-foreground">{rating}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 border-l border-border pl-3 ml-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: "hsl(220, 15%, 85%)" }}
          />
          <span className="text-xs text-muted-foreground">No rating</span>
        </div>
      </div>
    </div>
  );
};

export const DistrictMap = memo(DistrictMapInner);
