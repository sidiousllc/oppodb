import { useState, useEffect, useMemo, memo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { Loader2, Map as MapIcon } from "lucide-react";

const STATES_GEO = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

const STATE_FIPS: Record<string, string> = {
  AL:"01",AK:"02",AZ:"04",AR:"05",CA:"06",CO:"08",CT:"09",DE:"10",
  FL:"12",GA:"13",HI:"15",ID:"16",IL:"17",IN:"18",IA:"19",KS:"20",
  KY:"21",LA:"22",ME:"23",MD:"24",MA:"25",MI:"26",MN:"27",MS:"28",
  MO:"29",MT:"30",NE:"31",NV:"32",NH:"33",NJ:"34",NM:"35",NY:"36",
  NC:"37",ND:"38",OH:"39",OK:"40",OR:"41",PA:"42",RI:"44",SC:"45",
  SD:"46",TN:"47",TX:"48",UT:"49",VT:"50",VA:"51",WA:"53",WV:"54",
  WI:"55",WY:"56",DC:"11",
};

const STATE_VIEW: Record<string, { center: [number, number]; zoom: number }> = {
  AL:{center:[-86.8,32.8],zoom:5},AK:{center:[-153,63.5],zoom:2.5},
  AZ:{center:[-111.9,34.2],zoom:5},AR:{center:[-92.4,34.8],zoom:5.5},
  CA:{center:[-119.5,37.5],zoom:4},CO:{center:[-105.5,39],zoom:5},
  CT:{center:[-72.7,41.6],zoom:12},DE:{center:[-75.5,39],zoom:14},
  FL:{center:[-81.7,28.5],zoom:4.5},GA:{center:[-83.5,32.7],zoom:5},
  HI:{center:[-155.5,20],zoom:5},ID:{center:[-114.5,44.5],zoom:4.5},
  IL:{center:[-89.4,40],zoom:4.5},IN:{center:[-86.3,39.8],zoom:5.5},
  IA:{center:[-93.5,42],zoom:5},KS:{center:[-98.5,38.5],zoom:5},
  KY:{center:[-85.3,37.8],zoom:5.5},LA:{center:[-91.9,31],zoom:5.5},
  ME:{center:[-69,45.4],zoom:5},MD:{center:[-76.6,39],zoom:8},
  MA:{center:[-71.8,42.3],zoom:10},MI:{center:[-84.7,44.3],zoom:4.5},
  MN:{center:[-94.3,46.3],zoom:4.5},MS:{center:[-89.7,32.7],zoom:5},
  MO:{center:[-92.5,38.5],zoom:5},MT:{center:[-109.6,46.9],zoom:4.5},
  NE:{center:[-99.8,41.5],zoom:5},NV:{center:[-116.6,39.3],zoom:4.5},
  NH:{center:[-71.6,43.7],zoom:8},NJ:{center:[-74.4,40.1],zoom:9},
  NM:{center:[-106,34.5],zoom:4.5},NY:{center:[-75.5,43],zoom:4.5},
  NC:{center:[-79.4,35.6],zoom:5.5},ND:{center:[-100.5,47.5],zoom:5.5},
  OH:{center:[-82.8,40.4],zoom:5.5},OK:{center:[-97.5,35.5],zoom:5.5},
  OR:{center:[-120.5,44],zoom:5},PA:{center:[-77.6,41],zoom:5.5},
  RI:{center:[-71.5,41.7],zoom:18},SC:{center:[-80.9,34],zoom:6},
  SD:{center:[-100.2,44.4],zoom:5.5},TN:{center:[-86.3,35.8],zoom:5.5},
  TX:{center:[-99.4,31.5],zoom:3.5},UT:{center:[-111.7,39.3],zoom:5},
  VT:{center:[-72.6,44.1],zoom:8},VA:{center:[-79.4,37.5],zoom:5.5},
  WA:{center:[-120.7,47.5],zoom:5},WV:{center:[-80.6,38.6],zoom:6},
  WI:{center:[-89.8,44.6],zoom:5},WY:{center:[-107.6,43],zoom:5},
  DC:{center:[-77,38.9],zoom:50},
};

// Esri Living Atlas feature service URLs for state legislative districts
const ESRI_HOUSE_URL =
  "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_State_House_Districts/FeatureServer/0/query";
const ESRI_SENATE_URL =
  "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_State_Senate_Districts/FeatureServer/0/query";

interface StateLegBoundaryMapProps {
  stateAbbr: string;
  stateName: string;
  chamber: "house" | "senate";
  districtNumber: string;
}

interface DistrictGeoJSON {
  type: string;
  features: Array<{
    type: string;
    geometry: { type: string; coordinates: number[][][] | number[][][][] };
    properties: Record<string, unknown>;
  }>;
}

function StateLegBoundaryMapInner({ stateAbbr, stateName, chamber, districtNumber }: StateLegBoundaryMapProps) {
  const [districtGeo, setDistrictGeo] = useState<DistrictGeoJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fips = STATE_FIPS[stateAbbr];
  const view = STATE_VIEW[stateAbbr];

  useEffect(() => {
    if (!fips) {
      setLoading(false);
      setError(true);
      return;
    }

    const controller = new AbortController();
    const baseUrl = chamber === "house" ? ESRI_HOUSE_URL : ESRI_SENATE_URL;
    const distNum = districtNumber.replace(/^0+/, "") || "0";

    // Try multiple query strategies
    const queries = [
      // Strategy 1: match by STATE_ABBR and district number in NAME/BASENAME
      `STATE_ABBR='${stateAbbr}' AND (BASENAME='${distNum}' OR BASENAME='District ${distNum}' OR BASENAME='${districtNumber}')`,
      // Strategy 2: match by state FIPS and DISTRICTID containing the number
      `STATE_FIPS='${fips}' AND DISTRICTID LIKE '%${distNum.padStart(3, "0")}'`,
      // Strategy 3: broader NAME search
      `STATE_ABBR='${stateAbbr}' AND NAME LIKE '%${distNum}%'`,
    ];

    const tryFetch = async (where: string): Promise<DistrictGeoJSON | null> => {
      try {
        const params = new URLSearchParams({
          where,
          outFields: "STATE_ABBR,BASENAME,NAME,DISTRICTID",
          f: "geojson",
          outSR: "4326",
          returnGeometry: "true",
          maxAllowableOffset: "0.005",
          resultRecordCount: "1",
        });
        const r = await fetch(`${baseUrl}?${params}`, { signal: controller.signal });
        if (!r.ok) return null;
        const data = await r.json();
        if (data.error) return null;
        if (data.features && data.features.length > 0) return data;
        return null;
      } catch (e) {
        if ((e as Error).name === "AbortError") throw e;
        return null;
      }
    };

    (async () => {
      try {
        let result: DistrictGeoJSON | null = null;
        for (const q of queries) {
          result = await tryFetch(q);
          if (result) break;
        }
        if (result) {
          setDistrictGeo(result);
        } else {
          setError(true);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError(true);
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [fips, stateAbbr, chamber, districtNumber]);

  const bounds = useMemo(() => {
    if (!districtGeo?.features?.length) return null;
    let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
    const processCoords = (coords: number[]) => {
      const [lng, lat] = coords;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    };
    districtGeo.features.forEach((f) => {
      const geom = f.geometry;
      if (geom.type === "Polygon") {
        (geom.coordinates as number[][][]).forEach((ring) => ring.forEach(processCoords));
      } else if (geom.type === "MultiPolygon") {
        (geom.coordinates as number[][][][]).forEach((polygon) =>
          polygon.forEach((ring) => ring.forEach(processCoords))
        );
      }
    });
    return { minLng, maxLng, minLat, maxLat };
  }, [districtGeo]);

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading district boundary…</span>
        </div>
      </div>
    );
  }

  if (error || !districtGeo || !view) {
    return null;
  }

  const centerLng = bounds ? (bounds.minLng + bounds.maxLng) / 2 : view.center[0];
  const centerLat = bounds ? (bounds.minLat + bounds.maxLat) / 2 : view.center[1];

  let autoZoom = view.zoom;
  if (bounds) {
    const lngSpan = bounds.maxLng - bounds.minLng;
    const latSpan = bounds.maxLat - bounds.minLat;
    const maxSpan = Math.max(lngSpan, latSpan);
    if (maxSpan > 0) {
      autoZoom = Math.min(25, Math.max(3, 8 / maxSpan));
    }
  }

  const chamberColor = chamber === "house" ? "210 80% 50%" : "280 60% 50%";
  const chamberLabel = chamber === "house" ? "House" : "Senate";

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <MapIcon className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm font-semibold text-foreground">
          District Boundary — {stateAbbr} {chamberLabel} {districtNumber}
        </h3>
      </div>

      <div className="rounded-lg overflow-hidden border border-border/50 bg-muted/20">
        <ComposableMap
          projection="geoAlbersUsa"
          projectionConfig={{ scale: 1000 }}
          width={800}
          height={480}
          className="w-full h-auto"
        >
          <ZoomableGroup center={[centerLng, centerLat]} zoom={autoZoom}>
            <Geographies geography={STATES_GEO}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const isCurrentState = geo.properties.name === stateName;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={isCurrentState ? "hsl(220, 15%, 88%)" : "hsl(220, 10%, 94%)"}
                      stroke="hsl(220, 15%, 75%)"
                      strokeWidth={isCurrentState ? 1 : 0.3}
                      style={{
                        default: { outline: "none" },
                        hover: { outline: "none" },
                        pressed: { outline: "none" },
                      }}
                    />
                  );
                })
              }
            </Geographies>

            <Geographies geography={districtGeo}>
              {({ geographies }) =>
                geographies.map((geo, i) => (
                  <Geography
                    key={`sld-${i}`}
                    geography={geo}
                    fill={`hsl(${chamberColor} / 0.2)`}
                    stroke={`hsl(${chamberColor})`}
                    strokeWidth={2}
                    style={{
                      default: { outline: "none" },
                      hover: { outline: "none", fill: `hsl(${chamberColor} / 0.35)` },
                      pressed: { outline: "none" },
                    }}
                  />
                ))
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        Source:{" "}
        <a
          href="https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary/80"
        >
          U.S. Census Bureau TIGER/Line
        </a>{" "}
        — State Legislative Districts (Esri Living Atlas)
      </p>
    </div>
  );
}

export const StateLegBoundaryMap = memo(StateLegBoundaryMapInner);
