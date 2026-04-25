import { useEffect, useState } from "react";
import { Download, Loader2, Check } from "lucide-react";
import { syncSelectedTables, subscribeSyncStatus, type SyncStatus } from "@/lib/offlineSync";
import { toast } from "sonner";

interface Props {
  /** Tables this section depends on. Must match SYNC_TABLES entries in offlineSync. */
  tables: string[];
  /** Human label for toasts, e.g. "Intel Hub". */
  label?: string;
  className?: string;
}

/**
 * "Download for offline" button — prefetches just this section's tables
 * into the encrypted offline store. Shows progress and per-section readiness.
 */
export function OfflineSectionDownloadButton({ tables, label, className }: Props) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ i: number; total: number; table: string } | null>(null);

  useEffect(() => subscribeSyncStatus(setStatus), []);

  if (tables.length === 0) return null;

  const cached = status ? tables.filter((t) => status.tablesAvailable.includes(t)).length : 0;
  const ready = cached === tables.length && tables.length > 0;

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    setProgress({ i: 0, total: tables.length, table: tables[0] });
    try {
      const res = await syncSelectedTables(tables, (table, i, total) =>
        setProgress({ i, total, table })
      );
      if (res.errors.length > 0) {
        toast.warning(`${label ?? "Section"} cached with ${res.errors.length} issue(s)`, {
          description: res.errors[0],
        });
      } else {
        toast.success(`${label ?? "Section"} ready offline`, {
          description: `${res.synced.toLocaleString()} record(s) cached`,
        });
      }
    } catch (e: any) {
      toast.error(`Failed to cache ${label ?? "section"}`, { description: e?.message });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const Icon = busy ? Loader2 : ready ? Check : Download;
  const text = busy
    ? progress
      ? `Caching ${progress.i + 1}/${progress.total}…`
      : "Caching…"
    : ready
    ? "Re-download"
    : "Download for offline";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      title={
        busy && progress
          ? `Syncing ${progress.table}`
          : `Cache ${tables.length} table(s) for offline use`
      }
      className={`win98-button inline-flex items-center gap-1 text-[10px] disabled:opacity-60 ${className ?? ""}`}
    >
      <Icon className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} />
      {text}
    </button>
  );
}
