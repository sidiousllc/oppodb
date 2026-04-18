import { createContext, useContext, useCallback, useRef, useState, ReactNode } from "react";

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
      // Cascade position so multiple windows don't overlap exactly
      const idx = openIndexRef.current++;
      const baseX = 60 + (idx % 8) * 28;
      const baseY = 50 + (idx % 8) * 24;
      const winW = size?.width ?? Math.min(900, Math.max(560, window.innerWidth - 280));
      const winH = size?.height ?? Math.min(640, Math.max(420, window.innerHeight - 160));
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
          position: { x: Math.max(8, baseX), y: Math.max(8, baseY) },
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
