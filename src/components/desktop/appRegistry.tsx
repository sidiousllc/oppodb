import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

// Eager imports for the most-used sections (already in main bundle)
import { Dashboard } from "@/components/Dashboard";
import { OppoHub } from "@/components/OppoHub";
import { LegHub } from "@/components/LegHub";
import { PollingSection } from "@/components/PollingSection";
import { MessagingHub } from "@/components/MessagingHub";
import { IntelHub } from "@/components/IntelHub";
import { InternationalHub } from "@/components/InternationalHub";
import { LiveElectionsSection } from "@/components/LiveElectionsSection";
import { ReportsHub } from "@/components/ReportsHub";
import { DocumentationSection } from "@/components/DocumentationSection";
import { WarRoomHub } from "@/components/WarRoomHub";
import { CRMHub } from "@/components/CRMHub";
import { ForecastHub } from "@/components/ForecastHub";
import { InvestigationsPanel } from "@/components/InvestigationsPanel";
import { GraphHub } from "@/components/GraphHub";
import { ResearchToolsDashboard } from "@/components/ResearchToolsDashboard";
import { VoterDataSection } from "@/components/VoterDataSection";
import { CourtRecordsSearch } from "@/components/CourtRecordsSearch";
import { StateReportGenerator } from "@/components/StateReportGenerator";
import { OSINTToolPanel } from "@/components/OSINTToolPanel";

import { useWindowManager } from "@/contexts/WindowManagerContext";
import { getOSINTToolById } from "@/data/osintTools";

export interface AppDescriptor {
  /** Stable ID — also used as the singleton key when only one instance is allowed */
  id: string;
  title: string;
  icon: string;
  /** When true, opening the same appId again focuses the existing window */
  singleton?: boolean;
  size?: { width: number; height: number };
  render: (payload: Record<string, any> | undefined, ctx: AppRenderContext) => ReactNode;
}

interface AppRenderContext {
  /** Open another app (e.g., from a card → detail) */
  openApp: (appId: string, payload?: Record<string, any>) => void;
  /** Close this window */
  close: () => void;
}

/** Generic placeholder for app pages we still navigate to via React Router. */
function RouteShim({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate();
  return (
    <div className="p-4 text-[11px] space-y-2">
      <p>Opening <strong>{label}</strong> in this window…</p>
      <button onClick={() => navigate(to)} className="win98-button text-[10px]">Go to {label}</button>
    </div>
  );
}

/** Pick a sensible default size per app */
const DEFAULT_LARGE = { width: Math.min(1100, typeof window !== "undefined" ? window.innerWidth - 220 : 900), height: Math.min(720, typeof window !== "undefined" ? window.innerHeight - 140 : 640) };

export const APP_REGISTRY: Record<string, AppDescriptor> = {
  // ─── Sidebar sections ──────────────────────────────────────────────────────
  dashboard: {
    id: "dashboard",
    title: "Dashboard",
    icon: "🏠",
    singleton: true,
    render: (_p, ctx) => (
      <div className="p-3">
        <Dashboard
          onNavigateSection={(s, slug) => ctx.openApp(s, slug ? { slug } : undefined)}
          candidateCount={0}
          districtCount={0}
          districts={[]}
        />
      </div>
    ),
  },
  oppohub: {
    id: "oppohub",
    title: "OppoHub",
    icon: "🎯",
    singleton: true,
    render: (payload, ctx) => (
      <div className="p-3">
        <OppoHub
          search=""
          filter="all"
          dataVersion={0}
          isAdmin={false}
          onSelectSlug={() => {}}
          selectedSlug={(payload?.slug as string) ?? null}
          onNavigateSlug={(slug) => { ctx.openApp("oppohub", { slug }); return true; }}
          onEditCandidate={() => {}}
          onCreateCandidate={() => {}}
          onSetSection={(s) => ctx.openApp(s)}
        />
      </div>
    ),
  },
  leghub: {
    id: "leghub",
    title: "LegHub",
    icon: "⚖️",
    singleton: true,
    render: (payload, ctx) => (
      <div className="p-3">
        <LegHub
          stateLegDistricts={[]}
          stateLegLoading={false}
          onStateLegSync={async () => {}}
          stateLegSyncing={false}
          districts={[]}
          onDistrictsChange={() => {}}
          search=""
          onSelectSlug={() => {}}
          selectedSlug={(payload?.slug as string) ?? null}
          onNavigateToCandidate={(slug) => ctx.openApp("oppohub", { slug })}
        />
      </div>
    ),
  },
  polling: {
    id: "polling",
    title: "DataHub",
    icon: "📊",
    singleton: true,
    render: () => <div className="p-3"><PollingSection /></div>,
  },
  intelhub: {
    id: "intelhub",
    title: "IntelHub",
    icon: "🕵️",
    singleton: true,
    render: () => <div className="p-3"><IntelHub /></div>,
  },
  messaging: {
    id: "messaging",
    title: "MessagingHub",
    icon: "📢",
    singleton: true,
    render: () => <div className="p-3"><MessagingHub /></div>,
  },
  "research-tools": {
    id: "research-tools",
    title: "Research Tools",
    icon: "🔬",
    singleton: true,
    render: (_p, ctx) => (
      <div className="p-3">
        <ResearchToolsDashboard
          onNavigateSubsection={(sub) => {
            if (sub.startsWith("osint:")) {
              const toolId = sub.slice("osint:".length);
              const tool = getOSINTToolById(toolId);
              ctx.openApp("osint-tool", {
                toolId,
                title: tool ? `${tool.emoji} ${tool.label}` : "OSINT Tool",
              });
            } else {
              ctx.openApp(sub);
            }
          }}
        />
      </div>
    ),
  },
  internationalhub: {
    id: "internationalhub",
    title: "InternationalHub",
    icon: "🌐",
    singleton: true,
    render: () => <div className="p-3"><InternationalHub /></div>,
  },
  "live-elections": {
    id: "live-elections",
    title: "Live Elections",
    icon: "🏛️",
    singleton: true,
    render: () => <div className="p-3"><LiveElectionsSection /></div>,
  },
  reports: {
    id: "reports",
    title: "ReportHub",
    icon: "📝",
    singleton: true,
    render: () => <div className="p-3"><ReportsHub /></div>,
  },
  documentation: {
    id: "documentation",
    title: "Documentation",
    icon: "📖",
    singleton: true,
    render: () => <div className="p-3"><DocumentationSection /></div>,
  },
  warroom: {
    id: "warroom",
    title: "War Rooms",
    icon: "⚔️",
    singleton: true,
    render: () => <div className="p-3"><WarRoomHub /></div>,
  },
  crm: {
    id: "crm",
    title: "Stakeholders",
    icon: "🤝",
    singleton: true,
    render: () => <div className="p-3"><CRMHub /></div>,
  },
  forecast: {
    id: "forecast",
    title: "Forecast Lab",
    icon: "🎲",
    singleton: true,
    render: () => <div className="p-3"><ForecastHub /></div>,
  },
  investigations: {
    id: "investigations",
    title: "Investigations",
    icon: "🔍",
    singleton: true,
    render: () => <div className="p-3"><InvestigationsPanel /></div>,
  },
  graph: {
    id: "graph",
    title: "Entity Graph",
    icon: "🕸️",
    singleton: true,
    render: () => <div className="p-3"><GraphHub /></div>,
  },

  // ─── Research Tools sub-panels (each its own window) ───────────────────────
  "voter-data": {
    id: "voter-data",
    title: "Voter Data",
    icon: "🗳️",
    singleton: true,
    render: () => <div className="p-3"><VoterDataSection /></div>,
  },
  "court-records": {
    id: "court-records",
    title: "Court Records",
    icon: "⚖️",
    singleton: true,
    render: (_p, ctx) => <div className="p-3"><CourtRecordsSearch onBack={ctx.close} /></div>,
  },
  "state-report": {
    id: "state-report",
    title: "State Report Generator",
    icon: "📊",
    singleton: true,
    render: (_p, ctx) => <div className="p-3"><StateReportGenerator onBack={ctx.close} /></div>,
  },
  "war-rooms": {
    id: "war-rooms",
    title: "War Rooms",
    icon: "⚔️",
    singleton: true,
    render: () => <div className="p-3"><WarRoomHub /></div>,
  },
  stakeholders: {
    id: "stakeholders",
    title: "Stakeholders (CRM)",
    icon: "🤝",
    singleton: true,
    render: () => <div className="p-3"><CRMHub /></div>,
  },
  "forecast-lab": {
    id: "forecast-lab",
    title: "Forecast Lab",
    icon: "🎲",
    singleton: true,
    render: () => <div className="p-3"><ForecastHub /></div>,
  },
  "entity-graph": {
    id: "entity-graph",
    title: "Entity Graph",
    icon: "🕸️",
    singleton: true,
    render: () => <div className="p-3"><GraphHub /></div>,
  },

  // ─── OSINT tool launcher (one window per tool instance) ────────────────────
  "osint-tool": {
    id: "osint-tool",
    title: "OSINT Tool",
    icon: "🔎",
    // Not singleton — allow multiple OSINT tools open at once
    render: (payload, ctx) => (
      <div className="p-3">
        <OSINTToolPanel toolId={(payload?.toolId as string) ?? ""} onBack={ctx.close} />
      </div>
    ),
  },

  // ─── Desktop-icon shims (route-based) ──────────────────────────────────────
  profile: {
    id: "profile",
    title: "My Profile",
    icon: "👤",
    singleton: true,
    size: { width: 480, height: 360 },
    render: () => <RouteShim to="/profile" label="My Profile" />,
  },
  admin: {
    id: "admin",
    title: "Admin Panel",
    icon: "🛡️",
    singleton: true,
    size: { width: 480, height: 360 },
    render: () => <RouteShim to="/admin" label="Admin Panel" />,
  },
  api: {
    id: "api",
    title: "API Access",
    icon: "🔑",
    singleton: true,
    size: { width: 480, height: 360 },
    render: () => <RouteShim to="/api" label="API Access" />,
  },
  "my-computer": {
    id: "my-computer",
    title: "My Computer",
    icon: "🖥️",
    singleton: true,
    size: { width: 420, height: 320 },
    render: () => (
      <div className="p-4 text-[11px] space-y-2">
        <p className="font-bold">My Computer</p>
        <ul className="space-y-1">
          <li>🖴 (C:) ORDB System</li>
          <li>📁 Research Database</li>
          <li>📁 OSINT Toolbox</li>
          <li>📁 War Rooms</li>
        </ul>
      </div>
    ),
  },
  "network-neighborhood": {
    id: "network-neighborhood",
    title: "Network Neighborhood",
    icon: "🌍",
    singleton: true,
    size: { width: 420, height: 320 },
    render: () => (
      <div className="p-4 text-[11px] space-y-2">
        <p className="font-bold">Network Neighborhood</p>
        <p className="text-[hsl(var(--muted-foreground))]">Connected services:</p>
        <ul className="space-y-1">
          <li>🌐 Lovable Cloud — connected</li>
          <li>📡 Realtime presence — online</li>
          <li>📨 Mail server — operational</li>
        </ul>
      </div>
    ),
  },
};

/** Hook returning a stable openApp(id, payload) helper that uses the registry. */
export function useOpenApp() {
  const { openWindow } = useWindowManager();
  return (appId: string, payload?: Record<string, any>) => {
    const desc = APP_REGISTRY[appId];
    if (!desc) {
      // eslint-disable-next-line no-console
      console.warn(`[appRegistry] Unknown appId: ${appId}`);
      return "";
    }
    // Allow per-instance title override via payload.title (e.g. OSINT tool name)
    const title = (payload?.title as string) || desc.title;
    return openWindow({
      appId: desc.id,
      title,
      icon: desc.icon,
      payload,
      singleton: desc.singleton,
      size: desc.size,
    });
  };
}
