import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { STATE_ABBR_TO_NAME } from "@/lib/stateAbbreviations";
import { ArrowLeft, ExternalLink, Loader2, Rss } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SourceRow {
  name: string;
  rssUrl: string;
  state: string | null;
}

export default function LocalFeedsStateSources() {
  const { abbr: rawAbbr } = useParams<{ abbr: string }>();
  const abbr = (rawAbbr || "").toUpperCase();
  const stateName = STATE_ABBR_TO_NAME[abbr] ?? abbr;

  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase.functions.invoke("intel-briefing", {
        body: { action: "list_local_sources", state: abbr },
      });
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setSources([]);
      } else {
        setSources((data?.sources as SourceRow[]) ?? []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [abbr]);

  const hostOf = (url: string) => {
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch { return url; }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/local-feeds">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {stateName} <span className="text-muted-foreground font-mono text-base">({abbr})</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Local RSS sources configured for this jurisdiction.
            </p>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading sources…
          </div>
        )}

        {error && !loading && (
          <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {!loading && !error && sources.length === 0 && (
          <div className="p-6 rounded-lg border border-border bg-muted/30 text-sm text-muted-foreground text-center">
            No local sources are configured for {stateName}.
          </div>
        )}

        {!loading && sources.length > 0 && (
          <>
            <p className="text-xs text-muted-foreground mb-3">
              {sources.length} source{sources.length === 1 ? "" : "s"} configured
            </p>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Source</th>
                    <th className="px-3 py-2 text-left font-semibold">Domain</th>
                    <th className="px-3 py-2 text-right font-semibold">Feed</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s) => (
                    <tr key={s.rssUrl} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{s.name}</td>
                      <td className="px-3 py-2 text-muted-foreground font-mono text-xs">
                        {hostOf(s.rssUrl)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <a
                          href={s.rssUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Rss className="h-3 w-3" />
                          RSS
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
