import { useState, useCallback, useEffect } from "react";
import {
  Search, FileText, User, Vote, ChevronRight, ArrowLeft, ExternalLink,
  Calendar, Building2, BookOpen, ScrollText, Gavel, Users, Hash, Eye,
  Clock, CheckCircle2, XCircle, MinusCircle, AlertCircle, ListOrdered,
  Layers, FileCheck, FilePlus2, Bookmark, BookmarkCheck, Trash2, StickyNote
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ─── Types ──────────────────────────────────────────────────────────────────

interface BillResult {
  bill_id: number;
  bill_number: string;
  title: string;
  state: string;
  session?: { session_name?: string; session_id?: number };
  status?: number;
  status_desc?: string;
  last_action?: string;
  last_action_date?: string;
  url?: string;
  text_url?: string;
  relevance?: number;
  change_hash?: string;
}

interface BillDetail {
  bill_id: number;
  bill_number: string;
  title: string;
  description?: string;
  state: string;
  state_id?: number;
  session?: { session_name?: string; session_id?: number };
  body?: string;
  body_id?: number;
  current_body?: string;
  current_body_id?: number;
  status?: number;
  status_desc?: string;
  status_date?: string;
  pending_committee_id?: number;
  committee?: { committee_id: number; name: string; chamber: string };
  referrals?: Array<{ committee_id: number; name: string; chamber: string; date: string }>;
  last_action?: string;
  last_action_date?: string;
  url?: string;
  state_link?: string;
  completed?: number;
  progress?: Array<{ date: string; event: number }>;
  sponsors?: Array<{ people_id: number; name: string; party?: string; party_id?: number; role?: string; role_id?: number; sponsor_type_id?: number; sponsor_order?: number; committee_sponsor?: number; committee_id?: number }>;
  votes?: Array<{ roll_call_id: number; date: string; desc: string; yea: number; nay: number; nv: number; absent: number; total: number; passed: number; chamber: string; chamber_id: number }>;
  history?: Array<{ date: string; action: string; chamber?: string; chamber_id?: number; importance?: number }>;
  subjects?: Array<{ subject_name: string }>;
  texts?: Array<{ doc_id: number; date: string; type: string; type_id?: number; mime?: string; mime_id?: number; url?: string; state_link?: string; text_size?: number }>;
  amendments?: Array<{ amendment_id: number; adopted?: number; chamber?: string; chamber_id?: number; date: string; title: string; description?: string; url?: string; state_link?: string; mime?: string; mime_id?: number }>;
  supplements?: Array<{ supplement_id: number; date: string; type?: string; type_id?: number; title: string; description?: string; url?: string; state_link?: string; mime?: string; mime_id?: number }>;
  calendar?: Array<{ date: string; time?: string; location?: string; type?: string; type_id?: number; description?: string }>;
  sasts?: Array<{ type?: string; type_id?: number; sast_bill_number?: string; sast_bill_id?: number }>;
}

interface RollCallDetail {
  roll_call_id: number;
  bill_id: number;
  date: string;
  desc: string;
  yea: number;
  nay: number;
  nv: number;
  absent: number;
  total: number;
  passed: number;
  chamber: string;
  votes: Array<{ people_id: number; vote_id: number; vote_text: string; party_id?: number; party?: string; name?: string }>;
}

interface PersonDetail {
  people_id: number;
  name: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  suffix?: string;
  nickname?: string;
  party: string;
  party_id?: number;
  role: string;
  role_id?: number;
  state: string;
  state_id?: number;
  district?: string;
  committee_sponsor?: number;
  ftm_eid?: string;
  votesmart_id?: number;
  followthemoney_eid?: string;
  opensecrets_id?: string;
  ballotpedia?: string;
  knowwho_pid?: number;
}

interface PersonResult {
  people_id: number;
  name: string;
  party: string;
  role: string;
  state: string;
  district?: string;
}

interface SponsoredBill {
  bill_id: number;
  bill_number: string;
  title: string;
  session?: { session_id: number; session_name: string };
}

interface SessionInfo {
  session_id: number;
  state_id: number;
  year_start: number;
  year_end: number;
  session_name: string;
  name?: string;
  session_title?: string;
  special?: number;
}

interface MasterListBill {
  bill_id: number;
  bill_number: string;
  title: string;
  last_action: string;
  last_action_date: string;
  status?: number;
  status_desc?: string;
  url?: string;
}

type Tab = "bills" | "legislators" | "sessions" | "tracked";
type SubView = null | "bill" | "rollcall" | "person" | "billtext" | "session-bills";

interface TrackedBill {
  id: string;
  bill_id: number;
  bill_number: string;
  title: string;
  state: string;
  status_desc: string | null;
  last_action: string | null;
  last_action_date: string | null;
  legiscan_url: string | null;
  notes: string | null;
  created_at: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STATES = [
  "US","AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
  "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
  "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"
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

const STATUS_LABELS: Record<number, string> = {
  1: "Introduced", 2: "Engrossed", 3: "Enrolled", 4: "Passed", 5: "Vetoed", 6: "Failed/Dead"
};

const PROGRESS_EVENTS: Record<number, { label: string; icon: string }> = {
  1: { label: "Introduced", icon: "📥" },
  2: { label: "Crossed Over", icon: "↔️" },
  3: { label: "Passed", icon: "✅" },
  4: { label: "Signed/Enacted", icon: "✍️" },
  5: { label: "Vetoed", icon: "🚫" },
};

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
  if (p === "L" || p === "LIBERTARIAN") return "hsl(30, 80%, 50%)";
  if (p === "G" || p === "GREEN") return "hsl(140, 60%, 40%)";
  return "hsl(var(--muted-foreground))";
}

function partyLabel(party: string) {
  const p = (party || "").toUpperCase();
  if (p === "D") return "Democrat";
  if (p === "R") return "Republican";
  if (p === "I") return "Independent";
  if (p === "L") return "Libertarian";
  if (p === "G") return "Green";
  return party;
}

function voteColor(voteText: string) {
  const v = (voteText || "").toLowerCase();
  if (v === "yea" || v === "aye") return "hsl(150, 60%, 40%)";
  if (v === "nay" || v === "no") return "hsl(0, 60%, 50%)";
  if (v === "nv" || v === "not voting") return "hsl(45, 60%, 50%)";
  return "hsl(var(--muted-foreground))";
}

function statusColor(status?: number) {
  if (status === 4) return "hsl(150, 60%, 40%)";
  if (status === 5) return "hsl(0, 60%, 50%)";
  if (status === 6) return "hsl(0, 40%, 50%)";
  if (status === 1) return "hsl(210, 60%, 50%)";
  if (status === 2 || status === 3) return "hsl(45, 70%, 45%)";
  return "hsl(var(--muted-foreground))";
}

// ─── Sub Components ─────────────────────────────────────────────────────────

function LoadingSpinner({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex items-center gap-3 text-muted-foreground">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        <span className="text-sm">{text}</span>
      </div>
    </div>
  );
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
      <ArrowLeft className="h-4 w-4" /> {label}
    </button>
  );
}

function StatRow({ label, value, suffix = "" }: { label: string; value: string | number | null | undefined; suffix?: string }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-foreground">
        {typeof value === "number" ? value.toLocaleString() : value}{suffix}
      </span>
    </div>
  );
}

// ─── Bill Card ──────────────────────────────────────────────────────────────

function BillCard({ bill, onClick }: { bill: BillResult | MasterListBill; onClick: () => void }) {
  const status = 'status' in bill ? bill.status : undefined;
  return (
    <div className="candidate-card animate-fade-in cursor-pointer" onClick={onClick}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide border bg-primary/10 text-primary border-primary/25">
              {bill.bill_number}
            </span>
            {'state' in bill && <span className="tag tag-governor">{bill.state}</span>}
            {status !== undefined && STATUS_LABELS[status] && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border" style={{ color: statusColor(status), borderColor: `${statusColor(status)}40`, backgroundColor: `${statusColor(status)}10` }}>
                {STATUS_LABELS[status]}
              </span>
            )}
          </div>
          <h3 className="font-display text-xs font-semibold text-foreground mt-1 line-clamp-2">{bill.title}</h3>
          {bill.last_action && (
            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">
              {bill.last_action_date && <span className="font-medium">{bill.last_action_date}: </span>}
              {bill.last_action}
            </p>
          )}
          {'relevance' in bill && bill.relevance !== undefined && (
            <div className="mt-1 flex items-center gap-1">
              <div className="h-1 w-16 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(bill.relevance, 100)}%` }} />
              </div>
              <span className="text-[9px] text-muted-foreground">{bill.relevance}% match</span>
            </div>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-2" />
      </div>
    </div>
  );
}

// ─── Roll Call Detail View ──────────────────────────────────────────────────

function RollCallDetailView({ rollCall, onBack }: { rollCall: RollCallDetail; onBack: () => void }) {
  const yeaVotes = rollCall.votes.filter(v => v.vote_text?.toLowerCase() === "yea" || v.vote_text?.toLowerCase() === "aye");
  const nayVotes = rollCall.votes.filter(v => v.vote_text?.toLowerCase() === "nay" || v.vote_text?.toLowerCase() === "no");
  const nvVotes = rollCall.votes.filter(v => v.vote_text?.toLowerCase() === "nv" || v.vote_text?.toLowerCase() === "not voting");
  const absentVotes = rollCall.votes.filter(v => v.vote_text?.toLowerCase() === "absent");

  const demYea = yeaVotes.filter(v => v.party === "D" || v.party === "Democrat").length;
  const repYea = yeaVotes.filter(v => v.party === "R" || v.party === "Republican").length;
  const demNay = nayVotes.filter(v => v.party === "D" || v.party === "Democrat").length;
  const repNay = nayVotes.filter(v => v.party === "R" || v.party === "Republican").length;

  return (
    <div className="animate-fade-in">
      <BackButton onClick={onBack} label="Back to bill" />

      <div className="flex items-center gap-2 flex-wrap mb-3">
        <Gavel className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-bold text-foreground">{rollCall.desc}</h2>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${rollCall.passed ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
          {rollCall.passed ? "✓ PASSED" : "✗ FAILED"}
        </span>
      </div>

      <div className="text-xs text-muted-foreground mb-4 flex flex-wrap gap-3">
        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {rollCall.date}</span>
        <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {rollCall.chamber}</span>
      </div>

      {/* Vote summary bar */}
      <div className="rounded-xl border border-border bg-card p-4 mb-4">
        <h3 className="font-display text-sm font-semibold text-foreground mb-3">Vote Totals</h3>
        <div className="grid grid-cols-4 gap-3 mb-3">
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color: "hsl(150, 60%, 40%)" }}>{rollCall.yea}</p>
            <p className="text-[10px] text-muted-foreground">Yea</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color: "hsl(0, 60%, 50%)" }}>{rollCall.nay}</p>
            <p className="text-[10px] text-muted-foreground">Nay</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color: "hsl(45, 60%, 50%)" }}>{rollCall.nv}</p>
            <p className="text-[10px] text-muted-foreground">Not Voting</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-muted-foreground">{rollCall.absent}</p>
            <p className="text-[10px] text-muted-foreground">Absent</p>
          </div>
        </div>
        {/* Visual bar */}
        <div className="h-3 w-full rounded-full overflow-hidden flex bg-muted">
          <div style={{ width: `${(rollCall.yea / rollCall.total) * 100}%`, background: "hsl(150, 60%, 40%)" }} />
          <div style={{ width: `${(rollCall.nay / rollCall.total) * 100}%`, background: "hsl(0, 60%, 50%)" }} />
          <div style={{ width: `${(rollCall.nv / rollCall.total) * 100}%`, background: "hsl(45, 60%, 50%)" }} />
          <div style={{ width: `${(rollCall.absent / rollCall.total) * 100}%`, background: "hsl(var(--muted))" }} />
        </div>

        {/* Party breakdown */}
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div className="p-2 rounded-lg border border-border/50">
            <span className="font-bold" style={{ color: "hsl(210, 80%, 50%)" }}>Democrats</span>
            <div className="flex gap-3 mt-1">
              <span>Yea: <b>{demYea}</b></span>
              <span>Nay: <b>{demNay}</b></span>
            </div>
          </div>
          <div className="p-2 rounded-lg border border-border/50">
            <span className="font-bold" style={{ color: "hsl(0, 70%, 50%)" }}>Republicans</span>
            <div className="flex gap-3 mt-1">
              <span>Yea: <b>{repYea}</b></span>
              <span>Nay: <b>{repNay}</b></span>
            </div>
          </div>
        </div>
      </div>

      {/* Individual votes */}
      {[
        { label: "Yea", votes: yeaVotes, icon: <CheckCircle2 className="h-4 w-4" style={{ color: "hsl(150, 60%, 40%)" }} /> },
        { label: "Nay", votes: nayVotes, icon: <XCircle className="h-4 w-4" style={{ color: "hsl(0, 60%, 50%)" }} /> },
        { label: "Not Voting", votes: nvVotes, icon: <MinusCircle className="h-4 w-4" style={{ color: "hsl(45, 60%, 50%)" }} /> },
        { label: "Absent", votes: absentVotes, icon: <AlertCircle className="h-4 w-4 text-muted-foreground" /> },
      ].filter(g => g.votes.length > 0).map(group => (
        <div key={group.label} className="rounded-xl border border-border bg-card p-4 mb-3">
          <h3 className="font-display text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            {group.icon} {group.label} ({group.votes.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
            {group.votes.map((v, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] py-0.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: partyColor(v.party || "") }} />
                <span className="truncate">{v.name || `Person #${v.people_id}`}</span>
                {v.party && <span className="text-muted-foreground shrink-0">({v.party})</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Person Detail View ─────────────────────────────────────────────────────

function PersonDetailView({
  person,
  sponsoredBills,
  onBack,
  onBillClick,
}: {
  person: PersonDetail;
  sponsoredBills: SponsoredBill[];
  onBack: () => void;
  onBillClick: (billId: number) => void;
}) {
  return (
    <div className="animate-fade-in">
      <BackButton onClick={onBack} label="Back to results" />

      <div className="flex items-center gap-4 mb-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${partyColor(person.party)}15` }}>
          <User className="h-7 w-7" style={{ color: partyColor(person.party) }} />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">{person.name}</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <span className="font-bold" style={{ color: partyColor(person.party) }}>{partyLabel(person.party)}</span>
            <span>•</span>
            <span>{person.role}</span>
            <span>•</span>
            <span>{STATE_NAMES[person.state] || person.state}</span>
            {person.district && <><span>•</span><span>District {person.district}</span></>}
          </div>
        </div>
      </div>

      {/* External links */}
      <div className="flex flex-wrap gap-2 mb-4">
        {person.ballotpedia && (
          <a href={`https://ballotpedia.org/${person.ballotpedia}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline border border-primary/20 rounded-lg px-2 py-1">
            <ExternalLink className="h-3 w-3" /> Ballotpedia
          </a>
        )}
        {person.votesmart_id && (
          <a href={`https://justfacts.votesmart.org/candidate/${person.votesmart_id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline border border-primary/20 rounded-lg px-2 py-1">
            <ExternalLink className="h-3 w-3" /> VoteSmart
          </a>
        )}
        {person.opensecrets_id && (
          <a href={`https://www.opensecrets.org/members-of-congress/summary?cid=${person.opensecrets_id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline border border-primary/20 rounded-lg px-2 py-1">
            <ExternalLink className="h-3 w-3" /> OpenSecrets
          </a>
        )}
        {person.followthemoney_eid && (
          <a href={`https://www.followthemoney.org/entity-details?eid=${person.followthemoney_eid}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline border border-primary/20 rounded-lg px-2 py-1">
            <ExternalLink className="h-3 w-3" /> FollowTheMoney
          </a>
        )}
      </div>

      {/* Profile details */}
      <div className="rounded-xl border border-border bg-card p-4 mb-4">
        <h3 className="font-display text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
          <User className="h-4 w-4 text-primary" /> Profile
        </h3>
        <StatRow label="Full Name" value={[person.first_name, person.middle_name, person.last_name, person.suffix].filter(Boolean).join(" ") || person.name} />
        {person.nickname && <StatRow label="Nickname" value={person.nickname} />}
        <StatRow label="Party" value={partyLabel(person.party)} />
        <StatRow label="Role" value={person.role} />
        <StatRow label="State" value={STATE_NAMES[person.state] || person.state} />
        {person.district && <StatRow label="District" value={person.district} />}
        {person.people_id && <StatRow label="LegiScan ID" value={person.people_id} />}
      </div>

      {/* Sponsored Bills */}
      {sponsoredBills.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-display text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Sponsored Bills ({sponsoredBills.length})
          </h3>
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
            {sponsoredBills.map((b) => (
              <button
                key={b.bill_id}
                onClick={() => onBillClick(b.bill_id)}
                className="w-full text-left flex items-start gap-2 text-xs border-b border-border/30 pb-1.5 hover:bg-muted/50 rounded px-1 transition-colors"
              >
                <span className="font-bold text-primary shrink-0">{b.bill_number}</span>
                <span className="text-foreground line-clamp-1">{b.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bill Text View ─────────────────────────────────────────────────────────

function BillTextView({ text, docInfo, onBack }: { text: string; docInfo: { type: string; date: string; bill_number: string }; onBack: () => void }) {
  return (
    <div className="animate-fade-in">
      <BackButton onClick={onBack} label="Back to bill" />
      <div className="flex items-center gap-2 mb-3">
        <ScrollText className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-bold text-foreground">{docInfo.bill_number} — {docInfo.type}</h2>
        <span className="text-xs text-muted-foreground">{docInfo.date}</span>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 text-xs font-mono whitespace-pre-wrap max-h-[70vh] overflow-y-auto leading-relaxed text-foreground">
        {text || "No text available."}
      </div>
    </div>
  );
}

// ─── Bill Detail View (Expanded) ────────────────────────────────────────────

function BillDetailView({
  bill,
  onBack,
  onViewRollCall,
  onViewPerson,
  onViewText,
}: {
  bill: BillDetail;
  onBack: () => void;
  onViewRollCall: (id: number) => void;
  onViewPerson: (id: number) => void;
  onViewText: (docId: number, type: string, date: string) => void;
}) {
  return (
    <div className="animate-fade-in">
      <BackButton onClick={onBack} label="Back to results" />

      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold tracking-wide border bg-primary/10 text-primary border-primary/25">
          {bill.bill_number}
        </span>
        <span className="tag tag-governor">{bill.state}</span>
        {bill.status !== undefined && STATUS_LABELS[bill.status] && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border" style={{ color: statusColor(bill.status), borderColor: `${statusColor(bill.status)}40`, backgroundColor: `${statusColor(bill.status)}10` }}>
            {STATUS_LABELS[bill.status]}
          </span>
        )}
        {bill.body && (
          <span className="text-[10px] text-muted-foreground border border-border rounded-full px-2 py-0.5">{bill.body}</span>
        )}
      </div>

      <h2 className="font-display text-lg font-bold text-foreground mb-1">{bill.title}</h2>
      {bill.description && <p className="text-sm text-muted-foreground mb-2">{bill.description}</p>}

      {/* Status & dates */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
        {bill.status_date && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Status: {bill.status_date}</span>}
        {bill.last_action_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Last action: {bill.last_action_date}</span>}
        {bill.session?.session_name && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {bill.session.session_name}</span>}
      </div>

      {/* External links */}
      <div className="flex flex-wrap gap-2 mb-4">
        {bill.url && (
          <a href={bill.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline border border-primary/20 rounded-lg px-2 py-1">
            <ExternalLink className="h-3 w-3" /> LegiScan
          </a>
        )}
        {bill.state_link && (
          <a href={bill.state_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline border border-primary/20 rounded-lg px-2 py-1">
            <ExternalLink className="h-3 w-3" /> State Legislature
          </a>
        )}
      </div>

      {/* Progress tracker */}
      {bill.progress && bill.progress.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 mb-4">
          <h3 className="font-display text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <ListOrdered className="h-4 w-4 text-primary" /> Progress
          </h3>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {bill.progress.map((p, i) => {
              const evt = PROGRESS_EVENTS[p.event] || { label: `Step ${p.event}`, icon: "📌" };
              return (
                <div key={i} className="flex items-center">
                  <div className="flex flex-col items-center text-center min-w-[80px]">
                    <span className="text-lg">{evt.icon}</span>
                    <span className="text-[10px] font-bold text-foreground">{evt.label}</span>
                    <span className="text-[9px] text-muted-foreground">{p.date}</span>
                  </div>
                  {i < bill.progress!.length - 1 && (
                    <div className="h-0.5 w-6 bg-primary/30 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Committee / Referrals */}
      {(bill.committee || (bill.referrals && bill.referrals.length > 0)) && (
        <div className="rounded-xl border border-border bg-card p-4 mb-4">
          <h3 className="font-display text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> Committee
          </h3>
          {bill.committee && (
            <div className="text-xs mb-2">
              <span className="font-medium text-foreground">{bill.committee.name}</span>
              <span className="text-muted-foreground ml-2">({bill.committee.chamber})</span>
            </div>
          )}
          {bill.referrals && bill.referrals.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground">REFERRALS</p>
              {bill.referrals.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs border-b border-border/30 pb-1">
                  <span className="text-foreground">{r.name} <span className="text-muted-foreground">({r.chamber})</span></span>
                  <span className="text-muted-foreground">{r.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sponsors */}
      {bill.sponsors && bill.sponsors.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 mb-4">
          <h3 className="font-display text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Sponsors ({bill.sponsors.length})
          </h3>
          <div className="space-y-1.5">
            {bill.sponsors.map((s, i) => (
              <button
                key={i}
                onClick={() => s.people_id && onViewPerson(s.people_id)}
                className="w-full text-left flex items-center gap-2 text-xs hover:bg-muted/50 rounded px-1 py-0.5 transition-colors"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: partyColor(s.party || "") }} />
                <span className="font-medium text-foreground hover:underline">{s.name}</span>
                {s.party && <span className="text-muted-foreground">({s.party})</span>}
                {s.role && <span className="text-muted-foreground italic">{s.role}</span>}
                <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bill Texts */}
      {bill.texts && bill.texts.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 mb-4">
          <h3 className="font-display text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-primary" /> Bill Texts ({bill.texts.length})
          </h3>
          <div className="space-y-1.5">
            {bill.texts.map((t) => (
              <div key={t.doc_id} className="flex items-center justify-between text-xs border-b border-border/30 pb-1.5">
                <div className="flex items-center gap-2">
                  <FileText className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium text-foreground">{t.type}</span>
                  <span className="text-muted-foreground">{t.date}</span>
                  {t.text_size && <span className="text-muted-foreground">({Math.round(t.text_size / 1024)}KB)</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => onViewText(t.doc_id, t.type, t.date)} className="text-primary hover:underline flex items-center gap-1">
                    <Eye className="h-3 w-3" /> View
                  </button>
                  {t.state_link && (
                    <a href={t.state_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> Source
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Amendments */}
      {bill.amendments && bill.amendments.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 mb-4">
          <h3 className="font-display text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <FilePlus2 className="h-4 w-4 text-primary" /> Amendments ({bill.amendments.length})
          </h3>
          <div className="space-y-2">
            {bill.amendments.map((a) => (
              <div key={a.amendment_id} className="border-b border-border/30 pb-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{a.title}</span>
                    {a.adopted !== undefined && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${a.adopted ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {a.adopted ? "Adopted" : "Pending"}
                      </span>
                    )}
                  </div>
                  <span className="text-muted-foreground shrink-0 ml-2">{a.date}</span>
                </div>
                {a.description && <p className="text-[10px] text-muted-foreground mt-0.5">{a.description}</p>}
                {a.chamber && <span className="text-[9px] text-muted-foreground">{a.chamber}</span>}
                <div className="flex gap-2 mt-1">
                  {a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline">LegiScan</a>}
                  {a.state_link && <a href={a.state_link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline">Source</a>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Supplements */}
      {bill.supplements && bill.supplements.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 mb-4">
          <h3 className="font-display text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-primary" /> Supplemental Documents ({bill.supplements.length})
          </h3>
          <div className="space-y-2">
            {bill.supplements.map((s) => (
              <div key={s.supplement_id} className="flex items-center justify-between text-xs border-b border-border/30 pb-1.5">
                <div>
                  <span className="font-medium text-foreground">{s.title}</span>
                  {s.type && <span className="text-muted-foreground ml-2">({s.type})</span>}
                  <span className="text-muted-foreground ml-2">{s.date}</span>
                  {s.description && <p className="text-[10px] text-muted-foreground mt-0.5">{s.description}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View</a>}
                  {s.state_link && <a href={s.state_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Source</a>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendar */}
      {bill.calendar && bill.calendar.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 mb-4">
          <h3 className="font-display text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Upcoming Calendar
          </h3>
          <div className="space-y-1.5">
            {bill.calendar.map((c, i) => (
              <div key={i} className="flex items-start gap-2 text-xs border-b border-border/30 pb-1">
                <span className="text-muted-foreground font-mono shrink-0 w-20">{c.date}</span>
                {c.time && <span className="text-muted-foreground shrink-0">{c.time}</span>}
                <span className="text-foreground">{c.description || c.type}</span>
                {c.location && <span className="text-muted-foreground">@ {c.location}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Same As / Similar To */}
      {bill.sasts && bill.sasts.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 mb-4">
          <h3 className="font-display text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" /> Related Bills
          </h3>
          <div className="flex flex-wrap gap-2">
            {bill.sasts.map((s, i) => (
              <span key={i} className="text-xs border border-border rounded-lg px-2 py-1">
                {s.type && <span className="text-muted-foreground">{s.type}: </span>}
                <span className="font-medium text-primary">{s.sast_bill_number}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Votes (Roll Calls) */}
      {bill.votes && bill.votes.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 mb-4">
          <h3 className="font-display text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <Vote className="h-4 w-4 text-primary" /> Roll Call Votes ({bill.votes.length})
          </h3>
          <div className="space-y-2">
            {bill.votes.map((v) => (
              <button
                key={v.roll_call_id}
                onClick={() => onViewRollCall(v.roll_call_id)}
                className="w-full text-left border-b border-border/50 pb-2 hover:bg-muted/50 rounded px-1 transition-colors"
              >
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-medium text-foreground">{v.desc}</span>
                    <span className="text-muted-foreground ml-2">{v.date}</span>
                    {v.chamber && <span className="text-muted-foreground ml-2">({v.chamber})</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span style={{ color: "hsl(150, 60%, 40%)" }} className="font-bold">Y:{v.yea}</span>
                    <span style={{ color: "hsl(0, 60%, 50%)" }} className="font-bold">N:{v.nay}</span>
                    {v.nv > 0 && <span style={{ color: "hsl(45, 60%, 50%)" }}>NV:{v.nv}</span>}
                    <span className={`font-bold ${v.passed ? "text-primary" : "text-destructive"}`}>
                      {v.passed ? "✓" : "✗"}
                    </span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
                {/* Mini vote bar */}
                <div className="h-1.5 w-full rounded-full overflow-hidden flex bg-muted mt-1">
                  <div style={{ width: `${(v.yea / v.total) * 100}%`, background: "hsl(150, 60%, 40%)" }} />
                  <div style={{ width: `${(v.nay / v.total) * 100}%`, background: "hsl(0, 60%, 50%)" }} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {bill.history && bill.history.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 mb-4">
          <h3 className="font-display text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Full Legislative History ({bill.history.length} actions)
          </h3>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {bill.history.map((h, i) => (
              <div key={i} className="flex items-start gap-2 text-xs border-b border-border/30 pb-1">
                <span className="text-muted-foreground font-mono shrink-0 w-20">{h.date}</span>
                {h.chamber && <span className="text-[9px] shrink-0 text-muted-foreground border border-border rounded px-1">{h.chamber}</span>}
                <span className={`text-foreground ${h.importance === 1 ? "font-bold" : ""}`}>{h.action}</span>
              </div>
            ))}
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

function LegislatorCard({ person, onClick }: { person: PersonResult; onClick: () => void }) {
  return (
    <div className="candidate-card animate-fade-in cursor-pointer" onClick={onClick}>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${partyColor(person.party)}20` }}>
          <User className="h-4 w-4" style={{ color: partyColor(person.party) }} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xs font-semibold text-foreground">{person.name}</h3>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="font-medium" style={{ color: partyColor(person.party) }}>{partyLabel(person.party)}</span>
            <span>•</span>
            <span>{person.role}</span>
            <span>•</span>
            <span>{STATE_NAMES[person.state] || person.state}</span>
            {person.district && <><span>•</span><span>Dist. {person.district}</span></>}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
    </div>
  );
}

// ─── Session Card ───────────────────────────────────────────────────────────

function SessionCard({ session, onClick }: { session: SessionInfo; onClick: () => void }) {
  return (
    <div className="candidate-card animate-fade-in cursor-pointer" onClick={onClick}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-xs font-semibold text-foreground">{session.session_name || session.session_title || session.name}</h3>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
            <span>{session.year_start}–{session.year_end}</span>
            {session.special === 1 && <span className="tag tag-senate">Special Session</span>}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
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
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionBills, setSessionBills] = useState<MasterListBill[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionInfo | null>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);

  // Sub-views
  const [subView, setSubView] = useState<SubView>(null);
  const [selectedBill, setSelectedBill] = useState<BillDetail | null>(null);
  const [selectedRollCall, setSelectedRollCall] = useState<RollCallDetail | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<PersonDetail | null>(null);
  const [sponsoredBills, setSponsoredBills] = useState<SponsoredBill[]>([]);
  const [billText, setBillText] = useState("");
  const [billTextInfo, setBillTextInfo] = useState<{ type: string; date: string; bill_number: string }>({ type: "", date: "", bill_number: "" });

  // Load sessions when switching to sessions tab
  useEffect(() => {
    if (tab === "sessions") {
      setLoading(true);
      callLegiScan({ op: "getSessionList", state: stateFilter }).then((data) => {
        const list = data?.sessions || [];
        setSessions(list.reverse());
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [tab, stateFilter]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() && tab === "bills") return;
    setLoading(true);
    setSearchPerformed(true);
    setSubView(null);

    try {
      if (tab === "bills") {
        const data = await callLegiScan({ op: "getSearch", state: stateFilter, query: searchQuery });
        const results = data?.searchresult || {};
        const billList: BillResult[] = [];
        for (const key of Object.keys(results)) {
          if (key === "summary") continue;
          const b = results[key];
          if (b?.bill_id) billList.push(b);
        }
        setBills(billList);
      } else if (tab === "legislators") {
        const sessionData = await callLegiScan({ op: "getSessionList", state: stateFilter });
        const sessionList = sessionData?.sessions || [];
        if (sessionList.length > 0) {
          const latestSession = sessionList[sessionList.length - 1];
          const sessionPeople = await callLegiScan({ op: "getSessionPeople", id: String(latestSession.session_id) });
          const people = sessionPeople?.sessionpeople?.people || [];
          const q = searchQuery.toLowerCase();
          const filtered = q ? people.filter((p: PersonResult) => p.name?.toLowerCase().includes(q)) : people;
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

  const loadBill = useCallback(async (billId: number) => {
    setLoading(true);
    try {
      const data = await callLegiScan({ op: "getBill", id: String(billId) });
      if (data?.bill) {
        setSelectedBill(data.bill);
        setSubView("bill");
      }
    } catch (e) {
      console.error("getBill error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRollCall = useCallback(async (rollCallId: number) => {
    setLoading(true);
    try {
      const data = await callLegiScan({ op: "getRollCall", id: String(rollCallId) });
      if (data?.roll_call) {
        setSelectedRollCall(data.roll_call);
        setSubView("rollcall");
      }
    } catch (e) {
      console.error("getRollCall error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPerson = useCallback(async (peopleId: number) => {
    setLoading(true);
    try {
      const [personData, sponsoredData] = await Promise.all([
        callLegiScan({ op: "getPerson", id: String(peopleId) }),
        callLegiScan({ op: "getSponsoredList", id: String(peopleId) }),
      ]);
      if (personData?.person) {
        setSelectedPerson(personData.person);
        const sponsored = sponsoredData?.sponsoredbills?.bills || [];
        // sponsoredData could also be a dict keyed by index
        const billArr: SponsoredBill[] = Array.isArray(sponsored) ? sponsored :
          Object.values(sponsored).filter((b: any) => b?.bill_id);
        setSponsoredBills(billArr);
        setSubView("person");
      }
    } catch (e) {
      console.error("getPerson error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBillText = useCallback(async (docId: number, type: string, date: string) => {
    setLoading(true);
    try {
      const data = await callLegiScan({ op: "getBillText", id: String(docId) });
      if (data?.text) {
        // Text is base64 encoded
        const decoded = data.text.doc ? atob(data.text.doc) : "";
        setBillText(decoded);
        setBillTextInfo({ type, date, bill_number: selectedBill?.bill_number || "" });
        setSubView("billtext");
      }
    } catch (e) {
      console.error("getBillText error:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedBill]);

  const loadSessionBills = useCallback(async (session: SessionInfo) => {
    setLoading(true);
    setSelectedSession(session);
    try {
      const data = await callLegiScan({ op: "getMasterList", id: String(session.session_id) });
      const ml = data?.masterlist || {};
      const billArr: MasterListBill[] = [];
      for (const key of Object.keys(ml)) {
        if (key === "session") continue;
        const b = ml[key];
        if (b?.bill_id) billArr.push(b);
      }
      setSessionBills(billArr);
      setSubView("session-bills");
    } catch (e) {
      console.error("getMasterList error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Render sub-views ─────────────────────────────────────────────────────

  if (loading && subView !== null) {
    return <LoadingSpinner text="Loading data from LegiScan…" />;
  }

  if (subView === "billtext") {
    return <BillTextView text={billText} docInfo={billTextInfo} onBack={() => setSubView("bill")} />;
  }

  if (subView === "rollcall" && selectedRollCall) {
    return <RollCallDetailView rollCall={selectedRollCall} onBack={() => setSubView("bill")} />;
  }

  if (subView === "person" && selectedPerson) {
    return (
      <PersonDetailView
        person={selectedPerson}
        sponsoredBills={sponsoredBills}
        onBack={() => setSubView(searchPerformed ? null : "bill")}
        onBillClick={loadBill}
      />
    );
  }

  if (subView === "bill" && selectedBill) {
    return (
      <BillDetailView
        bill={selectedBill}
        onBack={() => {
          setSubView(selectedSession ? "session-bills" : null);
          setSelectedBill(null);
        }}
        onViewRollCall={loadRollCall}
        onViewPerson={loadPerson}
        onViewText={loadBillText}
      />
    );
  }

  if (subView === "session-bills" && selectedSession) {
    return (
      <div className="animate-fade-in">
        <BackButton onClick={() => { setSubView(null); setSelectedSession(null); setSessionBills([]); }} label="Back to sessions" />
        <h2 className="font-display text-lg font-bold text-foreground mb-1">{selectedSession.session_name || selectedSession.name}</h2>
        <p className="text-sm text-muted-foreground mb-4">{sessionBills.length} bills in this session</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {sessionBills.slice(0, 200).map((b) => (
            <BillCard key={b.bill_id} bill={b} onClick={() => loadBill(b.bill_id)} />
          ))}
        </div>
        {sessionBills.length > 200 && (
          <p className="text-center text-xs text-muted-foreground mt-4">
            Showing 200 of {sessionBills.length} bills.
          </p>
        )}
      </div>
    );
  }

  // ─── Main view ────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Tab toggle */}
      <div className="inline-flex rounded-lg border border-border overflow-hidden mb-4">
        {(["bills", "legislators", "sessions"] as Tab[]).map((t, i) => (
          <button
            key={t}
            onClick={() => { setTab(t); setSearchPerformed(false); setSubView(null); }}
            className={`px-4 py-1.5 text-xs font-medium transition-colors ${
              i > 0 ? "border-l border-border" : ""
            } ${
              tab === t ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "bills" && <span className="flex items-center gap-1.5"><FileText className="h-3 w-3" /> Bills</span>}
            {t === "legislators" && <span className="flex items-center gap-1.5"><Users className="h-3 w-3" /> Legislators</span>}
            {t === "sessions" && <span className="flex items-center gap-1.5"><BookOpen className="h-3 w-3" /> Sessions</span>}
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

        {tab !== "sessions" && (
          <>
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
              ) : "Search"}
            </button>
          </>
        )}
      </div>

      {/* Info box */}
      <div className="rounded-lg border border-border bg-card/50 p-3 mb-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-1">📜 LegiScan Legislative Data</p>
        <p>
          {tab === "bills" && "Search bills across all 50 states and US Congress. Click any bill for full details including sponsors, vote records, amendments, bill text, committee referrals, and progress tracking."}
          {tab === "legislators" && "Browse current legislators by state. Click any legislator to see their full profile, external links (Ballotpedia, VoteSmart, OpenSecrets), and all sponsored legislation."}
          {tab === "sessions" && "Browse legislative sessions by state. Click any session to see the complete master list of all bills introduced in that session."}
        </p>
      </div>

      {/* Loading */}
      {loading && <LoadingSpinner text="Searching LegiScan…" />}

      {/* Sessions tab */}
      {!loading && tab === "sessions" && (
        <>
          <p className="text-sm text-muted-foreground mb-3">{sessions.length} sessions for {STATE_NAMES[stateFilter] || stateFilter}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {sessions.map((s) => (
              <SessionCard key={s.session_id} session={s} onClick={() => loadSessionBills(s)} />
            ))}
          </div>
          {sessions.length === 0 && (
            <div className="text-center py-12">
              <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No sessions found for this state.</p>
            </div>
          )}
        </>
      )}

      {/* Bills results */}
      {!loading && searchPerformed && tab === "bills" && (
        <>
          <p className="text-sm text-muted-foreground mb-3">{bills.length} bills found</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {bills.slice(0, 100).map((b) => (
              <BillCard key={b.bill_id} bill={b} onClick={() => loadBill(b.bill_id)} />
            ))}
          </div>
          {bills.length > 100 && <p className="text-center text-xs text-muted-foreground mt-4">Showing 100 of {bills.length} bills. Refine your search for more specific results.</p>}
          {bills.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No bills found. Try a different search term or state.</p>
            </div>
          )}
        </>
      )}

      {/* Legislators results */}
      {!loading && searchPerformed && tab === "legislators" && (
        <>
          <p className="text-sm text-muted-foreground mb-3">{legislators.length} legislators found</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {legislators.slice(0, 200).map((p) => (
              <LegislatorCard key={p.people_id} person={p} onClick={() => loadPerson(p.people_id)} />
            ))}
          </div>
          {legislators.length > 200 && <p className="text-center text-xs text-muted-foreground mt-4">Showing 200 of {legislators.length} legislators.</p>}
          {legislators.length === 0 && (
            <div className="text-center py-12">
              <User className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No legislators found for this state/search.</p>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!loading && !searchPerformed && tab !== "sessions" && (
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
