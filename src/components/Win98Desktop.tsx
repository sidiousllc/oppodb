import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Win98Notepad } from "./Win98Notepad";

interface DesktopIcon {
  label: string;
  icon: string;
  action: () => void;
}

interface Win98DesktopProps {
  onOpenWindow?: () => void;
}

export function Win98Desktop({ onOpenWindow }: Win98DesktopProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const icons: DesktopIcon[] = [
    { label: "Opposition\nResearch DB", icon: "🌐", action: () => onOpenWindow?.() },
    { label: "My Computer", icon: "🖥️", action: () => onOpenWindow?.() },
    { label: "My Profile", icon: "👤", action: () => { onOpenWindow?.(); navigate("/profile"); } },
    { label: "Recycle Bin", icon: "🗑️", action: () => {} },
    { label: "Admin Panel", icon: "🛡️", action: () => { onOpenWindow?.(); navigate("/admin"); } },
    { label: "API Access", icon: "🔑", action: () => { onOpenWindow?.(); navigate("/api"); } },
    { label: "Network\nNeighborhood", icon: "🌍", action: () => {} },
    { label: "Notepad", icon: "📝", action: () => {} },
    { label: "Log Off", icon: "🔌", action: () => signOut() },
  ];

  return (
    <div className="flex-1 p-3 overflow-hidden select-none">
      <div className="flex flex-col flex-wrap gap-1 h-full content-start">
        {icons.map((item) => (
          <button
            key={item.label}
            onDoubleClick={item.action}
            className="group flex flex-col items-center w-[72px] p-1 rounded-none focus:outline-none"
          >
            <span className="text-[32px] leading-none mb-0.5 group-focus:brightness-75 group-focus:contrast-150">
              {item.icon}
            </span>
            <span className="text-[11px] text-white text-center leading-[13px] px-[2px] whitespace-pre-line group-focus:bg-[hsl(var(--win98-titlebar))] group-focus:text-white"
              style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.8)" }}
            >
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
