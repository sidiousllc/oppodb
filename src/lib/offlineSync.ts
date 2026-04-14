/**
 * Offline Sync Manager
 * Syncs Supabase data to encrypted IndexedDB and replays queued writes when online.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  storeEncrypted,
  getDecrypted,
  getPendingWrites,
  removePendingWrite,
  setSyncMeta,
  getSyncMeta,
  queueWrite,
} from "./encryptedStore";

/** Tables to sync for offline use */
const SYNC_TABLES = [
  { table: "district_profiles", select: "*", orderBy: "district_id" },
  { table: "candidate_profiles", select: "id,slug,name,tags,content,is_subpage,parent_slug,subpage_title,github_path,legiscan_people_id,legiscan_state", orderBy: "name" },
  { table: "candidate_versions", select: "id,github_path,commit_sha,commit_message,commit_date,author", orderBy: "commit_date" },
  { table: "congress_members", select: "id,bioguide_id,name,first_name,last_name,party,state,district,chamber,depiction_url,official_url,candidate_slug,congress,terms,leadership", orderBy: "name" },
  { table: "congress_bills", select: "id,bill_id,bill_type,bill_number,congress,title,short_title,status,sponsor_name,sponsor_bioguide_id,policy_area,origin_chamber,introduced_date,latest_action_date,latest_action_text,cosponsor_count,committees,subjects", orderBy: "bill_id" },
  { table: "congress_committees", select: "id,system_code,name,chamber,committee_type,parent_system_code,url,members,subcommittees", orderBy: "name" },
  { table: "congress_votes", select: "id,vote_id,chamber,congress,session,roll_number,vote_date,question,description,result,bill_id,yea_total,nay_total,not_voting_total,present_total,member_votes", orderBy: "vote_date" },
  { table: "election_forecasts", select: "*", orderBy: "state_abbr" },
  { table: "election_forecast_history", select: "*", orderBy: "changed_at" },
  { table: "campaign_finance", select: "*", orderBy: "candidate_name" },
  { table: "polling_data", select: "*", orderBy: "date_conducted" },
  { table: "congressional_election_results", select: "*", orderBy: "election_year" },
  { table: "state_legislative_profiles", select: "*", orderBy: "district_id" },
  { table: "state_leg_election_results", select: "*", orderBy: "election_year" },
  { table: "state_voter_stats", select: "*", orderBy: "state" },
  { table: "mit_election_results", select: "id,year,state,state_po,office,district,candidate,party,candidatevotes,totalvotes,stage,special,writein", orderBy: "year" },
  { table: "mn_cfb_candidates", select: "*", orderBy: "candidate_name" },
  { table: "state_cfb_candidates", select: "*", orderBy: "candidate_name" },
  { table: "messaging_guidance", select: "id,slug,title,source,source_url,summary,issue_areas,research_type,content,published_date,author", orderBy: "title" },
  { table: "local_impacts", select: "*", orderBy: "state" },
  { table: "maga_files", select: "*", orderBy: "name" },
  { table: "narrative_reports", select: "*", orderBy: "name" },
  { table: "prediction_markets", select: "*", orderBy: "title" },
  { table: "district_news_cache", select: "*", orderBy: "member_name" },
  { table: "wiki_pages", select: "*", orderBy: "title" },
  { table: "section_permissions", select: "*", orderBy: "section_id" },
  { table: "international_profiles", select: "*", orderBy: "country_code" },
  { table: "international_elections", select: "*", orderBy: "election_year" },
  { table: "international_leaders", select: "*", orderBy: "country_code" },
];

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: number | null;
  pendingWrites: number;
  tablesAvailable: string[];
  error: string | null;
}

let syncStatus: SyncStatus = {
  isOnline: navigator.onLine,
  isSyncing: false,
  lastSyncAt: null,
  pendingWrites: 0,
  tablesAvailable: [],
  error: null,
};

const listeners = new Set<(status: SyncStatus) => void>();

function notify() {
  listeners.forEach((fn) => fn({ ...syncStatus }));
}

export function subscribeSyncStatus(fn: (status: SyncStatus) => void): () => void {
  listeners.add(fn);
  fn({ ...syncStatus });
  return () => listeners.delete(fn);
}

export function getSyncStatus(): SyncStatus {
  return { ...syncStatus };
}

/** Sync a single table from Supabase to encrypted IndexedDB */
async function syncTable(tableName: string, select: string, orderBy: string): Promise<number> {
  let allData: Record<string, unknown>[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await (supabase as any)
      .from(tableName)
      .select(select)
      .order(orderBy)
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(`Failed to sync ${tableName}: ${error.message}`);
    if (!data || data.length === 0) break;

    allData = allData.concat(data as Record<string, unknown>[]);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  if (allData.length > 0) {
    await storeEncrypted(tableName, allData);
  }

  await setSyncMeta(`lastSync:${tableName}`, Date.now());
  return allData.length;
}

/** Full sync of all tables */
export async function syncAllTables(
  onProgress?: (table: string, index: number, total: number) => void
): Promise<{ synced: number; errors: string[] }> {
  if (!navigator.onLine) {
    return { synced: 0, errors: ["Device is offline"] };
  }

  syncStatus.isSyncing = true;
  syncStatus.error = null;
  notify();

  let synced = 0;
  const errors: string[] = [];

  for (let i = 0; i < SYNC_TABLES.length; i++) {
    const { table, select, orderBy } = SYNC_TABLES[i];
    onProgress?.(table, i, SYNC_TABLES.length);

    try {
      const count = await syncTable(table, select, orderBy);
      synced += count;
      if (!syncStatus.tablesAvailable.includes(table)) {
        syncStatus.tablesAvailable.push(table);
      }
    } catch (e: any) {
      errors.push(e.message || `Failed to sync ${table}`);
      console.error(`Sync error for ${table}:`, e);
    }
  }

  syncStatus.isSyncing = false;
  syncStatus.lastSyncAt = Date.now();
  await setSyncMeta("lastFullSync", Date.now());
  notify();

  return { synced, errors };
}

/** Replay pending writes to Supabase */
export async function replayPendingWrites(): Promise<{ replayed: number; failed: number }> {
  if (!navigator.onLine) return { replayed: 0, failed: 0 };

  const pending = await getPendingWrites();
  let replayed = 0;
  let failed = 0;

  for (const write of pending) {
    try {
      const sb = supabase as any;
      if (write.operation === "insert") {
        const { error } = await sb.from(write.table).insert(write.data);
        if (error) throw error;
      } else if (write.operation === "update") {
        const { id, ...rest } = write.data;
        const { error } = await sb.from(write.table).update(rest).eq("id", String(id));
        if (error) throw error;
      } else if (write.operation === "delete") {
        const { error } = await sb.from(write.table).delete().eq("id", String(write.data.id));
        if (error) throw error;
      }

      await removePendingWrite(write.id);
      replayed++;
    } catch (e) {
      console.error(`Failed to replay write ${write.id}:`, e);
      failed++;
    }
  }

  syncStatus.pendingWrites = (await getPendingWrites()).length;
  notify();
  return { replayed, failed };
}

/** Get offline data for a table (falls back to encrypted store when offline) */
export async function getOfflineData<T = Record<string, unknown>>(table: string): Promise<T[]> {
  if (navigator.onLine) {
    try {
      const config = SYNC_TABLES.find((t) => t.table === table);
      const selectStr = config?.select || "*";
      const orderStr = config?.orderBy || "id";
      const allData: T[] = [];
      let offset = 0;
      const pageSize = 1000;

      while (true) {
        const { data, error } = await (supabase as any)
          .from(table)
          .select(selectStr)
          .order(orderStr)
          .range(offset, offset + pageSize - 1);
        if (error || !data || data.length === 0) break;
        allData.push(...(data as T[]));
        if (data.length < pageSize) break;
        offset += pageSize;
      }

      if (allData.length > 0) return allData;
    } catch {
      // Fall through to offline
    }
  }

  return getDecrypted<T>(table);
}

/** Queue a write for offline-first operation */
export async function offlineWrite(
  table: string,
  operation: "insert" | "update" | "delete",
  data: Record<string, unknown>
): Promise<void> {
  if (navigator.onLine) {
    try {
      const sb = supabase as any;
      if (operation === "insert") {
        const { error } = await sb.from(table).insert(data);
        if (!error) return;
      } else if (operation === "update") {
        const { id, ...rest } = data;
        const { error } = await sb.from(table).update(rest).eq("id", String(id));
        if (!error) return;
      } else if (operation === "delete") {
        const { error } = await sb.from(table).delete().eq("id", String(data.id));
        if (!error) return;
      }
    } catch {
      // Fall through to queue
    }
  }

  await queueWrite(table, operation, data);
  syncStatus.pendingWrites++;
  notify();
}

/** Initialize offline sync - set up event listeners */
export function initOfflineSync(): () => void {
  const handleOnline = async () => {
    syncStatus.isOnline = true;
    notify();
    await replayPendingWrites();
  };

  const handleOffline = () => {
    syncStatus.isOnline = false;
    notify();
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  // Load initial state
  (async () => {
    const lastSync = await getSyncMeta<number>("lastFullSync");
    syncStatus.lastSyncAt = lastSync || null;
    const pending = await getPendingWrites();
    syncStatus.pendingWrites = pending.length;
    notify();
  })();

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}
