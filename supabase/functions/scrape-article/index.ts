const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Strip non-article noise from markdown output (fast heuristic pre-pass) */
function cleanMarkdown(md: string): string {
  const lines = md.split("\n");
  const cleaned: string[] = [];
  const noisePatterns = [
    /^#{1,3}\s*(menu|navigation|nav|footer|sidebar|advertisement|cookie|subscribe|newsletter|sign up|log in|search|follow us|share this|related articles|trending|most read|popular|comments|leave a reply|more from|read more|recommended|you may also like|editor.?s pick)/i,
    /^\[?(menu|skip to|sign in|log in|subscribe|newsletter|cookie|accept|reject|privacy policy|terms of service|advertise|about us|contact us|careers|share on|tweet|email this)\]?/i,
    /^(advertisement|sponsored|ad|promo|©|copyright|\|.*\|.*\|)/i,
    /^\s*(\*\s*){3,}/,
  ];
  let skipBlock = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (noisePatterns.some((p) => p.test(trimmed))) { skipBlock = true; continue; }
    if (skipBlock && trimmed.startsWith("#")) skipBlock = false;
    if (skipBlock && trimmed.length > 0 && trimmed.length < 60) continue;
    if (skipBlock && trimmed.length === 0) { skipBlock = false; continue; }
    cleaned.push(line);
  }
  while (cleaned.length > 0 && cleaned[cleaned.length - 1].trim().length < 30 && !cleaned[cleaned.length - 1].trim().startsWith("#")) {
    cleaned.pop();
  }
  return cleaned.join("\n").trim();
}

/**
 * AI-powered second-pass cleanup: takes pre-cleaned markdown and returns
 * ONLY the main article body (title, byline/dateline, paragraphs, quotes,
 * inline lists). Strips related-articles widgets, share bars, subscribe
 * boxes, comments, "more from this section", author bios, and ads that
 * survived the heuristic pass.
 */
async function aiExtractMainArticle(rawMarkdown: string, sourceUrl: string): Promise<string | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;
  // Cap input to keep cost/latency low; most articles fit comfortably
  const input = rawMarkdown.length > 18000 ? rawMarkdown.slice(0, 18000) + "\n\n[truncated]" : rawMarkdown;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: [
              "You extract the MAIN ARTICLE BODY from scraped news content.",
              "Return ONLY the article via the tool. KEEP: headline, byline/dateline, all body paragraphs, blockquotes, inline lists, and image captions that belong to the article.",
              "REMOVE: site navigation, breadcrumbs, share/social buttons, 'related articles', 'more from this section', 'recommended for you', 'trending', author bios at the end, subscribe/newsletter boxes, comments, ads, 'sign in to read more', cookie banners, copyright footers, repeated section labels, and any widget that is not part of the article narrative.",
              "Do NOT summarize, rephrase, translate, or add commentary. Preserve original wording exactly.",
              "Output clean markdown: '# Headline' on first line, then byline line if present, then paragraphs separated by blank lines.",
            ].join(" "),
          },
          { role: "user", content: `Source URL: ${sourceUrl}\n\n--- SCRAPED CONTENT ---\n${input}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_article",
            description: "Return the cleaned main article body in markdown",
            parameters: {
              type: "object",
              properties: {
                article_markdown: { type: "string", description: "The article body in clean markdown. Empty string if no real article was found." },
                title: { type: "string", description: "The article headline, or empty string." },
                is_article: { type: "boolean", description: "False if the page is a paywall/login/404/listing page rather than an actual article." },
              },
              required: ["article_markdown", "is_article"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_article" } },
      }),
    });

    if (!resp.ok) {
      console.log("AI extract failed:", resp.status, await resp.text().catch(() => ""));
      return null;
    }
    const data = await resp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return null;
    const parsed = JSON.parse(args);
    if (!parsed.is_article) return null;
    const out = String(parsed.article_markdown || "").trim();
    return out.length >= 100 ? out : null;
  } catch (e) {
    console.error("AI extract error:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { url, skipAi } = body;

    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ success: false, error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error();
    } catch {
      return new Response(JSON.stringify({ success: false, error: "Invalid URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const resolvedUrl = parsedUrl.toString();
    console.log("Scraping URL:", resolvedUrl);

    let rawMarkdown = "";
    let scrapeMethod: "firecrawl" | "fallback" = "fallback";

    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (apiKey) {
      try {
        const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url: resolvedUrl, formats: ["markdown"], onlyMainContent: true }),
        });
        const data = await response.json();
        console.log("Firecrawl status:", response.status, "has markdown:", !!(data?.data?.markdown));
        if (response.ok) {
          const md = data?.data?.markdown || data?.markdown || "";
          if (md.length > 20) { rawMarkdown = md; scrapeMethod = "firecrawl"; }
        } else {
          console.log("Firecrawl error:", data?.error || response.status);
        }
      } catch (e) {
        console.error("Firecrawl call failed:", e);
      }
    }

    // Manual fallback if Firecrawl missing or empty
    if (!rawMarkdown) {
      const res = await fetch(resolvedUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
        redirect: "follow",
      });
      if (!res.ok) {
        return new Response(JSON.stringify({ success: false, error: `Fetch failed: ${res.status}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const html = await res.text();
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";

      let contentHtml = html;
      const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
      if (articleMatch) contentHtml = articleMatch[1];
      else {
        const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
        if (mainMatch) contentHtml = mainMatch[1];
      }
      contentHtml = contentHtml.replace(/<(nav|header|footer|aside|form|iframe|script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, "");
      contentHtml = contentHtml.replace(/<div[^>]*class="[^"]*(?:ad-|advertisement|sidebar|nav-|menu|cookie|banner|popup|modal|newsletter|signup|related|recommended|share|social)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");

      const blocks: string[] = [];
      const blockRegex = /<(p|h[1-6]|li|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi;
      let m;
      while ((m = blockRegex.exec(contentHtml)) !== null && blocks.length < 120) {
        const tag = m[1].toLowerCase();
        const text = m[2].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();
        if (text.length > 20) {
          if (tag.startsWith("h")) blocks.push(`## ${text}`);
          else if (tag === "li") blocks.push(`- ${text}`);
          else if (tag === "blockquote") blocks.push(`> ${text}`);
          else blocks.push(text);
        }
      }
      rawMarkdown = blocks.length > 0
        ? (title ? `# ${title}\n\n` : "") + blocks.join("\n\n")
        : "";
      console.log("Manual scrape extracted", blocks.length, "blocks");
    }

    if (!rawMarkdown || rawMarkdown.length < 50) {
      return new Response(JSON.stringify({ success: false, error: "Could not extract article content" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Heuristic pre-clean
    const heuristicCleaned = cleanMarkdown(rawMarkdown);

    // AI second-pass cleanup (skip if explicitly disabled or input too short)
    let finalMarkdown = heuristicCleaned;
    let aiCleaned = false;
    if (!skipAi && heuristicCleaned.length >= 200) {
      const aiOut = await aiExtractMainArticle(heuristicCleaned, resolvedUrl);
      if (aiOut) {
        finalMarkdown = aiOut;
        aiCleaned = true;
        console.log("AI cleanup succeeded:", heuristicCleaned.length, "→", aiOut.length, "chars");
      } else {
        console.log("AI cleanup skipped/failed — using heuristic output");
      }
    }

    return new Response(
      JSON.stringify({ success: true, markdown: finalMarkdown, scrapeMethod, aiCleaned }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("scrape-article error:", err);
    return new Response(JSON.stringify({ success: false, error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
