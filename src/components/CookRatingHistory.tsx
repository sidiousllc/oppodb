import { memo, useMemo } from "react";
import {
  getCookHistory,
  hasRatingShift,
  ratingToScore,
  type CookHistoryEntry,
  COOK_CYCLES,
} from "@/data/cookHistory";
import {
  type CookRating,
  COOK_RATING_COLORS,
  getCookRatingColor,
} from "@/data/cookRatings";
import { TrendingUp, TrendingDown, Minus, History } from "lucide-react";

interface CookRatingHistoryProps {
  districtId: string;
  currentRating: CookRating;
}

const RATING_LABELS: CookRating[] = [
  "Solid D",
  "Likely D",
  "Lean D",
  "Toss Up",
  "Lean R",
  "Likely R",
  "Solid R",
];

function CookRatingHistoryInner({ districtId, currentRating }: CookRatingHistoryProps) {
  const history = useMemo(
    () => getCookHistory(districtId, currentRating),
    [districtId, currentRating]
  );
  const shifted = hasRatingShift(districtId);

  if (history.length === 0) return null;

  // Determine trend
  const firstScore = ratingToScore(history[0].rating);
  const lastScore = ratingToScore(history[history.length - 1].rating);
  const trend = lastScore - firstScore;

  // Chart dimensions
  const chartW = 100; // percentage-based internally
  const chartH = 160;
  const padTop = 20;
  const padBot = 30;
  const padLeft = 70;
  const padRight = 16;
  const plotW = chartW; // will use SVG viewBox
  const svgW = 600;
  const svgH = 220;
  const plotLeft = 80;
  const plotRight = svgW - 20;
  const plotTop = 25;
  const plotBot = svgH - 35;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBot - plotTop;

  // Map rating score (-3 to +3) to Y position
  const scoreToY = (score: number) => {
    return plotTop + ((score + 3) / 6) * plotHeight; // -3=top, +3=bottom ... wait, we want Solid D at top
    // Actually let's invert: -3 (Solid D) at bottom, +3 (Solid R) at top? No...
    // Convention: D at top (blue), R at bottom (red)? Or D left, R right?
    // Let's do: Solid D at top, Solid R at bottom for visual clarity
  };

  // Re-map: -3 (Solid D) → plotTop, +3 (Solid R) → plotBot
  const yForScore = (score: number) => {
    // -3 → top, +3 → bottom
    return plotTop + ((score + 3) / 6) * plotHeight;
  };

  // X for cycle index
  const xForIndex = (i: number) => {
    return plotLeft + (i / (COOK_CYCLES.length - 1)) * plotWidth;
  };

  // Build polyline points
  const points = history.map((h, i) => {
    const x = xForIndex(i);
    const y = yForScore(ratingToScore(h.rating));
    return { x, y, ...h };
  });

  const polylineStr = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Grid lines for each rating level
  const gridLines = RATING_LABELS.map((label, i) => {
    const score = ratingToScore(label);
    const y = yForScore(score);
    return { label, y, color: getCookRatingColor(label) };
  });

  return (
    <div className="bg-card rounded-xl border border-border p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold text-foreground">
            Rating History
          </h2>
        </div>
        {shifted && (
          <div className="flex items-center gap-1.5 text-xs">
            {trend < 0 ? (
              <span className="flex items-center gap-1 text-[hsl(210,80%,50%)]">
                <TrendingUp className="h-3.5 w-3.5" />
                Shifted toward D
              </span>
            ) : trend > 0 ? (
              <span className="flex items-center gap-1 text-[hsl(0,75%,50%)]">
                <TrendingDown className="h-3.5 w-3.5" />
                Shifted toward R
              </span>
            ) : (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Minus className="h-3.5 w-3.5" />
                Stable
              </span>
            )}
          </div>
        )}
      </div>

      {/* SVG Chart */}
      <div className="rounded-lg overflow-hidden bg-muted/20 border border-border/50">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full h-auto"
          role="img"
          aria-label={`Cook Political Report rating history for ${districtId}`}
        >
          {/* Background gradient zones */}
          <defs>
            <linearGradient id="bg-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(210, 80%, 50%)" stopOpacity="0.06" />
              <stop offset="50%" stopColor="hsl(45, 90%, 50%)" stopOpacity="0.04" />
              <stop offset="100%" stopColor="hsl(0, 75%, 50%)" stopOpacity="0.06" />
            </linearGradient>
          </defs>
          <rect
            x={plotLeft}
            y={plotTop}
            width={plotWidth}
            height={plotHeight}
            fill="url(#bg-gradient)"
            rx={4}
          />

          {/* Grid lines and labels */}
          {gridLines.map((g, i) => (
            <g key={g.label}>
              <line
                x1={plotLeft}
                y1={g.y}
                x2={plotRight}
                y2={g.y}
                stroke="hsl(220, 10%, 85%)"
                strokeWidth={0.5}
                strokeDasharray={g.label === "Toss Up" ? "none" : "3,3"}
              />
              <text
                x={plotLeft - 8}
                y={g.y + 3.5}
                textAnchor="end"
                fontSize={9}
                fill={`hsl(${g.color})`}
                fontWeight={500}
              >
                {g.label}
              </text>
            </g>
          ))}

          {/* Toss Up center line emphasized */}
          <line
            x1={plotLeft}
            y1={yForScore(0)}
            x2={plotRight}
            y2={yForScore(0)}
            stroke="hsl(45, 90%, 50%)"
            strokeWidth={1}
            strokeOpacity={0.4}
          />

          {/* Line connecting dots */}
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
            const color = getCookRatingColor(p.rating);
            return (
              <g key={i}>
                {/* Outer glow */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={8}
                  fill={`hsl(${color} / 0.15)`}
                />
                {/* Inner dot */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={5}
                  fill={`hsl(${color})`}
                  stroke="white"
                  strokeWidth={2}
                />
                {/* Rating label above/below dot */}
                <text
                  x={p.x}
                  y={p.y + (ratingToScore(p.rating) <= 0 ? -14 : 18)}
                  textAnchor="middle"
                  fontSize={8}
                  fill={`hsl(${color})`}
                  fontWeight={600}
                >
                  {p.rating}
                </text>
              </g>
            );
          })}

          {/* Cycle labels on X axis */}
          {COOK_CYCLES.map((cycle, i) => (
            <text
              key={cycle}
              x={xForIndex(i)}
              y={plotBot + 18}
              textAnchor="middle"
              fontSize={11}
              fontWeight={i === COOK_CYCLES.length - 1 ? 700 : 400}
              fill={
                i === COOK_CYCLES.length - 1
                  ? "hsl(var(--foreground))"
                  : "hsl(var(--muted-foreground))"
              }
            >
              {cycle}
            </text>
          ))}
        </svg>
      </div>

      {/* Shift summary for competitive districts */}
      {shifted && (
        <div className="mt-3 flex flex-wrap gap-2">
          {history.map((h, i) => {
            const color = getCookRatingColor(h.rating);
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
                {h.rating}
              </div>
            );
          })}
        </div>
      )}

      {!shifted && (
        <p className="mt-3 text-xs text-muted-foreground">
          This district has been rated <strong>{currentRating}</strong> consistently across all recent election cycles.
        </p>
      )}

      <p className="text-xs text-muted-foreground mt-2">
        Source:{" "}
        <a
          href="https://www.cookpolitical.com/ratings/house-race-ratings"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary/80"
        >
          Cook Political Report
        </a>{" "}
        — Historical House Race Ratings (2018–2026)
      </p>
    </div>
  );
}

export const CookRatingHistory = memo(CookRatingHistoryInner);
