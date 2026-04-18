// Shared helper for logging AI generations to the unified
// `ai_generation_history` table. Every AI edge function should call
// `logAIGeneration()` after a successful (or failed) generation so users can
// browse versions, compare outputs, and roll back from a single place.
//
// Usage:
//   import { logAIGeneration } from "../_shared/ai-history.ts";
//   await logAIGeneration(admin, {
//     feature: "messaging_talking_points",
//     subject_type: "messaging",
//     subject_ref: messaging_slug,
//     model,
//     output: { points, evidence },
//     triggered_by: user?.id ?? null,
//   });
//
// The helper is intentionally fire-and-forget — it never throws, so a logging
// failure can never break the user-facing AI response.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface AIHistoryEntry {
  /** Short slug identifying the AI feature (e.g. "messaging_talking_points") */
  feature: string;
  subject_type?: string | null;
  subject_ref?: string | null;
  model?: string | null;
  prompt_summary?: string | null;
  /** Full structured snapshot returned by the AI / written to the canonical table */
  output: Record<string, unknown>;
  triggered_by?: string | null;
  trigger_source?: "user" | "cron" | "api" | "mcp" | "system";
  status?: "success" | "error" | "partial";
  error_message?: string | null;
  duration_ms?: number | null;
  token_usage?: Record<string, unknown> | null;
  /** Optional pointer to a previous generation row this one supersedes */
  supersedes?: string | null;
}

export async function logAIGeneration(
  admin: SupabaseClient,
  entry: AIHistoryEntry,
): Promise<string | null> {
  try {
    // Compute next version number for this (feature, subject_type, subject_ref)
    let version = 1;
    try {
      const { data: prev } = await admin
        .from("ai_generation_history")
        .select("version")
        .eq("feature", entry.feature)
        .eq("subject_type", entry.subject_type ?? "")
        .eq("subject_ref", entry.subject_ref ?? "")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (prev && typeof (prev as any).version === "number") {
        version = (prev as any).version + 1;
      }
    } catch (_) {
      // ignore version lookup failure — we'll just store version=1
    }

    const { data, error } = await admin
      .from("ai_generation_history")
      .insert({
        feature: entry.feature,
        subject_type: entry.subject_type ?? null,
        subject_ref: entry.subject_ref ?? null,
        model: entry.model ?? null,
        prompt_summary: entry.prompt_summary?.slice(0, 1000) ?? null,
        output: entry.output ?? {},
        supersedes: entry.supersedes ?? null,
        version,
        triggered_by: entry.triggered_by ?? null,
        trigger_source: entry.trigger_source ?? "user",
        status: entry.status ?? "success",
        error_message: entry.error_message ?? null,
        duration_ms: entry.duration_ms ?? null,
        token_usage: entry.token_usage ?? null,
      } as never)
      .select("id")
      .maybeSingle();

    if (error) {
      console.warn("[ai-history] insert failed:", error.message);
      return null;
    }
    return (data as any)?.id ?? null;
  } catch (e) {
    console.warn("[ai-history] unexpected:", e instanceof Error ? e.message : e);
    return null;
  }
}
