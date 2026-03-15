import { supabase } from "@/integrations/supabase/client";

export interface CongressionalElectionResult {
  id: string;
  state_abbr: string;
  district_number: string;
  election_year: number;
  election_date: string | null;
  election_type: string;
  candidate_name: string;
  party: string | null;
  votes: number | null;
  vote_pct: number | null;
  is_winner: boolean;
  is_incumbent: boolean;
  is_write_in: boolean;
  total_votes: number | null;
  source: string;
}

export interface CongressionalElectionCycle {
  year: number;
  date: string | null;
  type: string;
  candidates: CongressionalElectionResult[];
  totalVotes: number;
}

export async function fetchCongressionalElectionResults(
  stateAbbr: string,
  districtNumber: string,
): Promise<CongressionalElectionResult[]> {
  const normalizedDistrict = districtNumber.replace(/^0+/, "") || "0";

  const { data, error } = await supabase
    .from("congressional_election_results")
    .select("*")
    .eq("state_abbr", stateAbbr)
    .eq("district_number", normalizedDistrict)
    .order("election_year", { ascending: false })
    .order("votes", { ascending: false });

  if (error) {
    console.error("Error fetching congressional election results:", error);
    return [];
  }
  return (data || []) as unknown as CongressionalElectionResult[];
}

export function groupCongressionalByCycle(results: CongressionalElectionResult[]): CongressionalElectionCycle[] {
  const cycleMap = new Map<string, CongressionalElectionCycle>();

  for (const r of results) {
    const key = `${r.election_year}-${r.election_type}`;
    if (!cycleMap.has(key)) {
      cycleMap.set(key, {
        year: r.election_year,
        date: r.election_date,
        type: r.election_type,
        candidates: [],
        totalVotes: r.total_votes || 0,
      });
    }
    cycleMap.get(key)!.candidates.push(r);
  }

  return Array.from(cycleMap.values()).sort((a, b) => b.year - a.year);
}

export async function syncCongressionalElections(
  stateAbbr: string,
): Promise<{ success: boolean; upserted: number; error?: string }> {
  const { data, error } = await supabase.functions.invoke(
    `congressional-election-sync?state=${stateAbbr}`,
  );
  if (error) {
    return { success: false, upserted: 0, error: error.message };
  }
  return {
    success: data?.success ?? true,
    upserted: data?.upserted ?? 0,
    error: data?.error,
  };
}
