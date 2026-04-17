import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Win98PageLayout } from "./Win98PageLayout";
import { Win98Window } from "./Win98Window";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { toast } from "sonner";
import { Loader2, Play, Save, Trash2 } from "lucide-react";

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

export function ForecastHub() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [aggregates, setAggregates] = useState<Aggregate[]>([]);
  const [name, setName] = useState("");
  const [raceType, setRaceType] = useState("house");
  const [swing, setSwing] = useState(0);
  const [iterations, setIterations] = useState(5000);
  const [running, setRunning] = useState(false);
  const [latestResult, setLatestResult] = useState<any>(null);

  async function load() {
    const [{ data: scens }, { data: aggs }] = await Promise.all([
      supabase.from("forecast_scenarios").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("polling_aggregates").select("*").order("computed_at", { ascending: false }).limit(50),
    ]);
    setScenarios((scens ?? []) as Scenario[]);
    setAggregates((aggs ?? []) as Aggregate[]);
  }

  useEffect(() => { load(); }, []);

  async function runSimulation(scenarioId?: string) {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("scenario-simulator", {
        body: { scenario_id: scenarioId, national_swing: swing, iterations, race_type: raceType, cycle: 2026 },
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

  async function saveScenario() {
    if (!name) { toast.error("Name required"); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { toast.error("Sign in required"); return; }
    const { data, error } = await supabase.from("forecast_scenarios").insert({
      user_id: u.user.id, name, race_type: raceType, national_swing: swing, cycle: 2026,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    toast.success("Scenario saved");
    setName("");
    load();
    if (data) runSimulation(data.id);
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

  return (
    <Win98PageLayout title="Forecast Lab">
      <div className="space-y-3">
        <Win98Window title="🎲 Scenario Simulator">
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

            <div className="flex gap-2">
              <Button size="sm" onClick={() => runSimulation()} disabled={running} className="text-[11px]">
                {running ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
                Run simulation
              </Button>
              <Button size="sm" variant="outline" onClick={saveScenario} disabled={running} className="text-[11px]">
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
        </Win98Window>

        <Tabs defaultValue="scenarios">
          <TabsList>
            <TabsTrigger value="scenarios" className="text-[11px]">Saved Scenarios ({scenarios.length})</TabsTrigger>
            <TabsTrigger value="polls" className="text-[11px]">Weighted Polling ({aggregates.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="scenarios">
            <Win98Window title="Saved scenarios">
              <div className="p-2 space-y-2">
                {scenarios.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground p-3">No saved scenarios. Configure above and click "Save & run".</div>
                ) : scenarios.map(s => (
                  <div key={s.id} className="flex items-center justify-between border-2 border-[hsl(var(--win98-shadow))] p-2 bg-[hsl(var(--win98-face))] text-[11px]">
                    <div>
                      <div className="font-bold">{s.name}</div>
                      <div className="text-muted-foreground">{s.race_type} · swing {s.national_swing?.toFixed(1) ?? 0} · {s.projected_seats?.dem_win_pct ? `${s.projected_seats.dem_win_pct.toFixed(0)}% Dem` : "not run"}</div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => runSimulation(s.id)} disabled={running} className="h-6 text-[10px]"><Play className="w-3 h-3" /></Button>
                      <Button size="sm" variant="outline" onClick={() => deleteScenario(s.id)} className="h-6 text-[10px]"><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </Win98Window>
          </TabsContent>

          <TabsContent value="polls">
            <Win98Window title="Weighted polling averages">
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
            </Win98Window>
          </TabsContent>
        </Tabs>
      </div>
    </Win98PageLayout>
  );
}
