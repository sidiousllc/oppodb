// Generates AI talking points for a messaging guidance item with optional
// cross-section context (polling, intel, legislation, finance, forecasts,
// international). Stores rows in `talking_points` with subject_type='messaging'.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const ALLOWED_MODELS = new Set([
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "google/gemini-3-flash-preview",
  "google/gemini-3.1-pro-preview",
  "openai/gpt-5",
  "openai/gpt-5-mini",
  "openai/gpt-5.2",
]);

const SECTIONS = ["polling", "intel", "legislation", "finance", "forecasts", "international"] as const;
type Section = typeof SECTIONS[number];

async function buildSectionContext(
  admin: ReturnType<typeof createClient>,
  issueAreas: string[],
  selected: Section[],
): Promise<string> {
  const tags = (issueAreas || []).filter((t) => !["Democrat","Republican","Independent"].includes(t));
  const orFilter = tags.length
    ? tags.map((t) => `title.ilike.%${t}%,summary.ilike.%${t}%`).join(",")
    : null;
  const parts: string[] = [];

  if (selected.includes("polling")) {
    let q = admin.from("polling_data").select("question, support_pct, oppose_pct, pollster, end_date").order("end_date", { ascending: false }).limit(8);
    if (tags.length) q = q.or(tags.map((t) => `question.ilike.%${t}%`).join(","));
    const { data } = await q;
    if (data?.length) parts.push(`POLLING:\n${data.map((p: any) => `- ${p.pollster} (${p.end_date}): ${p.question} → support ${p.support_pct}%, oppose ${p.oppose_pct}%`).join("\n")}`);
  }
  if (selected.includes("intel")) {
    let q = admin.from("intel_briefings").select("title, summary, source_name, published_at").order("published_at", { ascending: false }).limit(10);
    if (orFilter) q = q.or(orFilter);
    const { data } = await q;
    if (data?.length) parts.push(`INTEL BRIEFINGS:\n${data.map((b: any) => `- [${b.source_name}] ${b.title}: ${b.summary?.slice(0,200) || ""}`).join("\n")}`);
  }
  if (selected.includes("legislation")) {
    let q = admin.from("congress_bills").select("bill_id, title, latest_action_text, policy_area").order("latest_action_date", { ascending: false }).limit(8);
    if (orFilter) q = q.or(orFilter);
    const { data } = await q;
    if (data?.length) parts.push(`LEGISLATION:\n${data.map((b: any) => `- ${b.bill_id} (${b.policy_area || "n/a"}): ${b.title} — ${b.latest_action_text || ""}`).join("\n")}`);
  }
  if (selected.includes("finance")) {
    const { data } = await admin.from("campaign_finance").select("candidate_name, party, total_raised, top_industries").order("total_raised", { ascending: false }).limit(6);
    if (data?.length) parts.push(`CAMPAIGN FINANCE TOP RAISERS:\n${data.map((f: any) => `- ${f.candidate_name} (${f.party}): $${f.total_raised} raised`).join("\n")}`);
  }
  if (selected.includes("forecasts")) {
    const { data } = await admin.from("election_forecasts").select("source, race_type, state_abbr, district, rating, dem_win_prob, rep_win_prob").order("last_updated", { ascending: false }).limit(8);
    if (data?.length) parts.push(`ELECTION FORECASTS:\n${data.map((f: any) => `- [${f.source}] ${f.state_abbr}-${f.district || ""} ${f.race_type}: ${f.rating} (D ${f.dem_win_prob}% / R ${f.rep_win_prob}%)`).join("\n")}`);
  }
  if (selected.includes("international")) {
    const { data } = await admin.from("international_profiles").select("country_name, head_of_state, ruling_party").limit(5);
    if (data?.length) parts.push(`INTERNATIONAL CONTEXT:\n${data.map((c: any) => `- ${c.country_name}: ${c.head_of_state} (${c.ruling_party})`).join("\n")}`);
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

    const body = await req.json();
    const {
      messaging_slug,
      audience = "general",
      angle = "persuasion",
      tone = "professional",
      length = "medium",
      count = 5,
      include_evidence = true,
      include_sections = SECTIONS,
      custom_instructions = "",
      model = "google/gemini-2.5-pro",
    } = body;

    if (!messaging_slug) return new Response(JSON.stringify({ error: "messaging_slug required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const chosenModel = ALLOWED_MODELS.has(model) ? model : "google/gemini-2.5-pro";
    const safeCount = Math.max(1, Math.min(15, Number(count) || 5));
    const selectedSections = (Array.isArray(include_sections) ? include_sections : SECTIONS).filter((s: string) => SECTIONS.includes(s as Section)) as Section[];

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: msg } = await admin.from("messaging_guidance").select("title, source, summary, content, issue_areas, author").eq("slug", messaging_slug).maybeSingle();
    if (!msg) return new Response(JSON.stringify({ error: "Messaging guidance not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sectionContext = await buildSectionContext(admin, msg.issue_areas || [], selectedSections);

    const lengthGuide: Record<string, string> = {
      short: "Each point: 1 punchy sentence (~15 words).",
      medium: "Each point: 2-3 sentences (~40 words).",
      long: "Each point: a full paragraph (~80 words) with depth.",
    };

    const systemPrompt = [
      "You are a multi-partisan political communications strategist.",
      `Generate exactly ${safeCount} ${angle} talking points for a ${audience} audience, drawing from the messaging research and the cross-section context provided.`,
      `Tone: ${tone}.`,
      lengthGuide[length] || lengthGuide.medium,
      include_evidence ? "Include supporting evidence with source hints from the context." : "Skip evidence (return empty array).",
      custom_instructions ? `Additional user instructions: ${custom_instructions}` : "",
      "Return strictly via the provided tool.",
    ].filter(Boolean).join(" ");

    const userContent = [
      `MESSAGING ITEM: ${msg.title}`,
      `Source: ${msg.source}${msg.author ? ` — ${msg.author}` : ""}`,
      `Issue areas: ${(msg.issue_areas || []).join(", ")}`,
      `Summary: ${msg.summary || ""}`,
      "",
      "FULL GUIDANCE CONTENT:",
      (msg.content || "").slice(0, 18000),
      "",
      "CROSS-SECTION CONTEXT:",
      sectionContext || "(none requested)",
    ].join("\n");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: chosenModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_talking_points",
            description: "Return structured talking points",
            parameters: {
              type: "object",
              properties: {
                points: { type: "array", items: { type: "object", properties: {
                  message: { type: "string" }, rationale: { type: "string" }, delivery_tips: { type: "string" },
                }, required: ["message", "rationale"] } },
                evidence: { type: "array", items: { type: "object", properties: {
                  claim: { type: "string" }, source_hint: { type: "string" },
                }, required: ["claim"] } },
              },
              required: ["points", "evidence"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_talking_points" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit, please try again shortly" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "AI credits depleted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      console.error("AI error", aiResp.status, await aiResp.text());
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const aiData = await aiResp.json();
    const args = JSON.parse(aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments || "{}");

    const { data: row, error } = await admin
      .from("talking_points")
      .insert({
        subject_type: "messaging",
        subject_ref: messaging_slug,
        audience, angle,
        points: args.points || [],
        evidence: include_evidence ? (args.evidence || []) : [],
        model: chosenModel,
        generated_by: user.id,
      } as never)
      .select()
      .single();
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    return new Response(JSON.stringify({ talking_points: row }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
