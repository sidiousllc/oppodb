import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Win98Window } from "@/components/Win98Window";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { RefreshCw, FileText, Globe, MapPin, Landmark, Building2, ExternalLink, Clock, Loader2, Search, Filter, X } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import { applyPdfBranding } from "@/lib/pdfBranding";

type Scope = "local" | "state" | "national" | "international";

type Category = "economy" | "elections" | "legal" | "defense" | "health" | "environment" | "immigration" | "education" | "housing" | "public-safety" | "technology" | "fiscal" | "labor" | "infrastructure" | "veterans" | "reproductive-rights" | "social-security" | "agriculture" | "general";

type PartyLeaning = "left" | "right" | "center" | "all";

const LEFT_SOURCES = ["The Nation", "Mother Jones", "Talking Points Memo", "The New Republic", "Daily Beast", "HuffPost", "Salon", "Jacobin", "Democracy Now!", "The Intercept", "Vox", "Slate", "CAP", "EPI", "CBPP", "Brookings", "Urban Institute", "Third Way", "Brennan Center"];
const RIGHT_SOURCES = ["Daily Caller", "Washington Examiner", "National Review", "Washington Free Beacon", "The Federalist", "Townhall", "Daily Wire", "Breitbart", "RedState", "Heritage Foundation", "AEI", "Cato Institute", "Manhattan Institute", "Hoover Institution", "R Street", "American Action Forum"];

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

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: "general", label: "General" },
  { value: "economy", label: "Economy" },
  { value: "elections", label: "Elections" },
  { value: "legal", label: "Legal" },
  { value: "defense", label: "Defense" },
  { value: "health", label: "Health" },
  { value: "environment", label: "Environment" },
  { value: "immigration", label: "Immigration" },
  { value: "education", label: "Education" },
  { value: "housing", label: "Housing" },
  { value: "public-safety", label: "Public Safety" },
  { value: "technology", label: "Technology" },
  { value: "fiscal", label: "Fiscal" },
  { value: "labor", label: "Labor" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "veterans", label: "Veterans" },
  { value: "reproductive-rights", label: "Reproductive Rights" },
  { value: "social-security", label: "Social Security" },
  { value: "agriculture", label: "Agriculture" },
];

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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | "all">("all");
  const [partyLeaning, setPartyLeaning] = useState<PartyLeaning>("all");
  const [showFilters, setShowFilters] = useState(false);

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

    for (const b of filteredBriefings) {
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

  const filteredBriefings = briefings.filter((b) => {
    const q = searchQuery.toLowerCase();
    if (q && !b.title.toLowerCase().includes(q) && !b.summary.toLowerCase().includes(q) && !b.source_name.toLowerCase().includes(q)) return false;
    if (selectedCategory !== "all" && b.category !== selectedCategory) return false;
    if (partyLeaning === "left" && !LEFT_SOURCES.some(s => b.source_name.toLowerCase().includes(s.toLowerCase()))) return false;
    if (partyLeaning === "right" && !RIGHT_SOURCES.some(s => b.source_name.toLowerCase().includes(s.toLowerCase()))) return false;
    if (partyLeaning === "center") {
      const isLeft = LEFT_SOURCES.some(s => b.source_name.toLowerCase().includes(s.toLowerCase()));
      const isRight = RIGHT_SOURCES.some(s => b.source_name.toLowerCase().includes(s.toLowerCase()));
      if (isLeft || isRight) return false;
    }
    return true;
  });

  const groupedBySource = filteredBriefings.reduce<Record<string, Briefing[]>>((acc, b) => {
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

      {/* Search & Filters */}
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <div className="relative flex-1">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search articles by title, summary, or source..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-7 py-1 text-xs border border-[#808080] bg-white focus:outline-none focus:border-[#000080]"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={10} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-2 py-1 text-xs border flex items-center gap-1 ${
              showFilters || selectedCategory !== "all" || partyLeaning !== "all"
                ? "bg-[#000080] text-white border-[#000080]"
                : "bg-[#c0c0c0] text-black border-[#808080] hover:bg-[#d4d4d4]"
            }`}
          >
            <Filter size={12} />
            Filters
            {(selectedCategory !== "all" || partyLeaning !== "all") && (
              <span className="bg-white text-[#000080] text-[9px] px-1 rounded-sm font-bold">
                {(selectedCategory !== "all" ? 1 : 0) + (partyLeaning !== "all" ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="border border-[#808080] bg-[#f0f0f0] p-2 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-gray-600 w-12">Topic:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as Category | "all")}
                className="text-xs border border-[#808080] bg-white px-1 py-0.5 focus:outline-none"
              >
                <option value="all">All Topics</option>
                {CATEGORY_OPTIONS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-gray-600 w-12">Lean:</span>
              {(["all", "left", "center", "right"] as PartyLeaning[]).map((lean) => (
                <button
                  key={lean}
                  onClick={() => setPartyLeaning(lean)}
                  className={`px-2 py-0.5 text-[10px] font-bold border ${
                    partyLeaning === lean
                      ? lean === "left" ? "bg-blue-600 text-white border-blue-600"
                        : lean === "right" ? "bg-red-600 text-white border-red-600"
                        : lean === "center" ? "bg-purple-600 text-white border-purple-600"
                        : "bg-[#000080] text-white border-[#000080]"
                      : "bg-white text-black border-[#808080] hover:bg-[#e8e8e8]"
                  }`}
                >
                  {lean === "all" ? "All" : lean === "left" ? "🔵 Left" : lean === "right" ? "🔴 Right" : "🟣 Center"}
                </button>
              ))}
            </div>
            {(selectedCategory !== "all" || partyLeaning !== "all") && (
              <button
                onClick={() => { setSelectedCategory("all"); setPartyLeaning("all"); }}
                className="text-[10px] text-[#000080] underline hover:text-blue-700"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {(searchQuery || selectedCategory !== "all" || partyLeaning !== "all") && (
          <div className="text-[10px] text-gray-500">
            Showing {filteredBriefings.length} of {briefings.length} briefings
          </div>
        )}
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
      ) : filteredBriefings.length === 0 ? (
        <div className="text-xs text-gray-500 py-8 text-center">
          {briefings.length === 0
            ? `No briefings found for ${SCOPE_CONFIG[activeScope].label}. Click "Sync" to fetch latest intelligence.`
            : "No briefings match your search/filter criteria."}
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
                    <div className="text-[9px] text-gray-400 mt-0.5 flex items-center gap-1">
                      {b.published_at ? format(new Date(b.published_at), "PPp") : ""}
                      {b.category && b.category !== "general" && (
                        <span className="bg-[#e8e8ff] text-[#000080] px-1 rounded text-[8px] font-bold uppercase">{b.category}</span>
                      )}
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

              {loadingArticle ? (
                <div className="flex items-center gap-2 py-4 text-xs text-gray-500">
                  <Loader2 size={14} className="animate-spin" />
                  Loading full article...
                </div>
              ) : fullArticle ? (
                <div className="prose-research text-xs leading-relaxed">
                  <ReactMarkdown
                    components={{
                      a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#000080] underline hover:text-blue-700">
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {fullArticle}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="whitespace-pre-wrap text-xs leading-relaxed">
                  {selectedBriefing.content || selectedBriefing.summary || "No content available."}
                </div>
              )}

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
                    const contentText = fullArticle || selectedBriefing.content || selectedBriefing.summary || "";
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
