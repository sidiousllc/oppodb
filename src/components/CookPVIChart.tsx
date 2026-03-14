import { memo, useMemo } from "react";
import {
  getPVIHistory,
  getCurrentPVI,
  hasPVIShift,
  formatPVI,
  getPVIColor,
  PVI_CYCLES,
  type PVIEntry,
} from "@/data/cookPVI";
import { TrendingUp, TrendingDown, Minus, Vote } from "lucide-react";

interface CookPVIChartProps {
  districtId: string;
}

function CookPVIChartInner({ districtId }: CookPVIChartProps) {
  const history = useMemo(() => getPVIHistory(districtId), [districtId]);
  const currentPVI = useMemo(() => getCurrentPVI(districtId), [districtId]);
  const { shifted, delta } = useMemo(() => hasPVIShift(districtId), [districtId]);

  if (!history || history.length === 0 || currentPVI === null) return null;

  // Chart dimensions
  const svgW = 600;
  const svgH = 220;
  const plotLeft = 65;
  const plotRight = svgW - 20;
  const plotTop = 25;
  const plotBot = svgH - 35;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBot - plotTop;

  // Determine Y range — find the max magnitude and add padding
  const allScores = history.map((h) => h.score);
  const maxMag = Math.max(Math.abs(Math.min(...allScores)), Math.abs(Math.max(...allScores)), 10);
  const yRange = Math.ceil(maxMag / 5) * 5; // round up to nearest 5

  const yForScore = (score: number) => {
    // Negative (D) at top, positive (R) at bottom — so -yRange → plotTop, +yRange → plotBot
    return plotTop + ((score + yRange) / (2 * yRange)) * plotHeight;
  };

  const xForIndex = (i: number) => {
    return plotLeft + (i / (history.length - 1)) * plotWidth;
  };

  // Build data points
  const points = history.map((h, i) => ({
    x: xForIndex(i),
    y: yForScore(h.score),
    ...h,
  }));

  const polylineStr = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Grid lines at intervals of 5
  const gridValues: number[] = [];
  for (let v = -yRange; v <= yRange; v += 5) {
    gridValues.push(v);
  }

  return (
    <div className="bg-card rounded-xl border border-border p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Vote className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">
              Cook Partisan Voting Index (PVI)
            </h2>
            <p className="text-xs text-muted-foreground">
              How the district votes relative to the nation
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Current PVI badge */}
          <span
            className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-bold border"
            style={{
              backgroundColor: `hsl(${getPVIColor(currentPVI)} / 0.12)`,
              color: `hsl(${getPVIColor(currentPVI)})`,
              borderColor: `hsl(${getPVIColor(currentPVI)} / 0.3)`,
            }}
          >
            {formatPVI(currentPVI)}
          </span>
          {shifted && (
            <div className="flex items-center gap-1 text-xs">
              {delta > 0 ? (
                <span className="flex items-center gap-0.5 text-[hsl(0,75%,50%)]">
                  <TrendingDown className="h-3.5 w-3.5" />
                  +{delta}R shift
                </span>
              ) : (
                <span className="flex items-center gap-0.5 text-[hsl(210,80%,50%)]">
                  <TrendingUp className="h-3.5 w-3.5" />
                  +{Math.abs(delta)}D shift
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SVG Chart */}
      <div className="rounded-lg overflow-hidden bg-muted/20 border border-border/50">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full h-auto"
          role="img"
          aria-label={`Cook PVI history for ${districtId}`}
        >
          {/* Background gradient: blue top, red bottom */}
          <defs>
            <linearGradient id="pvi-bg-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(210, 80%, 50%)" stopOpacity="0.06" />
              <stop offset="50%" stopColor="hsl(0, 0%, 50%)" stopOpacity="0.02" />
              <stop offset="100%" stopColor="hsl(0, 75%, 50%)" stopOpacity="0.06" />
            </linearGradient>
          </defs>
          <rect
            x={plotLeft}
            y={plotTop}
            width={plotWidth}
            height={plotHeight}
            fill="url(#pvi-bg-gradient)"
            rx={4}
          />

          {/* Grid lines */}
          {gridValues.map((v) => {
            const y = yForScore(v);
            const isCenter = v === 0;
            return (
              <g key={v}>
                <line
                  x1={plotLeft}
                  y1={y}
                  x2={plotRight}
                  y2={y}
                  stroke={isCenter ? "hsl(45, 80%, 50%)" : "hsl(220, 10%, 85%)"}
                  strokeWidth={isCenter ? 1 : 0.5}
                  strokeDasharray={isCenter ? "none" : "3,3"}
                  strokeOpacity={isCenter ? 0.5 : 1}
                />
                <text
                  x={plotLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize={9}
                  fill={`hsl(${getPVIColor(v)})`}
                  fontWeight={isCenter ? 600 : 400}
                >
                  {formatPVI(v)}
                </text>
              </g>
            );
          })}

          {/* Trend line */}
          <polyline
            points={polylineStr}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Data points */}
          {points.map((p, i) => {
            const color = getPVIColor(p.score);
            return (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={8} fill={`hsl(${color} / 0.15)`} />
                <circle cx={p.x} cy={p.y} r={5} fill={`hsl(${color})`} stroke="white" strokeWidth={2} />
                <text
                  x={p.x}
                  y={p.y + (p.score <= 0 ? -14 : 18)}
                  textAnchor="middle"
                  fontSize={9}
                  fill={`hsl(${color})`}
                  fontWeight={600}
                >
                  {formatPVI(p.score)}
                </text>
              </g>
            );
          })}

          {/* Cycle labels */}
          {history.map((h, i) => (
            <text
              key={h.cycle}
              x={xForIndex(i)}
              y={plotBot + 18}
              textAnchor="middle"
              fontSize={11}
              fontWeight={i === history.length - 1 ? 700 : 400}
              fill={
                i === history.length - 1
                  ? "hsl(var(--foreground))"
                  : "hsl(var(--muted-foreground))"
              }
            >
              {h.cycle}
            </text>
          ))}
        </svg>
      </div>

      {/* PVI cycle badges */}
      <div className="mt-3 flex flex-wrap gap-2">
        {history.map((h, i) => {
          const color = getPVIColor(h.score);
          const isLast = i === history.length - 1;
          return (
            <div
              key={h.cycle}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${
                isLast ? "ring-1 ring-primary/30" : ""
              }`}
              style={{
                backgroundColor: `hsl(${color} / 0.1)`,
                borderColor: `hsl(${color} / 0.25)`,
                color: `hsl(${color})`,
              }}
            >
              <span className="opacity-60">{h.cycle}:</span>
              {formatPVI(h.score)}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        The PVI measures how strongly a district leans compared to the national average, based on the
        two most recent presidential elections.{" "}
        <a
          href="https://www.cookpolitical.com/cook-pvi"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary/80"
        >
          Cook Political Report — PVI
        </a>
      </p>
    </div>
  );
}

export const CookPVIChart = memo(CookPVIChartInner);
