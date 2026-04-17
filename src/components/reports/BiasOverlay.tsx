// Compact bias breakdown chip + per-source chip used across hubs.
// Allows OppoHub/LegHub cards (and any list view) to surface
// the partisan lean of source attributions consistently.
import { classifyBias, BIAS_META, type Bias } from "@/lib/newsBias";

const SHORT: Record<Bias, string> = {
  left: "L←", "lean-left": "L", center: "C", "lean-right": "R", right: "R→", unknown: "?",
};

export function BiasChip({ source, className = "" }: { source: string; className?: string }) {
  const bias = classifyBias(source);
  const meta = BIAS_META[bias];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${className}`}
      style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.bg}` }}
      title={`${meta.label} — ${source}`}
    >
      {SHORT[bias]}
    </span>
  );
}

export interface BiasBreakdownProps {
  sources: string[];
  className?: string;
  showCounts?: boolean;
}

/**
 * Inline horizontal bias distribution bar with optional counts.
 * Usable on any card/list that aggregates multiple sources.
 */
export function BiasBreakdown({ sources, className = "", showCounts = true }: BiasBreakdownProps) {
  if (sources.length === 0) return null;
  const buckets: Record<"L" | "C" | "R" | "U", { count: number; bias: Bias[] }> = {
    L: { count: 0, bias: [] },
    C: { count: 0, bias: [] },
    R: { count: 0, bias: [] },
    U: { count: 0, bias: [] },
  };
  sources.forEach((s) => {
    const b = classifyBias(s);
    const bucket = BIAS_META[b].bucket;
    buckets[bucket].count++;
    buckets[bucket].bias.push(b);
  });
  const total = sources.length;
  const seg = (key: "L" | "C" | "R" | "U", color: string, label: string) => {
    const pct = total === 0 ? 0 : (buckets[key].count / total) * 100;
    if (pct === 0) return null;
    return (
      <div
        key={key}
        title={`${label}: ${buckets[key].count}/${total}`}
        style={{ width: `${pct}%`, background: color }}
        className="h-full first:rounded-l last:rounded-r"
      />
    );
  };
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <div className="flex h-1.5 w-full overflow-hidden rounded border border-border bg-muted">
        {seg("L", "#3b82f6", "Left")}
        {seg("C", "#9333ea", "Center")}
        {seg("R", "#dc2626", "Right")}
        {seg("U", "#9ca3af", "Unrated")}
      </div>
      {showCounts && (
        <div className="flex items-center gap-1.5 text-[8px] text-muted-foreground">
          {buckets.L.count > 0 && <span style={{ color: "#3b82f6" }}>L {buckets.L.count}</span>}
          {buckets.C.count > 0 && <span style={{ color: "#9333ea" }}>C {buckets.C.count}</span>}
          {buckets.R.count > 0 && <span style={{ color: "#dc2626" }}>R {buckets.R.count}</span>}
          {buckets.U.count > 0 && <span>? {buckets.U.count}</span>}
          <span className="opacity-60">· {total} src</span>
        </div>
      )}
    </div>
  );
}
