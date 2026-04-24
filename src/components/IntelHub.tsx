import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, FileText, Globe, MapPin, Landmark, Building2, Clock, Search, Filter, X, Layers, AlertTriangle, CheckSquare, Square } from "lucide-react";
import { format } from "date-fns";
import { STATE_ABBR_TO_NAME } from "@/lib/stateAbbreviations";
import { exportArticlePdf, exportArticlesPdf, type IntelArticleForPdf } from "@/lib/intelPdf";
import { GroundNewsDetailWindow } from "@/components/GroundNewsDetailWindow";
import { clusterArticles, classifyBias, BIAS_META, biasBarSegments, type StoryCluster, type ClusterableArticle } from "@/lib/newsBias";
import { BlindspotFeed } from "@/components/intel/BlindspotFeed";
import { MyNewsBias } from "@/components/intel/MyNewsBias";
import { UrlBiasCheck } from "@/components/intel/UrlBiasCheck";
import { NewsPreferences } from "@/components/intel/NewsPreferences";

type IntelTab = "feed" | "blindspots" | "my-bias" | "url-check" | "preferences";

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

const TABS: { value: IntelTab; label: string; emoji: string }[] = [
  { value: "feed", label: "Feed", emoji: "📰" },
  { value: "blindspots", label: "Blindspots", emoji: "🕳️" },
  { value: "my-bias", label: "My Bias", emoji: "📊" },
  { value: "url-check", label: "URL Check", emoji: "🔍" },
  { value: "preferences", label: "Preferences", emoji: "⚙️" },
];

export function IntelHub() {
  const [activeTab, setActiveTab] = useState<IntelTab>("feed");
  const [activeScope, setActiveScope] = useState<Scope>("national");
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<StoryCluster<ClusterableArticle> | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | "all">("all");
  const [partyLeaning, setPartyLeaning] = useState<PartyLeaning>("all");
  const [selectedState, setSelectedState] = useState<string>(() => {
    if (typeof window === "undefined") return "all";
    return localStorage.getItem("intelhub.local.selectedState") || "all";
  });

  // Persist the selected state (local scope only) per browser
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedState === "all") {
      localStorage.removeItem("intelhub.local.selectedState");
    } else {
      localStorage.setItem("intelhub.local.selectedState", selectedState);
    }
  }, [selectedState]);

  // Reset state filter automatically when leaving the local scope; restore last
  // remembered state when returning to local.
  useEffect(() => {
    if (activeScope !== "local") {
      setSelectedState("all");
    } else if (typeof window !== "undefined") {
      const remembered = localStorage.getItem("intelhub.local.selectedState");
      if (remembered) setSelectedState(remembered);
    }
  }, [activeScope]);
  const [showFilters, setShowFilters] = useState(false);
  const [groupMode, setGroupMode] = useState<"clusters" | "sources">("clusters");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [lastSyncStats, setLastSyncStats] = useState<{
    scope: Scope | "all";
    fetched: number;
    inserted: number;
    insertedLocal: number;
    stateTaggedSources: number;
    sourcesByScope: Record<string, number>;
    at: string;
  } | null>(null);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Track article read for "My Bias" history
  const trackRead = useCallback(async (cluster: StoryCluster<ClusterableArticle>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const lead = cluster.lead;
      const biasKey = classifyBias(lead.source);
      const biasMap: Record<string, string> = {
        L: "left", LL: "lean-left", C: "center", LR: "lean-right", R: "right", U: "unknown",
      };
      await (supabase.from("user_bias_history" as any) as any).insert({
        user_id: user.id,
        source_name: lead.source,
        bias: biasMap[biasKey] || "unknown",
        article_title: lead.title,
        article_url: lead.link || null,
      });
    } catch (e) {
      // Silent fail – tracking shouldn't block UX
    }
  }, []);

  const openCluster = useCallback((c: StoryCluster<ClusterableArticle>) => {
    setSelectedCluster(c);
    trackRead(c);
  }, [trackRead]);

  const fetchBriefings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("intel_briefings")
      .select("*")
      .eq("scope", activeScope)
      .order("published_at", { ascending: false })
      .limit(300);

    if (error) {
      console.error("Error fetching briefings:", error);
    } else {
      setBriefings((data as Briefing[]) || []);
      if (data && data.length > 0) {
        // Use the most recent created_at (sync time), not the first row
        // which is sorted by published_at and may be older.
        const latest = (data as Briefing[]).reduce(
          (max, b) => (b.created_at > max ? b.created_at : max),
          (data as Briefing[])[0].created_at,
        );
        setLastUpdated(latest);
      }
    }
    setLoading(false);
  }, [activeScope]);

  useEffect(() => {
    fetchBriefings();
  }, [fetchBriefings]);

  const recordSyncStats = (data: any, scope: Scope | "all") => {
    if (!data) return;
    setLastSyncStats({
      scope,
      fetched: data.fetched ?? data.count ?? 0,
      inserted: data.inserted ?? 0,
      insertedLocal: data.inserted_local ?? 0,
      stateTaggedSources: data.state_tagged_sources ?? 0,
      sourcesByScope: data.sources_by_scope ?? {},
      at: new Date().toISOString(),
    });
  };

  const handleSync = async () => {
    setSyncing(true);
    toast.info("Syncing intelligence briefings...");
    try {
      const { data, error } = await supabase.functions.invoke("intel-briefing", {
        body: { scopes: [activeScope] },
      });
      if (error) throw error;
      recordSyncStats(data, activeScope);
      const newCount = data?.inserted ?? 0;
      toast.success(`Synced ${data?.fetched ?? data?.count ?? 0} fetched · ${newCount} new`);
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
      recordSyncStats(data, "all");
      toast.success(`Synced ${data?.fetched ?? data?.count ?? 0} fetched · ${data?.inserted ?? 0} new`);
      await fetchBriefings();
    } catch (e) {
      console.error("Sync error:", e);
      toast.error("Failed to sync briefings");
    } finally {
      setSyncing(false);
    }
  };

  /** Fetch the full scraped article body for one briefing. */
  const fetchFullContent = async (b: Briefing): Promise<string | null> => {
    if (!b.source_url) return null;
    try {
      const { data, error } = await supabase.functions.invoke("scrape-article", {
        body: { url: b.source_url },
      });
      if (error || !data?.success) return null;
      return typeof data.markdown === "string" && data.markdown.trim().length > 0
        ? data.markdown
        : null;
    } catch {
      return null;
    }
  };

  const briefingToArticle = (b: Briefing, content: string | null): IntelArticleForPdf => ({
    title: b.title,
    source: b.source_name,
    pubDate: b.published_at,
    link: b.source_url,
    summary: b.summary,
    content,
  });

  /** Export the currently-selected briefings (or all filtered if none selected). */
  const exportPDF = async () => {
    const targets = selectedIds.size > 0
      ? filteredBriefings.filter((b) => selectedIds.has(b.id))
      : filteredBriefings;

    if (targets.length === 0) {
      toast.error("Nothing to export");
      return;
    }

    setExporting(true);
    const label = targets.length === 1 ? "article" : `${targets.length} articles`;
    const t = toast.loading(`Building PDF — fetching full content for ${label}…`);

    try {
      // Fetch full articles in parallel (cap concurrency to be polite).
      const articles: IntelArticleForPdf[] = [];
      const CHUNK = 4;
      for (let i = 0; i < targets.length; i += CHUNK) {
        const batch = targets.slice(i, i + CHUNK);
        const results = await Promise.all(batch.map(async (b) => briefingToArticle(b, await fetchFullContent(b))));
        articles.push(...results);
      }

      const filename = targets.length === 1
        ? `intel-${activeScope}-${format(new Date(), "yyyy-MM-dd")}.pdf`
        : `intel-briefings-${activeScope}-${format(new Date(), "yyyy-MM-dd")}.pdf`;

      if (articles.length === 1) {
        exportArticlePdf(articles[0], filename);
      } else {
        exportArticlesPdf(articles, filename);
      }
      toast.success(`Exported ${articles.length} ${articles.length === 1 ? "article" : "articles"}`, { id: t });
      clearSelection();
      setSelectionMode(false);
    } catch (e) {
      console.error("Export error:", e);
      toast.error("PDF export failed", { id: t });
    } finally {
      setExporting(false);
    }
  };

  const filteredBriefings = briefings.filter((b) => {
    const q = searchQuery.toLowerCase();
    if (q && !b.title.toLowerCase().includes(q) && !b.summary.toLowerCase().includes(q) && !b.source_name.toLowerCase().includes(q)) return false;
    if (selectedCategory !== "all" && b.category !== selectedCategory) return false;
    if (activeScope === "local" && selectedState !== "all" && b.region !== selectedState) return false;
    if (partyLeaning === "left" && !LEFT_SOURCES.some(s => b.source_name.toLowerCase().includes(s.toLowerCase()))) return false;
    if (partyLeaning === "right" && !RIGHT_SOURCES.some(s => b.source_name.toLowerCase().includes(s.toLowerCase()))) return false;
    if (partyLeaning === "center") {
      const isLeft = LEFT_SOURCES.some(s => b.source_name.toLowerCase().includes(s.toLowerCase()));
      const isRight = RIGHT_SOURCES.some(s => b.source_name.toLowerCase().includes(s.toLowerCase()));
      if (isLeft || isRight) return false;
    }
    return true;
  });

  // States actually present in current Local briefings (sorted alpha by name)
  const availableStates = useMemo(() => {
    if (activeScope !== "local") return [] as string[];
    const set = new Set<string>();
    for (const b of briefings) if (b.region) set.add(b.region);
    return Array.from(set).sort((a, b) =>
      (STATE_ABBR_TO_NAME[a] ?? a).localeCompare(STATE_ABBR_TO_NAME[b] ?? b),
    );
  }, [briefings, activeScope]);

  const groupedBySource = filteredBriefings.reduce<Record<string, Briefing[]>>((acc, b) => {
    if (!acc[b.source_name]) acc[b.source_name] = [];
    acc[b.source_name].push(b);
    return acc;
  }, {});

  const clusters = clusterArticles(
    filteredBriefings.map((b) => ({
      title: b.title,
      source: b.source_name,
      link: b.source_url ?? undefined,
      pubDate: b.published_at ?? undefined,
      summary: b.summary,
      id: b.id,
    })),
  );

  return (
    <div className="space-y-3">
      {/* Top-level Tabs */}
      <div className="flex items-center gap-1 flex-wrap border-b border-[#808080] pb-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setActiveTab(t.value)}
            className={`px-3 py-1 text-xs font-bold border ${
              activeTab === t.value
                ? "bg-[#000080] text-white border-[#000080]"
                : "bg-[#c0c0c0] text-black border-[#808080] hover:bg-[#d4d4d4]"
            }`}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {activeTab === "blindspots" && <BlindspotFeed />}
      {activeTab === "my-bias" && <MyNewsBias />}
      {activeTab === "url-check" && <UrlBiasCheck />}
      {activeTab === "preferences" && <NewsPreferences />}

      {activeTab === "feed" && (<>
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
          onClick={() => {
            setSelectionMode((s) => {
              if (s) clearSelection();
              return !s;
            });
          }}
          className={`px-2 py-1 text-xs border flex items-center gap-1 ${
            selectionMode
              ? "bg-[#000080] text-white border-[#000080]"
              : "bg-[#c0c0c0] text-black border-[#808080] hover:bg-[#d4d4d4]"
          }`}
          title="Toggle multi-select to pick specific articles to export"
        >
          {selectionMode ? <CheckSquare size={12} /> : <Square size={12} />}
          {selectionMode ? `Selected ${selectedIds.size}` : "Select"}
        </button>

        <button
          onClick={exportPDF}
          disabled={briefings.length === 0 || exporting}
          className="px-2 py-1 text-xs bg-[#c0c0c0] border border-[#808080] hover:bg-[#d4d4d4] flex items-center gap-1 disabled:opacity-50"
          title={selectedIds.size > 0
            ? `Export ${selectedIds.size} selected article${selectedIds.size === 1 ? "" : "s"} (full content)`
            : "Export all filtered articles (full content)"}
        >
          <FileText size={12} />
          {exporting
            ? "Exporting…"
            : selectedIds.size > 0
              ? `Export PDF (${selectedIds.size})`
              : "Export PDF (All)"}
        </button>

        <button
          onClick={() => setGroupMode(groupMode === "clusters" ? "sources" : "clusters")}
          className="px-2 py-1 text-xs bg-[#c0c0c0] border border-[#808080] hover:bg-[#d4d4d4] flex items-center gap-1"
          title="Toggle between story clusters and source groups"
        >
          <Layers size={12} />
          {groupMode === "clusters" ? "By Story" : "By Source"}
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
            {activeScope === "local" && (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-gray-600 w-12">State:</span>
                  <select
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="text-xs border border-[#808080] bg-white px-1 py-0.5 focus:outline-none"
                  >
                    <option value="all">All States ({availableStates.length})</option>
                    {availableStates.map((abbr) => (
                      <option key={abbr} value={abbr}>
                        {STATE_ABBR_TO_NAME[abbr] ?? abbr} ({abbr})
                      </option>
                    ))}
                  </select>
                </div>
                {lastSyncStats && (lastSyncStats.scope === "local" || lastSyncStats.scope === "all") && (
                  <div className="flex items-center gap-2 flex-wrap text-[10px] border border-[#808080] bg-white px-2 py-1">
                    <span className="font-bold text-gray-700">Last Local Sync:</span>
                    <span className="text-gray-700">
                      {lastSyncStats.stateTaggedSources || lastSyncStats.sourcesByScope?.local || 0} state-tagged sources processed
                    </span>
                    <span className="text-gray-400">·</span>
                    <span className={lastSyncStats.insertedLocal > 0 ? "text-green-700 font-bold" : "text-gray-700"}>
                      {lastSyncStats.insertedLocal} new {lastSyncStats.insertedLocal === 1 ? "briefing" : "briefings"}
                    </span>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-500">
                      {format(new Date(lastSyncStats.at), "h:mm a")}
                    </span>
                  </div>
                )}
              </>
            )}
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
            {(selectedCategory !== "all" || partyLeaning !== "all" || selectedState !== "all") && (
              <button
                onClick={() => { setSelectedCategory("all"); setPartyLeaning("all"); setSelectedState("all"); }}
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

      {/* Overall Bias Breakdown */}
      {filteredBriefings.length > 0 && (() => {
        const counts = { L: 0, C: 0, R: 0, U: 0 };
        const seen = new Set<string>();
        for (const b of filteredBriefings) {
          if (seen.has(b.source_name)) continue;
          seen.add(b.source_name);
          counts[BIAS_META[classifyBias(b.source_name)].bucket]++;
        }
        const segs = biasBarSegments(counts);
        return (
          <div className="border border-[#808080] bg-white p-2 space-y-1">
            <div className="text-[10px] font-bold text-gray-700 flex items-center justify-between flex-wrap gap-1">
              <span>📊 Coverage Bias Breakdown ({seen.size} unique sources)</span>
              <span className="text-[9px] text-gray-500">
                <span className="text-blue-600 font-bold">{counts.L}</span> Left ·{" "}
                <span className="text-purple-600 font-bold">{counts.C}</span> Center ·{" "}
                <span className="text-red-600 font-bold">{counts.R}</span> Right ·{" "}
                <span className="text-gray-500 font-bold">{counts.U}</span> Unrated
              </span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-sm border border-[#c0c0c0]">
              {segs.L > 0 && <div style={{ width: `${segs.L}%`, background: "#3b82f6" }} title={`Left ${segs.L.toFixed(1)}%`} />}
              {segs.C > 0 && <div style={{ width: `${segs.C}%`, background: "#9333ea" }} title={`Center ${segs.C.toFixed(1)}%`} />}
              {segs.R > 0 && <div style={{ width: `${segs.R}%`, background: "#dc2626" }} title={`Right ${segs.R.toFixed(1)}%`} />}
              {segs.U > 0 && <div style={{ width: `${segs.U}%`, background: "#9ca3af" }} title={`Unrated ${segs.U.toFixed(1)}%`} />}
            </div>
          </div>
        );
      })()}

      {/* Selection bar */}
      {selectionMode && (
        <div className="border border-[#808080] bg-[#fffbe6] px-2 py-1 text-[10px] flex items-center gap-2 flex-wrap">
          <span className="font-bold">{selectedIds.size} selected</span>
          <button
            onClick={() => setSelectedIds(new Set(filteredBriefings.map((b) => b.id)))}
            className="px-2 py-0.5 border border-[#808080] bg-[#c0c0c0] hover:bg-[#d4d4d4]"
          >
            Select all ({filteredBriefings.length})
          </button>
          <button
            onClick={clearSelection}
            disabled={selectedIds.size === 0}
            className="px-2 py-0.5 border border-[#808080] bg-[#c0c0c0] hover:bg-[#d4d4d4] disabled:opacity-50"
          >
            Clear
          </button>
          <span className="ml-auto text-gray-600">Tip: tap a row to toggle, or use Export PDF to render full articles.</span>
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
      ) : groupMode === "clusters" ? (
        <div className="space-y-2">
          {clusters.map((c) => {
            const segs = biasBarSegments(c.bias);
            const uniqueSrc = new Set(c.articles.map(a => a.source)).size;
            // Cluster maps to all underlying briefing ids (article.id is briefing.id)
            const clusterBriefingIds = c.articles
              .map((a) => (a as ClusterableArticle & { id?: string }).id)
              .filter((x): x is string => !!x);
            const allSelected = clusterBriefingIds.length > 0 && clusterBriefingIds.every((id) => selectedIds.has(id));
            const someSelected = clusterBriefingIds.some((id) => selectedIds.has(id));
            return (
              <div
                key={c.id}
                className={`w-full border ${allSelected || someSelected ? "border-[#000080] bg-[#eef]" : "border-[#808080] bg-white"} hover:bg-[#e8e8ff] transition-colors`}
              >
                <div className="flex items-stretch">
                  {selectionMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (allSelected) clusterBriefingIds.forEach((id) => next.delete(id));
                          else clusterBriefingIds.forEach((id) => next.add(id));
                          return next;
                        });
                      }}
                      className="px-2 flex items-center justify-center border-r border-[#c0c0c0] hover:bg-[#d4d4d4]"
                      title={allSelected ? "Deselect cluster" : "Select cluster"}
                    >
                      {allSelected ? <CheckSquare size={14} className="text-[#000080]" /> : someSelected ? <CheckSquare size={14} className="text-gray-400" /> : <Square size={14} className="text-gray-500" />}
                    </button>
                  )}
                  <button
                    onClick={() => openCluster(c)}
                    className="flex-1 text-left p-2 space-y-1"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-[#000080] line-clamp-2">{c.lead.title}</div>
                        {c.lead.summary && (
                          <div className="text-[10px] text-gray-600 line-clamp-2 mt-0.5">{c.lead.summary}</div>
                        )}
                      </div>
                      <span className="flex-shrink-0 text-[10px] font-bold bg-[#000080] text-white px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                        <Layers size={10} /> {uniqueSrc}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-1.5 flex-1 overflow-hidden rounded-sm border border-[#c0c0c0]">
                        {segs.L > 0 && <div style={{ width: `${segs.L}%`, background: "#3b82f6" }} />}
                        {segs.C > 0 && <div style={{ width: `${segs.C}%`, background: "#9333ea" }} />}
                        {segs.R > 0 && <div style={{ width: `${segs.R}%`, background: "#dc2626" }} />}
                        {segs.U > 0 && <div style={{ width: `${segs.U}%`, background: "#9ca3af" }} />}
                      </div>
                      <span className="text-[9px] text-gray-500">L{c.bias.L} C{c.bias.C} R{c.bias.R}</span>
                      {c.blindspot && (
                        <span className="text-[9px] font-bold text-amber-700 flex items-center gap-0.5">
                          <AlertTriangle size={10} /> {c.blindspot} blindspot
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] text-gray-400 flex items-center gap-1.5">
                      <BiasChip source={c.lead.source} />
                      <span>{c.lead.source} • {c.lead.pubDate ? format(new Date(c.lead.pubDate), "PPp") : ""}</span>
                    </div>
                  </button>
                </div>
              </div>
            );
          })}
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
                {items.map((b) => {
                  const isSelected = selectedIds.has(b.id);
                  return (
                    <div key={b.id} className={`flex items-stretch ${isSelected ? "bg-[#eef]" : ""}`}>
                      {selectionMode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(b.id);
                          }}
                          className="px-2 flex items-center justify-center border-r border-[#c0c0c0] hover:bg-[#d4d4d4]"
                          title={isSelected ? "Deselect article" : "Select article"}
                        >
                          {isSelected ? <CheckSquare size={14} className="text-[#000080]" /> : <Square size={14} className="text-gray-500" />}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const found = clusters.find(c => c.articles.some(a => a.title === b.title && a.source === b.source_name));
                          openCluster(found ?? {
                            id: b.id,
                            lead: { title: b.title, source: b.source_name, link: b.source_url, pubDate: b.published_at, summary: b.summary },
                            articles: [{ title: b.title, source: b.source_name, link: b.source_url, pubDate: b.published_at, summary: b.summary }],
                            bias: { L: 0, C: 0, R: 0, U: 0 }, blindspot: null,
                          });
                        }}
                        className="flex-1 text-left px-2 py-1.5 hover:bg-[#e8e8ff] transition-colors"
                      >
                        <div className="text-xs font-bold text-[#000080] line-clamp-1 flex items-center gap-1">
                          <BiasChip source={b.source_name} />
                          <span className="truncate">{b.title}</span>
                        </div>
                        {b.summary && (
                          <div className="text-[10px] text-gray-600 line-clamp-2 mt-0.5">{b.summary}</div>
                        )}
                        <div className="text-[9px] text-gray-400 mt-0.5">
                          {b.published_at ? format(new Date(b.published_at), "PPp") : ""}
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      </>)}

      {selectedCluster && (
        <GroundNewsDetailWindow
          cluster={selectedCluster}
          onClose={() => setSelectedCluster(null)}
          contextLabel={`Intel — ${SCOPE_CONFIG[activeScope].label}`}
          onSavePDF={(article, fullContent) => {
            exportArticlePdf({
              title: article.title,
              source: article.source,
              pubDate: article.pubDate,
              link: article.link,
              summary: article.summary,
              content: fullContent,
            }, `intel-brief-${format(new Date(), "yyyy-MM-dd")}.pdf`);
            toast.success("PDF exported");
          }}
        />
      )}
    </div>
  );
}


// Tiny inline bias chip used on each card.
function BiasChip({ source }: { source: string }) {
  const bias = classifyBias(source);
  const meta = BIAS_META[bias];
  const short = meta.label === "Lean Left" ? "L←" : meta.label === "Lean Right" ? "R→" : meta.label === "Left" ? "L" : meta.label === "Right" ? "R" : meta.label === "Center" ? "C" : "?";
  return (
    <span
      className="inline-flex items-center text-[8px] font-bold px-1 py-0 rounded-sm flex-shrink-0"
      style={{ background: meta.bg, color: meta.color }}
      title={`${meta.label} — ${source}`}
    >
      {short}
    </span>
  );
}
