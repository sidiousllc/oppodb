import { useState, useEffect } from "react";
import { Building2, ExternalLink, Vote, Users, Briefcase, Calendar, MapPin, Phone, Globe, Twitter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
  candidate_slug: string | null;
  terms: any[] | null;
  leadership: any[] | null;
  social_media: any | null;
  district_offices: any[] | null;
  phone: string | null;
  contact_form: string | null;
  office_address: string | null;
  wikipedia: string | null;
  ballotpedia: string | null;
  opensecrets_id: string | null;
}

interface CongressVoteRecord {
  vote_id: string;
  chamber: string;
  roll_number: number;
  vote_date: string | null;
  question: string | null;
  description: string | null;
  result: string | null;
  yea_total: number;
  nay_total: number;
  member_vote?: string;
}

interface CommitteeAssignment {
  name: string;
  chamber: string;
  system_code: string;
  url: string | null;
}

function partyColor(party: string | null) {
  const p = (party || "").toLowerCase();
  if (p.includes("democrat")) return "hsl(210, 80%, 50%)";
  if (p.includes("republican")) return "hsl(0, 70%, 50%)";
  if (p.includes("independent")) return "hsl(45, 80%, 50%)";
  return "hsl(var(--muted-foreground))";
}

interface Props {
  candidateSlug: string;
  candidateName: string;
}

export function CandidateCongressPanel({ candidateSlug, candidateName }: Props) {
  const [member, setMember] = useState<CongressMember | null>(null);
  const [votes, setVotes] = useState<CongressVoteRecord[]>([]);
  const [committees, setCommittees] = useState<CommitteeAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"votes" | "committees" | "terms" | "contact">("votes");

  useEffect(() => {
    setLoading(true);
    supabase
      .from("congress_members")
      .select("id,bioguide_id,name,party,state,district,chamber,depiction_url,official_url,candidate_slug,terms,leadership,social_media,district_offices,phone,contact_form,office_address,wikipedia,ballotpedia,opensecrets_id")
      .eq("candidate_slug", candidateSlug)
      .maybeSingle()
      .then(async ({ data }) => {
        if (data) {
          setMember(data as CongressMember);
          const bioguideId = (data as CongressMember).bioguide_id;
          const chamber = (data as CongressMember).chamber;

          // Load votes and committees in parallel
          const [voteRes, committeeRes] = await Promise.all([
            supabase
              .from("congress_votes")
              .select("vote_id,chamber,roll_number,vote_date,question,description,result,yea_total,nay_total,member_votes")
              .eq("chamber", chamber)
              .order("vote_date", { ascending: false })
              .limit(20),
            supabase
              .from("congress_committees")
              .select("name,chamber,system_code,url,members")
          ]);

          // Parse votes
          if (voteRes.data) {
            const parsed = voteRes.data.map((v: any) => {
              const memberVotes = v.member_votes || [];
              const memberVote = memberVotes.find?.((mv: any) => mv.bioguide_id === bioguideId);
              return {
                vote_id: v.vote_id,
                chamber: v.chamber,
                roll_number: v.roll_number,
                vote_date: v.vote_date,
                question: v.question,
                description: v.description,
                result: v.result,
                yea_total: v.yea_total,
                nay_total: v.nay_total,
                member_vote: memberVote?.vote || undefined,
              };
            }).filter((v: CongressVoteRecord) => v.member_vote);
            setVotes(parsed);
          }

          // Parse committee assignments - find committees where this member is listed
          if (committeeRes.data) {
            const memberCommittees: CommitteeAssignment[] = [];
            for (const c of committeeRes.data as any[]) {
              const members = c.members || [];
              const isMember = members.some?.((m: any) =>
                m.bioguide_id === bioguideId || m.bioguideId === bioguideId
              );
              if (isMember) {
                memberCommittees.push({
                  name: c.name,
                  chamber: c.chamber,
                  system_code: c.system_code,
                  url: c.url,
                });
              }
            }
            setCommittees(memberCommittees);
          }
        }
        setLoading(false);
      });
  }, [candidateSlug]);

  if (loading) return null;
  if (!member) return null;

  const terms = (member.terms || []) as any[];
  const leadership = (member.leadership || []) as any[];

  const tabs = [
    { id: "votes" as const, label: "Voting Record", count: votes.length },
    { id: "committees" as const, label: "Committees", count: committees.length },
    { id: "terms" as const, label: "Terms", count: terms.length },
  ];

  return (
    <div className="bg-card rounded-xl border border-border p-4 mb-6">
      <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-3">
        <Building2 className="h-4 w-4" /> Congress.gov Profile
      </h2>

      {/* Member card */}
      <div className="rounded-lg border border-border bg-background/50 p-3 mb-3">
        <div className="flex items-center gap-3">
          {member.depiction_url ? (
            <img src={member.depiction_url} alt={member.name} className="h-12 w-12 rounded-full object-cover border border-border" />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${partyColor(member.party)}20` }}>
              <Users className="h-5 w-5" style={{ color: partyColor(member.party) }} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground">{member.name}</h3>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
              <span className="font-medium" style={{ color: partyColor(member.party) }}>{member.party}</span>
              <span>•</span>
              <span className="capitalize">{member.chamber}</span>
              <span>•</span>
              <span>{member.state}{member.district ? `-${member.district}` : ""}</span>
            </div>
            {leadership.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {leadership.map((l: any, i: number) => (
                  <span key={i} className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold bg-accent text-accent-foreground border border-border">
                    {l.type || l.title || "Leadership"}
                  </span>
                ))}
              </div>
            )}
          </div>
          {member.official_url && (
            <a href={member.official_url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-primary hover:underline border border-primary/20 rounded px-1.5 py-0.5 flex items-center gap-1 shrink-0">
              <ExternalLink className="h-2.5 w-2.5" /> Official Site
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border border-border rounded-lg overflow-hidden mb-3">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-1.5 text-[10px] font-medium transition-colors ${
              i > 0 ? "border-l border-border" : ""
            } ${
              activeTab === tab.id
                ? "bg-foreground text-background"
                : "bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}{tab.count > 0 ? ` (${tab.count})` : ""}
          </button>
        ))}
      </div>

      {/* Voting Record tab */}
      {activeTab === "votes" && (
        votes.length > 0 ? (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Vote className="h-3.5 w-3.5" /> Recent Roll Call Votes
            </h3>
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {votes.map((v) => (
                <div key={v.vote_id} className="flex items-center gap-2 text-xs border-b border-border/30 pb-1.5 pt-1">
                  <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold border shrink-0 ${
                    v.member_vote === "Yea" ? "bg-primary/10 text-primary border-primary/25" :
                    v.member_vote === "Nay" ? "bg-destructive/10 text-destructive border-destructive/25" :
                    "bg-muted text-muted-foreground border-border"
                  }`}>
                    {v.member_vote}
                  </span>
                  <span className="text-foreground line-clamp-1 flex-1">{v.description || v.question}</span>
                  <span className={`text-[9px] shrink-0 px-1 py-0.5 rounded ${
                    v.result?.toLowerCase().includes("passed") ? "text-primary bg-primary/5" :
                    v.result?.toLowerCase().includes("failed") ? "text-destructive bg-destructive/5" :
                    "text-muted-foreground"
                  }`}>
                    {v.result}
                  </span>
                  <span className="text-[9px] text-muted-foreground shrink-0">{v.vote_date}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-4 text-center">No voting records synced yet.</p>
        )
      )}

      {/* Committees tab */}
      {activeTab === "committees" && (
        committees.length > 0 ? (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5" /> Committee Assignments
            </h3>
            <div className="space-y-1.5">
              {committees.map((c) => (
                <div key={c.system_code} className="flex items-center gap-2 rounded-lg bg-muted/50 p-2.5">
                  <Briefcase className="h-3.5 w-3.5 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground line-clamp-1">{c.name}</p>
                    <p className="text-[9px] text-muted-foreground capitalize">{c.chamber} • {c.system_code}</p>
                  </div>
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-4 text-center">No committee assignments found. Sync committees from the Legislation section.</p>
        )
      )}

      {/* Terms tab */}
      {activeTab === "terms" && (
        terms.length > 0 ? (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Service Terms
            </h3>
            <div className="space-y-1.5">
              {terms.map((t: any, i: number) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/50 p-2.5">
                  <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground capitalize">
                      {t.chamber || "Unknown"} — {t.state || member.state}{t.district ? ` District ${t.district}` : ""}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      {t.startYear || t.start_year || "?"} – {t.endYear || t.end_year || "Present"}
                      {t.congress && ` • ${t.congress}th Congress`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-4 text-center">No term data available.</p>
        )
      )}
    </div>
  );
}
