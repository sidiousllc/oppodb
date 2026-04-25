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
import { ensurePersistentStorage, isReallyOnline, watchReachability } from "./iosOffline";
import { prefetchEdgeFunctions } from "./edgeFunctionCache";

/** Read-only edge functions to pre-warm during a full sync so the app
 *  can serve their results offline. Mutating endpoints are intentionally
 *  excluded — those are queued via `offlineWrite`. */
const PREFETCH_EDGE_FUNCTIONS: Array<{ fn: string; body?: Record<string, unknown> }> = [
  { fn: "intel-briefing", body: { scope: "national" } },
  { fn: "intel-briefing", body: { scope: "international" } },
  { fn: "intel-briefing", body: { scope: "state" } },
  { fn: "intel-briefing", body: { scope: "local" } },
  // IntelHub feeds
  { fn: "intel-briefing", body: { scope: "national", category: "blindspot" } },
  { fn: "intel-briefing", body: { scope: "national", category: "left" } },
  { fn: "intel-briefing", body: { scope: "national", category: "center" } },
  { fn: "intel-briefing", body: { scope: "national", category: "right" } },
  { fn: "news-cluster-stories", body: {} },
  { fn: "news-cluster-stories", body: { bias: "blindspot" } },
  { fn: "news-source-rate", body: {} },
  { fn: "polling-aggregator", body: {} },
  { fn: "auto-docs", body: {} },
  // Geopolitics briefs for InternationalHub (cached per region)
  { fn: "geopolitics-brief", body: { region: "global" } },
  { fn: "geopolitics-brief", body: { region: "europe" } },
  { fn: "geopolitics-brief", body: { region: "asia" } },
  { fn: "geopolitics-brief", body: { region: "americas" } },
  { fn: "geopolitics-brief", body: { region: "africa" } },
  { fn: "geopolitics-brief", body: { region: "oceania" } },
];

/** Tables to sync for offline use.
 * pageSize tuned per table to avoid timeouts on heavy JSON columns.
 * Authentication is required for many tables — sync is skipped when not signed in. */
const SYNC_TABLES: Array<{ table: string; select: string; orderBy: string; pageSize?: number }> = [
  { table: "district_profiles", select: "*", orderBy: "id" },
  { table: "candidate_profiles", select: "id,slug,name,tags,is_subpage,parent_slug,subpage_title,github_path,legiscan_people_id,legiscan_state,updated_at", orderBy: "id", pageSize: 500 },
  { table: "candidate_versions", select: "id,github_path,commit_sha,commit_message,commit_date,author", orderBy: "id", pageSize: 500 },
  { table: "congress_members", select: "id,bioguide_id,name,first_name,last_name,party,state,district,chamber,depiction_url,official_url,candidate_slug,congress", orderBy: "id" },
  { table: "congress_bills", select: "id,bill_id,bill_type,bill_number,congress,title,short_title,status,sponsor_name,sponsor_bioguide_id,policy_area,origin_chamber,introduced_date,latest_action_date,latest_action_text,cosponsor_count", orderBy: "id" },
  { table: "congress_committees", select: "id,system_code,name,chamber,committee_type,parent_system_code,url", orderBy: "id" },
  { table: "congress_votes", select: "id,vote_id,chamber,congress,session,roll_number,vote_date,question,description,result,bill_id,yea_total,nay_total,not_voting_total,present_total", orderBy: "id", pageSize: 200 },
  { table: "congressional_record", select: "id,date,chamber,speaker_name,bioguide_id,title,category,pages", orderBy: "id", pageSize: 500 },
  { table: "election_forecasts", select: "*", orderBy: "id" },
  { table: "election_forecast_history", select: "*", orderBy: "id" },
  { table: "election_night_streams", select: "*", orderBy: "id", pageSize: 500 },
  { table: "campaign_finance", select: "*", orderBy: "id" },
  { table: "polling_data", select: "*", orderBy: "id" },
  { table: "congressional_election_results", select: "*", orderBy: "id" },
  { table: "state_legislative_profiles", select: "*", orderBy: "id", pageSize: 500 },
  { table: "state_leg_election_results", select: "*", orderBy: "id", pageSize: 500 },
  { table: "state_voter_stats", select: "*", orderBy: "id" },
  { table: "mit_election_results", select: "id,year,state,state_po,office,district,candidate,party,candidatevotes,totalvotes,stage,special,writein", orderBy: "id" },
  { table: "mn_cfb_candidates", select: "*", orderBy: "id" },
  { table: "state_cfb_candidates", select: "*", orderBy: "id" },
  { table: "messaging_guidance", select: "id,slug,title,source,source_url,summary,content,issue_areas,research_type,published_date,author,created_at,updated_at", orderBy: "id", pageSize: 200 },
  { table: "local_impacts", select: "*", orderBy: "id" },
  { table: "maga_files", select: "*", orderBy: "id" },
  { table: "narrative_reports", select: "*", orderBy: "id" },
  { table: "prediction_markets", select: "*", orderBy: "id" },
  { table: "district_news_cache", select: "*", orderBy: "id" },
  { table: "wiki_pages", select: "*", orderBy: "id" },
  { table: "section_permissions", select: "*", orderBy: "id" },
  { table: "international_profiles", select: "*", orderBy: "id" },
  { table: "international_elections", select: "*", orderBy: "id" },
  { table: "international_leaders", select: "*", orderBy: "id" },
  { table: "court_cases", select: "*", orderBy: "id", pageSize: 500 },
  { table: "federal_spending", select: "*", orderBy: "id", pageSize: 500 },
  { table: "fara_registrants", select: "*", orderBy: "id" },
  { table: "entity_relationships", select: "*", orderBy: "id", pageSize: 500 },
  { table: "bill_impact_analyses", select: "*", orderBy: "id" },
  { table: "intel_briefings", select: "*", orderBy: "id", pageSize: 500 },
  { table: "reports", select: "*", orderBy: "id" },
  // Additional public/research tables
  { table: "international_legislation", select: "*", orderBy: "id" },
  { table: "international_policy_issues", select: "*", orderBy: "id" },
  { table: "international_polling", select: "*", orderBy: "id" },
  { table: "state_legislative_bills", select: "*", orderBy: "id", pageSize: 500 },
  { table: "state_legislators", select: "*", orderBy: "id", pageSize: 500 },
  { table: "gov_contracts", select: "*", orderBy: "id", pageSize: 500 },
  { table: "lobbying_disclosures", select: "*", orderBy: "id", pageSize: 500 },
  { table: "winred_donations", select: "*", orderBy: "id", pageSize: 500 },
  { table: "polling_aggregates", select: "*", orderBy: "id", pageSize: 500 },
  { table: "forecast_scenarios", select: "*", orderBy: "id" },
  { table: "forecast_simulations", select: "*", orderBy: "id" },
  { table: "news_stories", select: "*", orderBy: "id", pageSize: 500 },
  { table: "news_story_articles", select: "*", orderBy: "id", pageSize: 500 },
  { table: "news_source_ratings", select: "*", orderBy: "id" },
  { table: "url_bias_checks", select: "*", orderBy: "id", pageSize: 500 },
  { table: "vulnerability_scores", select: "*", orderBy: "id" },
  { table: "talking_points", select: "*", orderBy: "id" },
  { table: "messaging_audience_analyses", select: "*", orderBy: "id" },
  { table: "messaging_impact_analyses", select: "*", orderBy: "id" },
  { table: "subject_audience_analyses", select: "*", orderBy: "id" },
  { table: "subject_impact_analyses", select: "*", orderBy: "id" },
  { table: "graph_snapshots", select: "*", orderBy: "id" },
  { table: "ig_reports", select: "*", orderBy: "id" },
  { table: "tracked_bills", select: "*", orderBy: "id" },
  { table: "stakeholders", select: "*", orderBy: "id" },
  { table: "stakeholder_interactions", select: "*", orderBy: "id" },
  { table: "oppo_trackers", select: "*", orderBy: "id" },
  { table: "oppo_tracker_items", select: "*", orderBy: "id" },
  { table: "watchlist_items", select: "*", orderBy: "id" },
  { table: "saved_searches", select: "*", orderBy: "id" },
  { table: "wiki_changelog", select: "*", orderBy: "id" },
  // User-owned data — needed so the UI's read paths still work offline
  // and so the queued-write replay layer can reconcile changes.
  { table: "alert_rules", select: "*", orderBy: "id" },
  { table: "entity_notes", select: "*", orderBy: "id", pageSize: 500 },
  { table: "webhook_endpoints", select: "*", orderBy: "id" },
  { table: "report_shares", select: "*", orderBy: "id" },
  { table: "user_news_preferences", select: "*", orderBy: "id" },
  { table: "user_bias_history", select: "*", orderBy: "id", pageSize: 500 },
  { table: "user_devices", select: "*", orderBy: "id" },
  { table: "user_mail", select: "*", orderBy: "id", pageSize: 500 },
  { table: "user_presence", select: "*", orderBy: "id" },
  { table: "notifications", select: "*", orderBy: "id", pageSize: 500 },
  { table: "chat_messages", select: "*", orderBy: "id", pageSize: 500 },
  { table: "device_locations", select: "*", orderBy: "id", pageSize: 500 },
  { table: "entity_activity", select: "*", orderBy: "id", pageSize: 500 },
  { table: "war_rooms", select: "*", orderBy: "id" },
  { table: "war_room_members", select: "*", orderBy: "id" },
  { table: "war_room_messages", select: "*", orderBy: "id", pageSize: 500 },
  { table: "profiles", select: "id,display_name,avatar_url,bio,updated_at", orderBy: "id", pageSize: 500 },
  { table: "role_groups", select: "*", orderBy: "id" },
  { table: "role_group_members", select: "*", orderBy: "id" },
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

/** Soft-error patterns we treat as "skip table" rather than hard failure */
function isSoftSyncError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("permission denied") ||
    m.includes("row-level security") ||
    m.includes("jwt") ||
    m.includes("not authenticated") ||
    m.includes("does not exist")
  );
}

/** Sync a single table from Supabase to encrypted IndexedDB.
 *  Uses range-based pagination on a stable orderBy column (id). */
async function syncTable(
  tableName: string,
  select: string,
  orderBy: string,
  pageSize = 1000,
): Promise<number> {
  let total = 0;
  let offset = 0;

  // Hard cap to prevent infinite loops on misbehaving endpoints
  const MAX_PAGES = 200;
  let pages = 0;

  while (pages < MAX_PAGES) {
    pages++;
    const { data, error } = await (supabase as any)
      .from(tableName)
      .select(select)
      .order(orderBy, { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      if (isSoftSyncError(error.message || "")) {
        console.warn(`[offlineSync] skip ${tableName}: ${error.message}`);
        return total;
      }
      throw new Error(`Failed to sync ${tableName}: ${error.message}`);
    }
    if (!data || data.length === 0) break;

    // Encrypt + persist each page immediately to bound memory
    await storeEncrypted(tableName, data as Record<string, unknown>[]);
    total += data.length;

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  await setSyncMeta(`lastSync:${tableName}`, Date.now());
  return total;
}

/** Full sync of all tables. Skips entirely when not authenticated. */
export async function syncAllTables(
  onProgress?: (table: string, index: number, total: number) => void,
): Promise<{ synced: number; errors: string[] }> {
  // Use a real reachability probe — `navigator.onLine` lies on iOS.
  const online = await isReallyOnline();
  if (!online) {
    return { synced: 0, errors: ["Device is offline"] };
  }

  // iOS evicts IndexedDB after ~7 days of non-use unless we ask for persistence.
  await ensurePersistentStorage();

  const { data: sess } = await supabase.auth.getSession();
  if (!sess?.session) {
    return { synced: 0, errors: ["Not signed in — sign in to sync data for offline use"] };
  }

  syncStatus.isSyncing = true;
  syncStatus.error = null;
  syncStatus.tablesAvailable = []; // reset for a fresh full sync
  notify();

  let synced = 0;
  const errors: string[] = [];
  const totalSteps = SYNC_TABLES.length + PREFETCH_EDGE_FUNCTIONS.length;

  for (let i = 0; i < SYNC_TABLES.length; i++) {
    const { table, select, orderBy, pageSize } = SYNC_TABLES[i];
    onProgress?.(table, i, totalSteps);

    try {
      const count = await syncTable(table, select, orderBy, pageSize);
      synced += count;
      if (!syncStatus.tablesAvailable.includes(table)) {
        syncStatus.tablesAvailable.push(table);
      }
      // Notify per-table so the UI updates progress incrementally
      notify();
    } catch (e: any) {
      const msg = e?.message || `Failed to sync ${table}`;
      errors.push(`${table}: ${msg}`);
      console.error(`[offlineSync] ${table} failed:`, e);
    }
  }

  // Pre-warm edge function responses so read-only backend endpoints work offline.
  try {
    await prefetchEdgeFunctions(PREFETCH_EDGE_FUNCTIONS, (fn, i) => {
      onProgress?.(`fn:${fn}`, SYNC_TABLES.length + i, totalSteps);
    });
  } catch (e: any) {
    errors.push(`edge-prefetch: ${e?.message || "failed"}`);
  }

  syncStatus.isSyncing = false;
  syncStatus.lastSyncAt = Date.now();
  syncStatus.error = errors.length > 0 ? errors[0] : null;
  await setSyncMeta("lastFullSync", Date.now());
  notify();

  return { synced, errors };
}

/** Sync only a chosen subset of tables (used by per-section "Download for offline" buttons).
 *  Unknown table names are silently skipped. Auth/online checks mirror syncAllTables. */
export async function syncSelectedTables(
  tables: string[],
  onProgress?: (table: string, index: number, total: number) => void,
): Promise<{ synced: number; errors: string[] }> {
  const online = await isReallyOnline();
  if (!online) return { synced: 0, errors: ["Device is offline"] };

  await ensurePersistentStorage();

  const { data: sess } = await supabase.auth.getSession();
  if (!sess?.session) {
    return { synced: 0, errors: ["Not signed in — sign in to sync data for offline use"] };
  }

  const wanted = SYNC_TABLES.filter((t) => tables.includes(t.table));
  if (wanted.length === 0) return { synced: 0, errors: [] };

  syncStatus.isSyncing = true;
  syncStatus.error = null;
  notify();

  let synced = 0;
  const errors: string[] = [];

  for (let i = 0; i < wanted.length; i++) {
    const { table, select, orderBy, pageSize } = wanted[i];
    onProgress?.(table, i, wanted.length);
    try {
      const count = await syncTable(table, select, orderBy, pageSize);
      synced += count;
      if (!syncStatus.tablesAvailable.includes(table)) {
        syncStatus.tablesAvailable.push(table);
      }
      notify();
    } catch (e: any) {
      const msg = e?.message || `Failed to sync ${table}`;
      errors.push(`${table}: ${msg}`);
      console.error(`[offlineSync] ${table} failed:`, e);
    }
  }

  syncStatus.isSyncing = false;
  syncStatus.lastSyncAt = Date.now();
  syncStatus.error = errors.length > 0 ? errors[0] : null;
  notify();

  return { synced, errors };
}

/** Replay pending writes to Supabase. Permanent (RLS / validation / 4xx)
 *  errors drop the write so it does not jam the queue forever; transient
 *  network errors keep the write for the next online cycle. */
export async function replayPendingWrites(): Promise<{ replayed: number; failed: number; dropped: number }> {
  const online = await isReallyOnline();
  if (!online) return { replayed: 0, failed: 0, dropped: 0 };

  const pending = await getPendingWrites();
  let replayed = 0;
  let failed = 0;
  let dropped = 0;

  for (const write of pending) {
    try {
      const sb = supabase as any;
      let error: { message: string; code?: string } | null = null;
      if (write.operation === "insert") {
        ({ error } = await sb.from(write.table).insert(write.data));
      } else if (write.operation === "update") {
        const { id, ...rest } = write.data;
        ({ error } = await sb.from(write.table).update(rest).eq("id", String(id)));
      } else if (write.operation === "delete") {
        ({ error } = await sb.from(write.table).delete().eq("id", String(write.data.id)));
      }

      if (error) {
        const msg = (error.message || "").toLowerCase();
        const permanent =
          msg.includes("permission denied") ||
          msg.includes("row-level security") ||
          msg.includes("violates") ||
          msg.includes("duplicate key") ||
          msg.includes("does not exist") ||
          msg.includes("invalid input") ||
          msg.includes("not null");
        if (permanent) {
          console.warn(`[offlineSync] dropping permanent-fail write ${write.id} on ${write.table}: ${error.message}`);
          await removePendingWrite(write.id);
          dropped++;
          continue;
        }
        throw new Error(error.message);
      }

      await removePendingWrite(write.id);
      replayed++;
    } catch (e) {
      console.error(`Failed to replay write ${write.id} on ${write.table}:`, e);
      failed++;
    }
  }

  syncStatus.pendingWrites = (await getPendingWrites()).length;
  notify();
  return { replayed, failed, dropped };
}

/** Get offline data for a table (falls back to encrypted store when offline) */
export async function getOfflineData<T = Record<string, unknown>>(table: string): Promise<T[]> {
  const online = await isReallyOnline();
  if (online) {
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

/** Queue a write for offline-first operation.
 *  Strategy: try the live write first when online. If the call **throws**
 *  (network failure, fetch abort) we enqueue. RLS / 4xx errors from the
 *  server are surfaced to the caller — those are not connectivity issues
 *  and silently queueing them would mask real bugs. */
export async function offlineWrite(
  table: string,
  operation: "insert" | "update" | "delete" | "upsert",
  data: Record<string, unknown>,
): Promise<{ queued: boolean; error?: string }> {
  const online = await isReallyOnline();
  if (online) {
    try {
      const sb = supabase as any;
      let error: { message: string } | null = null;
      if (operation === "insert") {
        ({ error } = await sb.from(table).insert(data));
      } else if (operation === "upsert") {
        ({ error } = await sb.from(table).upsert(data));
      } else if (operation === "update") {
        const { id, ...rest } = data;
        ({ error } = await sb.from(table).update(rest).eq("id", String(id)));
      } else {
        ({ error } = await sb.from(table).delete().eq("id", String(data.id)));
      }
      if (!error) return { queued: false };
      // Surface RLS / validation errors instead of silently queueing.
      return { queued: false, error: error.message };
    } catch (e: any) {
      // Network / fetch failure — fall through to queue.
      console.warn(`[offlineSync] live ${operation} on ${table} threw, queueing:`, e?.message);
    }
  }

  // Upsert isn't supported in the legacy queue schema; map to insert as the
  // closest equivalent — replay will retry as insert.
  const op: "insert" | "update" | "delete" = operation === "upsert" ? "insert" : operation;
  await queueWrite(table, op, data);
  syncStatus.pendingWrites++;
  notify();
  return { queued: true };
}

/** Drop-in helpers mirroring the supabase-js shape but offline-aware. */
export const offlineInsert = (table: string, data: Record<string, unknown>) =>
  offlineWrite(table, "insert", data);
export const offlineUpdate = (
  table: string,
  data: Record<string, unknown> & { id: string | number },
) => offlineWrite(table, "update", data);
export const offlineUpsert = (table: string, data: Record<string, unknown>) =>
  offlineWrite(table, "upsert", data);
export const offlineDelete = (table: string, id: string | number) =>
  offlineWrite(table, "delete", { id });

/** Initialize offline sync — installs reachability watcher + persistent storage. */
export function initOfflineSync(): () => void {
  // Request persistent storage early so iOS doesn't evict our encrypted DB.
  void ensurePersistentStorage();

  const stopWatch = watchReachability(async (online) => {
    syncStatus.isOnline = online;
    notify();
    if (online) {
      await replayPendingWrites();
    }
  });

  // Replay on visibility-change too — iOS PWAs commonly reopen after a while.
  const onVisible = () => {
    if (document.visibilityState === "visible") void replayPendingWrites();
  };
  document.addEventListener("visibilitychange", onVisible);

  // Load initial state
  (async () => {
    const lastSync = await getSyncMeta<number>("lastFullSync");
    syncStatus.lastSyncAt = lastSync || null;
    const pending = await getPendingWrites();
    syncStatus.pendingWrites = pending.length;
    syncStatus.isOnline = await isReallyOnline();
    notify();
  })();

  return () => {
    stopWatch();
    document.removeEventListener("visibilitychange", onVisible);
  };
}
