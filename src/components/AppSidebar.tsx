import { BookOpen, Users, Landmark, Building2, MapPin, LayoutGrid, FileText, Globe, AlertTriangle, RefreshCw, Compass, LogOut, ShieldCheck, BarChart3, Scale, Key } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getLastSyncTime } from "@/data/githubSync";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

export type FilterCategory = "all" | "house" | "senate" | "governor" | "state";
export type Section = "candidates" | "maga-files" | "local-impact" | "narratives" | "district-intel" | "state-legislative" | "polling";

interface AppSidebarProps {
  activeFilter: FilterCategory;
  onFilterChange: (filter: FilterCategory) => void;
  counts: Record<FilterCategory, number>;
  activeSection: Section;
  onSectionChange: (section: Section) => void;
  sectionCounts: Record<Section, number>;
  onSyncComplete?: () => void;
}

const filters: Array<{id: FilterCategory;label: string;icon: React.ElementType;}> = [
{ id: "all", label: "All Profiles", icon: LayoutGrid },
{ id: "house", label: "House Races", icon: Building2 },
{ id: "senate", label: "Senate Races", icon: Landmark },
{ id: "governor", label: "Governor Races", icon: Users },
{ id: "state", label: "State Races", icon: MapPin }];


const sections: Array<{id: Section;label: string;icon: React.ElementType;}> = [
{ id: "candidates", label: "Candidate Profiles", icon: Users },
{ id: "maga-files", label: "MAGA Files", icon: AlertTriangle },
{ id: "local-impact", label: "Local Impact", icon: Globe },
{ id: "narratives", label: "Narrative Reports", icon: FileText },
{ id: "district-intel", label: "District Intel", icon: Compass },
{ id: "state-legislative", label: "State Legislatures", icon: Scale },
{ id: "polling", label: "Polling Data", icon: BarChart3 }];


function SignOutButton() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { canAccessApi } = useUserRole();
  return (
    <div className="space-y-1.5">
      {canAccessApi && (
        <button
          onClick={() => navigate("/api")}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-sidebar-border py-1.5 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
          <Key className="h-3.5 w-3.5" />
          API Access
        </button>
      )}
      <button
        onClick={() => navigate("/profile")}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-sidebar-border py-1.5 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
        <Users className="h-3.5 w-3.5" />
        My Profile
      </button>
      <button
        onClick={signOut}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-sidebar-border py-1.5 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
        <LogOut className="h-3.5 w-3.5" />
        Sign Out
      </button>
    </div>);
}

export function AppSidebar({ activeFilter, onFilterChange, counts, activeSection, onSectionChange, sectionCounts, onSyncComplete }: AppSidebarProps) {
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

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
        return;
      }
      console.log("Sync result:", data);
      const t = await getLastSyncTime();
      setLastSync(t);
      onSyncComplete?.();
    } catch (e) {
      console.error("Sync failed:", e);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <BookOpen className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-sidebar-foreground pr-0 text-center pl-0 font-extrabold text-lg">
              Opposition Research Database
            </h1>
            <p className="text-xs text-sidebar-foreground/60 text-center">Sidio.us Group</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 sidebar-nav overflow-y-auto">
        <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">
          Sections
        </p>
        {sections.map((s) =>
        <button
          key={s.id}
          onClick={() => onSectionChange(s.id)}
          className={`sidebar-nav-item ${activeSection === s.id ? "active" : ""}`}>
          
            <s.icon className="h-4 w-4" />
            <span className="flex-1 text-left">{s.label}</span>
            <span className="text-xs text-sidebar-foreground/40">{sectionCounts[s.id]}</span>
          </button>
        )}

        {activeSection === "candidates" &&
        <>
            <p className="px-3 py-2 mt-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              Race Type
            </p>
            {filters.map((f) =>
          <button
            key={f.id}
            onClick={() => onFilterChange(f.id)}
            className={`sidebar-nav-item ${activeFilter === f.id ? "active" : ""}`}>
            
                <f.icon className="h-4 w-4" />
                <span className="flex-1 text-left">{f.label}</span>
                <span className="text-xs text-sidebar-foreground/40">{counts[f.id]}</span>
              </button>
          )}
          </>
        }
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-3">
        <AdminLink />
        <div className="flex items-center justify-between">
          <div className="text-xs text-sidebar-foreground/50">
            {lastSync ?
            <>Synced {formatSyncTime(lastSync)}</> :

            <>Not synced yet</>
            }
          </div>
          <button
            onClick={handleManualSync}
            disabled={syncing}
            className="flex items-center gap-1 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors disabled:opacity-50"
            title="Sync from GitHub">
            
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          </button>
        </div>
        <p className="text-xs text-sidebar-foreground/40 leading-relaxed">
          <center>// FOR INTERNAL USE ONLY //
// FOR CLIENT USE ONLY //</center>
        </p>
        <SignOutButton />
      </div>
    </aside>);

}

function AdminLink() {
  const navigate = useNavigate();
  const { canManageContent } = useUserRole();
  if (!canManageContent) return null;
  return (
    <button
      onClick={() => navigate("/admin")}
      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors">
      
      <ShieldCheck className="h-3.5 w-3.5" />
      Admin Panel
    </button>);

}