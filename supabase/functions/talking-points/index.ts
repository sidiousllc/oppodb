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
  "openai/gpt-5",
  "openai/gpt-5-mini",
]);

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
      subject_type,
      subject_ref,
      audience = "general",
      angle = "attack",
      tone = "professional",
      length = "medium",
      count = 5,
      include_evidence = true,
      include_sections = ["polling", "intel", "legislation", "finance", "forecasts"],
      custom_instructions = "",
      model = "google/gemini-2.5-pro",
    } = body;

    if (!subject_type || !subject_ref) return new Response(JSON.stringify({ error: "subject_type and subject_ref required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const chosenModel = ALLOWED_MODELS.has(model) ? model : "google/gemini-2.5-pro";
    const safeCount = Math.max(1, Math.min(15, Number(count) || 5));
    const lengthGuide: Record<string, string> = {
      short: "Each message should be 1 punchy sentence (~15 words).",
      medium: "Each message should be 2-3 sentences (~40 words).",
      long: "Each message should be a full paragraph (~80 words) with depth.",
    };

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let context = "";
    let tagsForContext: string[] = [];
    if (subject_type === "candidate") {
      const { data } = await admin.from("candidate_profiles").select("name, content, tags").eq("slug", subject_ref).eq("is_subpage", false).maybeSingle();
      if (data) { context = `Candidate: ${data.name}\n\n${(data.content || "").slice(0, 18000)}`; tagsForContext = (data.tags as string[]) || []; }
    } else if (subject_type === "bill") {
      const { data } = await admin.from("congress_bills").select("title, short_title, latest_action_text, policy_area").eq("bill_id", subject_ref).maybeSingle();
      if (data) { context = `Bill: ${data.title}\nLatest: ${data.latest_action_text}\nPolicy: ${data.policy_area}`; tagsForContext = data.policy_area ? [data.policy_area] : []; }
    }

    // Optional cross-section context enrichment
    const VALID_SECTIONS = new Set(["polling", "intel", "legislation", "finance", "forecasts", "international"]);
    const selected = (Array.isArray(include_sections) ? include_sections : []).filter((s: string) => VALID_SECTIONS.has(s));
    if (selected.length) {
      const ctxParts: string[] = [];
      const tags = tagsForContext.filter((t) => !["Democrat","Republican","Independent"].includes(t));
      if (selected.includes("polling")) {
        let q = admin.from("polling_data").select("question, support_pct, pollster, end_date").order("end_date", { ascending: false }).limit(6);
        if (tags.length) q = q.or(tags.map((t) => `question.ilike.%${t}%`).join(","));
        const { data } = await q;
        if (data?.length) ctxParts.push(`POLLING:\n${data.map((p: any) => `- ${p.pollster} (${p.end_date}): ${p.question} → ${p.support_pct}%`).join("\n")}`);
      }
      if (selected.includes("intel") && tags.length) {
        const { data } = await admin.from("intel_briefings").select("title, source_name").or(tags.map((t) => `title.ilike.%${t}%`).join(",")).limit(5);
        if (data?.length) ctxParts.push(`INTEL:\n${data.map((b: any) => `- [${b.source_name}] ${b.title}`).join("\n")}`);
      }
      if (selected.includes("legislation") && tags.length) {
        const { data } = await admin.from("congress_bills").select("bill_id, title").or(tags.map((t) => `title.ilike.%${t}%`).join(",")).limit(5);
        if (data?.length) ctxParts.push(`LEGISLATION:\n${data.map((b: any) => `- ${b.bill_id}: ${b.title}`).join("\n")}`);
      }
      if (selected.includes("finance") && subject_type === "candidate") {
        const { data } = await admin.from("campaign_finance").select("total_raised, top_industries, cycle").eq("candidate_slug", subject_ref).order("cycle", { ascending: false }).limit(1).maybeSingle();
        if (data) ctxParts.push(`FINANCE: cycle ${data.cycle} raised $${data.total_raised}; top industries: ${JSON.stringify(data.top_industries || []).slice(0, 200)}`);
      }
      if (selected.includes("forecasts")) {
        const { data } = await admin.from("election_forecasts").select("source, state_abbr, district, rating").order("last_updated", { ascending: false }).limit(5);
        if (data?.length) ctxParts.push(`FORECASTS:\n${data.map((f: any) => `- [${f.source}] ${f.state_abbr}-${f.district || ""}: ${f.rating}`).join("\n")}`);
      }
      if (ctxParts.length) context += `\n\nCROSS-SECTION CONTEXT:\n${ctxParts.join("\n\n")}`;
    }

    const systemPrompt = [
      `You are a political communications strategist.`,
      `Generate exactly ${safeCount} ${angle} talking points for a ${audience} audience.`,
      `Tone: ${tone}.`,
      lengthGuide[length] || lengthGuide.medium,
      include_evidence ? `Provide supporting evidence with source hints.` : `Skip the evidence section (return an empty array).`,
      custom_instructions ? `Additional instructions from user: ${custom_instructions}` : "",
      `Each point must include the message, the rationale, and delivery tips. Return via tool.`,
    ].filter(Boolean).join(" ");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: chosenModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: context || `Subject: ${subject_ref}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_talking_points",
            description: "Return structured talking points",
            parameters: {
              type: "object",
              properties: {
                points: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      message: { type: "string" },
                      rationale: { type: "string" },
                      delivery_tips: { type: "string" },
                    },
                    required: ["message", "rationale"],
                  },
                },
                evidence: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      claim: { type: "string" },
                      source_hint: { type: "string" },
                    },
                    required: ["claim"],
                  },
                },
              },
              required: ["points", "evidence"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_talking_points" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "AI credits depleted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const aiData = await aiResp.json();
    const args = JSON.parse(aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments || "{}");

    const { data: row, error } = await admin
      .from("talking_points")
      .insert({
        subject_type,
        subject_ref,
        audience,
        angle,
        points: args.points || [],
        evidence: include_evidence ? (args.evidence || []) : [],
        model: chosenModel,
        generated_by: user.id,
      })
      .select()
      .single();
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    return new Response(JSON.stringify({ talking_points: row }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
