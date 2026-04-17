import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Pollster rating weights (0-1). Higher = better methodology
const POLLSTER_WEIGHTS: Record<string, number> = {
  "Marist": 0.95, "Selzer": 0.97, "Quinnipiac": 0.92, "Monmouth": 0.93, "Siena/NYT": 0.96,
  "ABC/Washington Post": 0.94, "Fox News": 0.85, "CNN/SSRS": 0.88, "NBC News": 0.87,
  "Pew Research": 0.92, "Emerson": 0.78, "Suffolk": 0.83, "InsiderAdvantage": 0.65,
  "Trafalgar": 0.62, "Rasmussen": 0.55, "Harris X": 0.70, "YouGov": 0.86, "Echelon Insights": 0.75,
};

function getWeight(pollster: string): number {
  if (!pollster) return 0.5;
  for (const [name, w] of Object.entries(POLLSTER_WEIGHTS)) {
    if (pollster.toLowerCase().includes(name.toLowerCase())) return w;
  }
  return 0.6;
}

function recencyWeight(daysOld: number): number {
  // Exponential decay: half-life of 21 days
  return Math.exp(-daysOld / 21);
}

function sampleWeight(sampleSize: number): number {
  if (!sampleSize) return 0.5;
  // Diminishing returns sqrt
  return Math.min(1.0, Math.sqrt(sampleSize) / 35);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch all polls from past 90 days
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];
    const { data: polls } = await supabase
      .from("polling_data")
      .select("*")
      .gte("end_date", cutoff)
      .limit(5000);

    const polled = polls ?? [];
    // Group by race key
    const groups = new Map<string, any[]>();
    for (const p of polled) {
      const key = `${p.race_type ?? "general"}|${p.state ?? ""}|${p.district ?? ""}|${p.cycle ?? 2026}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }

    let upserted = 0;
    const today = new Date();
    for (const [key, list] of groups.entries()) {
      const [race_type, state_abbr, district, cycleStr] = key.split("|");
      if (!state_abbr) continue;

      let totalWeight = 0;
      let weightedA = 0, weightedB = 0, weightedUnd = 0;
      let candA = "", candB = "";
      let lastDate = "";
      for (const p of list) {
        const days = Math.max(0, (today.getTime() - new Date(p.end_date ?? p.created_at).getTime()) / 86400000);
        const w = getWeight(p.pollster ?? "") * recencyWeight(days) * sampleWeight(p.sample_size ?? 0);
        const a = Number(p.candidate_a_pct ?? p.approve_pct ?? 0);
        const b = Number(p.candidate_b_pct ?? p.disapprove_pct ?? 0);
        const u = Number(p.undecided_pct ?? Math.max(0, 100 - a - b));
        weightedA += a * w; weightedB += b * w; weightedUnd += u * w;
        totalWeight += w;
        if (!candA && p.candidate_a) candA = p.candidate_a;
        if (!candB && p.candidate_b) candB = p.candidate_b;
        if (!lastDate || (p.end_date && p.end_date > lastDate)) lastDate = p.end_date;
      }
      if (totalWeight === 0) continue;

      const aPct = weightedA / totalWeight;
      const bPct = weightedB / totalWeight;
      const uPct = weightedUnd / totalWeight;

      // 30-day trend: compare last 30d avg to prior 30-60d avg
      const split30 = new Date(today.getTime() - 30 * 86400000);
      const recent = list.filter(p => new Date(p.end_date ?? p.created_at) >= split30);
      const prior = list.filter(p => new Date(p.end_date ?? p.created_at) < split30);
      const recentAvg = recent.length ? recent.reduce((s, p) => s + (Number(p.candidate_a_pct ?? 0) - Number(p.candidate_b_pct ?? 0)), 0) / recent.length : 0;
      const priorAvg = prior.length ? prior.reduce((s, p) => s + (Number(p.candidate_a_pct ?? 0) - Number(p.candidate_b_pct ?? 0)), 0) / prior.length : 0;
      const trend = recentAvg - priorAvg;

      const { error } = await supabase.from("polling_aggregates").upsert({
        race_type, state_abbr, district: district || null, cycle: parseInt(cycleStr) || 2026,
        candidate_a: candA || null, candidate_b: candB || null,
        margin: aPct - bPct,
        candidate_a_pct: aPct, candidate_b_pct: bPct, undecided_pct: uPct,
        poll_count: list.length, weighted_method: "pollster_rating",
        last_poll_date: lastDate || null, trend_30d: trend,
        computed_at: new Date().toISOString(),
      }, { onConflict: "race_type,state_abbr,district,cycle" });
      if (!error) upserted++;
    }

    return new Response(JSON.stringify({ success: true, upserted, groups: groups.size }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
