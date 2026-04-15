import { useState, useCallback, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { type FilterCategory, type Section } from "./AppSidebar";
import { useSectionAccess } from "@/hooks/useSectionAccess";
import { getLastSyncTime } from "@/data/githubSync";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

const sections: Array<{ id: Section; label: string; emoji: string }> = [
  { id: "dashboard", label: "Dashboard", emoji: "🏠" },
  { id: "oppohub", label: "OppoHub", emoji: "🎯" },
  { id: "leghub", label: "LegHub", emoji: "⚖️" },
  { id: "polling", label: "DataHub", emoji: "📊" },
  { id: "intelhub", label: "IntelHub", emoji: "🕵️" },
  { id: "messaging", label: "MessagingHub", emoji: "📢" },
  { id: "research-tools", label: "Research Tools", emoji: "🔬" },
  { id: "internationalhub", label: "InternationalHub", emoji: "🌐" },
  { id: "live-elections", label: "Live Elections", emoji: "🏛️" },
  { id: "documentation", label: "Documentation", emoji: "📖" },
];

const filters: Array<{ id: FilterCategory; label: string; emoji: string }> = [
  { id: "all", label: "All Profiles", emoji: "📋" },
  { id: "house", label: "House Races", emoji: "🏛️" },
  { id: "senate", label: "Senate Races", emoji: "🏛️" },
  { id: "governor", label: "Governor Races", emoji: "👔" },
  { id: "state", label: "State Races", emoji: "📍" },
];

interface MobileSidebarDrawerProps {
  activeFilter: FilterCategory;
  onFilterChange: (filter: FilterCategory) => void;
  counts: Record<FilterCategory, number>;
  activeSection: Section;
  onSectionChange: (section: Section) => void;
  sectionCounts: Record<Section, number>;
  onSyncComplete?: () => void;
}

export function MobileSidebarDrawer({
  activeFilter,
  onFilterChange,
  counts,
  activeSection,
  onSectionChange,
  sectionCounts,
  onSyncComplete,
}: MobileSidebarDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { canAccess } = useSectionAccess();
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    getLastSyncTime().then(setLastSync);
  }, []);

  const handleSectionChange = useCallback((s: Section) => {
    onSectionChange(s);
    setIsOpen(false);
  }, [onSectionChange]);

  const handleFilterChange = useCallback((f: FilterCategory) => {
    onFilterChange(f);
  }, [onFilterChange]);

  function formatSyncTime(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString();
  }

  async function handleManualSync() {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-github");
      if (error) {
        toast.error("Sync failed", { description: error.message });
        return;
      }
      const t = await getLastSyncTime();
      setLastSync(t);
      onSyncComplete?.();
      const count = data?.upserted ?? data?.count;
      toast.success("Sync complete", {
        description: count != null ? `${count} profiles updated` : "Up to date",
      });
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  return (
    <>
      {/* Hamburger button - positioned in toolbar area */}
      <button
        onClick={() => setIsOpen(true)}
        className="win98-button flex items-center justify-center p-1.5"
        title="Open menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[200] transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 bottom-0 w-[260px] z-[201] bg-[hsl(var(--win98-face))] win98-raised flex flex-col transition-transform duration-200 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Drawer title bar */}
        <div className="win98-titlebar flex items-center justify-between">
          <span className="flex items-center gap-1 text-[11px]">
            <span>📂</span> Databases
          </span>
          <button
            className="win98-titlebar-btn"
            onClick={() => setIsOpen(false)}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Tree view */}
        <nav className="flex-1 overflow-y-auto p-1">
          <div className="text-[11px]">
            <div className="flex items-center gap-1 px-1 py-[2px] font-bold">
              <span>📁</span> Research Database
            </div>

            <div className="ml-3 border-l border-l-[hsl(var(--win98-shadow))]">
              {sections.filter(s => canAccess(s.id)).map((s) => (
                <div key={s.id}>
                  <button
                    onClick={() => handleSectionChange(s.id)}
                    className={`flex w-full items-center gap-1 px-2 py-[4px] text-[12px] text-left ${
                      activeSection === s.id
                        ? "bg-[hsl(var(--win98-titlebar))] text-white"
                        : "hover:bg-[hsl(var(--win98-titlebar))] hover:text-white"
                    }`}
                  >
                    <span className="mr-[2px]">{activeSection === s.id ? "📂" : "📁"}</span>
                    <span className="flex-1">{s.label}</span>
                    <span className="text-[9px] opacity-60">{sectionCounts[s.id]}</span>
                  </button>

                  {activeSection === "oppohub" && s.id === "oppohub" && (
                    <div className="ml-4 border-l border-l-[hsl(var(--win98-shadow))]">
                      {filters.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => handleFilterChange(f.id)}
                          className={`flex w-full items-center gap-1 px-2 py-[3px] text-[11px] text-left ${
                            activeFilter === f.id
                              ? "bg-[hsl(var(--win98-titlebar))] text-white"
                              : "hover:bg-[hsl(var(--win98-titlebar))] hover:text-white"
                          }`}
                        >
                          <span>{f.emoji}</span>
                          <span className="flex-1">{f.label}</span>
                          <span className="text-[9px] opacity-60">{counts[f.id]}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-t-[hsl(var(--win98-shadow))] p-2 space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[hsl(var(--muted-foreground))]">
              {lastSync ? <>Synced {formatSyncTime(lastSync)}</> : <>Not synced</>}
            </span>
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="win98-button text-[9px] px-1 py-0 h-[16px] flex items-center gap-1"
            >
              <RefreshCw className={`h-2.5 w-2.5 ${syncing ? "animate-spin" : ""}`} />
              Sync
            </button>
          </div>
          <div className="text-[9px] text-center text-[hsl(var(--muted-foreground))]">// FOR INTERNAL USE ONLY //</div>
        </div>
      </div>
    </>
  );
}
