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

const ALL_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
  "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
  "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

export async function syncElectionResults(
  stateAbbr?: string,
  onProgress?: (completed: number, total: number, currentState: string) => void,
): Promise<{ success: boolean; upserted?: number; error?: string }> {
  if (stateAbbr) {
    // Single state — one call
    const { data, error } = await supabase.functions.invoke(
      `election-results-sync?state=${stateAbbr}`,
    );
    if (error) {
      console.error("Election results sync error:", error);
      return { success: false, error: error.message };
    }
    return data as { success: boolean; upserted?: number; error?: string };
  }

  // All states — batch one at a time
  let totalUpserted = 0;
  let errors = 0;
  for (let i = 0; i < ALL_STATES.length; i++) {
    const st = ALL_STATES[i];
    onProgress?.(i, ALL_STATES.length, st);
    try {
      const { data, error } = await supabase.functions.invoke(
        `election-results-sync?state=${st}`,
      );
      if (error) {
        console.error(`Sync error for ${st}:`, error);
        errors++;
      } else if (data?.upserted) {
        totalUpserted += data.upserted;
      }
    } catch (e) {
      console.error(`Sync failed for ${st}:`, e);
      errors++;
    }
  }
  onProgress?.(ALL_STATES.length, ALL_STATES.length, "done");
  return { success: true, upserted: totalUpserted, error: errors > 0 ? `${errors} states had errors` : undefined };
}
