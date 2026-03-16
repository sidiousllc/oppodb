import { createContext, useContext, useCallback, useRef } from "react";

interface WindowManagerContextType {
  bringToFront: (windowId: string) => number;
  getZIndex: (windowId: string) => number;
}

const WindowManagerContext = createContext<WindowManagerContextType>({
  bringToFront: () => 900,
  getZIndex: () => 900,
});

const BASE_Z = 900;

export function WindowManagerProvider({ children }: { children: React.ReactNode }) {
  const zCounterRef = useRef(0);
  const windowZMap = useRef(new Map<string, number>());

  const bringToFront = useCallback((windowId: string) => {
    zCounterRef.current += 1;
    const z = BASE_Z + zCounterRef.current;
    windowZMap.current.set(windowId, z);
    return z;
  }, []);

  const getZIndex = useCallback((windowId: string) => {
    return windowZMap.current.get(windowId) ?? BASE_Z;
  }, []);

  return (
    <WindowManagerContext.Provider value={{ bringToFront, getZIndex }}>
      {children}
    </WindowManagerContext.Provider>
  );
}

export function useWindowManager() {
  return useContext(WindowManagerContext);
}
