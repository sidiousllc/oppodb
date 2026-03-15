import { useState, useRef, useEffect, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

type MenuItem = {
  label: string;
  icon?: string;
  onClick?: () => void;
  disabled?: boolean;
  separator?: false;
} | {
  separator: true;
  label?: never;
  icon?: never;
  onClick?: never;
  disabled?: never;
};

interface MenuDef {
  label: string;
  items: MenuItem[];
}

function MenuDropdown({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  return (
    <div className="absolute top-full left-0 z-[200] win98-raised bg-[hsl(var(--win98-face))] py-[2px] min-w-[180px] shadow-md">
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} className="mx-1 my-[2px] border-t border-[hsl(var(--win98-shadow))] border-b border-b-[hsl(var(--win98-highlight))]" />
        ) : (
          <button
            key={i}
            onClick={() => { item.onClick?.(); onClose(); }}
            disabled={item.disabled}
            className="flex w-full items-center gap-2 px-4 py-[3px] text-[11px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-inherit"
          >
            <span className="w-4 text-center text-[10px]">{item.icon || ""}</span>
            {item.label}
          </button>
        )
      )}
    </div>
  );
}

export function Win98MenuBar() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { canManageContent, canAccessApi } = useUserRole();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!openMenu) return;
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenu]);

  const menus: MenuDef[] = [
    {
      label: "File",
      items: [
        { label: "New Window", icon: "🪟", onClick: () => window.open(window.location.origin, "_blank") },
        { label: "Print...", icon: "🖨️", onClick: () => window.print() },
        { separator: true },
        { label: "Save Page As...", icon: "💾", onClick: () => {
          const blob = new Blob([document.documentElement.outerHTML], { type: "text/html" });
          const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
          a.download = "ordb-page.html"; a.click(); URL.revokeObjectURL(a.href);
        }},
        { separator: true },
        { label: "Log Off " + (user?.email?.split("@")[0] || ""), icon: "🔌", onClick: () => signOut() },
        { label: "Close", icon: "❌", onClick: () => navigate("/") },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Copy Page URL", icon: "📋", onClick: () => { navigator.clipboard.writeText(window.location.href); } },
        { label: "Select All", icon: "📄", onClick: () => document.execCommand("selectAll") },
        { separator: true },
        { label: "Find on Page...", icon: "🔍", onClick: () => {
          // Trigger browser find
          const e = new KeyboardEvent("keydown", { key: "f", ctrlKey: true, bubbles: true });
          document.dispatchEvent(e);
        }},
      ],
    },
    {
      label: "View",
      items: [
        { label: "Refresh", icon: "🔄", onClick: () => window.location.reload() },
        { separator: true },
        { label: "Full Screen", icon: "🖥️", onClick: () => {
          if (document.fullscreenElement) document.exitFullscreen();
          else document.documentElement.requestFullscreen();
        }},
        { separator: true },
        { label: "View Source", icon: "📝", onClick: () => {
          window.open("https://github.com", "_blank");
        }},
      ],
    },
    {
      label: "Favorites",
      items: [
        { label: "📁 Opposition Database", icon: "🏠", onClick: () => navigate("/") },
        { separator: true },
        ...(canManageContent ? [{ label: "Admin Panel", icon: "🛡️", onClick: () => navigate("/admin") }] : []),
        ...(canAccessApi ? [{ label: "API Access", icon: "🔑", onClick: () => navigate("/api") }] : []),
        { label: "My Profile", icon: "👤", onClick: () => navigate("/profile") },
      ],
    },
    {
      label: "Help",
      items: [
        { label: "About ORDB", icon: "ℹ️", onClick: () => {
          alert("Opposition Research Database v1.0\n\nA retro AOL-themed research tool\nbuilt by Sidio.us Group\n\n© 2026 All Rights Reserved");
        }},
        { separator: true },
        { label: "Keyboard Shortcuts", icon: "⌨️", onClick: () => {
          alert("Keyboard Shortcuts:\n\nEnter — Search / Ask Jeeves\nEsc — Close panels\nCtrl+F — Find on page\nF5 — Refresh\nF11 — Full Screen");
        }},
      ],
    },
  ];

  return (
    <div ref={barRef} className="flex items-center gap-0 px-1 py-[1px] text-[11px] border-b border-b-[hsl(var(--win98-shadow))]">
      {menus.map((menu) => (
        <div key={menu.label} className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
            onMouseEnter={() => openMenu && setOpenMenu(menu.label)}
            className={`px-2 py-[1px] ${openMenu === menu.label ? "bg-[hsl(var(--win98-titlebar))] text-white" : "hover:bg-[hsl(var(--win98-titlebar))] hover:text-white"}`}
          >
            {menu.label}
          </button>
          {openMenu === menu.label && (
            <MenuDropdown items={menu.items} onClose={() => setOpenMenu(null)} />
          )}
        </div>
      ))}
    </div>
  );
}
