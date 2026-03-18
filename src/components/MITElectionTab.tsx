import { useState, useCallback, useEffect } from "react";
import { Search, Vote, Trophy, Users, Loader2, RefreshCw, Download, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
  "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
  "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

const DATASETS = [
  { id: "house", label: "U.S. House", description: "District-level returns 1976–2024" },
  { id: "senate", label: "U.S. Senate", description: "State-level returns 1976–2020" },
  { id: "president", label: "U.S. President", description: "State-level returns 1976–2020" },
  { id: "president_county", label: "President (County)", description: "County-level returns 2000–2024" },
];

const PARTY_COLORS: Record<string, string> = {
  DEMOCRAT: "hsl(210, 70%, 50%)",
  REPUBLICAN: "hsl(0, 70%, 50%)",
  LIBERTARIAN: "hsl(45, 80%, 50%)",
  GREEN: "hsl(142, 60%, 40%)",
  INDEPENDENT: "hsl(270, 40%, 50%)",
};

function getPartyColor(party: string | null): string {
  if (!party) return "hsl(var(--muted-foreground))";
  const upper = party.toUpperCase();
  for (const [key, color] of Object.entries(PARTY_COLORS)) {
    if (upper.includes(key)) return color;
  }
  return "hsl(var(--muted-foreground))";
}

interface ElectionRecord {
  year: number;
  state: string;
  state_po: string;
  office: string;
  district: string;
  candidate: string;
  party: string | null;
  candidatevotes: number | null;
  totalvotes: number | null;
  county_name?: string | null;
}

export function MITElectionTab() {
  const { session } = useAuth();
  const { isAdmin } = useUserRole();
  const [searchName, setSearchName] = useState("");
  const [searchState, setSearchState] = useState("");
  const [searchOffice, setSearchOffice] = useState("");
  const [searchYear, setSearchYear] = useState("");
  const [results, setResults] = useState<ElectionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [counts, setCounts] = useState({ house: 0, mit: 0 });
  const [expandedYear, setExpandedYear] = useState<number | null>(null);

  // Load counts on mount
  useEffect(() => {
    Promise.all([
      supabase.from("congressional_election_results").select("id", { count: "exact", head: true }).eq("source", "mit_election_lab"),
      supabase.from("mit_election_results").select("id", { count: "exact", head: true }),
    ]).then(([houseRes, mitRes]) => {
      setCounts({ house: houseRes.count || 0, mit: mitRes.count || 0 });
    });
  }, []);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      const allResults: ElectionRecord[] = [];

      // Search congressional_election_results (House data)
      if (!searchOffice || searchOffice === "US HOUSE") {
        let q = supabase
          .from("congressional_election_results")
          .select("election_year,state_abbr,district_number,candidate_name,party,votes,total_votes")
          .order("election_year", { ascending: false })
          .limit(200);
        if (searchName) q = q.ilike("candidate_name", `%${searchName}%`);
        if (searchState) q = q.eq("state_abbr", searchState);
        if (searchYear) q = q.eq("election_year", parseInt(searchYear));
        const { data } = await q;
        if (data) {
          allResults.push(...data.map((r: any) => ({
            year: r.election_year,
            state: "",
            state_po: r.state_abbr,
            office: "US HOUSE",
            district: r.district_number,
            candidate: r.candidate_name,
            party: r.party,
            candidatevotes: r.votes,
            totalvotes: r.total_votes,
          })));
        }
      }

      // Search mit_election_results (Senate, President)
      if (!searchOffice || searchOffice !== "US HOUSE") {
        let q = supabase
          .from("mit_election_results")
          .select("year,state,state_po,office,district,candidate,party,candidatevotes,totalvotes,county_name")
          .order("year", { ascending: false })
          .limit(200);
        if (searchName) q = q.ilike("candidate", `%${searchName}%`);
        if (searchState) q = q.eq("state_po", searchState);
        if (searchYear) q = q.eq("year", parseInt(searchYear));
        if (searchOffice) q = q.eq("office", searchOffice);
        const { data } = await q;
        if (data) {
          allResults.push(...(data as ElectionRecord[]));
        }
      }

      // Sort by year desc
      allResults.sort((a, b) => b.year - a.year);
      setResults(allResults);
      if (allResults.length === 0) toast.info("No results found");
    } catch (e: any) {
      toast.error(e.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }, [searchName, searchState, searchOffice, searchYear]);

  const handleSync = useCallback(async (dataset: string) => {
    if (!session?.access_token) { toast.error("Please sign in"); return; }
    setSyncing(dataset);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const params = new URLSearchParams({ dataset, min_year: "2016" });
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/mit-election-sync?${params}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Sync failed");
      toast.success(`Synced ${data.total_synced} records from ${data.dataset}`);
    } catch (e: any) {
      toast.error(e.message || "Sync failed");
    } finally {
      setSyncing(null);
    }
  }, [session]);

  // Group results by year
  const groupedByYear = results.reduce<Record<number, ElectionRecord[]>>((acc, r) => {
    (acc[r.year] = acc[r.year] || []).push(r);
    return acc;
  }, {});
  const years = Object.keys(groupedByYear).map(Number).sort((a, b) => b - a);

  return (
    <div>
      {/* Stats bar */}
      <div className="win98-sunken bg-[hsl(var(--win98-light))] px-2 py-1 mb-3 flex items-center gap-3 text-[9px] flex-wrap">
        <span className="font-bold">MIT Election Lab:</span>
        <span>{counts.house} House records</span>
        <span>•</span>
        <span>{counts.mit} Senate/President records</span>
        <a href="https://electionlab.mit.edu/data" target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-0.5 text-[hsl(var(--primary))] hover:underline">
          <ExternalLink className="h-2.5 w-2.5" /> Source
        </a>
      </div>

      {/* Admin sync controls */}
      {isAdmin && (
        <div className="win98-raised bg-[hsl(var(--win98-face))] p-2 mb-3">
          <p className="text-[9px] font-bold mb-1.5">📥 Sync from Harvard Dataverse (Admin)</p>
          <div className="flex flex-wrap gap-1.5">
            {DATASETS.map((ds) => (
              <button
                key={ds.id}
                onClick={() => handleSync(ds.id)}
                disabled={syncing !== null}
                className="win98-button text-[9px] flex items-center gap-1 disabled:opacity-50"
                title={ds.description}
              >
                {syncing === ds.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Download className="h-2.5 w-2.5" />}
                {ds.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search form */}
      <div className="win98-raised bg-white p-3 mb-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
          <div>
            <label className="text-[9px] font-bold block mb-0.5">Candidate Name</label>
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="Search name..."
              className="win98-sunken w-full px-1.5 py-1 text-[10px] bg-white"
            />
          </div>
          <div>
            <label className="text-[9px] font-bold block mb-0.5">State</label>
            <select value={searchState} onChange={(e) => setSearchState(e.target.value)} className="win98-sunken w-full px-1 py-1 text-[10px] bg-white">
              <option value="">All States</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-bold block mb-0.5">Office</label>
            <select value={searchOffice} onChange={(e) => setSearchOffice(e.target.value)} className="win98-sunken w-full px-1 py-1 text-[10px] bg-white">
              <option value="">All Offices</option>
              <option value="US HOUSE">U.S. House</option>
              <option value="US SENATE">U.S. Senate</option>
              <option value="US PRESIDENT">U.S. President</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] font-bold block mb-0.5">Year</label>
            <input
              type="number"
              value={searchYear}
              onChange={(e) => setSearchYear(e.target.value)}
              placeholder="e.g. 2024"
              className="win98-sunken w-full px-1.5 py-1 text-[10px] bg-white"
              min={1976}
              max={2024}
            />
          </div>
        </div>
        <button onClick={handleSearch} disabled={loading} className="win98-button text-[10px] font-bold flex items-center gap-1 disabled:opacity-50">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
          Search Election History
        </button>
      </div>

      {/* Results */}
      {hasSearched && !loading && results.length === 0 && (
        <div className="win98-sunken bg-white p-8 text-center text-[10px] text-[hsl(var(--muted-foreground))]">
          <span className="text-3xl block mb-2">🗳️</span>
          No election records found.{isAdmin && " Try syncing data first using the buttons above."}
        </div>
      )}

      {years.length > 0 && (
        <div className="space-y-1.5">
          {years.map((year) => {
            const yearResults = groupedByYear[year];
            const isExpanded = expandedYear === year;
            // Group by office within year
            const byOffice = yearResults.reduce<Record<string, ElectionRecord[]>>((acc, r) => {
              (acc[r.office] = acc[r.office] || []).push(r);
              return acc;
            }, {});

            return (
              <div key={year} className="win98-raised bg-white overflow-hidden">
                <button
                  onClick={() => setExpandedYear(isExpanded ? null : year)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-[hsl(var(--win98-light))]"
                >
                  {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  <Vote className="h-3 w-3" style={{ color: "hsl(var(--primary))" }} />
                  <span className="text-[11px] font-bold">{year}</span>
                  <span className="text-[9px] text-[hsl(var(--muted-foreground))] ml-1">
                    {yearResults.length} results • {Object.keys(byOffice).join(", ")}
                  </span>
                </button>
                {isExpanded && (
                  <div className="border-t border-[hsl(var(--border))] px-2 py-1.5">
                    {Object.entries(byOffice).map(([office, records]) => (
                      <div key={office} className="mb-2 last:mb-0">
                        <p className="text-[9px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">{office}</p>
                        <div className="space-y-0.5">
                          {records.slice(0, 30).map((r, i) => {
                            const pct = r.candidatevotes && r.totalvotes && r.totalvotes > 0
                              ? ((r.candidatevotes / r.totalvotes) * 100).toFixed(1)
                              : null;
                            return (
                              <div key={i} className="flex items-center gap-2 text-[10px] py-0.5 border-b border-[hsl(var(--border))]/30 last:border-0">
                                <span className="w-6 text-[9px] text-[hsl(var(--muted-foreground))]">{r.state_po}</span>
                                {r.district && r.district !== "statewide" && (
                                  <span className="text-[8px] text-[hsl(var(--muted-foreground))] w-6">D-{r.district}</span>
                                )}
                                {r.county_name && (
                                  <span className="text-[8px] text-[hsl(var(--muted-foreground))] w-16 truncate">{r.county_name}</span>
                                )}
                                <span className="font-medium flex-1 truncate">{r.candidate}</span>
                                <span className="text-[9px] font-medium shrink-0 w-16 text-right" style={{ color: getPartyColor(r.party) }}>
                                  {r.party?.substring(0, 10) || "—"}
                                </span>
                                <span className="text-[9px] w-14 text-right font-mono">
                                  {r.candidatevotes?.toLocaleString() || "—"}
                                </span>
                                {pct && (
                                  <div className="w-12 flex items-center gap-0.5">
                                    <div className="flex-1 h-1 rounded-full bg-[hsl(var(--muted))]">
                                      <div
                                        className="h-full rounded-full"
                                        style={{ width: `${Math.min(parseFloat(pct), 100)}%`, backgroundColor: getPartyColor(r.party) }}
                                      />
                                    </div>
                                    <span className="text-[8px] text-[hsl(var(--muted-foreground))]">{pct}%</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {records.length > 30 && (
                            <p className="text-[9px] text-[hsl(var(--muted-foreground))] italic pt-1">
                              +{records.length - 30} more results
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!hasSearched && (
        <div className="win98-sunken bg-white p-8 text-center text-[10px] text-[hsl(var(--muted-foreground))]">
          <span className="text-3xl block mb-2">🗳️</span>
          Search U.S. House, Senate, and Presidential election results from the MIT Election Data + Science Lab.
          <br />Data sourced from Harvard Dataverse (CC0 Public Domain).
        </div>
      )}
    </div>
  );
}
