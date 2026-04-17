import { forwardRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar, type FilterCategory, type Section } from "./AppSidebar";
import { useTheme, THEME_LABELS, type WindowsTheme } from "@/contexts/ThemeContext";
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
    const { theme, setTheme, darkMode, setDarkMode } = useTheme();
    const { canManageContent, canAccessApi } = useUserRole();
    const { signOut } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [themeOpen, setThemeOpen] = useState(false);
    const [quickOpen, setQuickOpen] = useState(false);

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
          <button
            onClick={() => { setQuickOpen(v => !v); setThemeOpen(false); }}
            className={`win98-button shrink-0 text-[10px] ${quickOpen ? "font-bold" : ""}`}
            aria-label="Quick links"
            title="Quick links"
          >
            ⚡
          </button>
          <button
            onClick={() => { setThemeOpen(v => !v); setQuickOpen(false); }}
            className={`win98-button shrink-0 text-[10px] ${themeOpen ? "font-bold" : ""}`}
            aria-label="Theme"
            title="Change theme"
          >
            🎨
          </button>
          <div className="flex-1 truncate text-[11px] font-bold pl-1">
            📂 {activeSection}
          </div>
        </div>

        {quickOpen && (
          <div className="win98-raised bg-[hsl(var(--win98-face))] p-2 grid grid-cols-2 gap-1 text-[11px]">
            <button className="win98-button text-left" onClick={() => { navigate("/profile"); setQuickOpen(false); }}>👤 Profile</button>
            {canAccessApi && (
              <button className="win98-button text-left" onClick={() => { navigate("/api"); setQuickOpen(false); }}>🔑 API</button>
            )}
            {canManageContent && (
              <button className="win98-button text-left" onClick={() => { navigate("/admin"); setQuickOpen(false); }}>🛡️ Admin</button>
            )}
            <button className="win98-button text-left" onClick={() => { navigate("/"); setQuickOpen(false); }}>🏠 Home</button>
            <button className="win98-button text-left col-span-2" onClick={() => { signOut(); }}>🔌 Sign Out</button>
          </div>
        )}

        {themeOpen && (
          <div className="win98-raised bg-[hsl(var(--win98-face))] p-2 space-y-2 text-[11px]">
            <div className="font-bold border-b border-[hsl(var(--win98-shadow))] pb-1">Choose Theme</div>
            <div className="space-y-1">
              <div className="text-[10px] opacity-70 font-bold">Windows</div>
              <div className="grid grid-cols-2 gap-1">
                {(["win98","winxp","vista","win7","win8","win10","win11"] as WindowsTheme[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`win98-button text-left text-[10px] ${theme === t ? "font-bold" : ""}`}
                  >
                    {theme === t ? "● " : "○ "}{THEME_LABELS[t]}
                  </button>
                ))}
              </div>
              <div className="text-[10px] opacity-70 font-bold pt-1">Palm Pilot</div>
              <div className="grid grid-cols-2 gap-1">
                {(["palm-classic","palm-v","palm-m505","palm-treo"] as WindowsTheme[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`win98-button text-left text-[10px] ${theme === t ? "font-bold" : ""}`}
                  >
                    {theme === t ? "● " : "○ "}{THEME_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 pt-1 border-t border-[hsl(var(--win98-shadow))]">
              <input type="checkbox" checked={darkMode} onChange={e => setDarkMode(e.target.checked)} />
              <span>Dark mode</span>
            </label>
          </div>
        )}

        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent
            side="left"
            className="p-0 w-[260px] sm:max-w-[260px] bg-[hsl(var(--win98-face))] border-r-2 border-r-[hsl(var(--win98-shadow))]"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <div className="h-full flex">
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
          </SheetContent>
        </Sheet>
      </div>
    );
  }
);

MobileNav.displayName = "MobileNav";
