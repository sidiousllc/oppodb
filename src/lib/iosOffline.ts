/**
 * iOS PWA reliability helpers.
 *
 * iOS Safari + standalone PWAs have a number of well-documented quirks:
 *  - `navigator.onLine` is unreliable (often `true` while disconnected).
 *  - `online` / `offline` events frequently don't fire when launched from the home screen.
 *  - IndexedDB is evicted after ~7 days of non-use unless storage is marked persistent.
 *  - `BackgroundSync` / `PeriodicBackgroundSync` are not implemented — replay must be foreground.
 *
 * This module centralises the workarounds so the rest of the codebase can stay simple.
 */

const REACHABILITY_URL = `${import.meta.env.VITE_SUPABASE_URL ?? ""}/auth/v1/health`;
const REACHABILITY_TIMEOUT_MS = 4000;
const REACHABILITY_TTL_MS = 15_000;

let lastReachableAt = 0;
let lastReachableValue = true;
let inFlight: Promise<boolean> | null = null;

/**
 * Probe network reachability with a tiny HEAD-equivalent request.
 * Cached for 15s to avoid hammering the network on every call.
 */
export async function isReallyOnline(): Promise<boolean> {
  // Honour the OS hint when it says we're offline — that one is reliable.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    lastReachableValue = false;
    lastReachableAt = Date.now();
    return false;
  }

  const now = Date.now();
  if (now - lastReachableAt < REACHABILITY_TTL_MS) return lastReachableValue;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      if (!REACHABILITY_URL || REACHABILITY_URL === "/auth/v1/health") return true;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), REACHABILITY_TIMEOUT_MS);
      const res = await fetch(REACHABILITY_URL, {
        method: "GET",
        cache: "no-store",
        signal: ctrl.signal,
        // credentials omitted on purpose — we just want a connectivity probe
      });
      clearTimeout(timer);
      lastReachableValue = res.ok || res.status < 500;
    } catch {
      lastReachableValue = false;
    } finally {
      lastReachableAt = Date.now();
      inFlight = null;
    }
    return lastReachableValue;
  })();

  return inFlight;
}

/**
 * Ask the browser to mark our storage as persistent so iOS won't evict
 * IndexedDB (and our AES master key with it) after 7 days of inactivity.
 * Safe to call repeatedly.
 */
export async function ensurePersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
    const already = await navigator.storage.persisted?.();
    if (already) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Returns rough byte usage / quota — useful for the network settings panel. */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (!navigator.storage?.estimate) return null;
    const est = await navigator.storage.estimate();
    return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
  } catch {
    return null;
  }
}

export function isIosPwa(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
  // @ts-expect-error iOS standalone flag
  const standalone = window.navigator.standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches;
  return isIos && standalone;
}

/**
 * Attach a foreground reachability watcher.
 * iOS rarely fires `online`/`offline`; we re-check on `visibilitychange`,
 * `pageshow`, and on a 30s interval whenever the tab is visible.
 */
export function watchReachability(onChange: (online: boolean) => void): () => void {
  let last = lastReachableValue;
  const tick = async () => {
    const now = await isReallyOnline();
    if (now !== last) {
      last = now;
      onChange(now);
    }
  };

  const onVisible = () => {
    if (document.visibilityState === "visible") void tick();
  };

  window.addEventListener("online", tick);
  window.addEventListener("offline", tick);
  window.addEventListener("pageshow", tick);
  document.addEventListener("visibilitychange", onVisible);

  const interval = window.setInterval(() => {
    if (document.visibilityState === "visible") void tick();
  }, 30_000);

  // Kick off an initial probe
  void tick();

  return () => {
    window.removeEventListener("online", tick);
    window.removeEventListener("offline", tick);
    window.removeEventListener("pageshow", tick);
    document.removeEventListener("visibilitychange", onVisible);
    window.clearInterval(interval);
  };
}
