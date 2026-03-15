import { ReactNode, useState } from "react";

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
}

export function Win98Window({ title, icon, children, className = "", onClose, onMinimize, toolbar, statusBar, maximized }: Win98WindowProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(!!maximized);

  const handleMinimize = () => {
    if (onMinimize) {
      onMinimize();
    } else {
      setIsMinimized(v => !v);
    }
  };

  const handleMaximize = () => {
    if (!maximized) {
      setIsMaximized(v => !v);
    }
  };

  return (
    <div className={`flex flex-col bg-[hsl(var(--win98-face))] win98-raised ${isMaximized || maximized ? "w-full h-full" : ""} ${className}`}>
      {/* Title bar */}
      <div className="win98-titlebar" onDoubleClick={handleMaximize}>
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

      {/* Menu bar */}
      {toolbar && !isMinimized && (
        <div className="flex items-center gap-0 border-b border-b-[hsl(var(--win98-shadow))] bg-[hsl(var(--win98-face))] px-1 py-[2px]">
          {toolbar}
        </div>
      )}

      {/* Content */}
      {!isMinimized && (
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      )}

      {/* Status bar */}
      {statusBar && !isMinimized && (
        <div className="win98-sunken bg-[hsl(var(--win98-face))] px-2 py-[2px] text-[10px] flex items-center">
          {statusBar}
        </div>
      )}
    </div>
  );
}
