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
  { id: "oppohub", label: "OppoHub" },
  { id: "leghub", label: "LegHub" },
  { id: "polling", label: "DataHub" },
  { id: "messaging", label: "Messaging" },
  { id: "documentation", label: "Docs" },
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
      <div ref={ref} className="lg:hidden space-y-1">
        <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
          {sectionItems.map(s => (
            <button
              key={s.id}
              onClick={() => onSectionChange(s.id)}
              className={`win98-button shrink-0 text-[10px] ${
                activeSection === s.id ? "font-bold" : ""
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {activeSection === "oppohub" && (
          <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
            {filters.map(f => (
              <button
                key={f.id}
                onClick={() => onFilterChange(f.id)}
                className={`win98-button shrink-0 text-[9px] ${
                  activeFilter === f.id ? "font-bold" : ""
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
