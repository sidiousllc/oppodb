import { useState, useCallback, useEffect } from "react";
import { ArrowLeft, Search, Loader2, ExternalLink, Info, KeyRound, Sparkles, ChevronRight, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { getOSINTToolById, type OSINTTool } from "@/data/osintTools";
import { OSINTResultWindow } from "@/components/OSINTResultWindow";

interface OSINTToolPanelProps {
  toolId: string;
  onBack?: () => void;
}

type Result = Record<string, any>;

/**
 * Unified OSINT tool runner. Handles all 21 tools via the registry in
 * src/data/osintTools.ts. For url-kind tools it deep-links to the source;
 * for edge-kind tools it invokes the `osint-search` edge function with the
 * registered `edgeAction`. AI panels are mounted on demand using the
 * existing research-chat / talking-points pipeline.
 */
export function OSINTToolPanel({ toolId, onBack }: OSINTToolPanelProps) {
  const tool = getOSINTToolById(toolId);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [aiTab, setAiTab] = useState<"summary" | "talking" | "vuln" | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOutput, setAiOutput] = useState<string>("");
  const [popoutOpen, setPopoutOpen] = useState(false);

  // Load recent searches & key status
  useEffect(() => {
    if (!tool) return;
    try {
      const raw = localStorage.getItem(`osint-recent-${tool.id}`);
      if (raw) setRecent(JSON.parse(raw));
    } catch (_) { /* noop */ }

    if (tool.apiKey) {
      (async () => {
        const { data } = await supabase
          .from("user_integrations" as any)
          .select("id")
          .eq("service", tool.apiKey!.service)
          .eq("is_active", true)
          .maybeSingle();
        setHasKey(!!data);
      })();
    } else {
      setHasKey(true);
    }
  }, [tool?.id]);

  const persistRecent = (q: string) => {
    if (!tool) return;
    const next = [q, ...recent.filter((s) => s !== q)].slice(0, 8);
    setRecent(next);
    try { localStorage.setItem(`osint-recent-${tool.id}`, JSON.stringify(next)); } catch (_) { /* noop */ }
  };

  const runSearch = useCallback(async (qOverride?: string) => {
    if (!tool) return;
    const q = (qOverride ?? query).trim();
    if (!q) { toast.error("Enter a search query"); return; }
    if (q.length > 500) { toast.error("Query too long (max 500 chars)"); return; }

    persistRecent(q);
    setError(null);
    setResults(null);
    setAiOutput("");
    setAiTab(null);

    if (tool.kind === "url" && tool.urlTemplate) {
      const url = tool.urlTemplate.replace("{q}", encodeURIComponent(q));
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success("Opened source in new tab");
      // Synthesize a single result row so AI panels still work on the query string
      setResults([{ query: q, source_url: url, kind: "external_link" }]);
      return;
    }

    if (tool.kind === "edge" && tool.edgeAction) {
      if (tool.apiKey && !hasKey) {
        toast.error(`${tool.apiKey.label} required`);
        return;
      }
      setLoading(true);
      try {
        const { data, error: err } = await supabase.functions.invoke("osint-search", {
          body: { action: tool.edgeAction, query: q },
        });
        if (err) throw err;
        if (data?.error) throw new Error(data.error);
        const arr = Array.isArray(data?.results) ? data.results : (data?.results ? [data.results] : []);
        setResults(arr);
        if (!arr.length) toast.info("No results");
        else toast.success(`${arr.length} result${arr.length === 1 ? "" : "s"}`);
      } catch (e: any) {
        setError(e?.message ?? "Search failed");
        toast.error(e?.message ?? "Search failed");
      } finally {
        setLoading(false);
      }
    }
  }, [tool, query, hasKey, recent]);

  async function runAI(kind: "summary" | "talking" | "vuln") {
    if (!query.trim()) { toast.error("Run a search first"); return; }
    setAiTab(kind);
    setAiLoading(true);
    setAiOutput("");
    try {
      const prompts: Record<typeof kind, string> = {
        summary: `Provide an OSINT analyst's summary of what the following ${tool.aiSubjectType} represents in the context of opposition research, based on these ${tool.label} results. Identify red flags, missing data, and recommended next investigation steps.\n\nSubject: "${query}"\n\nResults JSON:\n${JSON.stringify(results, null, 2)}`,
        talking: `Generate 5 attack-line talking points and 3 defensive talking points for an opposition-research analyst, based on these ${tool.label} findings about "${query}". Format as clear bulleted lists with [ATTACK] and [DEFENSE] tags. Cite specific data points.\n\nResults JSON:\n${JSON.stringify(results, null, 2)}`,
        vuln: `Score the vulnerability (0-100) of the subject "${query}" based on these ${tool.label} findings across these dimensions: Personal, Financial, Legal, Reputational, Associations. Show each subscore with one-line justification, then a final composite score with rationale.\n\nResults JSON:\n${JSON.stringify(results, null, 2)}`,
      };

      const { data, error: err } = await supabase.functions.invoke("research-chat", {
        body: {
          messages: [{ role: "user", content: prompts[kind] }],
          model: "google/gemini-2.5-pro",
        },
      });
      if (err) throw err;
      // research-chat may stream; if so the data here is the final aggregate
      const text = data?.content ?? data?.text ?? data?.response ?? (typeof data === "string" ? data : JSON.stringify(data, null, 2));
      setAiOutput(text);
    } catch (e: any) {
      setAiOutput(`Error: ${e?.message ?? "AI request failed"}`);
      toast.error("AI analysis failed");
    } finally {
      setAiLoading(false);
    }
  }

  if (!tool) {
    return (
      <div className="p-4 text-[11px]">
        Tool not found. <button onClick={onBack} className="underline">Back</button>
      </div>
    );
  }

  return (
    <div>
      {onBack && (
        <button onClick={onBack} className="win98-button text-[10px] flex items-center gap-1 mb-3">
          <ArrowLeft className="h-3 w-3" /> Back to Research Tools
        </button>
      )}

      {/* Header */}
      <div className="win98-sunken bg-[hsl(var(--win98-light))] px-3 py-2 mb-3">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-base">{tool.emoji}</span>
          <span className="font-bold">{tool.label}</span>
          <span className="text-[hsl(var(--muted-foreground))]">— {tool.description}</span>
        </div>
      </div>

      {/* About the source */}
      <div className="win98-raised bg-[hsl(var(--win98-face))] p-3 mb-3">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-[hsl(var(--primary))]" />
          <div className="text-[10px] flex-1">
            <p className="mb-1">{tool.longDescription}</p>
            <p className="text-[hsl(var(--muted-foreground))]">
              <strong>Source:</strong> {tool.source} ·{" "}
              <a href={tool.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-0.5">
                docs <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </p>
            {tool.tags.length > 0 && (
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {tool.tags.map((t) => (
                  <span key={t} className="text-[9px] px-1.5 py-0.5 bg-[hsl(var(--win98-light))] border border-[hsl(var(--win98-shadow))]">{t}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* API key warning */}
      {tool.apiKey && hasKey === false && (
        <div className="win98-raised bg-yellow-50 border border-yellow-300 p-2 mb-3 text-[10px]">
          <div className="flex items-start gap-2">
            <KeyRound className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold mb-0.5">{tool.apiKey.label} required</p>
              <p className="mb-1">{tool.apiKey.helpText}</p>
              <div className="flex gap-1 flex-wrap">
                <button
                  onClick={() => navigate("/profile?tab=osint-keys")}
                  className="win98-button text-[9px]"
                >
                  Add key in Profile
                </button>
                <a
                  href={tool.apiKey.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="win98-button text-[9px] inline-flex items-center gap-1"
                >
                  Get key <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search input */}
      <div className="win98-sunken bg-white p-3 mb-3 space-y-2">
        <label className="block text-[10px] font-bold">{tool.inputHint}</label>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder={tool.inputPlaceholder}
            maxLength={500}
            className="win98-input flex-1"
          />
          <button
            onClick={() => runSearch()}
            disabled={loading || (tool.apiKey && hasKey === false)}
            className="win98-button text-[10px] font-bold flex items-center gap-1 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
            {tool.kind === "url" ? "Open" : "Search"}
          </button>
        </div>
      </div>

      {/* Errors */}
      {error && (
        <div className="win98-raised bg-red-50 border border-red-300 p-2 mb-3 text-[10px]">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Results */}
      {results && results.length > 0 && (
        <div className="win98-raised bg-[hsl(var(--win98-face))] p-2 mb-3">
          <div className="flex items-center justify-between mb-2 gap-2">
            <div className="text-[10px] font-bold">Results ({results.length})</div>
            <button
              onClick={() => setPopoutOpen(true)}
              className="win98-button text-[9px] flex items-center gap-1"
              title="Open full results in a draggable window"
            >
              <Maximize2 className="h-2.5 w-2.5" /> Open in window
            </button>
          </div>
          <div className="space-y-1.5">
            {results.map((r, i) => (
              <ResultRow key={i} row={r} />
            ))}
          </div>
        </div>
      )}

      {/* AI panels (Subject AI suite) */}
      {results && results.length > 0 && (
        <div className="win98-raised bg-[hsl(var(--win98-face))] p-2 mb-3">
          <div className="text-[10px] font-bold mb-2 flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Subject AI — analysis pinned to "{query}"
          </div>
          <div className="flex gap-1 mb-2 flex-wrap">
            <button
              onClick={() => runAI("summary")}
              disabled={aiLoading}
              className={`win98-button text-[9px] ${aiTab === "summary" ? "font-bold" : ""}`}
            >
              {aiLoading && aiTab === "summary" ? <Loader2 className="h-2.5 w-2.5 animate-spin inline mr-1" /> : null}
              📋 Analyst summary
            </button>
            <button
              onClick={() => runAI("talking")}
              disabled={aiLoading}
              className={`win98-button text-[9px] ${aiTab === "talking" ? "font-bold" : ""}`}
            >
              {aiLoading && aiTab === "talking" ? <Loader2 className="h-2.5 w-2.5 animate-spin inline mr-1" /> : null}
              🎯 Talking points
            </button>
            <button
              onClick={() => runAI("vuln")}
              disabled={aiLoading}
              className={`win98-button text-[9px] ${aiTab === "vuln" ? "font-bold" : ""}`}
            >
              {aiLoading && aiTab === "vuln" ? <Loader2 className="h-2.5 w-2.5 animate-spin inline mr-1" /> : null}
              ⚠️ Vulnerability score
            </button>
          </div>
          {aiOutput && (
            <div className="bg-white border border-[hsl(var(--win98-shadow))] p-2 text-[10px] whitespace-pre-wrap max-h-96 overflow-auto">
              {aiOutput}
            </div>
          )}
        </div>
      )}

      {/* Recent */}
      {recent.length > 0 && (
        <div className="win98-raised bg-[hsl(var(--win98-face))] p-3">
          <p className="text-[10px] font-bold mb-2">🕒 Recent searches</p>
          <div className="flex flex-wrap gap-1">
            {recent.map((s, i) => (
              <button
                key={i}
                onClick={() => { setQuery(s); runSearch(s); }}
                className="win98-button text-[9px] flex items-center gap-1"
              >
                <ChevronRight className="h-2 w-2" />
                {s.length > 40 ? s.slice(0, 40) + "…" : s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultRow({ row }: { row: Result }) {
  const url = row.source_url || row.url || row.docket_url || row.archive_url;
  const title = row.title || row.name || row.case_name || row.entity_name || row.username || row.query || "(untitled)";
  const subtitle = [row.subtitle, row.location, row.date, row.status, row.jurisdiction].filter(Boolean).join(" · ");
  const snippet = row.snippet || row.description || row.summary;

  const Wrapper = url ? "a" : "div";
  const wrapperProps = url ? { href: url, target: "_blank", rel: "noopener noreferrer" } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className="block bg-white border border-[hsl(var(--win98-shadow))] p-2 hover:bg-blue-50 cursor-pointer text-current no-underline"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold truncate">{title}</div>
          {subtitle && <div className="text-[9px] opacity-80 mt-0.5 truncate">{subtitle}</div>}
          {snippet && <div className="text-[9px] opacity-70 mt-1 line-clamp-3 whitespace-pre-wrap">{snippet}</div>}
          {row.platforms && Array.isArray(row.platforms) && (
            <div className="flex flex-wrap gap-1 mt-1">
              {row.platforms.slice(0, 12).map((p: string) => (
                <span key={p} className="text-[8px] px-1 bg-[hsl(var(--win98-light))] border border-[hsl(var(--win98-shadow))]">{p}</span>
              ))}
              {row.platforms.length > 12 && <span className="text-[8px] opacity-60">+{row.platforms.length - 12} more</span>}
            </div>
          )}
        </div>
        {url && <ExternalLink className="h-3 w-3 shrink-0 mt-0.5 opacity-60" />}
      </div>
    </Wrapper>
  );
}
