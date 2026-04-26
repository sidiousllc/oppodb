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

// Like saveGeometry but overwrites immediately (no debounce) and is used
// when we need to force a geometry refresh after an external change like
// a theme switch or DPI scaling change.
export function reapplyGeometry(
  appId: string,
  g: Geometry,
  viewport: { vw: number; vh: number }
): Geometry {
  const TASKBAR = 28;
  const vw = viewport.vw;
  const vh = viewport.vh - TASKBAR;
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

export function reapplyAllGeometry(): void {
  if (typeof window === "undefined") return;
  const TASKBAR = 28;
  const vw = window.innerWidth;
  const vh = window.innerHeight - TASKBAR;
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
