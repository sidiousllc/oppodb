// Client hook for reading the unified AI generation history log. Powers the
// "AI Version History" window and per-section history panels.
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AIHistoryRow {
  id: string;
  feature: string;
  subject_type: string | null;
  subject_ref: string | null;
  model: string | null;
  prompt_summary: string | null;
  output: Record<string, unknown>;
  supersedes: string | null;
  version: number;
  triggered_by: string | null;
  trigger_source: string;
  status: string;
  error_message: string | null;
  duration_ms: number | null;
  token_usage: Record<string, unknown> | null;
  created_at: string;
}

export interface AIHistoryFilter {
  feature?: string;
  subject_type?: string;
  subject_ref?: string;
  /** Limit number of rows returned (default 50, max 500) */
  limit?: number;
}

export function useAIGenerationHistory(filter: AIHistoryFilter = {}) {
  const [rows, setRows] = useState<AIHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let q = (supabase.from as any)("ai_generation_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(Math.min(filter.limit ?? 50, 500));
      if (filter.feature) q = q.eq("feature", filter.feature);
      if (filter.subject_type) q = q.eq("subject_type", filter.subject_type);
      if (filter.subject_ref) q = q.eq("subject_ref", filter.subject_ref);
      const { data, error } = await q;
      if (error) throw error;
      setRows((data ?? []) as AIHistoryRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [filter.feature, filter.subject_type, filter.subject_ref, filter.limit]);

  useEffect(() => { load(); }, [load]);

  return { rows, loading, error, reload: load };
}
