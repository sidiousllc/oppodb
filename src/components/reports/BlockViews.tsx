// Inline renderers for chart/table/map report blocks.
// Used by both the in-app builder preview and the public landing page.
import { useMemo } from "react";
import {
  Bar, BarChart, Line, LineChart, Pie, PieChart, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { ChartBlock, TableBlock, MapBlock } from "@/lib/reports/types";

const CHART_COLORS = [
  "hsl(220 70% 50%)",
  "hsl(0 70% 50%)",
  "hsl(140 60% 40%)",
  "hsl(40 90% 50%)",
  "hsl(280 60% 50%)",
  "hsl(180 60% 40%)",
];

export function ChartBlockView({ block }: { block: ChartBlock }) {
  const series = block.series && block.series.length ? block.series : ["value"];
  const labelKey = useMemo(() => {
    if (block.data.length === 0) return "label";
    const firstStringKey = Object.entries(block.data[0]).find(([, v]) => typeof v === "string")?.[0];
    return firstStringKey ?? "label";
  }, [block.data]);

  if (block.data.length === 0) {
    return (
      <div className="border border-dashed border-border rounded p-6 text-center text-xs text-muted-foreground italic">
        No chart data — edit the block to add rows.
      </div>
    );
  }

  return (
    <figure className="border border-border rounded p-2 bg-card">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {block.chartType === "pie" ? (
            <PieChart>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Pie
                data={block.data}
                dataKey={series[0]}
                nameKey={labelKey}
                outerRadius={80}
                label={(p) => `${p[labelKey]}: ${p[series[0]]}`}
              >
                {block.data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          ) : block.chartType === "line" ? (
            <LineChart data={block.data}>
              <XAxis dataKey={labelKey} fontSize={10} />
              <YAxis fontSize={10} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {series.map((k, i) => (
                <Line key={k} type="monotone" dataKey={k} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot />
              ))}
            </LineChart>
          ) : (
            <BarChart data={block.data}>
              <XAxis dataKey={labelKey} fontSize={10} />
              <YAxis fontSize={10} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {series.map((k, i) => (
                <Bar key={k} dataKey={k} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      {block.caption && <figcaption className="text-[10px] text-muted-foreground italic text-center mt-1">{block.caption}</figcaption>}
    </figure>
  );
}

export function TableBlockView({ block }: { block: TableBlock }) {
  if (block.columns.length === 0) {
    return <div className="text-xs text-muted-foreground italic">No table columns defined.</div>;
  }
  return (
    <figure className="border border-border rounded overflow-x-auto bg-card">
      <table className="w-full text-xs">
        <thead className="bg-muted">
          <tr>{block.columns.map((c) => <th key={c} className="px-2 py-1 text-left border-b border-border font-bold">{c}</th>)}</tr>
        </thead>
        <tbody>
          {block.rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border last:border-b-0 hover:bg-accent/30">
              {block.columns.map((_, ci) => (
                <td key={ci} className="px-2 py-1">{String(row[ci] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {block.caption && <figcaption className="text-[10px] text-muted-foreground italic text-center py-1 border-t border-border">{block.caption}</figcaption>}
    </figure>
  );
}

export function MapBlockView({ block }: { block: MapBlock }) {
  // For points: render a static OpenStreetMap tile via tile concat (using staticmap-style URL).
  if (block.mode === "points" && block.points && block.points.length > 0) {
    const pts = block.points.slice(0, 25);
    const center = {
      lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
      lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length,
    };
    const markers = pts.map((p) => `${p.lat},${p.lng},red`).join("|");
    const src = `https://staticmap.openstreetmap.de/staticmap.php?center=${center.lat},${center.lng}&zoom=4&size=800x400&markers=${markers}`;
    return (
      <figure className="border border-border rounded p-2 bg-card">
        <img src={src} alt={block.caption ?? "Map"} className="w-full rounded" loading="lazy" />
        {block.caption && <figcaption className="text-[10px] text-muted-foreground italic text-center mt-1">{block.caption}</figcaption>}
        <div className="text-[9px] text-muted-foreground mt-1">© OpenStreetMap contributors</div>
      </figure>
    );
  }
  if (block.mode === "districts" && block.districts && block.districts.length > 0) {
    return (
      <figure className="border border-border rounded p-3 bg-card">
        <div className="text-xs font-bold mb-2">Highlighted districts ({block.districts.length})</div>
        <div className="flex flex-wrap gap-1">
          {block.districts.map((d) => (
            <span key={d} className="text-[10px] px-1.5 py-0.5 border border-primary text-primary rounded font-mono">{d}</span>
          ))}
        </div>
        {block.caption && <div className="text-[10px] text-muted-foreground italic mt-2">{block.caption}</div>}
      </figure>
    );
  }
  return <div className="text-xs text-muted-foreground italic">No map data.</div>;
}
