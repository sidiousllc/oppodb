const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Strip non-article noise from markdown output */
function cleanMarkdown(md: string): string {
  const lines = md.split("\n");
  const cleaned: string[] = [];
  const noisePatterns = [
    /^#{1,3}\s*(menu|navigation|nav|footer|sidebar|advertisement|cookie|subscribe|newsletter|sign up|log in|search|follow us|share this|related articles|trending|most read|popular|comments|leave a reply)/i,
    /^\[?(menu|skip to|sign in|log in|subscribe|newsletter|cookie|accept|reject|privacy policy|terms of service|advertise|about us|contact us|careers)\]?/i,
    /^(advertisement|sponsored|ad|promo|©|copyright|\|.*\|.*\|)/i,
    /^\s*(\*\s*){3,}/, // decorative dividers of just asterisks
  ];
  let skipBlock = false;
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip lines matching noise patterns
    if (noisePatterns.some((p) => p.test(trimmed))) {
      skipBlock = true;
      continue;
    }
    // Resume on next heading that isn't noise
    if (skipBlock && trimmed.startsWith("#")) {
      skipBlock = false;
    }
    if (skipBlock && trimmed.length > 0 && trimmed.length < 60) continue;
    if (skipBlock && trimmed.length === 0) { skipBlock = false; continue; }
    cleaned.push(line);
  }
  // Remove trailing short lines (often footer fragments)
  while (cleaned.length > 0 && cleaned[cleaned.length - 1].trim().length < 30 && !cleaned[cleaned.length - 1].trim().startsWith("#")) {
    cleaned.pop();
  }
  return cleaned.join("\n").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let resolvedUrl = parsedUrl.toString();
    console.log("Scraping URL:", resolvedUrl);

    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    
    if (apiKey) {
      // Use Firecrawl with the resolved URL
      try {
        const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: resolvedUrl,
            formats: ["markdown"],
            onlyMainContent: true,
          }),
        });

        const data = await response.json();
        console.log("Firecrawl status:", response.status, "has markdown:", !!(data?.data?.markdown));

        if (response.ok) {
          let markdown = data?.data?.markdown || data?.markdown || "";
          // Strip navigation, ads, cookie banners, and non-article noise
          markdown = cleanMarkdown(markdown);
          if (markdown.length > 20) {
            return new Response(
              JSON.stringify({ success: true, markdown }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          console.log("Firecrawl returned insufficient content, falling back to manual scrape");
        } else {
          console.log("Firecrawl error:", data?.error || response.status);
        }
      } catch (e) {
        console.error("Firecrawl call failed:", e);
      }
    }

    // Fallback: fetch raw HTML and extract text
    const res = await fetch(resolvedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
      redirect: "follow",
    });
    if (!res.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `Fetch failed: ${res.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const html = await res.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";

    // Extract content from article, main, or body
    let contentHtml = html;
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      contentHtml = articleMatch[1];
    } else {
      const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
      if (mainMatch) contentHtml = mainMatch[1];
    }

    // Strip nav, header, footer, aside, and ad-related elements before extraction
    contentHtml = contentHtml.replace(/<(nav|header|footer|aside|form|iframe|script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, "");
    contentHtml = contentHtml.replace(/<div[^>]*class="[^"]*(?:ad-|advertisement|sidebar|nav-|menu|cookie|banner|popup|modal|newsletter|signup)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");

    // Extract text from paragraphs, headings, and list items
    const blocks: string[] = [];
    const blockRegex = /<(p|h[1-6]|li)[^>]*>([\s\S]*?)<\/\1>/gi;
    let m;
    while ((m = blockRegex.exec(contentHtml)) !== null && blocks.length < 80) {
      const tag = m[1].toLowerCase();
      const text = m[2].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();
      if (text.length > 20) {
        if (tag.startsWith("h")) {
          blocks.push(`## ${text}`);
        } else if (tag === "li") {
          blocks.push(`- ${text}`);
        } else {
          blocks.push(text);
        }
      }
    }

    const rawMarkdown = blocks.length > 0
      ? (title ? `# ${title}\n\n` : "") + blocks.join("\n\n")
      : "Could not extract article content. Try opening the original link.";
    const markdown = cleanMarkdown(rawMarkdown);

    console.log("Manual scrape extracted", blocks.length, "blocks from", resolvedUrl);

    return new Response(
      JSON.stringify({ success: true, markdown, fallback: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("scrape-article error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
