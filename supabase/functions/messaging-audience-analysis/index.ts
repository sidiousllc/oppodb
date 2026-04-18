// Vulnerability-style audience effectiveness analysis for a messaging item.
// Cached in messaging_audience_analyses with cross-section context enrichment.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logAIGeneration } from "../_shared/ai-history.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const SECTIONS = ["polling", "intel", "legislation", "finance", "forecasts", "international"] as const;
type Section = typeof SECTIONS[number];

async function buildContext(admin: ReturnType<typeof createClient>, tags: string[], selected: Section[]) {
  const filtered = (tags || []).filter((t) => !["Democrat","Republican","Independent"].includes(t));
  const orFilter = filtered.length ? filtered.map((t) => `title.ilike.%${t}%,summary.ilike.%${t}%`).join(",") : null;
  const parts: string[] = [];
  if (selected.includes("polling")) {
    let q = admin.from("polling_data").select("question, support_pct, oppose_pct, pollster, end_date").order("end_date", { ascending: false }).limit(8);
    if (filtered.length) q = q.or(filtered.map((t) => `question.ilike.%${t}%`).join(","));
    const { data } = await q;
    if (data?.length) parts.push(`POLLING:\n${data.map((p: any) => `- ${p.pollster} (${p.end_date}): ${p.question} → support ${p.support_pct}%`).join("\n")}`);
  }
  if (selected.includes("intel") && orFilter) {
    const { data } = await admin.from("intel_briefings").select("title, summary, source_name").or(orFilter).limit(6);
    if (data?.length) parts.push(`INTEL:\n${data.map((b: any) => `- [${b.source_name}] ${b.title}`).join("\n")}`);
  }
  if (selected.includes("legislation") && orFilter) {
    const { data } = await admin.from("congress_bills").select("bill_id, title, latest_action_text").or(orFilter).limit(6);
    if (data?.length) parts.push(`LEGISLATION:\n${data.map((b: any) => `- ${b.bill_id}: ${b.title}`).join("\n")}`);
  }
  if (selected.includes("forecasts")) {
    const { data } = await admin.from("election_forecasts").select("source, state_abbr, district, rating").order("last_updated", { ascending: false }).limit(6);
    if (data?.length) parts.push(`FORECASTS:\n${data.map((f: any) => `- [${f.source}] ${f.state_abbr}-${f.district || ""}: ${f.rating}`).join("\n")}`);
  }
  return parts.join("\n\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { messaging_slug, force_refresh, include_sections = SECTIONS, model = "google/gemini-2.5-pro" } = await req.json();
    if (!messaging_slug) return new Response(JSON.stringify({ error: "messaging_slug required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (!force_refresh) {
      const { data: cached } = await admin.from("messaging_audience_analyses").select("*").eq("messaging_slug", messaging_slug).maybeSingle();
      if (cached && (Date.now() - new Date(cached.generated_at).getTime()) < 7 * 24 * 60 * 60 * 1000) {
        return new Response(JSON.stringify({ cached: true, analysis: cached }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const { data: msg } = await admin.from("messaging_guidance").select("title, source, summary, content, issue_areas, author").eq("slug", messaging_slug).maybeSingle();
    if (!msg) return new Response(JSON.stringify({ error: "Messaging item not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const selected = (Array.isArray(include_sections) ? include_sections : SECTIONS).filter((s: string) => SECTIONS.includes(s as Section)) as Section[];
    const ctx = await buildContext(admin, msg.issue_areas || [], selected);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are a political messaging effectiveness analyst. Score how this messaging item resonates with key audience segments using the polling, intel, and political context provided. Return strict JSON via tool." },
          { role: "user", content: `Item: ${msg.title}\nSource: ${msg.source}\nIssue areas: ${(msg.issue_areas || []).join(", ")}\nSummary: ${msg.summary}\n\nCONTENT:\n${(msg.content || "").slice(0, 16000)}\n\nCROSS-SECTION CONTEXT:\n${ctx}` },
        ],
        tools: [{ type: "function", function: {
          name: "score_messaging_audience",
          description: "Audience effectiveness scoring",
          parameters: {
            type: "object",
            properties: {
              effectiveness_score: { type: "number", description: "0-100 overall messaging effectiveness" },
              audience_scores: {
                type: "object",
                properties: {
                  base: { type: "number" }, swing: { type: "number" }, independents: { type: "number" },
                  press: { type: "number" }, donors: { type: "number" }, opposition: { type: "number" },
                },
              },
              segment_breakdown: { type: "array", items: { type: "object", properties: {
                segment: { type: "string" }, score: { type: "number" }, reasoning: { type: "string" },
              }, required: ["segment", "score", "reasoning"] } },
              resonance_factors: { type: "array", items: { type: "object", properties: {
                factor: { type: "string" }, impact: { type: "string", enum: ["positive", "negative", "neutral"] }, note: { type: "string" },
              }, required: ["factor", "impact"] } },
              risks: { type: "array", items: { type: "object", properties: {
                headline: { type: "string" }, severity: { type: "string", enum: ["low","medium","high","critical"] }, summary: { type: "string" },
              }, required: ["headline", "severity", "summary"] } },
              summary: { type: "string" },
            },
            required: ["effectiveness_score", "audience_scores", "segment_breakdown", "resonance_factors", "risks", "summary"],
          },
        } }],
        tool_choice: { type: "function", function: { name: "score_messaging_audience" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "AI credits depleted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      console.error("AI error", aiResp.status, await aiResp.text());
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const aiData = await aiResp.json();
    const parsed = JSON.parse(aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments || "{}");

    const { data: row, error } = await admin
      .from("messaging_audience_analyses")
      .upsert({
        messaging_slug,
        effectiveness_score: Math.max(0, Math.min(100, Number(parsed.effectiveness_score) || 0)),
        audience_scores: parsed.audience_scores ?? {},
        segment_breakdown: parsed.segment_breakdown ?? [],
        resonance_factors: parsed.resonance_factors ?? [],
        risks: parsed.risks ?? [],
        summary: parsed.summary ?? "",
        model,
        generated_at: new Date().toISOString(),
      } as never, { onConflict: "messaging_slug" })
      .select()
      .single();
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    return new Response(JSON.stringify({ cached: false, analysis: row }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
