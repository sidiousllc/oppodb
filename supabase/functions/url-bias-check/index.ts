// Bias-checks an arbitrary URL: scrape (Firecrawl) -> AI rate. Caches results for 30 days.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function scrapeUrl(url: string): Promise<{ title: string; markdown: string; source: string }> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  let title = "";
  let markdown = "";
  if (apiKey) {
    try {
      const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      });
      const d = await r.json();
      markdown = d?.data?.markdown || d?.markdown || "";
      title = d?.data?.metadata?.title || d?.metadata?.title || "";
    } catch (e) { console.error("firecrawl err", e); }
  }
  if (!markdown) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      const html = await r.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      if (doc) {
        doc.querySelectorAll("script, style, noscript, template").forEach((el) => el.remove());
        title = (doc.querySelector("title")?.textContent || "").trim();
        markdown = (doc.body?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 5000);
      } else {
        title = "";
        markdown = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 5000);
      }
    } catch (e) { console.error("html fetch err", e); }
  }
  let source = "";
  try { source = new URL(url).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
  return { title, markdown: markdown.slice(0, 6000), source };
}

async function aiRate(title: string, content: string, source: string) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You analyze political bias and factuality of news articles. Use AdFontes/AllSides framework. Reply ONLY via the tool." },
        { role: "user", content: `Source: ${source}\nTitle: ${title}\n\nContent:\n${content}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "rate_article",
          description: "Rate bias and factuality",
          parameters: {
            type: "object",
            properties: {
              bias: { type: "string", enum: ["left","lean-left","center","lean-right","right","unknown"] },
              factuality: { type: "string", enum: ["high","mostly-factual","mixed","low","very-low","unknown"] },
              reasoning: { type: "string", description: "1-3 sentences explaining the rating" },
              excerpt: { type: "string", description: "Short revealing quote from the article (<200 chars)" },
            },
            required: ["bias","factuality","reasoning"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "rate_article" } },
    }),
  });
  if (!resp.ok) return null;
  const d = await resp.json();
  const args = d.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  return args ? JSON.parse(args) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { url, force } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "url required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    let parsed: URL;
    try { parsed = new URL(url); if (!["http:","https:"].includes(parsed.protocol)) throw new Error(); }
    catch { return new Response(JSON.stringify({ error: "invalid url" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const hash = await sha256(parsed.toString());

    if (!force) {
      const { data: cached } = await supabase
        .from("url_bias_checks").select("*").eq("url_hash", hash)
        .gt("expires_at", new Date().toISOString()).maybeSingle();
      if (cached) return new Response(JSON.stringify({ ...cached, cached: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const scraped = await scrapeUrl(parsed.toString());
    if (!scraped.markdown || scraped.markdown.length < 100) {
      return new Response(JSON.stringify({ error: "could not extract article content" }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const rating = await aiRate(scraped.title, scraped.markdown, scraped.source);
    if (!rating) {
      return new Response(JSON.stringify({ error: "rating failed" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: u } = await supabase.auth.getUser(token);
      userId = u?.user?.id || null;
    }

    const row = {
      url: parsed.toString(),
      url_hash: hash,
      title: scraped.title || null,
      source_name: scraped.source,
      bias: rating.bias,
      factuality: rating.factuality,
      reasoning: rating.reasoning,
      excerpt: rating.excerpt || null,
      ai_model: "google/gemini-2.5-flash",
      checked_by: userId,
    };
    await supabase.from("url_bias_checks").upsert(row, { onConflict: "url_hash" });
    return new Response(JSON.stringify({ ...row, cached: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("url-bias-check error", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
