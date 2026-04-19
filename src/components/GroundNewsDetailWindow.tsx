import { useEffect, useState } from "react";
import { Win98Window } from "@/components/Win98Window";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { ExternalLink, Loader2, FileText, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import {
  classifyBias,
  BIAS_META,
  biasBarSegments,
  type StoryCluster,
  type ClusterableArticle,
} from "@/lib/newsBias";

interface Props {
  cluster: StoryCluster<ClusterableArticle>;
  onClose: () => void;
  onSavePDF?: (article: ClusterableArticle) => void;
  /** Header label, e.g., "Intel Briefing" or "District News". */
  contextLabel?: string;
}

function formatDate(raw?: string | null) {
  if (!raw) return "";
  try {
    return format(new Date(raw), "PPp");
  } catch {
    return raw;
  }
}

export function GroundNewsDetailWindow({ cluster, onClose, onSavePDF, contextLabel }: Props) {
  const [active, setActive] = useState<ClusterableArticle>(cluster.lead);
  const [content, setContent] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [aiCleaned, setAiCleaned] = useState(false);

  // Fetch full article when active changes
  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setScrapeError(null);
    setAiCleaned(false);
    if (!active.link) {
      setScrapeError("No source URL available.");
      return;
    }
    setScraping(true);
    supabase.functions
      .invoke("scrape-article", { body: { url: active.link } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.success) {
          setScrapeError("Could not load full article.");
        } else {
          setContent(
            data.markdown && data.markdown.trim().length > 0
              ? data.markdown
              : "Could not extract article content. Open the original link below.",
          );
          setAiCleaned(!!data.aiCleaned);
        }
      })
      .catch(() => {
        if (!cancelled) setScrapeError("Could not load full article.");
      })
      .finally(() => {
        if (!cancelled) setScraping(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active.link]);

  const segs = biasBarSegments(cluster.bias);
  const totalSources = cluster.articles.length;
  const uniqueSources = new Set(cluster.articles.map((a) => a.source)).size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Win98Window
        title={`📰 ${contextLabel ?? "Story"} — ${uniqueSources} source${uniqueSources === 1 ? "" : "s"}`}
        onClose={onClose}
        defaultSize={{ width: 980, height: 640 }}
        defaultPosition={{ x: 40, y: 30 }}
      >
        <div className="flex flex-col h-full bg-white text-xs">
          {/* Coverage summary header */}
          <div className="border-b border-[#808080] bg-[#f5f5f5] px-3 py-2 space-y-2">
            <h2 className="text-sm font-bold text-foreground leading-snug">{cluster.lead.title}</h2>

            {/* Bias breakdown bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-gray-600">
                <span className="font-semibold">Coverage by bias</span>
                <span>
                  {totalSources} article{totalSources === 1 ? "" : "s"} • {uniqueSources} unique source
                  {uniqueSources === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex h-3 w-full overflow-hidden rounded-sm border border-[#808080]">
                {segs.L > 0 && (
                  <div
                    style={{ width: `${segs.L}%`, backgroundColor: "#3b82f6" }}
                    title={`Left: ${cluster.bias.L}`}
                  />
                )}
                {segs.C > 0 && (
                  <div
                    style={{ width: `${segs.C}%`, backgroundColor: "#9333ea" }}
                    title={`Center: ${cluster.bias.C}`}
                  />
                )}
                {segs.R > 0 && (
                  <div
                    style={{ width: `${segs.R}%`, backgroundColor: "#dc2626" }}
                    title={`Right: ${cluster.bias.R}`}
                  />
                )}
                {segs.U > 0 && (
                  <div
                    style={{ width: `${segs.U}%`, backgroundColor: "#9ca3af" }}
                    title={`Unrated: ${cluster.bias.U}`}
                  />
                )}
              </div>
              <div className="flex items-center gap-3 text-[10px] text-gray-700">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm" style={{ background: "#3b82f6" }} /> L {cluster.bias.L}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm" style={{ background: "#9333ea" }} /> C {cluster.bias.C}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm" style={{ background: "#dc2626" }} /> R {cluster.bias.R}
                </span>
                {cluster.bias.U > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm" style={{ background: "#9ca3af" }} /> Unrated {cluster.bias.U}
                  </span>
                )}
              </div>
            </div>

            {/* Blindspot banner */}
            {cluster.blindspot && (
              <div className="flex items-start gap-2 border border-amber-400 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
                {cluster.blindspot === "left" ? <EyeOff size={12} /> : <Eye size={12} />}
                <span>
                  <strong>Blindspot:</strong>{" "}
                  {cluster.blindspot === "left" && "No coverage from Left-leaning sources."}
                  {cluster.blindspot === "right" && "No coverage from Right-leaning sources."}
                  {cluster.blindspot === "center" && "No Center coverage — only partisan outlets reporting."}
                </span>
              </div>
            )}
          </div>

          {/* Body: article + sidebar */}
          <div className="flex-1 flex overflow-hidden">
            {/* Main article */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 border-r border-[#c0c0c0]">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded-sm"
                  style={{
                    background: BIAS_META[classifyBias(active.source)].bg,
                    color: BIAS_META[classifyBias(active.source)].color,
                  }}
                >
                  {BIAS_META[classifyBias(active.source)].label}
                </span>
                <span className="font-semibold text-primary text-xs">{active.source}</span>
                <span className="text-[10px] text-gray-500">•</span>
                <span className="text-[10px] text-gray-500">{formatDate(active.pubDate)}</span>
              </div>
              <h3 className="text-sm font-bold text-foreground leading-snug">{active.title}</h3>

              {active.summary && (
                <div className="bg-[#ffffcc] border border-[#e6e6a0] p-2 text-xs italic">
                  {active.summary}
                </div>
              )}

              <div className="flex gap-2">
                {active.link && (
                  <a
                    href={active.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 text-[10px] bg-[#c0c0c0] border border-[#808080] hover:bg-[#d4d4d4] flex items-center gap-1"
                  >
                    <ExternalLink size={10} /> Open original
                  </a>
                )}
                {onSavePDF && (
                  <button
                    onClick={() => onSavePDF(active)}
                    className="px-2 py-1 text-[10px] bg-[#c0c0c0] border border-[#808080] hover:bg-[#d4d4d4] flex items-center gap-1"
                  >
                    <FileText size={10} /> Save PDF
                  </button>
                )}
              </div>

              <div className="border-t border-[#c0c0c0] pt-2">
                {scraping && (
                  <div className="flex items-center gap-2 text-gray-500 py-6 justify-center">
                    <Loader2 size={14} className="animate-spin" />
                    <span>Loading full article…</span>
                  </div>
                )}
                {scrapeError && !scraping && (
                  <div className="flex items-center gap-2 text-amber-700 text-xs py-3 justify-center">
                    <AlertTriangle size={12} /> {scrapeError}
                  </div>
                )}
                {content && !scraping && (
                  <>
                    {aiCleaned && (
                      <div className="mb-2 inline-flex items-center gap-1 text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded-sm">
                        ✨ AI-cleaned · ads, share bars, and related-content widgets stripped
                      </div>
                    )}
                    <div className="prose-research prose-sm max-w-none text-xs leading-relaxed text-foreground">
                      <ReactMarkdown
                        components={{
                          a: ({ href, children }) => (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#000080] underline hover:text-blue-700"
                            >
                              {children}
                            </a>
                          ),
                        }}
                      >
                        {content}
                      </ReactMarkdown>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Related coverage sidebar */}
            <div className="w-64 flex-shrink-0 overflow-y-auto bg-[#fafafa]">
              <div className="px-2 py-1.5 bg-[#000080] text-white text-[10px] font-bold uppercase sticky top-0">
                Related coverage ({cluster.articles.length})
              </div>
              <div className="divide-y divide-[#e0e0e0]">
                {cluster.articles.map((a, i) => {
                  const bias = classifyBias(a.source);
                  const meta = BIAS_META[bias];
                  const isActive = a.link === active.link && a.title === active.title;
                  return (
                    <button
                      key={`${a.source}-${i}`}
                      onClick={() => setActive(a)}
                      className={`w-full text-left px-2 py-2 hover:bg-[#e8e8ff] transition-colors ${
                        isActive ? "bg-[#dbeafe] border-l-2 border-[#000080]" : ""
                      }`}
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        <span
                          className="px-1 py-0.5 text-[8px] font-bold uppercase rounded-sm"
                          style={{ background: meta.bg, color: meta.color }}
                        >
                          {meta.label}
                        </span>
                        <span className="text-[10px] font-semibold text-primary truncate">{a.source}</span>
                      </div>
                      <div className="text-[10px] text-foreground line-clamp-3 leading-snug">{a.title}</div>
                      {a.pubDate && (
                        <div className="text-[9px] text-gray-500 mt-0.5">{formatDate(a.pubDate)}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </Win98Window>
    </div>
  );
}
