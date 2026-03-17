import { useState, useEffect, useCallback } from "react";
import {
  Building2, Users, FileText, Vote, Loader2, RefreshCw,
  ChevronRight, ExternalLink, Search, User, Gavel
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

interface CongressMember {
  id: string;
  bioguide_id: string;
  name: string;
  party: string | null;
  state: string | null;
  district: string | null;
  chamber: string;
  depiction_url: string | null;
  official_url: string | null;
}

interface CongressBill {
  id: string;
  bill_id: string;
  bill_type: string;
  bill_number: number;
  title: string;
  short_title: string | null;
  sponsor_name: string | null;
  latest_action_text: string | null;
  latest_action_date: string | null;
  policy_area: string | null;
  cosponsor_count: number;
  congress_url: string | null;
}

interface CongressCommittee {
  id: string;
  system_code: string;
  name: string;
  chamber: string;
  committee_type: string | null;
}

interface CongressVote {
  id: string;
  vote_id: string;
  chamber: string;
  roll_number: number;
  vote_date: string | null;
  question: string | null;
  description: string | null;
  result: string | null;
  yea_total: number;
  nay_total: number;
  not_voting_total: number;
}

type TabKey = "members" | "bills" | "committees" | "votes";

function partyColor(party: string | null) {
  const p = (party || "").toLowerCase();
  if (p.includes("democrat")) return "hsl(210, 80%, 50%)";
  if (p.includes("republican")) return "hsl(0, 70%, 50%)";
  if (p.includes("independent")) return "hsl(45, 80%, 50%)";
  return "hsl(var(--muted-foreground))";
}

// ─── Component ──────────────────────────────────────────────────────────────

export function CongressDataPanel() {
  const { session } = useAuth();
  const { isAdmin } = useUserRole();
  const [activeTab, setActiveTab] = useState<TabKey>("members");
  const [syncing, setSyncing] = useState(false);
  const [syncAction, setSyncAction] = useState("");

  // Data
  const [members, setMembers] = useState<CongressMember[]>([]);
  const [bills, setBills] = useState<CongressBill[]>([]);
  const [committees, setCommittees] = useState<CongressCommittee[]>([]);
  const [votes, setVotes] = useState<CongressVote[]>([]);
  const [loading, setLoading] = useState(true);

  // Counts
  const [memberCount, setMemberCount] = useState(0);
  const [billCount, setBillCount] = useState(0);
  const [committeeCount, setCommitteeCount] = useState(0);
  const [voteCount, setVoteCount] = useState(0);

  // Filters
  const [chamberFilter, setChamberFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // Load counts on mount
  useEffect(() => {
    Promise.all([
      supabase.from("congress_members").select("id", { count: "exact", head: true }),
      supabase.from("congress_bills").select("id", { count: "exact", head: true }),
      supabase.from("congress_committees").select("id", { count: "exact", head: true }),
      supabase.from("congress_votes").select("id", { count: "exact", head: true }),
    ]).then(([m, b, c, v]) => {
      setMemberCount(m.count || 0);
      setBillCount(b.count || 0);
      setCommitteeCount(c.count || 0);
      setVoteCount(v.count || 0);
    });
  }, []);

  // Load data for active tab
  useEffect(() => {
    setLoading(true);
    const lowerSearch = searchQuery.toLowerCase();

    const loadData = async () => {
      switch (activeTab) {
        case "members": {
          let q = supabase
            .from("congress_members")
            .select("id,bioguide_id,name,party,state,district,chamber,depiction_url,official_url")
            .order("name")
            .limit(100);
          if (chamberFilter) q = q.eq("chamber", chamberFilter);
          if (searchQuery) q = q.ilike("name", `%${searchQuery}%`);
          const { data } = await q;
          setMembers((data as CongressMember[]) || []);
          break;
        }
        case "bills": {
          let q = supabase
            .from("congress_bills")
            .select("id,bill_id,bill_type,bill_number,title,short_title,sponsor_name,latest_action_text,latest_action_date,policy_area,cosponsor_count,congress_url")
            .order("latest_action_date", { ascending: false })
            .limit(100);
          if (searchQuery) q = q.ilike("title", `%${searchQuery}%`);
          const { data } = await q;
          setBills((data as CongressBill[]) || []);
          break;
        }
        case "committees": {
          let q = supabase
            .from("congress_committees")
            .select("id,system_code,name,chamber,committee_type")
            .order("name")
            .limit(100);
          if (chamberFilter) q = q.eq("chamber", chamberFilter);
          if (searchQuery) q = q.ilike("name", `%${searchQuery}%`);
          const { data } = await q;
          setCommittees((data as CongressCommittee[]) || []);
          break;
        }
        case "votes": {
          let q = supabase
            .from("congress_votes")
            .select("id,vote_id,chamber,roll_number,vote_date,question,description,result,yea_total,nay_total,not_voting_total")
            .order("vote_date", { ascending: false })
            .limit(100);
          if (chamberFilter) q = q.eq("chamber", chamberFilter);
          if (searchQuery) q = q.ilike("description", `%${searchQuery}%`);
          const { data } = await q;
          setVotes((data as CongressVote[]) || []);
          break;
        }
      }
      setLoading(false);
    };

    loadData();
  }, [activeTab, chamberFilter, searchQuery]);

  // Sync handler
  const handleSync = useCallback(async (action: string) => {
    if (!session?.access_token) {
      toast.error("Please sign in");
      return;
    }
    setSyncing(true);
    setSyncAction(action);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const params = new URLSearchParams({ action, congress: "119", limit: "100" });
      if (chamberFilter) params.set("chamber", chamberFilter);

      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/congress-sync?${params}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Sync failed");

      toast.success(`Synced ${data.total_synced} records${data.total_errors > 0 ? ` (${data.total_errors} errors)` : ""}`);

      // Refresh counts and data
      const [m, b, c, v] = await Promise.all([
        supabase.from("congress_members").select("id", { count: "exact", head: true }),
        supabase.from("congress_bills").select("id", { count: "exact", head: true }),
        supabase.from("congress_committees").select("id", { count: "exact", head: true }),
        supabase.from("congress_votes").select("id", { count: "exact", head: true }),
      ]);
      setMemberCount(m.count || 0);
      setBillCount(b.count || 0);
      setCommitteeCount(c.count || 0);
      setVoteCount(v.count || 0);

      // Reload active tab data
      setSearchQuery(s => s); // trigger re-fetch
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSyncing(false);
      setSyncAction("");
    }
  }, [session, chamberFilter]);

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; count: number }[] = [
    { key: "members", label: "Members", icon: <Users className="h-3 w-3" />, count: memberCount },
    { key: "bills", label: "Bills", icon: <FileText className="h-3 w-3" />, count: billCount },
    { key: "committees", label: "Committees", icon: <Building2 className="h-3 w-3" />, count: committeeCount },
    { key: "votes", label: "Votes", icon: <Vote className="h-3 w-3" />, count: voteCount },
  ];

  return (
    <div className="space-y-3">
      {/* Header with sync controls */}
      <div className="win98-raised bg-[hsl(var(--win98-face))] p-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-bold flex items-center gap-1">
            🏛️ Congress.gov Data (119th Congress)
          </h3>
          {isAdmin && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleSync(`sync_${activeTab}`)}
                disabled={syncing}
                className="win98-button text-[9px] px-2 py-0.5 flex items-center gap-1"
              >
                {syncing && syncAction === `sync_${activeTab}` ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-2.5 w-2.5" />
                )}
                Sync {tabs.find(t => t.key === activeTab)?.label}
              </button>
              <button
                onClick={() => handleSync("sync_all")}
                disabled={syncing}
                className="win98-button text-[9px] px-2 py-0.5 flex items-center gap-1"
              >
                {syncing && syncAction === "sync_all" ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-2.5 w-2.5" />
                )}
                Sync All
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 mb-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1 px-2 py-1 text-[10px] font-bold border ${
                activeTab === tab.key
                  ? "bg-[hsl(var(--win98-face))] border-t-[hsl(var(--win98-hilight))] border-l-[hsl(var(--win98-hilight))] border-b-transparent border-r-[hsl(var(--win98-shadow))]"
                  : "bg-[hsl(var(--win98-light))] border-[hsl(var(--win98-shadow))] hover:bg-[hsl(var(--win98-face))]"
              }`}
            >
              {tab.icon} {tab.label}
              <span className="text-[8px] text-[hsl(var(--muted-foreground))]">({tab.count})</span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-1 flex-1 win98-sunken bg-white px-2 py-0.5">
            <Search className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab}…`}
              className="flex-1 bg-transparent text-[10px] outline-none"
            />
          </div>
          {(activeTab !== "bills") && (
            <select
              value={chamberFilter}
              onChange={(e) => setChamberFilter(e.target.value)}
              className="win98-sunken bg-white text-[10px] px-1 py-0.5"
            >
              <option value="">All Chambers</option>
              <option value="house">House</option>
              <option value="senate">Senate</option>
            </select>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="win98-sunken bg-white max-h-[500px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-[10px] text-[hsl(var(--muted-foreground))]">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
          </div>
        ) : (
          <>
            {activeTab === "members" && <MembersTable members={members} />}
            {activeTab === "bills" && <BillsTable bills={bills} />}
            {activeTab === "committees" && <CommitteesTable committees={committees} />}
            {activeTab === "votes" && <VotesTable votes={votes} />}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function MembersTable({ members }: { members: CongressMember[] }) {
  if (members.length === 0) return <EmptyState text="No members found. Sync from Congress.gov to populate." />;
  return (
    <table className="w-full text-[10px]">
      <thead className="bg-[hsl(var(--win98-light))] sticky top-0">
        <tr>
          <th className="text-left px-2 py-1 font-bold">Name</th>
          <th className="text-left px-2 py-1 font-bold">Party</th>
          <th className="text-left px-2 py-1 font-bold">State</th>
          <th className="text-left px-2 py-1 font-bold">Dist.</th>
          <th className="text-left px-2 py-1 font-bold">Chamber</th>
          <th className="px-2 py-1"></th>
        </tr>
      </thead>
      <tbody>
        {members.map((m) => (
          <tr key={m.id} className="border-b border-[hsl(var(--win98-light))] hover:bg-[hsl(var(--win98-light))]">
            <td className="px-2 py-1 font-bold flex items-center gap-1">
              {m.depiction_url ? (
                <img src={m.depiction_url} alt="" className="h-4 w-4 rounded-full object-cover" />
              ) : (
                <User className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
              )}
              {m.name}
            </td>
            <td className="px-2 py-1">
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: partyColor(m.party) }} />
                {m.party || "—"}
              </span>
            </td>
            <td className="px-2 py-1">{m.state || "—"}</td>
            <td className="px-2 py-1">{m.district || "—"}</td>
            <td className="px-2 py-1 capitalize">{m.chamber}</td>
            <td className="px-2 py-1">
              {m.official_url && (
                <a href={m.official_url} target="_blank" rel="noopener noreferrer" className="text-[hsl(var(--primary))]">
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BillsTable({ bills }: { bills: CongressBill[] }) {
  if (bills.length === 0) return <EmptyState text="No bills found. Sync from Congress.gov to populate." />;
  return (
    <div className="divide-y divide-[hsl(var(--win98-light))]">
      {bills.map((b) => (
        <div key={b.id} className="px-2 py-1.5 hover:bg-[hsl(var(--win98-light))]">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-bold text-[10px] text-[hsl(var(--primary))] uppercase shrink-0">
                  {b.bill_type.toUpperCase()} {b.bill_number}
                </span>
                {b.policy_area && (
                  <span className="text-[8px] bg-[hsl(var(--win98-light))] px-1 rounded">
                    {b.policy_area}
                  </span>
                )}
              </div>
              <p className="text-[10px] font-medium line-clamp-2">{b.short_title || b.title}</p>
              {b.sponsor_name && (
                <p className="text-[9px] text-[hsl(var(--muted-foreground))]">
                  Sponsor: {b.sponsor_name} · {b.cosponsor_count} cosponsors
                </p>
              )}
              {b.latest_action_text && (
                <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-0.5">
                  Latest: {b.latest_action_text} ({b.latest_action_date})
                </p>
              )}
            </div>
            {b.congress_url && (
              <a href={b.congress_url} target="_blank" rel="noopener noreferrer" className="text-[hsl(var(--primary))] shrink-0">
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function CommitteesTable({ committees }: { committees: CongressCommittee[] }) {
  if (committees.length === 0) return <EmptyState text="No committees found. Sync from Congress.gov to populate." />;
  return (
    <table className="w-full text-[10px]">
      <thead className="bg-[hsl(var(--win98-light))] sticky top-0">
        <tr>
          <th className="text-left px-2 py-1 font-bold">Committee</th>
          <th className="text-left px-2 py-1 font-bold">Chamber</th>
          <th className="text-left px-2 py-1 font-bold">Code</th>
        </tr>
      </thead>
      <tbody>
        {committees.map((c) => (
          <tr key={c.id} className="border-b border-[hsl(var(--win98-light))] hover:bg-[hsl(var(--win98-light))]">
            <td className="px-2 py-1 font-medium">{c.name}</td>
            <td className="px-2 py-1 capitalize">{c.chamber}</td>
            <td className="px-2 py-1 font-mono text-[9px]">{c.system_code}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function VotesTable({ votes }: { votes: CongressVote[] }) {
  if (votes.length === 0) return <EmptyState text="No votes found. Sync from Congress.gov to populate." />;
  return (
    <div className="divide-y divide-[hsl(var(--win98-light))]">
      {votes.map((v) => (
        <div key={v.id} className="px-2 py-1.5 hover:bg-[hsl(var(--win98-light))]">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-bold text-[10px] uppercase shrink-0 capitalize">{v.chamber}</span>
                <span className="text-[9px] text-[hsl(var(--muted-foreground))]">Roll #{v.roll_number}</span>
                {v.vote_date && <span className="text-[9px] text-[hsl(var(--muted-foreground))]">{v.vote_date}</span>}
              </div>
              <p className="text-[10px] font-medium line-clamp-1">{v.question || v.description || "—"}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 text-[9px]">
              <span className="text-green-700 font-bold">{v.yea_total}Y</span>
              <span className="text-red-600 font-bold">{v.nay_total}N</span>
              {v.not_voting_total > 0 && <span className="text-[hsl(var(--muted-foreground))]">{v.not_voting_total}NV</span>}
              {v.result && (
                <span className={`font-bold px-1 rounded text-[8px] ${
                  v.result.toLowerCase().includes("pass") || v.result.toLowerCase().includes("agreed")
                    ? "bg-green-100 text-green-800"
                    : v.result.toLowerCase().includes("fail") || v.result.toLowerCase().includes("reject")
                    ? "bg-red-100 text-red-800"
                    : "bg-[hsl(var(--win98-light))]"
                }`}>
                  {v.result}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-[10px] text-[hsl(var(--muted-foreground))]">
      <Building2 className="h-6 w-6 mb-2 opacity-40" />
      <p>{text}</p>
    </div>
  );
}
