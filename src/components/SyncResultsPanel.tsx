import { useState, useMemo } from "react";
import { type SyncReport, type StateSyncResult } from "@/data/electionResults";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileWarning,
  X,
} from "lucide-react";

function StateRow({ result }: { result: StateSyncResult }) {
  const [expanded, setExpanded] = useState(false);
  const hasSkips = result.skipped_files.length > 0;
  const hasError = !result.success || !!result.error;

  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        onClick={() => hasSkips && setExpanded(!expanded)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
          hasSkips ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"
        }`}
      >
        {hasError ? (
          <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
        ) : hasSkips ? (
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        )}

        <span className="font-medium text-foreground w-8">{result.state}</span>
        <span className="text-muted-foreground flex-1">
          {result.upserted > 0
            ? `${result.upserted} results synced`
            : result.files_found === 0
              ? "No files found"
              : "0 results"}
        </span>
        {result.files_processed > 0 && (
          <span className="text-muted-foreground">
            {result.files_processed}/{result.files_found} files
          </span>
        )}
        {hasSkips && (
          <span className="flex items-center gap-0.5 text-amber-500">
            <FileWarning className="h-3 w-3" />
            {result.skipped_files.length}
            {expanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </span>
        )}
      </button>

      {expanded && hasSkips && (
        <div className="px-3 pb-2 pl-8 space-y-1">
          {result.skipped_files.map((sf, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px]">
              <FileWarning className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <span className="text-muted-foreground font-mono break-all">
                  {sf.file.split("/").pop()}
                </span>
                <span className="text-muted-foreground/70 ml-1">— {sf.reason}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasError && result.error && (
        <div className="px-3 pb-2 pl-8">
          <p className="text-[11px] text-destructive">{result.error}</p>
        </div>
      )}
    </div>
  );
}

interface SyncResultsPanelProps {
  report: SyncReport;
  onClose: () => void;
}

export function SyncResultsPanel({ report, onClose }: SyncResultsPanelProps) {
  const [filter, setFilter] = useState<"all" | "skipped" | "errors">("all");

  const stats = useMemo(() => {
    const withSkips = report.stateResults.filter((r) => r.skipped_files.length > 0).length;
    const withErrors = report.stateResults.filter((r) => !r.success || !!r.error).length;
    const successful = report.stateResults.filter(
      (r) => r.success && !r.error && r.skipped_files.length === 0
    ).length;
    return { withSkips, withErrors, successful };
  }, [report]);

  const filtered = useMemo(() => {
    if (filter === "skipped") return report.stateResults.filter((r) => r.skipped_files.length > 0);
    if (filter === "errors") return report.stateResults.filter((r) => !r.success || !!r.error);
    return report.stateResults;
  }, [report, filter]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
        <div>
          <h3 className="font-display text-sm font-semibold text-foreground">
            Sync Results
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {report.totalUpserted.toLocaleString()} results synced across{" "}
            {report.stateResults.length} states
            {report.resumedFrom && (
              <span className="text-primary ml-1">(resumed from {report.resumedFrom})</span>
            )}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Summary chips */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50">
        <button
          onClick={() => setFilter("all")}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
            filter === "all"
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          All ({report.stateResults.length})
        </button>
        {stats.withSkips > 0 && (
          <button
            onClick={() => setFilter("skipped")}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              filter === "skipped"
                ? "bg-amber-500 text-white"
                : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
            }`}
          >
            <FileWarning className="h-3 w-3" />
            {stats.withSkips} skipped
          </button>
        )}
        {stats.withErrors > 0 && (
          <button
            onClick={() => setFilter("errors")}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              filter === "errors"
                ? "bg-destructive text-destructive-foreground"
                : "bg-destructive/10 text-destructive hover:bg-destructive/20"
            }`}
          >
            <XCircle className="h-3 w-3" />
            {stats.withErrors} errors
          </button>
        )}
        <span className="flex items-center gap-1 text-[11px] text-emerald-600">
          <CheckCircle2 className="h-3 w-3" />
          {stats.successful} clean
        </span>
      </div>

      {/* State list */}
      <div className="max-h-[300px] overflow-y-auto">
        {filtered.map((r) => (
          <StateRow key={r.state} result={r} />
        ))}
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No states match this filter.
          </p>
        )}
      </div>
    </div>
  );
}
