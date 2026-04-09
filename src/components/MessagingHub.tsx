import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, ExternalLink, Loader2, Tag, Calendar } from "lucide-react";

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

export function MessagingHub() {
  const [items, setItems] = useState<MessagingGuidance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MessagingGuidance | null>(null);

  useEffect(() => {
    supabase
      .from("messaging_guidance")
      .select("*")
      .order("published_date", { ascending: false })
      .then(({ data }) => {
        setItems((data as MessagingGuidance[]) || []);
        setLoading(false);
      });
  }, []);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    items.forEach(i => i.issue_areas?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [items]);

  const filtered = useMemo(() => {
    let results = items;
    if (selectedTag) results = results.filter(i => i.issue_areas?.includes(selectedTag));
    if (search.trim().length >= 2) {
      const q = search.toLowerCase();
      results = results.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.summary.toLowerCase().includes(q) ||
        i.author?.toLowerCase().includes(q) ||
        i.issue_areas?.some(t => t.toLowerCase().includes(q))
      );
    }
    return results;
  }, [items, search, selectedTag]);

  if (selectedItem) {
    return (
      <div className="animate-fade-in">
        <button
          onClick={() => setSelectedItem(null)}
          className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-4 transition-colors"
        >
          ← Back to Messaging Hub
        </button>

        <div className="candidate-card mb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-sm font-bold mb-1">{selectedItem.title}</h1>
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-[hsl(var(--muted-foreground))]">
                <span>{selectedItem.source}</span>
                {selectedItem.author && <span>• {selectedItem.author}</span>}
                {selectedItem.published_date && (
                  <span>• {new Date(selectedItem.published_date).toLocaleDateString()}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {selectedItem.issue_areas?.map(tag => (
                  <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-[hsl(var(--win98-light))] border border-[hsl(var(--win98-shadow))]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            {selectedItem.source_url && (
              <a
                href={selectedItem.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="win98-button text-[10px] flex items-center gap-1 shrink-0"
              >
                <ExternalLink className="h-3 w-3" />
                Source
              </a>
            )}
          </div>
        </div>

        <div className="candidate-card">
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] mb-3">{selectedItem.summary}</p>
          {selectedItem.content ? (
            <div className="prose-research text-[11px]" dangerouslySetInnerHTML={{ __html: selectedItem.content.replace(/\n/g, '<br/>') }} />
          ) : (
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] italic">
              Full content not yet available. Visit the source link for the complete report.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="win98-sunken bg-[hsl(var(--win98-light))] px-3 py-2">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-xl">📢</span>
          <span className="font-bold">MessagingHub</span>
          <span className="text-[hsl(var(--muted-foreground))]">— Polling-based message guidance and communications strategy</span>
        </div>
      </div>

      {/* Search + filter */}
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
            {filtered.map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="candidate-card text-left hover:bg-[hsl(var(--win98-light))] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
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
                      {item.issue_areas?.slice(0, 3).map(tag => (
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
            ))}
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
