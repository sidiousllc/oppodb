// Cluster recent intel briefings into stories using title shingles + AI tie-breaking. Flags blindspots.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STOP = new Set(["the","a","an","of","in","on","at","to","for","and","or","but","is","are","was","were","be","by","with","from","as","it","this","that","these","those","new","says","said"]);

function tokens(s: string): string[] {
  return (s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((t) => t.length > 3 && !STOP.has(t));
}
function shingles(s: string): Set<string> {
  return new Set(tokens(s));
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

const BIAS_BUCKET: Record<string, "L" | "C" | "R" | "U"> = {
  left: "L", "lean-left": "L",
  center: "C",
  right: "R", "lean-right": "R",
  unknown: "U",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const scope = body.scope || null;
    const hours = Math.min(Number(body.hours) || 48, 168);
    const minCluster = Math.max(Number(body.min_cluster) || 2, 2);
    const blindspotThreshold = Number(body.blindspot_threshold) || 0.15; // <15% of one side

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    let q = supabase
      .from("intel_briefings")
      .select("id, scope, category, title, summary, source_name, published_at, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(800);
    if (scope) q = q.eq("scope", scope);
    const { data: briefings, error } = await q;
    if (error) throw error;
    if (!briefings || briefings.length === 0) {
      return new Response(JSON.stringify({ clustered: 0, stories: 0, blindspots: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get bias for sources
    const sources = [...new Set(briefings.map((b: any) => b.source_name))];
    const { data: ratings } = await supabase.from("news_source_ratings").select("source_name,bias").in("source_name", sources);
    const biasOf = new Map<string, string>();
    for (const r of ratings || []) biasOf.set(r.source_name, r.bias);

    // Greedy clustering by title jaccard
    const items = briefings.map((b: any) => ({ ...b, sh: shingles(b.title || "") }));
    const clusters: any[][] = [];
    for (const it of items) {
      let bestIdx = -1, bestSim = 0.35;
      for (let i = 0; i < clusters.length; i++) {
        const sim = jaccard(it.sh, clusters[i][0].sh);
        if (sim > bestSim) { bestSim = sim; bestIdx = i; }
      }
      if (bestIdx >= 0) clusters[bestIdx].push(it);
      else clusters.push([it]);
    }

    const valid = clusters.filter((c) => c.length >= minCluster);

    // Replace existing recent stories (simple refresh)
    await supabase.from("news_stories").delete().gte("created_at", since);

    let blindspotCount = 0;
    for (const cluster of valid) {
      const counts = { L: 0, C: 0, R: 0, U: 0 };
      const articleRows: any[] = [];
      for (const a of cluster) {
        const b = biasOf.get(a.source_name) || "unknown";
        const bucket = BIAS_BUCKET[b] || "U";
        counts[bucket]++;
        articleRows.push({ briefing_id: a.id, source_name: a.source_name, bias: b });
      }
      const totalRated = counts.L + counts.C + counts.R;
      const lp = totalRated > 0 ? counts.L / totalRated : 0;
      const cp = totalRated > 0 ? counts.C / totalRated : 0;
      const rp = totalRated > 0 ? counts.R / totalRated : 0;

      let isBlind = false;
      let blindSide: "left" | "right" | "center" | null = null;
      if (totalRated >= 3) {
        if (lp < blindspotThreshold && rp > 0.4) { isBlind = true; blindSide = "left"; }
        else if (rp < blindspotThreshold && lp > 0.4) { isBlind = true; blindSide = "right"; }
      }
      if (isBlind) blindspotCount++;

      const head = cluster[0];
      const topKeywords = [...head.sh].slice(0, 8);

      const { data: story, error: insErr } = await supabase
        .from("news_stories")
        .insert({
          title: head.title,
          summary: head.summary || null,
          scope: head.scope,
          category: head.category,
          topic_keywords: topKeywords,
          article_count: cluster.length,
          left_count: counts.L,
          center_count: counts.C,
          right_count: counts.R,
          unrated_count: counts.U,
          left_pct: Math.round(lp * 10000) / 100,
          center_pct: Math.round(cp * 10000) / 100,
          right_pct: Math.round(rp * 10000) / 100,
          is_blindspot: isBlind,
          blindspot_side: blindSide,
        })
        .select("id")
        .single();
      if (insErr || !story) { console.error("story insert err", insErr); continue; }

      const links = articleRows.map((a) => ({ story_id: story.id, ...a }));
      if (links.length > 0) {
        await supabase.from("news_story_articles").insert(links);
      }
    }

    return new Response(
      JSON.stringify({ briefings: briefings.length, stories: valid.length, blindspots: blindspotCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("news-cluster-stories error", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
