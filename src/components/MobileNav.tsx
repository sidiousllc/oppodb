import { forwardRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar, type FilterCategory, type Section } from "./AppSidebar";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface MobileNavProps {
  activeFilter: FilterCategory;
  onFilterChange: (filter: FilterCategory) => void;
  counts: Record<FilterCategory, number>;
  activeSection: Section;
  onSectionChange: (section: Section) => void;
  sectionCounts: Record<Section, number>;
  onSyncComplete?: () => void;
}

export const MobileNav = forwardRef<HTMLDivElement, MobileNavProps>(
  ({ activeFilter, onFilterChange, counts, activeSection, onSectionChange, sectionCounts, onSyncComplete }, ref) => {
    const navigate = useNavigate();
    const { canManageContent, canAccessApi } = useUserRole();
    const { signOut } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [accountOpen, setAccountOpen] = useState(false);

    const go = (path: string) => { navigate(path); setSidebarOpen(false); setAccountOpen(false); };

    return (
      <div ref={ref} className="lg:hidden space-y-1">
        <div className="flex gap-1 items-center">
          <button
            onClick={() => setSidebarOpen(true)}
            className="win98-button shrink-0 text-[14px] leading-none px-2 py-1"
            aria-label="Open navigation menu"
            title="Menu"
          >
            ☰
          </button>
          <div className="flex-1 truncate text-[11px] font-bold pl-1">
            📂 {activeSection}
          </div>
        </div>

        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent
            side="left"
            className="p-0 w-[260px] sm:max-w-[260px] bg-[hsl(var(--win98-face))] border-r-2 border-r-[hsl(var(--win98-shadow))]"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <div className="h-full flex flex-col">
              <div className="flex-1 min-h-0 flex">
                <AppSidebar
                  activeFilter={activeFilter}
                  onFilterChange={(f) => { onFilterChange(f); }}
                  counts={counts}
                  activeSection={activeSection}
                  onSectionChange={(s) => { onSectionChange(s); setSidebarOpen(false); }}
                  sectionCounts={sectionCounts}
                  onSyncComplete={onSyncComplete}
                />
              </div>
              <div className="border-t-2 border-t-[hsl(var(--win98-shadow))] bg-[hsl(var(--win98-face))] p-2 space-y-1">
                <div className="text-[10px] font-bold opacity-70 px-1">Account</div>
                <button className="win98-button w-full text-left text-[11px]" onClick={() => go("/profile")}>
                  👤 Profile & Theme
                </button>
                {canAccessApi && (
                  <button className="win98-button w-full text-left text-[11px]" onClick={() => go("/api")}>
                    🔑 API Access
                  </button>
                )}
                {canManageContent && (
                  <button className="win98-button w-full text-left text-[11px]" onClick={() => go("/admin")}>
                    🛡️ Admin Panel
                  </button>
                )}
                <button className="win98-button w-full text-left text-[11px]" onClick={() => { signOut(); setSidebarOpen(false); }}>
                  🔌 Sign Out
                </button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }
);

MobileNav.displayName = "MobileNav";
