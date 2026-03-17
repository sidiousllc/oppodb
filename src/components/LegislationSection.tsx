import { useState, useCallback } from "react";
import { Search, FileText, User, Vote, ChevronRight, ArrowLeft, ExternalLink, Calendar, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ──────────────────────────────────────────────────────────────────

interface BillResult {
  bill_id: number;
  bill_number: string;
  title: string;
  state: string;
  session?: { session_name?: string };
  status?: string;
  status_desc?: string;
  last_action?: string;
  last_action_date?: string;
  url?: string;
  text_url?: string;
}

interface BillDetail {
  bill_id: number;
  bill_number: string;
  title: string;
  description?: string;
  state: string;
  session?: { session_name?: string };
  status_desc?: string;
  last_action?: string;
  last_action_date?: string;
  url?: string;
  sponsors?: Array<{ name: string; party?: string; role?: string; people_id?: number }>;
  votes?: Array<{ roll_call_id: number; date: string; desc: string; yea: number; nay: number; passed: number }>;
  history?: Array<{ date: string; action: string; chamber?: string }>;
  subjects?: Array<{ subject_name: string }>;
  texts?: Array<{ doc_id: number; date: string; type: string; url?: string }>;
}

interface PersonResult {
  people_id: number;
  name: string;
  party: string;
  role: string;
  state: string;
  district?: string;
}

type Tab = "bills" | "legislators";

// ─── API helpers ────────────────────────────────────────────────────────────

const STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
  "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
  "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","US"
];

const STATE_NAMES: Record<string, string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",
  CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",
  IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",
  ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",
  MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",
  NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",
  OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",
  TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",
  WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",US:"US Congress"
};

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
  const p = party?.toUpperCase();
  if (p === "D" || p === "DEMOCRAT") return "hsl(210, 80%, 50%)";
  if (p === "R" || p === "REPUBLICAN") return "hsl(0, 70%, 50%)";
  return "hsl(var(--muted-foreground))";
}

// ─── Bill Card ──────────────────────────────────────────────────────────────

function BillCard({ bill, onClick }: { bill: BillResult; onClick: () => void }) {
  return (
    <div className="candidate-card animate-fade-in cursor-pointer" onClick={onClick}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide border bg-primary/10 text-primary border-primary/25">
              {bill.bill_number}
            </span>
            <span className="tag tag-governor">{bill.state}</span>
          </div>
          <h3 className="font-display text-xs font-semibold text-foreground mt-1 line-clamp-2">
            {bill.title}
          </h3>
          {bill.last_action && (
            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">
              {bill.last_action_date && <span className="font-medium">{bill.last_action_date}: </span>}
              {bill.last_action}
            </p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-2" />
      </div>
    </div>
  );
}

// ─── Bill Detail ────────────────────────────────────────────────────────────

function BillDetailView({ bill, onBack }: { bill: BillDetail; onBack: () => void }) {
  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to results
      </button>

      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold tracking-wide border bg-primary/10 text-primary border-primary/25">
          {bill.bill_number}
        </span>
        <span className="tag tag-governor">{bill.state}</span>
        {bill.status_desc && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border bg-accent/10 text-accent-foreground border-accent/25">
            {bill.status_desc}
          </span>
        )}
      </div>

      <h2 className="font-display text-lg font-bold text-foreground mb-1">{bill.title}</h2>
      {bill.description && <p className="text-sm text-muted-foreground mb-3">{bill.description}</p>}

      {bill.url && (
        <a href={bill.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mb-4">
          <ExternalLink className="h-3 w-3" /> View on LegiScan
        </a>
      )}

      {/* Sponsors */}
      {bill.sponsors && bill.sponsors.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 mb-4">
          <h3 className="font-display text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Sponsors ({bill.sponsors.length})
          </h3>
          <div className="space-y-1.5">
            {bill.sponsors.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: partyColor(s.party || "") }} />
                <span className="font-medium text-foreground">{s.name}</span>
                {s.party && <span className="text-muted-foreground">({s.party})</span>}
                {s.role && <span className="text-muted-foreground italic">{s.role}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Votes */}
      {bill.votes && bill.votes.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 mb-4">
          <h3 className="font-display text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <Vote className="h-4 w-4 text-primary" /> Roll Call Votes ({bill.votes.length})
          </h3>
          <div className="space-y-2">
            {bill.votes.map((v) => (
              <div key={v.roll_call_id} className="flex items-center justify-between text-xs border-b border-border/50 pb-1.5">
                <div>
                  <span className="font-medium text-foreground">{v.desc}</span>
                  <span className="text-muted-foreground ml-2">{v.date}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{ color: "hsl(150, 60%, 40%)" }} className="font-bold">Y: {v.yea}</span>
                  <span style={{ color: "hsl(0, 60%, 50%)" }} className="font-bold">N: {v.nay}</span>
                  <span className={`font-bold ${v.passed ? "text-primary" : "text-destructive"}`}>
                    {v.passed ? "✓ Passed" : "✗ Failed"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {bill.history && bill.history.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 mb-4">
          <h3 className="font-display text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Legislative History
          </h3>
          <div className="space-y-1">
            {bill.history.slice(0, 20).map((h, i) => (
              <div key={i} className="flex items-start gap-2 text-xs border-b border-border/30 pb-1">
                <span className="text-muted-foreground font-mono shrink-0 w-20">{h.date}</span>
                <span className="text-foreground">{h.action}</span>
              </div>
            ))}
            {bill.history.length > 20 && (
              <p className="text-[10px] text-muted-foreground italic">+ {bill.history.length - 20} more actions</p>
            )}
          </div>
        </div>
      )}

      {/* Subjects */}
      {bill.subjects && bill.subjects.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-display text-sm font-semibold text-foreground mb-2">Subjects</h3>
          <div className="flex flex-wrap gap-1">
            {bill.subjects.map((s, i) => (
              <span key={i} className="tag tag-house">{s.subject_name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Legislator Card ────────────────────────────────────────────────────────

function LegislatorCard({ person }: { person: PersonResult }) {
  return (
    <div className="candidate-card animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${partyColor(person.party)}20` }}>
          <User className="h-4 w-4" style={{ color: partyColor(person.party) }} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xs font-semibold text-foreground">{person.name}</h3>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="font-medium" style={{ color: partyColor(person.party) }}>{person.party}</span>
            <span>•</span>
            <span>{person.role}</span>
            <span>•</span>
            <span>{STATE_NAMES[person.state] || person.state}</span>
            {person.district && <><span>•</span><span>Dist. {person.district}</span></>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Section ───────────────────────────────────────────────────────────

export function LegislationSection() {
  const [tab, setTab] = useState<Tab>("bills");
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("US");
  const [loading, setLoading] = useState(false);
  const [bills, setBills] = useState<BillResult[]>([]);
  const [legislators, setLegislators] = useState<PersonResult[]>([]);
  const [selectedBill, setSelectedBill] = useState<BillDetail | null>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() && tab === "bills") return;
    setLoading(true);
    setSearchPerformed(true);
    setSelectedBill(null);

    try {
      if (tab === "bills") {
        const data = await callLegiScan({
          op: "getSearch",
          state: stateFilter,
          query: searchQuery,
        });
        const results = data?.searchresult || {};
        const billList: BillResult[] = [];
        for (const key of Object.keys(results)) {
          if (key === "summary") continue;
          const b = results[key];
          if (b?.bill_id) billList.push(b);
        }
        setBills(billList);
      } else {
        // Get session list for state, then get master list to find people
        const sessionData = await callLegiScan({
          op: "getSessionList",
          state: stateFilter,
        });
        const sessions = sessionData?.sessions || [];
        if (sessions.length > 0) {
          const latestSession = sessions[sessions.length - 1];
          const sessionPeople = await callLegiScan({
            op: "getSessionPeople",
            id: String(latestSession.session_id),
          });
          const people = sessionPeople?.sessionpeople?.people || [];
          const q = searchQuery.toLowerCase();
          const filtered = q
            ? people.filter((p: PersonResult) => p.name?.toLowerCase().includes(q))
            : people;
          setLegislators(filtered);
        } else {
          setLegislators([]);
        }
      }
    } catch (e) {
      console.error("LegiScan search error:", e);
    } finally {
      setLoading(false);
    }
  }, [tab, searchQuery, stateFilter]);

  const handleBillClick = useCallback(async (bill: BillResult) => {
    setLoading(true);
    try {
      const data = await callLegiScan({
        op: "getBill",
        id: String(bill.bill_id),
      });
      if (data?.bill) {
        setSelectedBill(data.bill);
      }
    } catch (e) {
      console.error("getBill error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  if (selectedBill) {
    return <BillDetailView bill={selectedBill} onBack={() => setSelectedBill(null)} />;
  }

  return (
    <div>
      {/* Tab toggle */}
      <div className="inline-flex rounded-lg border border-border overflow-hidden mb-4">
        {(["bills", "legislators"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setSearchPerformed(false); }}
            className={`px-4 py-1.5 text-xs font-medium transition-colors ${
              t !== "bills" ? "border-l border-border" : ""
            } ${
              tab === t
                ? "bg-foreground text-background"
                : "bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "bills" ? (
              <span className="flex items-center gap-1.5"><FileText className="h-3 w-3" /> Bills</span>
            ) : (
              <span className="flex items-center gap-1.5"><Building2 className="h-3 w-3" /> Legislators</span>
            )}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground"
        >
          {STATES.map((st) => (
            <option key={st} value={st}>{st} — {STATE_NAMES[st]}</option>
          ))}
        </select>

        <div className="flex items-center gap-2 flex-1 min-w-[200px] rounded-lg border border-border bg-card px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder={tab === "bills" ? "Search bills (e.g. 'healthcare', 'HB 1')…" : "Search legislators by name…"}
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>

        <button
          onClick={handleSearch}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Searching…
            </>
          ) : (
            "Search"
          )}
        </button>
      </div>

      {/* Info */}
      <div className="rounded-lg border border-border bg-card/50 p-3 mb-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-1">📜 LegiScan Legislative Data</p>
        <p>Search bills and legislators across all 50 states and US Congress. Data sourced from LegiScan's comprehensive legislative tracking system.</p>
      </div>

      {/* Results */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            <span className="text-sm">Searching LegiScan…</span>
          </div>
        </div>
      )}

      {!loading && searchPerformed && tab === "bills" && (
        <>
          <p className="text-sm text-muted-foreground mb-3">{bills.length} bills found</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {bills.slice(0, 100).map((b) => (
              <BillCard key={b.bill_id} bill={b} onClick={() => handleBillClick(b)} />
            ))}
          </div>
          {bills.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No bills found. Try a different search term or state.</p>
            </div>
          )}
        </>
      )}

      {!loading && searchPerformed && tab === "legislators" && (
        <>
          <p className="text-sm text-muted-foreground mb-3">{legislators.length} legislators found</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {legislators.slice(0, 200).map((p) => (
              <LegislatorCard key={p.people_id} person={p} />
            ))}
          </div>
          {legislators.length === 0 && (
            <div className="text-center py-12">
              <User className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No legislators found for this state/search.</p>
            </div>
          )}
        </>
      )}

      {!loading && !searchPerformed && (
        <div className="text-center py-16">
          <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="font-display text-lg font-semibold text-foreground mb-1">
            {tab === "bills" ? "Search Legislation" : "Browse Legislators"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {tab === "bills"
              ? "Enter a keyword or bill number above to search across state and federal legislation."
              : "Select a state and click Search to view current legislators."}
          </p>
        </div>
      )}
    </div>
  );
}
