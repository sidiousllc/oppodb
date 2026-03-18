import { useState, useEffect } from "react";
import { Building2, ExternalLink, Vote, Loader2, Users } from "lucide-react";
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("congress_members")
      .select("id,bioguide_id,name,party,state,district,chamber,depiction_url,official_url,candidate_slug")
      .eq("candidate_slug", candidateSlug)
      .maybeSingle()
      .then(async ({ data }) => {
        if (data) {
          setMember(data as CongressMember);
          // Load recent votes where this member voted
          const { data: voteData } = await supabase
            .from("congress_votes")
            .select("vote_id,chamber,roll_number,vote_date,question,description,result,yea_total,nay_total,member_votes")
            .eq("chamber", (data as CongressMember).chamber)
            .order("vote_date", { ascending: false })
            .limit(10);

          if (voteData) {
            const bioguideId = (data as CongressMember).bioguide_id;
            const parsed = voteData.map((v: any) => {
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
        }
        setLoading(false);
      });
  }, [candidateSlug]);

  if (loading) return null;
  if (!member) return null;

  return (
    <div className="bg-card rounded-xl border border-border p-4 mb-6">
      <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-3">
        <Building2 className="h-4 w-4" /> Congress.gov Profile
      </h2>

      {/* Member card */}
      <div className="rounded-lg border border-border bg-background/50 p-3 mb-3">
        <div className="flex items-center gap-3">
          {member.depiction_url ? (
            <img src={member.depiction_url} alt={member.name} className="h-10 w-10 rounded-full object-cover border" />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${partyColor(member.party)}20` }}>
              <Users className="h-4 w-4" style={{ color: partyColor(member.party) }} />
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
          </div>
          {member.official_url && (
            <a href={member.official_url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-primary hover:underline border border-primary/20 rounded px-1.5 py-0.5 flex items-center gap-1 shrink-0">
              <ExternalLink className="h-2.5 w-2.5" /> Official Site
            </a>
          )}
        </div>
      </div>

      {/* Recent votes */}
      {votes.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
            <Vote className="h-3.5 w-3.5" /> Recent Votes ({votes.length})
          </h3>
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {votes.map((v) => (
              <div key={v.vote_id} className="flex items-center gap-2 text-xs border-b border-border/30 pb-1.5 pt-1">
                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold border ${
                  v.member_vote === "Yea" ? "bg-primary/10 text-primary border-primary/25" :
                  v.member_vote === "Nay" ? "bg-destructive/10 text-destructive border-destructive/25" :
                  "bg-muted text-muted-foreground border-border"
                }`}>
                  {v.member_vote}
                </span>
                <span className="text-foreground line-clamp-1 flex-1">{v.description || v.question}</span>
                <span className="text-[9px] text-muted-foreground shrink-0">{v.vote_date}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
