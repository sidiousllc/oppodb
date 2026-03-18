import { useState, useEffect } from "react";
import { Building2, ExternalLink, Users } from "lucide-react";
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
}

function partyColor(party: string | null) {
  const p = (party || "").toLowerCase();
  if (p.includes("democrat")) return "hsl(210, 80%, 50%)";
  if (p.includes("republican")) return "hsl(0, 70%, 50%)";
  if (p.includes("independent")) return "hsl(45, 80%, 50%)";
  return "hsl(var(--muted-foreground))";
}

interface Props {
  districtId: string; // e.g. "CA-12"
}

export function DistrictCongressPanel({ districtId }: Props) {
  const [members, setMembers] = useState<CongressMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const parts = districtId.split("-");
    if (parts.length < 2) { setLoading(false); return; }
    const stateAbbr = parts[0];
    const distNum = parts[1] === "AL" ? "0" : String(parseInt(parts[1], 10));

    // Fetch House member for the district + any Senators from the state
    Promise.all([
      supabase
        .from("congress_members")
        .select("id,bioguide_id,name,party,state,district,chamber,depiction_url,official_url")
        .eq("state", stateAbbr)
        .eq("chamber", "house")
        .eq("district", distNum),
      supabase
        .from("congress_members")
        .select("id,bioguide_id,name,party,state,district,chamber,depiction_url,official_url")
        .eq("state", stateAbbr)
        .eq("chamber", "senate"),
    ]).then(([houseRes, senateRes]) => {
      const all = [
        ...((houseRes.data as CongressMember[]) || []),
        ...((senateRes.data as CongressMember[]) || []),
      ];
      setMembers(all);
      setLoading(false);
    });
  }, [districtId]);

  if (loading || members.length === 0) return null;

  return (
    <div className="bg-card rounded-xl border border-border p-6 mb-6">
      <h2 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        <Building2 className="h-5 w-5 text-primary" />
        Congressional Delegation
      </h2>
      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            {m.depiction_url ? (
              <img src={m.depiction_url} alt={m.name} className="h-10 w-10 rounded-full object-cover border" />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${partyColor(m.party)}20` }}>
                <Users className="h-4 w-4" style={{ color: partyColor(m.party) }} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{m.name}</p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="font-medium" style={{ color: partyColor(m.party) }}>{m.party}</span>
                <span>•</span>
                <span className="capitalize">{m.chamber}</span>
                {m.district && m.chamber === "house" && <><span>•</span><span>District {m.district}</span></>}
              </div>
            </div>
            {m.official_url && (
              <a href={m.official_url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-primary hover:underline border border-primary/20 rounded px-1.5 py-0.5 flex items-center gap-1 shrink-0">
                <ExternalLink className="h-2.5 w-2.5" /> Website
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
