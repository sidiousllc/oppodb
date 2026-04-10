import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

export type MapSource = "local" | "esri" | "census" | "auto";

export interface MapLoadResult {
  geoData: GeoJSONData | null;
  loading: boolean;
  error: string | null;
  source: MapSource | null;
  loadTimeMs: number | null;
  featureCount: number;
  diagnostics: MapDiagnostics;
  retry: () => void;
  setPreferredSource: (s: MapSource) => void;
  preferredSource: MapSource;
}

export interface MapDiagnostics {
  attempts: { source: MapSource; success: boolean; timeMs: number; error?: string }[];
  selectedSource: MapSource | null;
  totalFeatures: number;
  statesFound: number;
  cacheHit: boolean;
  offlineReady: boolean;
  idbCachedAt: string | null;
}

export interface GeoJSONData {
  type: string;
  features: Array<{
    type: string;
    properties: Record<string, unknown>;
    geometry: unknown;
  }>;
}

// ─── Sources ────────────────────────────────────────────────────────────────

const SOURCE_META: Record<MapSource, { label: string; description: string }> = {
  local: {
    label: "Local (Bundled)",
    description: "Pre-bundled GeoJSON from Census TIGER/Line. Fastest, works offline.",
  },
  esri: {
    label: "Esri Living Atlas",
    description: "ArcGIS FeatureServer with 118th Congress districts. Higher detail.",
  },
  census: {
    label: "Census TIGERweb",
    description: "U.S. Census Bureau TIGERweb WMS. Official source, moderate speed.",
  },
  auto: {
    label: "Auto (Smart Fallback)",
    description: "Tries local first, then Esri, then Census. Auto-recovers from failures.",
  },
};

export { SOURCE_META };

// ─── In-Memory Cache ────────────────────────────────────────────────────────

const geoCache = new Map<MapSource, GeoJSONData>();

// ─── IndexedDB Offline Cache ────────────────────────────────────────────────

const IDB_NAME = "oppodb-map-cache";
const IDB_VERSION = 1;
const IDB_STORE = "geodata";

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "source" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(source: string): Promise<{ data: GeoJSONData; cachedAt: string } | null> {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(source);
      req.onsuccess = () => {
        const result = req.result;
        if (result?.data) {
          resolve({ data: result.data, cachedAt: result.cachedAt || "" });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function idbPut(source: string, data: GeoJSONData): Promise<void> {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      store.put({ source, data, cachedAt: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // IndexedDB unavailable — silently skip
  }
}

async function idbClear(): Promise<void> {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

async function idbHasAny(): Promise<boolean> {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).count();
      req.onsuccess = () => resolve(req.result > 0);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

// ─── Fetchers ───────────────────────────────────────────────────────────────

async function fetchLocal(signal: AbortSignal): Promise<GeoJSONData> {
  const res = await fetch("/us-cd-118.json", { signal });
  if (!res.ok) throw new Error(`Local GeoJSON: HTTP ${res.status}`);
  const data = await res.json();
  if (!data?.features?.length) throw new Error("Local GeoJSON: empty features");
  return data;
}

async function fetchEsri(signal: AbortSignal): Promise<GeoJSONData> {
  const ESRI_URL =
    "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_118th_Congressional_Districts/FeatureServer/0/query";
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "STATE_ABBR,CDFIPS,DISTRICTID,NAME",
    f: "geojson",
    outSR: "4326",
    returnGeometry: "true",
    maxAllowableOffset: "0.01",
    resultRecordCount: "500",
  });
  const res = await fetch(`${ESRI_URL}?${params}`, { signal });
  if (!res.ok) throw new Error(`Esri API: HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Esri API: ${data.error.message || "unknown error"}`);
  if (!data?.features?.length) throw new Error("Esri API: empty features");
  return data;
}

async function fetchCensus(signal: AbortSignal): Promise<GeoJSONData> {
  const CENSUS_URL =
    "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer/0/query";
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "STATE,CD118FP,GEOID,BASENAME",
    f: "geojson",
    outSR: "4326",
    returnGeometry: "true",
    maxAllowableOffset: "0.01",
    resultRecordCount: "500",
  });
  const res = await fetch(`${CENSUS_URL}?${params}`, { signal });
  if (!res.ok) throw new Error(`Census API: HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Census API: ${data.error.message || "unknown error"}`);
  if (!data?.features?.length) throw new Error("Census API: empty features");

  data.features = data.features.map((f: { properties: Record<string, unknown>; [key: string]: unknown }) => ({
    ...f,
    properties: {
      ...f.properties,
      STATE_ABBR: f.properties.STATE || f.properties.STUSAB,
      CDFIPS: f.properties.CD118FP || f.properties.BASENAME,
    },
  }));
  return data;
}

const FETCHERS: Record<Exclude<MapSource, "auto">, (signal: AbortSignal) => Promise<GeoJSONData>> = {
  local: fetchLocal,
  esri: fetchEsri,
  census: fetchCensus,
};

const AUTO_ORDER: Exclude<MapSource, "auto">[] = ["local", "esri", "census"];

// ─── Validation ─────────────────────────────────────────────────────────────

function validateGeoData(data: GeoJSONData): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!data.features || !Array.isArray(data.features)) {
    issues.push("Missing or invalid features array");
    return { valid: false, issues };
  }
  if (data.features.length === 0) {
    issues.push("Zero features loaded");
    return { valid: false, issues };
  }
  if (data.features.length < 400) {
    issues.push(`Only ${data.features.length} features (expected ~436). Some districts may be missing.`);
  }

  const missingGeom = data.features.filter(f => !f.geometry).length;
  if (missingGeom > 0) {
    issues.push(`${missingGeom} features have no geometry`);
  }

  const states = new Set(data.features.map(f => f.properties?.STATE_ABBR).filter(Boolean));
  if (states.size < 45) {
    issues.push(`Only ${states.size} states represented (expected 50+)`);
  }

  return { valid: issues.length === 0 || data.features.length > 100, issues };
}

function cleanGeoData(data: GeoJSONData): GeoJSONData {
  return {
    ...data,
    features: data.features.filter(f => f.geometry != null),
  };
}

function countStates(data: GeoJSONData): number {
  return new Set(data.features.map(f => f.properties?.STATE_ABBR).filter(Boolean)).size;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useMapLoader(): MapLoadResult {
  const savedSource = typeof window !== "undefined"
    ? (localStorage.getItem("map-source-pref") as MapSource | null) || "auto"
    : "auto";

  const [preferredSource, setPreferredSourceState] = useState<MapSource>(savedSource);
  const [geoData, setGeoData] = useState<GeoJSONData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<MapSource | null>(null);
  const [loadTimeMs, setLoadTimeMs] = useState<number | null>(null);
  const [diagnostics, setDiagnostics] = useState<MapDiagnostics>({
    attempts: [],
    selectedSource: null,
    totalFeatures: 0,
    statesFound: 0,
    cacheHit: false,
    offlineReady: false,
    idbCachedAt: null,
  });

  const abortRef = useRef<AbortController | null>(null);
  const retryCount = useRef(0);

  const setPreferredSource = useCallback((s: MapSource) => {
    localStorage.setItem("map-source-pref", s);
    setPreferredSourceState(s);
  }, []);

  const applyData = useCallback((
    data: GeoJSONData,
    src: MapSource,
    elapsed: number,
    attempts: MapDiagnostics["attempts"],
    cacheHit: boolean,
    idbCachedAt: string | null,
  ) => {
    const clean = cleanGeoData(data);
    const states = countStates(clean);
    setGeoData(clean);
    setActiveSource(src);
    setLoadTimeMs(elapsed);
    setDiagnostics({
      attempts,
      selectedSource: src,
      totalFeatures: clean.features.length,
      statesFound: states,
      cacheHit,
      offlineReady: true,
      idbCachedAt,
    });
    setLoading(false);
  }, []);

  const loadMap = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setGeoData(null);

    const attempts: MapDiagnostics["attempts"] = [];
    const sources = preferredSource === "auto" ? AUTO_ORDER : [preferredSource];

    // Step 1: Check in-memory cache
    for (const src of sources) {
      if (geoCache.has(src)) {
        const cached = geoCache.get(src)!;
        attempts.push({ source: src, success: true, timeMs: 0 });
        // Check IDB timestamp
        const idbEntry = await idbGet(src);
        applyData(cached, src, 0, attempts, true, idbEntry?.cachedAt || null);
        return;
      }
    }

    // Step 2: Check IndexedDB (offline cache)
    for (const src of sources) {
      if (controller.signal.aborted) break;
      const idbEntry = await idbGet(src);
      if (idbEntry) {
        const validation = validateGeoData(idbEntry.data);
        if (validation.valid) {
          geoCache.set(src, idbEntry.data);
          attempts.push({ source: src, success: true, timeMs: 0, error: undefined });
          applyData(idbEntry.data, src, 0, attempts, true, idbEntry.cachedAt);
          // Background refresh from network (don't block UI)
          refreshInBackground(src, controller.signal);
          return;
        }
      }
    }

    // Step 3: Fetch from network
    for (const src of sources) {
      if (controller.signal.aborted) break;

      const start = performance.now();
      try {
        const timeoutId = setTimeout(() => {
          if (!controller.signal.aborted) controller.abort();
        }, src === "local" ? 10000 : 20000);

        const data = await FETCHERS[src](controller.signal);
        clearTimeout(timeoutId);

        const elapsed = Math.round(performance.now() - start);
        const validation = validateGeoData(data);

        if (validation.valid) {
          geoCache.set(src, data);
          attempts.push({ source: src, success: true, timeMs: elapsed });
          applyData(data, src, elapsed, attempts, false, null);

          // Persist to IndexedDB for offline use
          idbPut(src, data).then(() => {
            setDiagnostics(prev => ({
              ...prev,
              offlineReady: true,
              idbCachedAt: new Date().toISOString(),
            }));
          });
          return;
        } else {
          attempts.push({
            source: src,
            success: false,
            timeMs: elapsed,
            error: validation.issues.join("; "),
          });
        }
      } catch (e) {
        const elapsed = Math.round(performance.now() - start);
        const errMsg = (e as Error).name === "AbortError" ? "Timeout" : (e as Error).message;
        attempts.push({ source: src, success: false, timeMs: elapsed, error: errMsg });
      }
    }

    // All sources failed — last resort: try any IDB entry
    for (const src of (["local", "esri", "census"] as const)) {
      const idbEntry = await idbGet(src);
      if (idbEntry && idbEntry.data?.features?.length > 0) {
        geoCache.set(src, idbEntry.data);
        attempts.push({ source: src, success: true, timeMs: 0, error: "offline fallback" });
        applyData(idbEntry.data, src, 0, attempts, true, idbEntry.cachedAt);
        return;
      }
    }

    const offlineReady = await idbHasAny();
    setDiagnostics({
      attempts,
      selectedSource: null,
      totalFeatures: 0,
      statesFound: 0,
      cacheHit: false,
      offlineReady,
      idbCachedAt: null,
    });
    setError(
      `All map sources failed. ${attempts.map(a => `${a.source}: ${a.error}`).join(" | ")}`
    );
    setLoading(false);
  }, [preferredSource, applyData]);

  // Background refresh: silently update IDB with fresh data
  const refreshInBackground = useCallback(async (src: Exclude<MapSource, "auto">, signal: AbortSignal) => {
    try {
      const data = await FETCHERS[src](signal);
      const validation = validateGeoData(data);
      if (validation.valid) {
        geoCache.set(src, data);
        await idbPut(src, data);
      }
    } catch {
      // Background refresh failed — no problem, we have cached data
    }
  }, []);

  const retry = useCallback(() => {
    retryCount.current += 1;
    if (preferredSource !== "auto") {
      geoCache.delete(preferredSource);
    } else {
      geoCache.clear();
    }
    // Also clear IDB on explicit retry
    idbClear().then(() => loadMap());
  }, [loadMap, preferredSource]);

  useEffect(() => {
    loadMap();
    return () => abortRef.current?.abort();
  }, [loadMap]);

  return {
    geoData,
    loading,
    error,
    source: activeSource,
    loadTimeMs,
    featureCount: geoData?.features?.length ?? 0,
    diagnostics,
    retry,
    setPreferredSource,
    preferredSource,
  };
}
