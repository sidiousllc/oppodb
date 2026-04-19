import { useState, useEffect, useCallback } from "react";
import { Wifi, WifiOff, RefreshCw, HardDrive, CheckCircle2, Trash2, Database, Shield, Clock, Download } from "lucide-react";
import { subscribeSyncStatus, syncAllTables, replayPendingWrites, type SyncStatus } from "@/lib/offlineSync";
import { getOfflineStoreSize, clearAllOfflineData, getSyncMeta } from "@/lib/encryptedStore";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SYNC_TABLE_LABELS: Record<string, string> = {
  district_profiles: "District Profiles",
  candidate_profiles: "Candidate Profiles",
  candidate_versions: "Candidate Versions",
  congress_members: "Congress Members",
  congress_bills: "Congress Bills",
  congress_committees: "Committees",
  congress_votes: "Congress Votes",
  congressional_record: "Congressional Record",
  election_forecasts: "Election Forecasts",
  election_forecast_history: "Forecast History",
  election_night_streams: "Election Night Streams",
  campaign_finance: "Campaign Finance",
  polling_data: "Polling Data",
  congressional_election_results: "Election Results",
  state_legislative_profiles: "State Leg Profiles",
  state_leg_election_results: "State Leg Elections",
  state_voter_stats: "Voter Stats",
  mit_election_results: "MIT Elections",
  mn_cfb_candidates: "MN CFB Candidates",
  state_cfb_candidates: "State CFB Candidates",
  messaging_guidance: "Messaging Guidance",
  local_impacts: "Local Impacts",
  maga_files: "MAGA Files",
  narrative_reports: "Narrative Reports",
  prediction_markets: "Prediction Markets",
  district_news_cache: "District News",
  wiki_pages: "Wiki Pages",
  section_permissions: "Section Permissions",
  international_profiles: "International Profiles",
  international_elections: "International Elections",
  international_leaders: "International Leaders",
  court_cases: "Court Cases",
  federal_spending: "Federal Spending",
  fara_registrants: "FARA Registrants",
  entity_relationships: "Entity Graph",
  bill_impact_analyses: "Bill Impact Analyses",
  intel_briefings: "Intel Briefings",
  reports: "Reports",
};

/**
 * Embeddable Network & Offline settings panel (no window chrome).
 * Used inside the Profile page tabs.
 */
export function NetworkSettingsPanel() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [storeInfo, setStoreInfo] = useState<{ records: number; tables: string[] } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [autoSync, setAutoSync] = useState(() => localStorage.getItem("offline-auto-sync") !== "false");
  const [syncOnWifi, setSyncOnWifi] = useState(() => localStorage.getItem("offline-sync-wifi-only") === "true");
  const [tableSyncTimes, setTableSyncTimes] = useState<Record<string, number>>({});

  useEffect(() => subscribeSyncStatus(setStatus), []);
  useEffect(() => { getOfflineStoreSize().then(setStoreInfo); }, [status?.lastSyncAt]);
  useEffect(() => {
    (async () => {
      const times: Record<string, number> = {};
      for (const table of Object.keys(SYNC_TABLE_LABELS)) {
        const t = await getSyncMeta<number>(`lastSync:${table}`);
        if (t) times[table] = t;
      }
      setTableSyncTimes(times);
    })();
  }, [status?.lastSyncAt]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncProgress("Initializing...");
    try {
      const result = await syncAllTables((table, idx, total) => {
        setSyncProgress(`${idx + 1}/${total}: ${SYNC_TABLE_LABELS[table] || table}`);
      });
      setSyncProgress(null);
      if (result.errors.length > 0) {
        toast.warning(`Synced with ${result.errors.length} error(s)`, { description: result.errors[0] });
      } else {
        toast.success(`Offline data synced`, { description: `${result.synced.toLocaleString()} records cached` });
      }
      getOfflineStoreSize().then(setStoreInfo);
    } catch (e: any) {
      toast.error("Sync failed", { description: e.message });
    }
    setSyncing(false);
  }, []);

  const handleReplayWrites = useCallback(async () => {
    const result = await replayPendingWrites();
    toast.success(`Replayed ${result.replayed} writes`, {
      description: result.failed > 0 ? `${result.failed} failed` : undefined,
    });
  }, []);

  const handleClearData = useCallback(async () => {
    if (!window.confirm("Clear all cached offline data? This cannot be undone.")) return;
    await clearAllOfflineData();
    toast.success("Offline cache cleared");
    getOfflineStoreSize().then(setStoreInfo);
  }, []);

  const toggleAutoSync = (checked: boolean) => {
    setAutoSync(checked);
    localStorage.setItem("offline-auto-sync", String(checked));
  };
  const toggleSyncOnWifi = (checked: boolean) => {
    setSyncOnWifi(checked);
    localStorage.setItem("offline-sync-wifi-only", String(checked));
  };

  const isOffline = !status?.isOnline;

  return (
    <Tabs defaultValue="general" className="text-[11px]">
      <TabsList className="h-7">
        <TabsTrigger value="general" className="text-[11px] h-6">General</TabsTrigger>
        <TabsTrigger value="sync" className="text-[11px] h-6">Sync</TabsTrigger>
        <TabsTrigger value="storage" className="text-[11px] h-6">Storage</TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="space-y-3 mt-2">
        <fieldset className="border border-[hsl(var(--win98-shadow))] p-2 rounded-sm">
          <legend className="text-[10px] px-1 font-bold">Connection Status</legend>
          <div className="flex items-center gap-2 mb-2">
            {isOffline
              ? <WifiOff className="h-5 w-5 text-destructive" />
              : <Wifi className="h-5 w-5 text-primary" />}
            <div>
              <div className="font-bold">{isOffline ? "Offline" : "Connected"}</div>
              <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
                {isOffline ? "Using cached data" : "Connected to server"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[hsl(var(--muted-foreground))]">
            <Clock className="h-3 w-3" />
            Last synced: {status?.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : "Never"}
          </div>
        </fieldset>

        <fieldset className="border border-[hsl(var(--win98-shadow))] p-2 rounded-sm">
          <legend className="text-[10px] px-1 font-bold">Quick Actions</legend>
          <div className="space-y-1.5">
            <button
              onClick={handleSync}
              disabled={syncing || isOffline}
              className="win98-button w-full text-[11px] flex items-center justify-center gap-1 py-1.5"
            >
              <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync All Data Now"}
            </button>
            {syncProgress && (
              <div className="text-[10px] text-[hsl(var(--muted-foreground))] flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                {syncProgress}
              </div>
            )}
            {status && status.pendingWrites > 0 && (
              <button
                onClick={handleReplayWrites}
                disabled={isOffline}
                className="win98-button w-full text-[11px] flex items-center justify-center gap-1 py-1.5"
              >
                <Download className="h-3 w-3" />
                Upload {status.pendingWrites} Pending Write(s)
              </button>
            )}
            {status?.pendingWrites === 0 && status.lastSyncAt && (
              <div className="flex items-center gap-1 text-[10px] text-primary">
                <CheckCircle2 className="h-3 w-3" />
                All changes synced
              </div>
            )}
          </div>
        </fieldset>

        <fieldset className="border border-[hsl(var(--win98-shadow))] p-2 rounded-sm">
          <legend className="text-[10px] px-1 font-bold">Settings</legend>
          <div className="space-y-2">
            <label className="flex items-center justify-between gap-2 cursor-pointer">
              <span>Auto-sync when online</span>
              <Switch checked={autoSync} onCheckedChange={toggleAutoSync} className="scale-75" />
            </label>
            <label className="flex items-center justify-between gap-2 cursor-pointer">
              <span>Sync on Wi-Fi only</span>
              <Switch checked={syncOnWifi} onCheckedChange={toggleSyncOnWifi} className="scale-75" />
            </label>
            <div className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))]">
              <Shield className="h-3 w-3" />
              AES-256-GCM encryption: Enabled
            </div>
          </div>
        </fieldset>
      </TabsContent>

      <TabsContent value="sync" className="mt-2">
        <fieldset className="border border-[hsl(var(--win98-shadow))] p-2 rounded-sm">
          <legend className="text-[10px] px-1 font-bold">Sync Status by Table</legend>
          <div className="max-h-[320px] overflow-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-[hsl(var(--win98-shadow))]">
                  <th className="text-left py-0.5 pr-2">Table</th>
                  <th className="text-left py-0.5 pr-2">Status</th>
                  <th className="text-right py-0.5">Last Sync</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(SYNC_TABLE_LABELS).map(([key, label]) => {
                  const synced = storeInfo?.tables.includes(key);
                  const lastSync = tableSyncTimes[key];
                  return (
                    <tr key={key} className="border-b border-[hsl(var(--win98-shadow)/0.3)]">
                      <td className="py-0.5 pr-2 flex items-center gap-1">
                        <Database className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                        {label}
                      </td>
                      <td className="py-0.5 pr-2">
                        {synced
                          ? <span className="text-primary">✓ Cached</span>
                          : <span className="text-[hsl(var(--muted-foreground))]">—</span>}
                      </td>
                      <td className="py-0.5 text-right text-[hsl(var(--muted-foreground))]">
                        {lastSync
                          ? new Date(lastSync).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </fieldset>
      </TabsContent>

      <TabsContent value="storage" className="space-y-3 mt-2">
        <fieldset className="border border-[hsl(var(--win98-shadow))] p-2 rounded-sm">
          <legend className="text-[10px] px-1 font-bold">Local Storage</legend>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" />Cached records</span>
              <span className="font-bold">{storeInfo?.records.toLocaleString() ?? "0"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Tables cached</span>
              <span className="font-bold">{storeInfo?.tables.length ?? 0} / {Object.keys(SYNC_TABLE_LABELS).length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Pending writes</span>
              <span className={`font-bold ${(status?.pendingWrites ?? 0) > 0 ? "text-destructive" : ""}`}>
                {status?.pendingWrites ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Encryption</span>
              <span className="text-primary font-bold">AES-256-GCM</span>
            </div>
          </div>
        </fieldset>

        <fieldset className="border border-[hsl(var(--win98-shadow))] p-2 rounded-sm">
          <legend className="text-[10px] px-1 font-bold">Manage</legend>
          <button
            onClick={handleClearData}
            className="win98-button w-full text-[11px] flex items-center justify-center gap-1 py-1.5 text-destructive"
          >
            <Trash2 className="h-3 w-3" />
            Clear All Cached Data
          </button>
          <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-1.5 text-center">
            This will delete all locally cached data. You will need to sync again to use offline mode.
          </p>
        </fieldset>
      </TabsContent>
    </Tabs>
  );
}
