// URL Bias Check: paste any article URL, get instant AI-rated bias + factuality.
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, ExternalLink } from "lucide-react";
import { BIAS_META, type Bias } from "@/lib/newsBias";

interface CheckResult {
  url: string; title: string | null; source_name: string | null;
  bias: string; factuality: string; reasoning: string; excerpt: string | null;
  cached?: boolean;
}

export function UrlBiasCheck() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);

  const check = async () => {
    if (!url.trim()) return;
    setLoading(true); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("url-bias-check", { body: { url: url.trim() } });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setResult(data as CheckResult);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bias check failed");
    } finally { setLoading(false); }
  };

  const meta = result ? BIAS_META[result.bias as Bias] || BIAS_META.unknown : null;

  return (
    <div className="space-y-3">
      <div className="border border-[#808080] bg-white p-2 space-y-2">
        <div className="text-xs font-bold text-[#000080]">🔍 URL Bias Check</div>
        <div className="text-[10px] text-gray-600">Paste any news article URL to get an AI-powered bias and factuality rating.</div>
        <div className="flex gap-1">
          <input
            type="url"
            placeholder="https://example.com/article"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") check(); }}
            className="flex-1 px-2 py-1 text-xs border border-[#808080] bg-white focus:outline-none focus:border-[#000080]"
          />
          <button
            onClick={check} disabled={loading || !url.trim()}
            className="px-3 py-1 text-xs bg-[#000080] text-white border border-[#000080] hover:bg-blue-800 disabled:opacity-50 flex items-center gap-1"
          >
            <Search size={12} />
            {loading ? "Checking..." : "Check"}
          </button>
        </div>
      </div>

      {result && meta && (
        <div className="border border-[#808080] bg-white p-3 space-y-2">
          {result.title && (
            <div className="text-sm font-bold text-[#000080]">{result.title}</div>
          )}
          {result.source_name && (
            <div className="text-[10px] text-gray-500 flex items-center gap-1">
              {result.source_name}
              <a href={result.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-0.5">
                <ExternalLink size={10} /> Open
              </a>
              {result.cached && <span className="text-gray-400">· cached</span>}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold px-2 py-1 rounded-sm" style={{ background: meta.bg, color: meta.color }}>
              BIAS: {meta.label}
            </span>
            <span className="text-[10px] font-bold px-2 py-1 rounded-sm border border-[#808080]">
              FACTUALITY: {result.factuality?.toUpperCase()}
            </span>
          </div>
          <div className="text-[11px] text-gray-700 leading-relaxed">{result.reasoning}</div>
          {result.excerpt && (
            <div className="text-[10px] italic text-gray-600 border-l-2 border-[#000080] pl-2">"{result.excerpt}"</div>
          )}
        </div>
      )}
    </div>
  );
}
