import { useState, useCallback, useEffect } from "react";
import {
  Search, Vote, ChevronRight, ExternalLink, Calendar, Building2,
  Gavel, Users, Link2, Unlink, Loader2, FileText, CheckCircle2,
  XCircle, User, BookOpen
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useWindowManager } from "@/contexts/WindowManagerContext";

// ─── Types ──────────────────────────────────────────────────────────────────

interface PersonResult {
  people_id: number;
  name: string;
  party: string;
  role: string;
  state: string;
  district?: string;
}

interface PersonDetail {
  people_id: number;
  name: string;
  first_name?: string;
  last_name?: string;
  party: string;
  role: string;
  state: string;
  district?: string;
  ballotpedia?: string;
  votesmart_id?: number;
  opensecrets_id?: string;
}

interface SponsoredBill {
  bill_id: number;
  bill_number: string;
  title: string;
  session?: { session_id: number; session_name: string };
}

interface VoteRecord {
  roll_call_id: number;
  bill_id: number;
  bill_number: string;
  bill_title?: string;
  date: string;
  desc: string;
  vote_text: string;
  yea: number;
  nay: number;
  passed: number;
  chamber: string;
}

// ─── API ────────────────────────────────────────────────────────────────────

async function callLegiScan(params: Record<string, string>) {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const qs = new URLSearchParams(params).toString();
  const resp = await fetch(
    `https://${projectId}.supabase.co/functions/v1/legiscan?${qs}`,
    { headers: { "Content-Type": "application/json" } }
  );
  return resp.json();
}

function partyColor(party: string) {
  const p = (party || "").toUpperCase();
  if (p === "D" || p === "DEMOCRAT" || p === "DEMOCRATIC") return "hsl(210, 80%, 50%)";
  if (p === "R" || p === "REPUBLICAN") return "hsl(0, 70%, 50%)";
  if (p === "I" || p === "INDEPENDENT") return "hsl(45, 80%, 50%)";
  return "hsl(var(--muted-foreground))";
}

function voteColor(voteText: string) {
  const v = (voteText || "").toLowerCase();
  if (v === "yea" || v === "aye") return "hsl(150, 60%, 40%)";
  if (v === "nay" || v === "no") return "hsl(0, 60%, 50%)";
  if (v === "nv" || v === "not voting") return "hsl(45, 60%, 50%)";
  return "hsl(var(--muted-foreground))";
}

function voteLabel(voteText: string) {
  const v = (voteText || "").toLowerCase();
  if (v === "yea" || v === "aye") return "YEA";
  if (v === "nay" || v === "no") return "NAY";
  if (v === "nv" || v === "not voting") return "NV";
  if (v === "absent") return "ABSENT";
  return voteText.toUpperCase();
}

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  candidateSlug: string;
  candidateName: string;
  candidateState?: string;
}

export function CandidateVotingRecord({ candidateSlug, candidateName, candidateState }: Props) {
  const { canManageContent } = useUserRole();
  const { openWindow } = useWindowManager();
  const [linkedPeopleId, setLinkedPeopleId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PersonResult[]>([]);
  const [showLinkSearch, setShowLinkSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Loaded data
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [sponsoredBills, setSponsoredBills] = useState<SponsoredBill[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Tab
  const [activeTab, setActiveTab] = useState<"sponsored" | "profile">("sponsored");

  // Load linked people_id from DB, auto-match if not linked
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("candidate_profiles")
        .select("legiscan_people_id")
        .eq("slug", candidateSlug)
        .eq("is_subpage", false)
        .maybeSingle();

      if (cancelled) return;

      if (data?.legiscan_people_id) {
        setLinkedPeopleId(data.legiscan_people_id);
        setLoading(false);
        return;
      }

      // Auto-match: try to find legislator by name in the candidate's state
      try {
        const stateAbbr = candidateState || "US";
        const sessionData = await callLegiScan({ op: "getSessionList", state: stateAbbr });
        const sessionList = sessionData?.sessions || [];
        if (cancelled || sessionList.length === 0) { setLoading(false); return; }

        const latestSession = sessionList[sessionList.length - 1];
        const sessionPeople = await callLegiScan({ op: "getSessionPeople", id: String(latestSession.session_id) });
        const people: PersonResult[] = sessionPeople?.sessionpeople?.people || [];

        if (cancelled) return;

        // Clean candidate name for matching
        const cleanName = candidateName
          .replace(/^\*\*.*?Against\s+/i, "")
          .replace(/\*\*/g, "")
          .replace(/\s+(Jr\.?|Sr\.?|III|II|IV)$/i, "")
          .trim();
        const nameParts = cleanName.toLowerCase().split(/\s+/);
        const lastName = nameParts[nameParts.length - 1];
        const firstName = nameParts[0];

        // Find matches: last name must match, first name should start with same letters
        const matches = people.filter((p) => {
          const pName = p.name?.toLowerCase() || "";
          const pParts = pName.split(/,\s*|\s+/);
          // LegiScan names can be "Last, First" or "First Last"
          const pLast = pParts[0]?.replace(/,/g, "");
          const pFirst = pParts.length > 1 ? pParts[1] : "";
          return (
            pLast === lastName &&
            (pFirst.startsWith(firstName.substring(0, 3)) || firstName.startsWith(pFirst.substring(0, 3)))
          );
        });

        if (cancelled) return;

        if (matches.length === 1) {
          // Confident match — auto-link
          const match = matches[0];
          await supabase
            .from("candidate_profiles")
            .update({ legiscan_people_id: match.people_id, legiscan_state: stateAbbr })
            .eq("slug", candidateSlug)
            .eq("is_subpage", false);
          if (!cancelled) {
            setLinkedPeopleId(match.people_id);
          }
        }
      } catch (e) {
        console.error("Auto-match error:", e);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [candidateSlug, candidateName, candidateState]);

  // Load legislator data when linked
  useEffect(() => {
    if (!linkedPeopleId) return;
    setLoadingData(true);
    Promise.all([
      callLegiScan({ op: "getPerson", id: String(linkedPeopleId) }),
      callLegiScan({ op: "getSponsoredList", id: String(linkedPeopleId) }),
    ]).then(async ([personData, sponsoredData]) => {
      if (personData?.person) setPerson(personData.person);
      const sponsored = sponsoredData?.sponsoredbills?.bills || {};
      const rawBills: any[] = Array.isArray(sponsored)
        ? sponsored
        : Object.values(sponsored).filter((b: any) => b?.bill_id);

      // getSponsoredList only returns bill_id, number, session_id — no title
      // Fetch bill details in batches to get titles
      const billsWithTitles: SponsoredBill[] = [];
      const BATCH_SIZE = 10;
      const toFetch = rawBills.slice(0, 100); // cap at 100 to avoid API limits

      for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
        const batch = toFetch.slice(i, i + BATCH_SIZE);
        const details = await Promise.all(
          batch.map((b) =>
            callLegiScan({ op: "getBill", id: String(b.bill_id) }).catch(() => null)
          )
        );
        for (let j = 0; j < batch.length; j++) {
          const raw = batch[j];
          const detail = details[j]?.bill;
          billsWithTitles.push({
            bill_id: raw.bill_id,
            bill_number: raw.number || raw.bill_number || "",
            title: detail?.title || raw.title || raw.number || "Untitled",
            session: detail?.session
              ? { session_id: detail.session.session_id, session_name: detail.session.session_name }
              : raw.session_id
                ? { session_id: raw.session_id, session_name: "" }
                : undefined,
          });
        }
      }

      // Add remaining bills without fetched titles
      for (let i = 100; i < rawBills.length; i++) {
        const raw = rawBills[i];
        billsWithTitles.push({
          bill_id: raw.bill_id,
          bill_number: raw.number || raw.bill_number || "",
          title: raw.title || raw.number || "Untitled",
          session: undefined,
        });
      }

      setSponsoredBills(billsWithTitles);
      setLoadingData(false);
    }).catch(() => setLoadingData(false));
  }, [linkedPeopleId]);

  // Search for legislator to link
  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim() || candidateName;
    setSearching(true);
    try {
      // Get latest session for the state, then search people
      const stateAbbr = candidateState || "US";
      const sessionData = await callLegiScan({ op: "getSessionList", state: stateAbbr });
      const sessionList = sessionData?.sessions || [];
      if (sessionList.length > 0) {
        const latestSession = sessionList[sessionList.length - 1];
        const sessionPeople = await callLegiScan({ op: "getSessionPeople", id: String(latestSession.session_id) });
        const people: PersonResult[] = sessionPeople?.sessionpeople?.people || [];
        const lq = q.toLowerCase();
        const filtered = people.filter((p) => p.name?.toLowerCase().includes(lq));
        setSearchResults(filtered.length > 0 ? filtered : people.slice(0, 50));
      } else {
        setSearchResults([]);
      }
    } catch (e) {
      console.error("Search error:", e);
    } finally {
      setSearching(false);
    }
  }, [searchQuery, candidateName, candidateState]);

  // Link a legislator
  const linkLegislator = useCallback(async (peopleId: number) => {
    await supabase
      .from("candidate_profiles")
      .update({ legiscan_people_id: peopleId, legiscan_state: candidateState || null })
      .eq("slug", candidateSlug)
      .eq("is_subpage", false);
    setLinkedPeopleId(peopleId);
    setShowLinkSearch(false);
    setSearchResults([]);
  }, [candidateSlug, candidateState]);

  // Unlink
  const unlinkLegislator = useCallback(async () => {
    await supabase
      .from("candidate_profiles")
      .update({ legiscan_people_id: null, legiscan_state: null })
      .eq("slug", candidateSlug)
      .eq("is_subpage", false);
    setLinkedPeopleId(null);
    setPerson(null);
    setSponsoredBills([]);
  }, [candidateSlug]);

  if (loading) return null;

  // ─── Not linked state ─────────────────────────────────────────────────────

  if (!linkedPeopleId) {
    return (
      <div className="bg-card rounded-xl border border-border p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Gavel className="h-4 w-4" /> Legislative Record
          </h2>
          {canManageContent && (
            <button
              onClick={() => { setShowLinkSearch(true); setSearchQuery(candidateName.split(" ").pop() || candidateName); }}
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
            >
              <Link2 className="h-3 w-3" /> Link Legislator
            </button>
          )}
        </div>

        {!showLinkSearch ? (
          <p className="text-xs text-muted-foreground">
            No LegiScan legislator linked.{canManageContent ? " Click 'Link Legislator' to connect voting records." : ""}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 flex-1 rounded-lg border border-border bg-background px-3 py-1.5">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search legislator name…"
                  className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searching}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : "Search"}
              </button>
              <button
                onClick={() => { setShowLinkSearch(false); setSearchResults([]); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="max-h-[300px] overflow-y-auto space-y-1 border border-border rounded-lg p-2 bg-background">
                {searchResults.map((p) => (
                  <button
                    key={p.people_id}
                    onClick={() => linkLegislator(p.people_id)}
                    className="w-full text-left flex items-center gap-2 text-xs hover:bg-muted/50 rounded px-2 py-1.5 transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: partyColor(p.party) }} />
                    <span className="font-medium text-foreground">{p.name}</span>
                    <span className="text-muted-foreground">({p.party})</span>
                    <span className="text-muted-foreground">{p.role}</span>
                    {p.district && <span className="text-muted-foreground">Dist. {p.district}</span>}
                    <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {searching && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
                <Loader2 className="h-3 w-3 animate-spin" /> Searching legislators…
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── Linked state ─────────────────────────────────────────────────────────

  return (
    <div className="bg-card rounded-xl border border-border p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Gavel className="h-4 w-4" /> Legislative Record
        </h2>
        <div className="flex items-center gap-2">
          {person && (
            <span className="text-[10px] text-muted-foreground">
              Linked to <span className="font-medium text-foreground">{person.name}</span>
            </span>
          )}
          {canManageContent && (
            <button
              onClick={unlinkLegislator}
              className="inline-flex items-center gap-1 text-[10px] text-destructive/70 hover:text-destructive font-medium"
              title="Unlink legislator"
            >
              <Unlink className="h-3 w-3" /> Unlink
            </button>
          )}
        </div>
      </div>

      {loadingData ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-6 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading legislative data…
        </div>
      ) : (
        <>
          {/* Person summary card */}
          {person && (
            <div className="rounded-lg border border-border bg-background/50 p-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${partyColor(person.party)}20` }}>
                  <User className="h-4 w-4" style={{ color: partyColor(person.party) }} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-foreground">{person.name}</h3>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                    <span className="font-medium" style={{ color: partyColor(person.party) }}>{person.party}</span>
                    <span>•</span>
                    <span>{person.role}</span>
                    <span>•</span>
                    <span>{person.state}</span>
                    {person.district && <><span>•</span><span>Dist. {person.district}</span></>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {person.ballotpedia && (
                    <a href={`https://ballotpedia.org/${person.ballotpedia}`} target="_blank" rel="noopener noreferrer" className="text-[9px] text-primary hover:underline border border-primary/20 rounded px-1.5 py-0.5">
                      Ballotpedia
                    </a>
                  )}
                  {person.votesmart_id && (
                    <a href={`https://justfacts.votesmart.org/candidate/${person.votesmart_id}`} target="_blank" rel="noopener noreferrer" className="text-[9px] text-primary hover:underline border border-primary/20 rounded px-1.5 py-0.5">
                      VoteSmart
                    </a>
                  )}
                  {person.opensecrets_id && (
                    <a href={`https://www.opensecrets.org/members-of-congress/summary?cid=${person.opensecrets_id}`} target="_blank" rel="noopener noreferrer" className="text-[9px] text-primary hover:underline border border-primary/20 rounded px-1.5 py-0.5">
                      OpenSecrets
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="inline-flex rounded-lg border border-border overflow-hidden mb-3">
            <button
              onClick={() => setActiveTab("sponsored")}
              className={`px-3 py-1 text-[10px] font-medium transition-colors ${
                activeTab === "sponsored" ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> Sponsored Bills ({sponsoredBills.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("profile")}
              className={`px-3 py-1 text-[10px] font-medium transition-colors border-l border-border ${
                activeTab === "profile" ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> Profile</span>
            </button>
          </div>

          {/* Sponsored bills */}
          {activeTab === "sponsored" && (
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {sponsoredBills.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No sponsored bills found.</p>
              ) : (
                sponsoredBills.map((b) => {
                  const displayTitle = b.title && b.title !== "Untitled" ? b.title : (b.bill_number || `Bill #${b.bill_id}`);
                  return (
                    <button
                      key={b.bill_id}
                      type="button"
                      onClick={() =>
                        openWindow({
                          appId: "bill-detail",
                          title: `${b.bill_number || "Bill"} — ${displayTitle.slice(0, 40)}`,
                          icon: "📜",
                          payload: { billId: b.bill_id, billNumber: b.bill_number, title: displayTitle },
                          size: { width: 560, height: 600 },
                        })
                      }
                      className="w-full flex items-center gap-2 text-xs border-b border-border/30 pb-1.5 pt-1 hover:bg-accent/30 rounded px-1 text-left transition-colors"
                      title={displayTitle}
                    >
                      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold border bg-primary/10 text-primary border-primary/25 shrink-0">
                        {b.bill_number || `#${b.bill_id}`}
                      </span>
                      <span className="text-foreground flex-1 truncate">{displayTitle}</span>
                      {b.session?.session_name && (
                        <span className="text-[9px] text-muted-foreground shrink-0">{b.session.session_name}</span>
                      )}
                      <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* Profile info tab */}
          {activeTab === "profile" && person && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-[10px] text-muted-foreground">Name</span>
                <span className="text-[10px] font-medium text-foreground">{person.first_name} {person.last_name}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-[10px] text-muted-foreground">Party</span>
                <span className="text-[10px] font-medium" style={{ color: partyColor(person.party) }}>{person.party}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-[10px] text-muted-foreground">Role</span>
                <span className="text-[10px] font-medium text-foreground">{person.role}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-[10px] text-muted-foreground">State</span>
                <span className="text-[10px] font-medium text-foreground">{person.state}</span>
              </div>
              {person.district && (
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-[10px] text-muted-foreground">District</span>
                  <span className="text-[10px] font-medium text-foreground">{person.district}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-[10px] text-muted-foreground">LegiScan ID</span>
                <span className="text-[10px] font-medium text-foreground">{person.people_id}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
