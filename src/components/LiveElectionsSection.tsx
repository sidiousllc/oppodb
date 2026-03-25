import { useState, useCallback, useEffect } from "react";
import { Search, Loader2, Trophy, Calendar, MapPin, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
  "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
  "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

const RACE_TYPES = [
  "Governor", "US Senate", "US House", "State Senate", "State House",
  "Attorney General", "Secretary of State", "Comptroller", "Mayor",
  "State Supreme Court", "Ballot Measure",
];

const ELECTION_TYPES = ["General", "Primary", "Runoff", "Special", "Statewide", "Local"];

interface CivicCandidate {
  name: string;
  party: string;
  color: string;
  votes: number;
  percent: number;
  winner: boolean;
}

interface CivicRace {
  id: number;
  type: string;
  country: string;
  province: string;
  district: string | null;
  municipality: string | null;
  election_name: string;
  election_type: string;
  election_date: string;
  has_breakdown: boolean;
  has_map: boolean;
  percent_reporting: number;
  candidates: CivicCandidate[];
}

const PARTY_COLORS: Record<string, string> = {
  Republican: "hsl(0, 70%, 50%)",
  Democratic: "hsl(210, 70%, 50%)",
  Libertarian: "hsl(45, 80%, 50%)",
  Green: "hsl(120, 50%, 40%)",
  Independent: "hsl(270, 40%, 50%)",
};

function getPartyColor(party: string, fallback: string): string {
  return PARTY_COLORS[party] || fallback || "hsl(var(--muted-foreground))";
}

export function LiveElectionsSection() {
  const [races, setRaces] = useState<CivicRace[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedRace, setExpandedRace] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [stateFilter, setStateFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [electionTypeFilter, setElectionTypeFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [limit, setLimit] = useState(20);

  // Load races on mount
  useEffect(() => {
    fetchRaces(true);
  }, []);

  const fetchRaces = useCallback(async (isInitial = false) => {
    setLoading(true);
    if (!isInitial) setHasSearched(true);

    try {
      const params = new URLSearchParams();
      params.set("country", "US");
      params.set("limit", limit.toString());
      if (stateFilter) params.set("province", stateFilter);
      if (typeFilter) params.set("type", typeFilter);
      if (electionTypeFilter) params.set("election_type", electionTypeFilter);
      if (dateFilter) params.set("election_date", dateFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const response = await fetch(`https://civicapi.org/api/v2/race/search?${params.toString()}`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`civicAPI error: ${text.slice(0, 200)}`);
      }

      const data = await response.json();
      setRaces(data.races || []);
      setTotalCount(data.count || 0);

      if (!isInitial && (data.races || []).length === 0) {
        toast.info("No races found matching your filters");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to fetch races");
      setRaces([]);
    } finally {
      setLoading(false);
    }
  }, [stateFilter, typeFilter, electionTypeFilter, dateFilter, searchQuery, limit]);

  const handleSearch = () => fetchRaces();

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏛️</span>
          <h2 className="text-sm font-bold">Live Election Races</h2>
          <a
            href="https://civicapi.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] text-[hsl(var(--muted-foreground))] hover:underline flex items-center gap-0.5"
          >
            Powered by civicAPI <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
        {totalCount > 0 && (
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
            {totalCount} total race{totalCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="win98-sunken bg-white p-3 mb-3">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <div>
            <label className="block text-[10px] font-bold mb-1">State:</label>
            <select value={stateFilter} onChange={e => setStateFilter(e.target.value)} className="win98-input w-full">
              <option value="">All states</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold mb-1">Race Type:</label>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="win98-input w-full">
              <option value="">All types</option>
              {RACE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold mb-1">Election Type:</label>
            <select value={electionTypeFilter} onChange={e => setElectionTypeFilter(e.target.value)} className="win98-input w-full">
              <option value="">All</option>
              {ELECTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold mb-1">Date:</label>
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="win98-input w-full"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold mb-1">Search:</label>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="win98-input w-full"
              placeholder="Search races..."
              onKeyDown={e => e.key === "Enter" && handleSearch()}
            />
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button onClick={handleSearch} disabled={loading} className="win98-button text-[10px] font-bold flex items-center gap-1 disabled:opacity-50">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
            {loading ? "Loading..." : "Search Races"}
          </button>
          <select value={limit} onChange={e => setLimit(Number(e.target.value))} className="win98-input text-[10px]">
            <option value={20}>20 results</option>
            <option value={50}>50 results</option>
            <option value={100}>100 results</option>
          </select>
        </div>
      </div>

      {/* Results */}
      {loading && races.length === 0 ? (
        <div className="win98-sunken bg-white p-8 text-center text-[10px] text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin opacity-40" />
          Loading races...
        </div>
      ) : races.length > 0 ? (
        <div className="space-y-1">
          {races.map(race => {
            const isExpanded = expandedRace === race.id;
            const topTwo = [...race.candidates].sort((a, b) => b.votes - a.votes || b.percent - a.percent).slice(0, 2);
            const winner = race.candidates.find(c => c.winner);
            const dateStr = race.election_date ? new Date(race.election_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
            const isFuture = race.election_date && new Date(race.election_date) > new Date();

            return (
              <div key={race.id} className="win98-raised">
                <button
                  onClick={() => setExpandedRace(isExpanded ? null : race.id)}
                  className="w-full text-left px-2 py-1.5 flex items-center gap-2 hover:bg-[hsl(var(--win98-light))] text-[10px]"
                >
                  {isExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}

                  {/* Race name */}
                  <span className="font-bold flex-1 min-w-0 truncate">{race.election_name}</span>

                  {/* Type badge */}
                  <span className="win98-sunken px-1 py-0 text-[8px] font-bold shrink-0" style={{
                    backgroundColor: race.type.includes("House") || race.type.includes("Senate") ? "hsl(210, 50%, 92%)" :
                      race.type === "Governor" ? "hsl(45, 70%, 90%)" : "hsl(var(--win98-light))",
                    color: race.type.includes("House") || race.type.includes("Senate") ? "hsl(210, 50%, 35%)" :
                      race.type === "Governor" ? "hsl(45, 70%, 30%)" : "inherit",
                  }}>
                    {race.type}
                  </span>

                  {/* State */}
                  {race.province && (
                    <span className="text-[9px] font-bold shrink-0">{race.province}</span>
                  )}

                  {/* Date */}
                  <span className="text-[9px] text-[hsl(var(--muted-foreground))] shrink-0 flex items-center gap-0.5">
                    <Calendar className="h-2.5 w-2.5" />
                    {dateStr}
                  </span>

                  {/* Quick candidates */}
                  <div className="flex items-center gap-1 shrink-0">
                    {topTwo.map((c, i) => (
                      <span key={i} className="text-[9px] font-bold" style={{ color: getPartyColor(c.party, c.color) }}>
                        {c.name.split(" ").pop()}
                        {c.percent > 0 && ` ${c.percent}%`}
                      </span>
                    ))}
                  </div>

                  {/* Winner/Status */}
                  {winner ? (
                    <span className="flex items-center gap-0.5 text-[9px] font-bold shrink-0" style={{ color: "hsl(140, 60%, 35%)" }}>
                      <Trophy className="h-3 w-3" /> Called
                    </span>
                  ) : isFuture ? (
                    <span className="text-[9px] text-[hsl(var(--muted-foreground))] shrink-0">Upcoming</span>
                  ) : race.percent_reporting > 0 ? (
                    <span className="text-[9px] text-[hsl(var(--muted-foreground))] shrink-0">{race.percent_reporting}% in</span>
                  ) : null}
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-[hsl(var(--win98-shadow))] px-3 py-2 bg-[hsl(var(--win98-light))]">
                    <div className="grid grid-cols-2 gap-3">
                      {/* Candidates table */}
                      <div>
                        <p className="text-[9px] font-bold mb-1 border-b border-[hsl(var(--win98-shadow))] pb-0.5">Candidates</p>
                        <table className="w-full text-[10px]">
                          <thead>
                            <tr className="text-[9px] text-[hsl(var(--muted-foreground))]">
                              <th className="text-left py-0.5">Name</th>
                              <th className="text-left py-0.5">Party</th>
                              <th className="text-right py-0.5">Votes</th>
                              <th className="text-right py-0.5">%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {race.candidates.map((c, i) => (
                              <tr key={i} className={c.winner ? "font-bold" : ""}>
                                <td className="py-0.5 flex items-center gap-1">
                                  {c.winner && <Trophy className="h-3 w-3" style={{ color: "hsl(45, 80%, 45%)" }} />}
                                  {c.name}
                                </td>
                                <td className="py-0.5" style={{ color: getPartyColor(c.party, c.color) }}>
                                  {c.party}
                                </td>
                                <td className="py-0.5 text-right">{c.votes > 0 ? c.votes.toLocaleString() : "—"}</td>
                                <td className="py-0.5 text-right">{c.percent > 0 ? `${c.percent}%` : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Race info */}
                      <div>
                        <p className="text-[9px] font-bold mb-1 border-b border-[hsl(var(--win98-shadow))] pb-0.5">Race Info</p>
                        <div className="space-y-0.5 text-[10px]">
                          <div><b>Type:</b> {race.type}</div>
                          <div><b>Election Type:</b> {race.election_type}</div>
                          <div><b>Date:</b> {dateStr}</div>
                          {race.province && <div><b>State:</b> {race.province}</div>}
                          {race.district && <div><b>District:</b> {race.district}</div>}
                          {race.municipality && <div><b>Municipality:</b> {race.municipality}</div>}
                          <div><b>Reporting:</b> {race.percent_reporting}%</div>
                          {race.has_map && (
                            <a
                              href={`https://civicapi.org/results/race/${race.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-[9px] mt-1 hover:underline"
                              style={{ color: "hsl(210, 70%, 50%)" }}
                            >
                              <MapPin className="h-2.5 w-2.5" /> View results map on civicAPI
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>

                        {/* Vote bar */}
                        {race.candidates.some(c => c.percent > 0) && (
                          <div className="mt-2">
                            <p className="text-[9px] font-bold mb-0.5">Results</p>
                            <div className="h-4 flex rounded overflow-hidden win98-sunken">
                              {race.candidates
                                .filter(c => c.percent > 0)
                                .sort((a, b) => b.percent - a.percent)
                                .map((c, i) => (
                                  <div
                                    key={i}
                                    className="h-full flex items-center justify-center text-[8px] font-bold text-white"
                                    style={{
                                      width: `${c.percent}%`,
                                      backgroundColor: getPartyColor(c.party, c.color),
                                      minWidth: c.percent > 3 ? undefined : "12px",
                                    }}
                                    title={`${c.name} (${c.party}): ${c.percent}%`}
                                  >
                                    {c.percent > 8 ? `${c.percent}%` : ""}
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : hasSearched || races.length === 0 ? (
        <div className="win98-sunken bg-white p-8 text-center text-[10px] text-[hsl(var(--muted-foreground))]">
          <span className="text-3xl block mb-2">🏛️</span>
          <p className="font-bold mb-1">Live Election Results</p>
          <p>Browse real-time election races, candidates, and results from civicAPI.</p>
          <p className="mt-2 text-[9px]">Free, no API key required. Data updated every 5-10 seconds during active elections.</p>
        </div>
      ) : null}
    </div>
  );
}
