import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface TickerItem {
  id: string;
  title: string;
  source_name: string;
  scope: string;
  source_url: string | null;
  published_at: string | null;
}

const SCOPE_ICON: Record<string, string> = {
  local: "📍",
  state: "🏛️",
  national: "🇺🇸",
  international: "🌍",
};

export function NewsTicker() {
  const navigate = useNavigate();
  const [items, setItems] = useState<TickerItem[]>([]);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("intel_briefings")
        .select("id,title,source_name,scope,source_url,published_at")
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(40);
      if (!cancelled && data) setItems(data as TickerItem[]);
    };
    load();
    const interval = setInterval(load, 5 * 60 * 1000); // refresh every 5 min
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (items.length === 0) return null;

  // Duplicate for seamless loop
  const looped = [...items, ...items];

  return (
    <div
      className="fixed bottom-[28px] left-0 right-0 z-[997] h-[22px] bg-[hsl(var(--win98-titlebar))] text-white border-t-2 border-t-[hsl(var(--win98-highlight))] border-b border-b-[hsl(var(--win98-shadow))] overflow-hidden flex items-center"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      title="Live news ticker — IntelHub feed"
    >
      <div className="flex-shrink-0 px-2 h-full flex items-center bg-[hsl(var(--destructive))] font-bold text-[10px] uppercase tracking-wide border-r border-r-[hsl(var(--win98-shadow))]">
        🔴 Live
      </div>
      <div className="flex-1 overflow-hidden relative">
        <div
          className="flex gap-6 whitespace-nowrap text-[11px] py-[3px] will-change-transform"
          style={{
            animation: `news-ticker-scroll ${Math.max(items.length * 2, 20)}s linear infinite`,
            animationPlayState: paused ? "paused" : "running",
          }}
        >
          {looped.map((item, idx) => (
            <button
              key={`${item.id}-${idx}`}
              onClick={() => {
                if (item.source_url) window.open(item.source_url, "_blank", "noopener");
                else navigate("/");
              }}
              className="inline-flex items-center gap-1.5 hover:underline focus:outline-none"
            >
              <span>{SCOPE_ICON[item.scope] || "📰"}</span>
              <span className="font-semibold opacity-80">{item.source_name}:</span>
              <span>{item.title}</span>
              <span className="opacity-50 mx-2">•</span>
            </button>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes news-ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
