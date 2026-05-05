import { useState, useCallback } from "react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAccess } from "@/hooks/useAccess";
import { useAuth } from "@/contexts/AuthContext";
import { useSectionAccess } from "@/hooks/useSectionAccess";
import { Win98Notepad } from "./Win98Notepad";
import { Win98Window } from "./Win98Window";
import { useOpenApp } from "./desktop/appRegistry";

interface DesktopIcon {
  condition?: boolean;
  label: string;
  icon: string;
  action: () => void;
}

interface Win98DesktopProps {
  onOpenWindow?: () => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  submenu?: string;
}

export function Win98Desktop({ onOpenWindow }: Win98DesktopProps) {
  const { signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { hasPro, hasEnterprise, hasMcpTools, hasApi, hasWarRoom } = useAccess();
  const { canAccess } = useSectionAccess();
  const openApp = useOpenApp();
  const [notepadOpen, setNotepadOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [propertiesOpen, setPropertiesOpen] = useState(false);

  const icons: DesktopIcon[] = [
    { label: "Opposition\nResearch DB", icon: "🌐", action: () => { onOpenWindow?.(); openApp("dashboard"); } },
    { label: "My Computer", icon: "🖥️", action: () => openApp("my-computer") },
    { label: "My Profile", icon: "👤", action: () => openApp("profile") },
    { label: "Recycle Bin", icon: "🗑️", action: () => openApp("recycle-bin") },
    { label: "Admin Panel", icon: "🛡️", action: () => openApp("admin") },
    { label: "API Access", icon: "🔑", action: () => openApp("api"), condition: hasApi },
    { label: "Network\nNeighborhood", icon: "🌍", action: () => openApp("network-neighborhood") },
    { label: "Notepad", icon: "📝", action: () => setNotepadOpen(true) },
    // Sidebar sections as desktop shortcuts
    { label: "OppoHub", icon: "🎯", action: () => openApp("oppohub") },
    { label: "LegHub", icon: "⚖️", action: () => openApp("leghub") },
    { label: "DataHub", icon: "📊", action: () => openApp("polling") },
    { label: "IntelHub", icon: "🕵️", action: () => openApp("intelhub") },
    { label: "MessagingHub", icon: "📢", action: () => openApp("messaging") },
    { label: "Research\nTools", icon: "🔬", action: () => openApp("research-tools") },
    { label: "International\nHub", icon: "🌐", action: () => openApp("internationalhub") },
    { label: "Live\nElections", icon: "🏛️", action: () => openApp("live-elections") },
    { label: "ReportHub", icon: "📝", action: () => openApp("reports") },
    { label: "War Room", icon: "🎖️", action: () => openApp("warroom"), condition: hasWarRoom },
    { label: "CRM", icon: "👥", action: () => openApp("crm"), condition: hasPro },
    { label: "Alerts", icon: "🚨", action: () => openApp("alerts") },
    { label: "Forecast", icon: "📈", action: () => openApp("forecast") },
    { label: "Investigations", icon: "🔍", action: () => openApp("investigations"), condition: hasPro },
    { label: "Graph", icon: "🕸️", action: () => openApp("graph"), condition: hasPro },
    { label: "Documentation", icon: "📖", action: () => openApp("documentation") },
    { label: "AI History", icon: "🧠", action: () => openApp("ai-history"), condition: hasPro },
    { label: "Task\nManager", icon: "📋", action: () => openApp("task-manager") },
    { label: "Log Off", icon: "🔌", action: () => signOut() },
    { label: "Deploy Checklist", icon: "✅", action: () => openApp("deploy-checklist"), condition: isAdmin },
    { label: "MCP Tools", icon: "🧰", action: () => openApp("mcp-tools"), condition: hasMcpTools },
    { label: "Upgrade /\nBilling", icon: "💳", action: () => openApp("pricing") },
    { label: "My\nSubscription", icon: "🧾", action: () => openApp("my-subscription") },
  ];

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const closeMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleRefresh = useCallback(() => {
    window.location.reload();
  }, []);

  const handleNewFolder = useCallback(() => {
    closeMenu();
    // Visual-only: just opens notepad as a fun stand-in
    setNotepadOpen(true);
  }, [closeMenu]);

  return (
    <>
      {/* Desktop area with right-click */}
      <div
        className="flex-1 p-3 overflow-hidden select-none"
        onContextMenu={handleContextMenu}
        onClick={closeMenu}
      >
        <div className="flex flex-col flex-wrap gap-1 h-full content-start">
          {icons.filter(i => i.condition !== false).map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              onDoubleClick={item.action}
              onContextMenu={(e) => e.stopPropagation()}
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

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[850]" onClick={closeMenu} onContextMenu={(e) => { e.preventDefault(); closeMenu(); }} />
          <div
            className="fixed z-[851] bg-[hsl(var(--win98-face))] win98-raised py-[2px] min-w-[180px] text-[11px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {/* Arrange Icons */}
            <button
              onClick={closeMenu}
              className="w-full text-left px-5 py-[3px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white flex items-center"
            >
              Arrange Icons
            </button>

            <button
              onClick={closeMenu}
              className="w-full text-left px-5 py-[3px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white flex items-center text-[hsl(var(--muted-foreground))]"
            >
              Line up Icons
            </button>

            <div className="mx-1 my-[2px] border-t border-[hsl(var(--win98-shadow))]" />

            {/* Refresh */}
            <button
              onClick={() => { closeMenu(); handleRefresh(); }}
              className="w-full text-left px-5 py-[3px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white flex items-center gap-2"
            >
              🔄 Refresh
            </button>

            <div className="mx-1 my-[2px] border-t border-[hsl(var(--win98-shadow))]" />

            {/* New submenu */}
            <div
              className="relative"
              onMouseEnter={() => setContextMenu((m) => m ? { ...m, submenu: "new" } : null)}
              onMouseLeave={() => setContextMenu((m) => m ? { ...m, submenu: undefined } : null)}
            >
              <button className="w-full text-left px-5 py-[3px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white flex items-center justify-between">
                <span>New</span>
                <span className="ml-4">▶</span>
              </button>
              {contextMenu.submenu === "new" && (
                <div className="absolute left-full top-0 bg-[hsl(var(--win98-face))] win98-raised py-[2px] min-w-[160px]">
                  <button
                    onClick={() => { closeMenu(); handleNewFolder(); }}
                    className="w-full text-left px-5 py-[3px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white flex items-center gap-2"
                  >
                    📁 Folder
                  </button>
                  <button
                    onClick={() => { closeMenu(); setNotepadOpen(true); }}
                    className="w-full text-left px-5 py-[3px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white flex items-center gap-2"
                  >
                    📝 Text Document
                  </button>
                  <button
                    onClick={closeMenu}
                    className="w-full text-left px-5 py-[3px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white flex items-center gap-2"
                  >
                    🔗 Shortcut
                  </button>
                </div>
              )}
            </div>

            <div className="mx-1 my-[2px] border-t border-[hsl(var(--win98-shadow))]" />

            {/* Properties */}
            <button
              onClick={() => { closeMenu(); setPropertiesOpen(true); }}
              className="w-full text-left px-5 py-[3px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white flex items-center gap-2 font-bold"
            >
              Properties
            </button>
          </div>
        </>
      )}

      {/* Properties dialog */}
      {propertiesOpen && (
        <>
          <div className="fixed inset-0 z-[900] bg-black/20" onClick={() => setPropertiesOpen(false)} />
          <div className="fixed inset-0 z-[901] pointer-events-none">
            <div className="pointer-events-auto">
              <Win98Window
                title="Display Properties"
                icon={<span className="text-[11px]">🖥️</span>}
                onClose={() => setPropertiesOpen(false)}
                defaultPosition={{ x: Math.round(window.innerWidth / 2 - 170), y: Math.round(window.innerHeight / 2 - 180) }}
                defaultSize={{ width: 340, height: 360 }}
                minSize={{ width: 280, height: 280 }}
              >
                {/* Tabs */}
                <div className="p-3">
                  <div className="flex gap-0 mb-[-1px] relative z-10">
                    {["Background", "Screen Saver", "Appearance", "Settings"].map((tab, i) => (
                      <div
                        key={tab}
                        className={`px-2 py-1 text-[10px] border border-[hsl(var(--win98-shadow))] ${
                          i === 2
                            ? "bg-[hsl(var(--win98-face))] border-b-[hsl(var(--win98-face))] font-bold -mb-[1px]"
                            : "bg-[hsl(var(--win98-light))] cursor-pointer"
                        }`}
                      >
                        {tab}
                      </div>
                    ))}
                  </div>

                  {/* Content */}
                  <div className="border border-[hsl(var(--win98-shadow))] p-3">
                    <div className="win98-sunken bg-white p-3 mb-3 text-center">
                      <div className="w-[120px] h-[80px] mx-auto bg-[hsl(180,50%,50%)] border border-[hsl(var(--win98-dark-shadow))] flex items-center justify-center">
                        <span className="text-[9px] text-white" style={{ textShadow: "1px 1px 1px rgba(0,0,0,0.5)" }}>
                          ORDB Desktop
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="w-[60px]">Scheme:</span>
                        <div className="flex-1 win98-sunken bg-white px-1 py-[1px] text-[11px]">
                          Windows Standard
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-[60px]">Resolution:</span>
                        <div className="flex-1 win98-sunken bg-white px-1 py-[1px] text-[11px]">
                          {window.innerWidth} × {window.innerHeight}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-[60px]">Colors:</span>
                        <div className="flex-1 win98-sunken bg-white px-1 py-[1px] text-[11px]">
                          True Color (32 bit)
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex justify-end gap-1 mt-3">
                    <button onClick={() => setPropertiesOpen(false)} className="win98-button text-[11px] px-4">OK</button>
                    <button onClick={() => setPropertiesOpen(false)} className="win98-button text-[11px] px-4">Cancel</button>
                    <button className="win98-button text-[11px] px-4 opacity-50" disabled>Apply</button>
                  </div>
                </div>
              </Win98Window>
            </div>
          </div>
        </>
      )}

      {notepadOpen && <Win98Notepad onClose={() => setNotepadOpen(false)} />}
    </>
  );
}
