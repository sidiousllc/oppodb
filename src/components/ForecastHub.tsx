import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { toast } from "sonner";
import { Loader2, Play, Save, Trash2, Database, Sparkles } from "lucide-react";

interface Scenario {
  id: string;
  name: string;
  description: string | null;
  cycle: number;
  race_type: string;
  national_swing: number | null;
  projected_seats: any;
  is_shared: boolean;
  rating_overrides: any;
  assumptions: any;
  created_at: string;
}

interface Aggregate {
  race_type: string;
  state_abbr: string;
  district: string | null;
  candidate_a: string | null;
  candidate_b: string | null;
  margin: number | null;
  candidate_a_pct: number | null;
  candidate_b_pct: number | null;
  poll_count: number;
  trend_30d: number | null;
  last_poll_date: string | null;
}

interface Forecast {
  id: string;
  source: string;
  race_type: string;
  state_abbr: string;
  district: string | null;
  rating: string | null;
  dem_win_prob: number | null;
  rep_win_prob: number | null;
  margin: number | null;
  cycle: number;
  last_updated: string | null;
}

interface Market {
  id: string;
  title: string;
  source: string;
  category: string;
  state_abbr: string | null;
  district: string | null;
  yes_price: number | null;
  no_price: number | null;
  volume: number | null;
  market_url: string | null;
}

const RATING_TO_SWING: Record<string, number> = {
  "Solid D": -8, "Likely D": -5, "Lean D": -2, "Tilt D": -1,
  "Toss Up": 0, "Tossup": 0, "Toss-Up": 0,
  "Tilt R": 1, "Lean R": 2, "Likely R": 5, "Solid R": 8,
};

export function ForecastHub() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [aggregates, setAggregates] = useState<Aggregate[]>([]);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [name, setName] = useState("");
  const [raceType, setRaceType] = useState("house");
  const [swing, setSwing] = useState(0);
  const [iterations, setIterations] = useState(5000);
  const [running, setRunning] = useState(false);
  const [latestResult, setLatestResult] = useState<any>(null);
  const [forecastSource, setForecastSource] = useState<string>("all");
  // Advanced tuning
  const [turnoutShift, setTurnoutShift] = useState(0);
  const [incumbencyBoost, setIncumbencyBoost] = useState(0);
  const [uncertaintySd, setUncertaintySd] = useState(0.5);
  const [correlation, setCorrelation] = useState(0.3);
  const [simSource, setSimSource] = useState<string>("Cook Political Report");
  const [regionalText, setRegionalText] = useState(""); // "MN:+2,TX:-1"
  const [overridesText, setOverridesText] = useState(""); // "MN-05:Lean D,TX-15:Toss Up"
  const [thresholdOverride, setThresholdOverride] = useState<string>("");

  async function load() {
    const [{ data: scens }, { data: aggs }, { data: fc }, { data: mk }] = await Promise.all([
      supabase.from("forecast_scenarios").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("polling_aggregates").select("*").order("computed_at", { ascending: false }).limit(50),
      supabase.from("election_forecasts").select("id,source,race_type,state_abbr,district,rating,dem_win_prob,rep_win_prob,margin,cycle,last_updated").eq("cycle", 2026).order("last_updated", { ascending: false }).limit(500),
      supabase.from("prediction_markets").select("id,title,source,category,state_abbr,district,yes_price,no_price,volume,market_url").eq("status", "active").order("volume", { ascending: false }).limit(100),
    ]);
    setScenarios((scens ?? []) as Scenario[]);
    setAggregates((aggs ?? []) as Aggregate[]);
    setForecasts((fc ?? []) as Forecast[]);
    setMarkets((mk ?? []) as Market[]);
  }

  useEffect(() => { load(); }, []);

  function parseRegional(): Record<string, number> {
    const out: Record<string, number> = {};
    regionalText.split(",").map(s => s.trim()).filter(Boolean).forEach(pair => {
      const [k, v] = pair.split(":").map(s => s.trim());
      const n = parseFloat(v);
      if (k && !isNaN(n)) out[k.toUpperCase()] = n;
    });
    return out;
  }

  function parseManualOverrides(): Record<string, string> {
    const out: Record<string, string> = {};
    overridesText.split(",").map(s => s.trim()).filter(Boolean).forEach(pair => {
      const [k, v] = pair.split(":").map(s => s.trim());
      if (k && v) out[k.toUpperCase()] = v;
    });
    return out;
  }

  async function runSimulation(scenarioId?: string, overrides?: Record<string, string>) {
    setRunning(true);
    try {
      const merged = { ...(overrides || {}), ...parseManualOverrides() };
      const { data, error } = await supabase.functions.invoke("scenario-simulator", {
        body: {
          scenario_id: scenarioId,
          national_swing: swing,
          iterations,
          race_type: raceType,
          cycle: 2026,
          rating_overrides: Object.keys(merged).length ? merged : undefined,
          forecast_source: simSource,
          turnout_shift: turnoutShift,
          incumbency_boost: incumbencyBoost,
          uncertainty_sd: uncertaintySd,
          correlation,
          regional_swings: parseRegional(),
          majority_threshold: thresholdOverride ? parseInt(thresholdOverride) : undefined,
        },
      });
      if (error) throw error;
      setLatestResult(data?.result);
      toast.success("Simulation complete");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Simulation failed");
    } finally {
      setRunning(false);
    }
  }

  async function saveScenario(extra?: Partial<{ rating_overrides: any; assumptions: any; description: string }>) {
    if (!name) { toast.error("Name required"); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { toast.error("Sign in required"); return; }
    const { data, error } = await supabase.from("forecast_scenarios").insert({
      user_id: u.user.id, name, race_type: raceType, national_swing: swing, cycle: 2026,
      rating_overrides: extra?.rating_overrides ?? {},
      assumptions: extra?.assumptions ?? {},
      description: extra?.description ?? null,
    } as any).select().single();
    if (error) { toast.error(error.message); return; }
    toast.success("Scenario saved");
    setName("");
    load();
    if (data) runSimulation(data.id, extra?.rating_overrides);
  }

  async function deleteScenario(id: string) {
    const { error } = await supabase.from("forecast_scenarios").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); load(); }
  }

  async function recomputeAggregates() {
    setRunning(true);
    try {
      const { error } = await supabase.functions.invoke("polling-aggregator", { body: {} });
      if (error) throw error;
      toast.success("Polling aggregates rebuilt");
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  }

  // ---------- DataHub seeding ----------
  const filteredForecasts = useMemo(() => {
    return forecasts
      .filter((f) => f.race_type === raceType)
      .filter((f) => forecastSource === "all" ? true : f.source === forecastSource);
  }, [forecasts, raceType, forecastSource]);

  const forecastSources = useMemo(
    () => ["all", ...Array.from(new Set(forecasts.map((f) => f.source))).sort()],
    [forecasts]
  );

  function buildOverridesFromForecasts(): Record<string, string> {
    // Use the latest forecast per (state, district) for the chosen race type as rating overrides.
    const overrides: Record<string, string> = {};
    for (const f of filteredForecasts) {
      if (!f.rating) continue;
      const key = f.district ? `${f.state_abbr}-${f.district.padStart(2, "0")}` : f.state_abbr;
      if (!overrides[key]) overrides[key] = f.rating; // first wins (most recently updated due to order)
    }
    return overrides;
  }

  function seedScenarioFromForecasts() {
    const overrides = buildOverridesFromForecasts();
    const count = Object.keys(overrides).length;
    if (count === 0) {
      toast.error("No forecasts available for this race type");
      return;
    }
    const labelSrc = forecastSource === "all" ? "consensus" : forecastSource;
    setName(`${labelSrc} ${raceType} ${new Date().toLocaleDateString()}`);
    toast.success(`Seeded ${count} race ratings — click "Save & run" to simulate`);
    saveScenario({
      rating_overrides: overrides,
      assumptions: { seeded_from: "election_forecasts", source: forecastSource, count },
      description: `Auto-seeded from ${labelSrc} ratings (${count} races)`,
    });
  }

  function seedScenarioFromMarkets() {
    // Convert prediction-market YES prices into a swing override per race.
    // Yes price ~0.5 = toss-up; >0.5 favors the named candidate.
    const relevant = markets.filter((m) => m.category === raceType);
    if (relevant.length === 0) {
      toast.error("No active markets for this race type");
      return;
    }
    // We can't reliably derive party from market alone — store as assumptions for simulator.
    setName(`Markets ${raceType} ${new Date().toLocaleDateString()}`);
    saveScenario({
      assumptions: {
        seeded_from: "prediction_markets",
        market_count: relevant.length,
        markets: relevant.slice(0, 50).map((m) => ({
          id: m.id, title: m.title, yes: m.yes_price, state: m.state_abbr, district: m.district,
        })),
      },
      description: `Auto-seeded from ${relevant.length} active prediction markets`,
    });
  }

  function seedScenarioFromPolling() {
    const relevant = aggregates.filter((a) => a.race_type === raceType);
    if (relevant.length === 0) {
      toast.error("No polling aggregates for this race type — try Rebuild first");
      return;
    }
    // Average margin → infer national swing toward Dems (positive margin = Dem lead in our schema).
    const validMargins = relevant.filter((a) => typeof a.margin === "number");
    const avgMargin = validMargins.length
      ? validMargins.reduce((s, a) => s + (a.margin || 0), 0) / validMargins.length
      : 0;
    setSwing(Math.round(avgMargin * 10) / 10);
    setName(`Polling avg ${raceType} ${new Date().toLocaleDateString()}`);
    saveScenario({
      assumptions: {
        seeded_from: "polling_aggregates",
        race_count: relevant.length,
        avg_margin: avgMargin,
      },
      description: `Auto-seeded from ${relevant.length} polling aggregates (avg margin ${avgMargin.toFixed(1)})`,
    });
  }

  return (
      <div className="space-y-3">
        <div className="win98-raised bg-[hsl(var(--win98-face))]">
          <div className="px-2 py-1 text-[11px] font-bold border-b border-b-[hsl(var(--win98-shadow))]">🎲 Scenario Simulator</div>
          <div className="p-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px]">Scenario name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Red wave +3" className="h-7 text-[11px]" />
              </div>
              <div>
                <Label className="text-[11px]">Race type</Label>
                <Select value={raceType} onValueChange={setRaceType}>
                  <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="house">House (435 seats)</SelectItem>
                    <SelectItem value="senate">Senate</SelectItem>
                    <SelectItem value="governor">Governor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-[11px]">National swing toward Dems: {swing > 0 ? "+" : ""}{swing.toFixed(1)} pts</Label>
              <Slider value={[swing]} min={-10} max={10} step={0.5} onValueChange={(v) => setSwing(v[0])} className="mt-2" />
            </div>

            <div>
              <Label className="text-[11px]">Monte Carlo iterations: {iterations.toLocaleString()}</Label>
              <Slider value={[iterations]} min={1000} max={20000} step={1000} onValueChange={(v) => setIterations(v[0])} className="mt-2" />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => runSimulation()} disabled={running} className="text-[11px]">
                {running ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
                Run simulation
              </Button>
              <Button size="sm" variant="outline" onClick={() => saveScenario()} disabled={running} className="text-[11px]">
                <Save className="w-3 h-3 mr-1" /> Save & run
              </Button>
            </div>

            {latestResult && (
              <div className="border-2 border-[hsl(var(--win98-shadow))] bg-[hsl(var(--win98-face))] p-3 text-[11px] space-y-1">
                <div className="font-bold mb-2">Results</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>Dem majority odds: <span className="font-bold">{latestResult.dem_win_pct?.toFixed(1)}%</span></div>
                  <div>Rep majority odds: <span className="font-bold">{latestResult.rep_win_pct?.toFixed(1)}%</span></div>
                  <div>Median Dem seats: <span className="font-bold">{latestResult.median_dem_seats}</span></div>
                  <div>Median Rep seats: <span className="font-bold">{latestResult.median_rep_seats}</span></div>
                  <div>10th pctile (Dem): {latestResult.p10_dem_seats}</div>
                  <div>90th pctile (Dem): {latestResult.p90_dem_seats}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <Tabs defaultValue="datahub">
          <TabsList>
            <TabsTrigger value="datahub" className="text-[11px]"><Database className="w-3 h-3 mr-1" />DataHub Sources</TabsTrigger>
            <TabsTrigger value="scenarios" className="text-[11px]">Saved Scenarios ({scenarios.length})</TabsTrigger>
            <TabsTrigger value="polls" className="text-[11px]">Weighted Polling ({aggregates.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="datahub">
            <div className="space-y-3">
              {/* Seed actions */}
              <div className="win98-raised bg-[hsl(var(--win98-face))]">
                <div className="px-2 py-1 text-[11px] font-bold border-b border-b-[hsl(var(--win98-shadow))] flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Seed Scenario from DataHub
                </div>
                <div className="p-3 space-y-2 text-[11px]">
                  <p className="text-muted-foreground">
                    Pre-populate a scenario using live data from forecasts, prediction markets, or polling aggregates.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={seedScenarioFromForecasts} disabled={running} className="text-[11px]">
                      📈 From Forecasts ({filteredForecasts.length})
                    </Button>
                    <Button size="sm" variant="outline" onClick={seedScenarioFromMarkets} disabled={running} className="text-[11px]">
                      💹 From Markets ({markets.filter(m => m.category === raceType).length})
                    </Button>
                    <Button size="sm" variant="outline" onClick={seedScenarioFromPolling} disabled={running} className="text-[11px]">
                      📊 From Polling ({aggregates.filter(a => a.race_type === raceType).length})
                    </Button>
                  </div>
                </div>
              </div>

              {/* Election Forecasts panel */}
              <div className="win98-raised bg-[hsl(var(--win98-face))]">
                <div className="px-2 py-1 text-[11px] font-bold border-b border-b-[hsl(var(--win98-shadow))] flex items-center justify-between gap-2">
                  <span>📈 Election Forecasts (2026 · {raceType})</span>
                  <Select value={forecastSource} onValueChange={setForecastSource}>
                    <SelectTrigger className="h-6 text-[10px] w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {forecastSources.map((s) => (
                        <SelectItem key={s} value={s} className="text-[10px]">{s === "all" ? "All sources" : s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="p-2 max-h-[260px] overflow-y-auto">
                  {filteredForecasts.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground p-2">No forecasts loaded for this race type.</div>
                  ) : (
                    <table className="w-full text-[10px]">
                      <thead className="bg-[hsl(var(--win98-face))] sticky top-0">
                        <tr><th className="text-left p-1">Race</th><th className="text-left p-1">Source</th><th className="text-left p-1">Rating</th><th className="text-left p-1">Dem%</th><th className="text-left p-1">Rep%</th><th className="text-left p-1">Margin</th></tr>
                      </thead>
                      <tbody>
                        {filteredForecasts.slice(0, 200).map((f) => (
                          <tr key={f.id} className="border-t border-[hsl(var(--win98-shadow))]">
                            <td className="p-1 font-mono">{f.state_abbr}{f.district ? `-${f.district.padStart(2, "0")}` : ""}</td>
                            <td className="p-1">{f.source}</td>
                            <td className="p-1 font-bold">{f.rating ?? "—"}</td>
                            <td className="p-1">{f.dem_win_prob != null ? `${(f.dem_win_prob * 100).toFixed(0)}%` : "—"}</td>
                            <td className="p-1">{f.rep_win_prob != null ? `${(f.rep_win_prob * 100).toFixed(0)}%` : "—"}</td>
                            <td className="p-1">{f.margin != null ? f.margin.toFixed(1) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Prediction Markets panel */}
              <div className="win98-raised bg-[hsl(var(--win98-face))]">
                <div className="px-2 py-1 text-[11px] font-bold border-b border-b-[hsl(var(--win98-shadow))]">
                  💹 Prediction Markets ({markets.filter(m => m.category === raceType).length} · {raceType})
                </div>
                <div className="p-2 max-h-[220px] overflow-y-auto">
                  {markets.filter(m => m.category === raceType).length === 0 ? (
                    <div className="text-[11px] text-muted-foreground p-2">No active markets for this race type.</div>
                  ) : (
                    <table className="w-full text-[10px]">
                      <thead className="bg-[hsl(var(--win98-face))] sticky top-0">
                        <tr><th className="text-left p-1">Market</th><th className="text-left p-1">Source</th><th className="text-left p-1">Race</th><th className="text-left p-1">YES</th><th className="text-left p-1">Vol</th></tr>
                      </thead>
                      <tbody>
                        {markets.filter(m => m.category === raceType).slice(0, 100).map((m) => (
                          <tr key={m.id} className="border-t border-[hsl(var(--win98-shadow))]">
                            <td className="p-1 truncate max-w-[260px]" title={m.title}>
                              {m.market_url ? (
                                <a href={m.market_url} target="_blank" rel="noopener noreferrer" className="underline">{m.title}</a>
                              ) : m.title}
                            </td>
                            <td className="p-1">{m.source}</td>
                            <td className="p-1 font-mono">{m.state_abbr ?? ""}{m.district ? `-${m.district.padStart(2, "0")}` : ""}</td>
                            <td className="p-1 font-bold">{m.yes_price != null ? `${(m.yes_price * 100).toFixed(0)}¢` : "—"}</td>
                            <td className="p-1">{m.volume != null ? `$${Math.round(m.volume).toLocaleString()}` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="scenarios">
            <div className="win98-raised bg-[hsl(var(--win98-face))]">
              <div className="px-2 py-1 text-[11px] font-bold border-b border-b-[hsl(var(--win98-shadow))]">Saved scenarios</div>
              <div className="p-2 space-y-2">
                {scenarios.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground p-3">No saved scenarios. Configure above and click "Save & run", or seed from DataHub.</div>
                ) : scenarios.map(s => (
                  <div key={s.id} className="flex items-center justify-between border-2 border-[hsl(var(--win98-shadow))] p-2 bg-[hsl(var(--win98-face))] text-[11px]">
                    <div>
                      <div className="font-bold">{s.name}</div>
                      <div className="text-muted-foreground">{s.race_type} · swing {s.national_swing?.toFixed(1) ?? 0} · {s.projected_seats?.dem_win_pct ? `${s.projected_seats.dem_win_pct.toFixed(0)}% Dem` : "not run"}</div>
                      {s.description && <div className="text-[10px] text-muted-foreground italic">{s.description}</div>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => runSimulation(s.id, s.rating_overrides)} disabled={running} className="h-6 text-[10px]"><Play className="w-3 h-3" /></Button>
                      <Button size="sm" variant="outline" onClick={() => deleteScenario(s.id)} className="h-6 text-[10px]"><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="polls">
            <div className="win98-raised bg-[hsl(var(--win98-face))]">
              <div className="px-2 py-1 text-[11px] font-bold border-b border-b-[hsl(var(--win98-shadow))]">Weighted polling averages</div>
              <div className="p-2">
                <Button size="sm" onClick={recomputeAggregates} disabled={running} className="text-[11px] mb-2">
                  {running ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                  Rebuild aggregates
                </Button>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead className="bg-[hsl(var(--win98-face))]">
                      <tr><th className="text-left p-1">Race</th><th className="text-left p-1">A</th><th className="text-left p-1">B</th><th className="text-left p-1">Margin</th><th className="text-left p-1">Trend 30d</th><th className="text-left p-1">N polls</th></tr>
                    </thead>
                    <tbody>
                      {aggregates.map((a, i) => (
                        <tr key={i} className="border-t border-[hsl(var(--win98-shadow))]">
                          <td className="p-1">{a.state_abbr}{a.district ? `-${a.district}` : ""} ({a.race_type})</td>
                          <td className="p-1">{a.candidate_a ?? "—"} {a.candidate_a_pct?.toFixed(1)}</td>
                          <td className="p-1">{a.candidate_b ?? "—"} {a.candidate_b_pct?.toFixed(1)}</td>
                          <td className="p-1 font-bold">{a.margin ? (a.margin > 0 ? "+" : "") + a.margin.toFixed(1) : "—"}</td>
                          <td className="p-1">{a.trend_30d ? (a.trend_30d > 0 ? "↑" : "↓") + Math.abs(a.trend_30d).toFixed(1) : "—"}</td>
                          <td className="p-1">{a.poll_count}</td>
                        </tr>
                      ))}
                      {aggregates.length === 0 && <tr><td colSpan={6} className="p-3 text-center text-muted-foreground">No aggregates yet. Click "Rebuild" to compute.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
  );
}
