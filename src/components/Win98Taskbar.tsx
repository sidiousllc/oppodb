import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useAccess } from "@/hooks/useAccess";
import { OfflineStatusIndicator } from "@/components/OfflineStatusIndicator";
import { useWindowManager } from "@/contexts/WindowManagerContext";

interface Win98TaskbarProps {
  minimizedWindow?: string;
  onRestoreWindow?: () => void;
}

export function Win98Taskbar({ minimizedWindow, onRestoreWindow }: Win98TaskbarProps) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const { canManageContent } = useUserRole();
  const { hasApi: canAccessApi } = useAccess();
  const { windows, focusWindow, minimizeWindow, openWindow } = useWindowManager();
  const [time, setTime] = useState("");
  const [startOpen, setStartOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Start menu overlay */}
      {startOpen && (
        <div className="fixed inset-0 z-[998]" onClick={() => setStartOpen(false)} />
      )}

      <div className="fixed bottom-0 left-0 right-0 z-[999] h-[28px] bg-[hsl(var(--win98-face))] win98-raised flex items-center px-[2px] gap-1">
        {/* Start button */}
        <div className="relative">
          <button
            onClick={() => setStartOpen(v => !v)}
            className={`win98-button flex items-center gap-1 font-bold text-[11px] h-[22px] ${startOpen ? "border-[hsl(var(--win98-dark-shadow))_hsl(var(--win98-highlight))_hsl(var(--win98-highlight))_hsl(var(--win98-dark-shadow))]" : ""}`}
          >
            <span className="text-[13px]">🪟</span>
            Start
          </button>

          {/* Start menu */}
          {startOpen && (
            <div className="absolute bottom-full left-0 mb-0 w-[200px] bg-[hsl(var(--win98-face))] win98-raised">
              {/* Blue sidebar */}
              <div className="flex">
                <div className="w-[22px] bg-gradient-to-b from-[hsl(220,80%,30%)] to-[hsl(220,80%,50%)] flex items-end justify-center pb-2">
                  <span className="text-white text-[9px] font-bold [writing-mode:vertical-lr] rotate-180 tracking-wider">
                    ORDB 98
                  </span>
                </div>
                <div className="flex-1 py-1">
                  {canManageContent && (
                    <button
                      onClick={() => { navigate("/admin"); setStartOpen(false); }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white"
                    >
                      <span>🛡️</span> Admin Panel
                    </button>
                  )}
                  {canAccessApi && (
                    <button
                      onClick={() => { navigate("/api"); setStartOpen(false); }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white"
                    >
                      <span>🔑</span> API Access
                    </button>
                  )}
                  <button
                    onClick={() => { navigate("/profile"); setStartOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white"
                  >
                    <span>👤</span> My Profile
                  </button>
                  <div className="mx-2 my-1 border-t border-[hsl(var(--win98-shadow))]" />
                  <button
                    onClick={() => { openWindow({ appId: "status", title: "System Status", icon: "📊", singleton: true, size: { width: 520, height: 440 } }); setStartOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white"
                  >
                    <span>📊</span> System Status
                  </button>
                  <button
                    onClick={() => { openWindow({ appId: "health", title: "Health Monitor", icon: "❤️", singleton: true, size: { width: 360, height: 320 } }); setStartOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white"
                  >
                    <span>❤️</span> Health Monitor
                  </button>
                  <button
                    onClick={() => { openWindow({ appId: "deploy-checklist", title: "Deploy Checklist", icon: "✅", singleton: true, size: { width: 560, height: 520 } }); setStartOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white"
                  >
                    <span>✅</span> Deploy Checklist
                  </button>
                  <div className="mx-2 my-1 border-t border-[hsl(var(--win98-shadow))]" />
                  <button
                    onClick={() => { signOut(); setStartOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white"
                  >
                    <span>🔌</span> Log Off {user?.email?.split("@")[0]}...
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-[20px] w-[2px] border-l border-l-[hsl(var(--win98-shadow))] border-r border-r-[hsl(var(--win98-highlight))]" />

        {/* Quick launch - AOL icon */}
        <div className="flex items-center gap-1 px-1">
          <span className="text-[14px] cursor-pointer" title="AOL Opposition Research">🌐</span>
        </div>

        <div className="h-[20px] w-[2px] border-l border-l-[hsl(var(--win98-shadow))] border-r border-r-[hsl(var(--win98-highlight))]" />

        {/* Main browser window button */}
        <button
          onClick={() => onRestoreWindow?.()}
          className={`win98-button max-w-[220px] text-left truncate text-[11px] h-[22px] ${
            minimizedWindow
              ? "font-normal"
              : "font-bold border-[hsl(var(--win98-dark-shadow))_hsl(var(--win98-highlight))_hsl(var(--win98-highlight))_hsl(var(--win98-dark-shadow))]"
          }`}
        >
          🌐 {minimizedWindow || "Opposition Research Database"}
        </button>

        {/* One button per open floating window */}
        <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
          {windows.map((w) => (
            <button
              key={w.id}
              onClick={() => (w.minimized ? focusWindow(w.id) : minimizeWindow(w.id))}
              className={`win98-button text-left truncate text-[11px] h-[22px] px-2 max-w-[180px] ${
                w.minimized
                  ? "font-normal"
                  : "font-bold border-[hsl(var(--win98-dark-shadow))_hsl(var(--win98-highlight))_hsl(var(--win98-highlight))_hsl(var(--win98-dark-shadow))]"
              }`}
              title={w.title}
            >
              <span className="mr-1">{w.icon}</span>
              {w.title}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Offline indicator */}
        <OfflineStatusIndicator />

        {/* Security badge */}
        <a href="https://app.aikido.dev/audit-report/external/8A4IU23ayEgeSwA0wiLzIWS2/request" target="_blank" rel="noopener noreferrer" className="flex items-center h-[20px] opacity-60 hover:opacity-100 transition-opacity" title="Security Audit Report">
          <img src="/aikido-badge.svg" alt="Aikido Security" className="h-[16px]" />
        </a>

        {/* System tray */}
        <div className="win98-sunken flex items-center gap-2 px-2 h-[20px] text-[10px]">
          <span>🔊</span>
          <span>{time}</span>
        </div>
      </div>
    </>
  );
}
