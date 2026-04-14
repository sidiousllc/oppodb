import { useState, useEffect } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { subscribeSyncStatus, type SyncStatus } from "@/lib/offlineSync";
import { NetworkSettingsWindow } from "./NetworkSettingsWindow";

export function OfflineStatusIndicator() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [showWindow, setShowWindow] = useState(false);

  useEffect(() => {
    return subscribeSyncStatus(setStatus);
  }, []);

  if (!status) return null;

  const isOffline = !status.isOnline;

  return (
    <>
      <button
        onClick={() => setShowWindow(v => !v)}
        className="win98-button text-[10px] flex items-center gap-1 px-2 py-1"
        title={isOffline ? "Offline Mode — Click for settings" : "Online — Click for settings"}
      >
        {isOffline ? (
          <WifiOff className="h-3 w-3 text-destructive" />
        ) : (
          <Wifi className="h-3 w-3 text-primary" />
        )}
        {status.pendingWrites > 0 && (
          <span className="bg-destructive text-destructive-foreground rounded-full text-[8px] px-1 min-w-[14px] text-center">
            {status.pendingWrites}
          </span>
        )}
      </button>

      {showWindow && (
        <NetworkSettingsWindow onClose={() => setShowWindow(false)} />
      )}
    </>
  );
}
