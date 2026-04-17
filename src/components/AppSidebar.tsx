import {
  BookOpen,
  Users,
  Landmark,
  Building2,
  MapPin,
  LayoutGrid,
  FileText,
  Globe,
  AlertTriangle,
  RefreshCw,
  Compass,
  Scale,
  BarChart3,
} from "lucide-react";
import { useState, useEffect } from "react";
import { getLastSyncTime } from "@/data/githubSync";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSectionAccess } from "@/hooks/useSectionAccess";

export type FilterCategory =
  | "all"
  | "us-house"
  | "us-senate"
  | "governor"
  | "statewide"
  | "state-leg"
  | "local"
  | "uncategorized";
export type Section =
  | "dashboard"
  | "oppohub"
  | "leghub"
  | "polling"
  | "intelhub"
  | "messaging"
  | "research-tools"
  | "internationalhub"
  | "live-elections"
  | "reports"
  | "documentation"
  | "warroom"
  | "crm"
  | "alerts"
  | "forecast"
  | "investigations"
  | "graph";

interface AppSidebarProps {
  activeFilter: FilterCategory;
  onFilterChange: (filter: FilterCategory) => void;
  counts: Record<FilterCategory, number>;
  activeSection: Section;
  onSectionChange: (section: Section) => void;
  sectionCounts: Record<Section, number>;
  onSyncComplete?: () => void;
}

const filters: Array<{ id: FilterCategory; label: string; emoji: string }> = [
  { id: "all", label: "All Profiles", emoji: "📋" },
  { id: "us-house", label: "U.S. House", emoji: "🏛️" },
  { id: "us-senate", label: "U.S. Senate", emoji: "🏛️" },
  { id: "governor", label: "Governor", emoji: "👔" },
  { id: "statewide", label: "Statewide Office", emoji: "🗳️" },
  { id: "state-leg", label: "State Legislature", emoji: "🏢" },
  { id: "local", label: "Local Office", emoji: "📍" },
  { id: "uncategorized", label: "Uncategorized", emoji: "❓" },
];

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
  { id: "reports", label: "ReportHub", emoji: "📝" },
  { id: "warroom", label: "War Rooms", emoji: "⚔️" },
  { id: "crm", label: "Stakeholders", emoji: "🤝" },
  { id: "alerts", label: "Alerts & Watch", emoji: "🔔" },
  { id: "forecast", label: "Forecast Lab", emoji: "🎲" },
  
  { id: "graph", label: "Entity Graph", emoji: "🕸️" },
  { id: "documentation", label: "Documentation", emoji: "📖" },
];

export function AppSidebar({
  activeFilter,
  onFilterChange,
  counts,
  activeSection,
  onSectionChange,
  sectionCounts,
  onSyncComplete,
}: AppSidebarProps) {
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const { canAccess } = useSectionAccess();

  useEffect(() => {
    getLastSyncTime().then(setLastSync);
  }, []);

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
        console.error("Sync error:", error);
        toast.error("Sync failed", { description: error.message || "Could not sync from GitHub" });
        return;
      }
      console.log("Sync result:", data);
      const t = await getLastSyncTime();
      setLastSync(t);
      onSyncComplete?.();
      const count = data?.upserted ?? data?.count;
      toast.success("GitHub sync complete", {
        description: count != null ? `${count} profiles updated` : "All profiles are up to date",
      });
    } catch (e) {
      console.error("Sync failed:", e);
      toast.error("Sync failed", { description: "An unexpected error occurred" });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <aside className="flex w-[180px] lg:w-[220px] shrink-0 flex-col bg-[hsl(var(--win98-face))] border-r-2 border-r-[hsl(var(--win98-shadow))]">
      {/* Tree view header */}
      <div className="px-2 py-1 border-b border-b-[hsl(var(--win98-shadow))] text-[11px] font-bold flex items-center gap-1">
        <span>📂</span> Databases
      </div>

      {/* Tree view */}
      <nav className="flex-1 overflow-y-auto p-1">
        <div className="text-[11px]">
          {/* Root node */}
          <div className="flex items-center gap-1 px-1 py-[2px] font-bold">
            <span>📁</span> Research Database
          </div>

          {/* Sections as tree items */}
          <div className="ml-3 border-l border-l-[hsl(var(--win98-shadow))]">
            {sections.filter(s => canAccess(s.id)).map((s, i) => (
              <div key={s.id}>
                <button
                  onClick={() => onSectionChange(s.id)}
                  className={`flex w-full items-center gap-1 px-2 py-[2px] text-[11px] text-left ${
                    activeSection === s.id
                      ? "bg-[hsl(var(--win98-titlebar))] text-white"
                      : "hover:bg-[hsl(var(--win98-titlebar))] hover:text-white"
                  }`}
                >
                  <span className="mr-[2px]">{activeSection === s.id ? "📂" : "📁"}</span>
                  <span className="flex-1">{s.label}</span>
                  <span className="text-[9px] opacity-60">{sectionCounts[s.id]}</span>
                </button>

                {/* Sub-tree for race type filters */}
                {activeSection === "oppohub" && s.id === "oppohub" && (
                  <div className="ml-4 border-l border-l-[hsl(var(--win98-shadow))]">
                    {filters.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => onFilterChange(f.id)}
                        className={`flex w-full items-center gap-1 px-2 py-[1px] text-[10px] text-left ${
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
            title="Sync from GitHub"
          >
            <RefreshCw className={`h-2.5 w-2.5 ${syncing ? "animate-spin" : ""}`} />
            Sync
          </button>
        </div>
        <div className="text-[9px] text-center text-[hsl(var(--muted-foreground))]">// FOR INTERNAL USE ONLY //</div>
      </div>
    </aside>
  );
}
