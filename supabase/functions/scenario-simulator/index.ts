import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Convert Cook-style rating to baseline Dem win probability
const RATING_PROB: Record<string, number> = {
  "Solid D": 0.98, "Safe D": 0.97, "Likely D": 0.88, "Lean D": 0.70, "Tilt D": 0.58,
  "Toss Up": 0.50, "Tossup": 0.50, "Toss-Up": 0.50,
  "Tilt R": 0.42, "Lean R": 0.30, "Likely R": 0.12, "Safe R": 0.03, "Solid R": 0.02,
};

function clamp(x: number, min = 0.001, max = 0.999) { return Math.max(min, Math.min(max, x)); }
function logit(p: number) { return Math.log(p / (1 - p)); }
function invLogit(x: number) { return 1 / (1 + Math.exp(-x)); }

// Box-Muller normal sample
function randn(mean = 0, sd = 1) {
  const u = 1 - Math.random();
  const v = Math.random();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    if (!userData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const body = await req.json();
    const {
      scenario_id,
      national_swing = 0,
      rating_overrides = {},
      probability_overrides = {}, // { "STATE-DD": 0.0-1.0 } direct Dem prob override
      iterations = 5000,
      race_type = "house",
      cycle = 2026,
      forecast_source = "Cook Political Report",
      // Advanced tuning knobs
      regional_swings = {}, // { "MN": +2, "TX": -1 } per-state swing
      turnout_shift = 0, // -10..+10 (positive = Dem turnout advantage)
      incumbency_boost = 0, // pts added to incumbent party
      uncertainty_sd = 0.5, // per-race noise (logit space SD)
      correlation = 0.3, // 0..1 cross-race correlation (national shock)
      majority_threshold, // optional override (default house=218, senate=50)
    } = body;

    let query = supabase
      .from("election_forecasts")
      .select("*")
      .eq("race_type", race_type)
      .eq("cycle", cycle);
    if (forecast_source && forecast_source !== "all") query = query.eq("source", forecast_source);
    const { data: forecasts } = await query;

    const races = forecasts ?? [];
    if (races.length === 0) {
      return new Response(JSON.stringify({ error: "No baseline forecasts found for this source" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Dedupe by state-district (keep first / most-recent)
    const seen = new Set<string>();
    const unique = [] as any[];
    for (const r of races) {
      const k = `${r.state_abbr}-${r.district ?? ""}`;
      if (seen.has(k)) continue;
      seen.add(k);
      unique.push(r);
    }

    const adjustedRaces = unique.map((r: any) => {
      const key = r.district ? `${r.state_abbr}-${String(r.district).padStart(2, "0")}` : r.state_abbr;
      const overrideRating = rating_overrides[key];
      const baseRating = overrideRating ?? r.rating ?? "Toss Up";
      let p = probability_overrides[key] ?? RATING_PROB[baseRating] ?? 0.5;

      const regionSwing = regional_swings[r.state_abbr] ?? 0;
      const incumbentParty = (r.raw_data?.incumbent_party ?? "").toString().toUpperCase();
      const incBoost = incumbentParty === "D" ? incumbency_boost : incumbentParty === "R" ? -incumbency_boost : 0;
      const totalSwing = (national_swing + regionSwing + turnout_shift + incBoost) / 10;

      p = clamp(invLogit(logit(clamp(p)) + totalSwing));
      return { key, state: r.state_abbr, district: r.district, baseProb: p };
    });

    // Monte Carlo with correlated national shock + per-race noise
    let demWins = 0, repWins = 0;
    const seatTotalsDem: number[] = [];
    let demSeatSum = 0;
    const corr = clamp(correlation, 0, 0.95);
    const sharedSd = uncertainty_sd * Math.sqrt(corr);
    const idioSd = uncertainty_sd * Math.sqrt(1 - corr);

    for (let i = 0; i < iterations; i++) {
      const nationalShock = randn(0, sharedSd);
      let demSeats = 0;
      for (const race of adjustedRaces) {
        const noise = nationalShock + randn(0, idioSd);
        const p = clamp(invLogit(logit(clamp(race.baseProb)) + noise));
        if (Math.random() < p) demSeats++;
      }
      seatTotalsDem.push(demSeats);
      demSeatSum += demSeats;
      const threshold = majority_threshold ?? (race_type === "senate" ? 50 : race_type === "governor" ? Math.ceil(adjustedRaces.length / 2) : 218);
      if (demSeats >= threshold) demWins++;
      else repWins++;
    }
    seatTotalsDem.sort((a, b) => a - b);
    const median = seatTotalsDem[Math.floor(iterations / 2)];
    const p10 = seatTotalsDem[Math.floor(iterations * 0.1)];
    const p90 = seatTotalsDem[Math.floor(iterations * 0.9)];
    const p05 = seatTotalsDem[Math.floor(iterations * 0.05)];
    const p95 = seatTotalsDem[Math.floor(iterations * 0.95)];
    const totalSeats = adjustedRaces.length;

    // Build seat distribution histogram (binned by 5)
    const bin = race_type === "house" ? 5 : 1;
    const histogram: Record<string, number> = {};
    for (const s of seatTotalsDem) {
      const b = Math.floor(s / bin) * bin;
      histogram[b] = (histogram[b] ?? 0) + 1;
    }

    const result = {
      iterations,
      dem_win_pct: (demWins / iterations) * 100,
      rep_win_pct: (repWins / iterations) * 100,
      median_dem_seats: median,
      median_rep_seats: totalSeats - median,
      p05_dem_seats: p05,
      p10_dem_seats: p10,
      p90_dem_seats: p90,
      p95_dem_seats: p95,
      total_seats: totalSeats,
      mean_dem_seats: demSeatSum / iterations,
      histogram,
      tuning: { national_swing, turnout_shift, incumbency_boost, uncertainty_sd, correlation, forecast_source, regional_swings },
    };

    if (scenario_id) {
      await supabase.from("forecast_simulations").insert({
        scenario_id,
        user_id: userData.user.id,
        iterations,
        results: result,
        dem_win_pct: result.dem_win_pct,
        rep_win_pct: result.rep_win_pct,
        median_dem_seats: result.median_dem_seats,
        median_rep_seats: result.median_rep_seats,
      });
      await supabase.from("forecast_scenarios")
        .update({ projected_seats: result, national_swing })
        .eq("id", scenario_id);
    }

    return new Response(JSON.stringify({ success: true, result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
