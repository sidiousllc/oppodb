import { useState, useEffect, useCallback } from "react";
import { Wifi, WifiOff, RefreshCw, Cloud, CloudOff, HardDrive, CheckCircle2 } from "lucide-react";
import { subscribeSyncStatus, syncAllTables, type SyncStatus } from "@/lib/offlineSync";
import { getOfflineStoreSize } from "@/lib/encryptedStore";
import { toast } from "sonner";

export function OfflineStatusIndicator() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [storeInfo, setStoreInfo] = useState<{ records: number; tables: string[] } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);

  useEffect(() => {
    return subscribeSyncStatus(setStatus);
  }, []);

  useEffect(() => {
    getOfflineStoreSize().then(setStoreInfo);
  }, [status?.lastSyncAt]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncProgress("Starting...");
    try {
      const result = await syncAllTables((table, idx, total) => {
        setSyncProgress(`${idx + 1}/${total}: ${table}`);
      });
      setSyncProgress(null);
      if (result.errors.length > 0) {
        toast.warning(`Synced with ${result.errors.length} error(s)`, {
          description: result.errors[0],
        });
      } else {
        toast.success(`Offline data synced`, {
          description: `${result.synced.toLocaleString()} records cached`,
        });
      }
      getOfflineStoreSize().then(setStoreInfo);
    } catch (e: any) {
      toast.error("Sync failed", { description: e.message });
    }
    setSyncing(false);
  }, []);

  if (!status) return null;

  const isOffline = !status.isOnline;

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="win98-button text-[10px] flex items-center gap-1 px-2 py-1"
        title={isOffline ? "Offline Mode" : "Online"}
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

      {showPanel && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-card border border-border rounded-lg shadow-lg z-50 p-4 text-sm animate-fade-in">
          {/* Connection Status */}
          <div className="flex items-center gap-2 mb-3">
            {isOffline ? (
              <>
                <CloudOff className="h-4 w-4 text-destructive" />
                <span className="font-bold text-destructive">Offline Mode</span>
              </>
            ) : (
              <>
                <Cloud className="h-4 w-4 text-primary" />
                <span className="font-bold text-primary">Online</span>
              </>
            )}
          </div>

          {/* Sync Status */}
          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Last synced</span>
              <span className="text-foreground">
                {status.lastSyncAt
                  ? new Date(status.lastSyncAt).toLocaleString()
                  : "Never"}
              </span>
            </div>

            {storeInfo && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <HardDrive className="h-3 w-3" />
                  Cached data
                </span>
                <span className="text-foreground">
                  {storeInfo.records.toLocaleString()} records ({storeInfo.tables.length} tables)
                </span>
              </div>
            )}

            {status.pendingWrites > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Pending writes</span>
                <span className="text-amber-500 font-semibold">{status.pendingWrites}</span>
              </div>
            )}

            {status.pendingWrites === 0 && status.lastSyncAt && (
              <div className="flex items-center gap-1 text-xs text-emerald-500">
                <CheckCircle2 className="h-3 w-3" />
                All changes synced
              </div>
            )}
          </div>

          {/* Sync Progress */}
          {syncProgress && (
            <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <RefreshCw className="h-3 w-3 animate-spin" />
              {syncProgress}
            </div>
          )}

          {/* Sync Button */}
          <button
            onClick={handleSync}
            disabled={syncing || isOffline}
            className="win98-button text-[10px] w-full flex items-center justify-center gap-1 py-1.5"
          >
            <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync Now"}
          </button>

          {isOffline && (
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              Using encrypted offline data. Changes will sync when back online.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
