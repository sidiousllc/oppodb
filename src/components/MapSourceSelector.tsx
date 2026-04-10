import { memo } from "react";
import { Database, Globe, Server, Zap, RefreshCw, CheckCircle2, XCircle, Clock, Info } from "lucide-react";
import { MapSource, MapDiagnostics, SOURCE_META } from "@/hooks/useMapLoader";

interface MapSourceSelectorProps {
  preferredSource: MapSource;
  onSourceChange: (s: MapSource) => void;
  diagnostics: MapDiagnostics;
  loading: boolean;
  loadTimeMs: number | null;
  error: string | null;
  featureCount: number;
  onRetry: () => void;
  compact?: boolean;
}

const SOURCE_ICONS: Record<MapSource, typeof Database> = {
  local: Database,
  esri: Globe,
  census: Server,
  auto: Zap,
};

function MapSourceSelectorInner({
  preferredSource,
  onSourceChange,
  diagnostics,
  loading,
  loadTimeMs,
  error,
  featureCount,
  onRetry,
  compact = false,
}: MapSourceSelectorProps) {
  const sources: MapSource[] = ["auto", "local", "esri", "census"];

  return (
    <div className="space-y-2">
      {/* Source picker */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mr-1">
          Map Source:
        </span>
        {sources.map((src) => {
          const Icon = SOURCE_ICONS[src];
          const meta = SOURCE_META[src];
          const isActive = preferredSource === src;
          const attempt = diagnostics.attempts.find(a => a.source === src);

          return (
            <button
              key={src}
              onClick={() => onSourceChange(src)}
              disabled={loading}
              title={meta.description}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors border ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
              } disabled:opacity-50`}
            >
              <Icon className="h-3 w-3" />
              {meta.label.split(" ")[0]}
              {attempt && !isActive && (
                attempt.success
                  ? <CheckCircle2 className="h-2.5 w-2.5 text-green-500" />
                  : <XCircle className="h-2.5 w-2.5 text-red-400" />
              )}
            </button>
          );
        })}

        <button
          onClick={onRetry}
          disabled={loading}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-muted-foreground border border-border hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
          title="Retry loading with current source"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Retry
        </button>
      </div>

      {/* Status bar */}
      {!compact && (
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
          {diagnostics.selectedSource && (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              Loaded from {SOURCE_META[diagnostics.selectedSource].label}
            </span>
          )}
          {loadTimeMs !== null && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {diagnostics.cacheHit ? "Cached" : `${loadTimeMs}ms`}
            </span>
          )}
          {featureCount > 0 && (
            <span className="flex items-center gap-1">
              <Info className="h-3 w-3" />
              {featureCount} districts · {diagnostics.statesFound} states
            </span>
          )}
          {diagnostics.attempts.length > 1 && (
            <span className="flex items-center gap-1 text-amber-500">
              <RefreshCw className="h-3 w-3" />
              {diagnostics.attempts.filter(a => !a.success).length} fallback(s) used
            </span>
          )}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
          <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-destructive">Map loading failed</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{error}</p>
            <button
              onClick={onRetry}
              className="text-[10px] text-primary underline underline-offset-2 mt-1 hover:text-primary/80"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Attempt history (collapsed by default in compact mode) */}
      {!compact && diagnostics.attempts.length > 0 && (
        <details className="group">
          <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground select-none">
            Load diagnostics ({diagnostics.attempts.length} attempt{diagnostics.attempts.length !== 1 ? "s" : ""})
          </summary>
          <div className="mt-1 space-y-0.5 pl-2 border-l-2 border-border">
            {diagnostics.attempts.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                {a.success ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="h-3 w-3 text-red-400 shrink-0" />
                )}
                <span className="font-medium text-foreground">
                  {SOURCE_META[a.source].label}
                </span>
                <span className="text-muted-foreground">{a.timeMs}ms</span>
                {a.error && (
                  <span className="text-red-400 truncate max-w-[200px]" title={a.error}>
                    — {a.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export const MapSourceSelector = memo(MapSourceSelectorInner);
