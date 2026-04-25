/**
 * Environment-based configuration for Vercel Speed Insights.
 *
 * Controls whether Speed Insights is enabled and what sample rate to use,
 * keyed off the runtime environment (development / preview / production).
 *
 * Override at build time via Vite env vars:
 *   VITE_SPEED_INSIGHTS_ENABLED   = "true" | "false"
 *   VITE_SPEED_INSIGHTS_SAMPLE    = "0" .. "1"
 *   VITE_SPEED_INSIGHTS_DEBUG     = "true" | "false"
 */

export type SpeedInsightsEnv = "development" | "preview" | "production";

export interface SpeedInsightsConfig {
  enabled: boolean;
  sampleRate: number; // 0..1
  debug: boolean;
  env: SpeedInsightsEnv;
}

const DEFAULTS: Record<SpeedInsightsEnv, Omit<SpeedInsightsConfig, "env">> = {
  development: { enabled: false, sampleRate: 0,   debug: true  },
  preview:     { enabled: true,  sampleRate: 0.5, debug: true  },
  production:  { enabled: true,  sampleRate: 1,   debug: false },
};

/** Detect the current runtime environment. */
export function detectEnv(): SpeedInsightsEnv {
  if (import.meta.env.DEV) return "development";

  if (typeof window !== "undefined" && window.location) {
    const host = window.location.hostname ?? "";
    const isPreview =
      host.includes("id-preview--") ||
      host.includes("lovableproject.com") ||
      host.includes("lovable.app") ||
      host.endsWith("vercel.app");
    if (isPreview) return "preview";
  }

  return "production";
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "true" || value === "1";
}

function parseSample(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const n = Number(value);
  if (Number.isNaN(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

export function getSpeedInsightsConfig(): SpeedInsightsConfig {
  const env = detectEnv();
  const defaults = DEFAULTS[env];

  return {
    env,
    enabled:    parseBool(import.meta.env.VITE_SPEED_INSIGHTS_ENABLED as string | undefined, defaults.enabled),
    sampleRate: parseSample(import.meta.env.VITE_SPEED_INSIGHTS_SAMPLE as string | undefined, defaults.sampleRate),
    debug:      parseBool(import.meta.env.VITE_SPEED_INSIGHTS_DEBUG as string | undefined, defaults.debug),
  };
}
