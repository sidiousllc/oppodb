import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Users, MapPin, Building2, ChevronDown, ChevronRight, AlertTriangle, Loader2, DollarSign, Trophy, Calendar, ExternalLink, Vote } from "lucide-react";
import { toast } from "sonner";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
  "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
  "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

import { MITElectionTab } from "@/components/MITElectionTab";

type SearchType = "name" | "address" | "district" | "races" | "election_history";

interface VoterRecord {
  source: string;
  first_name: string;
  last_name: string;
  full_name: string;
  state: string;
  city: string;
  zip: string;
  address: string;
  county: string;
  party: string;
  registration_date: string;
  registration_status: string;
  voter_id: string;
  age: number | null;
  gender: string;
  race_ethnicity: string;
  phone: string;
  email: string;
  congressional_district: string;
  state_house_district: string;
  state_senate_district: string;
  vote_history: Array<{ election: string; voted: boolean; method?: string }>;
  tags: string[];
  employer?: string;
  occupation?: string;
  contributions?: Array<{ amount: number; date: string; committee: string }>;
  total_contributed?: number;
  representatives?: Array<{ name: string; office: string; party: string; phones?: string[]; urls?: string[] }>;
}

interface SearchSources {
  fec: boolean;
  google_civic: boolean;
  open_states: boolean;
  nationbuilder: boolean;
  van: boolean;
}

const PARTY_COLORS: Record<string, string> = {
  D: "hsl(210, 70%, 50%)",
  R: "hsl(0, 70%, 50%)",
  Democrat: "hsl(210, 70%, 50%)",
  Republican: "hsl(0, 70%, 50%)",
  DEM: "hsl(210, 70%, 50%)",
  REP: "hsl(0, 70%, 50%)",
  I: "hsl(270, 40%, 50%)",
  Independent: "hsl(270, 40%, 50%)",
  NPA: "hsl(0, 0%, 50%)",
  U: "hsl(0, 0%, 50%)",
};

const SOURCE_COLORS: Record<string, string> = {
  "FEC": "hsl(45, 80%, 88%)",
  "Google Civic": "hsl(210, 60%, 90%)",
  "Open States": "hsl(160, 50%, 88%)",
  "NationBuilder": "hsl(210, 60%, 90%)",
  "VAN": "hsl(140, 50%, 90%)",
};

function getPartyColor(party: string): string {
  return PARTY_COLORS[party] || "hsl(var(--muted-foreground))";
}

export function VoterDataSection() {
  const [searchType, setSearchType] = useState<SearchType>("name");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [state, setState] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [district, setDistrict] = useState("");
  const [districtType, setDistrictType] = useState<"congressional" | "state_house" | "state_senate">("congressional");
  const [results, setResults] = useState<VoterRecord[]>([]);
  const [sources, setSources] = useState<SearchSources | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedVoter, setExpandedVoter] = useState<string | null>(null);

  // Live Races state
  const [raceState, setRaceState] = useState("");
  const [raceType, setRaceType] = useState("");
  const [raceDate, setRaceDate] = useState("");
  const [raceResults, setRaceResults] = useState<any[]>([]);
  const [raceLoading, setRaceLoading] = useState(false);
  const [raceSearched, setRaceSearched] = useState(false);
  const [expandedRace, setExpandedRace] = useState<number | null>(null);

  const handleRaceSearch = useCallback(async () => {
    setRaceLoading(true);
    setRaceSearched(true);
    try {
      const params = new URLSearchParams();
      params.set("country", "US");
      params.set("limit", "20");
      if (raceState) params.set("province", raceState);
      if (raceType) params.set("type", raceType);
      if (raceDate) params.set("election_date", raceDate);
      if (!raceState && !raceType && !raceDate) params.set("election_date", "2026-11-03");

      const response = await fetch(`https://civicapi.org/api/v2/race/search?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch races");
      const data = await response.json();
      setRaceResults(data.races || []);
      if ((data.races || []).length === 0) toast.info("No races found");
    } catch (e: any) {
      toast.error(e.message);
      setRaceResults([]);
    } finally {
      setRaceLoading(false);
    }
  }, [raceState, raceType, raceDate]);

  const handleSearch = useCallback(async () => {
    if (searchType === "name" && !lastName.trim()) {
      toast.error("Last name is required"); return;
    }
    if (searchType === "address" && !state) {
      toast.error("State is required for address search"); return;
    }
    if (searchType === "district" && (!state || !district.trim())) {
      toast.error("State and district number are required"); return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please log in"); setLoading(false); return; }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voter-lookup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            search_type: searchType,
            first_name: firstName.trim() || undefined,
            last_name: lastName.trim() || undefined,
            state: state || undefined,
            address: address.trim() || undefined,
            city: city.trim() || undefined,
            zip: zip.trim() || undefined,
            district: district.trim() || undefined,
            district_type: districtType,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search failed");

      setResults(data.results || []);
      setSources(data.sources || null);
      setErrors(data.errors || []);

      if (data.results?.length === 0 && (!data.errors || data.errors.length === 0)) {
        toast.info("No voters found matching your search");
      }
    } catch (e: any) {
      toast.error(e.message || "Search failed");
      setErrors([e.message]);
    } finally {
      setLoading(false);
    }
  }, [searchType, firstName, lastName, state, address, city, zip, district, districtType]);

  const searchTabs: Array<{ id: SearchType; label: string; icon: typeof Search }> = [
    { id: "name", label: "Name + State", icon: Users },
    { id: "address", label: "Address", icon: MapPin },
    { id: "district", label: "District", icon: Building2 },
    { id: "races", label: "Live Races", icon: Trophy },
    { id: "election_history", label: "Election History", icon: Vote },
  ];

  return (
    <div>
      {/* Source status */}
      {sources && (
        <div className="win98-sunken bg-[hsl(var(--win98-light))] px-2 py-1 mb-3 flex items-center gap-3 text-[9px] flex-wrap">
          <span className="font-bold">Data Sources:</span>
          <span style={{ color: "hsl(140, 60%, 30%)" }}>✓ FEC</span>
          <span style={{ color: sources.google_civic ? "hsl(140, 60%, 30%)" : "hsl(0, 0%, 55%)" }}>
            {sources.google_civic ? "✓" : "○"} Google Civic
          </span>
          <span style={{ color: sources.open_states ? "hsl(140, 60%, 30%)" : "hsl(0, 0%, 55%)" }}>
            {sources.open_states ? "✓" : "○"} Open States
          </span>
          <span style={{ color: sources.nationbuilder ? "hsl(140, 60%, 30%)" : "hsl(0, 0%, 55%)" }}>
            {sources.nationbuilder ? "✓" : "○"} NationBuilder
          </span>
          <span style={{ color: sources.van ? "hsl(140, 60%, 30%)" : "hsl(0, 0%, 55%)" }}>
            {sources.van ? "✓" : "○"} VAN
          </span>
        </div>
      )}

      {/* Optional API setup notice */}
      {errors.length > 0 && errors.some(e => e.includes('Not configured')) && (
        <div className="win98-raised bg-[hsl(var(--win98-face))] p-3 mb-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "hsl(40, 90%, 45%)" }} />
            <div className="text-[10px]">
              <p className="font-bold mb-1">Optional: Additional Data Sources</p>
              <p className="text-[hsl(var(--muted-foreground))] mb-1">
                FEC data is always available. Add API keys for more sources:
              </p>
              <div className="space-y-1 text-[9px] text-[hsl(var(--muted-foreground))]">
                <p>🔑 <code className="bg-[hsl(var(--win98-light))] px-1">GOOGLE_CIVIC_API_KEY</code> — Free from Google Cloud Console (address → district/rep lookup)</p>
                <p>🔑 <code className="bg-[hsl(var(--win98-light))] px-1">OPENSTATES_API_KEY</code> — Free from openstates.org (state legislator data)</p>
                <p>🔑 <code className="bg-[hsl(var(--win98-light))] px-1">FEC_API_KEY</code> — Free from api.open.fec.gov (higher rate limits)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search type tabs */}
      <div className="flex gap-0 mb-2">
        {searchTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setSearchType(t.id)}
            className={`win98-button text-[10px] flex items-center gap-1 ${
              searchType === t.id ? "font-bold bg-white" : ""
            }`}
            style={searchType === t.id ? { borderBottomColor: "white", marginBottom: "-1px", position: "relative", zIndex: 1 } : {}}
          >
            <t.icon className="h-3 w-3" />
            {t.label}
          </button>
        ))}
      </div>

      {searchType !== "election_history" && <>
      {/* Search form */}
      <div className="win98-sunken bg-white p-3 mb-3">
        {searchType === "name" && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-bold mb-1">First Name:</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} className="win98-input w-full" placeholder="Optional" maxLength={100} />
            </div>
            <div>
              <label className="block text-[10px] font-bold mb-1">Last Name: *</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} className="win98-input w-full" placeholder="Required" maxLength={100} />
            </div>
            <div>
              <label className="block text-[10px] font-bold mb-1">State:</label>
              <select value={state} onChange={e => setState(e.target.value)} className="win98-input w-full">
                <option value="">Any state</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        )}

        {searchType === "address" && (
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="block text-[10px] font-bold mb-1">Street Address:</label>
              <input value={address} onChange={e => setAddress(e.target.value)} className="win98-input w-full" placeholder="123 Main St" maxLength={200} />
            </div>
            <div>
              <label className="block text-[10px] font-bold mb-1">City:</label>
              <input value={city} onChange={e => setCity(e.target.value)} className="win98-input w-full" placeholder="City" maxLength={100} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold mb-1">State: *</label>
                <select value={state} onChange={e => setState(e.target.value)} className="win98-input w-full">
                  <option value="">Select...</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold mb-1">ZIP:</label>
                <input value={zip} onChange={e => setZip(e.target.value)} className="win98-input w-full" placeholder="ZIP" maxLength={10} />
              </div>
            </div>
          </div>
        )}

        {searchType === "district" && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-bold mb-1">State: *</label>
              <select value={state} onChange={e => setState(e.target.value)} className="win98-input w-full">
                <option value="">Select...</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold mb-1">District Type:</label>
              <select value={districtType} onChange={e => setDistrictType(e.target.value as any)} className="win98-input w-full">
                <option value="congressional">Congressional</option>
                <option value="state_house">State House</option>
                <option value="state_senate">State Senate</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold mb-1">District #: *</label>
              <input value={district} onChange={e => setDistrict(e.target.value)} className="win98-input w-full" placeholder="e.g. 12" maxLength={10} />
            </div>
          </div>
        )}

        {searchType === "races" && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-bold mb-1">State:</label>
              <select value={raceState} onChange={e => setRaceState(e.target.value)} className="win98-input w-full">
                <option value="">All states</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold mb-1">Race Type:</label>
              <select value={raceType} onChange={e => setRaceType(e.target.value)} className="win98-input w-full">
                <option value="">All types</option>
                {["Governor","US Senate","US House","State Senate","State House","Attorney General","Mayor","Ballot Measure"].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold mb-1">Election Date:</label>
              <input type="date" value={raceDate} onChange={e => setRaceDate(e.target.value)} className="win98-input w-full" />
            </div>
          </div>
        )}

        <div className="mt-2 flex items-center gap-2">
          {searchType === "races" ? (
            <>
              <button onClick={handleRaceSearch} disabled={raceLoading} className="win98-button text-[10px] font-bold flex items-center gap-1 disabled:opacity-50">
                {raceLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                {raceLoading ? "Loading..." : "Search Races"}
              </button>
              <span className="text-[9px] text-[hsl(var(--muted-foreground))]">
                Powered by <a href="https://civicapi.org" target="_blank" rel="noopener noreferrer" className="underline">civicAPI</a> — free, no key required
              </span>
            </>
          ) : (
            <>
              <button onClick={handleSearch} disabled={loading} className="win98-button text-[10px] font-bold flex items-center gap-1 disabled:opacity-50">
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                {loading ? "Searching..." : "Search Voters"}
              </button>
              <span className="text-[9px] text-[hsl(var(--muted-foreground))]">
                Searches FEC contributions{sources?.google_civic ? ", Google Civic" : ""}{sources?.open_states ? ", Open States" : ""}{sources?.nationbuilder ? ", NationBuilder" : ""}{sources?.van ? ", VAN" : ""} simultaneously
              </span>
            </>
          )}
        </div>
      </div>

      {/* Races Results */}
      {searchType === "races" && raceSearched && !raceLoading && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
              {raceResults.length} race{raceResults.length !== 1 ? "s" : ""} found
            </span>
          </div>
          {raceResults.length > 0 ? (
            <div className="space-y-1">
              {raceResults.map((race: any) => {
                const isExp = expandedRace === race.id;
                const winner = (race.candidates || []).find((c: any) => c.winner);
                const dateStr = race.election_date ? new Date(race.election_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
                const topTwo = [...(race.candidates || [])].sort((a: any, b: any) => b.votes - a.votes).slice(0, 2);
                return (
                  <div key={race.id} className="win98-raised">
                    <button
                      onClick={() => setExpandedRace(isExp ? null : race.id)}
                      className="w-full text-left px-2 py-1 flex items-center gap-2 hover:bg-[hsl(var(--win98-light))] text-[10px]"
                    >
                      {isExp ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                      <span className="font-bold flex-1 truncate">{race.election_name}</span>
                      <span className="win98-sunken px-1 py-0 text-[8px] font-bold shrink-0">{race.type}</span>
                      {race.province && <span className="text-[9px] font-bold shrink-0">{race.province}</span>}
                      <span className="text-[9px] text-[hsl(var(--muted-foreground))] shrink-0">{dateStr}</span>
                      {topTwo.map((c: any, i: number) => (
                        <span key={i} className="text-[9px] font-bold shrink-0" style={{ color: c.color || "inherit" }}>
                          {c.name.split(" ").pop()}{c.percent > 0 ? ` ${c.percent}%` : ""}
                        </span>
                      ))}
                      {winner && <Trophy className="h-3 w-3 shrink-0" style={{ color: "hsl(45, 80%, 45%)" }} />}
                    </button>
                    {isExp && (
                      <div className="border-t border-[hsl(var(--win98-shadow))] px-3 py-2 bg-[hsl(var(--win98-light))]">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[9px] font-bold mb-1 border-b border-[hsl(var(--win98-shadow))] pb-0.5">Candidates</p>
                            <table className="w-full text-[10px]">
                              <tbody>
                                {(race.candidates || []).map((c: any, i: number) => (
                                  <tr key={i} className={c.winner ? "font-bold" : ""}>
                                    <td className="py-0.5">{c.winner && <Trophy className="h-3 w-3 inline mr-1" style={{ color: "hsl(45, 80%, 45%)" }} />}{c.name}</td>
                                    <td className="py-0.5" style={{ color: c.color }}>{c.party}</td>
                                    <td className="py-0.5 text-right">{c.votes > 0 ? c.votes.toLocaleString() : "—"}</td>
                                    <td className="py-0.5 text-right">{c.percent > 0 ? `${c.percent}%` : "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="text-[10px] space-y-0.5">
                            <div><b>Type:</b> {race.type} • {race.election_type}</div>
                            <div><b>Date:</b> {dateStr}</div>
                            {race.district && <div><b>District:</b> {race.district}</div>}
                            <div><b>Reporting:</b> {race.percent_reporting}%</div>
                            {race.has_map && (
                              <a href={`https://civicapi.org/results/race/${race.id}`} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-[9px] mt-1 hover:underline" style={{ color: "hsl(210, 70%, 50%)" }}>
                                <ExternalLink className="h-2.5 w-2.5" /> View on civicAPI
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="win98-sunken bg-white p-6 text-center text-[10px] text-[hsl(var(--muted-foreground))]">
              No races found matching your filters.
            </div>
          )}
        </div>
      )}

      {/* Voter Results */}
      {searchType !== "races" && hasSearched && !loading && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
              {results.length} result{results.length !== 1 ? "s" : ""} found
            </span>
            {results.length > 0 && (
              <div className="flex gap-1 text-[9px]">
                {Array.from(new Set(results.map(r => r.source))).map(src => (
                  <span key={src} className="win98-raised px-1 py-0 text-[8px] font-bold" style={{
                    backgroundColor: SOURCE_COLORS[src] || "hsl(var(--win98-light))",
                  }}>
                    {src}
                  </span>
                ))}
              </div>
            )}
          </div>

          {results.length > 0 ? (
            <div className="win98-sunken bg-white">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-[hsl(var(--win98-face))] border-b border-[hsl(var(--win98-shadow))]">
                    <th className="text-left px-2 py-1 font-bold w-5"></th>
                    <th className="text-left px-2 py-1 font-bold">Name</th>
                    <th className="text-left px-2 py-1 font-bold">Party</th>
                    <th className="text-left px-2 py-1 font-bold">Location</th>
                    <th className="text-left px-2 py-1 font-bold">Status</th>
                    <th className="text-left px-2 py-1 font-bold">Districts</th>
                    <th className="text-left px-2 py-1 font-bold">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((v, i) => {
                    const key = `${v.source}-${v.voter_id || v.full_name}-${i}`;
                    const isExpanded = expandedVoter === key;
                    return (
                      <>
                        <tr
                          key={key}
                          onClick={() => setExpandedVoter(isExpanded ? null : key)}
                          className="border-b border-[hsl(var(--win98-light))] hover:bg-[hsl(var(--win98-light))] cursor-pointer"
                        >
                          <td className="px-1 py-1">
                            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          </td>
                          <td className="px-2 py-1">
                            <span className="font-bold">{v.full_name}</span>
                            {v.age && <span className="text-[9px] text-[hsl(var(--muted-foreground))] ml-1">({v.age})</span>}
                            {v.employer && (
                              <span className="text-[8px] text-[hsl(var(--muted-foreground))] block">{v.occupation} @ {v.employer}</span>
                            )}
                          </td>
                          <td className="px-2 py-1">
                            <span className="font-bold" style={{ color: getPartyColor(v.party) }}>
                              {v.party || "—"}
                            </span>
                          </td>
                          <td className="px-2 py-1">
                            {[v.city, v.state].filter(Boolean).join(", ") || "—"}
                            {v.zip && <span className="text-[9px] text-[hsl(var(--muted-foreground))] ml-1">{v.zip}</span>}
                          </td>
                          <td className="px-2 py-1">
                            <span className="text-[9px] font-bold px-1 py-0 win98-sunken" style={{
                              color: v.registration_status === "Active" ? "hsl(140, 60%, 30%)"
                                : v.registration_status === "Donor" ? "hsl(45, 80%, 35%)"
                                : v.registration_status === "Legislator" ? "hsl(270, 50%, 40%)"
                                : v.registration_status === "Address Info" ? "hsl(210, 50%, 40%)"
                                : "hsl(0, 70%, 45%)",
                              backgroundColor: v.registration_status === "Active" ? "hsl(140, 50%, 90%)"
                                : v.registration_status === "Donor" ? "hsl(45, 80%, 92%)"
                                : v.registration_status === "Legislator" ? "hsl(270, 40%, 92%)"
                                : v.registration_status === "Address Info" ? "hsl(210, 50%, 92%)"
                                : "hsl(0, 70%, 92%)",
                            }}>
                              {v.registration_status}
                            </span>
                            {v.total_contributed != null && v.total_contributed > 0 && (
                              <span className="text-[8px] text-[hsl(var(--muted-foreground))] ml-1">
                                ${v.total_contributed.toLocaleString()}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1 text-[9px]">
                            {v.congressional_district && <span className="mr-1">CD-{v.congressional_district}</span>}
                            {v.state_house_district && <span className="mr-1">HD-{v.state_house_district}</span>}
                            {v.state_senate_district && <span>SD-{v.state_senate_district}</span>}
                            {!v.congressional_district && !v.state_house_district && !v.state_senate_district && "—"}
                          </td>
                          <td className="px-2 py-1">
                            <span className="text-[8px] font-bold px-1 py-0 win98-raised" style={{
                              backgroundColor: SOURCE_COLORS[v.source] || "hsl(var(--win98-light))",
                            }}>
                              {v.source}
                            </span>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${key}-detail`} className="bg-[hsl(var(--win98-light))]">
                            <td colSpan={7} className="px-3 py-2">
                              <VoterDetailPanel voter={v} />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="win98-sunken bg-white p-8 text-center text-[10px] text-[hsl(var(--muted-foreground))]">
              <Users className="h-6 w-6 mx-auto mb-2 opacity-40" />
              No results found matching your search criteria.
            </div>
          )}
        </div>
      )}

      {/* Empty state before search */}
      {searchType !== "races" && !hasSearched && (
        <div className="win98-sunken bg-white p-8 text-center text-[10px] text-[hsl(var(--muted-foreground))]">
          <span className="text-3xl block mb-2">🗳️</span>
          <p className="font-bold mb-1">Voter Data Lookup</p>
          <p>Search for voters, donors, and representatives by name, address, or district.</p>
          <p className="mt-2 text-[9px]">
            <b>Free sources:</b> FEC Individual Contributions (always available)
          </p>
          <p className="text-[9px]">
            <b>Optional:</b> Google Civic API, Open States, NationBuilder, VAN
          </p>
          <p className="text-[9px] mt-1">
            <b>New:</b> 🏛️ Live Races tab — real-time election results from civicAPI
          </p>
        </div>
      )}
      {searchType === "races" && !raceSearched && (
        <div className="win98-sunken bg-white p-8 text-center text-[10px] text-[hsl(var(--muted-foreground))]">
          <span className="text-3xl block mb-2">🏛️</span>
          <p className="font-bold mb-1">Live Election Races</p>
          <p>Search real-time election results, candidates, and race calls.</p>
          <p className="mt-2 text-[9px]">
            Powered by <a href="https://civicapi.org" target="_blank" rel="noopener noreferrer" className="underline">civicAPI</a> — free, no key required
          </p>
        </div>
      )}
      </>}

      {/* Election History tab */}
      {searchType === "election_history" && <MITElectionTab />}
    </div>
  );
}

function VoterDetailPanel({ voter: v }: { voter: VoterRecord }) {
  return (
    <div className="grid grid-cols-3 gap-3 text-[10px]">
      {/* Personal Info */}
      <div className="win98-sunken bg-white p-2">
        <p className="font-bold mb-1 text-[9px] border-b border-[hsl(var(--win98-shadow))] pb-0.5">Personal Info</p>
        <div className="space-y-0.5">
          <div><b>Name:</b> {v.full_name}</div>
          {v.age && <div><b>Age:</b> {v.age}</div>}
          {v.gender && <div><b>Gender:</b> {v.gender}</div>}
          {v.race_ethnicity && <div><b>Race/Ethnicity:</b> {v.race_ethnicity}</div>}
          {v.voter_id && <div><b>Voter ID:</b> {v.voter_id}</div>}
          {v.employer && <div><b>Employer:</b> {v.employer}</div>}
          {v.occupation && <div><b>Occupation:</b> {v.occupation}</div>}
        </div>
      </div>

      {/* Registration, Contact & Finance */}
      <div className="win98-sunken bg-white p-2">
        <p className="font-bold mb-1 text-[9px] border-b border-[hsl(var(--win98-shadow))] pb-0.5">Registration & Contact</p>
        <div className="space-y-0.5">
          <div><b>Party:</b> <span style={{ color: getPartyColor(v.party) }}>{v.party || "Unknown"}</span></div>
          <div><b>Status:</b> {v.registration_status}</div>
          {v.registration_date && <div><b>Registered:</b> {v.registration_date}</div>}
          {v.address && <div><b>Address:</b> {v.address}</div>}
          {v.city && <div><b>City:</b> {v.city}, {v.state} {v.zip}</div>}
          {v.county && <div><b>County:</b> {v.county}</div>}
          {v.phone && <div><b>Phone:</b> {v.phone}</div>}
          {v.email && <div><b>Email:</b> {v.email}</div>}
          {v.total_contributed != null && v.total_contributed > 0 && (
            <div className="mt-1 pt-1 border-t border-[hsl(var(--win98-shadow))]">
              <b>💰 Total Contributed:</b> <span className="font-bold" style={{ color: "hsl(140, 50%, 35%)" }}>${v.total_contributed.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Districts, Contributions & Representatives */}
      <div className="win98-sunken bg-white p-2">
        <p className="font-bold mb-1 text-[9px] border-b border-[hsl(var(--win98-shadow))] pb-0.5">Districts & Details</p>
        <div className="space-y-0.5">
          {v.congressional_district && <div><b>Congressional:</b> CD-{v.congressional_district}</div>}
          {v.state_house_district && <div><b>State House:</b> HD-{v.state_house_district}</div>}
          {v.state_senate_district && <div><b>State Senate:</b> SD-{v.state_senate_district}</div>}

          {/* FEC Contributions */}
          {v.contributions && v.contributions.length > 0 && (
            <div className="mt-1">
              <b>Recent Contributions:</b>
              <div className="max-h-[100px] overflow-y-auto mt-0.5">
                {v.contributions.slice(0, 10).map((c, i) => (
                  <div key={i} className="text-[9px] flex items-center gap-1">
                    <DollarSign className="h-2.5 w-2.5" style={{ color: "hsl(140, 50%, 40%)" }} />
                    <span className="font-bold">${c.amount.toLocaleString()}</span>
                    <span className="text-[hsl(var(--muted-foreground))]">→ {c.committee}</span>
                    {c.date && <span className="text-[hsl(var(--muted-foreground))]">({c.date})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Representatives (from Civic API) */}
          {v.representatives && v.representatives.length > 0 && (
            <div className="mt-1">
              <b>Your Representatives:</b>
              <div className="max-h-[120px] overflow-y-auto mt-0.5">
                {v.representatives.map((rep, i) => (
                  <div key={i} className="text-[9px] mb-1">
                    <span className="font-bold">{rep.name}</span>
                    <span className="text-[hsl(var(--muted-foreground))]"> — {rep.office}</span>
                    {rep.party && (
                      <span className="ml-1 font-bold" style={{ color: getPartyColor(rep.party) }}>
                        ({rep.party})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vote History */}
          {v.vote_history.length > 0 && (
            <div className="mt-1">
              <b>Vote History:</b>
              <div className="max-h-[80px] overflow-y-auto mt-0.5">
                {v.vote_history.slice(0, 10).map((vh, i) => (
                  <div key={i} className="text-[9px] flex items-center gap-1">
                    <span>{vh.voted ? "✅" : "❌"}</span>
                    <span>{vh.election}</span>
                    {vh.method && <span className="text-[hsl(var(--muted-foreground))]">({vh.method})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {v.tags.length > 0 && (
            <div className="mt-1">
              <b>Tags:</b>
              <div className="flex flex-wrap gap-0.5 mt-0.5">
                {v.tags.slice(0, 8).map((tag, i) => (
                  <span key={i} className="text-[8px] px-1 py-0 win98-raised bg-[hsl(var(--win98-light))]">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
