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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { bill_id, scope = "national", scope_ref = null, force_refresh } = await req.json();
    if (!bill_id) return new Response(JSON.stringify({ error: "bill_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (!force_refresh) {
      const { data: cached } = await admin
        .from("bill_impact_analyses")
        .select("*")
        .eq("bill_id", bill_id)
        .eq("scope", scope)
        .eq("scope_ref", scope_ref)
        .maybeSingle();
      if (cached && (Date.now() - new Date(cached.generated_at).getTime()) < 7 * 24 * 60 * 60 * 1000) {
        return new Response(JSON.stringify({ cached: true, analysis: cached }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const { data: bill } = await admin.from("congress_bills").select("title, short_title, policy_area, latest_action_text, subjects").eq("bill_id", bill_id).maybeSingle();
    if (!bill) return new Response(JSON.stringify({ error: "Bill not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    let scopeContext = "";
    if (scope === "district" && scope_ref) {
      const { data: d } = await admin.from("district_profiles").select("*").eq("district_id", scope_ref).maybeSingle();
      if (d) scopeContext = `District ${scope_ref}: pop ${d.population}, median income $${d.median_income}, top issues: ${(d.top_issues || []).join(", ")}`;
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: "You are a legislative policy analyst. Analyze the political/fiscal impact of a bill at the requested scope. Return via tool." },
          { role: "user", content: `Bill: ${bill.title}\nShort: ${bill.short_title}\nPolicy: ${bill.policy_area}\nLatest action: ${bill.latest_action_text}\nScope: ${scope} ${scope_ref || ""}\n${scopeContext}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "analyze_bill_impact",
            description: "Structured impact analysis",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string" },
                winners: { type: "array", items: { type: "object", properties: { group: { type: "string" }, why: { type: "string" } }, required: ["group", "why"] } },
                losers: { type: "array", items: { type: "object", properties: { group: { type: "string" }, why: { type: "string" } }, required: ["group", "why"] } },
                fiscal_impact: { type: "string" },
                political_impact: { type: "string" },
                affected_groups: { type: "array", items: { type: "string" } },
              },
              required: ["summary", "winners", "losers", "fiscal_impact", "political_impact", "affected_groups"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "analyze_bill_impact" } },
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
      .from("bill_impact_analyses")
      .upsert({
        bill_id,
        scope,
        scope_ref,
        summary: args.summary,
        winners: args.winners,
        losers: args.losers,
        fiscal_impact: args.fiscal_impact,
        political_impact: args.political_impact,
        affected_groups: args.affected_groups,
        model: "google/gemini-2.5-pro",
        generated_at: new Date().toISOString(),
      }, { onConflict: "bill_id,scope,scope_ref" })
      .select()
      .single();
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    logAIGeneration(admin, {
      feature: "bill_impact",
      subject_type: "bill",
      subject_ref: `${bill_id}|${scope}|${scope_ref ?? ""}`,
      model: "google/gemini-2.5-pro",
      output: { summary: args.summary, winners: args.winners, losers: args.losers, fiscal_impact: args.fiscal_impact, political_impact: args.political_impact, affected_groups: args.affected_groups },
      triggered_by: user.id,
      trigger_source: "user",
    });

    return new Response(JSON.stringify({ cached: false, analysis: row }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
