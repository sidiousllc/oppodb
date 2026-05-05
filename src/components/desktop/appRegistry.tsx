import { ReactNode, useEffect, useState, useCallback } from "react";
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
import { CandidateDetail } from "@/components/CandidateDetail";
import { GenericDetail } from "@/components/GenericDetail";
import { DistrictDetail } from "@/components/DistrictDetail";
import { AIHistoryWindow } from "@/components/AIHistoryWindow";
import { TaskManagerWindow } from "@/components/TaskManagerWindow";
import { AlertsHub } from "@/components/AlertsHub";
import { BillDetailWindow } from "@/components/BillDetailWindow";
import { SystemStatusWindow } from "@/components/SystemStatusWindow";
import { DeployChecklistWindow } from "@/components/DeployChecklistWindow";
import { McpToolsWindow } from "@/components/McpToolsWindow";
import { PricingWindow } from "@/components/PricingWindow";
import { MySubscriptionWindow } from "@/components/MySubscriptionWindow";

import { useWindowManager } from "@/contexts/WindowManagerContext";
import { getOSINTToolById } from "@/data/osintTools";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { candidates, getCandidateBySlug, initCandidates } from "@/data/candidates";
import { fetchCandidatesFromDB } from "@/data/githubSync";
import { fetchAllDistricts, type DistrictProfile } from "@/data/districtIntel";
import { fetchStateLegislativeDistricts, syncStateLegislativeData, type StateLegislativeProfile } from "@/data/stateLegislativeIntel";
import { magaFiles, mergeMagaFilesFromDB } from "@/data/magaFiles";
import { localImpactReports, getLocalImpactBySlug, mergeLocalImpactFromDB } from "@/data/localImpact";
import { narrativeReports, mergeNarrativeReportsFromDB } from "@/data/narrativeReports";
import { supabase } from "@/integrations/supabase/client";

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

/* ─── Stateful wrappers used by registry render() functions ────────────── */

function DashboardWindow({ openApp }: { openApp: AppRenderContext["openApp"] }) {
  const [districts, setDistricts] = useState<DistrictProfile[]>([]);
  const [count, setCount] = useState(candidates.length);
  useEffect(() => {
    let c = false;
    fetchAllDistricts().then(d => !c && setDistricts(d));
    fetchCandidatesFromDB().then(x => {
      if (c || !x.length) return;
      initCandidates(x.map(v => ({ name: v.name, slug: v.slug, content: v.content, github_path: v.github_path })));
      setCount(candidates.length);
    });
    return () => { c = true; };
  }, []);
  return (
    <Dashboard
      onNavigateSection={(s, slug) => openApp(s, slug ? { slug } : undefined)}
      candidateCount={count}
      districtCount={districts.length}
      districts={districts}
    />
  );
}

function OppoHubWindow({ initialSlug, openApp }: { initialSlug?: string; openApp: AppRenderContext["openApp"] }) {
  const { isAdmin } = useIsAdmin();
  const [filter, setFilter] = useState<any>("all");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSlug ?? null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let c = false;
    fetchCandidatesFromDB().then(x => {
      if (c || !x.length) return;
      initCandidates(x.map(v => ({ name: v.name, slug: v.slug, content: v.content, github_path: v.github_path })));
      setVersion(v => v + 1);
    });
    Promise.all([
      supabase.from("maga_files").select("name, slug, content").order("name"),
      supabase.from("local_impacts").select("state, slug, summary, content").order("state"),
      supabase.from("narrative_reports").select("name, slug, content").order("name"),
    ]).then(([m, l, n]) => {
      if (c) return;
      if (m.data?.length) mergeMagaFilesFromDB(m.data);
      if (l.data?.length) mergeLocalImpactFromDB(l.data);
      if (n.data?.length) mergeNarrativeReportsFromDB(n.data);
      setVersion(v => v + 1);
    });
    return () => { c = true; };
  }, []);

  const candidate = selectedSlug ? getCandidateBySlug(selectedSlug) : null;
  const maga = selectedSlug ? magaFiles.find(m => m.slug === selectedSlug) : null;
  const local = selectedSlug ? getLocalImpactBySlug(selectedSlug) : null;
  const narrative = selectedSlug ? narrativeReports.find(n => n.slug === selectedSlug) : null;

  if (candidate) {
    return (
      <CandidateDetail
        candidate={candidate}
        onBack={() => setSelectedSlug(null)}
        onNavigateSlug={(slug) => { setSelectedSlug(slug); return true; }}
        onEdit={() => {}}
      />
    );
  }
  if (maga) return <GenericDetail icon="📁" title={maga.name} content={maga.content} onBack={() => setSelectedSlug(null)} onNavigateSlug={(s) => { setSelectedSlug(s); return true; }} />;
  if (local) return <GenericDetail icon="📍" title={`${local.state} — Local Impact`} content={local.content} onBack={() => setSelectedSlug(null)} onNavigateSlug={(s) => { setSelectedSlug(s); return true; }} />;
  if (narrative) return <GenericDetail icon="📰" title={narrative.name} content={narrative.content} onBack={() => setSelectedSlug(null)} onNavigateSlug={(s) => { setSelectedSlug(s); return true; }} />;

  return (
    <OppoHub
      search=""
      filter={filter}
      onFilterChange={setFilter}
      dataVersion={version}
      isAdmin={isAdmin}
      onSelectSlug={setSelectedSlug}
      selectedSlug={null}
      onNavigateSlug={(slug) => { setSelectedSlug(slug); return true; }}
      onEditCandidate={() => {}}
      onCreateCandidate={() => {}}
      onSetSection={(s) => openApp(s)}
    />
  );
}

function LegHubWindow({ initialSlug, openApp }: { initialSlug?: string; openApp: AppRenderContext["openApp"] }) {
  const [districts, setDistricts] = useState<DistrictProfile[]>([]);
  const [stateLeg, setStateLeg] = useState<StateLegislativeProfile[]>([]);
  const [stateLegLoading, setStateLegLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSlug ?? null);

  // Fetch district intel and state-leg independently so district intel
  // (maps + cards) renders immediately without waiting on the much larger
  // 12k-row state legislative pagination.
  useEffect(() => {
    let c = false;
    fetchAllDistricts()
      .then(d => { if (!c) setDistricts(d); })
      .catch(err => console.error("fetchAllDistricts failed:", err));
    fetchStateLegislativeDistricts()
      .then(s => { if (!c) setStateLeg(s); })
      .catch(err => console.error("fetchStateLegislativeDistricts failed:", err))
      .finally(() => { if (!c) setStateLegLoading(false); });
    return () => { c = true; };
  }, []);

  const handleSync = useCallback(async (stateAbbr?: string, chamber?: string) => {
    setSyncing(true);
    try {
      await syncStateLegislativeData(stateAbbr, chamber);
      const fresh = await fetchStateLegislativeDistricts();
      setStateLeg(fresh);
    } finally { setSyncing(false); }
  }, []);

  return (
    <LegHub
      stateLegDistricts={stateLeg}
      stateLegLoading={stateLegLoading}
      onStateLegSync={handleSync}
      stateLegSyncing={syncing}
      districts={districts}
      onDistrictsChange={setDistricts}
      search=""
      onSelectSlug={setSelectedSlug}
      selectedSlug={selectedSlug}
      onNavigateToCandidate={(slug) => openApp("oppohub", { slug })}
    />
  );
}

export const APP_REGISTRY: Record<string, AppDescriptor> = {
  // ─── Sidebar sections ──────────────────────────────────────────────────────
  dashboard: {
    id: "dashboard",
    title: "Dashboard",
    icon: "🏠",
    singleton: true,
    render: (_p, ctx) => <div className="p-3"><DashboardWindow openApp={ctx.openApp} /></div>,
  },
  oppohub: {
    id: "oppohub",
    title: "OppoHub",
    icon: "🎯",
    singleton: true,
    render: (payload, ctx) => (
      <div className="p-3">
        <OppoHubWindow initialSlug={payload?.slug as string | undefined} openApp={ctx.openApp} />
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
        <LegHubWindow initialSlug={payload?.slug as string | undefined} openApp={ctx.openApp} />
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
  "ai-history": {
    id: "ai-history",
    title: "AI Generation History",
    icon: "🧠",
    singleton: true,
    render: (payload) => (
      <AIHistoryWindow
        initialFeature={payload?.feature as string | undefined}
        initialSubjectType={payload?.subject_type as string | undefined}
        initialSubjectRef={payload?.subject_ref as string | undefined}
      />
    ),
  },
  "task-manager": {
    id: "task-manager",
    title: "Task Manager",
    icon: "📋",
    singleton: true,
    size: { width: 520, height: 480 },
    render: () => <TaskManagerWindow />,
  },
  alerts: {
    id: "alerts",
    title: "Alerts Hub",
    icon: "🚨",
    singleton: true,
    render: () => <div className="p-3"><AlertsHub /></div>,
  },
  status: {
    id: "status",
    title: "System Status",
    icon: "📊",
    singleton: true,
    size: { width: 520, height: 440 },
    render: () => <SystemStatusWindow variant="status" />,
  },
  health: {
    id: "health",
    title: "Health Monitor",
    icon: "❤️",
    singleton: true,
    size: { width: 360, height: 320 },
    render: () => <SystemStatusWindow variant="health" />,
  },
  "deploy-checklist": {
    id: "deploy-checklist",
    title: "Deploy Checklist",
    icon: "✅",
    singleton: true,
    size: { width: 560, height: 520 },
    render: () => <DeployChecklistWindow />,
  },
  "mcp-tools": {
    id: "mcp-tools",
    title: "MCP Tools",
    icon: "🧰",
    singleton: true,
    size: { width: 820, height: 580 },
    render: () => <McpToolsWindow />,
  },
  pricing: {
    id: "pricing",
    title: "Upgrade / Billing",
    icon: "💳",
    singleton: true,
    size: { width: 720, height: 560 },
    render: () => <PricingWindow />,
  },
  "my-subscription": {
    id: "my-subscription",
    title: "My Subscription",
    icon: "🧾",
    singleton: true,
    size: { width: 560, height: 520 },
    render: () => <MySubscriptionWindow />,
  },
  // Notepad is rendered directly via Win98Notepad in Win98Desktop (it wraps its own window)
  "recycle-bin": {
    id: "recycle-bin",
    title: "Recycle Bin",
    icon: "🗑️",
    singleton: true,
    size: { width: 420, height: 320 },
    render: () => (
      <div className="p-4 text-[11px] space-y-2">
        <p className="font-bold">Recycle Bin</p>
        <p className="text-[hsl(var(--muted-foreground))]">The Recycle Bin is empty.</p>
      </div>
    ),
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

  // ─── Bill detail (one window per bill) ──────────────────────────────────────
  "bill-detail": {
    id: "bill-detail",
    title: "Bill Details",
    icon: "📜",
    size: { width: 560, height: 600 },
    render: (payload) => (
      <BillDetailWindow
        billId={Number(payload?.billId)}
        billNumber={payload?.billNumber as string | undefined}
        fallbackTitle={payload?.title as string | undefined}
      />
    ),
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
