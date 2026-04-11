import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, ExternalLink, Loader2, Calendar, RefreshCw, ArrowLeft, FileDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { exportMessagingPDF } from "@/lib/messagingExport";

interface MessagingGuidance {
  id: string;
  title: string;
  slug: string;
  source: string;
  source_url: string | null;
  author: string | null;
  published_date: string | null;
  summary: string;
  content: string;
  issue_areas: string[];
  research_type: string;
  created_at: string;
}

type PartyFilter = "all" | "Democrat" | "Republican" | "Independent";

const PARTY_COLORS: Record<string, string> = {
  Democrat: "bg-blue-100 text-blue-800 border-blue-300",
  Republican: "bg-red-100 text-red-800 border-red-300",
  Independent: "bg-purple-100 text-purple-800 border-purple-300",
};

function getPartyBadge(areas: string[]): string | null {
  if (areas.includes("Democrat") && areas.includes("Republican")) return null; // bipartisan
  if (areas.includes("Democrat")) return "Democrat";
  if (areas.includes("Republican")) return "Republican";
  if (areas.includes("Independent")) return "Independent";
  return null;
}

export function MessagingHub() {
  const [items, setItems] = useState<MessagingGuidance[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [partyFilter, setPartyFilter] = useState<PartyFilter>("all");
  const [selectedItem, setSelectedItem] = useState<MessagingGuidance | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("messaging_guidance")
      .select("*")
      .order("published_date", { ascending: false });
    setItems((data as MessagingGuidance[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("messaging-sync", {
        body: { sources: ["navigator", "heritage", "bpc"] },
      });
      if (error) throw error;
      toast.success(`Sync complete: ${data?.message || "Done"}`);
      await loadData();
    } catch (e: any) {
      toast.error(`Sync failed: ${e.message || "Unknown error"}`);
    } finally {
      setSyncing(false);
    }
  };

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    const partyTags = new Set(["Democrat", "Republican", "Independent"]);
    items.forEach(i => i.issue_areas?.forEach(t => {
      if (!partyTags.has(t)) tags.add(t);
    }));
    return Array.from(tags).sort();
  }, [items]);

  const filtered = useMemo(() => {
    let results = items;
    if (partyFilter !== "all") {
      results = results.filter(i => i.issue_areas?.includes(partyFilter));
    }
    if (selectedTag) results = results.filter(i => i.issue_areas?.includes(selectedTag));
    if (search.trim().length >= 2) {
      const q = search.toLowerCase();
      results = results.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.summary.toLowerCase().includes(q) ||
        i.source.toLowerCase().includes(q) ||
        i.author?.toLowerCase().includes(q) ||
        i.issue_areas?.some(t => t.toLowerCase().includes(q))
      );
    }
    return results;
  }, [items, search, selectedTag, partyFilter]);

  /* ── Detail View ──────────────────────────────────── */
  if (selectedItem) {
    const party = getPartyBadge(selectedItem.issue_areas || []);
    return (
      <div className="animate-fade-in">
        <button
          onClick={() => setSelectedItem(null)}
          className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-4 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Messaging Hub
        </button>

        <div className="candidate-card mb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {party && (
                  <span className={`text-[9px] px-1.5 py-0.5 border rounded ${PARTY_COLORS[party] || ""}`}>
                    {party}
                  </span>
                )}
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{selectedItem.source}</span>
              </div>
              <h1 className="text-sm font-bold mb-1">{selectedItem.title}</h1>
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-[hsl(var(--muted-foreground))]">
                {selectedItem.author && <span>{selectedItem.author}</span>}
                {selectedItem.published_date && (
                  <span>• {new Date(selectedItem.published_date).toLocaleDateString()}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {selectedItem.issue_areas?.filter(t => !["Democrat","Republican","Independent"].includes(t)).map(tag => (
                  <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-[hsl(var(--win98-light))] border border-[hsl(var(--win98-shadow))]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <button
                onClick={() => exportMessagingPDF(selectedItem)}
                className="win98-button text-[10px] flex items-center gap-1"
              >
                <FileDown className="h-3 w-3" />
                Export PDF
              </button>
              {selectedItem.source_url && (
                <a
                  href={selectedItem.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="win98-button text-[10px] flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Source
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="candidate-card">
          {selectedItem.summary && (
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] mb-3 italic">{selectedItem.summary}</p>
          )}
          {selectedItem.content ? (
            <div className="prose-research text-[11px]">
              <ReactMarkdown>{selectedItem.content}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] italic">
              Full content not yet available. Visit the source link for the complete report.
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ── List View ────────────────────────────────────── */
  return (
    <div className="space-y-3">
      <div className="win98-sunken bg-[hsl(var(--win98-light))] px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-xl">📢</span>
            <span className="font-bold">MessagingHub</span>
            <span className="text-[hsl(var(--muted-foreground))]">— Multi-partisan message guidance</span>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="win98-button text-[10px] flex items-center gap-1"
          >
            <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Pull Updates"}
          </button>
        </div>
      </div>

      {/* Party filter tabs */}
      <div className="flex gap-1">
        {(["all", "Democrat", "Republican", "Independent"] as PartyFilter[]).map(p => (
          <button
            key={p}
            onClick={() => setPartyFilter(p)}
            className={`win98-button text-[10px] px-2 py-0.5 ${partyFilter === p ? "font-bold" : ""}`}
          >
            {p === "all" ? "🏛️ All" : p === "Democrat" ? "🔵 Democrat" : p === "Republican" ? "🔴 Republican" : "🟣 Independent"}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[hsl(var(--muted-foreground))]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search messaging guidance..."
            className="win98-sunken w-full pl-7 pr-2 py-1 text-[11px] bg-white"
          />
        </div>
      </div>

      {/* Issue area tags */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setSelectedTag(null)}
          className={`win98-button text-[9px] px-1.5 py-0 ${!selectedTag ? "font-bold" : ""}`}
        >
          All Topics
        </button>
        {allTags.map(tag => (
          <button
            key={tag}
            onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
            className={`win98-button text-[9px] px-1.5 py-0 ${selectedTag === tag ? "font-bold" : ""}`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-8">
          <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Loading messaging guidance...</p>
        </div>
      ) : (
        <>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{filtered.length} reports</p>
          <div className="grid gap-2">
            {filtered.map(item => {
              const party = getPartyBadge(item.issue_areas || []);
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="candidate-card text-left hover:bg-[hsl(var(--win98-light))] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {party && (
                          <span className={`text-[8px] px-1 py-0 border rounded ${PARTY_COLORS[party] || ""}`}>
                            {party}
                          </span>
                        )}
                        <span className="text-[9px] text-[hsl(var(--muted-foreground))]">{item.source}</span>
                      </div>
                      <h3 className="text-[11px] font-bold truncate">{item.title}</h3>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-2">{item.summary}</p>
                      <div className="flex flex-wrap items-center gap-1 mt-1.5">
                        {item.published_date && (
                          <span className="text-[9px] text-[hsl(var(--muted-foreground))] flex items-center gap-0.5">
                            <Calendar className="h-2.5 w-2.5" />
                            {new Date(item.published_date).toLocaleDateString()}
                          </span>
                        )}
                        {item.author && (
                          <span className="text-[9px] text-[hsl(var(--muted-foreground))]">• {item.author}</span>
                        )}
                        {item.issue_areas?.filter(t => !["Democrat","Republican","Independent"].includes(t)).slice(0, 3).map(tag => (
                          <span key={tag} className="text-[8px] px-1 py-0 bg-[hsl(var(--win98-light))] border border-[hsl(var(--win98-shadow))]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    {item.source_url && (
                      <ExternalLink className="h-3 w-3 text-[hsl(var(--muted-foreground))] shrink-0 mt-1" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-8">
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">No messaging guidance matches your filters.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
