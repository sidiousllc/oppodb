import { createContext, useContext, useCallback, useEffect, useRef, useState, ReactNode } from "react";

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
      // Clamp size to viewport, with reasonable minimums
      const desiredW = size?.width ?? Math.min(900, Math.max(320, vw - 40));
      const desiredH = size?.height ?? Math.min(640, Math.max(240, vh - 40));
      const winW = Math.min(desiredW, Math.max(280, vw - 16));
      const winH = Math.min(desiredH, Math.max(200, vh - 16));
      // Cascade position so multiple windows don't overlap exactly
      const idx = openIndexRef.current++;
      const baseX = 20 + (idx % 8) * 28;
      const baseY = 20 + (idx % 8) * 24;
      // Clamp position so window fits fully onscreen
      const x = Math.max(0, Math.min(baseX, vw - winW));
      const y = Math.max(0, Math.min(baseY, vh - winH));
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

  // Re-clamp all windows when viewport resizes so nothing is stuck offscreen
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => {
      const TASKBAR = 28;
      const vw = window.innerWidth;
      const vh = window.innerHeight - TASKBAR;
      setWindows((prev) =>
        prev.map((w) => {
          const width = Math.min(w.size.width, Math.max(280, vw - 16));
          const height = Math.min(w.size.height, Math.max(200, vh - 16));
          const x = Math.max(0, Math.min(w.position.x, vw - width));
          const y = Math.max(0, Math.min(w.position.y, vh - height));
          if (width === w.size.width && height === w.size.height && x === w.position.x && y === w.position.y) return w;
          return { ...w, size: { width, height }, position: { x, y } };
        })
      );
    };
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
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
