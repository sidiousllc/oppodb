/**
 * Environment-based configuration for Amplitude Session Replay.
 *
 * Session replay storage costs scale with sample rate. We sample lightly
 * in production by default (10%) for cost control while keeping enough
 * coverage for debugging, sample heavily in preview (50%) for QA, and
 * disable in development to avoid noise.
 *
 * Override at build time via Vite env vars:
 *   VITE_SESSION_REPLAY_ENABLED = "true" | "false"
 *   VITE_SESSION_REPLAY_SAMPLE  = "0" .. "1"
 */

import { detectEnv, type SpeedInsightsEnv } from "@/lib/speedInsightsConfig";

export interface SessionReplayConfig {
  enabled: boolean;
  sampleRate: number; // 0..1
  env: SpeedInsightsEnv;
}

const DEFAULTS: Record<SpeedInsightsEnv, Omit<SessionReplayConfig, "env">> = {
  development: { enabled: false, sampleRate: 0    },
  preview:     { enabled: true,  sampleRate: 0.5  },
  production:  { enabled: true,  sampleRate: 0.1  }, // 10% — cost-controlled
};

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

export function getSessionReplayConfig(): SessionReplayConfig {
  const env = detectEnv();
  const defaults = DEFAULTS[env];

  return {
    env,
    enabled:    parseBool(import.meta.env.VITE_SESSION_REPLAY_ENABLED as string | undefined, defaults.enabled),
    sampleRate: parseSample(import.meta.env.VITE_SESSION_REPLAY_SAMPLE as string | undefined, defaults.sampleRate),
  };
}
