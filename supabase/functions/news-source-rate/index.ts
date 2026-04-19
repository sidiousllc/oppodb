// Returns bias + factuality for source names (batch). Hybrid: DB lookup, falls back to AI classification when missing.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RatingRow {
  source_name: string;
  bias: string;
  factuality: string;
  ownership: string | null;
  rating_source: string;
  confidence: number | null;
}

async function aiClassifySources(sources: string[]): Promise<RatingRow[]> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return [];
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You are a media bias analyst. Use AdFontes/AllSides consensus. Reply ONLY via the tool." },
          { role: "user", content: `Rate these news sources: ${sources.join(", ")}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "rate_sources",
            description: "Return bias + factuality for each source",
            parameters: {
              type: "object",
              properties: {
                ratings: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      source_name: { type: "string" },
                      bias: { type: "string", enum: ["left","lean-left","center","lean-right","right","unknown"] },
                      factuality: { type: "string", enum: ["high","mostly-factual","mixed","low","very-low","unknown"] },
                      ownership: { type: "string" },
                    },
                    required: ["source_name","bias","factuality"],
                  },
                },
              },
              required: ["ratings"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "rate_sources" } },
      }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return [];
    const parsed = JSON.parse(args);
    return (parsed.ratings || []).map((r: any) => ({
      source_name: r.source_name,
      bias: r.bias,
      factuality: r.factuality,
      ownership: r.ownership || null,
      rating_source: "ai",
      confidence: 0.6,
    }));
  } catch (e) {
    console.error("ai classify failed", e);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { sources } = await req.json();
    if (!Array.isArray(sources) || sources.length === 0) {
      return new Response(JSON.stringify({ ratings: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const unique = [...new Set(sources.map((s: string) => String(s).trim()).filter(Boolean))];

    const { data: existing } = await supabase
      .from("news_source_ratings")
      .select("source_name,bias,factuality,ownership,rating_source,confidence")
      .in("source_name", unique);

    const have = new Set((existing || []).map((r: any) => r.source_name));
    const missing = unique.filter((s) => !have.has(s));

    let aiRatings: RatingRow[] = [];
    if (missing.length > 0) {
      aiRatings = await aiClassifySources(missing.slice(0, 20));
      if (aiRatings.length > 0) {
        await supabase.from("news_source_ratings").upsert(
          aiRatings.map((r) => ({ ...r, rating_source: "ai", confidence: r.confidence ?? 0.6 })),
          { onConflict: "source_name" },
        );
      }
    }

    const all: RatingRow[] = [...(existing || []) as RatingRow[], ...aiRatings];
    // Fill remaining as unknown
    for (const s of unique) {
      if (!all.find((r) => r.source_name === s)) {
        all.push({ source_name: s, bias: "unknown", factuality: "unknown", ownership: null, rating_source: "fallback", confidence: 0 });
      }
    }
    return new Response(JSON.stringify({ ratings: all }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("news-source-rate error", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
