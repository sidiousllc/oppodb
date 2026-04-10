import { useState, useEffect, useMemo, memo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { Loader2, Map as MapIcon, RefreshCw } from "lucide-react";
import { MapSourceSelector } from "@/components/MapSourceSelector";
import { useMapLoader } from "@/hooks/useMapLoader";

const STATES_GEO = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

// Approximate state centers + zoom for the map projection
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

interface DistrictBoundaryMapProps {
  districtId: string;
  stateName: string;
}

function DistrictBoundaryMapInner({ districtId, stateName }: DistrictBoundaryMapProps) {
  const mapLoader = useMapLoader();
  const { geoData: allGeoData, loading: geoLoading } = mapLoader;

  const [districtGeo, setDistrictGeo] = useState<{ type: string; features: Array<{ type: string; geometry: { type: string; coordinates: number[][][] | number[][][][] }; properties: Record<string, unknown> }> } | null>(null);
  const [loading, setLoading] = useState(true);

  const stateAbbr = districtId.split("-")[0];
  const districtNum = districtId.split("-")[1] || "0";
  const view = STATE_VIEW[stateAbbr];

  // Extract district features from loaded data
  useEffect(() => {
    if (geoLoading || !allGeoData) {
      setLoading(geoLoading);
      return;
    }

    const cdNum = districtNum === "AL" ? "01" : districtNum.padStart(2, "0");

    const matching = allGeoData.features.filter(
      (f) =>
        (f.properties.STATE_ABBR === stateAbbr || String(f.properties.STATE_ABBR).toUpperCase() === stateAbbr) &&
        String(f.properties.CDFIPS || f.properties.CD118FP || "").padStart(2, "0") === cdNum
    );

    if (matching.length > 0) {
      setDistrictGeo({ type: "FeatureCollection", features: matching as typeof districtGeo extends null ? never : NonNullable<typeof districtGeo>["features"] });
      setLoading(false);
      return;
    }

    // At-large fallback
    if (cdNum !== "01") {
      const atLarge = allGeoData.features.filter(
        (f) =>
          (f.properties.STATE_ABBR === stateAbbr || String(f.properties.STATE_ABBR).toUpperCase() === stateAbbr) &&
          String(f.properties.CDFIPS || f.properties.CD118FP || "").padStart(2, "0") === "01"
      );
      if (atLarge.length > 0) {
        setDistrictGeo({ type: "FeatureCollection", features: atLarge as typeof districtGeo extends null ? never : NonNullable<typeof districtGeo>["features"] });
        setLoading(false);
        return;
      }
    }

    setDistrictGeo(null);
    setLoading(false);
  }, [allGeoData, geoLoading, stateAbbr, districtNum]);

  // Compute bounding box
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
        (geom.coordinates as number[][][]).forEach((ring) =>
          ring.forEach(processCoords)
        );
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
      <div className="bg-card rounded-xl border border-border p-6 mb-6 flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading district boundary…</span>
        </div>
      </div>
    );
  }

  if (!districtGeo || !view) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <div className="flex items-center justify-center h-32 mb-3">
          <p className="text-sm text-muted-foreground">District boundary unavailable</p>
        </div>
        <MapSourceSelector
          preferredSource={mapLoader.preferredSource}
          onSourceChange={mapLoader.setPreferredSource}
          diagnostics={mapLoader.diagnostics}
          loading={mapLoader.loading}
          loadTimeMs={mapLoader.loadTimeMs}
          error={mapLoader.error}
          featureCount={mapLoader.featureCount}
          onRetry={mapLoader.retry}
          compact
        />
      </div>
    );
  }

  const centerLng = bounds
    ? (bounds.minLng + bounds.maxLng) / 2
    : view.center[0];
  const centerLat = bounds
    ? (bounds.minLat + bounds.maxLat) / 2
    : view.center[1];

  let autoZoom = view.zoom;
  if (bounds) {
    const lngSpan = bounds.maxLng - bounds.minLng;
    const latSpan = bounds.maxLat - bounds.minLat;
    const maxSpan = Math.max(lngSpan, latSpan);
    if (maxSpan > 0) {
      autoZoom = Math.min(20, Math.max(3, 8 / maxSpan));
    }
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <MapIcon className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm font-semibold text-foreground">
          District Boundary — {districtId}
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
          <ZoomableGroup
            center={[centerLng, centerLat]}
            zoom={autoZoom}
          >
            <Geographies geography={STATES_GEO}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const isCurrentState =
                    geo.properties.name === stateName;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={
                        isCurrentState
                          ? "hsl(220, 15%, 88%)"
                          : "hsl(220, 10%, 94%)"
                      }
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
                    key={`district-${i}`}
                    geography={geo}
                    fill="hsl(var(--primary) / 0.2)"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    style={{
                      default: { outline: "none" },
                      hover: {
                        outline: "none",
                        fill: "hsl(var(--primary) / 0.3)",
                      },
                      pressed: { outline: "none" },
                    }}
                  />
                ))
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
      </div>

      {/* Source selector & diagnostics */}
      <div className="mt-3">
        <MapSourceSelector
          preferredSource={mapLoader.preferredSource}
          onSourceChange={mapLoader.setPreferredSource}
          diagnostics={mapLoader.diagnostics}
          loading={mapLoader.loading}
          loadTimeMs={mapLoader.loadTimeMs}
          error={mapLoader.error}
          featureCount={mapLoader.featureCount}
          onRetry={mapLoader.retry}
          compact
        />
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
        — 118th Congressional District
      </p>
    </div>
  );
}

export const DistrictBoundaryMap = memo(DistrictBoundaryMapInner);
