import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "win98",
  setTheme: () => {},
  darkMode: false,
  setDarkMode: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<WindowsTheme>(() => {
    return (localStorage.getItem("windows-theme") as WindowsTheme) || "win98";
  });
  const [darkMode, setDarkModeState] = useState<boolean>(() => {
    return localStorage.getItem("windows-dark-mode") === "true";
  });

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
    Object.keys(THEME_LABELS).forEach(t => root.classList.remove(`theme-${t}`));
    root.classList.add(`theme-${theme}`);
  }, [theme]);

  // Apply dark mode class
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [darkMode]);

  const setTheme = (newTheme: WindowsTheme) => {
    setThemeState(newTheme);
    localStorage.setItem("windows-theme", newTheme);
  };

  const setDarkMode = (dark: boolean) => {
    setDarkModeState(dark);
    localStorage.setItem("windows-dark-mode", String(dark));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, darkMode, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
