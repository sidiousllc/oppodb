import { useState, useEffect, useMemo, useCallback, memo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { Loader2, Map as MapIcon, Layers } from "lucide-react";

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

const STATE_NAMES: Record<string, string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",
  CO:"Colorado",CT:"Connecticut",DE:"Delaware",DC:"District of Columbia",
  FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",
  IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",
  ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",
  MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",
  NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",
  NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",
  PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",
  TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",
  WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",
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

const TIGERWEB_BASE = "https://tigerweb.geo.census.gov/arcgis/rest/services/Generalized_ACS2024/Legislative/MapServer";

const HOUSE_COLOR = "210 80% 50%";
const SENATE_COLOR = "280 60% 50%";

interface GeoFeature {
  type: string;
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, unknown>;
}

interface GeoJSON {
  type: string;
  features: GeoFeature[];
}

type ChamberView = "both" | "house" | "senate";

interface StateLegOverviewMapProps {
  stateAbbr: string;
  onDistrictClick?: (chamber: "house" | "senate", districtNumber: string) => void;
}

function StateLegOverviewMapInner({ stateAbbr, onDistrictClick }: StateLegOverviewMapProps) {
  const [houseGeo, setHouseGeo] = useState<GeoJSON | null>(null);
  const [senateGeo, setSenateGeo] = useState<GeoJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [chamberView, setChamberView] = useState<ChamberView>("both");
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);

  const fips = STATE_FIPS[stateAbbr];
  const view = STATE_VIEW[stateAbbr];
  const stateName = STATE_NAMES[stateAbbr];

  useEffect(() => {
    if (!fips) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setHouseGeo(null);
    setSenateGeo(null);

    const fetchLayer = async (layerId: number): Promise<GeoJSON | null> => {
      const url = `${TIGERWEB_BASE}/${layerId}/query?` + new URLSearchParams({
        where: `STATE='${fips}'`,
        outFields: "GEOID,BASENAME,NAME",
        f: "geojson",
        outSR: "4326",
        returnGeometry: "true",
        maxAllowableOffset: "0.005",
      }).toString();

      try {
        const r = await fetch(url, { signal: controller.signal });
        if (!r.ok) return null;
        const data = await r.json();
        if (data.features && data.features.length > 0) return data;
        return null;
      } catch (e) {
        if ((e as Error).name !== "AbortError") console.warn(`TIGERweb error for layer ${layerId}:`, e);
        return null;
      }
    };

    Promise.all([
      fetchLayer(3), // House (lower)
      fetchLayer(2), // Senate (upper)
    ]).then(([house, senate]) => {
      setHouseGeo(house);
      setSenateGeo(senate);
    }).finally(() => setLoading(false));

    return () => controller.abort();
  }, [fips, stateAbbr]);

  const stats = useMemo(() => ({
    house: houseGeo?.features?.filter(f => f.geometry)?.length || 0,
    senate: senateGeo?.features?.filter(f => f.geometry)?.length || 0,
  }), [houseGeo, senateGeo]);

  const handleClick = useCallback((chamber: "house" | "senate", geo: GeoFeature) => {
    if (!onDistrictClick) return;
    const geoid = (geo.properties.GEOID as string) || "";
    const districtNum = geoid.length > 2 ? geoid.substring(2).replace(/^0+/, "") || "0" : 
      (geo.properties.BASENAME as string) || "0";
    onDistrictClick(chamber, districtNum);
  }, [onDistrictClick]);

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 flex items-center justify-center h-72">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading {stateName} legislative districts…</span>
        </div>
      </div>
    );
  }

  if (!houseGeo && !senateGeo) return null;
  if (!view) return null;

  const showHouse = chamberView !== "senate" && houseGeo;
  const showSenate = chamberView !== "house" && senateGeo;

  return (
    <div className="bg-card rounded-xl border border-border p-4 mb-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <MapIcon className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-semibold text-foreground">
            {stateName} Legislative Districts
          </h3>
        </div>

        <div className="flex items-center gap-3">
          {/* Legend */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {stats.house > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: `hsl(${HOUSE_COLOR} / 0.5)`, border: `1px solid hsl(${HOUSE_COLOR})` }} />
                House ({stats.house})
              </span>
            )}
            {stats.senate > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: `hsl(${SENATE_COLOR} / 0.5)`, border: `1px solid hsl(${SENATE_COLOR})` }} />
                Senate ({stats.senate})
              </span>
            )}
          </div>

          {/* Chamber toggle */}
          {stats.house > 0 && stats.senate > 0 && (
            <div className="inline-flex rounded-lg border border-border overflow-hidden">
              {(["both", "house", "senate"] as ChamberView[]).map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChamberView(ch)}
                  className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    ch !== "both" ? "border-l border-border" : ""
                  } ${
                    chamberView === ch
                      ? "bg-foreground text-background"
                      : "bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {ch === "both" ? "Both" : ch === "house" ? "House" : "Senate"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg overflow-hidden border border-border/50 bg-muted/20 relative">
        <ComposableMap
          projection="geoAlbersUsa"
          projectionConfig={{ scale: 1000 }}
          width={800}
          height={500}
          className="w-full h-auto"
        >
          <ZoomableGroup center={view.center} zoom={view.zoom}>
            {/* State background */}
            <Geographies geography={STATES_GEO}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const isCurrentState = geo.properties.name === stateName;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={isCurrentState ? "hsl(220 15% 92%)" : "hsl(220 10% 96%)"}
                      stroke="hsl(220 15% 80%)"
                      strokeWidth={isCurrentState ? 0.8 : 0.2}
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

            {/* Senate districts (render first so house overlays on top in "both" mode) */}
            {showSenate && (
              <Geographies geography={senateGeo}>
                {({ geographies }) =>
                  geographies
                    .filter(geo => geo.properties && (geo as unknown as GeoFeature).geometry)
                    .map((geo, i) => {
                      const geoid = (geo.properties.GEOID as string) || `s-${i}`;
                      const isHovered = hoveredDistrict === `senate-${geoid}`;
                      return (
                        <Geography
                          key={`senate-${geoid}`}
                          geography={geo}
                          fill={isHovered ? `hsl(${SENATE_COLOR} / 0.55)` : `hsl(${SENATE_COLOR} / 0.25)`}
                          stroke={`hsl(${SENATE_COLOR})`}
                          strokeWidth={isHovered ? 1.5 : 0.5}
                          onMouseEnter={() => setHoveredDistrict(`senate-${geoid}`)}
                          onMouseLeave={() => setHoveredDistrict(null)}
                          onClick={() => handleClick("senate", geo as unknown as GeoFeature)}
                          style={{
                            default: { outline: "none", cursor: onDistrictClick ? "pointer" : "default" },
                            hover: { outline: "none", cursor: onDistrictClick ? "pointer" : "default" },
                            pressed: { outline: "none" },
                          }}
                        />
                      );
                    })
                }
              </Geographies>
            )}

            {/* House districts */}
            {showHouse && (
              <Geographies geography={houseGeo}>
                {({ geographies }) =>
                  geographies
                    .filter(geo => geo.properties && (geo as unknown as GeoFeature).geometry)
                    .map((geo, i) => {
                      const geoid = (geo.properties.GEOID as string) || `h-${i}`;
                      const isHovered = hoveredDistrict === `house-${geoid}`;
                      return (
                        <Geography
                          key={`house-${geoid}`}
                          geography={geo}
                          fill={isHovered ? `hsl(${HOUSE_COLOR} / 0.55)` : `hsl(${HOUSE_COLOR} / 0.25)`}
                          stroke={`hsl(${HOUSE_COLOR})`}
                          strokeWidth={isHovered ? 1.5 : 0.5}
                          onMouseEnter={() => setHoveredDistrict(`house-${geoid}`)}
                          onMouseLeave={() => setHoveredDistrict(null)}
                          onClick={() => handleClick("house", geo as unknown as GeoFeature)}
                          style={{
                            default: { outline: "none", cursor: onDistrictClick ? "pointer" : "default" },
                            hover: { outline: "none", cursor: onDistrictClick ? "pointer" : "default" },
                            pressed: { outline: "none" },
                          }}
                        />
                      );
                    })
                }
              </Geographies>
            )}
          </ZoomableGroup>
        </ComposableMap>

        {/* Hover tooltip */}
        {hoveredDistrict && (
          <div className="absolute top-3 left-3 bg-background/90 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 text-xs font-medium text-foreground pointer-events-none shadow-sm">
            <Layers className="h-3 w-3 inline mr-1.5" />
            {hoveredDistrict.startsWith("house") ? "House" : "Senate"} District{" "}
            {(() => {
              const geoid = hoveredDistrict.split("-").slice(1).join("-");
              return geoid.length > 2 ? geoid.substring(2).replace(/^0+/, "") || "0" : geoid;
            })()}
          </div>
        )}
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
        — State Legislative Districts (ACS 2024)
      </p>
    </div>
  );
}

export const StateLegOverviewMap = memo(StateLegOverviewMapInner);
