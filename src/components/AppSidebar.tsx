import { BookOpen, Users, Landmark, Building2, MapPin, LayoutGrid } from "lucide-react";

export type FilterCategory = "all" | "house" | "senate" | "governor" | "state";

interface AppSidebarProps {
  activeFilter: FilterCategory;
  onFilterChange: (filter: FilterCategory) => void;
  counts: Record<FilterCategory, number>;
}

const filters: Array<{ id: FilterCategory; label: string; icon: React.ElementType }> = [
  { id: "all", label: "All Profiles", icon: LayoutGrid },
  { id: "house", label: "House Races", icon: Building2 },
  { id: "senate", label: "Senate Races", icon: Landmark },
  { id: "governor", label: "Governor Races", icon: Users },
  { id: "state", label: "State Races", icon: MapPin },
];

export function AppSidebar({ activeFilter, onFilterChange, counts }: AppSidebarProps) {
  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <BookOpen className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-base font-semibold text-sidebar-foreground">
              Opposition Research Database
            </h1>
            <p className="text-xs text-sidebar-foreground/60">Sidio.us Group</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 sidebar-nav">
        <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">
          Categories
        </p>
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => onFilterChange(f.id)}
            className={`sidebar-nav-item ${activeFilter === f.id ? "active" : ""}`}
          >
            <f.icon className="h-4 w-4" />
            <span className="flex-1 text-left">{f.label}</span>
            <span className="text-xs text-sidebar-foreground/40">{counts[f.id]}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <p className="text-xs text-sidebar-foreground/40 leading-relaxed">
          <center>// FOR INTERNAL USE ONLY / FOR CLIENT USE ONLY //</center>
        </p>
      </div>
    </aside>
  );
}
