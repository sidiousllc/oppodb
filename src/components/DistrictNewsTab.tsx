import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Newspaper, ExternalLink, FileText, Loader2, AlertCircle, Search, X, CalendarDays, RefreshCw } from "lucide-react";
import { Win98Window } from "@/components/Win98Window";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { stateAbbrToName } from "@/lib/stateAbbreviations";
import ReactMarkdown from "react-markdown";

interface NewsArticle {
  title: string;
  link: string;
  source: string;
  pubDate: string;
}

function ArticleDetailWindow({
  article,
  onClose,
  formatDate,
  handlePDF,
}: {
  article: NewsArticle;
  onClose: () => void;
  formatDate: (raw: string) => string;
  handlePDF: (a: NewsArticle) => void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [scraping, setScraping] = useState(true);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setScraping(true);
    setScrapeError(null);
    setContent(null);

    supabase.functions
      .invoke("scrape-article", { body: { url: article.link } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.success) {
          setScrapeError("Could not load full article.");
        } else {
          setContent(data.markdown || "No content extracted.");
        }
      })
      .catch(() => {
        if (!cancelled) setScrapeError("Could not load full article.");
      })
      .finally(() => {
        if (!cancelled) setScraping(false);
      });

    return () => { cancelled = true; };
  }, [article.link]);

  return (
    <Win98Window
      title={`📰 ${article.source}`}
      onClose={onClose}
      defaultSize={{ width: 620, height: 520 }}
      defaultPosition={{ x: 60, y: 40 }}
    >
      <div className="p-4 space-y-4 overflow-auto h-full">
        <h2 className="font-display text-lg font-bold text-foreground leading-snug">{article.title}</h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-primary">{article.source}</span>
          <span>•</span>
          <span>{formatDate(article.pubDate)}</span>
        </div>
        <div className="flex gap-2">
          <a href={article.link} target="_blank" rel="noopener noreferrer" className="win98-button text-[10px] flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            Open Original
          </a>
          <button onClick={() => handlePDF(article)} className="win98-button text-[10px] flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Save as PDF
          </button>
        </div>
        <div className="border-t border-border pt-3">
          {scraping && (
            <div className="flex items-center gap-2 text-muted-foreground py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">Loading full article…</span>
            </div>
          )}
          {scrapeError && (
            <p className="text-xs text-muted-foreground italic text-center py-4">{scrapeError}</p>
          )}
          {content && (
            <div className="prose-research prose-sm max-w-none text-sm text-foreground">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </Win98Window>
  );
}

interface Props {
  districtId: string;
}

export function DistrictNewsTab({ districtId }: Props) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [memberName, setMemberName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openArticle, setOpenArticle] = useState<NewsArticle | null>(null);
  const [retrying, setRetrying] = useState(false);

  // Filters
  const [keyword, setKeyword] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const fetchNews = async () => {
    setLoading(true);
    setError(null);

    try {
      const [stateAbbr, distNum] = districtId.split("-");
      const stateName = stateAbbrToName(stateAbbr);
      const districtNumber = distNum === "AL" ? "0" : String(parseInt(distNum, 10));

      // Try multiple queries to find the representative
      const { data: members } = await supabase
        .from("congress_members")
        .select("name, bioguide_id, party, chamber")
        .eq("state", stateName)
        .eq("chamber", "House of Representatives")
        .eq("district", districtNumber)
        .limit(1);

      let member = members?.[0];

      // Fallback: try with At-Large districts
      if (!member && distNum === "AL") {
        const { data: atLargeMems } = await supabase
          .from("congress_members")
          .select("name, bioguide_id, party, chamber")
          .eq("state", stateName)
          .eq("chamber", "House of Representatives")
          .limit(1);
        member = atLargeMems?.[0];
      }

      // Fallback: try with district "at-large" or null
      if (!member) {
        const { data: fallbackMems } = await supabase
          .from("congress_members")
          .select("name, bioguide_id, party, chamber")
          .eq("state", stateName)
          .eq("chamber", "House of Representatives")
          .is("district", null)
          .limit(1);
        member = fallbackMems?.[0];
      }

      if (!member) {
        // Use district name as search query instead
        const districtQuery = `${stateName} congressional district ${distNum}`;
        setMemberName(districtQuery);
        
        const { data, error: fnErr } = await supabase.functions.invoke("district-news", {
          body: { memberName: districtQuery },
        });

        if (fnErr) { setError("Failed to fetch news."); setLoading(false); return; }
        setArticles(data?.articles || []);
        setLoading(false);
        return;
      }

      setMemberName(member.name);

      const { data, error: fnErr } = await supabase.functions.invoke("district-news", {
        body: { memberName: member.name },
      });

      if (fnErr) { setError("Failed to fetch news."); setLoading(false); return; }
      setArticles(data?.articles || []);
    } catch {
      setError("Failed to load news.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, [districtId]);

  const handleRetry = async () => {
    setRetrying(true);
    await fetchNews();
    setRetrying(false);
  };

  const filtered = useMemo(() => {
    const kw = keyword.toLowerCase().trim();
    return articles.filter((a) => {
      if (kw && !a.title.toLowerCase().includes(kw) && !a.source.toLowerCase().includes(kw)) return false;
      if (dateFrom || dateTo) {
        const d = new Date(a.pubDate);
        if (isNaN(d.getTime())) return false;
        if (dateFrom && d < dateFrom) return false;
        if (dateTo) {
          const end = new Date(dateTo);
          end.setHours(23, 59, 59, 999);
          if (d > end) return false;
        }
      }
      return true;
    });
  }, [articles, keyword, dateFrom, dateTo]);

  const hasActiveFilters = keyword || dateFrom || dateTo;

  const clearFilters = () => { setKeyword(""); setDateFrom(undefined); setDateTo(undefined); };

  const formatDate = (raw: string) => {
    try {
      const d = new Date(raw);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
    } catch { return raw; }
  };

  const handlePDF = (article: NewsArticle) => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`<!DOCTYPE html><html><head><title>${article.title}</title><style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;padding:0 20px;color:#333}h1{font-size:24px;line-height:1.3}.meta{color:#666;font-size:14px;margin-bottom:20px}.link{color:#0066cc}</style></head><body><h1>${article.title}</h1><div class="meta"><strong>${article.source}</strong> &bull; ${formatDate(article.pubDate)}<br/><a class="link" href="${article.link}">${article.link}</a></div><p>Full article available at the link above. Use your browser's "Save as PDF" or print function to create a PDF.</p></body></html>`);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading news…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
        <AlertCircle className="h-5 w-5" />
        <span className="text-sm">{error}</span>
        <Button variant="outline" size="sm" onClick={handleRetry} disabled={retrying}>
          <RefreshCw className={`h-3 w-3 mr-1 ${retrying ? "animate-spin" : ""}`} />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      {memberName && (
        <div className="bg-card rounded-xl border border-border p-4 mb-4 flex items-center gap-3">
          <Newspaper className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">News for</p>
            <p className="font-display text-sm font-bold text-foreground">{memberName}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleRetry} disabled={retrying} className="h-7 px-2">
            <RefreshCw className={`h-3 w-3 ${retrying ? "animate-spin" : ""}`} />
          </Button>
        </div>
      )}

      {/* Search & Date Filters */}
      <div className="space-y-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by keyword…"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
          {keyword && (
            <button onClick={() => setKeyword("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("flex-1 justify-start text-xs h-8", !dateFrom && "text-muted-foreground")}>
                <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                {dateFrom ? format(dateFrom, "MMM d, yyyy") : "From date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("flex-1 justify-start text-xs h-8", !dateTo && "text-muted-foreground")}>
                <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                {dateTo ? format(dateTo, "MMM d, yyyy") : "To date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{filtered.length} of {articles.length} articles</span>
            <button onClick={clearFilters} className="text-xs text-primary hover:underline">Clear filters</button>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {hasActiveFilters ? "No articles match your filters." : "No recent news found."}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((article, i) => (
            <button
              key={i}
              onClick={() => setOpenArticle(article)}
              className="w-full text-left bg-card rounded-xl border border-border p-4 hover:bg-muted/50 transition-colors"
            >
              <p className="text-sm font-semibold text-foreground leading-snug mb-1">{article.title}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-primary">{article.source}</span>
                <span>•</span>
                <span>{formatDate(article.pubDate)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {openArticle && (
        <ArticleDetailWindow
          article={openArticle}
          onClose={() => setOpenArticle(null)}
          formatDate={formatDate}
          handlePDF={handlePDF}
        />
      )}
    </>
  );
}
