import { useEffect, useState } from "react";

export const TICKER_SPEED_PRESETS: { label: string; value: number; description: string }[] = [
  { label: "Very Slow", value: 1.5, description: "Plenty of time to read each headline" },
  { label: "Slow", value: 1.0, description: "Relaxed scrolling pace" },
  { label: "Normal", value: 0.5, description: "Default — balanced" },
  { label: "Fast", value: 0.25, description: "Quick scan of headlines" },
  { label: "Very Fast", value: 0.12, description: "Hyper-paced, like a stock ticker" },
];
export const TICKER_SPEED_KEY = "ordb.newsTicker.speed";
const DEFAULT_SPEED = 0.5;

function readSpeed(): number {
  if (typeof window === "undefined") return DEFAULT_SPEED;
  const stored = window.localStorage.getItem(TICKER_SPEED_KEY);
  const parsed = stored ? Number(stored) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SPEED;
}

/**
 * Settings UI for the bottom news ticker. Persists to localStorage and
 * dispatches a 'storage' event so the live ticker picks up changes immediately.
 */
export function NewsTickerSettings() {
  const [speed, setSpeed] = useState<number>(() => readSpeed());
  const [enabled, setEnabled] = useState<boolean>(() =>
    typeof window === "undefined"
      ? true
      : window.localStorage.getItem("ordb.newsTicker.enabled") !== "false"
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TICKER_SPEED_KEY, String(speed));
    // Notify ticker mounted in another tree
    window.dispatchEvent(new CustomEvent("ordb:newsTicker:speed", { detail: speed }));
  }, [speed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("ordb.newsTicker.enabled", String(enabled));
    window.dispatchEvent(new CustomEvent("ordb:newsTicker:enabled", { detail: enabled }));
  }, [enabled]);

  return (
    <div className="space-y-3">
      <div className="win98-sunken bg-[hsl(var(--win98-light))] p-2 text-[10px]">
        <p className="text-[hsl(var(--muted-foreground))]">
          The news ticker shows live headlines from IntelHub at the bottom of the screen.
          Adjust how quickly headlines scroll across, or hide the ticker entirely.
        </p>
      </div>

      <label className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-bold">Show news ticker</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-3.5 w-3.5"
        />
      </label>

      <div>
        <div className="text-[11px] font-bold mb-1.5">Scroll speed</div>
        <div className="grid grid-cols-1 gap-1">
          {TICKER_SPEED_PRESETS.map((preset) => {
            const active = preset.value === speed;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => setSpeed(preset.value)}
                disabled={!enabled}
                className={`win98-button text-left px-2 py-1.5 text-[11px] flex items-center justify-between gap-2 ${
                  active ? "font-bold" : ""
                } ${!enabled ? "opacity-40" : ""}`}
                style={active && enabled ? {
                  borderColor: "hsl(var(--primary))",
                  background: "hsl(var(--accent))",
                } : {}}
              >
                <span>{active ? "✓ " : "  "}{preset.label}</span>
                <span className="text-[9px] text-[hsl(var(--muted-foreground))] truncate">
                  {preset.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
