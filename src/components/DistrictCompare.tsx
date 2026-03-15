import { useState, useMemo } from "react";
import { type DistrictProfile } from "@/data/districtIntel";
import {
  ArrowLeft,
  Users,
  DollarSign,
  Home,
  Heart,
  TrendingDown,
  ChevronDown,
  Plus,
  X,
  Download,
  FileText,
  Vote,
} from "lucide-react";
import { getCookRating, getCookRatingColor, getCookRatingBg, getCookRatingText, type CookRating, COOK_RATING_ORDER, COOK_RATING_COLORS } from "@/data/cookRatings";
import { getCurrentPVI, getPVIHistory, formatPVI, getPVIColor, PVI_CYCLES } from "@/data/cookPVI";
import { exportCSV, exportPDF } from "@/lib/districtExport";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface DistrictCompareProps {
  districts: DistrictProfile[];
  initialA?: string;
  initialB?: string;
  onBack: () => void;
}

const COLORS = [
  "hsl(215, 80%, 42%)",   // primary
  "hsl(4, 80%, 52%)",     // accent
  "hsl(160, 60%, 40%)",   // green
  "hsl(45, 90%, 50%)",    // amber
  "hsl(280, 60%, 50%)",   // purple
  "hsl(190, 70%, 42%)",   // teal
];

function DistrictPicker({
  districts,
  selected,
  onSelect,
  label,
  onRemove,
  canRemove,
}: {
  districts: DistrictProfile[];
  selected: string;
  onSelect: (id: string) => void;
  label: string;
  onRemove?: () => void;
  canRemove?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        {canRemove && onRemove && (
          <button onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="relative">
        <select
          value={selected}
          onChange={(e) => onSelect(e.target.value)}
          className="w-full appearance-none rounded-lg border border-border bg-card px-3 py-2.5 pr-8 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">Select a district…</option>
          {districts.map((d) => (
            <option key={d.district_id} value={d.district_id}>
              {d.district_id} — {d.state}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
}

type MetricDef = {
  key: keyof DistrictProfile;
  label: string;
  format: "number" | "percent" | "dollar";
};

type SectionDef = {
  title: string;
  icon: React.ReactNode;
  metrics: MetricDef[];
};

const SECTIONS: SectionDef[] = [
  {
    title: "Demographics",
    icon: <Users className="h-4 w-4 text-primary" />,
    metrics: [
      { key: "population", label: "Population", format: "number" },
      { key: "median_age", label: "Median Age", format: "number" },
      { key: "education_bachelor_pct", label: "Bachelor's+", format: "percent" },
    ],
  },
  {
    title: "Economic",
    icon: <DollarSign className="h-4 w-4 text-accent" />,
    metrics: [
      { key: "median_income", label: "Median Income", format: "dollar" },
      { key: "poverty_rate", label: "Poverty Rate", format: "percent" },
      { key: "unemployment_rate", label: "Unemployment", format: "percent" },
    ],
  },
  {
    title: "Race & Ethnicity",
    icon: <Users className="h-4 w-4 text-primary" />,
    metrics: [
      { key: "white_pct", label: "White", format: "percent" },
      { key: "black_pct", label: "Black", format: "percent" },
      { key: "hispanic_pct", label: "Hispanic", format: "percent" },
      { key: "asian_pct", label: "Asian", format: "percent" },
      { key: "foreign_born_pct", label: "Foreign-Born", format: "percent" },
    ],
  },
  {
    title: "Housing",
    icon: <Home className="h-4 w-4 text-muted-foreground" />,
    metrics: [
      { key: "owner_occupied_pct", label: "Owner-Occupied", format: "percent" },
      { key: "median_home_value", label: "Median Home Value", format: "dollar" },
      { key: "median_rent", label: "Median Rent", format: "dollar" },
    ],
  },
  {
    title: "Health & Veterans",
    icon: <Heart className="h-4 w-4 text-destructive" />,
    metrics: [
      { key: "uninsured_pct", label: "Uninsured", format: "percent" },
      { key: "veteran_pct", label: "Veterans", format: "percent" },
    ],
  },
];

function fmt(v: number | null | undefined, format: "number" | "percent" | "dollar") {
  if (v == null) return "—";
  if (format === "percent") return `${v}%`;
  if (format === "dollar") return `$${v.toLocaleString()}`;
  return v.toLocaleString();
}

function CompareBarChart({
  metric,
  selected,
  colorMap,
}: {
  metric: MetricDef;
  selected: DistrictProfile[];
  colorMap: Map<string, string>;
}) {
  const data = selected.map((d) => ({
    name: d.district_id,
    value: (d[metric.key] as number) ?? 0,
  }));

  return (
    <div className="h-28">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 8, top: 4, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={60}
            tick={{ fontSize: 11, fill: "hsl(220, 10%, 45%)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number) => fmt(value, metric.format)}
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={colorMap.get(entry.name) || COLORS[0]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DistrictCompare({
  districts,
  initialA,
  initialB,
  onBack,
}: DistrictCompareProps) {
  const [ids, setIds] = useState<string[]>([
    initialA ?? "",
    initialB ?? "",
  ]);

  const selected = useMemo(
    () => ids.map((id) => districts.find((d) => d.district_id === id)).filter(Boolean) as DistrictProfile[],
    [ids, districts]
  );

  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    selected.forEach((d, i) => {
      const rating = getCookRating(d.district_id);
      const color = rating ? `hsl(${getCookRatingColor(rating)})` : COLORS[i % COLORS.length];
      map.set(d.district_id, color);
    });
    return map;
  }, [selected]);

  const updateId = (index: number, value: string) => {
    setIds((prev) => prev.map((v, i) => (i === index ? value : v)));
  };

  const addSlot = () => {
    if (ids.length < 6) setIds((prev) => [...prev, ""]);
  };

  const removeSlot = (index: number) => {
    if (ids.length > 2) setIds((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to District Intel
      </button>

      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-xl font-bold text-foreground">
          Compare Districts
        </h1>
        {selected.length >= 2 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportCSV(selected)}
              className="win98-button text-[10px] flex items-center gap-1"
            >
              <Download className="h-3 w-3" />
              CSV
            </button>
            <button
              onClick={() => exportPDF(selected)}
              className="win98-button text-[10px] flex items-center gap-1"
            >
              <FileText className="h-3 w-3" />
              PDF
            </button>
          </div>
        )}
      </div>

      {/* Pickers */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        {ids.map((id, i) => (
          <DistrictPicker
            key={i}
            districts={districts}
            selected={id}
            onSelect={(v) => updateId(i, v)}
            label={`District ${String.fromCharCode(65 + i)}`}
            onRemove={() => removeSlot(i)}
            canRemove={ids.length > 2}
          />
        ))}
      </div>
      {ids.length < 6 && (
        <button
          onClick={addSlot}
          className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors mb-6"
        >
          <Plus className="h-3.5 w-3.5" />
          Add District
        </button>
      )}

      {selected.length >= 2 ? (
        <div className="space-y-6">
          {/* Cook Rating Color Legend */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
              Cook Political Report Rating Scale
            </h2>
            <div className="flex flex-wrap gap-2">
              {COOK_RATING_ORDER.map((r) => (
                <span
                  key={r}
                  className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ background: getCookRatingBg(r), color: getCookRatingText(r) }}
                >
                  {r}
                </span>
              ))}
            </div>
          </div>

          {/* Cook Ratings Side-by-Side */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
              Cook Political Report Ratings
            </h2>
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(selected.length, 6)}, 1fr)` }}>
              {selected.map((d) => {
                const rating = getCookRating(d.district_id);
                return (
                  <div key={d.district_id} className="text-center">
                    <p className="text-xs font-bold mb-2" style={{ color: colorMap.get(d.district_id) }}>
                      {d.district_id}
                    </p>
                    {rating ? (
                      <span
                        className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-bold"
                        style={{ background: getCookRatingBg(rating), color: getCookRatingText(rating) }}
                      >
                        {rating}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No rating</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cook PVI Side-by-Side */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <Vote className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Cook Partisan Voting Index (PVI)
              </h2>
            </div>

            {/* Current PVI badges */}
            <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: `repeat(${Math.min(selected.length, 6)}, 1fr)` }}>
              {selected.map((d) => {
                const pvi = getCurrentPVI(d.district_id);
                return (
                  <div key={d.district_id} className="text-center">
                    <p className="text-xs font-bold mb-2" style={{ color: colorMap.get(d.district_id) }}>
                      {d.district_id}
                    </p>
                    {pvi !== null ? (
                      <span
                        className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-bold border"
                        style={{
                          backgroundColor: `hsl(${getPVIColor(pvi)} / 0.12)`,
                          color: `hsl(${getPVIColor(pvi)})`,
                          borderColor: `hsl(${getPVIColor(pvi)} / 0.3)`,
                        }}
                      >
                        {formatPVI(pvi)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No PVI data</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* PVI History Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground py-2 pr-4">Cycle</th>
                    {selected.map((d) => (
                      <th key={d.district_id} className="text-right text-xs font-medium py-2 px-2" style={{ color: colorMap.get(d.district_id) }}>
                        {d.district_id}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PVI_CYCLES.map((cycle) => (
                    <tr key={cycle} className="border-b border-border/50 last:border-0">
                      <td className="text-xs text-muted-foreground py-2 pr-4 font-medium">{cycle}</td>
                      {selected.map((d) => {
                        const history = getPVIHistory(d.district_id);
                        const entry = history?.find((h) => h.cycle === cycle);
                        if (!entry) return <td key={d.district_id} className="text-right text-xs text-muted-foreground py-2 px-2">—</td>;
                        const color = getPVIColor(entry.score);
                        return (
                          <td key={d.district_id} className="text-right py-2 px-2">
                            <span
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                              style={{
                                backgroundColor: `hsl(${color} / 0.1)`,
                                color: `hsl(${color})`,
                              }}
                            >
                              {formatPVI(entry.score)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground mt-3">
              PVI measures how a district votes relative to the national average. Source:{" "}
              <a href="https://www.cookpolitical.com/cook-pvi" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">
                Cook Political Report
              </a>
            </p>
          </div>

          {SECTIONS.map((section) => (
            <div key={section.title} className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                {section.icon}
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {section.title}
                </h2>
              </div>

              {/* Table */}
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-xs font-medium text-muted-foreground py-2 pr-4">Metric</th>
                      {selected.map((d) => (
                        <th key={d.district_id} className="text-right text-xs font-medium py-2 px-2" style={{ color: colorMap.get(d.district_id) }}>
                          {d.district_id}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.metrics.map((m) => {
                      const values = selected.map((d) => (d[m.key] as number) ?? null);
                      const validValues = values.filter((v): v is number => v != null);
                      const maxVal = validValues.length ? Math.max(...validValues) : null;
                      return (
                        <tr key={m.key} className="border-b border-border/50 last:border-0">
                          <td className="text-xs text-muted-foreground py-2 pr-4">{m.label}</td>
                          {selected.map((d, i) => {
                            const val = values[i];
                            const isMax = val != null && maxVal != null && val === maxVal && validValues.length > 1;
                            return (
                              <td
                                key={d.district_id}
                                className={`text-right font-semibold tabular-nums py-2 px-2 ${isMax ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}
                              >
                                {fmt(val, m.format)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bar Charts */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.metrics.map((m) => (
                  <div key={m.key}>
                    <p className="text-xs font-medium text-muted-foreground mb-1">{m.label}</p>
                    <CompareBarChart metric={m} selected={selected} colorMap={colorMap} />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Top Issues */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="h-4 w-4 text-accent" />
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Top Issues</h2>
            </div>
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(selected.length, 3)}, 1fr)` }}>
              {selected.map((d) => (
                <div key={d.district_id}>
                  <p className="text-xs font-bold mb-2" style={{ color: colorMap.get(d.district_id) }}>
                    {d.district_id}
                  </p>
                  <div className="space-y-1.5">
                    {d.top_issues.length > 0
                      ? d.top_issues.map((issue, i) => (
                          <div key={issue} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5">
                            <span className="text-xs font-bold text-accent">{i + 1}.</span>
                            <span className="text-xs text-foreground capitalize">{issue}</span>
                          </div>
                        ))
                      : <span className="text-xs text-muted-foreground">No issues listed</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-card rounded-xl border border-border">
          <p className="text-muted-foreground">
            Select at least two districts above to compare their demographics.
          </p>
        </div>
      )}
    </div>
  );
}
