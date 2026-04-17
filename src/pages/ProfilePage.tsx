import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, THEME_LABELS, type WindowsTheme } from "@/contexts/ThemeContext";
import { Moon, Sun, Loader2 } from "lucide-react";
import { Win98PageLayout } from "@/components/Win98PageLayout";
import { IntegrationSettings } from "@/components/IntegrationSettings";
import { MarketCredentialsManager } from "@/components/MarketCredentialsManager";
import { useLocationConsent } from "@/hooks/useLocationTracker";

import themeWin98 from "@/assets/theme-win98.jpg";
import themeWinXP from "@/assets/theme-winxp.jpg";
import themeVista from "@/assets/theme-vista.jpg";
import themeWin7 from "@/assets/theme-win7.jpg";
import themeWin8 from "@/assets/theme-win8.jpg";
import themeWin10 from "@/assets/theme-win10.jpg";
import themeWin11 from "@/assets/theme-win11.jpg";

const THEME_THUMBNAILS: Record<WindowsTheme, string> = {
  win98: themeWin98,
  winxp: themeWinXP,
  vista: themeVista,
  win7: themeWin7,
  win8: themeWin8,
  win10: themeWin10,
  win11: themeWin11,
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, setTheme, darkMode, setDarkMode } = useTheme();

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [ssoMessage, setSsoMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const hasGoogleIdentity = user?.identities?.some((i) => i.provider === "google") ?? false;
  const hasEmailIdentity = user?.identities?.some((i) => i.provider === "email") ?? false;

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).single().then(({ data }) => {
      if (data) { setDisplayName(data.display_name || ""); setAvatarUrl(data.avatar_url || ""); }
      setLoading(false);
    });
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true); setMessage(null);
    const { error } = await supabase.from("profiles").update({ display_name: displayName, avatar_url: avatarUrl, updated_at: new Date().toISOString() }).eq("id", user.id);
    if (error) setMessage({ type: "error", text: error.message });
    else setMessage({ type: "success", text: "Profile updated." });
    setSaving(false);
  };

  const handleChangePassword = async () => {
    setPwMessage(null);
    if (newPassword.length < 6) { setPwMessage({ type: "error", text: "Min 6 characters." }); return; }
    if (newPassword !== confirmPassword) { setPwMessage({ type: "error", text: "Passwords don't match." }); return; }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPwMessage({ type: "error", text: error.message });
    } else {
      // Revoke all other sessions server-side after credential rotation
      await supabase.functions.invoke("revoke-sessions");
      setPwMessage({ type: "success", text: "Password changed. All other sessions have been revoked." });
      setNewPassword(""); setConfirmPassword("");
    }
    setChangingPassword(false);
  };

  const handleLinkGoogle = async () => {
    setLinkingGoogle(true); setSsoMessage(null);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: "https://oppodb.com/profile" });
    if (result?.error) setSsoMessage({ type: "error", text: result.error.message || "Failed to link Google." });
    setLinkingGoogle(false);
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-[hsl(var(--background))]"><span className="text-[11px]">Loading...</span></div>;
  }

  return (
    <Win98PageLayout title="Profile Settings" icon="👤" addressUrl="aol://ordb.research/profile">
      {/* Account Info */}
      <div className="win98-raised bg-[hsl(var(--win98-face))] p-3 mb-3">
        <p className="text-[11px] font-bold mb-2 flex items-center gap-1">👤 Account Information</p>

        <div className="space-y-2">
          <div>
            <label className="block text-[10px] font-bold mb-1">Email:</label>
            <div className="win98-sunken bg-[hsl(var(--win98-light))] px-2 py-1 text-[10px] text-[hsl(var(--muted-foreground))]">
              ✉️ {user?.email}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold mb-1">Display Name:</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="win98-input w-full" placeholder="Your display name" />
          </div>

          <div>
            <label className="block text-[10px] font-bold mb-1">Avatar URL:</label>
            <input type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="win98-input w-full" placeholder="https://example.com/avatar.png" />
          </div>

          {message && (
            <div className={`text-[10px] p-2 border ${message.type === "error" ? "bg-[#fff0f0] border-red-400 text-red-700" : "bg-[#f0fff0] border-green-400 text-green-700"}`}>
              {message.text}
            </div>
          )}

          <button onClick={handleSaveProfile} disabled={saving} className="win98-button text-[10px] font-bold disabled:opacity-50">
            {saving ? "Saving..." : "💾 Save Changes"}
          </button>
        </div>
      </div>

      {/* Theme Selector */}
      <div className="win98-raised bg-[hsl(var(--win98-face))] p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-bold flex items-center gap-1">🎨 Desktop Theme</p>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="win98-button text-[10px] flex items-center gap-1 px-2 py-1"
          >
            {darkMode ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
            {darkMode ? "Light Mode" : "Dark Mode"}
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(Object.entries(THEME_LABELS) as [WindowsTheme, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTheme(key)}
              className={`win98-button text-[10px] p-1.5 text-left flex flex-col items-center gap-1 ${
                theme === key ? "font-bold" : ""
              }`}
              style={theme === key ? {
                borderColor: "hsl(var(--primary))",
                background: "hsl(var(--accent))",
                boxShadow: "0 0 0 2px hsl(var(--primary) / 0.3)",
              } : {}}
            >
              <img
                src={THEME_THUMBNAILS[key]}
                alt={label}
                loading="lazy"
                width={512}
                height={512}
                className="w-full aspect-square object-cover"
                style={{ borderRadius: "1px", border: theme === key ? "2px solid hsl(var(--primary))" : "1px solid hsl(var(--win98-shadow))" }}
              />
              <div className="text-center w-full">
                <div className="truncate">{label}</div>
                {theme === key && <div className="text-[8px] text-[hsl(var(--primary))]">✓ Active</div>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Change Password */}
      {hasEmailIdentity && (
        <div className="win98-raised bg-[hsl(var(--win98-face))] p-3 mb-3">
          <p className="text-[11px] font-bold mb-2 flex items-center gap-1">🔒 Change Password</p>

          <div className="space-y-2">
            <div>
              <label className="block text-[10px] font-bold mb-1">New Password:</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="win98-input w-full" placeholder="Min 6 characters" minLength={6} />
            </div>

            <div>
              <label className="block text-[10px] font-bold mb-1">Confirm Password:</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="win98-input w-full" placeholder="Re-enter password" minLength={6} />
            </div>

            {pwMessage && (
              <div className={`text-[10px] p-2 border ${pwMessage.type === "error" ? "bg-[#fff0f0] border-red-400 text-red-700" : "bg-[#f0fff0] border-green-400 text-green-700"}`}>
                {pwMessage.text}
              </div>
            )}

            <button onClick={handleChangePassword} disabled={changingPassword} className="win98-button text-[10px] font-bold disabled:opacity-50">
              {changingPassword ? "Updating..." : "🔒 Update Password"}
            </button>
          </div>
        </div>
      )}

      {/* Connected Accounts */}
      <div className="win98-raised bg-[hsl(var(--win98-face))] p-3">
        <p className="text-[11px] font-bold mb-2 flex items-center gap-1">🔗 Connected Accounts</p>

        <div className="space-y-1">
          {/* Google */}
          <div className="win98-sunken bg-white flex items-center justify-between px-2 py-1.5">
            <div className="flex items-center gap-2 text-[10px]">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <div>
                <span className="font-bold">Google</span>
                <span className="text-[9px] text-[hsl(var(--muted-foreground))] ml-1">
                  {hasGoogleIdentity ? "Connected" : "Not connected"}
                </span>
              </div>
            </div>
            {hasGoogleIdentity ? (
              <span className="win98-button text-[8px] px-2 py-0 font-bold" style={{ backgroundColor: "#cec" }}>✓ Linked</span>
            ) : (
              <button onClick={handleLinkGoogle} disabled={linkingGoogle} className="win98-button text-[9px] disabled:opacity-50">
                {linkingGoogle ? "Linking..." : "Link"}
              </button>
            )}
          </div>

          {/* Apple */}
          <div className="win98-sunken bg-white flex items-center justify-between px-2 py-1.5 opacity-50">
            <div className="flex items-center gap-2 text-[10px]">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              <div>
                <span className="font-bold">Apple</span>
                <span className="text-[9px] text-[hsl(var(--muted-foreground))] ml-1">Coming soon</span>
              </div>
            </div>
            <span className="text-[8px] text-[hsl(var(--muted-foreground))]">N/A</span>
          </div>
        </div>

        {ssoMessage && (
          <div className={`mt-2 text-[10px] p-2 border ${ssoMessage.type === "error" ? "bg-[#fff0f0] border-red-400 text-red-700" : "bg-[#f0fff0] border-green-400 text-green-700"}`}>
            {ssoMessage.text}
          </div>
        )}
      </div>

      {/* Location Sharing */}
      <LocationSharingPanel />

      {/* Prediction Market API Keys */}
      <div className="win98-raised bg-[hsl(var(--win98-face))] p-3 mt-3">
        <MarketCredentialsManager />
      </div>

      {/* Voter Data Integrations */}
      <div className="win98-raised bg-[hsl(var(--win98-face))] p-3 mt-3">
        <IntegrationSettings />
      </div>
    </Win98PageLayout>
  );
}

function LocationSharingPanel() {
  const { consent, setConsent } = useLocationConsent();
  const enabled = consent === "granted";
  return (
    <div className="win98-raised bg-[hsl(var(--win98-face))] p-3 mt-3">
      <p className="text-[11px] font-bold mb-2 flex items-center gap-1">📍 Location Sharing</p>
      <div className="win98-sunken bg-white p-2 text-[10px] mb-2 space-y-1">
        <p>
          <b>Status:</b>{" "}
          {enabled ? (
            <span style={{ color: "hsl(140, 60%, 30%)" }}>✓ Sharing enabled</span>
          ) : (
            <span style={{ color: "hsl(0, 70%, 45%)" }}>🚫 Disabled</span>
          )}
        </p>
        <p className="text-[hsl(var(--muted-foreground))]">
          When enabled, your device location is recorded every 15 seconds and visible to administrators.
          You are opted in by default. You can disable it at any time below.
        </p>
      </div>
      <div className="flex gap-1">
        {enabled ? (
          <button
            onClick={() => setConsent("denied")}
            className="win98-button text-[10px] font-bold"
            style={{ color: "hsl(0, 70%, 45%)" }}
          >
            🚫 Disable Location Sharing
          </button>
        ) : (
          <button
            onClick={() => setConsent("granted")}
            className="win98-button text-[10px] font-bold"
            style={{ color: "hsl(140, 60%, 30%)" }}
          >
            ✓ Enable Location Sharing
          </button>
        )}
      </div>
    </div>
  );
}
