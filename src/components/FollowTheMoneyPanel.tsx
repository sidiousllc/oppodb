import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, DollarSign, Users, Building2, Loader2, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
  "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
  "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

const YEARS = Array.from({ length: 15 }, (_, i) => String(2024 - i));

function formatMoney(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

type SearchMode = "candidates" | "donors";

interface FTMRecord {
  [key: string]: any;
}

export function FollowTheMoneyPanel({ embedded }: { embedded?: boolean }) {
  const [mode, setMode] = useState<SearchMode>("candidates");
  const [state, setState] = useState("");
  const [year, setYear] = useState("2024");
  const [name, setName] = useState("");
  const [employer, setEmployer] = useState("");
  const [office, setOffice] = useState("");
  const [party, setParty] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FTMRecord[]>([]);
  const [paging, setPaging] = useState<any>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [entityDetails, setEntityDetails] = useState<Record<string, any>>({});
  const [entityLoading, setEntityLoading] = useState<string | null>(null);

  const handleSearch = useCallback(async (page?: number) => {
    setLoading(true);
    setHasSearched(true);
    if (!page) setExpandedIdx(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please log in"); setLoading(false); return; }

      const payload: any = {
        action: mode,
        state: state || undefined,
        year: year || undefined,
        page: page || undefined,
      };

      if (mode === "candidates") {
        if (office) payload.office = office;
        if (party) payload.party = party;
      } else {
        if (name) payload.contributor_name = name;
        if (employer) payload.employer = employer;
      }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/followthemoney`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Search failed");

      const records = data?.data?.records || [];
      setResults(records);
      setPaging(data?.metaInfo?.paging || null);

      if (records.length === 0) toast.info("No results found");
    } catch (e: any) {
      toast.error(e.message || "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [mode, state, year, name, employer, office, party]);

  const loadEntity = useCallback(async (eid: string) => {
    if (entityDetails[eid]) return;
    setEntityLoading(eid);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/followthemoney`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "entity", eid }),
        }
      );
      const data = await resp.json();
      if (resp.ok) {
        setEntityDetails(prev => ({ ...prev, [eid]: data }));
      }
    } catch (e) {
      console.error("Entity load failed:", e);
    } finally {
      setEntityLoading(null);
    }
  }, [entityDetails]);

  const containerClass = embedded
    ? ""
    : "rounded-xl border border-border bg-card p-6 mb-6";

  return (
    <div className={containerClass}>
      {!embedded && (
        <h2 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          FollowTheMoney — State Campaign Finance
        </h2>
      )}

      {/* Mode tabs */}
      <div className="flex gap-0 mb-2">
        <button
          onClick={() => { setMode("candidates"); setResults([]); setHasSearched(false); }}
          className={`win98-button text-[10px] flex items-center gap-1 ${mode === "candidates" ? "font-bold bg-white" : ""}`}
        >
          <Building2 className="h-3 w-3" />
          Candidates
        </button>
        <button
          onClick={() => { setMode("donors"); setResults([]); setHasSearched(false); }}
          className={`win98-button text-[10px] flex items-center gap-1 ${mode === "donors" ? "font-bold bg-white" : ""}`}
        >
          <Users className="h-3 w-3" />
          Donors
        </button>
      </div>

      {/* Search form */}
      <div className="win98-sunken bg-white p-3 mb-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label className="block text-[10px] font-bold mb-1">State:</label>
            <select value={state} onChange={e => setState(e.target.value)} className="win98-input w-full">
              <option value="">All states</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold mb-1">Year:</label>
            <select value={year} onChange={e => setYear(e.target.value)} className="win98-input w-full">
              <option value="">All years</option>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {mode === "candidates" ? (
            <>
              <div>
                <label className="block text-[10px] font-bold mb-1">Office:</label>
                <select value={office} onChange={e => setOffice(e.target.value)} className="win98-input w-full">
                  <option value="">All offices</option>
                  <option value="G">Governor</option>
                  <option value="SSS">State Senate</option>
                  <option value="SHS">State House</option>
                  <option value="AG">Attorney General</option>
                  <option value="SOS">Secretary of State</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold mb-1">Party:</label>
                <select value={party} onChange={e => setParty(e.target.value)} className="win98-input w-full">
                  <option value="">All parties</option>
                  <option value="1">Democratic</option>
                  <option value="2">Republican</option>
                  <option value="3">Independent/Third</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-[10px] font-bold mb-1">Donor Name:</label>
                <input value={name} onChange={e => setName(e.target.value)} className="win98-input w-full" placeholder="e.g. Koch" maxLength={100} />
              </div>
              <div>
                <label className="block text-[10px] font-bold mb-1">Employer:</label>
                <input value={employer} onChange={e => setEmployer(e.target.value)} className="win98-input w-full" placeholder="e.g. Microsoft" maxLength={100} />
              </div>
            </>
          )}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <button onClick={() => handleSearch()} disabled={loading} className="win98-button text-[10px] font-bold flex items-center gap-1 disabled:opacity-50">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
            {loading ? "Searching..." : "Search"}
          </button>
          <span className="text-[9px] text-muted-foreground">
            Powered by <a href="https://www.followthemoney.org" target="_blank" rel="noopener noreferrer" className="underline">FollowTheMoney.org</a> — state-level campaign finance data
          </span>
        </div>
      </div>

      {/* Paging info */}
      {paging && (
        <div className="flex items-center justify-between mb-2 text-[10px] text-muted-foreground">
          <span>{paging.totalRecords || 0} result{paging.totalRecords !== "1" ? "s" : ""} found</span>
          {paging.totalPages > 1 && (
            <div className="flex items-center gap-1">
              {Number(paging.currentPage) > 0 && (
                <button onClick={() => handleSearch(Number(paging.currentPage) - 1)} className="win98-button text-[9px]">← Prev</button>
              )}
              <span className="text-[9px]">Page {Number(paging.currentPage) + 1} of {paging.totalPages}</span>
              {Number(paging.currentPage) + 1 < paging.totalPages && (
                <button onClick={() => handleSearch(Number(paging.currentPage) + 1)} className="win98-button text-[9px]">Next →</button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {hasSearched && !loading && results.length > 0 && (
        <div className="win98-sunken bg-white">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="bg-[hsl(var(--win98-face))] border-b border-[hsl(var(--win98-shadow))]">
                <th className="text-left px-2 py-1 font-bold w-5"></th>
                {mode === "candidates" ? (
                  <>
                    <th className="text-left px-2 py-1 font-bold">Candidate</th>
                    <th className="text-left px-2 py-1 font-bold">Office</th>
                    <th className="text-left px-2 py-1 font-bold">Party</th>
                    <th className="text-right px-2 py-1 font-bold">Records</th>
                    <th className="text-right px-2 py-1 font-bold">Total $</th>
                  </>
                ) : (
                  <>
                    <th className="text-left px-2 py-1 font-bold">Contributor</th>
                    <th className="text-left px-2 py-1 font-bold">Type</th>
                    <th className="text-left px-2 py-1 font-bold">State</th>
                    <th className="text-right px-2 py-1 font-bold">Records</th>
                    <th className="text-right px-2 py-1 font-bold">Total $</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {results.map((rec, idx) => {
                const isExpanded = expandedIdx === idx;
                const eid = rec.id || rec.eid || rec.Contributor_Entity?.id || rec.Candidate_Entity?.id;
                const entityName = rec.Candidate_Entity?.Candidate_Entity || rec.Contributor_Entity?.Contributor_Entity || rec.name || "—";
                const totalDollars = rec.Total_Dollar || rec.Total_$;
                const numRecords = rec.Records || rec.Num_of_Records;

                return (
                  <tbody key={idx}>
                    <tr
                      onClick={() => {
                        setExpandedIdx(isExpanded ? null : idx);
                        if (!isExpanded && eid) loadEntity(eid);
                      }}
                      className="border-b border-[hsl(var(--win98-light))] hover:bg-[hsl(var(--win98-light))] cursor-pointer"
                    >
                      <td className="px-1 py-1">
                        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </td>
                      {mode === "candidates" ? (
                        <>
                          <td className="px-2 py-1 font-bold">{entityName}</td>
                          <td className="px-2 py-1">{rec.Office_Sought?.Office_Sought || rec.Specific_Office?.Specific_Office || "—"}</td>
                          <td className="px-2 py-1">
                            <span style={{
                              color: (rec.General_Party?.General_Party || "").includes("Democrat") ? "hsl(210, 70%, 50%)"
                                : (rec.General_Party?.General_Party || "").includes("Republican") ? "hsl(0, 70%, 50%)"
                                : "inherit"
                            }}>
                              {rec.General_Party?.General_Party || rec.Specific_Party?.Specific_Party || "—"}
                            </span>
                          </td>
                          <td className="px-2 py-1 text-right">{numRecords?.toLocaleString() || "—"}</td>
                          <td className="px-2 py-1 text-right font-bold" style={{ color: "hsl(150, 55%, 45%)" }}>
                            {formatMoney(totalDollars)}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-2 py-1 font-bold">{entityName}</td>
                          <td className="px-2 py-1">{rec.Type_of_Contributor?.Type_of_Contributor || "—"}</td>
                          <td className="px-2 py-1">{rec.Contributor_State?.Contributor_State || rec.State?.State || "—"}</td>
                          <td className="px-2 py-1 text-right">{numRecords?.toLocaleString() || "—"}</td>
                          <td className="px-2 py-1 text-right font-bold" style={{ color: "hsl(150, 55%, 45%)" }}>
                            {formatMoney(totalDollars)}
                          </td>
                        </>
                      )}
                    </tr>
                    {isExpanded && (
                      <tr className="bg-[hsl(var(--win98-light))]">
                        <td colSpan={6} className="px-3 py-2">
                          <EntityDetailPanel
                            eid={eid}
                            record={rec}
                            details={entityDetails[eid]}
                            loading={entityLoading === eid}
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasSearched && !loading && results.length === 0 && (
        <div className="win98-sunken bg-white p-6 text-center text-[10px] text-muted-foreground">
          No results found. Try broadening your search criteria.
        </div>
      )}

      {!hasSearched && (
        <div className="win98-sunken bg-white p-6 text-center text-[10px] text-muted-foreground">
          <span className="text-3xl block mb-2">💰</span>
          <p className="font-bold mb-1">State Campaign Finance Search</p>
          <p>Search state-level campaign contributions, candidates, and donors.</p>
          <p className="mt-1 text-[9px]">
            Data from <a href="https://www.followthemoney.org" target="_blank" rel="noopener noreferrer" className="underline">FollowTheMoney.org</a> — state campaign finance records since 1989.
          </p>
        </div>
      )}
    </div>
  );
}

function EntityDetailPanel({ eid, record, details, loading }: {
  eid: string;
  record: FTMRecord;
  details: any;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground py-2">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading entity details…
      </div>
    );
  }

  const overview = details?.data?.overview;
  const entityName = overview?.details?.EntityName?.EntityName ||
    record.Candidate_Entity?.Candidate_Entity ||
    record.Contributor_Entity?.Contributor_Entity || "—";
  const entityType = overview?.details?.EntityType?.EntityType;
  const industries = overview?.industry || [];

  const asCandidate = details?.data?.AsCandidate;
  const asContributor = details?.data?.AsContributor;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-[10px]">
      {/* Overview */}
      <div className="win98-sunken bg-white p-2">
        <p className="font-bold mb-1 text-[9px] border-b border-[hsl(var(--win98-shadow))] pb-0.5">Entity Overview</p>
        <div className="space-y-0.5">
          <div><b>Name:</b> {entityName}</div>
          {entityType && <div><b>Type:</b> {entityType}</div>}
          {eid && (
            <a
              href={`https://www.followthemoney.org/entity-details?eid=${eid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[9px] mt-1 hover:underline text-primary"
            >
              <ExternalLink className="h-2.5 w-2.5" /> View on FollowTheMoney
            </a>
          )}
        </div>
      </div>

      {/* Industry */}
      {industries.length > 0 && (
        <div className="win98-sunken bg-white p-2">
          <p className="font-bold mb-1 text-[9px] border-b border-[hsl(var(--win98-shadow))] pb-0.5">
            <Building2 className="inline h-3 w-3 mr-0.5" />Industry
          </p>
          <div className="space-y-0.5">
            {industries.slice(0, 4).map((ind: any, i: number) => (
              <div key={i} className="text-[9px]">
                <span className="font-bold">{ind.CatCodeBusiness}</span>
                <span className="text-muted-foreground"> — {ind.CatCodeIndustry}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* As Candidate */}
      {asCandidate && (
        <div className="win98-sunken bg-white p-2">
          <p className="font-bold mb-1 text-[9px] border-b border-[hsl(var(--win98-shadow))] pb-0.5">
            <DollarSign className="inline h-3 w-3 mr-0.5" />As Candidate
          </p>
          <div className="space-y-0.5">
            {asCandidate.FromAll && (
              <div><b>All Contributions:</b> {formatMoney(asCandidate.FromAll.Total_Dollars)} ({asCandidate.FromAll.Num_of_Records} records)</div>
            )}
            {asCandidate.FromIndividuals && (
              <div><b>From Individuals:</b> {formatMoney(asCandidate.FromIndividuals.Total_Dollars)}</div>
            )}
            {asCandidate.FromPACs && (
              <div><b>From PACs:</b> {formatMoney(asCandidate.FromPACs.Total_Dollars)}</div>
            )}
            {asCandidate.FromPartyCommittees && (
              <div><b>From Party:</b> {formatMoney(asCandidate.FromPartyCommittees.Total_Dollars)}</div>
            )}
          </div>
        </div>
      )}

      {/* As Contributor */}
      {asContributor && (
        <div className="win98-sunken bg-white p-2">
          <p className="font-bold mb-1 text-[9px] border-b border-[hsl(var(--win98-shadow))] pb-0.5">
            <Users className="inline h-3 w-3 mr-0.5" />As Contributor
          </p>
          <div className="space-y-0.5">
            {asContributor.ToAll && (
              <div><b>Total Given:</b> {formatMoney(asContributor.ToAll.Total_Dollars)} ({asContributor.ToAll.Num_of_Records} records)</div>
            )}
            {asContributor.ToCandidates && asContributor.ToCandidates.Total_Dollars > 0 && (
              <div><b>To Candidates:</b> {formatMoney(asContributor.ToCandidates.Total_Dollars)}</div>
            )}
            {asContributor.ToPartyCommittees && asContributor.ToPartyCommittees.Total_Dollars > 0 && (
              <div><b>To Party Cmtes:</b> {formatMoney(asContributor.ToPartyCommittees.Total_Dollars)}</div>
            )}
            {asContributor.ToPACsAndOthers && asContributor.ToPACsAndOthers.Total_Dollars > 0 && (
              <div><b>To PACs:</b> {formatMoney(asContributor.ToPACsAndOthers.Total_Dollars)}</div>
            )}
          </div>
        </div>
      )}

      {/* Raw record fields */}
      <div className="win98-sunken bg-white p-2">
        <p className="font-bold mb-1 text-[9px] border-b border-[hsl(var(--win98-shadow))] pb-0.5">Record Details</p>
        <div className="space-y-0.5 text-[9px]">
          {record.Election_Jurisdiction?.Election_Jurisdiction && (
            <div><b>Jurisdiction:</b> {record.Election_Jurisdiction.Election_Jurisdiction}</div>
          )}
          {record.Election_Year?.Election_Year && (
            <div><b>Year:</b> {record.Election_Year.Election_Year}</div>
          )}
          {record.Election_Type?.Election_Type && (
            <div><b>Election:</b> {record.Election_Type.Election_Type}</div>
          )}
          {record.Election_Status?.Election_Status && (
            <div><b>Status:</b> {record.Election_Status.Election_Status}</div>
          )}
          {record.Incumbency_Status?.Incumbency_Status && (
            <div><b>Incumbency:</b> {record.Incumbency_Status.Incumbency_Status}</div>
          )}
        </div>
      </div>
    </div>
  );
}
