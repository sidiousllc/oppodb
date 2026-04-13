import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

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

    const safe = memberName.replace(/[^a-zA-Z\s\-'.]/g, "").trim();
    if (!safe) {
      return new Response(
        JSON.stringify({ error: "Invalid memberName after sanitisation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check cache first
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceRoleKey);

    const { data: cached } = await sb
      .from("district_news_cache")
      .select("articles, fetched_at")
      .eq("member_name", safe)
      .maybeSingle();

    if (cached) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();
      if (age < CACHE_TTL_MS) {
        return new Response(
          JSON.stringify({ articles: cached.articles, memberName: safe, cached: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch fresh from Google News RSS
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

    const items: { title: string; link: string; source: string; pubDate: string }[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 25) {
      const block = match[1];
      const titleMatch = block.match(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/);
      const linkMatch = block.match(/<link>(.*?)<\/link>/);
      const sourceMatch = block.match(/<source[^>]*url="([^"]*)"[^>]*>(.*?)<\/source>/);
      const sourceNameOnly = block.match(/<source[^>]*>(.*?)<\/source>/);
      const pubDateMatch = block.match(/<pubDate>(.*?)<\/pubDate>/);

      const rawTitle = titleMatch ? (titleMatch[1] || titleMatch[2] || "") : "";
      const dashIdx = rawTitle.lastIndexOf(" - ");
      const title = dashIdx > 0 ? rawTitle.substring(0, dashIdx).trim() : rawTitle.trim();
      const fallbackSource = dashIdx > 0 ? rawTitle.substring(dashIdx + 3).trim() : "";

      // Prefer the real article URL from <source url="..."> over the Google redirect
      const sourceUrl = sourceMatch ? sourceMatch[1].trim() : "";
      const googleLink = linkMatch ? linkMatch[1].trim() : "";
      const actualLink = sourceUrl || googleLink;

      items.push({
        title,
        link: actualLink,
        source: sourceMatch ? sourceMatch[2].trim() : (sourceNameOnly ? sourceNameOnly[1].trim() : fallbackSource),
        pubDate: pubDateMatch ? pubDateMatch[1].trim() : "",
      });
    }

    // Upsert cache
    await sb.from("district_news_cache").upsert(
      { member_name: safe, articles: items, fetched_at: new Date().toISOString() },
      { onConflict: "member_name" }
    );

    return new Response(
      JSON.stringify({ articles: items, memberName: safe, cached: false }),
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
