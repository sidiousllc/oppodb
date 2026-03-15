import { supabase } from "@/integrations/supabase/client";

export interface ElectionResult {
  id: string;
  state_abbr: string;
  chamber: string;
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
  turnout: number | null;
  source: string;
}

export interface ElectionCycle {
  year: number;
  date: string | null;
  type: string;
  candidates: ElectionResult[];
  totalVotes: number;
}

export async function fetchElectionResults(
  stateAbbr: string,
  chamber: string,
  districtNumber: string,
): Promise<ElectionResult[]> {
  const { data, error } = await supabase
    .from("state_leg_election_results")
    .select("*")
    .eq("state_abbr", stateAbbr)
    .eq("chamber", chamber)
    .eq("district_number", districtNumber)
    .order("election_year", { ascending: false })
    .order("votes", { ascending: false });

  if (error) {
    console.error("Error fetching election results:", error);
    return [];
  }
  return (data || []) as unknown as ElectionResult[];
}

export function groupByElectionCycle(results: ElectionResult[]): ElectionCycle[] {
  const cycleMap = new Map<string, ElectionCycle>();

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

export async function syncElectionResults(
  stateAbbr?: string,
): Promise<{ success: boolean; upserted?: number; error?: string }> {
  const params: Record<string, string> = {};
  if (stateAbbr) params.state = stateAbbr;

  const queryString = new URLSearchParams(params).toString();
  const functionUrl = queryString
    ? `election-results-sync?${queryString}`
    : "election-results-sync";

  const { data, error } = await supabase.functions.invoke(functionUrl);
  if (error) {
    console.error("Election results sync error:", error);
    return { success: false, error: error.message };
  }
  return data as { success: boolean; upserted?: number; error?: string };
}
