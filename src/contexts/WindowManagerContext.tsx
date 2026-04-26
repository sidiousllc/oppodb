import { createContext, useContext, useCallback, useEffect, useRef, useState, ReactNode } from "react";
import { loadGeometry, saveGeometry, reapplyAllGeometry } from "@/lib/windowGeometry";

export interface OpenWindow {
  /** Unique instance id (random per open) */
  id: string;
  /** App identifier from the registry — multiple windows of the same appId allowed */
  appId: string;
  /** Optional payload passed to the rendered component (e.g., toolId, slug) */
  payload?: Record<string, any>;
  title: string;
  icon: string;
  zIndex: number;
  minimized: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

interface WindowManagerContextType {
  windows: OpenWindow[];
  openWindow: (params: {
    appId: string;
    title: string;
    icon: string;
    payload?: Record<string, any>;
    /** When true, only one instance per appId — focus existing if open */
    singleton?: boolean;
    size?: { width: number; height: number };
  }) => string;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  /** Legacy API used by Win98Window — kept for back-compat */
  bringToFront: (windowId: string) => number;
  getZIndex: (windowId: string) => number;
}

const WindowManagerContext = createContext<WindowManagerContextType>({
  windows: [],
  openWindow: () => "",
  closeWindow: () => {},
  minimizeWindow: () => {},
  focusWindow: () => {},
  bringToFront: () => 900,
  getZIndex: () => 900,
});

const BASE_Z = 900;

export function WindowManagerProvider({ children }: { children: ReactNode }) {
  const zCounterRef = useRef(0);
  const windowZMap = useRef(new Map<string, number>());
  const openIndexRef = useRef(0);
  const [windows, setWindows] = useState<OpenWindow[]>([]);

  const bringToFront = useCallback((windowId: string) => {
    zCounterRef.current += 1;
    const z = BASE_Z + zCounterRef.current;
    windowZMap.current.set(windowId, z);
    return z;
  }, []);

  const getZIndex = useCallback((windowId: string) => {
    return windowZMap.current.get(windowId) ?? BASE_Z;
  }, []);

  const openWindow: WindowManagerContextType["openWindow"] = useCallback((params) => {
    const { appId, title, icon, payload, singleton, size } = params;
    let resultId = "";
    setWindows((prev) => {
      if (singleton) {
        const existing = prev.find((w) => w.appId === appId);
        if (existing) {
          zCounterRef.current += 1;
          const z = BASE_Z + zCounterRef.current;
          resultId = existing.id;
          return prev.map((w) =>
            w.id === existing.id ? { ...w, minimized: false, zIndex: z } : w
          );
        }
      }
      const id = `${appId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      resultId = id;
      zCounterRef.current += 1;
      const z = BASE_Z + zCounterRef.current;
      // Available area (account for taskbar ~28px)
      const TASKBAR = 28;
      const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
      const vh = (typeof window !== "undefined" ? window.innerHeight : 768) - TASKBAR;
      // Try restoring persisted geometry first; fall back to cascade defaults.
      const saved = loadGeometry(appId);
      const desiredW = saved?.width ?? size?.width ?? Math.min(900, Math.max(320, vw - 40));
      const desiredH = saved?.height ?? size?.height ?? Math.min(640, Math.max(240, vh - 40));
      const winW = Math.min(desiredW, Math.max(280, vw - 16));
      const winH = Math.min(desiredH, Math.max(200, vh - 16));
      let x: number;
      let y: number;
      if (saved) {
        x = Math.max(0, Math.min(saved.x, vw - winW));
        y = Math.max(0, Math.min(saved.y, vh - winH));
      } else {
        // Cascade position so multiple windows don't overlap exactly
        const idx = openIndexRef.current++;
        const baseX = 20 + (idx % 8) * 28;
        const baseY = 20 + (idx % 8) * 24;
        x = Math.max(0, Math.min(baseX, vw - winW));
        y = Math.max(0, Math.min(baseY, vh - winH));
      }
      return [
        ...prev,
        {
          id,
          appId,
          payload,
          title,
          icon,
          zIndex: z,
          minimized: false,
          position: { x, y },
          size: { width: winW, height: winH },
        },
      ];
    });
    return resultId;
  }, []);

  const closeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: !w.minimized } : w)));
  }, []);

  const focusWindow = useCallback((id: string) => {
    zCounterRef.current += 1;
    const z = BASE_Z + zCounterRef.current;
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, zIndex: z, minimized: false } : w))
    );
  }, []);

  // Re-clamp all open windows whenever the viewport changes (resize, devtools
  // open/close, orientation flip) so a window can never end up partially or
  // fully off-screen. Persist the clamped geometry so reopening uses the
  // corrected position rather than the stale saved one.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const TASKBAR = 28;
    const clampAll = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight - TASKBAR;
      setWindows((prev) =>
        prev.map((w) => {
          const width = Math.min(w.size.width, Math.max(280, vw - 16));
          const height = Math.min(w.size.height, Math.max(200, vh - 16));
          const x = Math.max(0, Math.min(w.position.x, Math.max(0, vw - width)));
          const y = Math.max(0, Math.min(w.position.y, Math.max(0, vh - height)));
          if (
            width === w.size.width &&
            height === w.size.height &&
            x === w.position.x &&
            y === w.position.y
          ) {
            return w;
          }
          // Persist the clamped values so a future restore doesn't re-apply
          // the off-screen coordinates that we just corrected.
          saveGeometry(w.appId, { x, y, width, height });
          return { ...w, size: { width, height }, position: { x, y } };
        })
      );
    };
    window.addEventListener("resize", clampAll);
    window.addEventListener("orientationchange", clampAll);
    clampAll();
    return () => {
      window.removeEventListener("resize", clampAll);
      window.removeEventListener("orientationchange", clampAll);
    };
  }, []);

  // Reapply saved geometries when the OS-level display scaling (DPI / zoom)
  // changes — window positions stored in CSS pixels become incorrect at a new
  // scale, and clamping against the new viewport is necessary to stay on-screen.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let lastDpr = window.devicePixelRatio;
    const pollDpr = () => {
      const current = window.devicePixelRatio;
      if (current !== lastDpr) {
        lastDpr = current;
        reapplyAllGeometry();
        // Also re-clamp open windows in the current React state.
        const TASKBAR = 28;
        const vw = window.innerWidth;
        const vh = window.innerHeight - TASKBAR;
        setWindows((prev) =>
          prev.map((w) => {
            const width = Math.min(w.size.width, Math.max(280, vw - 16));
            const height = Math.min(w.size.height, Math.max(200, vh - 16));
            const x = Math.max(0, Math.min(w.position.x, Math.max(0, vw - width)));
            const y = Math.max(0, Math.min(w.position.y, Math.max(0, vh - height)));
            if (
              width === w.size.width &&
              height === w.size.height &&
              x === w.position.x &&
              y === w.position.y
            ) {
              return w;
            }
            saveGeometry(w.appId, { x, y, width, height });
            return { ...w, size: { width, height }, position: { x, y } };
          })
        );
      }
    };
    // Poll every 500 ms — devicePixelRatio does not fire events on its own.
    const id = setInterval(pollDpr, 500);
    return () => clearInterval(id);
  }, []);

  return (
    <WindowManagerContext.Provider
      value={{ windows, openWindow, closeWindow, minimizeWindow, focusWindow, bringToFront, getZIndex }}
    >
      {children}
    </WindowManagerContext.Provider>
  );
}

export function useWindowManager() {
  return useContext(WindowManagerContext);
}
