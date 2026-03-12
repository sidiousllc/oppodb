import { useState } from "react";
import { type DistrictProfile } from "@/data/districtIntel";
import {
  ArrowLeft,
  Users,
  DollarSign,
  GraduationCap,
  Calendar,
  TrendingDown,
  Home,
  Heart,
  ChevronDown,
} from "lucide-react";

interface DistrictCompareProps {
  districts: DistrictProfile[];
  initialA?: string;
  initialB?: string;
  onBack: () => void;
}

function DistrictPicker({
  districts,
  selected,
  onSelect,
  label,
}: {
  districts: DistrictProfile[];
  selected: string;
  onSelect: (id: string) => void;
  label: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">
        {label}
      </label>
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

type RowValue = number | null | undefined;

function CompareRow({
  label,
  a,
  b,
  format = "number",
}: {
  label: string;
  a: RowValue;
  b: RowValue;
  format?: "number" | "percent" | "dollar";
}) {
  const fmt = (v: RowValue) => {
    if (v == null) return "—";
    if (format === "percent") return `${v}%`;
    if (format === "dollar") return `$${v.toLocaleString()}`;
    return v.toLocaleString();
  };

  const diff = a != null && b != null ? a - b : null;
  const highlightA =
    diff != null && diff !== 0
      ? diff > 0
        ? "text-emerald-600 dark:text-emerald-400"
        : ""
      : "";
  const highlightB =
    diff != null && diff !== 0
      ? diff < 0
        ? "text-emerald-600 dark:text-emerald-400"
        : ""
      : "";

  return (
    <div className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2 py-2.5 border-b border-border/50 last:border-0">
      <span className={`text-sm font-semibold tabular-nums text-right ${highlightA}`}>
        {fmt(a)}
      </span>
      <span className="text-xs text-muted-foreground text-center">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${highlightB}`}>
        {fmt(b)}
      </span>
    </div>
  );
}

function SectionDivider({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 pt-4 pb-2">
      {icon}
      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
        {title}
      </span>
    </div>
  );
}

export function DistrictCompare({
  districts,
  initialA,
  initialB,
  onBack,
}: DistrictCompareProps) {
  const [idA, setIdA] = useState(initialA ?? "");
  const [idB, setIdB] = useState(initialB ?? "");

  const a = districts.find((d) => d.district_id === idA);
  const b = districts.find((d) => d.district_id === idB);

  return (
    <div className="animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to District Intel
      </button>

      <h1 className="font-display text-xl font-bold text-foreground mb-5">
        Compare Districts
      </h1>

      {/* Pickers */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <DistrictPicker
          districts={districts}
          selected={idA}
          onSelect={setIdA}
          label="District A"
        />
        <DistrictPicker
          districts={districts}
          selected={idB}
          onSelect={setIdB}
          label="District B"
        />
      </div>

      {a && b ? (
        <div className="bg-card rounded-xl border border-border p-5">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2 pb-3 border-b border-border mb-1">
            <h2 className="font-display text-base font-bold text-foreground text-right">
              {a.district_id}
            </h2>
            <span className="text-xs text-muted-foreground text-center font-medium">
              Metric
            </span>
            <h2 className="font-display text-base font-bold text-foreground">
              {b.district_id}
            </h2>
          </div>

          {/* Key Demographics */}
          <SectionDivider
            icon={<Users className="h-4 w-4 text-primary" />}
            title="Demographics"
          />
          <CompareRow label="Population" a={a.population} b={b.population} />
          <CompareRow label="Median Age" a={a.median_age} b={b.median_age} />
          <CompareRow
            label="Bachelor's Degree+"
            a={a.education_bachelor_pct}
            b={b.education_bachelor_pct}
            format="percent"
          />

          {/* Economic */}
          <SectionDivider
            icon={<DollarSign className="h-4 w-4 text-accent" />}
            title="Economic"
          />
          <CompareRow
            label="Median Income"
            a={a.median_income}
            b={b.median_income}
            format="dollar"
          />
          <CompareRow
            label="Poverty Rate"
            a={a.poverty_rate}
            b={b.poverty_rate}
            format="percent"
          />
          <CompareRow
            label="Unemployment"
            a={a.unemployment_rate}
            b={b.unemployment_rate}
            format="percent"
          />
          <CompareRow
            label="Total Households"
            a={a.total_households}
            b={b.total_households}
          />
          <CompareRow
            label="Avg Household Size"
            a={a.avg_household_size}
            b={b.avg_household_size}
          />

          {/* Racial & Ethnic */}
          <SectionDivider
            icon={<Users className="h-4 w-4 text-primary" />}
            title="Race & Ethnicity"
          />
          <CompareRow label="White" a={a.white_pct} b={b.white_pct} format="percent" />
          <CompareRow
            label="Black"
            a={a.black_pct}
            b={b.black_pct}
            format="percent"
          />
          <CompareRow
            label="Hispanic"
            a={a.hispanic_pct}
            b={b.hispanic_pct}
            format="percent"
          />
          <CompareRow label="Asian" a={a.asian_pct} b={b.asian_pct} format="percent" />
          <CompareRow
            label="Foreign-Born"
            a={a.foreign_born_pct}
            b={b.foreign_born_pct}
            format="percent"
          />

          {/* Housing */}
          <SectionDivider
            icon={<Home className="h-4 w-4 text-[hsl(var(--tag-house))]" />}
            title="Housing"
          />
          <CompareRow
            label="Owner-Occupied"
            a={a.owner_occupied_pct}
            b={b.owner_occupied_pct}
            format="percent"
          />
          <CompareRow
            label="Median Home Value"
            a={a.median_home_value}
            b={b.median_home_value}
            format="dollar"
          />
          <CompareRow
            label="Median Rent"
            a={a.median_rent}
            b={b.median_rent}
            format="dollar"
          />

          {/* Health & Veterans */}
          <SectionDivider
            icon={<Heart className="h-4 w-4 text-destructive" />}
            title="Health & Veterans"
          />
          <CompareRow
            label="Uninsured"
            a={a.uninsured_pct}
            b={b.uninsured_pct}
            format="percent"
          />
          <CompareRow
            label="Veterans"
            a={a.veteran_pct}
            b={b.veteran_pct}
            format="percent"
          />

          {/* Top Issues */}
          <SectionDivider
            icon={<TrendingDown className="h-4 w-4 text-accent" />}
            title="Top Issues"
          />
          <div className="grid grid-cols-[1fr_1fr] gap-4 pt-2">
            <div className="space-y-1.5">
              {a.top_issues.length > 0
                ? a.top_issues.map((issue, i) => (
                    <div
                      key={issue}
                      className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5"
                    >
                      <span className="text-xs font-bold text-accent">
                        {i + 1}.
                      </span>
                      <span className="text-xs text-foreground capitalize">
                        {issue}
                      </span>
                    </div>
                  ))
                : <span className="text-xs text-muted-foreground">No issues listed</span>}
            </div>
            <div className="space-y-1.5">
              {b.top_issues.length > 0
                ? b.top_issues.map((issue, i) => (
                    <div
                      key={issue}
                      className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5"
                    >
                      <span className="text-xs font-bold text-accent">
                        {i + 1}.
                      </span>
                      <span className="text-xs text-foreground capitalize">
                        {issue}
                      </span>
                    </div>
                  ))
                : <span className="text-xs text-muted-foreground">No issues listed</span>}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-card rounded-xl border border-border">
          <p className="text-muted-foreground">
            Select two districts above to compare their demographics side by side.
          </p>
        </div>
      )}
    </div>
  );
}
