import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { reapplyAllGeometry } from "@/lib/windowGeometry";

export type WindowsTheme =
  // Windows
  | "win98" | "winxp" | "vista" | "win7" | "win8" | "win10" | "win11"
  // Palm (retro)
  | "palm-classic" | "palm-v" | "palm-m505" | "palm-treo"
  // macOS desktop
  | "mac-classic" | "mac-osx-aqua" | "mac-leopard" | "mac-yosemite" | "mac-bigsur" | "mac-sonoma"
  // Linux desktop
  | "linux-ubuntu" | "linux-mint" | "linux-fedora" | "linux-popos" | "linux-kali" | "linux-arch"
  // iOS mobile
  | "ios-6" | "ios-7" | "ios-11" | "ios-16" | "ios-18"
  // Android mobile
  | "android-gingerbread" | "android-kitkat" | "android-lollipop" | "android-12" | "android-15";

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
  "mac-classic": "Mac OS 9 (Platinum)",
  "mac-osx-aqua": "Mac OS X Aqua",
  "mac-leopard": "OS X Leopard",
  "mac-yosemite": "OS X Yosemite",
  "mac-bigsur": "macOS Big Sur",
  "mac-sonoma": "macOS Sonoma",
  "linux-ubuntu": "Ubuntu (GNOME)",
  "linux-mint": "Linux Mint (Cinnamon)",
  "linux-fedora": "Fedora Workstation",
  "linux-popos": "Pop!_OS",
  "linux-kali": "Kali Linux",
  "linux-arch": "Arch / KDE Plasma",
  "ios-6": "iOS 6 (Skeuomorphic)",
  "ios-7": "iOS 7 (Flat)",
  "ios-11": "iOS 11",
  "ios-16": "iOS 16",
  "ios-18": "iOS 18",
  "android-gingerbread": "Android Gingerbread",
  "android-kitkat": "Android KitKat",
  "android-lollipop": "Android Lollipop",
  "android-12": "Android 12 (Material You)",
  "android-15": "Android 15",
};

export type ThemeCategory = "windows" | "macos" | "linux" | "ios" | "android" | "palm";

export const THEME_CATEGORIES: Record<ThemeCategory, {
  label: string;
  icon: string;
  kind: "desktop" | "mobile" | "retro";
  themes: WindowsTheme[];
}> = {
  windows: {
    label: "Windows",
    icon: "🪟",
    kind: "desktop",
    themes: ["win98", "winxp", "vista", "win7", "win8", "win10", "win11"],
  },
  macos: {
    label: "macOS",
    icon: "",
    kind: "desktop",
    themes: ["mac-classic", "mac-osx-aqua", "mac-leopard", "mac-yosemite", "mac-bigsur", "mac-sonoma"],
  },
  linux: {
    label: "Linux",
    icon: "🐧",
    kind: "desktop",
    themes: ["linux-ubuntu", "linux-mint", "linux-fedora", "linux-popos", "linux-kali", "linux-arch"],
  },
  ios: {
    label: "iOS",
    icon: "📱",
    kind: "mobile",
    themes: ["ios-6", "ios-7", "ios-11", "ios-16", "ios-18"],
  },
  android: {
    label: "Android",
    icon: "🤖",
    kind: "mobile",
    themes: ["android-gingerbread", "android-kitkat", "android-lollipop", "android-12", "android-15"],
  },
  palm: {
    label: "Palm OS",
    icon: "🖐️",
    kind: "mobile",
    themes: ["palm-classic", "palm-v", "palm-m505", "palm-treo"],
  },
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

  // Lock to portrait orientation when a mobile-kind theme (iOS / Android) is active
  useEffect(() => {
    const isMobileTheme = Object.values(THEME_CATEGORIES).some(
      (cat) => cat.kind === "mobile" && (cat.themes as WindowsTheme[]).includes(theme)
    );
    const root = document.documentElement;
    root.classList.toggle("mobile-theme-active", isMobileTheme);

    // Try the Screen Orientation API (works on Android Chrome, Capacitor native, fullscreen PWAs)
    const screenOrientation = (screen as any).orientation;
    if (isMobileTheme && screenOrientation?.lock) {
      screenOrientation.lock("portrait").catch(() => {
        // Silently ignore — most desktop browsers reject this outside fullscreen.
        // The CSS rotation fallback below handles the visual portrait framing.
      });
    } else if (!isMobileTheme && screenOrientation?.unlock) {
      try { screenOrientation.unlock(); } catch { /* ignore */ }
    }
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
    // Theme switch may change chrome height / scrollbar width — re-clamp and
    // re-save all persisted geometries so windows stay correctly placed.
    reapplyAllGeometry();
    saveToProfile(newTheme, darkMode);
  };

  const setDarkMode = (dark: boolean) => {
    setDarkModeState(dark);
    localStorage.setItem("windows-dark-mode", String(dark));
    // Dark mode toggle can shift content sizing — reapply all geometry.
    reapplyAllGeometry();
    saveToProfile(theme, dark);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, darkMode, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
