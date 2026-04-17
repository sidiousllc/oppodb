import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { candidates, searchCandidates, getCandidateBySlug, getCandidatesByCategory, initCandidates } from "@/data/candidates";
import { loadCandidateData } from "@/data/candidateContent";
import { magaFiles, searchMagaFiles, mergeMagaFilesFromDB } from "@/data/magaFiles";
import { localImpactReports, searchLocalImpact, getLocalImpactBySlug, mergeLocalImpactFromDB } from "@/data/localImpact";
import { narrativeReports, searchNarrativeReports, mergeNarrativeReportsFromDB } from "@/data/narrativeReports";
import { fetchCandidatesFromDB } from "@/data/githubSync";
import { fetchAllDistricts, type DistrictProfile } from "@/data/districtIntel";
import { fetchStateLegislativeDistricts, syncStateLegislativeData, type StateLegislativeProfile } from "@/data/stateLegislativeIntel";

import { MasterSearch } from "@/components/MasterSearch";
import { CandidateCard } from "@/components/CandidateCard";
import { CandidateDetail } from "@/components/CandidateDetail";
import { GenericCard } from "@/components/GenericCard";
import { GenericDetail } from "@/components/GenericDetail";
import { AppSidebar, type FilterCategory, type Section } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { CandidateEditor } from "@/components/CandidateEditor";
import { supabase } from "@/integrations/supabase/client";
import { Win98Window } from "@/components/Win98Window";
import { Win98Taskbar } from "@/components/Win98Taskbar";
import { NewsTicker } from "@/components/NewsTicker";
import { AOLToolbar } from "@/components/AOLToolbar";
import { Win98Desktop } from "@/components/Win98Desktop";
import { AOLBuddyList } from "@/components/AOLBuddyList";
import { AOLMailWindow } from "@/components/AOLMailWindow";
import { useMail } from "@/contexts/MailContext";
import { AlertTriangle, Globe, FileText, Plus } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { PollingSection } from "@/components/PollingSection";
import { LegHub } from "@/components/LegHub";
import { OppoHub } from "@/components/OppoHub";
import { MessagingHub } from "@/components/MessagingHub";
import { IntelHub } from "@/components/IntelHub";

import { Dashboard } from "@/components/Dashboard";
import { VoterDataSection } from "@/components/VoterDataSection";
import { ResearchToolsDashboard } from "@/components/ResearchToolsDashboard";
import { CourtRecordsSearch } from "@/components/CourtRecordsSearch";
import { StateReportGenerator } from "@/components/StateReportGenerator";
import { InternationalHub } from "@/components/InternationalHub";
import { LiveElectionsSection } from "@/components/LiveElectionsSection";
import { DocumentationSection } from "@/components/DocumentationSection";
import { ReportsHub } from "@/components/ReportsHub";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { useSectionAccess } from "@/hooks/useSectionAccess";

export default function Index() {
  const { isAdmin } = useIsAdmin();
  const { isMailOpen, closeMail } = useMail();
  const { trackPageView, trackMapView } = useActivityTracker();
  const { canAccess } = useSectionAccess();
  const [loaded, setLoaded] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterCategory>("all");
  const [section, setSection] = useState<Section>("dashboard");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [districts, setDistricts] = useState<DistrictProfile[]>([]);
  const [stateLegDistricts, setStateLegDistricts] = useState<StateLegislativeProfile[]>([]);
  const [stateLegLoading, setStateLegLoading] = useState(false);
  const [pollingCount, setPollingCount] = useState(0);
  
  const [stateLegSyncing, setStateLegSyncing] = useState(false);
  const [researchSubsection, setResearchSubsection] = useState<string | null>(null);
  const [candidateSubsection, setCandidateSubsection] = useState<"profiles" | "maga-files">("profiles");
  const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [hasLoadedStateLegDistricts, setHasLoadedStateLegDistricts] = useState(false);
  const [editData, setEditData] = useState<{
    id: string; name: string; slug: string; content: string;
    github_path: string; is_subpage: boolean; parent_slug: string | null; subpage_title: string | null;
  } | undefined>(undefined);


  // Track section changes
  useEffect(() => {
    trackPageView(section);
  }, [section, trackPageView]);

  useEffect(() => {
    if (section === "leghub") trackMapView("state_legislative");
  }, [section, trackMapView]);

  useEffect(() => {
    loadCandidateData();
    setLoaded(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchCandidatesFromDB().then((dbCandidates) => {
      if (cancelled || dbCandidates.length === 0) return;
      initCandidates(dbCandidates.map(c => ({ name: c.name, slug: c.slug, content: c.content })));
      setDataVersion((v) => v + 1);
    });

    fetchAllDistricts().then((data) => {
      if (cancelled) return;
      setDistricts(data);
    });

    supabase.from("polling_data").select("id", { count: "exact", head: true }).then(({ count }) => {
      if (cancelled) return;
      setPollingCount(count ?? 0);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSupplementalContent = async () => {
      const [magaRes, localRes, narrativeRes] = await Promise.all([
        supabase.from("maga_files").select("name, slug, content").order("name"),
        supabase.from("local_impacts").select("state, slug, summary, content").order("state"),
        supabase.from("narrative_reports").select("name, slug, content").order("name"),
      ]);

      if (cancelled) return;

      if (magaRes.data && magaRes.data.length > 0) {
        mergeMagaFilesFromDB(magaRes.data);
      }
      if (localRes.data && localRes.data.length > 0) {
        mergeLocalImpactFromDB(localRes.data);
      }
      if (narrativeRes.data && narrativeRes.data.length > 0) {
        mergeNarrativeReportsFromDB(narrativeRes.data);
      }
      if ((magaRes.data?.length || 0) > 0 || (localRes.data?.length || 0) > 0 || (narrativeRes.data?.length || 0) > 0) {
        setDataVersion((v) => v + 1);
      }
    };

    const timer = window.setTimeout(() => {
      loadSupplementalContent();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (section !== "leghub" || hasLoadedStateLegDistricts || stateLegLoading) return;

    let cancelled = false;
    setStateLegLoading(true);

    fetchStateLegislativeDistricts()
      .then((d) => {
        if (cancelled) return;
        setStateLegDistricts(d);
        setHasLoadedStateLegDistricts(true);
      })
      .catch(() => {
        if (cancelled) return;
        setHasLoadedStateLegDistricts(true);
      })
      .finally(() => {
        if (cancelled) return;
        setStateLegLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [section, hasLoadedStateLegDistricts, stateLegLoading]);


  const handleStateLegSync = useCallback(async (stateAbbr?: string, chamber?: string) => {
    setStateLegSyncing(true);
    try {
      const result = await syncStateLegislativeData(stateAbbr, chamber);
      if (result.success) {
        const fresh = await fetchStateLegislativeDistricts();
        setStateLegDistricts(fresh);
        setHasLoadedStateLegDistricts(true);
      } else {
        console.error("State legislative sync failed:", result.error);
      }
    } catch (e) {
      console.error("State legislative sync error:", e);
    } finally {
      setStateLegSyncing(false);
    }
  }, []);

  const refreshCandidates = useCallback(() => {
    fetchCandidatesFromDB().then((dbCandidates) => {
      if (dbCandidates.length > 0) {
        initCandidates(dbCandidates.map(c => ({ name: c.name, slug: c.slug, content: c.content })));
        setDataVersion((v) => v + 1);
      }
    });
  }, []);

  const handleEditCandidate = useCallback(async (slug: string) => {
    const { data } = await supabase
      .from("candidate_profiles")
      .select("*")
      .eq("slug", slug)
      .eq("is_subpage", false)
      .single();
    if (data) {
      setEditData({
        id: data.id, name: data.name, slug: data.slug, content: data.content,
        github_path: data.github_path, is_subpage: data.is_subpage,
        parent_slug: data.parent_slug, subpage_title: data.subpage_title,
      });
      setEditorMode("edit");
    }
  }, []);

  const handleEditorSaved = useCallback(() => {
    setEditorMode(null);
    setEditData(undefined);
    setSelectedSlug(null);
    refreshCandidates();
  }, [refreshCandidates]);

  const handleSectionChange = useCallback((newSection: Section) => {
    setSection(newSection);
    setSelectedSlug(null);
    setSearch("");
    setResearchSubsection(null);
  }, []);

  const navigateBySlug = useCallback((rawSlug: string) => {
    const slug = rawSlug.trim().toLowerCase();
    if (!slug) return false;
    const candidateMatch = getCandidateBySlug(slug);
    if (candidateMatch) { setSection("oppohub"); setSelectedSlug(candidateMatch.slug); return true; }
    const magaMatch = magaFiles.find(m => m.slug.toLowerCase() === slug);
    if (magaMatch) { setSection("oppohub"); setSelectedSlug(magaMatch.slug); return true; }
    const localMatch = getLocalImpactBySlug(slug);
    if (localMatch) { setSection("oppohub"); setSelectedSlug(localMatch.slug); return true; }
    const narrativeMatch = narrativeReports.find(n => n.slug.toLowerCase() === slug);
    if (narrativeMatch) { setSection("oppohub"); setSelectedSlug(narrativeMatch.slug); return true; }
    const districtMatch = districts.find(d => d.district_id.toLowerCase() === slug);
    if (districtMatch) { setSection("leghub"); setSelectedSlug(districtMatch.district_id); return true; }

    // Check if this is a subpage slug — find its parent candidate
    const parentCandidate = candidates.find(c => {
      // Check if any known candidate has a subpage link containing this slug
      return c.content.toLowerCase().includes(`/${slug}`) || c.content.toLowerCase().includes(`/${c.slug}/${slug}`);
    });
    if (parentCandidate) {
      setSection("oppohub");
      setSelectedSlug(parentCandidate.slug);
      return true;
    }

    return false;
  }, [districts]);

  const filteredCandidates = useMemo(() => {
    let results = search ? searchCandidates(search) : [...candidates];
    if (filter !== "all") results = results.filter(c => c.category === filter);
    return results;
  }, [search, filter, dataVersion]);

  const filteredMaga = useMemo(() => searchMagaFiles(search), [search, dataVersion]);
  const filteredLocal = useMemo(() => searchLocalImpact(search), [search, dataVersion]);
  const filteredNarratives = useMemo(() => searchNarrativeReports(search), [search, dataVersion]);

  const counts = useMemo(() => ({
    all: candidates.length,
    house: getCandidatesByCategory("house").length,
    senate: getCandidatesByCategory("senate").length,
    governor: getCandidatesByCategory("governor").length,
    state: getCandidatesByCategory("state").length,
  }), [dataVersion]);

  const sectionCounts = useMemo(() => ({
    dashboard: 0,
    oppohub: candidates.length + localImpactReports.length + narrativeReports.length,
    leghub: stateLegDistricts.length + districts.length,
    polling: pollingCount,
    intelhub: 0,
    messaging: 0,
    "research-tools": 0,
    internationalhub: 0,
    "live-elections": 0,
    reports: 0,
    documentation: 20,
  }), [dataVersion, districts, stateLegDistricts, pollingCount]);

  const selectedCandidate = selectedSlug ? getCandidateBySlug(selectedSlug) : null;
  const selectedMaga = selectedSlug ? magaFiles.find(m => m.slug === selectedSlug) : null;
  const selectedLocal = selectedSlug ? getLocalImpactBySlug(selectedSlug) : null;
  const selectedNarrative = selectedSlug ? narrativeReports.find(n => n.slug === selectedSlug) : null;
  

  if (!loaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-[hsl(var(--background))]">
        <div className="win98-raised bg-[hsl(var(--win98-face))] px-4 py-3 text-center">
          <div className="mb-2 text-[11px] font-bold">Loading ORO…</div>
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  const sectionLabels: Record<Section, string> = {
    dashboard: "Dashboard",
    oppohub: "OppoHub",
    leghub: "LegHub",
    polling: "DataHub",
    intelhub: "IntelHub",
    messaging: "MessagingHub",
    "research-tools": "Research Tools",
    internationalhub: "InternationalHub",
    "live-elections": "Live Elections",
    reports: "ReportHub",
    documentation: "Documentation",
  };

  function renderDetail() {
    return null;
  }

  function renderList() {
    // Check section-level access
    if (!canAccess(section)) {
      return (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🔒</div>
          <p className="text-[11px] font-bold mb-2">Access Restricted</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            You don't have permission to view this section. Contact an administrator for access.
          </p>
        </div>
      );
    }

    if (section === "dashboard") {
      return (
        <Dashboard
          onNavigateSection={(s, slug) => {
            setSection(s as Section);
            setSelectedSlug(slug || null);
          }}
          candidateCount={candidates.length}
          districtCount={districts.length}
          districts={districts}
        />
      );
    }

    if (section === "oppohub") {
      return (
        <OppoHub
          search={search}
          filter={filter}
          dataVersion={dataVersion}
          isAdmin={isAdmin}
          onSelectSlug={setSelectedSlug}
          selectedSlug={selectedSlug}
          onNavigateSlug={navigateBySlug}
          onEditCandidate={handleEditCandidate}
          onCreateCandidate={() => { setEditorMode("create"); setEditData(undefined); }}
          onSetSection={(s) => setSection(s as Section)}
        />
      );
    }

    if (section === "leghub") {
      return (
        <LegHub
          stateLegDistricts={stateLegDistricts}
          stateLegLoading={stateLegLoading}
          onStateLegSync={handleStateLegSync}
          stateLegSyncing={stateLegSyncing}
          districts={districts}
          onDistrictsChange={setDistricts}
          search={search}
          onSelectSlug={setSelectedSlug}
          selectedSlug={selectedSlug}
          onNavigateToCandidate={(slug) => { setSection("oppohub"); setSelectedSlug(slug); }}
        />
      );
    }

    if (section === "polling") {
      return <PollingSection />;
    }

    if (section === "messaging") {
      return <MessagingHub />;
    }

    if (section === "research-tools") {
      if (researchSubsection === "voter-data") {
        return <VoterDataSection />;
      }
      if (researchSubsection === "court-records") {
        return <CourtRecordsSearch onBack={() => setResearchSubsection(null)} />;
      }
      if (researchSubsection === "state-report") {
        return <StateReportGenerator onBack={() => setResearchSubsection(null)} />;
      }
      return (
        <ResearchToolsDashboard
          onNavigateSubsection={(sub) => setResearchSubsection(sub)}
        />
      );
    }

    if (section === "internationalhub") {
      return <InternationalHub />;
    }

    if (section === "live-elections") {
      return <LiveElectionsSection />;
    }

    if (section === "intelhub") {
      return <IntelHub />;
    }

    if (section === "reports") {
      return <ReportsHub />;
    }

    if (section === "documentation") {
      return <DocumentationSection />;
    }

  }

  const detail = renderDetail();

  return (
    <>
      {/* Desktop background */}
      <div className="flex flex-col h-screen bg-[hsl(var(--background))] pb-[50px]">
        {isMinimized ? (
          <Win98Desktop onOpenWindow={() => setIsMinimized(false)} />
        ) : (
          /* Main ORO browser window */
          <Win98Window
            title="ORO - Opposition Research Database - Sidio.us Group"
            icon={<span className="text-[14px]">🌐</span>}
            maximized
            onMinimize={() => setIsMinimized(true)}
          >
            {/* AOL Browser chrome */}
            <AOLToolbar
              onBack={selectedSlug ? () => setSelectedSlug(null) : undefined}
              onRefresh={() => window.location.reload()}
              currentSection={section}
              currentSlug={selectedSlug}
            />

            {/* Content area with sidebar (desktop) / mobile nav */}
            <div className="flex flex-1 overflow-hidden bg-white">
              {/* Desktop / tablet sidebar — hidden below md */}
              <div className="hidden md:flex">
                <AppSidebar
                  activeFilter={filter}
                  onFilterChange={setFilter}
                  counts={counts}
                  activeSection={section}
                  onSectionChange={handleSectionChange}
                  sectionCounts={sectionCounts}
                  onSyncComplete={() => {
                    fetchCandidatesFromDB().then((dbCandidates) => {
                      if (dbCandidates.length > 0) {
                        initCandidates(dbCandidates.map(c => ({ name: c.name, slug: c.slug, content: c.content })));
                        setDataVersion((v) => v + 1);
                      }
                    });
                  }}
                />
              </div>

              <main className="flex-1 overflow-y-auto bg-white">
                <div className="max-w-4xl mx-auto px-3 py-3">

                  {/* Mobile nav — visible below md */}
                  <div className="md:hidden mb-2">
                    <MobileNav
                      activeFilter={filter}
                      onFilterChange={setFilter}
                      counts={counts}
                      activeSection={section}
                      onSectionChange={handleSectionChange}
                      sectionCounts={sectionCounts}
                      onSyncComplete={() => {
                        fetchCandidatesFromDB().then((dbCandidates) => {
                          if (dbCandidates.length > 0) {
                            initCandidates(dbCandidates.map(c => ({ name: c.name, slug: c.slug, content: c.content })));
                            setDataVersion((v) => v + 1);
                          }
                        });
                      }}
                    />
                  </div>

                  {editorMode ? (
                    <CandidateEditor
                      mode={editorMode}
                      initialData={editData}
                      onBack={() => { setEditorMode(null); setEditData(undefined); }}
                      onSaved={handleEditorSaved}
                    />
                  ) : detail ? (
                    detail
                  ) : (
                    <>
                      <div className="mb-1">
                        <h2 className="text-sm font-bold mb-2">
                          📂 {sectionLabels[section]}
                        </h2>
                      </div>
                      {section === "dashboard" && (
                        <div className="mb-3">
                          <MasterSearch onNavigate={(s, slug) => { setSection(s as Section); if (slug) setSelectedSlug(slug); }} districts={districts} />
                        </div>
                      )}
                      {renderList()}
                    </>
                  )}
                </div>
              </main>
            </div>
          </Win98Window>
        )}
      </div>

      {/* News Ticker - Dashboard only */}
      {section === "dashboard" && !selectedSlug && !editorMode && <NewsTicker />}

      {/* Win98 Taskbar */}
      <Win98Taskbar
        minimizedWindow={isMinimized ? "Opposition Research Database" : undefined}
        onRestoreWindow={() => setIsMinimized(false)}
      />

      {/* AOL Buddy List */}
      <AOLBuddyList />

      {/* AOL Mail Window */}
      {isMailOpen && <AOLMailWindow onClose={closeMail} />}
    </>
  );
}
