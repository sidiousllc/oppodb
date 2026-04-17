import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GroundNewsDetailWindow } from "@/components/GroundNewsDetailWindow";
import type { StoryCluster, ClusterableArticle } from "@/lib/newsBias";

interface TickerItem {
  id: string;
  title: string;
  source_name: string;
  scope: string;
  source_url: string | null;
  published_at: string | null;
  summary?: string | null;
}

const SCOPE_ICON: Record<string, string> = {
  local: "📍",
  state: "🏛️",
  national: "🇺🇸",
  international: "🌍",
};

// Speed = seconds-per-item multiplier. Lower = faster.
const SPEED_PRESETS: { label: string; value: number }[] = [
  { label: "Very Slow", value: 1.5 },
  { label: "Slow", value: 1.0 },
  { label: "Normal", value: 0.5 },
  { label: "Fast", value: 0.25 },
  { label: "Very Fast", value: 0.12 },
];
const STORAGE_KEY = "ordb.newsTicker.speed";
const DEFAULT_SPEED = 0.5;

export function NewsTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);
  const [paused, setPaused] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<StoryCluster<ClusterableArticle> | null>(null);
  const [speed, setSpeed] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_SPEED;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? Number(stored) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SPEED;
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("intel_briefings")
        .select("id,title,source_name,scope,source_url,published_at,summary")
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, String(speed));
    }
  }, [speed]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  if (items.length === 0) return null;

  // Duplicate for seamless loop
  const looped = [...items, ...items];
  const durationSeconds = Math.max(items.length * speed, 4);

  return (
    <>
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
            animation: `news-ticker-scroll ${durationSeconds}s linear infinite`,
            animationPlayState: paused ? "paused" : "running",
          }}
        >
          {looped.map((item, idx) => (
            <button
              key={`${item.id}-${idx}`}
              onClick={() => {
                setSelectedCluster({
                  id: item.id,
                  lead: {
                    title: item.title,
                    source: item.source_name,
                    link: item.source_url,
                    pubDate: item.published_at,
                    summary: item.summary ?? undefined,
                  },
                  articles: [{
                    title: item.title,
                    source: item.source_name,
                    link: item.source_url,
                    pubDate: item.published_at,
                    summary: item.summary ?? undefined,
                  }],
                  bias: { L: 0, C: 0, R: 0, U: 1 },
                  blindspot: null,
                });
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
      {/* Speed control */}
      <div ref={menuRef} className="relative flex-shrink-0 h-full flex items-center border-l border-l-[hsl(var(--win98-shadow))]">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
          className="h-full px-2 text-[11px] font-bold hover:bg-white/10 focus:outline-none"
          title="Ticker speed"
          aria-label="Ticker speed"
        >
          ⚙ {SPEED_PRESETS.find((p) => p.value === speed)?.label ?? "Speed"}
        </button>
        {menuOpen && (
          <div className="absolute right-0 bottom-full mb-1 z-[998] min-w-[140px] bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))] border-2 border-t-[hsl(var(--win98-highlight))] border-l-[hsl(var(--win98-highlight))] border-r-[hsl(var(--win98-dark-shadow))] border-b-[hsl(var(--win98-dark-shadow))] shadow-md">
            <div className="px-2 py-1 text-[10px] uppercase tracking-wide bg-[hsl(var(--win98-titlebar))] text-white font-bold">
              Ticker Speed
            </div>
            {SPEED_PRESETS.map((preset) => {
              const active = preset.value === speed;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setSpeed(preset.value);
                    setMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1 text-[11px] hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--primary-foreground))] ${
                    active ? "bg-[hsl(var(--primary))]/20 font-bold" : ""
                  }`}
                >
                  {active ? "✓ " : "  "}{preset.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <style>{`
        @keyframes news-ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
    {selectedCluster && (
      <GroundNewsDetailWindow
        cluster={selectedCluster}
        onClose={() => setSelectedCluster(null)}
        contextLabel="News Ticker"
      />
    )}
    </>
  );
}
