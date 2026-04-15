import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Win98Window } from "@/components/Win98Window";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { RefreshCw, FileText, Globe, MapPin, Landmark, Building2, ExternalLink, Clock, Loader2, Search, Filter, X, BarChart3, Tag, AlertTriangle, TrendingUp } from "lucide-react";
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

interface OpenWindow {
  briefing: Briefing;
  fullArticle: string | null;
  loadingArticle: boolean;
  posIndex: number;
}

const CATEGORY_OPTIONS: { value: Category; label: string; emoji: string }[] = [
  { value: "general", label: "General", emoji: "📰" },
  { value: "economy", label: "Economy", emoji: "💰" },
  { value: "elections", label: "Elections", emoji: "🗳️" },
  { value: "legal", label: "Legal", emoji: "⚖️" },
  { value: "defense", label: "Defense", emoji: "🛡️" },
  { value: "health", label: "Health", emoji: "🏥" },
  { value: "environment", label: "Environment", emoji: "🌿" },
  { value: "immigration", label: "Immigration", emoji: "🛂" },
  { value: "education", label: "Education", emoji: "🎓" },
  { value: "housing", label: "Housing", emoji: "🏠" },
  { value: "public-safety", label: "Public Safety", emoji: "🚔" },
  { value: "technology", label: "Technology", emoji: "💻" },
  { value: "fiscal", label: "Fiscal", emoji: "📊" },
  { value: "labor", label: "Labor", emoji: "👷" },
  { value: "infrastructure", label: "Infrastructure", emoji: "🏗️" },
  { value: "veterans", label: "Veterans", emoji: "🎖️" },
  { value: "reproductive-rights", label: "Reproductive Rights", emoji: "⚕️" },
  { value: "social-security", label: "Social Security", emoji: "🏦" },
  { value: "agriculture", label: "Agriculture", emoji: "🌾" },
];

const SCOPE_CONFIG: Record<Scope, { label: string; icon: React.ReactNode; emoji: string }> = {
  local: { label: "Local", icon: <MapPin size={14} />, emoji: "📍" },
  state: { label: "State", icon: <Landmark size={14} />, emoji: "🏛️" },
  national: { label: "National", icon: <Building2 size={14} />, emoji: "🇺🇸" },
  international: { label: "International", icon: <Globe size={14} />, emoji: "🌍" },
};

function getSourceLeaning(source: string): "left" | "right" | "center" {
  if (LEFT_SOURCES.some(s => source.toLowerCase().includes(s.toLowerCase()))) return "left";
  if (RIGHT_SOURCES.some(s => source.toLowerCase().includes(s.toLowerCase()))) return "right";
  return "center";
}

function categoryEmoji(cat: string): string {
  return CATEGORY_OPTIONS.find(c => c.value === cat)?.emoji || "📰";
}

function timeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
  return `${Math.round(diff / 86400000)}d ago`;
}

export function IntelHub() {
  const [activeScope, setActiveScope] = useState<Scope>("national");
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | "all">("all");
  const [partyLeaning, setPartyLeaning] = useState<PartyLeaning>("all");
  const [showFilters, setShowFilters] = useState(false);

  // Multiple open detail windows
  const [openWindows, setOpenWindows] = useState<Map<string, OpenWindow>>(new Map());
  // Source detail window
  const [sourceDetailName, setSourceDetailName] = useState<string | null>(null);
  // Category stats window
  const [showCategoryStats, setShowCategoryStats] = useState(false);
  // Scope overview window
  const [showScopeOverview, setShowScopeOverview] = useState(false);

  const fetchBriefings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("intel_briefings")
      .select("*")
      .eq("scope", activeScope)
      .order("published_at", { ascending: false })
      .limit(200);

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

  const openBriefingWindow = useCallback(async (b: Briefing) => {
    const existing = openWindows.get(b.id);
    if (existing) return; // already open

    const posIndex = openWindows.size;
    setOpenWindows(prev => {
      const next = new Map(prev);
      next.set(b.id, { briefing: b, fullArticle: null, loadingArticle: !!b.source_url, posIndex });
      return next;
    });

    if (b.source_url) {
      try {
        const { data, error } = await supabase.functions.invoke("scrape-article", {
          body: { url: b.source_url },
        });
        if (!error && data?.success && data.markdown) {
          setOpenWindows(prev => {
            const next = new Map(prev);
            const win = next.get(b.id);
            if (win) next.set(b.id, { ...win, fullArticle: data.markdown, loadingArticle: false });
            return next;
          });
          return;
        }
      } catch (e) {
        console.error("Failed to scrape article:", e);
      }
      setOpenWindows(prev => {
        const next = new Map(prev);
        const win = next.get(b.id);
        if (win) next.set(b.id, { ...win, loadingArticle: false });
        return next;
      });
    }
  }, [openWindows]);

  const closeBriefingWindow = useCallback((id: string) => {
    setOpenWindows(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const filteredBriefings = useMemo(() => briefings.filter((b) => {
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
  }), [briefings, searchQuery, selectedCategory, partyLeaning]);

  const groupedBySource = useMemo(() => filteredBriefings.reduce<Record<string, Briefing[]>>((acc, b) => {
    if (!acc[b.source_name]) acc[b.source_name] = [];
    acc[b.source_name].push(b);
    return acc;
  }, {}), [filteredBriefings]);

  // Stats
  const categoryBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of briefings) {
      counts[b.category] = (counts[b.category] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [briefings]);

  const sourceBreakdown = useMemo(() => {
    const counts: Record<string, { count: number; leaning: string; latestDate: string; categories: Set<string> }> = {};
    for (const b of briefings) {
      if (!counts[b.source_name]) {
        counts[b.source_name] = { count: 0, leaning: getSourceLeaning(b.source_name), latestDate: b.published_at || b.created_at, categories: new Set() };
      }
      counts[b.source_name].count++;
      counts[b.source_name].categories.add(b.category);
      const d = b.published_at || b.created_at;
      if (d > counts[b.source_name].latestDate) counts[b.source_name].latestDate = d;
    }
    return counts;
  }, [briefings]);

  const leaningCounts = useMemo(() => {
    let left = 0, right = 0, center = 0;
    for (const b of briefings) {
      const l = getSourceLeaning(b.source_name);
      if (l === "left") left++;
      else if (l === "right") right++;
      else center++;
    }
    return { left, right, center };
  }, [briefings]);

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
      if (y > 260) { doc.addPage(); y = 18; }
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
        doc.text(summaryLines.slice(0, 6), 15, y);
        y += summaryLines.slice(0, 6).length * 4 + 6;
      } else {
        y += 4;
      }
    }

    applyPdfBranding(doc);
    doc.save(`intel-briefing-${activeScope}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast.success("PDF exported");
  };

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

        <button onClick={() => setShowScopeOverview(true)} className="px-2 py-1 text-xs bg-[#c0c0c0] border border-[#808080] hover:bg-[#d4d4d4] flex items-center gap-1" title="Scope Overview">
          <TrendingUp size={12} /> Overview
        </button>
        <button onClick={() => setShowCategoryStats(true)} className="px-2 py-1 text-xs bg-[#c0c0c0] border border-[#808080] hover:bg-[#d4d4d4] flex items-center gap-1" title="Category Stats">
          <BarChart3 size={12} /> Stats
        </button>
        <button onClick={handleSync} disabled={syncing} className="px-2 py-1 text-xs bg-[#c0c0c0] border border-[#808080] hover:bg-[#d4d4d4] flex items-center gap-1 disabled:opacity-50">
          <RefreshCw size={12} className={syncing ? "animate-spin" : ""} /> Sync {SCOPE_CONFIG[activeScope].label}
        </button>
        <button onClick={handleSyncAll} disabled={syncing} className="px-2 py-1 text-xs bg-[#c0c0c0] border border-[#808080] hover:bg-[#d4d4d4] flex items-center gap-1 disabled:opacity-50">
          <RefreshCw size={12} className={syncing ? "animate-spin" : ""} /> Sync All
        </button>
        <button onClick={exportPDF} disabled={briefings.length === 0} className="px-2 py-1 text-xs bg-[#c0c0c0] border border-[#808080] hover:bg-[#d4d4d4] flex items-center gap-1 disabled:opacity-50">
          <FileText size={12} /> Export PDF
        </button>
      </div>

      {/* Quick Stats Bar */}
      {!loading && briefings.length > 0 && (
        <div className="win98-sunken bg-[hsl(var(--win98-light))] p-1.5 flex gap-3 flex-wrap text-[9px]">
          <span>📊 <b>{briefings.length}</b> briefings</span>
          <span>📰 <b>{Object.keys(groupedBySource).length}</b> sources</span>
          <span>🔵 <b>{leaningCounts.left}</b> left</span>
          <span>🟣 <b>{leaningCounts.center}</b> center</span>
          <span>🔴 <b>{leaningCounts.right}</b> right</span>
          <span>📁 <b>{categoryBreakdown.length}</b> categories</span>
          {lastUpdated && <span className="ml-auto">🕐 {timeSince(lastUpdated)}</span>}
        </div>
      )}

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
            <Filter size={12} /> Filters
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
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value as Category | "all")} className="text-xs border border-[#808080] bg-white px-1 py-0.5 focus:outline-none">
                <option value="all">All Topics</option>
                {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-gray-600 w-12">Lean:</span>
              {(["all", "left", "center", "right"] as PartyLeaning[]).map((lean) => (
                <button key={lean} onClick={() => setPartyLeaning(lean)}
                  className={`px-2 py-0.5 text-[10px] font-bold border ${
                    partyLeaning === lean
                      ? lean === "left" ? "bg-blue-600 text-white border-blue-600" : lean === "right" ? "bg-red-600 text-white border-red-600" : lean === "center" ? "bg-purple-600 text-white border-purple-600" : "bg-[#000080] text-white border-[#000080]"
                      : "bg-white text-black border-[#808080] hover:bg-[#e8e8e8]"
                  }`}>
                  {lean === "all" ? "All" : lean === "left" ? "🔵 Left" : lean === "right" ? "🔴 Right" : "🟣 Center"}
                </button>
              ))}
            </div>
            {(selectedCategory !== "all" || partyLeaning !== "all") && (
              <button onClick={() => { setSelectedCategory("all"); setPartyLeaning("all"); }} className="text-[10px] text-[#000080] underline hover:text-blue-700">Clear all filters</button>
            )}
          </div>
        )}

        {(searchQuery || selectedCategory !== "all" || partyLeaning !== "all") && (
          <div className="text-[10px] text-gray-500">Showing {filteredBriefings.length} of {briefings.length} briefings</div>
        )}
      </div>

      {/* Briefing List */}
      {loading ? (
        <div className="text-xs text-gray-500 py-8 text-center flex items-center justify-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading intelligence briefings...
        </div>
      ) : filteredBriefings.length === 0 ? (
        <div className="text-xs text-gray-500 py-8 text-center">
          {briefings.length === 0
            ? `No briefings found for ${SCOPE_CONFIG[activeScope].label}. Click "Sync" to fetch latest intelligence.`
            : "No briefings match your search/filter criteria."}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedBySource).map(([source, items]) => {
            const leaning = getSourceLeaning(source);
            return (
              <div key={source} className="border border-[#808080] bg-white">
                <button
                  onClick={() => setSourceDetailName(source)}
                  className="w-full bg-[#000080] text-white px-2 py-1 text-xs font-bold flex items-center gap-1 hover:bg-[#0000a0] transition-colors text-left"
                >
                  <Globe size={12} />
                  {source}
                  {leaning !== "center" && (
                    <span className={`text-[8px] px-1 rounded ${leaning === "left" ? "bg-blue-400" : "bg-red-400"}`}>
                      {leaning === "left" ? "L" : "R"}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] opacity-75">{items.length} items</span>
                </button>
                <div className="divide-y divide-[#c0c0c0]">
                  {items.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => openBriefingWindow(b)}
                      className="w-full text-left px-2 py-1.5 hover:bg-[#e8e8ff] transition-colors"
                    >
                      <div className="flex items-start gap-1">
                        <span className="text-[10px] mt-0.5">{categoryEmoji(b.category)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-[#000080] line-clamp-1">{b.title}</div>
                          {b.summary && <div className="text-[10px] text-gray-600 line-clamp-2 mt-0.5">{b.summary}</div>}
                          <div className="text-[9px] text-gray-400 mt-0.5 flex items-center gap-1 flex-wrap">
                            {b.published_at && <span>{timeSince(b.published_at)}</span>}
                            {b.category && b.category !== "general" && (
                              <span className="bg-[#e8e8ff] text-[#000080] px-1 rounded text-[8px] font-bold uppercase">{b.category}</span>
                            )}
                            {b.region && <span className="bg-gray-100 text-gray-600 px-1 rounded text-[8px]">{b.region}</span>}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Briefing Detail Windows ───────────────────────────────── */}
      {Array.from(openWindows.entries()).map(([id, win]) => (
        <BriefingDetailWindow
          key={id}
          win={win}
          allBriefings={briefings}
          onClose={() => closeBriefingWindow(id)}
        />
      ))}

      {/* ─── Source Detail Window ──────────────────────────────────── */}
      {sourceDetailName && (
        <SourceDetailWindow
          sourceName={sourceDetailName}
          briefings={briefings.filter(b => b.source_name === sourceDetailName)}
          allBriefings={briefings}
          onClose={() => setSourceDetailName(null)}
          onOpenBriefing={openBriefingWindow}
        />
      )}

      {/* ─── Category Stats Window ────────────────────────────────── */}
      {showCategoryStats && (
        <CategoryStatsWindow
          briefings={briefings}
          categoryBreakdown={categoryBreakdown}
          scope={activeScope}
          onClose={() => setShowCategoryStats(false)}
          onFilterCategory={(cat) => { setSelectedCategory(cat as Category); setShowCategoryStats(false); }}
        />
      )}

      {/* ─── Scope Overview Window ────────────────────────────────── */}
      {showScopeOverview && (
        <ScopeOverviewWindow
          briefings={briefings}
          scope={activeScope}
          sourceBreakdown={sourceBreakdown}
          leaningCounts={leaningCounts}
          onClose={() => setShowScopeOverview(false)}
          onOpenSource={setSourceDetailName}
        />
      )}
    </div>
  );
}

// ─── Briefing Detail Window ────────────────────────────────────────────────

function BriefingDetailWindow({ win, allBriefings, onClose }: {
  win: OpenWindow;
  allBriefings: Briefing[];
  onClose: () => void;
}) {
  const b = win.briefing;
  const leaning = getSourceLeaning(b.source_name);
  const contentText = win.fullArticle || b.content || b.summary || "";
  const wordCount = contentText.split(/\s+/).filter(Boolean).length;
  const relatedBriefings = allBriefings.filter(x => x.id !== b.id && x.category === b.category).slice(0, 5);
  const sameSrc = allBriefings.filter(x => x.id !== b.id && x.source_name === b.source_name).slice(0, 5);

  const exportSinglePDF = () => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.width;
    let y = 18;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    const titleLines = doc.splitTextToSize(b.title, pw - 30);
    doc.text(titleLines, 15, y);
    y += titleLines.length * 6 + 4;
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text(`${b.source_name} • ${b.published_at ? format(new Date(b.published_at), "PPp") : ""}`, 15, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const cLines = doc.splitTextToSize(contentText, pw - 30);
    doc.text(cLines, 15, y);
    applyPdfBranding(doc);
    doc.save(`intel-brief-${b.id.substring(0, 8)}.pdf`);
    toast.success("PDF exported");
  };

  return (
    <Win98Window
      title={`📄 ${b.source_name} — Intel Brief`}
      icon={<span className="text-[14px]">📰</span>}
      onClose={onClose}
      defaultSize={{ width: 640, height: 500 }}
      defaultPosition={{ x: 80 + win.posIndex * 30, y: 40 + win.posIndex * 30 }}
      minSize={{ width: 400, height: 300 }}
      statusBar={<span className="text-[9px]">{wordCount.toLocaleString()} words · {b.id.slice(0, 8)}</span>}
    >
      <div className="overflow-y-auto h-full p-3 bg-white text-xs space-y-3">
        {/* Header */}
        <div>
          <h2 className="text-sm font-bold text-[#000080] mb-1">{b.title}</h2>
          <div className="text-[10px] text-gray-500 flex items-center gap-2 flex-wrap">
            <span className="font-bold">{b.source_name}</span>
            <span className={`px-1 rounded text-[8px] font-bold ${leaning === "left" ? "bg-blue-100 text-blue-800" : leaning === "right" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"}`}>
              {leaning === "left" ? "🔵 Left" : leaning === "right" ? "🔴 Right" : "🟣 Center"}
            </span>
            <span>•</span>
            <span>{b.published_at ? format(new Date(b.published_at), "PPpp") : "Unknown date"}</span>
            {b.published_at && <span className="text-gray-400">({timeSince(b.published_at)})</span>}
          </div>
        </div>

        {/* Metadata */}
        <div className="win98-sunken bg-[hsl(var(--win98-light))] p-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
          <div><b>Scope:</b> <span className="uppercase bg-[#000080] text-white px-1 rounded text-[8px]">{b.scope}</span></div>
          <div><b>Category:</b> {categoryEmoji(b.category)} {b.category}</div>
          {b.region && <div><b>Region:</b> {b.region}</div>}
          <div><b>Created:</b> {format(new Date(b.created_at), "PPp")}</div>
          <div><b>Words:</b> {wordCount.toLocaleString()}</div>
          <div><b>Briefing ID:</b> <span className="font-mono text-[8px]">{b.id.slice(0, 12)}…</span></div>
        </div>

        {/* Summary */}
        {b.summary && (
          <div className="bg-[#ffffcc] border border-[#e6e6a0] p-2 text-xs italic">{b.summary}</div>
        )}

        {/* Content */}
        {win.loadingArticle ? (
          <div className="flex items-center gap-2 py-4 text-xs text-gray-500">
            <Loader2 size={14} className="animate-spin" /> Loading full article...
          </div>
        ) : win.fullArticle ? (
          <div className="prose-research text-xs leading-relaxed">
            <ReactMarkdown components={{
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#000080] underline hover:text-blue-700">{children}</a>
              ),
            }}>{win.fullArticle}</ReactMarkdown>
          </div>
        ) : (
          <div className="whitespace-pre-wrap text-xs leading-relaxed">{b.content || b.summary || "No content available."}</div>
        )}

        {/* Related from same category */}
        {relatedBriefings.length > 0 && (
          <div>
            <div className="text-[10px] font-bold border-b border-gray-300 pb-0.5 mb-1">{categoryEmoji(b.category)} Related ({b.category})</div>
            <div className="space-y-0.5">
              {relatedBriefings.map(r => (
                <div key={r.id} className="text-[9px] text-gray-600 truncate">• {r.title} <span className="text-gray-400">({r.source_name})</span></div>
              ))}
            </div>
          </div>
        )}

        {/* More from same source */}
        {sameSrc.length > 0 && (
          <div>
            <div className="text-[10px] font-bold border-b border-gray-300 pb-0.5 mb-1">📰 More from {b.source_name}</div>
            <div className="space-y-0.5">
              {sameSrc.map(r => (
                <div key={r.id} className="text-[9px] text-gray-600 truncate">• {r.title}</div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="pt-2 border-t border-[#c0c0c0] flex items-center gap-2">
          {b.source_url && (
            <a href={b.source_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#000080] underline flex items-center gap-1 hover:text-blue-700">
              <ExternalLink size={10} /> Read original
            </a>
          )}
          <div className="flex-1" />
          <button onClick={exportSinglePDF} className="px-2 py-1 text-[10px] bg-[#c0c0c0] border border-[#808080] hover:bg-[#d4d4d4] flex items-center gap-1">
            <FileText size={10} /> Export PDF
          </button>
        </div>
      </div>
    </Win98Window>
  );
}

// ─── Source Detail Window ──────────────────────────────────────────────────

function SourceDetailWindow({ sourceName, briefings, allBriefings, onClose, onOpenBriefing }: {
  sourceName: string;
  briefings: Briefing[];
  allBriefings: Briefing[];
  onClose: () => void;
  onOpenBriefing: (b: Briefing) => void;
}) {
  const leaning = getSourceLeaning(sourceName);
  const categories = useMemo(() => {
    const c: Record<string, number> = {};
    for (const b of briefings) c[b.category] = (c[b.category] || 0) + 1;
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [briefings]);

  const regions = useMemo(() => {
    const r: Record<string, number> = {};
    for (const b of briefings) {
      if (b.region) r[b.region] = (r[b.region] || 0) + 1;
    }
    return Object.entries(r).sort((a, b) => b[1] - a[1]);
  }, [briefings]);

  const earliest = briefings.length > 0 ? briefings[briefings.length - 1] : null;
  const latest = briefings.length > 0 ? briefings[0] : null;
  const totalSources = new Set(allBriefings.map(b => b.source_name)).size;
  const rank = Object.entries(
    allBriefings.reduce<Record<string, number>>((acc, b) => { acc[b.source_name] = (acc[b.source_name] || 0) + 1; return acc; }, {})
  ).sort((a, b) => b[1] - a[1]).findIndex(([n]) => n === sourceName) + 1;

  return (
    <Win98Window
      title={`📰 Source: ${sourceName}`}
      icon={<Globe className="h-3.5 w-3.5" />}
      onClose={onClose}
      defaultSize={{ width: 500, height: 450 }}
      defaultPosition={{ x: 160, y: 80 }}
      minSize={{ width: 350, height: 250 }}
      statusBar={<span className="text-[9px]">{briefings.length} briefings</span>}
    >
      <div className="overflow-y-auto h-full p-3 bg-white text-[10px] space-y-3">
        <div className="text-sm font-bold text-[#000080]">{sourceName}</div>

        <div className="win98-sunken bg-[hsl(var(--win98-light))] p-2 grid grid-cols-2 gap-x-4 gap-y-1">
          <div><b>Leaning:</b> <span className={`px-1 rounded text-[8px] font-bold ${leaning === "left" ? "bg-blue-100 text-blue-800" : leaning === "right" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"}`}>{leaning === "left" ? "🔵 Left" : leaning === "right" ? "🔴 Right" : "🟣 Center"}</span></div>
          <div><b>Articles:</b> {briefings.length}</div>
          <div><b>Rank:</b> #{rank} of {totalSources}</div>
          <div><b>Categories:</b> {categories.length}</div>
          {earliest?.published_at && <div><b>Earliest:</b> {format(new Date(earliest.published_at), "PP")}</div>}
          {latest?.published_at && <div><b>Latest:</b> {format(new Date(latest.published_at), "PP")} ({timeSince(latest.published_at)})</div>}
        </div>

        {/* Category breakdown */}
        <div>
          <div className="font-bold border-b border-gray-300 pb-0.5 mb-1">📁 Coverage by Category</div>
          <div className="space-y-0.5">
            {categories.map(([cat, count]) => (
              <div key={cat} className="flex items-center gap-1">
                <span>{categoryEmoji(cat)}</span>
                <span className="flex-1 capitalize">{cat}</span>
                <div className="w-24 h-2 bg-gray-200 rounded overflow-hidden">
                  <div className="h-full bg-[#000080] rounded" style={{ width: `${(count / briefings.length) * 100}%` }} />
                </div>
                <span className="text-[9px] w-6 text-right font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Regional breakdown */}
        {regions.length > 0 && (
          <div>
            <div className="font-bold border-b border-gray-300 pb-0.5 mb-1">🌍 Regions Covered</div>
            <div className="flex flex-wrap gap-1">
              {regions.map(([region, count]) => (
                <span key={region} className="bg-[#e8e8ff] text-[#000080] px-1.5 py-0.5 rounded text-[9px]">{region} ({count})</span>
              ))}
            </div>
          </div>
        )}

        {/* Recent articles */}
        <div>
          <div className="font-bold border-b border-gray-300 pb-0.5 mb-1">📄 Recent Articles</div>
          <div className="space-y-1">
            {briefings.slice(0, 15).map(b => (
              <button key={b.id} onClick={() => onOpenBriefing(b)} className="w-full text-left hover:bg-[#e8e8ff] px-1 py-0.5 rounded transition-colors">
                <div className="text-[10px] font-bold text-[#000080] truncate">{b.title}</div>
                <div className="text-[9px] text-gray-400">{categoryEmoji(b.category)} {b.category} · {b.published_at ? timeSince(b.published_at) : ""}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Win98Window>
  );
}

// ─── Category Stats Window ─────────────────────────────────────────────────

function CategoryStatsWindow({ briefings, categoryBreakdown, scope, onClose, onFilterCategory }: {
  briefings: Briefing[];
  categoryBreakdown: [string, number][];
  scope: Scope;
  onClose: () => void;
  onFilterCategory: (cat: string) => void;
}) {
  const total = briefings.length;
  const topSources = useMemo(() => {
    const c: Record<string, number> = {};
    for (const b of briefings) c[b.source_name] = (c[b.source_name] || 0) + 1;
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [briefings]);

  return (
    <Win98Window
      title={`📊 Category Stats — ${SCOPE_CONFIG[scope].label}`}
      icon={<BarChart3 className="h-3.5 w-3.5" />}
      onClose={onClose}
      defaultSize={{ width: 480, height: 420 }}
      defaultPosition={{ x: 200, y: 60 }}
      minSize={{ width: 350, height: 250 }}
      statusBar={<span className="text-[9px]">{total} briefings across {categoryBreakdown.length} categories</span>}
    >
      <div className="overflow-y-auto h-full p-3 bg-white text-[10px] space-y-3">
        <div className="text-sm font-bold text-[#000080]">{SCOPE_CONFIG[scope].emoji} {SCOPE_CONFIG[scope].label} Intelligence — Category Breakdown</div>

        <div className="space-y-1">
          {categoryBreakdown.map(([cat, count]) => (
            <button key={cat} onClick={() => onFilterCategory(cat)} className="w-full flex items-center gap-1 hover:bg-[#e8e8ff] px-1 py-0.5 rounded transition-colors">
              <span>{categoryEmoji(cat)}</span>
              <span className="flex-1 capitalize text-left">{cat}</span>
              <div className="w-32 h-3 bg-gray-200 rounded overflow-hidden">
                <div className="h-full bg-[#000080] rounded" style={{ width: `${(count / total) * 100}%` }} />
              </div>
              <span className="w-6 text-right font-bold">{count}</span>
              <span className="w-8 text-right text-gray-400">{((count / total) * 100).toFixed(0)}%</span>
            </button>
          ))}
        </div>

        <div>
          <div className="font-bold border-b border-gray-300 pb-0.5 mb-1">🏆 Top Sources</div>
          <div className="space-y-0.5">
            {topSources.map(([src, count], i) => {
              const l = getSourceLeaning(src);
              return (
                <div key={src} className="flex items-center gap-1">
                  <span className="w-4 text-right text-gray-400 font-bold">{i + 1}.</span>
                  <span className="flex-1 truncate">{src}</span>
                  <span className={`px-1 rounded text-[8px] font-bold ${l === "left" ? "bg-blue-100 text-blue-800" : l === "right" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"}`}>{l[0].toUpperCase()}</span>
                  <span className="font-bold w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Win98Window>
  );
}

// ─── Scope Overview Window ─────────────────────────────────────────────────

function ScopeOverviewWindow({ briefings, scope, sourceBreakdown, leaningCounts, onClose, onOpenSource }: {
  briefings: Briefing[];
  scope: Scope;
  sourceBreakdown: Record<string, { count: number; leaning: string; latestDate: string; categories: Set<string> }>;
  leaningCounts: { left: number; right: number; center: number };
  onClose: () => void;
  onOpenSource: (name: string) => void;
}) {
  const total = briefings.length;
  const sources = Object.entries(sourceBreakdown).sort((a, b) => b[1].count - a[1].count);
  const uniqueRegions = useMemo(() => {
    const r = new Set<string>();
    for (const b of briefings) if (b.region) r.add(b.region);
    return Array.from(r).sort();
  }, [briefings]);

  const dateRange = useMemo(() => {
    const dates = briefings.filter(b => b.published_at).map(b => new Date(b.published_at!).getTime());
    if (dates.length === 0) return null;
    return { min: new Date(Math.min(...dates)), max: new Date(Math.max(...dates)) };
  }, [briefings]);

  return (
    <Win98Window
      title={`${SCOPE_CONFIG[scope].emoji} ${SCOPE_CONFIG[scope].label} Overview`}
      icon={<TrendingUp className="h-3.5 w-3.5" />}
      onClose={onClose}
      defaultSize={{ width: 520, height: 460 }}
      defaultPosition={{ x: 140, y: 50 }}
      minSize={{ width: 350, height: 250 }}
      statusBar={<span className="text-[9px]">{total} briefings · {sources.length} sources · {uniqueRegions.length} regions</span>}
    >
      <div className="overflow-y-auto h-full p-3 bg-white text-[10px] space-y-3">
        <div className="text-sm font-bold text-[#000080]">{SCOPE_CONFIG[scope].emoji} {SCOPE_CONFIG[scope].label} Intelligence Overview</div>

        {/* Key metrics */}
        <div className="win98-sunken bg-[hsl(var(--win98-light))] p-2 grid grid-cols-3 gap-2 text-center">
          <div className="border border-gray-300 bg-white p-1.5 rounded">
            <div className="text-lg font-bold text-[#000080]">{total}</div>
            <div className="text-[9px] text-gray-500">Briefings</div>
          </div>
          <div className="border border-gray-300 bg-white p-1.5 rounded">
            <div className="text-lg font-bold text-[#000080]">{sources.length}</div>
            <div className="text-[9px] text-gray-500">Sources</div>
          </div>
          <div className="border border-gray-300 bg-white p-1.5 rounded">
            <div className="text-lg font-bold text-[#000080]">{uniqueRegions.length}</div>
            <div className="text-[9px] text-gray-500">Regions</div>
          </div>
        </div>

        {/* Partisan balance */}
        <div>
          <div className="font-bold border-b border-gray-300 pb-0.5 mb-1">⚖️ Partisan Balance</div>
          <div className="flex items-center gap-1 h-4">
            {leaningCounts.left > 0 && <div className="bg-blue-500 h-full rounded-l" style={{ width: `${(leaningCounts.left / total) * 100}%` }} title={`Left: ${leaningCounts.left}`} />}
            {leaningCounts.center > 0 && <div className="bg-purple-400 h-full" style={{ width: `${(leaningCounts.center / total) * 100}%` }} title={`Center: ${leaningCounts.center}`} />}
            {leaningCounts.right > 0 && <div className="bg-red-500 h-full rounded-r" style={{ width: `${(leaningCounts.right / total) * 100}%` }} title={`Right: ${leaningCounts.right}`} />}
          </div>
          <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
            <span>🔵 {leaningCounts.left} left ({((leaningCounts.left / total) * 100).toFixed(0)}%)</span>
            <span>🟣 {leaningCounts.center} center ({((leaningCounts.center / total) * 100).toFixed(0)}%)</span>
            <span>🔴 {leaningCounts.right} right ({((leaningCounts.right / total) * 100).toFixed(0)}%)</span>
          </div>
        </div>

        {/* Date range */}
        {dateRange && (
          <div className="text-[9px] text-gray-500">
            📅 Coverage: {format(dateRange.min, "PP")} — {format(dateRange.max, "PP")}
          </div>
        )}

        {/* All sources */}
        <div>
          <div className="font-bold border-b border-gray-300 pb-0.5 mb-1">📰 All Sources ({sources.length})</div>
          <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
            {sources.map(([name, info]) => (
              <button key={name} onClick={() => onOpenSource(name)} className="w-full flex items-center gap-1 hover:bg-[#e8e8ff] px-1 py-0.5 rounded transition-colors text-left">
                <span className={`w-2 h-2 rounded-full shrink-0 ${info.leaning === "left" ? "bg-blue-500" : info.leaning === "right" ? "bg-red-500" : "bg-purple-400"}`} />
                <span className="flex-1 truncate">{name}</span>
                <span className="text-[9px] text-gray-400">{info.categories.size} topics</span>
                <span className="font-bold w-6 text-right">{info.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Regions */}
        {uniqueRegions.length > 0 && (
          <div>
            <div className="font-bold border-b border-gray-300 pb-0.5 mb-1">🌍 Regions</div>
            <div className="flex flex-wrap gap-1">
              {uniqueRegions.map(r => (
                <span key={r} className="bg-[#e8e8ff] text-[#000080] px-1.5 py-0.5 rounded text-[9px]">{r}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Win98Window>
  );
}

function getSourceLeaning(source: string): "left" | "right" | "center" {
  if (LEFT_SOURCES.some(s => source.toLowerCase().includes(s.toLowerCase()))) return "left";
  if (RIGHT_SOURCES.some(s => source.toLowerCase().includes(s.toLowerCase()))) return "right";
  return "center";
}

function categoryEmoji(cat: string): string {
  const CATEGORY_EMOJIS: Record<string, string> = {
    general: "📰", economy: "💰", elections: "🗳️", legal: "⚖️", defense: "🛡️",
    health: "🏥", environment: "🌿", immigration: "🛂", education: "🎓",
    housing: "🏠", "public-safety": "🚔", technology: "💻", fiscal: "📊",
    labor: "👷", infrastructure: "🏗️", veterans: "🎖️",
    "reproductive-rights": "⚕️", "social-security": "🏦", agriculture: "🌾",
  };
  return CATEGORY_EMOJIS[cat] || "📰";
}

function timeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
  return `${Math.round(diff / 86400000)}d ago`;
}
