import { useState, useMemo, useEffect } from "react";
import { candidates, searchCandidates, getCandidateBySlug, getCandidatesByCategory, type Candidate } from "@/data/candidates";
import { loadCandidateData } from "@/data/candidateContent";
import { SearchBar } from "@/components/SearchBar";
import { CandidateCard } from "@/components/CandidateCard";
import { CandidateDetail } from "@/components/CandidateDetail";
import { AppSidebar, type FilterCategory } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { ChatPanel } from "@/components/ChatPanel";
import { BookOpen } from "lucide-react";

export default function Index() {
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterCategory>("all");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  useEffect(() => {
    loadCandidateData();
    setLoaded(true);
  }, []);

  const filtered = useMemo(() => {
    let results = search ? searchCandidates(search) : candidates;
    if (filter !== "all") {
      results = results.filter(c => c.category === filter);
    }
    return results;
  }, [search, filter, loaded]);

  const counts = useMemo(() => ({
    all: candidates.length,
    house: getCandidatesByCategory("house").length,
    senate: getCandidatesByCategory("senate").length,
    governor: getCandidatesByCategory("governor").length,
    state: getCandidatesByCategory("state").length,
  }), [loaded]);

  const selectedCandidate = selectedSlug ? getCandidateBySlug(selectedSlug) : null;

  if (!loaded) return null;

  return (
    <>
    <div className="flex h-screen overflow-hidden">
      <AppSidebar activeFilter={filter} onFilterChange={setFilter} counts={counts} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          {/* Mobile header */}
          <div className="lg:hidden flex items-center gap-2.5 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <BookOpen className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="font-display text-lg font-semibold">Research Books</h1>
          </div>

          {selectedCandidate ? (
            <CandidateDetail
              candidate={selectedCandidate}
              onBack={() => setSelectedSlug(null)}
            />
          ) : (
            <>
              <div className="mb-5">
                <SearchBar value={search} onChange={setSearch} />
              </div>

              <MobileNav activeFilter={filter} onFilterChange={setFilter} counts={counts} />

              <div className="mt-4 mb-2 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {filtered.length} {filtered.length === 1 ? "profile" : "profiles"}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {filtered.map(c => (
                  <CandidateCard
                    key={c.slug}
                    candidate={c}
                    onClick={setSelectedSlug}
                  />
                ))}
              </div>

              {filtered.length === 0 && (
                <div className="text-center py-16">
                  <p className="text-muted-foreground">No candidates match your search.</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
