import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type ActivityType = "page_view" | "map_view" | "content_edit" | "chat_send" | "api_call";

export function useActivityTracker() {
  const { user } = useAuth();
  const lastLogged = useRef<string>("");

  const trackActivity = useCallback(
    async (activityType: ActivityType, details: Record<string, unknown> = {}) => {
      if (!user) return;

      // Debounce identical events within 2s
      const key = `${activityType}:${JSON.stringify(details)}`;
      if (lastLogged.current === key) return;
      lastLogged.current = key;
      setTimeout(() => {
        if (lastLogged.current === key) lastLogged.current = "";
      }, 2000);

      try {
        await supabase.from("user_activity_logs" as any).insert({
          user_id: user.id,
          activity_type: activityType,
          details,
        } as any);
      } catch {
        // Silent fail – logging should never break UX
      }
    },
    [user]
  );

  const trackPageView = useCallback(
    (page: string, extra?: Record<string, unknown>) =>
      trackActivity("page_view", { page, ...extra }),
    [trackActivity]
  );

  const trackMapView = useCallback(
    (mapType: string, extra?: Record<string, unknown>) =>
      trackActivity("map_view", { map_type: mapType, ...extra }),
    [trackActivity]
  );

  return { trackActivity, trackPageView, trackMapView };
}
