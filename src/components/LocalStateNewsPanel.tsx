import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Newspaper, ExternalLink, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Briefing {
  id: string;
  title: string;
  summary: string | null;
  source_name: string;
  source_url: string;
  published_at: string | null;
  region: string | null;
  category: string | null;
}

interface Props {
  stateAbbr: string;
  stateName: string;
  /** Optional context label (e.g. "MN House 15A") shown in header */
  districtLabel?: string;
}

/**
 * Shows local news briefings sourced from RSS feeds whose publishers are
 * located within the given state. Uses the `intel_briefings` table,
 * filtered to scope='local' AND region=stateAbbr — guaranteeing every
 * source is in-state (i.e. within the district's geography).
 */
export function LocalStateNewsPanel({ stateAbbr, stateName, districtLabel }: Props) {
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("intel_briefings")
      .select("id,title,summary,source_name,source_url,published_at,region,category")
      .eq("scope", "local")
      .eq("region", stateAbbr.toUpperCase())
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(60);

    if (err) {
      setError(err.message);
      setBriefings([]);
    } else {
      setBriefings((data || []) as Briefing[]);
    }
    setLoading(false);
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      // Trigger a fresh sync for this state's local feeds
      await supabase.functions.invoke("intel-briefing", {
        body: { scope: "local", state: stateAbbr.toUpperCase() },
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateAbbr]);

  const formatDate = (raw: string | null) => {
    if (!raw) return "";
    try {
      return new Date(raw).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return raw;
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold text-foreground">
            Local News — {districtLabel ?? stateName}
          </h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={refreshing || loading}
        >
          {refreshing ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3 mr-1" />
          )}
          Refresh
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Showing news from outlets located in {stateName}. All sources are
        verified to publish within the state, so coverage is geographically
        relevant to this district.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading local news...
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      ) : briefings.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No local briefings cached yet for {stateName}. Click Refresh to fetch
          the latest articles from in-state outlets.
        </div>
      ) : (
        <div className="space-y-3">
          {briefings.map((b) => (
            <a
              key={b.id}
              href={b.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/40 transition-colors group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-sm text-foreground group-hover:text-primary line-clamp-2">
                    {b.title}
                  </h3>
                  {b.summary && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {b.summary}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground flex-wrap">
                    <span className="font-semibold">{b.source_name}</span>
                    {b.published_at && (
                      <>
                        <span>•</span>
                        <span>{formatDate(b.published_at)}</span>
                      </>
                    )}
                    <span className="ml-auto inline-flex items-center gap-1 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      Open
                      <ExternalLink className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
