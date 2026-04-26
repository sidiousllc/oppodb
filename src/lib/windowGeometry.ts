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
