import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Convert Cook-style rating to baseline Dem win probability
const RATING_PROB: Record<string, number> = {
  "Solid D": 0.98, "Safe D": 0.97, "Likely D": 0.88, "Lean D": 0.70, "Tilt D": 0.58,
  "Toss Up": 0.50,
  "Tilt R": 0.42, "Lean R": 0.30, "Likely R": 0.12, "Safe R": 0.03, "Solid R": 0.02,
};

function clamp(x: number, min = 0.001, max = 0.999) { return Math.max(min, Math.min(max, x)); }

function logit(p: number) { return Math.log(p / (1 - p)); }
function invLogit(x: number) { return 1 / (1 + Math.exp(-x)); }

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
    const { scenario_id, national_swing = 0, rating_overrides = {}, iterations = 5000, race_type = "house", cycle = 2026 } = body;

    // Fetch baseline forecasts (use Cook ratings as primary)
    const { data: forecasts } = await supabase
      .from("election_forecasts")
      .select("*")
      .eq("race_type", race_type)
      .eq("cycle", cycle)
      .eq("source", "Cook Political Report");

    const races = forecasts ?? [];
    if (races.length === 0) {
      return new Response(JSON.stringify({ error: "No baseline forecasts found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Compute per-race adjusted Dem probability
    const adjustedRaces = races.map((r: any) => {
      const key = `${r.state_abbr}-${r.district ?? ""}`;
      const overrideRating = rating_overrides[key];
      const baseRating = overrideRating ?? r.rating ?? "Toss Up";
      let p = RATING_PROB[baseRating] ?? 0.5;
      // Apply national swing in logit space (Dem positive)
      p = clamp(invLogit(logit(clamp(p)) + (national_swing / 10)));
      return { key, state: r.state_abbr, district: r.district, baseProb: p };
    });

    // Monte Carlo
    let demWins = 0, repWins = 0;
    const seatTotalsDem: number[] = [];
    let demSeatSum = 0;
    for (let i = 0; i < iterations; i++) {
      let demSeats = 0;
      for (const race of adjustedRaces) {
        if (Math.random() < race.baseProb) demSeats++;
      }
      seatTotalsDem.push(demSeats);
      demSeatSum += demSeats;
      // House majority threshold = 218 (out of 435). For Senate use 51 / 50+VP
      const threshold = race_type === "senate" ? 50 : 218;
      if (demSeats >= threshold) demWins++;
      else repWins++;
    }
    seatTotalsDem.sort((a, b) => a - b);
    const median = seatTotalsDem[Math.floor(iterations / 2)];
    const p10 = seatTotalsDem[Math.floor(iterations * 0.1)];
    const p90 = seatTotalsDem[Math.floor(iterations * 0.9)];
    const totalSeats = adjustedRaces.length;

    const result = {
      iterations,
      dem_win_pct: (demWins / iterations) * 100,
      rep_win_pct: (repWins / iterations) * 100,
      median_dem_seats: median,
      median_rep_seats: totalSeats - median,
      p10_dem_seats: p10,
      p90_dem_seats: p90,
      total_seats: totalSeats,
      mean_dem_seats: demSeatSum / iterations,
    };

    // Persist if scenario_id provided
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
