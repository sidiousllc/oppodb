const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { memberName } = await req.json();
    if (!memberName || typeof memberName !== "string" || memberName.length > 200) {
      return new Response(
        JSON.stringify({ error: "Invalid memberName" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitise: only allow letters, spaces, hyphens, apostrophes, periods
    const safe = memberName.replace(/[^a-zA-Z\s\-'.]/g, "").trim();
    if (!safe) {
      return new Response(
        JSON.stringify({ error: "Invalid memberName after sanitisation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const query = encodeURIComponent(safe);
    const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;

    const rssRes = await fetch(rssUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; OppoDBBot/1.0)" },
    });

    if (!rssRes.ok) {
      return new Response(
        JSON.stringify({ error: `Google News returned ${rssRes.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const xml = await rssRes.text();

    // Parse RSS items from XML
    const items: {
      title: string;
      link: string;
      source: string;
      pubDate: string;
    }[] = [];

    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 25) {
      const block = match[1];
      const titleMatch = block.match(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/);
      const linkMatch = block.match(/<link>(.*?)<\/link>/);
      const sourceMatch = block.match(/<source[^>]*>(.*?)<\/source>/);
      const pubDateMatch = block.match(/<pubDate>(.*?)<\/pubDate>/);

      const rawTitle = titleMatch ? (titleMatch[1] || titleMatch[2] || "") : "";
      // Google News appends " - Source" to titles; split it
      const dashIdx = rawTitle.lastIndexOf(" - ");
      const title = dashIdx > 0 ? rawTitle.substring(0, dashIdx).trim() : rawTitle.trim();
      const fallbackSource = dashIdx > 0 ? rawTitle.substring(dashIdx + 3).trim() : "";

      items.push({
        title,
        link: linkMatch ? linkMatch[1].trim() : "",
        source: sourceMatch ? sourceMatch[1].trim() : fallbackSource,
        pubDate: pubDateMatch ? pubDateMatch[1].trim() : "",
      });
    }

    return new Response(
      JSON.stringify({ articles: items, memberName: safe }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("district-news error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
