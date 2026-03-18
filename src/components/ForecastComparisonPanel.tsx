import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Loader2, RefreshCw, ChevronDown, ChevronRight, Filter, Globe } from "lucide-react";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/useIsAdmin";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Forecast {
  id: string;
  source: string;
  race_type: string;
  state_abbr: string;
  district: string | null;
  rating: string | null;
  dem_win_prob: number | null;
  rep_win_prob: number | null;
  cycle: number;
  last_updated: string | null;
}

const RATING_ORDER: Record<string, number> = {
  "Solid D": -4, "Safe D": -4,
  "Likely D": -3,
  "Lean D": -2,
  "Tilt D": -1.5,
  "Toss Up": 0,
  "Tilt R": 1.5,
  "Lean R": 2,
  "Likely R": 3,
  "Solid R": 4, "Safe R": 4,
};

const RATING_COLORS: Record<string, string> = {
  "Solid D":  "hsl(210, 100%, 35%)",
  "Safe D":   "hsl(210, 100%, 35%)",
  "Likely D": "hsl(210, 80%, 50%)",
  "Lean D":   "hsl(210, 60%, 62%)",
  "Tilt D":   "hsl(210, 45%, 70%)",
  "Toss Up":  "hsl(45, 90%, 50%)",
  "Tilt R":   "hsl(0, 45%, 70%)",
  "Lean R":   "hsl(0, 60%, 62%)",
  "Likely R": "hsl(0, 75%, 50%)",
  "Solid R":  "hsl(0, 85%, 38%)",
  "Safe R":   "hsl(0, 85%, 38%)",
};

function ratingBadge(rating: string | null) {
  if (!rating) return <span className="text-[9px] text-muted-foreground">—</span>;
  const color = RATING_COLORS[rating] || "hsl(var(--muted-foreground))";
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold text-white whitespace-nowrap"
      style={{ backgroundColor: color }}
    >
      {rating}
    </span>
  );
}

function raceLabel(f: Forecast) {
  if (f.race_type === "senate") return `${f.state_abbr} Senate`;
  if (f.race_type === "governor") return `${f.state_abbr} Governor`;
  return `${f.state_abbr}-${(f.district || "AL").padStart(2, "0")}`;
}

// Consensus logic: average the numeric rating scores
function consensusRating(ratings: (string | null)[]): string | null {
  const valid = ratings.filter(Boolean).map(r => RATING_ORDER[r!]);
  const scored = valid.filter(v => v !== undefined);
  if (scored.length === 0) return null;
  const avg = scored.reduce((a, b) => a + b, 0) / scored.length;
  // Map back to nearest rating
  const entries = Object.entries(RATING_ORDER);
  entries.sort((a, b) => Math.abs(a[1] - avg) - Math.abs(b[1] - avg));
  return entries[0][0];
}

// ─── Component ──────────────────────────────────────────────────────────────

type RaceType = "house" | "senate" | "governor" | "all";

interface ForecastComparisonPanelProps {
  districtId?: string; // e.g. "PA-07" — filters to that district's race only
}

export function ForecastComparisonPanel({ districtId }: ForecastComparisonPanelProps = {}) {
  const isAdmin = useIsAdmin();
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [raceFilter, setRaceFilter] = useState<RaceType>("all");
  const [stateFilter, setStateFilter] = useState("");
  const [expandedRace, setExpandedRace] = useState<string | null>(null);

  // Parse districtId (e.g. "PA-07") into state + district number
  const parsedState = districtId ? districtId.split("-")[0] : null;
  const parsedDistrict = districtId ? districtId.split("-")[1] : null;

  const loadForecasts = async () => {
    setLoading(true);
    let query = supabase
      .from("election_forecasts")
      .select("*")
      .eq("cycle", 2026);

    if (parsedState && parsedDistrict) {
      query = query.eq("state_abbr", parsedState).eq("district", parsedDistrict);
    }

    const { data, error } = await query.order("state_abbr").order("district");
    if (!error && data) setForecasts(data as Forecast[]);
    setLoading(false);
  };

  useEffect(() => { loadForecasts(); }, [districtId]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/forecast-sync`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "sync" }),
        }
      );
      const data = await resp.json();
      if (data.success) {
        toast.success(`Synced ${data.upserted} forecast ratings`);
        loadForecasts();
      } else {
        toast.error(data.error || "Sync failed");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleScrape = async () => {
    setScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke("forecast-scrape");
      if (error) throw error;
      if (data?.success) {
        const summary = (data.results || [])
          .map((r: any) => `${r.label}: ${r.scraped}${r.error ? ` (${r.error})` : ""}`)
          .join(", ");
        toast.success(`Scraped ${data.total_upserted} ratings. ${summary}`);
        loadForecasts();
      } else {
        toast.error(data?.error || "Scrape failed");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setScraping(false);
    }
  };

  // Group forecasts by race key
  const sources = useMemo(() => [...new Set(forecasts.map(f => f.source))].sort(), [forecasts]);

  const grouped = useMemo(() => {
    const map: Record<string, Forecast[]> = {};
    for (const f of forecasts) {
      if (raceFilter !== "all" && f.race_type !== raceFilter) continue;
      if (stateFilter && f.state_abbr !== stateFilter) continue;
      const key = `${f.race_type}|${f.state_abbr}|${f.district || ""}`;
      if (!map[key]) map[key] = [];
      map[key].push(f);
    }
    return map;
  }, [forecasts, raceFilter, stateFilter]);

  const states = useMemo(() => [...new Set(forecasts.map(f => f.state_abbr))].sort(), [forecasts]);

  // Summary counts
  const summaryByRating = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const key of Object.keys(grouped)) {
      const ratings = grouped[key].map(f => f.rating);
      const con = consensusRating(ratings);
      if (con) counts[con] = (counts[con] || 0) + 1;
    }
    return counts;
  }, [grouped]);

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <div className="flex items-center gap-2 text-muted-foreground text-sm justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading forecast models…
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Forecast Model Comparison
        </h2>
        {isAdmin && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleScrape}
              disabled={scraping || syncing}
              className="win98-button text-[10px] flex items-center gap-1"
            >
              <Globe className={`h-3 w-3 ${scraping ? "animate-spin" : ""}`} />
              {scraping ? "Scraping…" : "Scrape Latest"}
            </button>
            <button
              onClick={handleSync}
              disabled={syncing || scraping}
              className="win98-button text-[10px] flex items-center gap-1"
            >
              <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync Seeds"}
            </button>
          </div>
        )}
      </div>

      {forecasts.length === 0 ? (
        <div className="win98-sunken bg-white p-6 text-center text-[10px] text-muted-foreground">
          <span className="text-3xl block mb-2">📊</span>
          <p className="font-bold mb-1">No forecast data loaded</p>
          <p>Click "Sync Ratings" to load data from Cook, Sabato, and Inside Elections.</p>
        </div>
      ) : (
        <>
          {/* Summary bar */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {Object.entries(RATING_ORDER)
              .filter(([r]) => !r.startsWith("Safe") && !r.startsWith("Tilt"))
              .sort((a, b) => a[1] - b[1])
              .map(([rating]) => {
                const count = summaryByRating[rating] || 0;
                if (count === 0) return null;
                return (
                  <div key={rating} className="flex items-center gap-1">
                    {ratingBadge(rating)}
                    <span className="text-[10px] font-bold text-foreground">{count}</span>
                  </div>
                );
              })}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-3 w-3 text-muted-foreground" />
            <div className="flex gap-0">
              {(["all", "house", "senate", "governor"] as RaceType[]).map(rt => (
                <button
                  key={rt}
                  onClick={() => setRaceFilter(rt)}
                  className={`win98-button text-[9px] ${raceFilter === rt ? "font-bold bg-white" : ""}`}
                >
                  {rt === "all" ? "All" : rt.charAt(0).toUpperCase() + rt.slice(1)}
                </button>
              ))}
            </div>
            <select
              value={stateFilter}
              onChange={e => setStateFilter(e.target.value)}
              className="win98-input text-[10px] w-16"
            >
              <option value="">All</option>
              {states.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Table */}
          <div className="win98-sunken bg-white overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="bg-[hsl(var(--win98-face))] border-b border-[hsl(var(--win98-shadow))]">
                  <th className="text-left px-2 py-1 font-bold w-5"></th>
                  <th className="text-left px-2 py-1 font-bold">Race</th>
                  <th className="text-center px-2 py-1 font-bold">Consensus</th>
                  {sources.map(s => (
                    <th key={s} className="text-center px-2 py-1 font-bold whitespace-nowrap">
                      {s.replace("Cook Political Report", "Cook").replace("Sabato's Crystal Ball", "Sabato").replace("Inside Elections", "IE")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped)
                  .sort(([, a], [, b]) => {
                    const aAvg = consensusRating(a.map(f => f.rating));
                    const bAvg = consensusRating(b.map(f => f.rating));
                    return Math.abs(RATING_ORDER[aAvg || ""] || 99) - Math.abs(RATING_ORDER[bAvg || ""] || 99);
                  })
                  .map(([key, fcs]) => {
                    const first = fcs[0];
                    const ratingsBySource: Record<string, string | null> = {};
                    for (const f of fcs) ratingsBySource[f.source] = f.rating;
                    const con = consensusRating(Object.values(ratingsBySource));
                    const isExpanded = expandedRace === key;

                    return (
                      <tr
                        key={key}
                        onClick={() => setExpandedRace(isExpanded ? null : key)}
                        className="border-b border-[hsl(var(--win98-light))] hover:bg-[hsl(var(--win98-light))] cursor-pointer"
                      >
                        <td className="px-1 py-1">
                          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </td>
                        <td className="px-2 py-1 font-bold whitespace-nowrap">{raceLabel(first)}</td>
                        <td className="px-2 py-1 text-center">{ratingBadge(con)}</td>
                        {sources.map(s => (
                          <td key={s} className="px-2 py-1 text-center">
                            {ratingBadge(ratingsBySource[s] || null)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div className="mt-2 text-[9px] text-muted-foreground">
            {Object.keys(grouped).length} races tracked across {sources.length} sources •
            Sources: {sources.join(", ")}
          </div>
        </>
      )}
    </div>
  );
}
