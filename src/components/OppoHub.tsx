import { useState } from "react";
import { CandidateCard } from "@/components/CandidateCard";
import { CandidateDetail } from "@/components/CandidateDetail";
import { GenericCard } from "@/components/GenericCard";
import { GenericDetail } from "@/components/GenericDetail";
import { type Candidate, searchCandidates, getCandidateBySlug, getCandidatesByCategory, candidates } from "@/data/candidates";
import { type MagaFile, searchMagaFiles, magaFiles } from "@/data/magaFiles";
import { localImpactReports, searchLocalImpact, getLocalImpactBySlug, type LocalImpactReport } from "@/data/localImpact";
import { narrativeReports, searchNarrativeReports, type NarrativeReport } from "@/data/narrativeReports";
import { Plus, Edit3 } from "lucide-react";
import { BiasBreakdown } from "@/components/reports/BiasOverlay";
import { type FilterCategory } from "@/components/AppSidebar";

interface OppoHubProps {
  search: string;
  filter: FilterCategory;
  onFilterChange: (filter: FilterCategory) => void;
  dataVersion: number;
  isAdmin: boolean;
  onSelectSlug: (slug: string | null) => void;
  selectedSlug: string | null;
  onNavigateSlug: (slug: string) => boolean;
  onEditCandidate?: (slug: string) => void;
  onCreateCandidate?: () => void;
  onSetSection: (section: string) => void;
}

type OppoTab = "candidates" | "local-impact" | "narratives";

const categoryLabels: Record<string, string> = {
  "us-house": "U.S. House",
  "us-senate": "U.S. Senate",
  governor: "Governor",
  statewide: "Statewide",
  "state-leg": "State Leg",
  local: "Local",
  uncategorized: "Other",
};

const filters: Array<{ id: FilterCategory; label: string }> = [
  { id: "all", label: "All" },
  { id: "us-house", label: "House" },
  { id: "us-senate", label: "Senate" },
  { id: "governor", label: "Gov" },
  { id: "statewide", label: "Statewide" },
  { id: "state-leg", label: "State Leg" },
  { id: "local", label: "Local" },
  { id: "uncategorized", label: "Other" },
];

export function OppoHub({
  search, filter, dataVersion, isAdmin, onSelectSlug, selectedSlug,
  onNavigateSlug, onEditCandidate, onCreateCandidate, onSetSection,
}: OppoHubProps) {
  const [tab, setTab] = useState<OppoTab>("candidates");
  const [candidateSub, setCandidateSub] = useState<"profiles" | "maga-files">("profiles");

  const filteredCandidates = (() => {
    let results = search ? searchCandidates(search) : [...candidates];
    if (filter !== "all") results = results.filter(c => c.category === filter);
    return results;
  })();

  const filteredMaga = searchMagaFiles(search);
  const filteredLocal = searchLocalImpact(search);
  const filteredNarratives = searchNarrativeReports(search);

  // Detail views
  const selectedCandidate = selectedSlug ? getCandidateBySlug(selectedSlug) : null;
  const selectedMaga = selectedSlug ? magaFiles.find(m => m.slug === selectedSlug) : null;
  const selectedLocal = selectedSlug ? getLocalImpactBySlug(selectedSlug) : null;
  const selectedNarrative = selectedSlug ? narrativeReports.find(n => n.slug === selectedSlug) : null;

  // Handle detail rendering
  if (tab === "candidates" && selectedCandidate) {
    return (
      <CandidateDetail
        candidate={selectedCandidate}
        onBack={() => onSelectSlug(null)}
        onNavigateSlug={onNavigateSlug}
        onEdit={isAdmin ? onEditCandidate : undefined}
      />
    );
  }
  if (tab === "candidates" && candidateSub === "maga-files" && selectedMaga) {
    return (
      <GenericDetail
        icon={<div className="flex h-10 w-10 shrink-0 items-center justify-center text-2xl">⚠️</div>}
        title={selectedMaga.name}
        tag={{ label: "MAGA File", className: "bg-destructive/10 text-destructive" }}
        content={selectedMaga.content}
        sectionLabel="MAGA File"
        onBack={() => onSelectSlug(null)}
        onNavigateSlug={onNavigateSlug}
        backLabel="Back to MAGA Files"
      />
    );
  }
  if (tab === "local-impact" && selectedLocal) {
    return (
      <GenericDetail
        icon={<div className="flex h-10 w-10 shrink-0 items-center justify-center text-2xl">🌐</div>}
        title={selectedLocal.state}
        subtitle={selectedLocal.summary}
        tag={{ label: "Local Impact", className: "bg-accent/10 text-accent" }}
        content={selectedLocal.content}
        sectionLabel="Local Impact"
        onBack={() => onSelectSlug(null)}
        onNavigateSlug={onNavigateSlug}
        backLabel="Back to Local Impact"
      />
    );
  }
  if (tab === "narratives" && selectedNarrative) {
    return (
      <GenericDetail
        icon={<div className="flex h-10 w-10 shrink-0 items-center justify-center text-2xl">📄</div>}
        title={selectedNarrative.name}
        tag={{ label: "Narrative Report", className: "tag-senate" }}
        content={selectedNarrative.content}
        sectionLabel="Narrative Report"
        onBack={() => onSelectSlug(null)}
        onNavigateSlug={onNavigateSlug}
        backLabel="Back to Narrative Reports"
      />
    );
  }

  return (
    <div className="space-y-2">
      {/* Tab bar */}
      <div className="flex gap-1 flex-wrap">
        <button
          onClick={() => { setTab("candidates"); onSelectSlug(null); }}
          className={`win98-button text-[10px] ${tab === "candidates" ? "font-bold" : ""}`}
        >
          👥 Candidates ({filteredCandidates.length + filteredMaga.length})
        </button>
        <button
          onClick={() => { setTab("local-impact"); onSelectSlug(null); }}
          className={`win98-button text-[10px] ${tab === "local-impact" ? "font-bold" : ""}`}
        >
          🌐 Local Impact ({filteredLocal.length})
        </button>
        <button
          onClick={() => { setTab("narratives"); onSelectSlug(null); }}
          className={`win98-button text-[10px] ${tab === "narratives" ? "font-bold" : ""}`}
        >
          📄 Narratives ({filteredNarratives.length})
        </button>
      </div>

      {/* Candidates tab */}
      {tab === "candidates" && (
        <>
          <div className="flex gap-1 mb-1">
            <button
              onClick={() => { setCandidateSub("profiles"); onSelectSlug(null); }}
              className={`win98-button text-[10px] ${candidateSub === "profiles" ? "font-bold" : ""}`}
            >
              👥 Profiles ({filteredCandidates.length})
            </button>
            <button
              onClick={() => { setCandidateSub("maga-files"); onSelectSlug(null); }}
              className={`win98-button text-[10px] ${candidateSub === "maga-files" ? "font-bold" : ""}`}
            >
              ⚠️ MAGA Files ({filteredMaga.length})
            </button>
          </div>

          {/* Race type filter (only for profiles) */}
          {candidateSub === "profiles" && (
            <div className="flex gap-1 mb-1">
              {filters.map(f => (
                <button
                  key={f.id}
                  onClick={() => {/* filter is managed by parent */}}
                  className={`win98-button text-[9px] ${filter === f.id ? "font-bold" : ""}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {candidateSub === "maga-files" ? (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                {filteredMaga.map(m => (
                  <GenericCard
                    key={m.slug}
                    icon={<div className="flex h-8 w-8 shrink-0 items-center justify-center text-lg">⚠️</div>}
                    title={m.name}
                    tag={{ label: "MAGA File", className: "bg-destructive/10 text-destructive" }}
                    preview={m.content.split("\n").find(l => l.trim().length > 20)?.trim().slice(0, 140) || ""}
                    onClick={() => onSelectSlug(m.slug)}
                  />
                ))}
              </div>
              {filteredMaga.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))]">No MAGA files match your search.</p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                  {filteredCandidates.length} {filteredCandidates.length === 1 ? "profile" : "profiles"}
                </p>
                {isAdmin && onCreateCandidate && (
                  <button
                    onClick={onCreateCandidate}
                    className="win98-button flex items-center gap-1 text-[10px]"
                  >
                    <Plus className="h-3 w-3" />
                    Add Profile
                  </button>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {filteredCandidates.map(c => (
                  <CandidateCard
                    key={c.slug}
                    candidate={c}
                    onClick={onSelectSlug}
                    onDistrictClick={(districtId) => { onSetSection("district-intel"); onSelectSlug(districtId); }}
                  />
                ))}
              </div>
              {filteredCandidates.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))]">No candidates match your search.</p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Local Impact tab */}
      {tab === "local-impact" && (
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
                onClick={() => onSelectSlug(r.slug)}
              />
            ))}
          </div>
          {filteredLocal.length === 0 && (
            <div className="text-center py-8">
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">No state reports match your search.</p>
            </div>
          )}
        </>
      )}

      {/* Narratives tab */}
      {tab === "narratives" && (
        <>
          <div className="mt-2 mb-1 flex items-center justify-between gap-2">
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{filteredNarratives.length} narrative reports</p>
            <BiasBreakdown
              sources={filteredNarratives.map((n) => (n.content.match(/source[s]?:\s*([^\n]+)/i)?.[1] ?? "").split(/[,;]/).map((s) => s.trim()).filter(Boolean)).flat()}
              className="w-32"
            />
          </div>
          <div className="grid gap-2">
            {filteredNarratives.map(n => (
              <GenericCard
                key={n.slug}
                icon={<div className="flex h-8 w-8 shrink-0 items-center justify-center text-lg">📄</div>}
                title={n.name}
                tag={{ label: "Narrative", className: "tag-senate" }}
                preview={n.content.split("\n").find(l => l.trim().length > 20)?.trim().slice(0, 160) || ""}
                onClick={() => onSelectSlug(n.slug)}
              />
            ))}
          </div>
          {filteredNarratives.length === 0 && (
            <div className="text-center py-8">
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">No narrative reports match your search.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
