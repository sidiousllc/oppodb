// Bill-impact-style analysis for messaging guidance items, scoped national /
// state / district. Cached in messaging_impact_analyses.
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

async function buildContext(admin: ReturnType<typeof createClient>, tags: string[], selected: Section[], scope: string, scopeRef: string | null) {
  const filtered = (tags || []).filter((t) => !["Democrat","Republican","Independent"].includes(t));
  const parts: string[] = [];
  if (scope === "district" && scopeRef) {
    const { data: d } = await admin.from("district_profiles").select("*").eq("district_id", scopeRef).maybeSingle();
    if (d) parts.push(`DISTRICT ${scopeRef}: pop ${d.population}, median income $${d.median_income}, top issues: ${(d.top_issues || []).join(", ")}`);
  }
  if (scope === "state" && scopeRef) {
    const { data: stats } = await admin.from("state_voter_stats").select("*").eq("state", scopeRef).maybeSingle();
    if (stats) parts.push(`STATE ${scopeRef}: ${JSON.stringify(stats).slice(0, 600)}`);
  }
  if (selected.includes("polling")) {
    let q = admin.from("polling_data").select("question, support_pct, oppose_pct, pollster, end_date").order("end_date", { ascending: false }).limit(6);
    if (filtered.length) q = q.or(filtered.map((t) => `question.ilike.%${t}%`).join(","));
    const { data } = await q;
    if (data?.length) parts.push(`POLLING:\n${data.map((p: any) => `- ${p.pollster}: ${p.question} (support ${p.support_pct}%)`).join("\n")}`);
  }
  if (selected.includes("intel") && filtered.length) {
    const { data } = await admin.from("intel_briefings").select("title, source_name").or(filtered.map((t) => `title.ilike.%${t}%`).join(",")).limit(5);
    if (data?.length) parts.push(`INTEL:\n${data.map((b: any) => `- [${b.source_name}] ${b.title}`).join("\n")}`);
  }
  if (selected.includes("legislation") && filtered.length) {
    const { data } = await admin.from("congress_bills").select("bill_id, title").or(filtered.map((t) => `title.ilike.%${t}%`).join(",")).limit(5);
    if (data?.length) parts.push(`BILLS:\n${data.map((b: any) => `- ${b.bill_id}: ${b.title}`).join("\n")}`);
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

    const { messaging_slug, scope = "national", scope_ref = null, force_refresh, include_sections = SECTIONS, model = "google/gemini-2.5-pro" } = await req.json();
    if (!messaging_slug) return new Response(JSON.stringify({ error: "messaging_slug required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (!force_refresh) {
      let q = admin.from("messaging_impact_analyses").select("*").eq("messaging_slug", messaging_slug).eq("scope", scope);
      q = scope_ref ? q.eq("scope_ref", scope_ref) : q.is("scope_ref", null);
      const { data: cached } = await q.maybeSingle();
      if (cached && (Date.now() - new Date(cached.generated_at).getTime()) < 7 * 24 * 60 * 60 * 1000) {
        return new Response(JSON.stringify({ cached: true, analysis: cached }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const { data: msg } = await admin.from("messaging_guidance").select("title, source, summary, content, issue_areas").eq("slug", messaging_slug).maybeSingle();
    if (!msg) return new Response(JSON.stringify({ error: "Messaging item not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const selected = (Array.isArray(include_sections) ? include_sections : SECTIONS).filter((s: string) => SECTIONS.includes(s as Section)) as Section[];
    const ctx = await buildContext(admin, msg.issue_areas || [], selected, scope, scope_ref);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are a political messaging impact analyst. Analyze the political and media impact of deploying this messaging at the requested scope. Use the polling, intel, legislation, and demographic context provided. Return via tool." },
          { role: "user", content: `Item: ${msg.title}\nSource: ${msg.source}\nIssue areas: ${(msg.issue_areas || []).join(", ")}\nSummary: ${msg.summary}\nScope: ${scope} ${scope_ref || ""}\n\nCONTENT:\n${(msg.content || "").slice(0, 14000)}\n\nCONTEXT:\n${ctx}` },
        ],
        tools: [{ type: "function", function: {
          name: "analyze_messaging_impact",
          description: "Structured messaging impact",
          parameters: {
            type: "object",
            properties: {
              summary: { type: "string" },
              amplifies: { type: "array", items: { type: "object", properties: { group: { type: "string" }, why: { type: "string" } }, required: ["group", "why"] } },
              undermines: { type: "array", items: { type: "object", properties: { group: { type: "string" }, why: { type: "string" } }, required: ["group", "why"] } },
              affected_groups: { type: "array", items: { type: "string" } },
              political_impact: { type: "string" },
              media_impact: { type: "string" },
              recommended_channels: { type: "array", items: { type: "object", properties: {
                channel: { type: "string" }, rationale: { type: "string" },
              }, required: ["channel", "rationale"] } },
            },
            required: ["summary", "amplifies", "undermines", "affected_groups", "political_impact", "media_impact", "recommended_channels"],
          },
        } }],
        tool_choice: { type: "function", function: { name: "analyze_messaging_impact" } },
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

    // Manual upsert to deal with the COALESCE-based unique index
    const existing = await admin.from("messaging_impact_analyses").select("id").eq("messaging_slug", messaging_slug).eq("scope", scope).is("scope_ref", scope_ref ?? null).maybeSingle();
    let row;
    if (existing.data?.id) {
      const { data, error } = await admin.from("messaging_impact_analyses").update({
        summary: parsed.summary ?? "",
        amplifies: parsed.amplifies ?? [],
        undermines: parsed.undermines ?? [],
        affected_groups: parsed.affected_groups ?? [],
        political_impact: parsed.political_impact ?? "",
        media_impact: parsed.media_impact ?? "",
        recommended_channels: parsed.recommended_channels ?? [],
        model,
        generated_at: new Date().toISOString(),
      } as never).eq("id", existing.data.id).select().single();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      row = data;
    } else {
      const { data, error } = await admin.from("messaging_impact_analyses").insert({
        messaging_slug, scope, scope_ref,
        summary: parsed.summary ?? "",
        amplifies: parsed.amplifies ?? [],
        undermines: parsed.undermines ?? [],
        affected_groups: parsed.affected_groups ?? [],
        political_impact: parsed.political_impact ?? "",
        media_impact: parsed.media_impact ?? "",
        recommended_channels: parsed.recommended_channels ?? [],
        model,
      } as never).select().single();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      row = data;
    }

    logAIGeneration(admin, {
      feature: "messaging_impact",
      subject_type: "messaging",
      subject_ref: `${messaging_slug}|${scope}|${scope_ref ?? ""}`,
      model,
      output: { summary: parsed.summary, amplifies: parsed.amplifies, undermines: parsed.undermines, affected_groups: parsed.affected_groups, political_impact: parsed.political_impact, media_impact: parsed.media_impact, recommended_channels: parsed.recommended_channels },
      triggered_by: (typeof user !== "undefined" && (user as any)?.id) ? (user as any).id : null,
      trigger_source: "user",
    });

    return new Response(JSON.stringify({ cached: false, analysis: row }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
