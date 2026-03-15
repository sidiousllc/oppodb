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

export interface SkippedFile {
  file: string;
  reason: string;
}

export interface StateSyncResult {
  state: string;
  success: boolean;
  upserted: number;
  errors: number;
  files_processed: number;
  files_found: number;
  skipped_files: SkippedFile[];
  error?: string;
}

export interface SyncReport {
  success: boolean;
  totalUpserted: number;
  totalErrors: number;
  stateResults: StateSyncResult[];
  resumedFrom?: string;
}

// ─── Checkpoint helpers ──────────────────────────────────────────────────────

const CHECKPOINT_KEY = "election-sync-checkpoint";

interface SyncCheckpoint {
  completedStates: string[];
  timestamp: number;
  stateResults: StateSyncResult[];
}

function loadCheckpoint(): SyncCheckpoint | null {
  try {
    const raw = localStorage.getItem(CHECKPOINT_KEY);
    if (!raw) return null;
    const cp = JSON.parse(raw) as SyncCheckpoint;
    // Expire checkpoints older than 2 hours
    if (Date.now() - cp.timestamp > 2 * 60 * 60 * 1000) {
      localStorage.removeItem(CHECKPOINT_KEY);
      return null;
    }
    return cp;
  } catch {
    return null;
  }
}

function saveCheckpoint(cp: SyncCheckpoint) {
  try {
    localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(cp));
  } catch { /* ignore quota errors */ }
}

export function clearSyncCheckpoint() {
  localStorage.removeItem(CHECKPOINT_KEY);
}

export function hasSyncCheckpoint(): boolean {
  return loadCheckpoint() !== null;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

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

// ─── Sync ────────────────────────────────────────────────────────────────────

const ALL_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
  "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
  "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

export async function syncElectionResults(
  stateAbbr?: string,
  onProgress?: (completed: number, total: number, currentState: string) => void,
  resume?: boolean,
): Promise<SyncReport> {
  if (stateAbbr) {
    // Single state — one call
    const { data, error } = await supabase.functions.invoke(
      `election-results-sync?state=${stateAbbr}`,
    );
    if (error) {
      console.error("Election results sync error:", error);
      return {
        success: false,
        totalUpserted: 0,
        totalErrors: 1,
        stateResults: [{
          state: stateAbbr,
          success: false,
          upserted: 0,
          errors: 1,
          files_processed: 0,
          files_found: 0,
          skipped_files: [],
          error: error.message,
        }],
      };
    }
    const stateResult: StateSyncResult = {
      state: stateAbbr,
      success: data?.success ?? true,
      upserted: data?.upserted ?? 0,
      errors: data?.errors ?? 0,
      files_processed: data?.files_processed ?? 0,
      files_found: data?.files_found ?? 0,
      skipped_files: data?.skipped_files ?? [],
      error: data?.error,
    };
    return {
      success: true,
      totalUpserted: stateResult.upserted,
      totalErrors: stateResult.errors,
      stateResults: [stateResult],
    };
  }

  // All states — batch one at a time with checkpoint support
  let checkpoint = resume ? loadCheckpoint() : null;
  const completedStates = new Set(checkpoint?.completedStates ?? []);
  const stateResults: StateSyncResult[] = checkpoint?.stateResults ?? [];
  let totalUpserted = stateResults.reduce((s, r) => s + r.upserted, 0);
  let totalErrors = stateResults.reduce((s, r) => s + r.errors, 0);
  const resumedFrom = checkpoint ? ALL_STATES.find(s => !completedStates.has(s)) : undefined;

  for (let i = 0; i < ALL_STATES.length; i++) {
    const st = ALL_STATES[i];
    if (completedStates.has(st)) continue;

    onProgress?.(completedStates.size, ALL_STATES.length, st);
    try {
      const { data, error } = await supabase.functions.invoke(
        `election-results-sync?state=${st}`,
      );
      const stateResult: StateSyncResult = {
        state: st,
        success: !error && (data?.success ?? true),
        upserted: data?.upserted ?? 0,
        errors: data?.errors ?? 0,
        files_processed: data?.files_processed ?? 0,
        files_found: data?.files_found ?? 0,
        skipped_files: data?.skipped_files ?? [],
        error: error?.message || data?.error,
      };
      stateResults.push(stateResult);
      if (error) {
        console.error(`Sync error for ${st}:`, error);
        totalErrors++;
      } else {
        totalUpserted += stateResult.upserted;
        totalErrors += stateResult.errors;
      }
    } catch (e) {
      console.error(`Sync failed for ${st}:`, e);
      stateResults.push({
        state: st,
        success: false,
        upserted: 0,
        errors: 1,
        files_processed: 0,
        files_found: 0,
        skipped_files: [],
        error: e instanceof Error ? e.message : "Unknown error",
      });
      totalErrors++;
    }

    completedStates.add(st);
    // Save checkpoint after each state
    saveCheckpoint({
      completedStates: Array.from(completedStates),
      timestamp: Date.now(),
      stateResults,
    });
  }

  onProgress?.(ALL_STATES.length, ALL_STATES.length, "done");
  // Clear checkpoint on successful completion
  clearSyncCheckpoint();

  return {
    success: true,
    totalUpserted,
    totalErrors,
    stateResults,
    resumedFrom,
  };
}
