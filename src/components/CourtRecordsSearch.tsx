import { useState, useCallback } from "react";
import { Search, Scale, ArrowLeft, Info, X } from "lucide-react";
import { toast } from "sonner";

interface CourtRecordsSearchProps {
  onBack?: () => void;
}

const EXAMPLE_SEARCHES = [
  { label: "Person name", query: '"John Smith"' },
  { label: "Case number", query: "2024-cv-01234" },
  { label: "Person + State", query: '"Jane Doe" AND state:california' },
  { label: "Company", query: '"Acme Corp"' },
];

export function CourtRecordsSearch({ onBack }: CourtRecordsSearchProps) {
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);

  const handleSearch = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      toast.error("Please enter a search query");
      return;
    }
    const encoded = encodeURIComponent(trimmed);
    const url = `https://www.judyrecords.com/search?q=${encoded}`;

    setRecentSearches((prev) => {
      const updated = [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, 10);
      return updated;
    });

    setIframeUrl(url);
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSearch();
    },
    [handleSearch]
  );

  if (iframeUrl) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-2 py-1 bg-[hsl(var(--win98-face))] border-b border-b-[hsl(var(--win98-shadow))]">
          <button onClick={() => setIframeUrl(null)} className="win98-button text-[10px] flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" />
            Back
          </button>
          <span className="text-[10px] truncate flex-1 text-[hsl(var(--muted-foreground))]">{iframeUrl}</span>
          <button onClick={() => window.open(iframeUrl, "_blank", "noopener,noreferrer")} className="win98-button text-[10px]">
            Open in New Tab
          </button>
          <button onClick={() => setIframeUrl(null)} className="win98-button text-[10px]">
            <X className="h-3 w-3" />
          </button>
        </div>
        <iframe
          src={iframeUrl}
          className="flex-1 w-full border-0"
          style={{ minHeight: 500 }}
          title="Court Records Search Results"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    );
  }

  return (
    <div>
      {onBack && (
        <button onClick={onBack} className="win98-button text-[10px] flex items-center gap-1 mb-3">
          <ArrowLeft className="h-3 w-3" />
          Back to Research Tools
        </button>
      )}

      <div className="win98-sunken bg-[hsl(var(--win98-light))] px-3 py-2 mb-3">
        <div className="flex items-center gap-2 text-[11px]">
          <Scale className="h-4 w-4" />
          <span className="font-bold">Court Records Search</span>
          <span className="text-[hsl(var(--muted-foreground))]">— Powered by JudyRecords (400M+ U.S. court cases)</span>
        </div>
      </div>

      <div className="win98-raised bg-[hsl(var(--win98-face))] p-3 mb-3">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "hsl(210, 60%, 50%)" }} />
          <div className="text-[10px]">
            <p className="font-bold mb-1">How It Works</p>
            <p className="text-[hsl(var(--muted-foreground))]">
              Search results from JudyRecords.com load directly below. JudyRecords indexes over 400 million court cases
              from federal, state, and local courts across all 50 states.
            </p>
          </div>
        </div>
      </div>

      <div className="win98-sunken bg-white p-3 mb-3">
        <label className="block text-[10px] font-bold mb-1">Search Query:</label>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="win98-input flex-1"
            placeholder='e.g. "John Smith" or case number 2024-cv-01234'
            maxLength={500}
          />
          <button onClick={handleSearch} className="win98-button text-[10px] font-bold flex items-center gap-1">
            <Search className="h-3 w-3" />
            Search
          </button>
        </div>
        <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-1">
          Use quotes for exact names. Results load in-app below.
        </p>
      </div>

      <div className="win98-raised bg-[hsl(var(--win98-face))] p-3 mb-3">
        <p className="text-[10px] font-bold mb-2">🔍 Search Tips & Examples</p>
        <div className="grid grid-cols-2 gap-2">
          {EXAMPLE_SEARCHES.map((ex) => (
            <button
              key={ex.label}
              onClick={() => setQuery(ex.query)}
              className="win98-button text-[10px] text-left px-2 py-1"
            >
              <span className="font-bold block">{ex.label}</span>
              <code className="text-[9px] text-[hsl(var(--muted-foreground))]">{ex.query}</code>
            </button>
          ))}
        </div>
        <div className="mt-3 text-[9px] text-[hsl(var(--muted-foreground))] space-y-1">
          <p><strong>Operators:</strong></p>
          <p>• <code className="bg-[hsl(var(--win98-light))] px-1">"exact phrase"</code> — Match exact name or phrase</p>
          <p>• <code className="bg-[hsl(var(--win98-light))] px-1">AND</code> — Both terms must appear</p>
          <p>• <code className="bg-[hsl(var(--win98-light))] px-1">OR</code> — Either term can appear</p>
          <p>• <code className="bg-[hsl(var(--win98-light))] px-1">state:california</code> — Filter by state</p>
          <p>• <code className="bg-[hsl(var(--win98-light))] px-1">court:federal</code> — Filter by court type</p>
        </div>
      </div>

      <div className="win98-raised bg-[hsl(var(--win98-face))] p-3 mb-3">
        <p className="text-[10px] font-bold mb-2">📋 Court Coverage</p>
        <div className="grid grid-cols-3 gap-2 text-[9px]">
          <div className="candidate-card text-center">
            <span className="text-lg block">🏛️</span>
            <span className="font-bold block">Federal Courts</span>
            <span className="text-[hsl(var(--muted-foreground))]">District, Circuit, Supreme</span>
          </div>
          <div className="candidate-card text-center">
            <span className="text-lg block">⚖️</span>
            <span className="font-bold block">State Courts</span>
            <span className="text-[hsl(var(--muted-foreground))]">All 50 states</span>
          </div>
          <div className="candidate-card text-center">
            <span className="text-lg block">🏢</span>
            <span className="font-bold block">Local Courts</span>
            <span className="text-[hsl(var(--muted-foreground))]">County, Municipal</span>
          </div>
        </div>
      </div>

      {recentSearches.length > 0 && (
        <div className="win98-raised bg-[hsl(var(--win98-face))] p-3">
          <p className="text-[10px] font-bold mb-2">🕒 Recent Searches</p>
          <div className="flex flex-wrap gap-1">
            {recentSearches.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  setQuery(s);
                  const encoded = encodeURIComponent(s);
                  setIframeUrl(`https://www.judyrecords.com/search?q=${encoded}`);
                }}
                className="win98-button text-[9px] px-2 py-0.5 flex items-center gap-1"
              >
                <Search className="h-2.5 w-2.5" />
                {s.length > 40 ? s.slice(0, 40) + "…" : s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
