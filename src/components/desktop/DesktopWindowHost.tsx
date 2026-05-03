import { useWindowManager } from "@/contexts/WindowManagerContext";
import { Win98Window } from "@/components/Win98Window";
import { APP_REGISTRY, useOpenApp } from "./appRegistry";
import { saveGeometry } from "@/lib/windowGeometry";

/**
 * Renders every currently-open floating window. Mounted once at the page
 * level (Index.tsx) so windows persist across sidebar/section interactions.
 *
 * NOTE: We render each Win98Window as `position: fixed` (via inline style)
 * so it floats over the entire viewport, not constrained to a wrapper.
 * Resize handles need direct pointer events — no `pointer-events-none`
 * ancestors allowed.
 */
export function DesktopWindowHost() {
  const { windows, closeWindow, minimizeWindow, focusWindow } = useWindowManager();
  const openApp = useOpenApp();

  return (
    <>
      {windows.map((w) => {
        const desc = APP_REGISTRY[w.appId];
        if (!desc) return null;
        // IMPORTANT: keep minimized windows mounted (just hidden) so the user's
        // in-window state — scroll position, form input, AI results, expanded
        // panels, etc. — survives a minimize/restore cycle. Unmounting via
        // `return null` would destroy all that state on every minimize.
        return (
          <div
            key={w.id}
            className="fixed"
            style={{
              left: 0,
              top: 0,
              zIndex: w.zIndex,
              display: w.minimized ? "none" : undefined,
              visibility: w.minimized ? "hidden" : undefined,
            }}
            aria-hidden={w.minimized || undefined}
            onMouseDownCapture={() => focusWindow(w.id)}
          >
            <Win98Window
              title={w.title}
              icon={<span>{w.icon}</span>}
              onClose={() => closeWindow(w.id)}
              onMinimize={() => minimizeWindow(w.id)}
              defaultPosition={w.position}
              defaultSize={w.size}
              minSize={{ width: 240, height: 200 }}
              onGeometryChange={(g) => saveGeometry(w.appId, g)}
            >
              {desc.render(w.payload, {
                openApp: (id, payload) => openApp(id, payload),
                close: () => closeWindow(w.id),
              })}
            </Win98Window>
          </div>
        );
      })}
    </>
  );
}
