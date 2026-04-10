import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type WindowsTheme = "win98" | "winxp" | "vista" | "win7" | "win8" | "win10" | "win11";

export const THEME_LABELS: Record<WindowsTheme, string> = {
  win98: "Windows 98",
  winxp: "Windows XP",
  vista: "Windows Vista",
  win7: "Windows 7",
  win8: "Windows 8",
  win10: "Windows 10",
  win11: "Windows 11",
};

interface ThemeContextType {
  theme: WindowsTheme;
  setTheme: (theme: WindowsTheme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "win98",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<WindowsTheme>(() => {
    return (localStorage.getItem("windows-theme") as WindowsTheme) || "win98";
  });

  // Load saved theme from profile on login
  useEffect(() => {
    if (!user) return;
    const saved = localStorage.getItem("windows-theme") as WindowsTheme;
    if (saved && THEME_LABELS[saved]) {
      setThemeState(saved);
    }
  }, [user]);

  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement;
    // Remove all theme classes
    Object.keys(THEME_LABELS).forEach(t => root.classList.remove(`theme-${t}`));
    // Add current theme class
    root.classList.add(`theme-${theme}`);
  }, [theme]);

  const setTheme = (newTheme: WindowsTheme) => {
    setThemeState(newTheme);
    localStorage.setItem("windows-theme", newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
