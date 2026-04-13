import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Win98Window } from "@/components/Win98Window";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { RefreshCw, FileText, Globe, MapPin, Landmark, Building2, ExternalLink, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import { applyPdfBranding } from "@/lib/pdfBranding";

type Scope = "local" | "state" | "national" | "international";

interface Briefing {
  id: string;
  scope: string;
  category: string;
  title: string;
  summary: string;
  content: string;
  source_name: string;
  source_url: string | null;
  published_at: string | null;
  region: string | null;
  created_at: string;
}

const SCOPE_CONFIG: Record<Scope, { label: string; icon: React.ReactNode; emoji: string }> = {
  local: { label: "Local", icon: <MapPin size={14} />, emoji: "📍" },
  state: { label: "State", icon: <Landmark size={14} />, emoji: "🏛️" },
  national: { label: "National", icon: <Building2 size={14} />, emoji: "🇺🇸" },
  international: { label: "International", icon: <Globe size={14} />, emoji: "🌍" },
};

export function IntelHub() {
  const [activeScope, setActiveScope] = useState<Scope>("national");
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedBriefing, setSelectedBriefing] = useState<Briefing | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [fullArticle, setFullArticle] = useState<string | null>(null);
  const [loadingArticle, setLoadingArticle] = useState(false);

  const fetchBriefings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("intel_briefings")
      .select("*")
      .eq("scope", activeScope)
      .order("published_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error fetching briefings:", error);
    } else {
      setBriefings((data as Briefing[]) || []);
      if (data && data.length > 0) {
        setLastUpdated(data[0].created_at);
      }
    }
    setLoading(false);
  }, [activeScope]);

  useEffect(() => {
    fetchBriefings();
  }, [fetchBriefings]);

  const handleSync = async () => {
    setSyncing(true);
    toast.info("Syncing intelligence briefings...");
    try {
      const { data, error } = await supabase.functions.invoke("intel-briefing", {
        body: { scopes: [activeScope] },
      });
      if (error) throw error;
      toast.success(`Synced ${data?.count || 0} briefings`);
      await fetchBriefings();
    } catch (e) {
      console.error("Sync error:", e);
      toast.error("Failed to sync briefings");
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    toast.info("Syncing all intelligence sources...");
    try {
      const { data, error } = await supabase.functions.invoke("intel-briefing", {
        body: { scopes: ["local", "state", "national", "international"] },
      });
      if (error) throw error;
      toast.success(`Synced ${data?.count || 0} total briefings`);
      await fetchBriefings();
    } catch (e) {
      console.error("Sync error:", e);
      toast.error("Failed to sync briefings");
    } finally {
      setSyncing(false);
    }
  };

  const handleSelectBriefing = useCallback(async (b: Briefing) => {
    setSelectedBriefing(b);
    setFullArticle(null);
    if (b.source_url) {
      setLoadingArticle(true);
      try {
        const { data, error } = await supabase.functions.invoke("scrape-article", {
          body: { url: b.source_url },
        });
        if (!error && data?.success && data.markdown) {
          setFullArticle(data.markdown);
        }
      } catch (e) {
        console.error("Failed to scrape article:", e);
      } finally {
        setLoadingArticle(false);
      }
    }
  }, []);

  const exportPDF = () => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.width;
    let y = 18;

    const scopeLabel = SCOPE_CONFIG[activeScope].label;
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`Intelligence Briefing — ${scopeLabel}`, pw / 2, y, { align: "center" });
    y += 8;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${format(new Date(), "PPpp")}`, pw / 2, y, { align: "center" });
    y += 10;

    for (const b of briefings) {
      if (y > 260) {
        doc.addPage();
        y = 18;
      }
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      const titleLines = doc.splitTextToSize(b.title, pw - 30);
      doc.text(titleLines, 15, y);
      y += titleLines.length * 5 + 2;

      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(100, 100, 100);
      doc.text(`${b.source_name} • ${b.published_at ? format(new Date(b.published_at), "PPp") : "Unknown date"}`, 15, y);
      y += 5;
      doc.setTextColor(0, 0, 0);

      if (b.summary) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const summaryLines = doc.splitTextToSize(b.summary, pw - 30);
        const linesToPrint = summaryLines.slice(0, 6);
        doc.text(linesToPrint, 15, y);
        y += linesToPrint.length * 4 + 6;
      } else {
        y += 4;
      }
    }

    applyPdfBranding(doc);
    doc.save(`intel-briefing-${activeScope}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast.success("PDF exported");
  };

  const groupedBySource = briefings.reduce<Record<string, Briefing[]>>((acc, b) => {
    if (!acc[b.source_name]) acc[b.source_name] = [];
    acc[b.source_name].push(b);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      {/* Scope Tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {(Object.keys(SCOPE_CONFIG) as Scope[]).map((scope) => (
          <button
            key={scope}
            onClick={() => setActiveScope(scope)}
            className={`px-3 py-1 text-xs font-bold border flex items-center gap-1 ${
              activeScope === scope
                ? "bg-[#000080] text-white border-[#000080]"
                : "bg-[#c0c0c0] text-black border-[#808080] hover:bg-[#d4d4d4]"
            }`}
          >
            {SCOPE_CONFIG[scope].emoji} {SCOPE_CONFIG[scope].label}
          </button>
        ))}

        <div className="flex-1" />

        <button
          onClick={handleSync}
          disabled={syncing}
          className="px-2 py-1 text-xs bg-[#c0c0c0] border border-[#808080] hover:bg-[#d4d4d4] flex items-center gap-1 disabled:opacity-50"
        >
          <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
          Sync {SCOPE_CONFIG[activeScope].label}
        </button>

        <button
          onClick={handleSyncAll}
          disabled={syncing}
          className="px-2 py-1 text-xs bg-[#c0c0c0] border border-[#808080] hover:bg-[#d4d4d4] flex items-center gap-1 disabled:opacity-50"
        >
          <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
          Sync All
        </button>

        <button
          onClick={exportPDF}
          disabled={briefings.length === 0}
          className="px-2 py-1 text-xs bg-[#c0c0c0] border border-[#808080] hover:bg-[#d4d4d4] flex items-center gap-1 disabled:opacity-50"
        >
          <FileText size={12} />
          Export PDF
        </button>
      </div>

      {lastUpdated && (
        <div className="text-[10px] text-gray-500 flex items-center gap-1">
          <Clock size={10} />
          Last updated: {format(new Date(lastUpdated), "PPp")}
        </div>
      )}

      {/* Briefing List */}
      {loading ? (
        <div className="text-xs text-gray-500 py-8 text-center">Loading intelligence briefings...</div>
      ) : briefings.length === 0 ? (
        <div className="text-xs text-gray-500 py-8 text-center">
          No briefings found for {SCOPE_CONFIG[activeScope].label}. Click "Sync" to fetch latest intelligence.
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedBySource).map(([source, items]) => (
            <div key={source} className="border border-[#808080] bg-white">
              <div className="bg-[#000080] text-white px-2 py-1 text-xs font-bold flex items-center gap-1">
                <Globe size={12} />
                {source}
                <span className="ml-auto text-[10px] opacity-75">{items.length} items</span>
              </div>
              <div className="divide-y divide-[#c0c0c0]">
                {items.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => handleSelectBriefing(b)}
                    className="w-full text-left px-2 py-1.5 hover:bg-[#e8e8ff] transition-colors"
                  >
                    <div className="text-xs font-bold text-[#000080] line-clamp-1">{b.title}</div>
                    {b.summary && (
                      <div className="text-[10px] text-gray-600 line-clamp-2 mt-0.5">{b.summary}</div>
                    )}
                    <div className="text-[9px] text-gray-400 mt-0.5">
                      {b.published_at ? format(new Date(b.published_at), "PPp") : ""}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Mini Window */}
      {selectedBriefing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <Win98Window
            title={`📄 ${selectedBriefing.source_name} — Intel Brief`}
            icon={<span className="text-[14px]">📰</span>}
            onClose={() => setSelectedBriefing(null)}
          >
            <div className="w-[600px] max-w-[90vw] max-h-[70vh] overflow-y-auto p-3 bg-white text-xs">
              <h2 className="text-sm font-bold text-[#000080] mb-1">{selectedBriefing.title}</h2>
              <div className="text-[10px] text-gray-500 mb-2 flex items-center gap-2">
                <span>{selectedBriefing.source_name}</span>
                <span>•</span>
                <span>{selectedBriefing.published_at ? format(new Date(selectedBriefing.published_at), "PPpp") : ""}</span>
                <span className="uppercase bg-[#000080] text-white px-1 rounded text-[8px]">
                  {selectedBriefing.scope}
                </span>
              </div>

              {selectedBriefing.summary && (
                <div className="bg-[#ffffcc] border border-[#e6e6a0] p-2 mb-2 text-xs italic">
                  {selectedBriefing.summary}
                </div>
              )}

              <div className="whitespace-pre-wrap text-xs leading-relaxed">
                {selectedBriefing.content || selectedBriefing.summary || "No content available."}
              </div>

              <div className="mt-3 pt-2 border-t border-[#c0c0c0] flex items-center gap-2">
                {selectedBriefing.source_url && (
                  <a
                    href={selectedBriefing.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-[#000080] underline flex items-center gap-1 hover:text-blue-700"
                  >
                    <ExternalLink size={10} />
                    Read original article
                  </a>
                )}
                <div className="flex-1" />
                <button
                  onClick={() => {
                    const doc = new jsPDF();
                    const pw = doc.internal.pageSize.width;
                    let y = 18;
                    doc.setFontSize(14);
                    doc.setFont("helvetica", "bold");
                    const titleLines = doc.splitTextToSize(selectedBriefing.title, pw - 30);
                    doc.text(titleLines, 15, y);
                    y += titleLines.length * 6 + 4;

                    doc.setFontSize(9);
                    doc.setFont("helvetica", "italic");
                    doc.text(`${selectedBriefing.source_name} • ${selectedBriefing.published_at ? format(new Date(selectedBriefing.published_at), "PPp") : ""}`, 15, y);
                    y += 8;

                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(10);
                    const contentText = selectedBriefing.content || selectedBriefing.summary || "";
                    const contentLines = doc.splitTextToSize(contentText, pw - 30);
                    doc.text(contentLines, 15, y);

                    applyPdfBranding(doc);
                    doc.save(`intel-brief-${selectedBriefing.id.substring(0, 8)}.pdf`);
                    toast.success("PDF exported");
                  }}
                  className="px-2 py-1 text-[10px] bg-[#c0c0c0] border border-[#808080] hover:bg-[#d4d4d4] flex items-center gap-1"
                >
                  <FileText size={10} />
                  Export PDF
                </button>
              </div>
            </div>
          </Win98Window>
        </div>
      )}
    </div>
  );
}
