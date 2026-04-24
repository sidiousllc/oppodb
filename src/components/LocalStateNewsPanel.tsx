import { useEffect, useMemo, useState } from "react";
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
  /** Default chamber to preselect ("house" | "senate") */
  defaultChamber?: "house" | "senate";
  /** Default district number to preselect (e.g. "15A", "14") */
  defaultDistrictNumber?: string;
}

type ChamberFilter = "all" | "house" | "senate";

/**
 * Shows local news briefings from in-state RSS publishers, with optional
 * chamber + district-number filters that match articles whose title/summary
 * mentions the specific legislative district.
 */
export function LocalStateNewsPanel({
  stateAbbr,
  stateName,
  districtLabel,
  defaultChamber,
  defaultDistrictNumber,
}: Props) {
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [chamber, setChamber] = useState<ChamberFilter>(defaultChamber ?? "all");
  const [districtNumber, setDistrictNumber] = useState<string>(defaultDistrictNumber ?? "all");

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

  // Reset filters when the district context changes
  useEffect(() => {
    setChamber(defaultChamber ?? "all");
    setDistrictNumber(defaultDistrictNumber ?? "all");
  }, [defaultChamber, defaultDistrictNumber]);

  // Build a set of district numbers detected in current briefings (for the dropdown).
  // Supports: "District 15", "District No. 15", "Dist. 15", "House District 15A",
  // "Senate District 14", "HD 15A", "HD-15A", "SD-14", "House 15A", "Senate 14",
  // "Assembly District 12", "AD-12".
  // Group 1 (optional) captures the chamber prefix (house/senate/assembly/hd/sd/ad).
  // Group 2 captures the district number (with optional letter suffix, e.g. "15A").
  const DISTRICT_REGEX =
    /\b(house|senate|assembly|state\s+house|state\s+senate|hd|sd|ad)?[\s-]*(?:district|dist\.?|d)?[\s.\-]*(?:no\.?|number|#)?[\s.\-]*(\d{1,3}[A-Za-z]?)\b/gi;

  // Stricter version: requires *some* district-y prefix to avoid matching
  // arbitrary numbers in article text.
  const STRICT_DISTRICT_REGEX =
    /\b(?:(house|senate|assembly|state\s+house|state\s+senate|hd|sd|ad)[\s.\-]*(?:district|dist\.?)?[\s.\-]*(?:no\.?|number|#)?[\s.\-]*(\d{1,3}[A-Za-z]?)|(?:district|dist\.?)[\s.\-]*(?:no\.?|number|#)?[\s.\-]*(\d{1,3}[A-Za-z]?))\b/gi;

  const detectedDistricts = useMemo(() => {
    const found = new Set<string>();
    for (const b of briefings) {
      const text = `${b.title} ${b.summary ?? ""}`;
      let m: RegExpExecArray | null;
      const re = new RegExp(STRICT_DISTRICT_REGEX.source, "gi");
      while ((m = re.exec(text)) !== null) {
        const num = (m[2] || m[3] || "").toUpperCase();
        if (num) found.add(num);
      }
    }
    if (defaultDistrictNumber) found.add(defaultDistrictNumber.toUpperCase());
    return Array.from(found).sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (na !== nb) return na - nb;
      return a.localeCompare(b);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefings, defaultDistrictNumber]);

  const filtered = useMemo(() => {
    if (chamber === "all" && districtNumber === "all") return briefings;
    return briefings.filter((b) => {
      const text = `${b.title} ${b.summary ?? ""}`;

      if (chamber !== "all") {
        const chamberMatch =
          chamber === "house"
            ? /\b(house|hd|state\s+house|assembly|ad)\b/i.test(text)
            : /\b(senate|sd|state\s+senate)\b/i.test(text);
        if (!chamberMatch) return false;
      }

      if (districtNumber !== "all") {
        const dn = districtNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // Match the requested district number after any supported prefix:
        // "District 15", "District No. 15", "Dist. 15", "HD 15A", "HD-15A",
        // "House District 15A", "Senate District 14", "Assembly 12", "AD-12".
        const dnRe = new RegExp(
          // chamber-prefixed forms
          `\\b(?:house|senate|assembly|state\\s+house|state\\s+senate|hd|sd|ad)` +
            `(?:[\\s.\\-]*(?:district|dist\\.?))?` +
            `[\\s.\\-]*(?:no\\.?|number|#)?[\\s.\\-]*${dn}\\b` +
            `|\\b(?:district|dist\\.?)[\\s.\\-]*(?:no\\.?|number|#)?[\\s.\\-]*${dn}\\b`,
          "i",
        );
        if (!dnRe.test(text)) return false;
      }

      return true;
    });
  }, [briefings, chamber, districtNumber]);

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

  const isFiltered = chamber !== "all" || districtNumber !== "all";

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

      {/* Chamber + district number filters */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex flex-col">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            Chamber
          </label>
          <select
            value={chamber}
            onChange={(e) => setChamber(e.target.value as ChamberFilter)}
            className="text-xs bg-background border border-border rounded px-2 py-1 text-foreground"
          >
            <option value="all">All chambers</option>
            <option value="house">House</option>
            <option value="senate">Senate</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            District #
          </label>
          <select
            value={districtNumber}
            onChange={(e) => setDistrictNumber(e.target.value)}
            className="text-xs bg-background border border-border rounded px-2 py-1 text-foreground"
          >
            <option value="all">All districts</option>
            {detectedDistricts.map((dn) => (
              <option key={dn} value={dn}>
                {dn}
              </option>
            ))}
          </select>
        </div>

        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setChamber("all");
              setDistrictNumber("all");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Showing news from outlets located in {stateName}.
        {isFiltered
          ? " Filtered to articles that mention the selected chamber and/or district number."
          : " All sources are verified to publish within the state, so coverage is geographically relevant to this district."}
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
      ) : filtered.length === 0 ? (
        <div className="py-10 px-4 text-center space-y-4">
          {isFiltered ? (
            <>
              <div className="text-sm text-muted-foreground">
                No in-state articles match the selected
                {chamber !== "all" && <> <span className="font-semibold text-foreground">{chamber}</span></>}
                {chamber !== "all" && districtNumber !== "all" && " /"}
                {districtNumber !== "all" && <> <span className="font-semibold text-foreground">district {districtNumber}</span></>}
                {" "}filter.
              </div>
              <div className="text-xs text-muted-foreground">
                Try broadening your filters:
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {chamber !== "all" && (
                  <Button variant="outline" size="sm" onClick={() => setChamber("all")}>
                    Chamber → All
                  </Button>
                )}
                {districtNumber !== "all" && (
                  <Button variant="outline" size="sm" onClick={() => setDistrictNumber("all")}>
                    District → All
                  </Button>
                )}
                {chamber !== "all" && districtNumber !== "all" && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      setChamber("all");
                      setDistrictNumber("all");
                    }}
                  >
                    Clear all filters
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">
              No local briefings cached yet for {stateName}. Click Refresh to fetch the latest articles from in-state outlets.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
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
