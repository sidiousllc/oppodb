// Persist per-app window geometry (position + size) to localStorage so windows
// reopen where the user last left them. Keyed by appId — singleton apps get a
// stable slot; multi-instance apps share the same default per appId.
const LS_KEY = "win98:geometry:v1";

export interface Geometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Store = Record<string, Geometry>;

// ─── Viewport helpers ──────────────────────────────────────────────────────────
// Works across desktop browsers, mobile browsers ( Safari / Chrome ), and
// Capacitor Android WebViews where window.innerWidth/Height can lag the
// virtual keyboard or URL bar without visualViewport support.

function readAll(): Store {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function writeAll(store: Store) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(store));
  } catch {
    /* quota — ignore */
  }
}

export function loadGeometry(appId: string): Geometry | null {
  const store = readAll();
  const g = store[appId];
  if (!g) return null;
  if (
    typeof g.x !== "number" ||
    typeof g.y !== "number" ||
    typeof g.width !== "number" ||
    typeof g.height !== "number"
  ) {
    return null;
  }
  return g;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
const pending: Store = {};

export function saveGeometry(appId: string, g: Geometry) {
  pending[appId] = g;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const store = readAll();
    Object.assign(store, pending);
    writeAll(store);
    for (const k of Object.keys(pending)) delete pending[k];
    saveTimer = null;
  }, 250);
}

// Returns the current viewport dimensions, preferring the VisualViewport API
// on mobile so we account for the virtual keyboard and browser chrome.
// Falls back to window.innerWidth/innerHeight on desktop / non-supporting envs.
export function getViewport(): { vw: number; vh: number } {
  if (typeof window === "undefined") return { vw: 1024, vh: 768 };
  const vv = window.visualViewport;
  if (vv) {
    return {
      vw: vv.width,
      vh: vv.height,
    };
  }
  return {
    vw: window.innerWidth,
    vh: window.innerHeight,
  };
}

// True when the current platform is a mobile device (iOS Safari / Android
// Chrome / Android Capacitor WebView). Used to suppress desktop chrome
// calculations (taskbar) on devices where that space is already accounted
// for by the OS window manager.
export function isMobilePlatform(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|OPR\/|Mobile/i.test(ua);
}

// Returns the usable screen area, subtracting platform chrome.
// On desktop a ~28 px taskbar is assumed; on mobile the OS already
// accounts for nav/tab bars so we return the full height.
export function getUsableViewport(): { vw: number; vh: number } {
  const { vw, vh } = getViewport();
  if (isMobilePlatform()) return { vw, vh };
  const TASKBAR = 28;
  return { vw, vh: vh - TASKBAR };
}

// Like saveGeometry but overwrites immediately (no debounce) and is used
// when we need to force a geometry refresh after an external change like
// a theme switch or DPI scaling change.
export function reapplyGeometry(
  appId: string,
  g: Geometry,
  viewport: { vw: number; vh: number }
): Geometry {
  const { vw, vh } = getUsableViewportFromViewport(viewport);
  const winW = Math.min(g.width, Math.max(280, vw - 16));
  const winH = Math.min(g.height, Math.max(200, vh - 16));
  const x = Math.max(0, Math.min(g.x, Math.max(0, vw - winW)));
  const y = Math.max(0, Math.min(g.y, Math.max(0, vh - winH)));
  const clamped: Geometry = { x, y, width: winW, height: winH };
  const store = readAll();
  store[appId] = clamped;
  writeAll(store);
  return clamped;
}

// Internal helper — converts a raw {vw, vh} to usable area (subtracts taskbar
// on desktop, returns as-is on mobile).
function getUsableViewportFromViewport(viewport: { vw: number; vh: number }): { vw: number; vh: number } {
  if (isMobilePlatform()) return viewport;
  const TASKBAR = 28;
  return { vw: viewport.vw, vh: viewport.vh - TASKBAR };
}

export function reapplyAllGeometry(): void {
  if (typeof window === "undefined") return;
  const { vw, vh } = getUsableViewport();
  const store = readAll();
  const next: Store = {};
  for (const [appId, g] of Object.entries(store)) {
    if (
      typeof g.x !== "number" ||
      typeof g.y !== "number" ||
      typeof g.width !== "number" ||
      typeof g.height !== "number"
    ) {
      continue;
    }
    const winW = Math.min(g.width, Math.max(280, vw - 16));
    const winH = Math.min(g.height, Math.max(200, vh - 16));
    const x = Math.max(0, Math.min(g.x, Math.max(0, vw - winW)));
    const y = Math.max(0, Math.min(g.y, Math.max(0, vh - winH)));
    next[appId] = { x, y, width: winW, height: winH };
  }
  writeAll(next);
}

// Re-clamp a single geometry object through the current usable viewport.
// Returns the clamped values without writing to localStorage.
export function clampGeometry(g: Geometry): Geometry {
  const { vw, vh } = getUsableViewport();
  const winW = Math.min(g.width, Math.max(280, vw - 16));
  const winH = Math.min(g.height, Math.max(200, vh - 16));
  const x = Math.max(0, Math.min(g.x, Math.max(0, vw - winW)));
  const y = Math.max(0, Math.min(g.y, Math.max(0, vh - winH)));
  return { x, y, width: winW, height: winH };
}
