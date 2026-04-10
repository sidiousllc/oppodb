import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Newspaper, ExternalLink, FileText, Loader2, AlertCircle, X } from "lucide-react";
import { Win98Window } from "@/components/Win98Window";

interface NewsArticle {
  title: string;
  link: string;
  source: string;
  pubDate: string;
}

interface Props {
  districtId: string; // e.g. "CA-12"
}

export function DistrictNewsTab({ districtId }: Props) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [memberName, setMemberName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openArticle, setOpenArticle] = useState<NewsArticle | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // 1. Find the current House member for this district
        const [stateAbbr, distNum] = districtId.split("-");
        const districtNumber = distNum === "AL" ? "0" : String(parseInt(distNum, 10));

        const { data: members } = await supabase
          .from("congress_members")
          .select("name, bioguide_id, party, chamber")
          .eq("state", stateAbbr)
          .eq("chamber", "House")
          .eq("district", districtNumber)
          .limit(1);

        const member = members?.[0];
        if (!member) {
          if (!cancelled) {
            setError("No current House member found for this district.");
            setLoading(false);
          }
          return;
        }

        if (!cancelled) setMemberName(member.name);

        // 2. Fetch news
        const { data, error: fnErr } = await supabase.functions.invoke("district-news", {
          body: { memberName: member.name },
        });

        if (cancelled) return;

        if (fnErr) {
          setError("Failed to fetch news.");
          setLoading(false);
          return;
        }

        setArticles(data?.articles || []);
      } catch {
        if (!cancelled) setError("Failed to load news.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [districtId]);

  const formatDate = (raw: string) => {
    try {
      const d = new Date(raw);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return raw;
    }
  };

  const handlePDF = (article: NewsArticle) => {
    // Open print dialog for the article content which can be saved as PDF
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${article.title}</title>
          <style>
            body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; padding: 0 20px; color: #333; }
            h1 { font-size: 24px; line-height: 1.3; }
            .meta { color: #666; font-size: 14px; margin-bottom: 20px; }
            .link { color: #0066cc; }
          </style>
        </head>
        <body>
          <h1>${article.title}</h1>
          <div class="meta">
            <strong>${article.source}</strong> &bull; ${formatDate(article.pubDate)}<br/>
            <a class="link" href="${article.link}">${article.link}</a>
          </div>
          <p>Full article available at the link above. Use your browser's "Save as PDF" or print function to create a PDF.</p>
        </body>
        </html>
      `);
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
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
        <AlertCircle className="h-5 w-5" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  return (
    <>
      {memberName && (
        <div className="bg-card rounded-xl border border-border p-4 mb-4 flex items-center gap-3">
          <Newspaper className="h-5 w-5 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">News for</p>
            <p className="font-display text-sm font-bold text-foreground">{memberName}</p>
          </div>
        </div>
      )}

      {articles.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No recent news found.</p>
      ) : (
        <div className="space-y-2">
          {articles.map((article, i) => (
            <button
              key={i}
              onClick={() => setOpenArticle(article)}
              className="w-full text-left bg-card rounded-xl border border-border p-4 hover:bg-muted/50 transition-colors"
            >
              <p className="text-sm font-semibold text-foreground leading-snug mb-1">
                {article.title}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-primary">{article.source}</span>
                <span>•</span>
                <span>{formatDate(article.pubDate)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Article Viewer Window */}
      {openArticle && (
        <Win98Window
          title={`📰 ${openArticle.source}`}
          onClose={() => setOpenArticle(null)}
          defaultSize={{ width: 520, height: 420 }}
          defaultPosition={{ x: 60, y: 40 }}
        >
          <div className="p-4 space-y-4 overflow-auto h-full">
            <h2 className="font-display text-lg font-bold text-foreground leading-snug">
              {openArticle.title}
            </h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-primary">{openArticle.source}</span>
              <span>•</span>
              <span>{formatDate(openArticle.pubDate)}</span>
            </div>
            <div className="flex gap-2 pt-2">
              <a
                href={openArticle.link}
                target="_blank"
                rel="noopener noreferrer"
                className="win98-button text-[10px] flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                Read Full Article
              </a>
              <button
                onClick={() => handlePDF(openArticle)}
                className="win98-button text-[10px] flex items-center gap-1"
              >
                <FileText className="h-3 w-3" />
                Save as PDF
              </button>
            </div>
            <div className="border-t border-border pt-3 mt-3">
              <p className="text-xs text-muted-foreground italic">
                Click "Read Full Article" to view the complete story at {openArticle.source}. Use "Save as PDF" to generate a printable version.
              </p>
            </div>
          </div>
        </Win98Window>
      )}
    </>
  );
}
