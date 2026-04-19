// Blindspot feed: server-clustered news_stories where one side has <15% coverage.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface Story {
  id: string;
  title: string;
  summary: string | null;
  scope: string;
  category: string | null;
  article_count: number;
  left_count: number;
  center_count: number;
  right_count: number;
  left_pct: number;
  center_pct: number;
  right_pct: number;
  is_blindspot: boolean;
  blindspot_side: "left" | "right" | "center" | null;
  last_updated_at: string;
  topic_keywords: string[];
}

export function BlindspotFeed() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [clustering, setClustering] = useState(false);
  const [filter, setFilter] = useState<"all" | "left" | "right">("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("news_stories")
      .select("*")
      .eq("is_blindspot", true)
      .order("last_updated_at", { ascending: false })
      .limit(50);
    if (error) console.error(error);
    setStories((data as Story[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const recluster = async () => {
    setClustering(true);
    toast.info("Clustering recent articles into stories...");
    try {
      const { data, error } = await supabase.functions.invoke("news-cluster-stories", {
        body: { hours: 48, min_cluster: 2, blindspot_threshold: 0.15 },
      });
      if (error) throw error;
      toast.success(`Found ${data?.stories || 0} stories, ${data?.blindspots || 0} blindspots`);
      await load();
    } catch (e) {
      console.error(e);
      toast.error("Clustering failed");
    } finally {
      setClustering(false);
    }
  };

  const filtered = stories.filter((s) => filter === "all" ? true : s.blindspot_side === filter);

  return (
    <div className="space-y-3">
      <div className="border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900">
        <div className="font-bold flex items-center gap-1"><AlertTriangle size={12} /> Blindspots</div>
        <div className="mt-0.5">Stories where one side of the political spectrum has covered the story significantly less (under 15% of total coverage).</div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "left", "right"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-1 text-xs font-bold border ${
              filter === f
                ? f === "left" ? "bg-blue-600 text-white border-blue-600"
                  : f === "right" ? "bg-red-600 text-white border-red-600"
                  : "bg-[#000080] text-white border-[#000080]"
                : "bg-[#c0c0c0] text-black border-[#808080] hover:bg-[#d4d4d4]"
            }`}
          >
            {f === "all" ? "All Blindspots" : f === "left" ? "🔵 Left Blindspot" : "🔴 Right Blindspot"}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={recluster}
          disabled={clustering}
          className="px-2 py-1 text-xs bg-[#c0c0c0] border border-[#808080] hover:bg-[#d4d4d4] flex items-center gap-1 disabled:opacity-50"
        >
          <RefreshCw size={12} className={clustering ? "animate-spin" : ""} />
          Recluster Now
        </button>
      </div>

      {loading ? (
        <div className="text-xs text-gray-500 py-8 text-center">Loading blindspots...</div>
      ) : filtered.length === 0 ? (
        <div className="text-xs text-gray-500 py-8 text-center">
          No blindspots detected yet. Click "Recluster Now" to analyze recent articles.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <div key={s.id} className="border border-[#808080] bg-white p-2 space-y-1">
              <div className="flex items-start gap-2">
                <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
                  s.blindspot_side === "left" ? "bg-blue-600 text-white" : s.blindspot_side === "right" ? "bg-red-600 text-white" : "bg-purple-600 text-white"
                }`}>
                  {s.blindspot_side?.toUpperCase()} BLINDSPOT
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-[#000080] line-clamp-2">{s.title}</div>
                  {s.summary && <div className="text-[10px] text-gray-600 line-clamp-2 mt-0.5">{s.summary}</div>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-1.5 flex-1 overflow-hidden rounded-sm border border-[#c0c0c0]">
                  {s.left_pct > 0 && <div style={{ width: `${s.left_pct}%`, background: "#3b82f6" }} title={`Left ${s.left_pct}%`} />}
                  {s.center_pct > 0 && <div style={{ width: `${s.center_pct}%`, background: "#9333ea" }} title={`Center ${s.center_pct}%`} />}
                  {s.right_pct > 0 && <div style={{ width: `${s.right_pct}%`, background: "#dc2626" }} title={`Right ${s.right_pct}%`} />}
                </div>
                <span className="text-[9px] text-gray-500">L{s.left_count} C{s.center_count} R{s.right_count}</span>
              </div>
              <div className="text-[9px] text-gray-400">
                {s.article_count} articles · {format(new Date(s.last_updated_at), "PPp")} · {s.scope}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
