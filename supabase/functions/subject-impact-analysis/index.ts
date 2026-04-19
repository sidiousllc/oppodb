// Generic impact analysis for District Intel / State Legislative Districts /
// Legislation bills. Cached in subject_impact_analyses (scoped national/state/district).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const ALLOWED_SUBJECTS = new Set(["district", "state_leg", "legislation", "polling", "country"]);
const ALLOWED_MODELS = new Set([
  "google/gemini-2.5-pro", "google/gemini-2.5-flash", "google/gemini-2.5-flash-lite",
  "google/gemini-3-flash-preview", "google/gemini-3.1-pro-preview",
  "openai/gpt-5", "openai/gpt-5-mini", "openai/gpt-5.2",
]);
const DEFAULT_MODEL = "google/gemini-2.5-flash";
const SECTIONS = ["polling", "intel", "legislation", "finance", "forecasts", "international", "demographics"] as const;
type Section = typeof SECTIONS[number];

type SAdmin = ReturnType<typeof createClient>;

async function loadSubject(admin: SAdmin, subject_type: string, subject_ref: string) {
  if (subject_type === "district") {
    const { data } = await admin.from("district_profiles").select("*").eq("district_id", subject_ref.toUpperCase()).maybeSingle();
    if (!data) return null;
    return { title: `Congressional District ${data.district_id}`, summary: `${data.state} pop ${data.population}`, content: JSON.stringify(data).slice(0, 10000), tags: data.top_issues || [], state_abbr: data.district_id.split("-")[0] };
  }
  if (subject_type === "state_leg") {
    const { data } = await admin.from("state_legislative_profiles").select("*").eq("id", subject_ref).maybeSingle();
    if (!data) return null;
    return { title: `${data.state_abbr} ${data.chamber} District ${data.district_number}`, summary: `${data.state} (${data.chamber})`, content: JSON.stringify(data).slice(0, 10000), tags: [], state_abbr: data.state_abbr };
  }
  if (subject_type === "legislation") {
    const { data } = await admin.from("congress_bills").select("*").eq("bill_id", subject_ref).maybeSingle();
    if (!data) return null;
    const tags: string[] = [];
    if (data.policy_area) tags.push(String(data.policy_area));
    return { title: `${data.bill_id} — ${data.short_title || data.title}`, summary: data.latest_action_text || "", content: `Title: ${data.title}\nSponsor: ${data.sponsor_name}\nStatus: ${data.status}`, tags, state_abbr: null };
  }
  if (subject_type === "polling") {
    const { data } = await admin.from("polling_data").select("*").eq("id", subject_ref).maybeSingle();
    if (!data) return null;
    return {
      title: `Poll — ${data.candidate_or_topic} (${data.source})`,
      summary: `${data.poll_type} by ${data.source}.`,
      content: `Question: ${data.question}\nApprove ${data.approve_pct ?? data.favor_pct}% / Disapprove ${data.disapprove_pct ?? data.oppose_pct}% / Sample ${data.sample_size}`,
      tags: [data.candidate_or_topic, data.poll_type].filter(Boolean) as string[],
      state_abbr: null,
    };
  }
  if (subject_type === "country") {
    const { data } = await admin.from("international_profiles").select("*").eq("country_code", subject_ref.toUpperCase()).maybeSingle();
    if (!data) return null;
    return {
      title: `${data.country_name} — Country Profile`,
      summary: `${data.government_type}. Head: ${data.head_of_state}.`,
      content: JSON.stringify(data).slice(0, 10000),
      tags: (data.major_industries || []).slice(0, 6),
      state_abbr: null,
    };
  }
  return null;
}

async function buildContext(admin: SAdmin, subject: any, selected: Section[], scope: string, scopeRef: string | null): Promise<string> {
  const tags = (subject.tags || []).filter((t: string) => !["Democrat","Republican","Independent"].includes(t));
  const parts: string[] = [];
  if (scope === "district" && scopeRef) {
    const { data } = await admin.from("district_profiles").select("*").eq("district_id", scopeRef).maybeSingle();
    if (data) parts.push(`DISTRICT ${scopeRef}: pop ${data.population}, median income $${data.median_income}, top issues: ${(data.top_issues || []).join(", ")}`);
  }
  if (selected.includes("polling")) {
    let q = admin.from("polling_data").select("question, support_pct, oppose_pct, pollster, end_date").order("end_date", { ascending: false }).limit(6);
    if (tags.length) q = q.or(tags.map((t: string) => `question.ilike.%${t}%`).join(","));
    const { data } = await q;
    if (data?.length) parts.push(`POLLING:\n${data.map((p: any) => `- ${p.pollster}: ${p.question} (support ${p.support_pct}%)`).join("\n")}`);
  }
  if (selected.includes("intel") && tags.length) {
    const { data } = await admin.from("intel_briefings").select("title, source_name").or(tags.map((t: string) => `title.ilike.%${t}%`).join(",")).limit(5);
    if (data?.length) parts.push(`INTEL:\n${data.map((b: any) => `- [${b.source_name}] ${b.title}`).join("\n")}`);
  }
  if (selected.includes("legislation") && tags.length) {
    const { data } = await admin.from("congress_bills").select("bill_id, title").or(tags.map((t: string) => `title.ilike.%${t}%`).join(",")).limit(5);
    if (data?.length) parts.push(`BILLS:\n${data.map((b: any) => `- ${b.bill_id}: ${b.title}`).join("\n")}`);
  }
  if (selected.includes("finance") && subject.state_abbr) {
    const { data } = await admin.from("campaign_finance").select("candidate_name, party, total_raised").eq("state_abbr", subject.state_abbr).order("total_raised", { ascending: false }).limit(5);
    if (data?.length) parts.push(`FINANCE:\n${data.map((f: any) => `- ${f.candidate_name} (${f.party}): $${f.total_raised}`).join("\n")}`);
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

    const { subject_type, subject_ref, scope = "national", scope_ref = null, force_refresh, include_sections = SECTIONS, model: rawModel } = await req.json();
    if (!ALLOWED_SUBJECTS.has(subject_type)) return new Response(JSON.stringify({ error: "Invalid subject_type" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!subject_ref) return new Response(JSON.stringify({ error: "subject_ref required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const model = rawModel && ALLOWED_MODELS.has(rawModel) ? rawModel : DEFAULT_MODEL;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (!force_refresh) {
      let q = admin.from("subject_impact_analyses").select("*").eq("subject_type", subject_type).eq("subject_ref", subject_ref).eq("scope", scope);
      q = scope_ref ? q.eq("scope_ref", scope_ref) : q.is("scope_ref", null);
      const { data: cached } = await q.maybeSingle();
      if (cached && (Date.now() - new Date((cached as any).generated_at).getTime()) < 7 * 24 * 60 * 60 * 1000) {
        return new Response(JSON.stringify({ cached: true, analysis: cached }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const subject = await loadSubject(admin, subject_type, subject_ref);
    if (!subject) return new Response(JSON.stringify({ error: "Subject not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const selected = (Array.isArray(include_sections) ? include_sections : SECTIONS).filter((s: string) => SECTIONS.includes(s as Section)) as Section[];
    const ctx = await buildContext(admin, subject, selected, scope, scope_ref);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 110_000);
    let aiResp: Response;
    try {
      aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        signal: ctrl.signal,
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "You are a political impact analyst. Analyze the political and media impact of this subject at the requested scope using the polling, intel, legislation, and demographic context. Return via tool." },
            { role: "user", content: `SUBJECT: ${subject.title}\nSummary: ${subject.summary}\nTags: ${(subject.tags || []).join(", ")}\nScope: ${scope} ${scope_ref || ""}\n\nDETAILS:\n${subject.content}\n\nCONTEXT:\n${ctx}` },
          ],
          tools: [{ type: "function", function: {
            name: "analyze_subject_impact",
            description: "Structured impact",
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
          tool_choice: { type: "function", function: { name: "analyze_subject_impact" } },
        }),
      });
    } catch (fetchErr: any) {
      clearTimeout(timer);
      console.error("AI fetch failed:", fetchErr?.message || fetchErr);
      return new Response(JSON.stringify({ error: fetchErr?.name === "AbortError" ? "AI request timed out — try a faster model (e.g. gemini-2.5-flash)" : "AI gateway unreachable" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    clearTimeout(timer);
    if (!aiResp.ok) {
      const errText = await aiResp.text().catch(() => "");
      console.error("AI error", aiResp.status, errText);
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit — please retry in a moment" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "AI credits depleted" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: `AI gateway error (${aiResp.status})` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const aiData = await aiResp.json();
    const parsed = JSON.parse(aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments || "{}");

    const existing = await admin.from("subject_impact_analyses").select("id").eq("subject_type", subject_type).eq("subject_ref", subject_ref).eq("scope", scope).is("scope_ref", scope_ref ?? null).maybeSingle();
    let row;
    const fields = {
      summary: parsed.summary ?? "",
      amplifies: parsed.amplifies ?? [], undermines: parsed.undermines ?? [],
      affected_groups: parsed.affected_groups ?? [],
      political_impact: parsed.political_impact ?? "", media_impact: parsed.media_impact ?? "",
      recommended_channels: parsed.recommended_channels ?? [],
      model, generated_at: new Date().toISOString(),
    };
    if ((existing as any).data?.id) {
      const { data, error } = await admin.from("subject_impact_analyses").update(fields as never).eq("id", (existing as any).data.id).select().single();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      row = data;
    } else {
      const { data, error } = await admin.from("subject_impact_analyses").insert({ subject_type, subject_ref, scope, scope_ref, ...fields } as never).select().single();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      row = data;
    }

    // Log to unified AI generation history (fire-and-forget)
    try {
      const mod = await import("../_shared/ai-history.ts");
      mod.logAIGeneration(admin, {
        feature: "subject_impact_analysis",
        subject_type, subject_ref,
        model,
        output: fields,
        triggered_by: user?.id ?? null,
        trigger_source: "user",
      });
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({ cached: false, analysis: row }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
