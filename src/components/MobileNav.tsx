import { forwardRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type FilterCategory, type Section } from "./AppSidebar";
import { useTheme, THEME_LABELS, type WindowsTheme } from "@/contexts/ThemeContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";

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
    const navigate = useNavigate();
    const { theme, setTheme, darkMode, setDarkMode } = useTheme();
    const { canManageContent, canAccessApi } = useUserRole();
    const { signOut } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);
    const [themeOpen, setThemeOpen] = useState(false);

    return (
      <div ref={ref} className="lg:hidden space-y-1">
        {/* Top row: hamburger + section tabs */}
        <div className="flex gap-1 items-center">
          <button
            onClick={() => { setMenuOpen(v => !v); setThemeOpen(false); }}
            className={`win98-button shrink-0 text-[10px] ${menuOpen ? "font-bold" : ""}`}
            aria-label="Menu"
          >
            ☰
          </button>
          <button
            onClick={() => { setThemeOpen(v => !v); setMenuOpen(false); }}
            className={`win98-button shrink-0 text-[10px] ${themeOpen ? "font-bold" : ""}`}
            aria-label="Theme"
            title="Change theme"
          >
            🎨
          </button>
          <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 flex-1">
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
        </div>

        {/* Quick links menu */}
        {menuOpen && (
          <div className="win98-raised bg-[hsl(var(--win98-face))] p-2 grid grid-cols-2 gap-1 text-[11px]">
            <button className="win98-button text-left" onClick={() => { navigate("/profile"); setMenuOpen(false); }}>👤 Profile</button>
            {canAccessApi && (
              <button className="win98-button text-left" onClick={() => { navigate("/api"); setMenuOpen(false); }}>🔑 API</button>
            )}
            {canManageContent && (
              <button className="win98-button text-left" onClick={() => { navigate("/admin"); setMenuOpen(false); }}>🛡️ Admin</button>
            )}
            <button className="win98-button text-left" onClick={() => { navigate("/"); setMenuOpen(false); }}>🏠 Home</button>
            <button className="win98-button text-left col-span-2" onClick={() => { signOut(); }}>🔌 Sign Out</button>
          </div>
        )}

        {/* Theme picker */}
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
