import { useEffect, useState } from "react";
import { Cloud, CloudOff, Loader2 } from "lucide-react";
import { subscribeSyncStatus, type SyncStatus } from "@/lib/offlineSync";

/**
 * Per-section offline-readiness badge.
 * Pass the list of tables this section reads from; we report what fraction
 * has been pulled into the encrypted offline store.
 */
interface Props {
  /** Table names this section depends on (must match SYNC_TABLES entries). */
  tables: string[];
  /** Optional human label, e.g. "Intel Hub". */
  label?: string;
  className?: string;
}

export function OfflineSectionStatus({ tables, label, className }: Props) {
  const [status, setStatus] = useState<SyncStatus | null>(null);

  useEffect(() => subscribeSyncStatus(setStatus), []);

  if (!status || tables.length === 0) return null;

  const cached = tables.filter((t) => status.tablesAvailable.includes(t));
  const ratio = cached.length / tables.length;
  const ready = ratio === 1;
  const partial = ratio > 0 && ratio < 1;
  const offline = !status.isOnline;

  let Icon = Cloud;
  let tone = "text-muted-foreground";
  let text = "Not cached";
  if (status.isSyncing) {
    Icon = Loader2;
    tone = "text-primary";
    text = "Caching…";
  } else if (ready) {
    Icon = Cloud;
    tone = "text-primary";
    text = offline ? "Offline ready" : "Cached for offline";
  } else if (partial) {
    Icon = Cloud;
    tone = "text-amber-600 dark:text-amber-400";
    text = `Partial (${cached.length}/${tables.length})`;
  } else if (offline) {
    Icon = CloudOff;
    tone = "text-destructive";
    text = "Not available offline";
  }

  const tip = `${label ? label + " — " : ""}${cached.length}/${tables.length} tables cached${
    status.lastSyncAt ? ` · last sync ${new Date(status.lastSyncAt).toLocaleString()}` : ""
  }${status.pendingWrites > 0 ? ` · ${status.pendingWrites} queued write(s)` : ""}`;

  return (
    <div
      className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded border border-border bg-muted/40 ${tone} ${className ?? ""}`}
      title={tip}
    >
      <Icon className={`h-3 w-3 ${status.isSyncing ? "animate-spin" : ""}`} />
      <span className="font-medium">{text}</span>
      {status.pendingWrites > 0 && (
        <span className="bg-destructive text-destructive-foreground rounded-full text-[9px] px-1 min-w-[14px] text-center" title={`${status.pendingWrites} write(s) queued for sync`}>
          {status.pendingWrites}
        </span>
      )}
    </div>
  );
}
