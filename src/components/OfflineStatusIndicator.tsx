import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Wifi, WifiOff } from "lucide-react";
import { subscribeSyncStatus, type SyncStatus } from "@/lib/offlineSync";

/**
 * Compact taskbar status indicator. Click navigates to the Profile page where
 * full Network & Offline settings now live (under the Privacy & Network tab).
 */
export function OfflineStatusIndicator() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<SyncStatus | null>(null);

  useEffect(() => subscribeSyncStatus(setStatus), []);

  if (!status) return null;

  const isOffline = !status.isOnline;

  return (
    <button
      onClick={() => navigate("/profile?tab=network")}
      className="win98-button text-[10px] flex items-center gap-1 px-2 py-1"
      title={isOffline ? "Offline — Open Network settings" : "Online — Open Network settings"}
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
  );
}
