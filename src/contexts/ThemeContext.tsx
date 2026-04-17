import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type WindowsTheme =
  | "win98" | "winxp" | "vista" | "win7" | "win8" | "win10" | "win11"
  | "palm-classic" | "palm-v" | "palm-m505" | "palm-treo";

export const THEME_LABELS: Record<WindowsTheme, string> = {
  win98: "Windows 98",
  winxp: "Windows XP",
  vista: "Windows Vista",
  win7: "Windows 7",
  win8: "Windows 8",
  win10: "Windows 10",
  win11: "Windows 11",
  "palm-classic": "Palm Classic (LCD)",
  "palm-v": "Palm V (Silver)",
  "palm-m505": "Palm m505 (Color)",
  "palm-treo": "Palm Treo",
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
  const loadedFromDb = useRef(false);

  // Load saved theme from profile on login
  useEffect(() => {
    if (!user) {
      loadedFromDb.current = false;
      return;
    }

    const loadFromProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("windows_theme, dark_mode")
        .eq("id", user.id)
        .single();

      if (data) {
        const dbTheme = data.windows_theme as WindowsTheme;
        if (dbTheme && THEME_LABELS[dbTheme]) {
          setThemeState(dbTheme);
          localStorage.setItem("windows-theme", dbTheme);
        }
        const dbDark = data.dark_mode ?? false;
        setDarkModeState(dbDark);
        localStorage.setItem("windows-dark-mode", String(dbDark));
      }
      loadedFromDb.current = true;
    };

    loadFromProfile();
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

  const saveToProfile = async (newTheme: WindowsTheme, newDark: boolean) => {
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ windows_theme: newTheme, dark_mode: newDark })
      .eq("id", user.id);
  };

  const setTheme = (newTheme: WindowsTheme) => {
    setThemeState(newTheme);
    localStorage.setItem("windows-theme", newTheme);
    saveToProfile(newTheme, darkMode);
  };

  const setDarkMode = (dark: boolean) => {
    setDarkModeState(dark);
    localStorage.setItem("windows-dark-mode", String(dark));
    saveToProfile(theme, dark);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, darkMode, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
