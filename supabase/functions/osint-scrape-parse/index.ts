/**
 * osint-scrape-parse — for `url`-kind OSINT tools, scrape the upstream
 * provider via Firecrawl and use Lovable AI (tool-call structured output)
 * to extract a normalized `results` array that the OSINTResultWindow can
 * render. This means every research tool — even raw deep-link providers —
 * surfaces actual data inside the themed mini window.
 */
import { corsHeaders } from "../_shared/cors.ts";
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logAIGeneration } from "../_shared/ai-history.ts";

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const BodySchema = z.object({
  url: z.string().url().max(2000),
  query: z.string().min(1).max(500),
  tool_label: z.string().max(120).optional(),
  subject_type: z.string().max(40).optional(),
});

async function firecrawlScrape(url: string): Promise<{ markdown: string; title?: string }> {
  if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not configured");
  const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      waitFor: 1500,
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || `Firecrawl ${r.status}`);
  // v2 may wrap in `data` or expose at root
  const md = data?.data?.markdown ?? data?.markdown ?? "";
  const title = data?.data?.metadata?.title ?? data?.metadata?.title;
  if (!md) throw new Error("No content scraped");
  // cap to keep AI prompt small/fast
  return { markdown: md.slice(0, 18000), title };
}

async function aiParseToResults(opts: {
  markdown: string;
  query: string;
  toolLabel: string;
  subjectType: string;
  sourceUrl: string;
  pageTitle?: string;
}): Promise<Record<string, unknown>[]> {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const systemPrompt = `You are an OSINT analyst. You receive scraped page content from "${opts.toolLabel}" for the query "${opts.query}". Extract every distinct result/record/entity into a normalized list. Each item should include any relevant field present (title, name, date, location, snippet/description, status, party, jurisdiction, agency, case_name, docket_url, source_url, etc). Skip navigation, ads, and boilerplate. If the page contains no real results, return an empty array.`;

  const userPrompt = `Source URL: ${opts.sourceUrl}\nPage title: ${opts.pageTitle ?? "(unknown)"}\nSubject type: ${opts.subjectType}\n\n--- Scraped markdown ---\n${opts.markdown}`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "emit_results",
            description: "Emit normalized OSINT results extracted from the page.",
            parameters: {
              type: "object",
              properties: {
                results: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      subtitle: { type: "string" },
                      snippet: { type: "string", description: "1-3 sentence excerpt or summary" },
                      source_url: { type: "string" },
                      date: { type: "string" },
                      location: { type: "string" },
                      status: { type: "string" },
                      jurisdiction: { type: "string" },
                      agency: { type: "string" },
                      party: { type: "string" },
                      identifier: { type: "string", description: "Case number, registration number, ticker, etc." },
                      tags: { type: "array", items: { type: "string" } },
                    },
                  },
                },
                summary: { type: "string", description: "1-2 sentence overview of what was found" },
              },
              required: ["results"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "emit_results" } },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    if (resp.status === 429) throw new Error("AI rate limit; retry in a moment");
    if (resp.status === 402) throw new Error("AI credits exhausted");
    throw new Error(`AI gateway ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const call = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) {
    return [{ title: opts.query, snippet: "AI returned no structured results", source_url: opts.sourceUrl }];
  }
  let parsed: { results?: Record<string, unknown>[]; summary?: string } = {};
  try { parsed = JSON.parse(call.function.arguments); } catch { /* noop */ }
  const out = Array.isArray(parsed.results) ? parsed.results : [];
  if (parsed.summary) {
    out.unshift({ title: `Summary — ${opts.query}`, snippet: parsed.summary, source_url: opts.sourceUrl });
  }
  return out.length ? out : [{ title: opts.query, snippet: "No matches found on the page.", source_url: opts.sourceUrl }];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { url, query, tool_label, subject_type } = parsed.data;

    const { markdown, title } = await firecrawlScrape(url);
    const results = await aiParseToResults({
      markdown,
      query,
      toolLabel: tool_label ?? "OSINT tool",
      subjectType: subject_type ?? "subject",
      sourceUrl: url,
      pageTitle: title,
    });

    // Log to unified AI generation history (fire-and-forget; needs service role)
    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SR_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(SUPABASE_URL, SR_KEY);
      logAIGeneration(admin, {
        feature: "osint_scrape_parse",
        subject_type: subject_type ?? "osint",
        subject_ref: query.slice(0, 200),
        model: "google/gemini-2.5-flash",
        prompt_summary: `${tool_label ?? "OSINT tool"} → ${url}`,
        output: { results, source_url: url, fetched_at: new Date().toISOString() },
        trigger_source: "user",
      });
    } catch (_) { /* never block response */ }

    return new Response(
      JSON.stringify({ results, source: tool_label ?? "scrape", source_url: url, fetched_at: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "scrape-parse failed";
    console.error("osint-scrape-parse error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
