import { useState, useEffect } from "react";
import { useWindowManager } from "@/contexts/WindowManagerContext";

/**
 * Win98-style Task Manager — lists open windows with focus / minimize / close
 * actions. Updates live via a 1s tick (windows array is already reactive).
 */
export function TaskManagerWindow() {
  const { windows, focusWindow, minimizeWindow, closeWindow } = useWindowManager();
  const [tab, setTab] = useState<"apps" | "performance">("apps");
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const memUsage = Math.min(95, 30 + windows.length * 4);
  const cpuUsage = Math.min(99, 8 + windows.filter((w) => !w.minimized).length * 6);

  return (
    <div className="p-2 text-[11px] h-full flex flex-col">
      {/* Tabs */}
      <div className="flex gap-0 mb-[-1px] relative z-10">
        {(["apps", "performance"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 text-[10px] border border-[hsl(var(--win98-shadow))] capitalize ${
              tab === t
                ? "bg-[hsl(var(--win98-face))] border-b-[hsl(var(--win98-face))] font-bold -mb-[1px]"
                : "bg-[hsl(var(--win98-light))] cursor-pointer"
            }`}
          >
            {t === "apps" ? "Applications" : "Performance"}
          </button>
        ))}
      </div>

      <div className="border border-[hsl(var(--win98-shadow))] flex-1 overflow-hidden flex flex-col p-2">
        {tab === "apps" ? (
          <>
            <div className="win98-sunken bg-white flex-1 overflow-auto">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-[hsl(var(--win98-face))]">
                  <tr>
                    <th className="text-left px-2 py-1 border-b border-[hsl(var(--win98-shadow))]">Task</th>
                    <th className="text-left px-2 py-1 border-b border-[hsl(var(--win98-shadow))]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {windows.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-2 py-3 text-center text-[hsl(var(--muted-foreground))]">
                        No applications running.
                      </td>
                    </tr>
                  )}
                  {windows.map((w) => (
                    <tr
                      key={w.id}
                      onClick={() => focusWindow(w.id)}
                      className="cursor-pointer hover:bg-[hsl(var(--win98-titlebar))] hover:text-white"
                    >
                      <td className="px-2 py-1 flex items-center gap-2">
                        <span>{w.icon}</span>
                        <span className="truncate">{w.title}</span>
                      </td>
                      <td className="px-2 py-1">{w.minimized ? "Minimized" : "Running"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-1 mt-2">
              <button
                className="win98-button text-[11px] px-3"
                disabled={windows.length === 0}
                onClick={() => {
                  windows.forEach((w) => closeWindow(w.id));
                }}
              >
                End All Tasks
              </button>
              <button
                className="win98-button text-[11px] px-3"
                disabled={windows.length === 0}
                onClick={() => {
                  windows.forEach((w) => !w.minimized && minimizeWindow(w.id));
                }}
              >
                Minimize All
              </button>
              <button
                className="win98-button text-[11px] px-3"
                disabled={windows.length === 0}
                onClick={() => {
                  const top = [...windows].sort((a, b) => b.zIndex - a.zIndex)[0];
                  if (top) closeWindow(top.id);
                }}
              >
                End Task
              </button>
              <button
                className="win98-button text-[11px] px-3"
                disabled={windows.length === 0}
                onClick={() => {
                  const top = [...windows].sort((a, b) => b.zIndex - a.zIndex)[0];
                  if (top) focusWindow(top.id);
                }}
              >
                Switch To
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span>CPU Usage</span>
                <span className="font-bold">{cpuUsage}%</span>
              </div>
              <div className="win98-sunken bg-white h-4 overflow-hidden">
                <div
                  className="h-full bg-[hsl(var(--win98-titlebar))] transition-all"
                  style={{ width: `${cpuUsage}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span>Memory Usage</span>
                <span className="font-bold">{memUsage}%</span>
              </div>
              <div className="win98-sunken bg-white h-4 overflow-hidden">
                <div
                  className="h-full bg-[hsl(var(--win98-titlebar))] transition-all"
                  style={{ width: `${memUsage}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="win98-sunken bg-white p-2">
                <div className="text-[hsl(var(--muted-foreground))] text-[10px]">Total Windows</div>
                <div className="text-[18px] font-bold">{windows.length}</div>
              </div>
              <div className="win98-sunken bg-white p-2">
                <div className="text-[hsl(var(--muted-foreground))] text-[10px]">Active</div>
                <div className="text-[18px] font-bold">{windows.filter((w) => !w.minimized).length}</div>
              </div>
              <div className="win98-sunken bg-white p-2">
                <div className="text-[hsl(var(--muted-foreground))] text-[10px]">Minimized</div>
                <div className="text-[18px] font-bold">{windows.filter((w) => w.minimized).length}</div>
              </div>
              <div className="win98-sunken bg-white p-2">
                <div className="text-[hsl(var(--muted-foreground))] text-[10px]">Uptime</div>
                <div className="text-[18px] font-bold">
                  {Math.floor(performance.now() / 60000)}m
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 px-1">
        Processes: {windows.length}  |  CPU: {cpuUsage}%  |  Mem: {memUsage}%
      </div>
    </div>
  );
}
