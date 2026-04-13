import { useState, useEffect } from "react";
import { Building2, ExternalLink, Users, Vote, Briefcase, ChevronDown, ChevronUp, Gavel, DollarSign, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { stateAbbrToName } from "@/lib/stateAbbreviations";

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
  terms: any;
  leadership: any;
  candidate_slug: string | null;
}

interface CommitteeInfo {
  name: string;
  chamber: string;
  system_code: string;
}

interface VoteRecord {
  vote_id: string;
  vote_date: string | null;
  question: string | null;
  description: string | null;
  result: string | null;
  yea_total: number | null;
  nay_total: number | null;
  member_votes: any;
}

interface FinanceRecord {
  candidate_name: string;
  total_raised: number | null;
  total_spent: number | null;
  cash_on_hand: number | null;
  individual_contributions: number | null;
  pac_contributions: number | null;
  cycle: number;
}

function partyColor(party: string | null) {
  const p = (party || "").toLowerCase();
  if (p.includes("democrat")) return "hsl(210, 80%, 50%)";
  if (p.includes("republican")) return "hsl(0, 70%, 50%)";
  if (p.includes("independent")) return "hsl(45, 80%, 50%)";
  return "hsl(var(--muted-foreground))";
}

function dollar(n: number | null | undefined) {
  return n != null ? `$${n.toLocaleString()}` : "—";
}

interface Props {
  districtId: string;
}

export function DistrictCongressPanel({ districtId }: Props) {
  const [members, setMembers] = useState<CongressMember[]>([]);
  const [committees, setCommittees] = useState<CommitteeInfo[]>([]);
  const [recentVotes, setRecentVotes] = useState<VoteRecord[]>([]);
  const [finance, setFinance] = useState<FinanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVotes, setShowVotes] = useState(false);
  const [showAllCommittees, setShowAllCommittees] = useState(false);

  useEffect(() => {
    const parts = districtId.split("-");
    if (parts.length < 2) { setLoading(false); return; }
    const stateAbbr = parts[0];
    const stateName = stateAbbrToName(stateAbbr);
    const distNum = parts[1] === "AL" ? "0" : String(parseInt(parts[1], 10));

    async function loadData() {
      // Fetch House member + Senators
      const [houseRes, senateRes] = await Promise.all([
        supabase
          .from("congress_members")
          .select("id,bioguide_id,name,party,state,district,chamber,depiction_url,official_url,terms,leadership,candidate_slug")
          .eq("state", stateName)
          .eq("chamber", "House of Representatives")
          .eq("district", distNum),
        supabase
          .from("congress_members")
          .select("id,bioguide_id,name,party,state,district,chamber,depiction_url,official_url,terms,leadership,candidate_slug")
          .eq("state", stateName)
          .eq("chamber", "Senate"),
      ]);

      const all = [
        ...((houseRes.data as CongressMember[]) || []),
        ...((senateRes.data as CongressMember[]) || []),
      ];
      setMembers(all);

      if (all.length > 0) {
        const bioguideIds = all.map(m => m.bioguide_id);

        // Fetch committees, votes, and campaign finance in parallel
        const [committeesRes, votesRes, financeRes] = await Promise.all([
          supabase
            .from("congress_committees")
            .select("name, chamber, system_code, members")
            .limit(200),
          supabase
            .from("congress_votes")
            .select("vote_id, vote_date, question, description, result, yea_total, nay_total, member_votes")
            .order("vote_date", { ascending: false })
            .limit(50),
          supabase
            .from("campaign_finance")
            .select("candidate_name, total_raised, total_spent, cash_on_hand, individual_contributions, pac_contributions, cycle")
            .in("candidate_name", all.map(m => m.name))
            .order("cycle", { ascending: false }),
        ]);

        // Filter committees where our members serve
        if (committeesRes.data) {
          const memberCommittees = committeesRes.data.filter((c: any) => {
            const membersList = c.members as any;
            if (!Array.isArray(membersList)) return false;
            return membersList.some((mem: any) => 
              bioguideIds.includes(mem?.bioguideId || mem?.bioguide_id)
            );
          });
          setCommittees(memberCommittees.map((c: any) => ({
            name: c.name,
            chamber: c.chamber,
            system_code: c.system_code,
          })));
        }

        // Filter votes where our members voted
        if (votesRes.data) {
          const memberVotes = votesRes.data.filter((v: any) => {
            const mv = v.member_votes as any;
            if (!Array.isArray(mv)) return false;
            return mv.some((vote: any) => 
              bioguideIds.includes(vote?.bioguideId || vote?.bioguide_id || vote?.member_id)
            );
          });
          setRecentVotes(memberVotes.slice(0, 20));
        }

        if (financeRes.data) {
          setFinance(financeRes.data as FinanceRecord[]);
        }
      }

      setLoading(false);
    }

    loadData();
  }, [districtId]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 bg-muted rounded-xl" />
        <div className="h-24 bg-muted rounded-xl" />
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 text-center text-muted-foreground">
        <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No congressional delegation data found for this district.</p>
        <p className="text-xs mt-1">Data may not be synced yet for this area.</p>
      </div>
    );
  }

  const houseMember = members.find(m => m.chamber === "House of Representatives");
  const senators = members.filter(m => m.chamber === "Senate");
  const displayCommittees = showAllCommittees ? committees : committees.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Congressional Delegation */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Congressional Delegation
        </h2>

        {/* House Representative */}
        {houseMember && (
          <div className="mb-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
              U.S. House Representative — District {districtId.split("-")[1]}
            </p>
            <MemberCard member={houseMember} />
          </div>
        )}

        {/* Senators */}
        {senators.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
              U.S. Senators — {members[0]?.state}
            </p>
            <div className="space-y-2">
              {senators.map(s => <MemberCard key={s.id} member={s} />)}
            </div>
          </div>
        )}
      </div>

      {/* Committee Assignments */}
      {committees.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Gavel className="h-5 w-5 text-primary" />
            Committee Assignments
            <span className="text-xs text-muted-foreground font-normal ml-auto">{committees.length} committees</span>
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {displayCommittees.map((c) => (
              <div key={c.system_code} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                <Scale className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{c.chamber}</p>
                </div>
              </div>
            ))}
          </div>
          {committees.length > 6 && (
            <button
              onClick={() => setShowAllCommittees(!showAllCommittees)}
              className="flex items-center gap-1 text-xs text-primary hover:underline mt-3"
            >
              {showAllCommittees ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showAllCommittees ? "Show less" : `Show all ${committees.length} committees`}
            </button>
          )}
        </div>
      )}

      {/* Campaign Finance */}
      {finance.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Campaign Finance
          </h2>
          <div className="space-y-4">
            {finance.map((f, i) => (
              <div key={i} className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-foreground">{f.candidate_name}</span>
                  <span className="text-[10px] text-muted-foreground">{f.cycle} Cycle</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Total Raised</p>
                    <p className="text-sm font-bold text-foreground">{dollar(f.total_raised)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Total Spent</p>
                    <p className="text-sm font-bold text-foreground">{dollar(f.total_spent)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Cash on Hand</p>
                    <p className="text-sm font-bold text-foreground">{dollar(f.cash_on_hand)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Individual</p>
                    <p className="text-sm font-bold text-foreground">{dollar(f.individual_contributions)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Key Votes */}
      {recentVotes.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-6">
          <button
            onClick={() => setShowVotes(!showVotes)}
            className="w-full flex items-center gap-2"
          >
            <Vote className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground flex-1 text-left">
              Recent Key Votes
            </h2>
            <span className="text-xs text-muted-foreground">{recentVotes.length} votes</span>
            {showVotes ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {showVotes && (
            <div className="mt-4 space-y-2 max-h-[400px] overflow-y-auto">
              {recentVotes.map((v) => (
                <div key={v.vote_id} className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground">{v.question || v.description || "Vote"}</p>
                      {v.description && v.question && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{v.description}</p>
                      )}
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                      v.result?.toLowerCase().includes("passed") || v.result?.toLowerCase().includes("agreed")
                        ? "bg-primary/10 text-primary"
                        : "bg-destructive/10 text-destructive"
                    }`}>
                      {v.result || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                    {v.vote_date && <span>{new Date(v.vote_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
                    <span>Yea: {v.yea_total ?? "—"}</span>
                    <span>Nay: {v.nay_total ?? "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MemberCard({ member }: { member: CongressMember }) {
  const terms = Array.isArray(member.terms) ? member.terms : [];
  const latestTerm = terms[terms.length - 1];

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
      {member.depiction_url ? (
        <img src={member.depiction_url} alt={member.name} className="h-14 w-14 rounded-full object-cover border shrink-0" />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${partyColor(member.party)}20` }}>
          <Users className="h-6 w-6" style={{ color: partyColor(member.party) }} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground">{member.name}</p>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
          <span className="font-semibold" style={{ color: partyColor(member.party) }}>{member.party}</span>
          <span>•</span>
          <span>{member.chamber === "House of Representatives" ? "House" : "Senate"}</span>
          {member.district && member.chamber === "House of Representatives" && (
            <><span>•</span><span>District {member.district}</span></>
          )}
        </div>
        {latestTerm && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Serving since {latestTerm.startYear || latestTerm.start_year || "—"}
          </p>
        )}
        {member.leadership && Array.isArray(member.leadership) && member.leadership.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {member.leadership.map((l: any, i: number) => (
              <span key={i} className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                {l.type || l.title || String(l)}
              </span>
            ))}
          </div>
        )}
        {member.official_url && (
          <a href={member.official_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline mt-1">
            <ExternalLink className="h-2.5 w-2.5" /> Official Website
          </a>
        )}
      </div>
    </div>
  );
}
