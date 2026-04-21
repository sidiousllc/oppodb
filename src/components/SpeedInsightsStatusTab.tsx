import { useEffect, useState } from "react";
import { Activity, ExternalLink, CheckCircle2, XCircle, RefreshCw, Video } from "lucide-react";
import { getSpeedInsightsConfig, type SpeedInsightsConfig } from "@/lib/speedInsightsConfig";
import { getSessionReplayConfig, type SessionReplayConfig } from "@/lib/sessionReplayConfig";

/**
 * Status panel for Vercel Speed Insights.
 *
 * Note: The Speed Insights browser SDK only sends metrics to Vercel; it
 * does not expose a read API. This panel reports local availability,
 * the active configuration, and beacon health, and links out to the
 * Vercel dashboard for actual metrics.
 */
export function SpeedInsightsStatusTab() {
  const [config, setConfig] = useState<SpeedInsightsConfig | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState<boolean | null>(null);
  const [beaconStatus, setBeaconStatus] = useState<"idle" | "checking" | "ok" | "fail">("idle");
  const [beaconDetail, setBeaconDetail] = useState<string>("");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const refresh = () => {
    const cfg = getSpeedInsightsConfig();
    setConfig(cfg);

    // Detect if the SpeedInsights component has injected its script tag.
    const hasScript = !!document.querySelector(
      'script[src*="/_vercel/insights"], script[src*="va.vercel-scripts.com"]'
    );
    setScriptLoaded(hasScript);
    setLastChecked(new Date());
  };

  useEffect(() => {
    refresh();
  }, []);

  const checkBeacon = async () => {
    setBeaconStatus("checking");
    setBeaconDetail("");
    try {
      const res = await fetch("/_vercel/insights/script.js", {
        method: "HEAD",
        cache: "no-store",
      });
      if (res.ok) {
        setBeaconStatus("ok");
        setBeaconDetail(`HTTP ${res.status} — endpoint reachable`);
      } else {
        setBeaconStatus("fail");
        setBeaconDetail(`HTTP ${res.status} — endpoint not reachable (likely not deployed on Vercel)`);
      }
    } catch (err) {
      setBeaconStatus("fail");
      setBeaconDetail(err instanceof Error ? err.message : "Network error");
    }
  };

  if (!config) return null;

  const StatusBadge = ({ ok, label }: { ok: boolean; label: string }) => (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
        ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
      }`}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </span>
  );

  return (
    <div className="space-y-3">
      <div className="win98-sunken bg-white p-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[12px] font-bold flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Vercel Speed Insights
          </h2>
          <button onClick={refresh} className="win98-button text-[10px] flex items-center gap-1">
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>

        {/* Availability */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="win98-sunken bg-[hsl(var(--win98-light))] p-2">
            <div className="text-[10px] text-[hsl(var(--muted-foreground))] mb-1">Status</div>
            <div className="flex items-center gap-2">
              <StatusBadge ok={config.enabled} label={config.enabled ? "Enabled" : "Disabled"} />
              <StatusBadge ok={!!scriptLoaded} label={scriptLoaded ? "Script loaded" : "Script not loaded"} />
            </div>
          </div>
          <div className="win98-sunken bg-[hsl(var(--win98-light))] p-2">
            <div className="text-[10px] text-[hsl(var(--muted-foreground))] mb-1">Environment</div>
            <div className="text-[11px] font-bold uppercase">{config.env}</div>
          </div>
        </div>

        {/* Configuration */}
        <div className="win98-sunken bg-[hsl(var(--win98-light))] p-2 mb-3">
          <div className="text-[10px] font-bold mb-2">Active configuration</div>
          <table className="w-full text-[10px]">
            <tbody>
              <tr><td className="py-0.5 pr-3 text-[hsl(var(--muted-foreground))]">Enabled</td><td className="font-mono">{String(config.enabled)}</td></tr>
              <tr><td className="py-0.5 pr-3 text-[hsl(var(--muted-foreground))]">Sample rate</td><td className="font-mono">{config.sampleRate}</td></tr>
              <tr><td className="py-0.5 pr-3 text-[hsl(var(--muted-foreground))]">Debug</td><td className="font-mono">{String(config.debug)}</td></tr>
              <tr><td className="py-0.5 pr-3 text-[hsl(var(--muted-foreground))]">Last checked</td><td className="font-mono">{lastChecked?.toLocaleTimeString() ?? "—"}</td></tr>
            </tbody>
          </table>
        </div>

        {/* Beacon check */}
        <div className="win98-sunken bg-[hsl(var(--win98-light))] p-2 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-bold">Beacon endpoint check</div>
            <button onClick={checkBeacon} className="win98-button text-[10px]" disabled={beaconStatus === "checking"}>
              {beaconStatus === "checking" ? "Checking…" : "Run check"}
            </button>
          </div>
          {beaconStatus !== "idle" && (
            <div className="text-[10px]">
              {beaconStatus === "ok" && <StatusBadge ok label="Reachable" />}
              {beaconStatus === "fail" && <StatusBadge ok={false} label="Unreachable" />}
              {beaconDetail && <div className="mt-1 text-[hsl(var(--muted-foreground))]">{beaconDetail}</div>}
            </div>
          )}
        </div>

        {/* Recent metrics — link out */}
        <div className="win98-sunken bg-[hsl(var(--win98-light))] p-2">
          <div className="text-[10px] font-bold mb-1">Recent metrics</div>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] mb-2">
            Speed Insights metrics (LCP, FCP, CLS, INP, TTFB) are aggregated by Vercel and not
            readable from the browser SDK. Open the Vercel dashboard to view scores and trends.
          </p>
          <a
            href="https://vercel.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="win98-button text-[10px] inline-flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            Open Vercel Dashboard
          </a>
        </div>

        <div className="mt-3 text-[9px] text-[hsl(var(--muted-foreground))]">
          Override defaults via <code className="font-mono">VITE_SPEED_INSIGHTS_ENABLED</code>,{" "}
          <code className="font-mono">VITE_SPEED_INSIGHTS_SAMPLE</code>,{" "}
          <code className="font-mono">VITE_SPEED_INSIGHTS_DEBUG</code>.
        </div>
      </div>
    </div>
  );
}
