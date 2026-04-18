import { useEffect, useState } from "react";
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

const SPEED_KEY = "ordb.newsTicker.speed";
const ENABLED_KEY = "ordb.newsTicker.enabled";
const DEFAULT_SPEED = 0.5;

function readSpeed(): number {
  if (typeof window === "undefined") return DEFAULT_SPEED;
  const stored = window.localStorage.getItem(SPEED_KEY);
  const parsed = stored ? Number(stored) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SPEED;
}
function readEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(ENABLED_KEY) !== "false";
}

export function NewsTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);
  const [paused, setPaused] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<StoryCluster<ClusterableArticle> | null>(null);
  const [speed, setSpeed] = useState<number>(() => readSpeed());
  const [enabled, setEnabled] = useState<boolean>(() => readEnabled());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // Cap published_at at "now" so future-dated RSS items don't crowd out real news
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from("intel_briefings")
        .select("id,title,source_name,scope,source_url,published_at,summary")
        .lte("published_at", nowIso)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(200);
      if (cancelled || !data) return;
      // Dedupe by normalized title; keep up to 80 unique headlines
      const seen = new Set<string>();
      const unique: TickerItem[] = [];
      for (const item of data as TickerItem[]) {
        const key = (item.title || "").trim().toLowerCase().slice(0, 120);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        unique.push(item);
        if (unique.length >= 80) break;
      }
      setItems(unique);
    };
    load();
    // Refresh every 15 min (was 5) — DB cron only syncs every 15 min anyway
    const interval = setInterval(load, 15 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Live-react to settings changes from Profile page (same tab via CustomEvent, other tabs via storage)
  useEffect(() => {
    const onSpeed = (e: Event) => {
      const v = (e as CustomEvent<number>).detail;
      if (typeof v === "number" && v > 0) setSpeed(v);
    };
    const onEnabled = (e: Event) => {
      const v = (e as CustomEvent<boolean>).detail;
      if (typeof v === "boolean") setEnabled(v);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === SPEED_KEY) setSpeed(readSpeed());
      if (e.key === ENABLED_KEY) setEnabled(readEnabled());
    };
    window.addEventListener("ordb:newsTicker:speed", onSpeed as EventListener);
    window.addEventListener("ordb:newsTicker:enabled", onEnabled as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("ordb:newsTicker:speed", onSpeed as EventListener);
      window.removeEventListener("ordb:newsTicker:enabled", onEnabled as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  if (!enabled || items.length === 0) return null;

  const looped = [...items, ...items];
  // Larger queue → longer scroll so all stories are visible before looping
  const durationSeconds = Math.max(items.length * speed * 4, 30);

  return (
    <>
    <div
      className="fixed bottom-[28px] left-0 right-0 z-[997] h-[22px] bg-[hsl(var(--win98-titlebar))] text-white border-t-2 border-t-[hsl(var(--win98-highlight))] border-b border-b-[hsl(var(--win98-shadow))] overflow-hidden flex items-center"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      title="Live news ticker — adjust speed in Profile › Appearance"
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
