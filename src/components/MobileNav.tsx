import { type FilterCategory } from "./AppSidebar";

interface MobileNavProps {
  activeFilter: FilterCategory;
  onFilterChange: (filter: FilterCategory) => void;
  counts: Record<FilterCategory, number>;
}

const filters: Array<{ id: FilterCategory; label: string }> = [
  { id: "all", label: "All" },
  { id: "house", label: "House" },
  { id: "senate", label: "Senate" },
  { id: "governor", label: "Gov" },
  { id: "state", label: "State" },
];

export function MobileNav({ activeFilter, onFilterChange, counts }: MobileNavProps) {
  return (
    <div className="lg:hidden flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
      {filters.map(f => (
        <button
          key={f.id}
          onClick={() => onFilterChange(f.id)}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
            activeFilter === f.id
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          {f.label}
          <span className="ml-1 text-xs opacity-60">{counts[f.id]}</span>
        </button>
      ))}
    </div>
  );
}
