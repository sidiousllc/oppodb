import { ExternalLink, Sparkles, Loader2, Copy, Check } from "lucide-react";
import { Win98Window } from "@/components/Win98Window";
import type { OSINTTool } from "@/data/osintTools";
import { useState } from "react";
import { toast } from "sonner";

interface OSINTResultWindowProps {
  tool: OSINTTool;
  query: string;
  results: Record<string, any>[];
  aiTab: "summary" | "talking" | "vuln" | null;
  aiLoading: boolean;
  aiOutput: string;
  onRunAI: (kind: "summary" | "talking" | "vuln") => void;
  onClose: () => void;
  defaultPosition?: { x: number; y: number };
}

/**
 * Themed Win98 popup window that shows the full result set + AI panels for
 * an OSINT search. Mirrors PollDetailWindow's pattern (draggable, resizable,
 * theme-aware via CSS tokens). Mounted inside OSINTToolPanel as a sibling.
 */
export function OSINTResultWindow({
  tool, query, results, aiTab, aiLoading, aiOutput,
  onRunAI, onClose, defaultPosition,
}: OSINTResultWindowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyAI = async () => {
    if (!aiOutput) return;
    try {
      await navigator.clipboard.writeText(aiOutput);
      setCopied(true);
      toast.success("AI analysis copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <Win98Window
      title={`${tool.label} — "${query.length > 32 ? query.slice(0, 32) + "…" : query}" (${results.length})`}
      icon={<span>{tool.emoji}</span>}
      onClose={onClose}
      defaultPosition={defaultPosition ?? { x: 80, y: 60 }}
      defaultSize={{ width: 640, height: 540 }}
      minSize={{ width: 360, height: 280 }}
      statusBar={
        <span className="truncate">
          Source: {tool.source} · {results.length} result{results.length === 1 ? "" : "s"} · Subject: {tool.aiSubjectType}
        </span>
      }
    >
      <div className="p-2 space-y-2">
        {/* Subject AI buttons */}
        <div className="win98-raised bg-[hsl(var(--win98-face))] p-2">
          <div className="text-[10px] font-bold mb-1.5 flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Subject AI
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => onRunAI("summary")}
              disabled={aiLoading}
              className={`win98-button text-[9px] ${aiTab === "summary" ? "font-bold" : ""}`}
            >
              {aiLoading && aiTab === "summary" ? <Loader2 className="h-2.5 w-2.5 animate-spin inline mr-1" /> : null}
              📋 Analyst summary
            </button>
            <button
              onClick={() => onRunAI("talking")}
              disabled={aiLoading}
              className={`win98-button text-[9px] ${aiTab === "talking" ? "font-bold" : ""}`}
            >
              {aiLoading && aiTab === "talking" ? <Loader2 className="h-2.5 w-2.5 animate-spin inline mr-1" /> : null}
              🎯 Talking points
            </button>
            <button
              onClick={() => onRunAI("vuln")}
              disabled={aiLoading}
              className={`win98-button text-[9px] ${aiTab === "vuln" ? "font-bold" : ""}`}
            >
              {aiLoading && aiTab === "vuln" ? <Loader2 className="h-2.5 w-2.5 animate-spin inline mr-1" /> : null}
              ⚠️ Vulnerability score
            </button>
            {aiOutput && (
              <button onClick={handleCopyAI} className="win98-button text-[9px] ml-auto">
                {copied ? <Check className="h-2.5 w-2.5 inline mr-1" /> : <Copy className="h-2.5 w-2.5 inline mr-1" />}
                Copy AI
              </button>
            )}
          </div>
          {aiOutput && (
            <div className="mt-2 bg-white border border-[hsl(var(--win98-shadow))] p-2 text-[10px] whitespace-pre-wrap max-h-72 overflow-auto">
              {aiOutput}
            </div>
          )}
        </div>

        {/* Full result list */}
        <div className="win98-sunken bg-white p-2 space-y-1.5">
          {results.length === 0 && (
            <div className="text-[10px] text-[hsl(var(--muted-foreground))] p-2">No results.</div>
          )}
          {results.map((r, i) => (
            <DetailRow key={i} row={r} index={i + 1} />
          ))}
        </div>

        {/* Raw JSON (expandable) */}
        <details className="win98-raised bg-[hsl(var(--win98-face))] p-2">
          <summary className="text-[10px] font-bold cursor-pointer">🔧 Raw JSON ({results.length} rows)</summary>
          <pre className="mt-2 text-[9px] bg-[hsl(var(--win98-light))] border border-[hsl(var(--win98-shadow))] p-2 overflow-auto max-h-64 whitespace-pre-wrap">
{JSON.stringify(results, null, 2)}
          </pre>
        </details>
      </div>
    </Win98Window>
  );
}

function DetailRow({ row, index }: { row: Record<string, any>; index: number }) {
  const url = row.source_url || row.url || row.docket_url || row.archive_url;
  const title = row.title || row.name || row.case_name || row.entity_name || row.username || row.query || `Result ${index}`;
  const subtitleParts = [row.subtitle, row.location, row.date, row.status, row.jurisdiction, row.country, row.agency, row.committee, row.party]
    .filter(Boolean);
  const snippet = row.snippet || row.description || row.summary || row.content;

  // Surface every other field as a key/value table
  const skip = new Set(["source_url", "url", "docket_url", "archive_url", "title", "name", "case_name", "entity_name", "username", "query",
    "subtitle", "location", "date", "status", "jurisdiction", "country", "agency", "committee", "party",
    "snippet", "description", "summary", "content", "platforms"]);
  const extras = Object.entries(row).filter(([k, v]) =>
    !skip.has(k) && v != null && v !== "" && (typeof v !== "object" || (Array.isArray(v) && v.length > 0))
  );

  return (
    <div className="bg-[hsl(var(--win98-face))] win98-raised p-2 text-[10px] space-y-1">
      <div className="flex items-start justify-between gap-2">
        <div className="font-bold text-[11px]">{index}. {title}</div>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0 inline-flex items-center gap-1 underline">
            Open <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
      {subtitleParts.length > 0 && (
        <div className="text-[hsl(var(--muted-foreground))]">{subtitleParts.join(" · ")}</div>
      )}
      {snippet && (
        <div className="whitespace-pre-wrap bg-white border border-[hsl(var(--win98-shadow))] p-1.5 max-h-40 overflow-auto">
          {String(snippet)}
        </div>
      )}
      {Array.isArray(row.platforms) && row.platforms.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {row.platforms.map((p: string) => (
            <span key={p} className="text-[9px] px-1 bg-[hsl(var(--win98-light))] border border-[hsl(var(--win98-shadow))]">{p}</span>
          ))}
        </div>
      )}
      {extras.length > 0 && (
        <table className="w-full text-[9px] border-collapse">
          <tbody>
            {extras.map(([k, v]) => (
              <tr key={k} className="border-t border-[hsl(var(--win98-shadow))]">
                <td className="font-bold pr-2 align-top whitespace-nowrap text-[hsl(var(--muted-foreground))]">{k}</td>
                <td className="break-all">{typeof v === "object" ? JSON.stringify(v) : String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
