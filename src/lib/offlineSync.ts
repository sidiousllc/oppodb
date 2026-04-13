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

/** Tables to sync for offline use, with their select columns */
const SYNC_TABLES = [
  { table: "district_profiles", select: "*", orderBy: "district_id" },
  { table: "candidate_profiles", select: "id,slug,name,tags,content,is_subpage,parent_slug,subpage_title,github_path", orderBy: "name" },
  { table: "congress_members", select: "id,bioguide_id,name,party,state,district,chamber,depiction_url,official_url,candidate_slug", orderBy: "name" },
  { table: "election_forecasts", select: "*", orderBy: "state_abbr" },
  { table: "campaign_finance", select: "*", orderBy: "candidate_name" },
  { table: "polling_data", select: "*", orderBy: "date_conducted" },
  { table: "congressional_election_results", select: "*", orderBy: "election_year" },
  { table: "messaging_guidance", select: "id,slug,title,source,summary,issue_areas,research_type,content,published_date,author", orderBy: "title" },
  { table: "local_impacts", select: "*", orderBy: "state" },
  { table: "maga_files", select: "*", orderBy: "name" },
  { table: "narrative_reports", select: "*", orderBy: "name" },
  { table: "prediction_markets", select: "*", orderBy: "title" },
] as const;

type SyncTable = (typeof SYNC_TABLES)[number]["table"];

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
async function syncTable(table: string, select: string, orderBy: string): Promise<number> {
  // Supabase has a 1000 row default limit; paginate
  let allData: Record<string, unknown>[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(orderBy)
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(`Failed to sync ${table}: ${error.message}`);
    if (!data || data.length === 0) break;

    allData = allData.concat(data as Record<string, unknown>[]);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  if (allData.length > 0) {
    await storeEncrypted(table, allData);
  }

  await setSyncMeta(`lastSync:${table}`, Date.now());
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
      if (write.operation === "insert") {
        const { error } = await supabase.from(write.table).insert(write.data);
        if (error) throw error;
      } else if (write.operation === "update") {
        const { id, ...rest } = write.data;
        const { error } = await supabase.from(write.table).update(rest).eq("id", id);
        if (error) throw error;
      } else if (write.operation === "delete") {
        const { error } = await supabase.from(write.table).delete().eq("id", write.data.id);
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
export async function getOfflineData<T = Record<string, unknown>>(table: SyncTable): Promise<T[]> {
  if (navigator.onLine) {
    // Try live data first
    try {
      const config = SYNC_TABLES.find((t) => t.table === table);
      const { data, error } = await supabase
        .from(table)
        .select(config?.select || "*")
        .order(config?.orderBy || "id")
        .limit(1000);
      if (!error && data) return data as T[];
    } catch {
      // Fall through to offline
    }
  }

  // Use encrypted offline store
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
      if (operation === "insert") {
        const { error } = await supabase.from(table).insert(data);
        if (!error) return;
      } else if (operation === "update") {
        const { id, ...rest } = data;
        const { error } = await supabase.from(table).update(rest).eq("id", id);
        if (!error) return;
      } else if (operation === "delete") {
        const { error } = await supabase.from(table).delete().eq("id", data.id);
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
    // Replay pending writes when coming back online
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
