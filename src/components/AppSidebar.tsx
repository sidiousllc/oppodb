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

export type FilterCategory = "all" | "house" | "senate" | "governor" | "state";
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
  | "documentation";

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
  { id: "house", label: "House Races", emoji: "🏛️" },
  { id: "senate", label: "Senate Races", emoji: "🏛️" },
  { id: "governor", label: "Governor Races", emoji: "👔" },
  { id: "state", label: "State Races", emoji: "📍" },
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
      // Run all syncs in parallel - comprehensive data pull from all sources
      const syncOps = [
        supabase.functions.invoke("sync-github"),
        supabase.functions.invoke("congress-sync", { body: { action: "sync_all" } }),
        supabase.functions.invoke("polling-sync"),
        supabase.functions.invoke("forecast-sync"),
        supabase.functions.invoke("campaign-finance-sync"),
        supabase.functions.invoke("intel-briefing"),
        supabase.functions.invoke("international-sync", { body: { batch: true, codes: ["US","CA","MX","GB","FR","DE","IT","ES","JP","KR","CN","IN","BR","AU","ZA","NG","EG","SA","IL","TR","UA","RU","PL","SE","NL","AR","CO","TH","ID","PH","KE","NG"] } }),
        supabase.functions.invoke("state-legislative-sync"),
        supabase.functions.invoke("prediction-markets-sync"),
        supabase.functions.invoke("opensecrets-sync"),
      ];

      const results = await Promise.allSettled(syncOps);
      const succeeded = results.filter(r => r.status === "fulfilled").length;
      const failed = results.filter(r => r.status === "rejected").length;

      const t = await getLastSyncTime();
      setLastSync(t);
      onSyncComplete?.();

      const githubResult = results[0].status === "fulfilled" ? (results[0] as PromiseFulfilledResult<any>).value : null;
      const profileCount = githubResult?.data?.upserted ?? githubResult?.data?.count;

      toast.success("Full sync complete", {
        description: `${succeeded}/${syncOps.length} sync tasks completed${profileCount != null ? `, ${profileCount} profiles updated` : ""}${failed > 0 ? `, ${failed} failed` : ""}`,
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
            title="Sync all data sources (GitHub, Congress, Polling, Finance, Intel, International)"
          >
            <RefreshCw className={`h-2.5 w-2.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync All"}
          </button>
        </div>
        <div className="text-[9px] text-center text-[hsl(var(--muted-foreground))]">// FOR INTERNAL USE ONLY //</div>
      </div>
    </aside>
  );
}
