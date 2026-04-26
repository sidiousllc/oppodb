import { ReactNode, useState, useRef, useCallback, useEffect, useId } from "react";
import { useWindowManager } from "@/contexts/WindowManagerContext";

interface Win98WindowProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  onClose?: () => void;
  onMinimize?: () => void;
  toolbar?: ReactNode;
  statusBar?: ReactNode;
  maximized?: boolean;
  defaultPosition?: { x: number; y: number };
  defaultSize?: { width: number; height: number };
  minSize?: { width: number; height: number };
  /** Fired after the user finishes a drag or resize, with the latest geometry. */
  onGeometryChange?: (g: { x: number; y: number; width: number; height: number }) => void;
}

export function Win98Window({
  title,
  icon,
  children,
  className = "",
  onClose,
  onMinimize,
  toolbar,
  statusBar,
  maximized,
  defaultPosition,
  defaultSize,
  minSize = { width: 200, height: 120 },
  onGeometryChange,
}: Win98WindowProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(!!maximized);

  // Drag state
  const [position, setPosition] = useState(defaultPosition || { x: 0, y: 0 });
  const [size, setSize] = useState(defaultSize || { width: 400, height: 300 });
  const isDragging = useRef(false);
  const isResizing = useRef<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0, px: 0, py: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  // Z-index management
  const windowId = useId();
  const { bringToFront } = useWindowManager();
  const [zIndex, setZIndex] = useState(() => 900);

  const isPositioned = !!defaultPosition || !!defaultSize;

  const handleFocus = useCallback(() => {
    if (isPositioned) {
      const z = bringToFront(windowId);
      setZIndex(z);
    }
  }, [bringToFront, windowId, isPositioned]);

  // Bring to front on mount
  useEffect(() => {
    if (isPositioned) {
      handleFocus();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMinimize = () => {
    if (onMinimize) {
      onMinimize();
    } else {
      setIsMinimized((v) => !v);
    }
  };

  const handleMaximize = () => {
    if (!maximized) {
      setIsMaximized((v) => !v);
    }
  };

  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (isMaximized || maximized) return;
      if ((e.target as HTMLElement).closest("button")) return;
      isDragging.current = true;
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
      handleFocus();
      e.preventDefault();
    },
    [position, isMaximized, maximized, handleFocus]
  );

  const onResizeStart = useCallback(
    (e: React.MouseEvent, direction: string) => {
      if (isMaximized || maximized) return;
      isResizing.current = direction;
      resizeStart.current = {
        x: e.clientX,
        y: e.clientY,
        w: size.width,
        h: size.height,
        px: position.x,
        py: position.y,
      };
      handleFocus();
      e.preventDefault();
      e.stopPropagation();
    },
    [size, position, isMaximized, maximized, handleFocus]
  );

  useEffect(() => {
    const SNAP_THRESHOLD = 15;
    const TASKBAR_HEIGHT = 28;

    const snap = (val: number, target: number) =>
      Math.abs(val - target) < SNAP_THRESHOLD ? target : val;

    const onMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        let x = e.clientX - dragOffset.current.x;
        let y = Math.max(0, e.clientY - dragOffset.current.y);
        const vw = window.innerWidth;
        const vh = window.innerHeight - TASKBAR_HEIGHT;
        const el = windowRef.current;
        const w = el?.offsetWidth ?? size.width;
        const h = el?.offsetHeight ?? size.height;

        // Snap to edges
        x = snap(x, 0); // left
        x = snap(x, vw - w); // right
        y = snap(y, 0); // top
        y = snap(y, vh - h); // bottom

        setPosition({ x, y });
      }
      if (isResizing.current) {
        const dir = isResizing.current;
        const dx = e.clientX - resizeStart.current.x;
        const dy = e.clientY - resizeStart.current.y;
        let newW = resizeStart.current.w;
        let newH = resizeStart.current.h;
        let newX = resizeStart.current.px;
        let newY = resizeStart.current.py;

        if (dir.includes("e")) newW = Math.max(minSize.width, resizeStart.current.w + dx);
        if (dir.includes("s")) newH = Math.max(minSize.height, resizeStart.current.h + dy);
        if (dir.includes("w")) {
          const dw = resizeStart.current.w - dx;
          if (dw >= minSize.width) {
            newW = dw;
            newX = resizeStart.current.px + dx;
          }
        }
        if (dir.includes("n")) {
          const dh = resizeStart.current.h - dy;
          if (dh >= minSize.height) {
            newH = dh;
            newY = resizeStart.current.py + dy;
          }
        }

        setSize({ width: newW, height: newH });
        setPosition({ x: newX, y: newY });
      }
    };

    const onMouseUp = () => {
      const wasInteracting = isDragging.current || !!isResizing.current;
      isDragging.current = false;
      isResizing.current = null;
      if (wasInteracting && onGeometryChange) {
        // Read the latest values via functional setState to avoid stale closures.
        setPosition((p) => {
          setSize((s) => {
            onGeometryChange({ x: p.x, y: p.y, width: s.width, height: s.height });
            return s;
          });
          return p;
        });
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [minSize, onGeometryChange]);

  const isFullWindow = isMaximized || maximized;

  const resizeHandles = isPositioned && !isFullWindow ? (
    <>
      <div className="absolute top-0 left-1 right-1 h-[3px] cursor-n-resize" onMouseDown={(e) => onResizeStart(e, "n")} />
      <div className="absolute bottom-0 left-1 right-1 h-[3px] cursor-s-resize" onMouseDown={(e) => onResizeStart(e, "s")} />
      <div className="absolute left-0 top-1 bottom-1 w-[3px] cursor-w-resize" onMouseDown={(e) => onResizeStart(e, "w")} />
      <div className="absolute right-0 top-1 bottom-1 w-[3px] cursor-e-resize" onMouseDown={(e) => onResizeStart(e, "e")} />
      <div className="absolute top-0 left-0 w-[6px] h-[6px] cursor-nw-resize" onMouseDown={(e) => onResizeStart(e, "nw")} />
      <div className="absolute top-0 right-0 w-[6px] h-[6px] cursor-ne-resize" onMouseDown={(e) => onResizeStart(e, "ne")} />
      <div className="absolute bottom-0 left-0 w-[6px] h-[6px] cursor-sw-resize" onMouseDown={(e) => onResizeStart(e, "sw")} />
      <div className="absolute bottom-0 right-0 w-[6px] h-[6px] cursor-se-resize" onMouseDown={(e) => onResizeStart(e, "se")} />
    </>
  ) : null;

  const style: React.CSSProperties = isPositioned && !isFullWindow
    ? {
        position: "absolute",
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        zIndex,
      }
    : {};

  return (
    <div
      ref={windowRef}
      className={`flex flex-col bg-[hsl(var(--win98-face))] win98-raised ${isFullWindow ? "w-full h-full" : ""} ${isPositioned ? "relative" : ""} ${className}`}
      style={style}
      onMouseDown={isPositioned ? handleFocus : undefined}
    >
      {/* Title bar */}
      <div
        className="win98-titlebar"
        onDoubleClick={handleMaximize}
        onMouseDown={isPositioned ? onDragStart : undefined}
        style={isPositioned && !isFullWindow ? { cursor: "move" } : undefined}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        <span className="flex-1 truncate text-[11px]">{title}</span>
        <div className="flex gap-[2px] ml-auto">
          <button className="win98-titlebar-btn" title="Minimize" onClick={handleMinimize}>_</button>
          <button className="win98-titlebar-btn" title={isMaximized ? "Restore" : "Maximize"} onClick={handleMaximize}>
            {isMaximized ? "❐" : "□"}
          </button>
          {onClose && (
            <button className="win98-titlebar-btn" title="Close" onClick={onClose}>✕</button>
          )}
        </div>
      </div>

      {/* Keep children mounted when minimized so in-window state (scroll, form
          inputs, AI results, etc.) survives a minimize/restore cycle. We hide
          via `display: none` instead of unmounting with `&&`. */}
      {toolbar && (
        <div
          className="flex items-center gap-0 border-b border-b-[hsl(var(--win98-shadow))] bg-[hsl(var(--win98-face))] px-1 py-[2px]"
          style={isMinimized ? { display: "none" } : undefined}
        >
          {toolbar}
        </div>
      )}

      <div
        className="flex-1 overflow-auto"
        style={isMinimized ? { display: "none" } : undefined}
      >
        {children}
      </div>

      {statusBar && (
        <div
          className="win98-sunken bg-[hsl(var(--win98-face))] px-2 py-[2px] text-[10px] flex items-center"
          style={isMinimized ? { display: "none" } : undefined}
        >
          {statusBar}
        </div>
      )}

      {resizeHandles}
    </div>
  );
}
