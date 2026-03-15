import { useState, useMemo, useEffect, useCallback } from "react";
import { candidates, searchCandidates, getCandidateBySlug, getCandidatesByCategory, initCandidates } from "@/data/candidates";
import { loadCandidateData } from "@/data/candidateContent";
import { magaFiles, searchMagaFiles } from "@/data/magaFiles";
import { localImpactReports, searchLocalImpact, getLocalImpactBySlug } from "@/data/localImpact";
import { narrativeReports, searchNarrativeReports } from "@/data/narrativeReports";
import { fetchCandidatesFromDB } from "@/data/githubSync";
import { fetchAllDistricts, searchDistricts, syncCensusData, type DistrictProfile } from "@/data/districtIntel";
import { syncCongressionalElections } from "@/data/congressionalElections";
import { fetchStateLegislativeDistricts, syncStateLegislativeData, type StateLegislativeProfile } from "@/data/stateLegislativeIntel";
import { getCookRating, getCookRatingColor, COOK_RATING_ORDER, type CookRating } from "@/data/cookRatings";
import { candidateDistrictMap } from "@/data/candidateDistricts";
import { SearchBar } from "@/components/SearchBar";
import { CandidateCard } from "@/components/CandidateCard";
import { CandidateDetail } from "@/components/CandidateDetail";
import { GenericCard } from "@/components/GenericCard";
import { GenericDetail } from "@/components/GenericDetail";
import { DistrictCard } from "@/components/DistrictCard";
import { DistrictDetail } from "@/components/DistrictDetail";
import { DistrictMap, type PVIFilter, PVI_FILTER_OPTIONS } from "@/components/DistrictMap";
import { AppSidebar, type FilterCategory, type Section } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { ChatPanel } from "@/components/ChatPanel";
import { CandidateEditor } from "@/components/CandidateEditor";
import { supabase } from "@/integrations/supabase/client";
import { DistrictCompare } from "@/components/DistrictCompare";
import { Win98Window } from "@/components/Win98Window";
import { Win98Taskbar } from "@/components/Win98Taskbar";
import { AOLToolbar } from "@/components/AOLToolbar";
import { AlertTriangle, Globe, FileText, Plus, GitCompareArrows } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { PollingSection } from "@/components/PollingSection";
import { StateLegislativeSection } from "@/components/StateLegislativeSection";

export default function Index() {
  const { isAdmin } = useIsAdmin();
  const [loaded, setLoaded] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterCategory>("all");
  const [section, setSection] = useState<Section>("candidates");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [districts, setDistricts] = useState<DistrictProfile[]>([]);
  const [stateLegDistricts, setStateLegDistricts] = useState<StateLegislativeProfile[]>([]);
  const [stateLegLoading, setStateLegLoading] = useState(true);
  const [stateLegSyncing, setStateLegSyncing] = useState(false);
  const [censusSyncing, setCensusSyncing] = useState(false);
  const [electionSyncing, setElectionSyncing] = useState(false);
  const [electionSyncProgress, setElectionSyncProgress] = useState("");
  const [trackedOnly, setTrackedOnly] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [cookFilter, setCookFilter] = useState<CookRating | "all">("all");
  const [pviFilter, setPviFilter] = useState<PVIFilter>("all");
  const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
  const [editData, setEditData] = useState<{
    id: string; name: string; slug: string; content: string;
    github_path: string; is_subpage: boolean; parent_slug: string | null; subpage_title: string | null;
  } | undefined>(undefined);

  const trackedDistrictIds = useMemo(() => new Set(
    Object.values(candidateDistrictMap)
      .map(v => v.district_id)
      .filter((id): id is string => id !== null)
  ), []);

  useEffect(() => {
    loadCandidateData();
    setLoaded(true);
    fetchCandidatesFromDB().then((dbCandidates) => {
      if (dbCandidates.length > 0) {
        initCandidates(dbCandidates.map(c => ({ name: c.name, slug: c.slug, content: c.content })));
        setDataVersion((v) => v + 1);
      }
    });
    fetchAllDistricts().then(setDistricts);
    fetchStateLegislativeDistricts().then((d) => {
      setStateLegDistricts(d);
      setStateLegLoading(false);
    }).catch(() => setStateLegLoading(false));
  }, []);

  const handleCensusSync = useCallback(async () => {
    setCensusSyncing(true);
    try {
      const result = await syncCensusData();
      if (result.success) {
        const fresh = await fetchAllDistricts();
        setDistricts(fresh);
      } else {
        console.error("Census sync failed:", result.error);
      }
    } catch (e) {
      console.error("Census sync error:", e);
    } finally {
      setCensusSyncing(false);
    }
  }, []);

  const ALL_STATES = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
    "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
    "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
  ];

  const handleBulkElectionSync = useCallback(async () => {
    setElectionSyncing(true);
    let totalUpserted = 0;
    try {
      for (let i = 0; i < ALL_STATES.length; i++) {
        const st = ALL_STATES[i];
        setElectionSyncProgress(`${st} (${i + 1}/${ALL_STATES.length})`);
        try {
          const result = await syncCongressionalElections(st);
          if (result.success) totalUpserted += result.upserted;
        } catch {
          console.warn(`Election sync failed for ${st}`);
        }
        if (i < ALL_STATES.length - 1) await new Promise(r => setTimeout(r, 500));
      }
      setElectionSyncProgress(`Done — ${totalUpserted} results synced`);
      setTimeout(() => setElectionSyncProgress(""), 4000);
    } catch (e) {
      console.error("Bulk election sync error:", e);
      setElectionSyncProgress("Error");
    } finally {
      setElectionSyncing(false);
    }
  }, []);

  const handleStateLegSync = useCallback(async (stateAbbr?: string, chamber?: string) => {
    setStateLegSyncing(true);
    try {
      const result = await syncStateLegislativeData(stateAbbr, chamber);
      if (result.success) {
        const fresh = await fetchStateLegislativeDistricts();
        setStateLegDistricts(fresh);
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
  }, []);

  const navigateBySlug = useCallback((rawSlug: string) => {
    const slug = rawSlug.trim().toLowerCase();
    if (!slug) return false;
    const candidateMatch = getCandidateBySlug(slug);
    if (candidateMatch) { setSection("candidates"); setSelectedSlug(candidateMatch.slug); return true; }
    const magaMatch = magaFiles.find(m => m.slug.toLowerCase() === slug);
    if (magaMatch) { setSection("maga-files"); setSelectedSlug(magaMatch.slug); return true; }
    const localMatch = getLocalImpactBySlug(slug);
    if (localMatch) { setSection("local-impact"); setSelectedSlug(localMatch.slug); return true; }
    const narrativeMatch = narrativeReports.find(n => n.slug.toLowerCase() === slug);
    if (narrativeMatch) { setSection("narratives"); setSelectedSlug(narrativeMatch.slug); return true; }
    const districtMatch = districts.find(d => d.district_id.toLowerCase() === slug);
    if (districtMatch) { setSection("district-intel"); setSelectedSlug(districtMatch.district_id); return true; }
    return false;
  }, [districts]);

  const filteredCandidates = useMemo(() => {
    let results = search ? searchCandidates(search) : candidates;
    if (filter !== "all") results = results.filter(c => c.category === filter);
    return results;
  }, [search, filter, dataVersion]);

  const filteredMaga = useMemo(() => searchMagaFiles(search), [search]);
  const filteredLocal = useMemo(() => searchLocalImpact(search), [search]);
  const filteredNarratives = useMemo(() => searchNarrativeReports(search), [search]);
  const filteredDistricts = useMemo(() => {
    let results = searchDistricts(districts, search);
    if (trackedOnly) results = results.filter(d => trackedDistrictIds.has(d.district_id));
    if (cookFilter !== "all") results = results.filter(d => getCookRating(d.district_id) === cookFilter);
    return results;
  }, [search, districts, trackedOnly, trackedDistrictIds, cookFilter]);

  const counts = useMemo(() => ({
    all: candidates.length,
    house: getCandidatesByCategory("house").length,
    senate: getCandidatesByCategory("senate").length,
    governor: getCandidatesByCategory("governor").length,
    state: getCandidatesByCategory("state").length,
  }), [dataVersion]);

  const sectionCounts = useMemo(() => ({
    candidates: candidates.length,
    "maga-files": magaFiles.length,
    "local-impact": localImpactReports.length,
    narratives: narrativeReports.length,
    "district-intel": districts.length,
    "state-legislative": stateLegDistricts.length,
    polling: 0,
  }), [dataVersion, districts, stateLegDistricts]);

  const selectedCandidate = selectedSlug ? getCandidateBySlug(selectedSlug) : null;
  const selectedMaga = selectedSlug ? magaFiles.find(m => m.slug === selectedSlug) : null;
  const selectedLocal = selectedSlug ? getLocalImpactBySlug(selectedSlug) : null;
  const selectedNarrative = selectedSlug ? narrativeReports.find(n => n.slug === selectedSlug) : null;
  const selectedDistrict = selectedSlug ? districts.find(d => d.district_id === selectedSlug) : null;

  if (!loaded) return null;

  const sectionLabels: Record<Section, string> = {
    candidates: "Candidate Profiles",
    "maga-files": "MAGA Files",
    "local-impact": "Local Impact by State",
    narratives: "Narrative Reports",
    "district-intel": "District Intelligence",
    "state-legislative": "State Legislative Districts",
    polling: "Polling Data",
  };

  function renderDetail() {
    if (section === "candidates" && selectedCandidate) {
      return <CandidateDetail candidate={selectedCandidate} onBack={() => setSelectedSlug(null)} onNavigateSlug={navigateBySlug} onEdit={isAdmin ? handleEditCandidate : undefined} />;
    }
    if (section === "maga-files" && selectedMaga) {
      return (
        <GenericDetail
          icon={<div className="flex h-10 w-10 shrink-0 items-center justify-center text-2xl">⚠️</div>}
          title={selectedMaga.name}
          tag={{ label: "MAGA File", className: "bg-destructive/10 text-destructive" }}
          content={selectedMaga.content}
          sectionLabel="MAGA File"
          onBack={() => setSelectedSlug(null)}
          onNavigateSlug={navigateBySlug}
          backLabel="Back to MAGA Files"
        />
      );
    }
    if (section === "local-impact" && selectedLocal) {
      return (
        <GenericDetail
          icon={<div className="flex h-10 w-10 shrink-0 items-center justify-center text-2xl">🌐</div>}
          title={selectedLocal.state}
          subtitle={selectedLocal.summary}
          tag={{ label: "Local Impact", className: "bg-accent/10 text-accent" }}
          content={selectedLocal.content}
          sectionLabel="Local Impact"
          onBack={() => setSelectedSlug(null)}
          onNavigateSlug={navigateBySlug}
          backLabel="Back to Local Impact"
        />
      );
    }
    if (section === "narratives" && selectedNarrative) {
      return (
        <GenericDetail
          icon={<div className="flex h-10 w-10 shrink-0 items-center justify-center text-2xl">📄</div>}
          title={selectedNarrative.name}
          tag={{ label: "Narrative Report", className: "tag-senate" }}
          content={selectedNarrative.content}
          sectionLabel="Narrative Report"
          onBack={() => setSelectedSlug(null)}
          onNavigateSlug={navigateBySlug}
          backLabel="Back to Narrative Reports"
        />
      );
    }
    if (section === "district-intel" && compareMode) {
      return <DistrictCompare districts={districts} onBack={() => setCompareMode(false)} />;
    }
    if (section === "district-intel" && selectedDistrict) {
      return (
        <DistrictDetail
          district={selectedDistrict}
          onBack={() => setSelectedSlug(null)}
          onSelectCandidate={(slug) => { setSection("candidates"); setSelectedSlug(slug); }}
        />
      );
    }
    return null;
  }

  function renderList() {
    if (section === "candidates") {
      return (
        <>
          <div className="mt-2 mb-1 flex items-center justify-between">
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              {filteredCandidates.length} {filteredCandidates.length === 1 ? "profile" : "profiles"}
            </p>
            {isAdmin && (
              <button
                onClick={() => { setEditorMode("create"); setEditData(undefined); }}
                className="win98-button flex items-center gap-1 text-[10px]"
              >
                <Plus className="h-3 w-3" />
                Add Profile
              </button>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {filteredCandidates.map(c => (
              <CandidateCard key={c.slug} candidate={c} onClick={setSelectedSlug} onDistrictClick={(districtId) => { setSection("district-intel"); setSelectedSlug(districtId); }} />
            ))}
          </div>
          {filteredCandidates.length === 0 && (
            <div className="text-center py-8">
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">No candidates match your search.</p>
            </div>
          )}
        </>
      );
    }

    if (section === "maga-files") {
      return (
        <>
          <div className="mt-2 mb-1">
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{filteredMaga.length} appointee files</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {filteredMaga.map(m => (
              <GenericCard
                key={m.slug}
                icon={<div className="flex h-8 w-8 shrink-0 items-center justify-center text-lg">⚠️</div>}
                title={m.name}
                tag={{ label: "MAGA File", className: "bg-destructive/10 text-destructive" }}
                preview={m.content.split("\n").find(l => l.trim().length > 20)?.trim().slice(0, 140) || ""}
                onClick={() => setSelectedSlug(m.slug)}
              />
            ))}
          </div>
          {filteredMaga.length === 0 && (
            <div className="text-center py-8">
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">No MAGA files match your search.</p>
            </div>
          )}
        </>
      );
    }

    if (section === "local-impact") {
      return (
        <>
          <div className="mt-2 mb-1">
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{filteredLocal.length} state reports</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {filteredLocal.map(r => (
              <GenericCard
                key={r.slug}
                icon={<div className="flex h-8 w-8 shrink-0 items-center justify-center text-lg">🌐</div>}
                title={r.state}
                preview={r.summary}
                onClick={() => setSelectedSlug(r.slug)}
              />
            ))}
          </div>
          {filteredLocal.length === 0 && (
            <div className="text-center py-8">
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">No state reports match your search.</p>
            </div>
          )}
        </>
      );
    }

    if (section === "narratives") {
      return (
        <>
          <div className="mt-2 mb-1">
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{filteredNarratives.length} narrative reports</p>
          </div>
          <div className="grid gap-2">
            {filteredNarratives.map(n => (
              <GenericCard
                key={n.slug}
                icon={<div className="flex h-8 w-8 shrink-0 items-center justify-center text-lg">📄</div>}
                title={n.name}
                tag={{ label: "Narrative", className: "tag-senate" }}
                preview={n.content.split("\n").find(l => l.trim().length > 20)?.trim().slice(0, 160) || ""}
                onClick={() => setSelectedSlug(n.slug)}
              />
            ))}
          </div>
          {filteredNarratives.length === 0 && (
            <div className="text-center py-8">
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">No narrative reports match your search.</p>
            </div>
          )}
        </>
      );
    }

    if (section === "district-intel") {
      return (
        <>
          <div className="mt-2 mb-1 flex flex-wrap items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{filteredDistricts.length} district profiles</p>
              <button
                onClick={() => setTrackedOnly(v => !v)}
                className={`win98-button text-[10px] flex items-center gap-1 ${trackedOnly ? "font-bold" : ""}`}
              >
                <span className={`h-2 w-2 border ${trackedOnly ? "bg-[hsl(var(--win98-titlebar))]" : ""}`} />
                Tracked only
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCompareMode(true)}
                className="win98-button text-[10px] flex items-center gap-1"
              >
                <GitCompareArrows className="h-3 w-3" />
                Compare
              </button>
              <button
                onClick={handleCensusSync}
                disabled={censusSyncing}
                className="win98-button text-[10px] flex items-center gap-1 disabled:opacity-50"
              >
                {censusSyncing ? "Syncing…" : "Census Sync"}
              </button>
              <button
                onClick={handleBulkElectionSync}
                disabled={electionSyncing}
                className="win98-button text-[10px] flex items-center gap-1 disabled:opacity-50"
              >
                {electionSyncing ? electionSyncProgress : electionSyncProgress || "Sync Elections"}
              </button>
            </div>
          </div>

          {/* Cook filter */}
          <div className="mb-2 flex flex-wrap gap-1">
            <button
              onClick={() => setCookFilter("all")}
              className={`win98-button text-[9px] px-1 py-0 ${cookFilter === "all" ? "font-bold" : ""}`}
            >
              All Ratings
            </button>
            {COOK_RATING_ORDER.map((rating) => {
              const color = getCookRatingColor(rating);
              const isActive = cookFilter === rating;
              return (
                <button
                  key={rating}
                  onClick={() => setCookFilter(isActive ? "all" : rating)}
                  className="win98-button text-[9px] px-1 py-0"
                  style={{
                    backgroundColor: isActive ? `hsl(${color})` : undefined,
                    color: isActive ? "white" : `hsl(${color})`,
                    fontWeight: isActive ? 700 : 400,
                  }}
                >
                  {rating}
                </button>
              );
            })}
          </div>

          {/* PVI filter */}
          <div className="mb-2 flex flex-wrap gap-1 items-center">
            <span className="text-[9px] font-bold mr-1">PVI:</span>
            {PVI_FILTER_OPTIONS.map((opt) => {
              const isActive = pviFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setPviFilter(isActive && opt.id !== "all" ? "all" : opt.id)}
                  className="win98-button text-[9px] px-1 py-0"
                  style={opt.color ? {
                    backgroundColor: isActive ? `hsl(${opt.color})` : undefined,
                    color: isActive ? "white" : `hsl(${opt.color})`,
                    fontWeight: isActive ? 700 : 400,
                  } : {
                    fontWeight: isActive ? 700 : 400,
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Map */}
          {districts.length > 0 && (
            <div className="mb-3 win98-sunken bg-white p-2">
              <p className="text-[11px] font-bold mb-1">Congressional District Map</p>
              <DistrictMap districts={districts} onSelectDistrict={setSelectedSlug} pviFilter={pviFilter} />
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {filteredDistricts.map(d => (
              <DistrictCard key={d.district_id} district={d} onClick={setSelectedSlug} />
            ))}
          </div>
          {filteredDistricts.length === 0 && (
            <div className="text-center py-8">
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">No districts match your search.</p>
            </div>
          )}
        </>
      );
    }

    if (section === "state-legislative") {
      return (
        <StateLegislativeSection
          districts={stateLegDistricts}
          loading={stateLegLoading}
          onSync={handleStateLegSync}
          syncing={stateLegSyncing}
        />
      );
    }

    if (section === "polling") {
      return <PollingSection />;
    }
  }

  const detail = renderDetail();

  return (
    <>
      {/* Desktop background */}
      <div className="flex flex-col h-screen bg-[hsl(var(--background))] pb-[28px]">
        {/* Main AOL browser window */}
        <Win98Window
          title="AOL - Opposition Research Database - Sidio.us Group"
          icon={<span className="text-[14px]">🌐</span>}
          maximized
        >
          {/* AOL Browser chrome */}
          <AOLToolbar
            onBack={selectedSlug ? () => setSelectedSlug(null) : undefined}
            onRefresh={() => window.location.reload()}
          />

          {/* Content area with sidebar */}
          <div className="flex flex-1 overflow-hidden bg-white">
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

            <main className="flex-1 overflow-y-auto bg-white">
              <div className="max-w-4xl mx-auto px-3 py-3">
                {/* Mobile header */}
                <div className="lg:hidden flex items-center gap-2 mb-3">
                  <span className="text-xl">📁</span>
                  <h1 className="text-sm font-bold">Opposition Research Database</h1>
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
                      <h2 className="text-sm font-bold mb-2 hidden lg:block">
                        📂 {sectionLabels[section]}
                      </h2>
                    </div>

                    <div className="mb-3">
                      <SearchBar value={search} onChange={setSearch} />
                    </div>

                    <MobileNav
                      activeFilter={filter}
                      onFilterChange={setFilter}
                      counts={counts}
                      activeSection={section}
                      onSectionChange={handleSectionChange}
                    />

                    {renderList()}
                  </>
                )}
              </div>
            </main>
          </div>
        </Win98Window>
      </div>

      {/* Win98 Taskbar */}
      <Win98Taskbar />

      {/* Chat panel */}
      <ChatPanel />
    </>
  );
}
