import { forwardRef } from "react";
import { type FilterCategory, type Section } from "./AppSidebar";

interface MobileNavProps {
  activeFilter: FilterCategory;
  onFilterChange: (filter: FilterCategory) => void;
  counts: Record<FilterCategory, number>;
  activeSection: Section;
  onSectionChange: (section: Section) => void;
}

const sectionItems: Array<{ id: Section; label: string }> = [
  { id: "candidates", label: "Candidates" },
  { id: "maga-files", label: "MAGA Files" },
  { id: "local-impact", label: "Local Impact" },
  { id: "narratives", label: "Narratives" },
  { id: "district-intel", label: "District Intel" },
];

const filters: Array<{ id: FilterCategory; label: string }> = [
  { id: "all", label: "All" },
  { id: "house", label: "House" },
  { id: "senate", label: "Senate" },
  { id: "governor", label: "Gov" },
  { id: "state", label: "State" },
];

export const MobileNav = forwardRef<HTMLDivElement, MobileNavProps>(
  ({ activeFilter, onFilterChange, counts, activeSection, onSectionChange }, ref) => {
    return (
      <div ref={ref} className="lg:hidden space-y-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {sectionItems.map(s => (
            <button
              key={s.id}
              onClick={() => onSectionChange(s.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                activeSection === s.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {activeSection === "candidates" && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {filters.map(f => (
              <button
                key={f.id}
                onClick={() => onFilterChange(f.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  activeFilter === f.id
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {f.label}
                <span className="ml-1 opacity-60">{counts[f.id]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
);

MobileNav.displayName = "MobileNav";
