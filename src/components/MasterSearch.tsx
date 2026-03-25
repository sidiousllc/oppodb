import { useState, useCallback, useEffect, useMemo } from "react";
import { Search, X, User, AlertTriangle, Globe, FileText, MapPin, BarChart3, DollarSign, Landmark, Scale, Loader2, Bookmark, BookmarkCheck, Clock, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { searchCandidates } from "@/data/candidates";
import { searchMagaFiles } from "@/data/magaFiles";
import { searchLocalImpact } from "@/data/localImpact";
import { searchNarrativeReports } from "@/data/narrativeReports";
import { searchDistricts, type DistrictProfile } from "@/data/districtIntel";

interface MasterSearchProps {
  onNavigate: (section: string, slug?: string) => void;
  districts: DistrictProfile[];
}

interface SearchResultGroup {
  key: string;
  label: string;
  icon: React.ReactNode;
  section: string;
  results: { id: string; title: string; subtitle?: string; slug?: string }[];
}

const STORAGE_KEY = "master-search-saved";
const RECENT_KEY = "master-search-recent";
const MAX_SAVED = 20;
const MAX_RECENT = 10;

function loadFromStorage(key: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch { return []; }
}

function saveToStorage(key: string, items: string[]) {
  localStorage.setItem(key, JSON.stringify(items));
}

export function MasterSearch({ onNavigate, districts }: MasterSearchProps) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [savedSearches, setSavedSearches] = useState<string[]>(() => loadFromStorage(STORAGE_KEY));
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadFromStorage(RECENT_KEY));
  const [dbResults, setDbResults] = useState<{
    polling: any[];
    finance: any[];
    members: any[];
    bills: any[];
    forecasts: any[];
    congressElections: any[];
  }>({ polling: [], finance: [], members: [], bills: [], forecasts: [], congressElections: [] });
  const [hasSearched, setHasSearched] = useState(false);

  const isCurrentQuerySaved = savedSearches.includes(query.trim());

  // Local/static data search (instant)
  const localResults = useMemo<SearchResultGroup[]>(() => {
    const q = query.trim();
    if (q.length < 2) return [];

    const groups: SearchResultGroup[] = [];

    const cands = searchCandidates(q).slice(0, 8);
    if (cands.length > 0) {
      groups.push({
        key: "candidates",
        label: "Candidate Profiles",
        icon: <User className="h-3.5 w-3.5" />,
        section: "candidates",
        results: cands.map(c => ({
          id: c.slug,
          title: c.name,
          subtitle: `${c.category} ${c.state ? `• ${c.state}` : ""}`,
          slug: c.slug,
        })),
      });
    }

    const dists = searchDistricts(districts, q).slice(0, 8);
    if (dists.length > 0) {
      groups.push({
        key: "districts",
        label: "Congressional Districts",
        icon: <MapPin className="h-3.5 w-3.5" />,
        section: "district-intel",
        results: dists.map(d => ({
          id: d.district_id,
          title: d.district_id,
          subtitle: `${d.state || ""} • Pop: ${d.population?.toLocaleString() ?? "N/A"} • Income: $${d.median_income?.toLocaleString() ?? "N/A"}`,
          slug: d.district_id,
        })),
      });
    }

    const maga = searchMagaFiles(q).slice(0, 6);
    if (maga.length > 0) {
      groups.push({
        key: "maga",
        label: "MAGA Files",
        icon: <AlertTriangle className="h-3.5 w-3.5" />,
        section: "maga-files",
        results: maga.map(m => ({ id: m.slug, title: m.name, slug: m.slug })),
      });
    }

    const local = searchLocalImpact(q).slice(0, 6);
    if (local.length > 0) {
      groups.push({
        key: "local",
        label: "Local Impact Reports",
        icon: <Globe className="h-3.5 w-3.5" />,
        section: "local-impact",
        results: local.map(r => ({
          id: r.slug,
          title: r.state,
          subtitle: r.summary?.slice(0, 100),
          slug: r.slug,
        })),
      });
    }

    const narr = searchNarrativeReports(q).slice(0, 6);
    if (narr.length > 0) {
      groups.push({
        key: "narratives",
        label: "Narrative Reports",
        icon: <FileText className="h-3.5 w-3.5" />,
        section: "narratives",
        results: narr.map(n => ({ id: n.slug, title: n.name, slug: n.slug })),
      });
    }

    return groups;
  }, [query, districts]);

  // DB search (triggered on Enter or button click)
  const runDbSearch = useCallback(async () => {
    const q = query.trim();
    if (q.length < 2) return;

    setIsSearching(true);
    setHasSearched(true);

    const likeQ = `%${q}%`;

    const [pollingRes, financeRes, membersRes, billsRes, forecastsRes, congressElRes] = await Promise.all([
      supabase.from("polling_data")
        .select("id, candidate_or_topic, source, poll_type, approve_pct, disapprove_pct, date_conducted")
        .or(`candidate_or_topic.ilike.${likeQ},source.ilike.${likeQ},question.ilike.${likeQ}`)
        .order("date_conducted", { ascending: false })
        .limit(10),
      supabase.from("campaign_finance")
        .select("id, candidate_name, state_abbr, district, party, total_raised, office")
        .or(`candidate_name.ilike.${likeQ},state_abbr.ilike.${likeQ},district.ilike.${likeQ}`)
        .order("total_raised", { ascending: false })
        .limit(10),
      supabase.from("congress_members")
        .select("id, name, state, district, party, chamber, bioguide_id, candidate_slug")
        .or(`name.ilike.${likeQ},state.ilike.${likeQ},bioguide_id.ilike.${likeQ}`)
        .limit(10),
      supabase.from("congress_bills")
        .select("id, bill_id, title, short_title, sponsor_name, status, latest_action_date")
        .or(`title.ilike.${likeQ},short_title.ilike.${likeQ},sponsor_name.ilike.${likeQ},bill_id.ilike.${likeQ}`)
        .order("latest_action_date", { ascending: false })
        .limit(10),
      supabase.from("election_forecasts")
        .select("id, state_abbr, district, source, rating, race_type")
        .or(`state_abbr.ilike.${likeQ},district.ilike.${likeQ},rating.ilike.${likeQ}`)
        .eq("cycle", 2026)
        .limit(10),
      supabase.from("congressional_election_results")
        .select("id, candidate_name, state_abbr, district_number, party, election_year, votes, vote_pct, is_winner")
        .or(`candidate_name.ilike.${likeQ},state_abbr.ilike.${likeQ}`)
        .order("election_year", { ascending: false })
        .limit(10),
    ]);

    setDbResults({
      polling: pollingRes.data || [],
      finance: financeRes.data || [],
      members: membersRes.data || [],
      bills: billsRes.data || [],
      forecasts: forecastsRes.data || [],
      congressElections: congressElRes.data || [],
    });
    setIsSearching(false);

    // Track recent search
    setRecentSearches(prev => {
      const updated = [q, ...prev.filter(s => s !== q)].slice(0, MAX_RECENT);
      saveToStorage(RECENT_KEY, updated);
      return updated;
    });
  }, [query]);

  const toggleBookmark = useCallback(() => {
    const q = query.trim();
    if (!q) return;
    setSavedSearches(prev => {
      const updated = prev.includes(q)
        ? prev.filter(s => s !== q)
        : [q, ...prev].slice(0, MAX_SAVED);
      saveToStorage(STORAGE_KEY, updated);
      return updated;
    });
  }, [query]);

  const removeSaved = useCallback((s: string) => {
    setSavedSearches(prev => {
      const updated = prev.filter(x => x !== s);
      saveToStorage(STORAGE_KEY, updated);
      return updated;
    });
  }, []);

  const removeRecent = useCallback((s: string) => {
    setRecentSearches(prev => {
      const updated = prev.filter(x => x !== s);
      saveToStorage(RECENT_KEY, updated);
      return updated;
    });
  }, []);

  const loadSearch = useCallback((s: string) => {
    setQuery(s);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") runDbSearch();
  }, [runDbSearch]);

  // Build DB result groups
  const dbGroups = useMemo<SearchResultGroup[]>(() => {
    const groups: SearchResultGroup[] = [];

    if (dbResults.members.length > 0) {
      groups.push({
        key: "congress-members",
        label: "Congress Members",
        icon: <Landmark className="h-3.5 w-3.5" />,
        section: "candidates",
        results: dbResults.members.map((m: any) => ({
          id: m.id,
          title: m.name,
          subtitle: `${m.party || ""} • ${m.state || ""}-${m.district || "AL"} • ${m.chamber}`,
          slug: m.candidate_slug || undefined,
        })),
      });
    }

    if (dbResults.finance.length > 0) {
      groups.push({
        key: "campaign-finance",
        label: "Campaign Finance",
        icon: <DollarSign className="h-3.5 w-3.5" />,
        section: "campaign-finance",
        results: dbResults.finance.map((f: any) => ({
          id: f.id,
          title: f.candidate_name === "Unknown" ? `${f.district || f.state_abbr}` : f.candidate_name,
          subtitle: `${f.party || ""} • ${f.state_abbr} • $${(f.total_raised || 0).toLocaleString()} raised`,
        })),
      });
    }

    if (dbResults.bills.length > 0) {
      groups.push({
        key: "legislation",
        label: "Legislation",
        icon: <Scale className="h-3.5 w-3.5" />,
        section: "legislation",
        results: dbResults.bills.map((b: any) => ({
          id: b.id,
          title: b.short_title || b.title,
          subtitle: `${b.bill_id} • ${b.sponsor_name || "Unknown sponsor"} • ${b.status || ""}`,
        })),
      });
    }

    if (dbResults.polling.length > 0) {
      groups.push({
        key: "polling",
        label: "Polling Data",
        icon: <BarChart3 className="h-3.5 w-3.5" />,
        section: "polling",
        results: dbResults.polling.map((p: any) => ({
          id: p.id,
          title: p.candidate_or_topic,
          subtitle: `${p.source} • ${p.poll_type} • ${p.date_conducted}${p.approve_pct ? ` • ${p.approve_pct}% approve` : ""}`,
        })),
      });
    }

    if (dbResults.forecasts.length > 0) {
      groups.push({
        key: "forecasts",
        label: "Election Forecasts",
        icon: <BarChart3 className="h-3.5 w-3.5" />,
        section: "district-intel",
        results: dbResults.forecasts.map((f: any) => ({
          id: f.id,
          title: `${f.state_abbr}-${(f.district || "AL").padStart(2, "0")}`,
          subtitle: `${f.source} • ${f.rating} • ${f.race_type}`,
          slug: `${f.state_abbr}-${(f.district || "AL").padStart(2, "0")}`,
        })),
      });
    }

    if (dbResults.congressElections.length > 0) {
      groups.push({
        key: "election-results",
        label: "Election Results",
        icon: <Landmark className="h-3.5 w-3.5" />,
        section: "live-elections",
        results: dbResults.congressElections.map((e: any) => ({
          id: e.id,
          title: e.candidate_name,
          subtitle: `${e.state_abbr}-${e.district_number} • ${e.party || ""} • ${e.election_year}${e.is_winner ? " ✓ Winner" : ""} • ${e.vote_pct ? `${e.vote_pct}%` : ""}`,
        })),
      });
    }

    return groups;
  }, [dbResults]);

  const allGroups = [...localResults, ...dbGroups];
  const totalResults = allGroups.reduce((s, g) => s + g.results.length, 0);

  const handleClear = () => {
    setQuery("");
    setDbResults({ polling: [], finance: [], members: [], bills: [], forecasts: [], congressElections: [] });
    setHasSearched(false);
  };

  return (
    <div className="win98-raised bg-[hsl(var(--win98-face))] p-3">
      <div className="flex items-center gap-2 mb-3">
        <Search className="h-4 w-4" />
        <h2 className="text-sm font-bold">🔍 Master Search</h2>
        <span className="text-[9px] text-[hsl(var(--muted-foreground))]">
          Search across all databases & research tools
        </span>
      </div>

      <div className="win98-sunken bg-white p-2 mb-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="win98-input w-full pl-7 pr-7"
              placeholder="Search candidates, districts, bills, finance, polling, elections..."
              maxLength={500}
            />
            {query && (
              <button
                onClick={handleClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={runDbSearch}
            disabled={isSearching || query.trim().length < 2}
            className="win98-button text-[10px] font-bold flex items-center gap-1 px-3"
          >
            {isSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
            Search All
          </button>
        </div>
        <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-1">
          Type to see instant results • Press Enter or click "Search All" to query databases (polling, finance, legislation, congress members, elections)
        </p>
      </div>

      {/* Results */}
      {query.trim().length >= 2 && (
        <div className="space-y-2">
          {/* Summary bar */}
          <div className="flex items-center gap-2 text-[10px]">
            <span className="font-bold">{totalResults} results</span>
            {hasSearched && (
              <span className="text-[hsl(var(--muted-foreground))]">
                • {allGroups.length} categories searched
              </span>
            )}
            {isSearching && (
              <span className="text-[hsl(var(--muted-foreground))] flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Searching databases...
              </span>
            )}
          </div>

          {totalResults === 0 && !isSearching && (
            <div className="win98-sunken bg-white p-4 text-center text-[11px] text-[hsl(var(--muted-foreground))]">
              No results found for "{query}". Try a different search term or press Enter to search databases.
            </div>
          )}

          {/* Result groups */}
          <div className="grid gap-2 sm:grid-cols-2">
            {allGroups.map((group) => (
              <div key={group.key} className="candidate-card">
                <div className="flex items-center gap-1.5 mb-2 pb-1 border-b border-b-[hsl(var(--win98-shadow))]">
                  <span className="text-[hsl(var(--muted-foreground))]">{group.icon}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider">{group.label}</span>
                  <span className="text-[9px] text-[hsl(var(--muted-foreground))] ml-auto">{group.results.length}</span>
                </div>
                <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
                  {group.results.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => onNavigate(group.section, r.slug)}
                      className="w-full text-left px-1.5 py-1 text-[10px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white rounded-sm transition-colors flex flex-col"
                    >
                      <span className="font-medium truncate">{r.title}</span>
                      {r.subtitle && (
                        <span className="text-[9px] opacity-70 truncate">{r.subtitle}</span>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => onNavigate(group.section)}
                  className="mt-1.5 text-[9px] text-[hsl(var(--win98-titlebar))] hover:underline"
                >
                  View all in {group.label} →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
