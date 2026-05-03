import { createContext, useContext, useCallback, useEffect, useRef, useState, ReactNode } from "react";
import {
  loadGeometry,
  saveGeometry,
  reapplyAllGeometry,
  getUsableViewport,
  clampGeometry,
  type Geometry,
} from "@/lib/windowGeometry";

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
      // Available area — uses VisualViewport on mobile (accounts for virtual
      // keyboard / browser chrome) and desktop taskbar on desktop.
      const { vw, vh } = getUsableViewport();
      const isMobile = vw < 768;
      // Try restoring persisted geometry first; fall back to cascade defaults.
      const saved = loadGeometry(appId);
      // On mobile, ignore saved sizes and fit the screen so windows never
      // exceed the viewport (which would force the user to scroll).
      const desiredW = isMobile
        ? Math.max(280, vw - 8)
        : (saved?.width ?? size?.width ?? Math.min(900, Math.max(320, vw - 40)));
      const desiredH = isMobile
        ? Math.max(240, vh - 8)
        : (saved?.height ?? size?.height ?? Math.min(640, Math.max(240, vh - 40)));
      const winW = Math.min(desiredW, Math.max(280, vw - 8));
      const winH = Math.min(desiredH, Math.max(200, vh - 8));
      let x: number;
      let y: number;
      if (isMobile) {
        x = Math.max(0, Math.floor((vw - winW) / 2));
        y = 4;
      } else if (saved) {
        const clamped = clampGeometry({ x: saved.x, y: saved.y, width: winW, height: winH });
        x = clamped.x;
        y = clamped.y;
      } else {
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
  // open/close, orientation flip, virtual keyboard) so a window can never end
  // up partially or fully off-screen. Uses VisualViewport on mobile so the
  // keyboard and browser chrome are accounted for. Persists the clamped
  // geometry so reopening uses the corrected position rather than the stale
  // saved one.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const clampAll = () => {
      const { vw, vh } = getUsableViewport();
      setWindows((prev) =>
        prev.map((w) => {
          const clamped = clampGeometry({ x: w.position.x, y: w.position.y, width: w.size.width, height: w.size.height });
          if (
            clamped.width === w.size.width &&
            clamped.height === w.size.height &&
            clamped.x === w.position.x &&
            clamped.y === w.position.y
          ) {
            return w;
          }
          saveGeometry(w.appId, { x: clamped.x, y: clamped.y, width: clamped.width, height: clamped.height });
          return { ...w, size: { width: clamped.width, height: clamped.height }, position: { x: clamped.x, y: clamped.y } };
        })
      );
    };
    window.addEventListener("resize", clampAll);
    window.addEventListener("orientationchange", clampAll);
    // VisualViewport resize fires on virtual keyboard and browser chrome changes
    // on mobile — much more reliable than orientationchange alone.
    window.visualViewport?.addEventListener("resize", clampAll);
    clampAll();
    return () => {
      window.removeEventListener("resize", clampAll);
      window.removeEventListener("orientationchange", clampAll);
      window.visualViewport?.removeEventListener("resize", clampAll);
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
        const { vw, vh } = getUsableViewport();
        setWindows((prev) =>
          prev.map((w) => {
            const clamped = clampGeometry({ x: w.position.x, y: w.position.y, width: w.size.width, height: w.size.height });
            if (
              clamped.width === w.size.width &&
              clamped.height === w.size.height &&
              clamped.x === w.position.x &&
              clamped.y === w.position.y
            ) {
              return w;
            }
            saveGeometry(w.appId, { x: clamped.x, y: clamped.y, width: clamped.width, height: clamped.height });
            return { ...w, size: { width: clamped.width, height: clamped.height }, position: { x: clamped.x, y: clamped.y } };
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
