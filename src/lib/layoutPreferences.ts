// Layout preferences: localStorage-first with background sync to user_layout_preferences.
import { supabase } from "@/integrations/supabase/client";

export interface LayoutState {
  order: string[];
  hidden: string[];
}

const LS_PREFIX = "layoutPrefs:";

function lsKey(layoutKey: string) {
  return `${LS_PREFIX}${layoutKey}`;
}

export function loadLocalLayout(layoutKey: string): LayoutState | null {
  try {
    const raw = localStorage.getItem(lsKey(layoutKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.order)) return null;
    return { order: parsed.order, hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [] };
  } catch {
    return null;
  }
}

export function saveLocalLayout(layoutKey: string, state: LayoutState) {
  try {
    localStorage.setItem(lsKey(layoutKey), JSON.stringify(state));
  } catch {
    /* quota exceeded — ignore */
  }
}

export function clearLocalLayout(layoutKey: string) {
  try {
    localStorage.removeItem(lsKey(layoutKey));
  } catch {
    /* ignore */
  }
}

export async function loadRemoteLayout(layoutKey: string): Promise<LayoutState | null> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return null;
    const { data, error } = await supabase
      .from("user_layout_preferences")
      .select("order, hidden")
      .eq("layout_key", layoutKey)
      .maybeSingle();
    if (error || !data) return null;
    return {
      order: Array.isArray((data as any).order) ? ((data as any).order as string[]) : [],
      hidden: Array.isArray((data as any).hidden) ? ((data as any).hidden as string[]) : [],
    };
  } catch {
    return null;
  }
}

let saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
export async function saveRemoteLayout(layoutKey: string, state: LayoutState) {
  // debounce per-key to avoid hammering the DB while dragging
  const existing = saveTimers.get(layoutKey);
  if (existing) clearTimeout(existing);
  saveTimers.set(
    layoutKey,
    setTimeout(async () => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const userId = userRes?.user?.id;
        if (!userId) return;
        await supabase
          .from("user_layout_preferences")
          .upsert(
            { user_id: userId, layout_key: layoutKey, order: state.order, hidden: state.hidden },
            { onConflict: "user_id,layout_key" }
          );
      } catch (e) {
        console.warn("layout sync failed", e);
      }
    }, 700)
  );
}

/** Reconcile a stored order with the canonical list of section IDs. */
export function reconcileOrder(stored: string[], canonical: string[]): string[] {
  const valid = stored.filter((id) => canonical.includes(id));
  const missing = canonical.filter((id) => !valid.includes(id));
  return [...valid, ...missing];
}
