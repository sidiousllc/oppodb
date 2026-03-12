import { useState, useMemo, memo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import { type DistrictProfile } from "@/data/districtIntel";

const GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

// Issue → HSL color mapping using design tokens where possible
const ISSUE_COLORS: Record<string, string> = {
  "Healthcare": "hsl(4, 80%, 52%)",
  "Economy": "hsl(215, 80%, 42%)",
  "Education": "hsl(260, 60%, 50%)",
  "Immigration": "hsl(30, 75%, 50%)",
  "Infrastructure": "hsl(150, 60%, 35%)",
  "Environment": "hsl(160, 55%, 40%)",
  "Housing": "hsl(340, 60%, 50%)",
  "Agriculture": "hsl(85, 50%, 40%)",
  "Military": "hsl(200, 40%, 35%)",
  "Jobs": "hsl(45, 80%, 45%)",
};

const DEFAULT_ISSUE_COLOR = "hsl(220, 15%, 65%)";

function getIssueColor(issue: string): string {
  const key = Object.keys(ISSUE_COLORS).find((k) =>
    issue.toLowerCase().includes(k.toLowerCase())
  );
  return key ? ISSUE_COLORS[key] : DEFAULT_ISSUE_COLOR;
}

// Approximate state centroids for marker placement
const STATE_CENTROIDS: Record<string, [number, number]> = {
  AL: [-86.9, 32.8], AK: [-153.5, 63.6], AZ: [-111.9, 34.2],
  AR: [-92.4, 34.8], CA: [-119.7, 37.3], CO: [-105.5, 39.0],
  CT: [-72.7, 41.6], DE: [-75.5, 39.0], FL: [-81.7, 28.1],
  GA: [-83.5, 32.7], HI: [-155.5, 20.0], ID: [-114.7, 44.2],
  IL: [-89.4, 40.0], IN: [-86.3, 39.8], IA: [-93.5, 42.0],
  KS: [-98.5, 38.5], KY: [-84.8, 37.8], LA: [-91.9, 31.0],
  ME: [-69.4, 45.4], MD: [-76.6, 39.0], MA: [-71.8, 42.3],
  MI: [-84.7, 44.3], MN: [-94.3, 46.3], MS: [-89.7, 32.7],
  MO: [-92.5, 38.5], MT: [-109.6, 46.9], NE: [-99.8, 41.5],
  NV: [-116.6, 39.3], NH: [-71.6, 43.7], NJ: [-74.4, 40.1],
  NM: [-106.0, 34.5], NY: [-75.5, 43.0], NC: [-79.4, 35.6],
  ND: [-100.5, 47.5], OH: [-82.8, 40.4], OK: [-97.5, 35.5],
  OR: [-120.5, 44.0], PA: [-77.6, 41.2], RI: [-71.5, 41.7],
  SC: [-80.9, 34.0], SD: [-100.2, 44.4], TN: [-86.3, 35.8],
  TX: [-99.4, 31.5], UT: [-111.7, 39.3], VT: [-72.6, 44.1],
  VA: [-79.4, 37.5], WA: [-120.7, 47.5], WV: [-80.6, 38.6],
  WI: [-89.8, 44.6], WY: [-107.6, 43.0], DC: [-77.0, 38.9],
};

interface DistrictMapProps {
  districts: DistrictProfile[];
  onSelectDistrict: (districtId: string) => void;
}

interface StateIssueData {
  state: string;
  topIssue: string;
  color: string;
  districtCount: number;
  districts: DistrictProfile[];
}

const DistrictMapInner = ({ districts, onSelectDistrict }: DistrictMapProps) => {
  const [tooltip, setTooltip] = useState<StateIssueData | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Group districts by state and find top issue per state
  const stateData = useMemo(() => {
    const byState: Record<string, DistrictProfile[]> = {};
    districts.forEach((d) => {
      const st = d.district_id.split("-")[0];
      if (!byState[st]) byState[st] = [];
      byState[st].push(d);
    });

    const result: Record<string, StateIssueData> = {};
    Object.entries(byState).forEach(([state, dists]) => {
      const issueCounts: Record<string, number> = {};
      dists.forEach((d) =>
        d.top_issues.forEach((i) => {
          issueCounts[i] = (issueCounts[i] || 0) + 1;
        })
      );
      const topIssue =
        Object.entries(issueCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
        "No data";
      result[state] = {
        state,
        topIssue,
        color: getIssueColor(topIssue),
        districtCount: dists.length,
        districts: dists,
      };
    });
    return result;
  }, [districts]);

  // Unique issues for legend
  const legendIssues = useMemo(() => {
    const seen = new Set<string>();
    Object.values(stateData).forEach((s) => seen.add(s.topIssue));
    return Array.from(seen)
      .filter((i) => i !== "No data")
      .sort();
  }, [stateData]);

  const handleMouseMove = (e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className="relative" onMouseMove={handleMouseMove}>
      <ComposableMap
        projection="geoAlbersUsa"
        projectionConfig={{ scale: 1000 }}
        width={800}
        height={500}
        className="w-full h-auto"
      >
        <ZoomableGroup>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="hsl(220, 15%, 90%)"
                    stroke="hsl(220, 15%, 80%)"
                    strokeWidth={0.5}
                    style={{
                      default: { outline: "none" },
                      hover: { outline: "none", fill: "hsl(220, 15%, 85%)" },
                      pressed: { outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>

          {/* District markers */}
          {Object.entries(stateData).map(([stateAbbr, data]) => {
            const coords = STATE_CENTROIDS[stateAbbr];
            if (!coords) return null;
            return (
              <Marker
                key={stateAbbr}
                coordinates={coords}
                onMouseEnter={() => setTooltip(data)}
                onMouseLeave={() => setTooltip(null)}
                onClick={() => {
                  if (data.districts.length === 1) {
                    onSelectDistrict(data.districts[0].district_id);
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                <circle
                  r={Math.max(4, Math.min(12, data.districtCount * 2))}
                  fill={data.color}
                  fillOpacity={0.85}
                  stroke="hsl(0, 0%, 100%)"
                  strokeWidth={1.5}
                />
                {data.districtCount > 1 && (
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="white"
                    fontSize={7}
                    fontWeight={700}
                    style={{ pointerEvents: "none" }}
                  >
                    {data.districtCount}
                  </text>
                )}
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none rounded-lg border border-border bg-card px-3 py-2 shadow-lg"
          style={{
            left: tooltipPos.x + 12,
            top: tooltipPos.y - 40,
          }}
        >
          <p className="font-display text-sm font-semibold text-foreground">
            {tooltip.state}
          </p>
          <p className="text-xs text-muted-foreground">
            {tooltip.districtCount} district{tooltip.districtCount !== 1 ? "s" : ""} tracked
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: tooltip.color }}
            />
            <span className="text-xs font-medium text-foreground">
              {tooltip.topIssue}
            </span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 px-1">
        {legendIssues.map((issue) => (
          <div key={issue} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: getIssueColor(issue) }}
            />
            <span className="text-xs text-muted-foreground">{issue}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const DistrictMap = memo(DistrictMapInner);
