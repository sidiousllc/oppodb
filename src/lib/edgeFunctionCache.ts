/**
 * Cache wrapper for Supabase Edge Function GET responses.
 *
 * Stores raw JSON responses in IndexedDB so that read-only edge functions
 * (intel briefings, geopolitics, voter lookups, polling aggregates, etc.)
 * keep working when the device is offline — including iOS PWAs where
 * network reachability is unreliable.
 *
 * Mutating calls are intentionally NOT cached; they go through `offlineWrite`.
 */
import { supabase } from "@/integrations/supabase/client";
import { isReallyOnline } from "./iosOffline";
import { getDB } from "./encryptedStore";

const STORE = "edge_cache";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface CachedResponse {
  key: string;
  data: unknown;
  cachedAt: number;
  fn: string;
}

async function ensureStore() {
  const db = await getDB();
  if (!db.objectStoreNames.contains(STORE)) {
    // The store is created via the upgrade hook in encryptedStore.ts
    // (we bumped DB_VERSION there). If it's still missing, fall back gracefully.
    return null;
  }
  return db;
}

function makeKey(fn: string, body: unknown): string {
  try {
    return `${fn}:${JSON.stringify(body ?? null)}`;
  } catch {
    return `${fn}:_`;
  }
}

/**
 * Invoke an edge function with offline-aware caching.
 * - Online: call the function, cache the result, return it.
 * - Offline / failed: return the most recent cached value if available.
 */
export async function invokeWithCache<T = unknown>(
  fn: string,
  body?: Record<string, unknown>,
  opts: { ttlMs?: number; forceRefresh?: boolean } = {},
): Promise<{ data: T | null; error: Error | null; fromCache: boolean }> {
  const ttl = opts.ttlMs ?? DEFAULT_TTL_MS;
  const key = makeKey(fn, body);
  const db = await ensureStore();

  const readCache = async (): Promise<CachedResponse | null> => {
    if (!db) return null;
    try {
      const row = (await db.get(STORE, key)) as CachedResponse | undefined;
      return row ?? null;
    } catch {
      return null;
    }
  };

  const writeCache = async (data: unknown) => {
    if (!db) return;
    try {
      await db.put(STORE, { key, data, cachedAt: Date.now(), fn } satisfies CachedResponse);
    } catch {
      /* quota exceeded — ignore */
    }
  };

  const online = await isReallyOnline();

  if (online && !opts.forceRefresh) {
    // Try a fresh call first; on any failure fall back to cache.
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (!error) {
        await writeCache(data);
        return { data: data as T, error: null, fromCache: false };
      }
    } catch {
      /* fall through to cache */
    }
  } else if (online && opts.forceRefresh) {
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (!error) {
        await writeCache(data);
        return { data: data as T, error: null, fromCache: false };
      }
    } catch {
      /* ignore */
    }
  }

  const cached = await readCache();
  if (cached && Date.now() - cached.cachedAt < ttl * 7) {
    // Honour TTL loosely: while truly offline we still serve up to 7×TTL stale.
    return { data: cached.data as T, error: null, fromCache: true };
  }

  return {
    data: null,
    error: new Error(online ? "Edge function failed and no cached response available" : "Offline and no cached response available"),
    fromCache: false,
  };
}

/** Pre-warm the cache for a list of edge functions (used during full sync). */
export async function prefetchEdgeFunctions(
  calls: Array<{ fn: string; body?: Record<string, unknown> }>,
  onProgress?: (fn: string, i: number, total: number) => void,
): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;
  for (let i = 0; i < calls.length; i++) {
    const { fn, body } = calls[i];
    onProgress?.(fn, i, calls.length);
    const res = await invokeWithCache(fn, body, { forceRefresh: true });
    if (res.error) failed++;
    else ok++;
  }
  return { ok, failed };
}

/** Clear all cached edge-function responses. */
export async function clearEdgeCache(): Promise<void> {
  const db = await ensureStore();
  if (!db) return;
  await db.clear(STORE);
}
