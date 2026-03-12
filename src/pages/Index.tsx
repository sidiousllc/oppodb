import { useState, useMemo, useEffect, useCallback } from "react";
import { candidates, searchCandidates, getCandidateBySlug, getCandidatesByCategory, initCandidates } from "@/data/candidates";
import { loadCandidateData } from "@/data/candidateContent";
import { magaFiles, searchMagaFiles } from "@/data/magaFiles";
import { localImpactReports, searchLocalImpact, getLocalImpactBySlug } from "@/data/localImpact";
import { narrativeReports, searchNarrativeReports } from "@/data/narrativeReports";
import { fetchCandidatesFromDB } from "@/data/githubSync";
import { fetchAllDistricts, searchDistricts, syncCensusData, type DistrictProfile } from "@/data/districtIntel";
import { SearchBar } from "@/components/SearchBar";
import { CandidateCard } from "@/components/CandidateCard";
import { CandidateDetail } from "@/components/CandidateDetail";
import { GenericCard } from "@/components/GenericCard";
import { GenericDetail } from "@/components/GenericDetail";
import { DistrictCard } from "@/components/DistrictCard";
import { DistrictDetail } from "@/components/DistrictDetail";
import { AppSidebar, type FilterCategory, type Section } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { ChatPanel } from "@/components/ChatPanel";
import { BookOpen, AlertTriangle, Globe, FileText } from "lucide-react";

export default function Index() {
  const [loaded, setLoaded] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterCategory>("all");
  const [section, setSection] = useState<Section>("candidates");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [districts, setDistricts] = useState<DistrictProfile[]>([]);
  const [censusSyncing, setCensusSyncing] = useState(false);

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

  useEffect(() => {
    setSelectedSlug(null);
    setSearch("");
  }, [section]);

  const filteredCandidates = useMemo(() => {
    let results = search ? searchCandidates(search) : candidates;
    if (filter !== "all") {
      results = results.filter(c => c.category === filter);
    }
    return results;
  }, [search, filter, dataVersion]);

  const filteredMaga = useMemo(() => searchMagaFiles(search), [search]);
  const filteredLocal = useMemo(() => searchLocalImpact(search), [search]);
  const filteredNarratives = useMemo(() => searchNarrativeReports(search), [search]);
  const filteredDistricts = useMemo(() => searchDistricts(districts, search), [search, districts]);

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
  }), [dataVersion, districts]);

  const selectedCandidate = selectedSlug ? getCandidateBySlug(selectedSlug) : null;
  const selectedMaga = selectedSlug ? magaFiles.find(m => m.slug === selectedSlug) : null;
  const selectedLocal = selectedSlug ? getLocalImpactBySlug(selectedSlug) : null;
  const selectedNarrative = selectedSlug ? narrativeReports.find(n => n.slug === selectedSlug) : null;
  const selectedDistrict = selectedSlug ? districts.find(d => d.district_id === selectedSlug) : null;

  if (!loaded) return null;

  function renderDetail() {
    if (section === "candidates" && selectedCandidate) {
      return <CandidateDetail candidate={selectedCandidate} onBack={() => setSelectedSlug(null)} />;
    }
    if (section === "maga-files" && selectedMaga) {
      return (
        <GenericDetail
          icon={<div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-destructive/10"><AlertTriangle className="h-7 w-7 text-destructive" /></div>}
          title={selectedMaga.name}
          tag={{ label: "MAGA File", className: "bg-destructive/10 text-destructive" }}
          content={selectedMaga.content}
          onBack={() => setSelectedSlug(null)}
          backLabel="Back to MAGA Files"
        />
      );
    }
    if (section === "local-impact" && selectedLocal) {
      return (
        <GenericDetail
          icon={<div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent/10"><Globe className="h-7 w-7 text-accent" /></div>}
          title={selectedLocal.state}
          subtitle={selectedLocal.summary}
          tag={{ label: "Local Impact", className: "bg-accent/10 text-accent" }}
          content={selectedLocal.content}
          onBack={() => setSelectedSlug(null)}
          backLabel="Back to Local Impact"
        />
      );
    }
    if (section === "narratives" && selectedNarrative) {
      return (
        <GenericDetail
          icon={<div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10"><FileText className="h-7 w-7 text-primary" /></div>}
          title={selectedNarrative.name}
          tag={{ label: "Narrative Report", className: "tag-senate" }}
          content={selectedNarrative.content}
          onBack={() => setSelectedSlug(null)}
          backLabel="Back to Narrative Reports"
        />
      );
    }
    if (section === "district-intel" && selectedDistrict) {
      return (
        <DistrictDetail
          district={selectedDistrict}
          onBack={() => setSelectedSlug(null)}
          onSelectCandidate={(slug) => {
            setSection("candidates");
            setSelectedSlug(slug);
          }}
        />
      );
    }
    }
    return null;
  }

  function renderList() {
    if (section === "candidates") {
      return (
        <>
          <div className="mt-4 mb-2 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {filteredCandidates.length} {filteredCandidates.length === 1 ? "profile" : "profiles"}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredCandidates.map(c => (
              <CandidateCard key={c.slug} candidate={c} onClick={setSelectedSlug} />
            ))}
          </div>
          {filteredCandidates.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No candidates match your search.</p>
            </div>
          )}
        </>
      );
    }

    if (section === "maga-files") {
      return (
        <>
          <div className="mt-4 mb-2">
            <p className="text-sm text-muted-foreground">{filteredMaga.length} appointee files</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredMaga.map(m => (
              <GenericCard
                key={m.slug}
                icon={<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10"><AlertTriangle className="h-5 w-5 text-destructive" /></div>}
                title={m.name}
                tag={{ label: "MAGA File", className: "bg-destructive/10 text-destructive" }}
                preview={m.content.split("\n").find(l => l.trim().length > 20)?.trim().slice(0, 140) || ""}
                onClick={() => setSelectedSlug(m.slug)}
              />
            ))}
          </div>
          {filteredMaga.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No MAGA files match your search.</p>
            </div>
          )}
        </>
      );
    }

    if (section === "local-impact") {
      return (
        <>
          <div className="mt-4 mb-2">
            <p className="text-sm text-muted-foreground">{filteredLocal.length} state reports</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredLocal.map(r => (
              <GenericCard
                key={r.slug}
                icon={<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10"><Globe className="h-5 w-5 text-accent" /></div>}
                title={r.state}
                preview={r.summary}
                onClick={() => setSelectedSlug(r.slug)}
              />
            ))}
          </div>
          {filteredLocal.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No state reports match your search.</p>
            </div>
          )}
        </>
      );
    }

    if (section === "narratives") {
      return (
        <>
          <div className="mt-4 mb-2">
            <p className="text-sm text-muted-foreground">{filteredNarratives.length} narrative reports</p>
          </div>
          <div className="grid gap-3">
            {filteredNarratives.map(n => (
              <GenericCard
                key={n.slug}
                icon={<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10"><FileText className="h-5 w-5 text-primary" /></div>}
                title={n.name}
                tag={{ label: "Narrative", className: "tag-senate" }}
                preview={n.content.split("\n").find(l => l.trim().length > 20)?.trim().slice(0, 160) || ""}
                onClick={() => setSelectedSlug(n.slug)}
              />
            ))}
          </div>
          {filteredNarratives.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No narrative reports match your search.</p>
            </div>
          )}
        </>
      );
    }

    if (section === "district-intel") {
      return (
        <>
          <div className="mt-4 mb-2 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{filteredDistricts.length} district profiles</p>
            <button
              onClick={handleCensusSync}
              disabled={censusSyncing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {censusSyncing ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Syncing Census Data…
                </>
              ) : (
                "Refresh from Census API"
              )}
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredDistricts.map(d => (
              <DistrictCard key={d.district_id} district={d} onClick={setSelectedSlug} />
            ))}
          </div>
          {filteredDistricts.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No districts match your search.</p>
            </div>
          )}
        </>
      );
    }
  }

  const detail = renderDetail();
  const sectionLabels: Record<Section, string> = {
    candidates: "Candidate Profiles",
    "maga-files": "MAGA Files",
    "local-impact": "Local Impact by State",
    narratives: "Narrative Reports",
    "district-intel": "District Intelligence",
  };

  return (
    <>
      <div className="flex h-screen overflow-hidden">
        <AppSidebar
          activeFilter={filter}
          onFilterChange={setFilter}
          counts={counts}
          activeSection={section}
          onSectionChange={setSection}
          sectionCounts={sectionCounts}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
            {/* Mobile header */}
            <div className="lg:hidden flex items-center gap-2.5 mb-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <BookOpen className="h-4 w-4 text-primary-foreground" />
              </div>
              <h1 className="font-display text-lg font-semibold">Opposition Research Database</h1>
            </div>

            {detail ? (
              detail
            ) : (
              <>
                <div className="mb-1">
                  <h2 className="font-display text-xl font-bold text-foreground mb-3 hidden lg:block">
                    {sectionLabels[section]}
                  </h2>
                </div>

                <div className="mb-4">
                  <SearchBar value={search} onChange={setSearch} />
                </div>

                <MobileNav
                  activeFilter={filter}
                  onFilterChange={setFilter}
                  counts={counts}
                  activeSection={section}
                  onSectionChange={setSection}
                />

                {renderList()}
              </>
            )}
          </div>
        </main>
      </div>
      <ChatPanel />
    </>
  );
}
