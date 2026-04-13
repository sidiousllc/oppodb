import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Intelligence sources organized by scope
const SOURCES: Record<string, Array<{ name: string; rssUrl: string; scope: string }>> = {
  international: [
    { name: "World Politics Review", rssUrl: "https://www.worldpoliticsreview.com/rss", scope: "international" },
    { name: "Global Post", rssUrl: "https://theworld.org/rss.xml", scope: "international" },
    { name: "Reuters World", rssUrl: "https://feeds.reuters.com/Reuters/worldNews", scope: "international" },
    { name: "Al Jazeera", rssUrl: "https://www.aljazeera.com/xml/rss/all.xml", scope: "international" },
    { name: "BBC World", rssUrl: "https://feeds.bbci.co.uk/news/world/rss.xml", scope: "international" },
    { name: "Foreign Affairs", rssUrl: "https://www.foreignaffairs.com/rss.xml", scope: "international" },
    { name: "The Diplomat", rssUrl: "https://thediplomat.com/feed/", scope: "international" },
  ],
  national: [
    { name: "Politico Playbook", rssUrl: "https://rss.politico.com/playbook.xml", scope: "national" },
    { name: "1440 Daily Digest", rssUrl: "https://www.join1440.com/rss", scope: "national" },
    { name: "Ground News", rssUrl: "https://ground.news/rss", scope: "national" },
    { name: "The Hill", rssUrl: "https://thehill.com/feed/", scope: "national" },
    { name: "AP News Politics", rssUrl: "https://rsshub.app/apnews/topics/politics", scope: "national" },
    { name: "NPR Politics", rssUrl: "https://feeds.npr.org/1014/rss.xml", scope: "national" },
    { name: "Axios", rssUrl: "https://api.axios.com/feed/", scope: "national" },
    { name: "Roll Call", rssUrl: "https://www.rollcall.com/feed/", scope: "national" },
    { name: "CQ Roll Call", rssUrl: "https://plus.cq.com/rss/news", scope: "national" },
  ],
  state: [
    { name: "Stateline (Pew)", rssUrl: "https://stateline.org/feed/", scope: "state" },
    { name: "Route Fifty", rssUrl: "https://www.route-fifty.com/rss/all/", scope: "state" },
    { name: "Governing", rssUrl: "https://www.governing.com/rss", scope: "state" },
    { name: "State Legislatures Magazine", rssUrl: "https://www.ncsl.org/rss", scope: "state" },
    { name: "Ballotpedia News", rssUrl: "https://news.ballotpedia.org/feed/", scope: "state" },
  ],
  local: [
    { name: "CityLab", rssUrl: "https://www.bloomberg.com/citylab/feed/", scope: "local" },
    { name: "Next City", rssUrl: "https://nextcity.org/feed", scope: "local" },
    { name: "Patch National", rssUrl: "https://patch.com/feeds/national", scope: "local" },
    { name: "Local Government Review", rssUrl: "https://icma.org/rss.xml", scope: "local" },
  ],
};

async function parseRSS(url: string, sourceName: string, scope: string): Promise<Array<{
  title: string; summary: string; content: string; source_name: string;
  source_url: string; published_at: string; scope: string; category: string;
}>> {
  const items: Array<any> = [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; IntelBot/1.0)" },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.log(`RSS fetch failed for ${sourceName}: ${res.status}`);
      return [];
    }

    const xml = await res.text();

    // Parse RSS items
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let match;
    let count = 0;
    while ((match = itemRegex.exec(xml)) !== null && count < 10) {
      const block = match[1];
      const titleMatch = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      const linkMatch = block.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
      const descMatch = block.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
      const contentMatch = block.match(/<content:encoded[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>/i);
      const pubDateMatch = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);

      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
      if (!title) continue;

      const link = linkMatch ? linkMatch[1].replace(/<[^>]+>/g, "").trim() : "";
      const desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim() : "";
      const content = contentMatch ? contentMatch[1].replace(/<[^>]+>/g, "").trim() : desc;
      const pubDate = pubDateMatch ? pubDateMatch[1].trim() : new Date().toISOString();

      let parsedDate: string;
      try {
        parsedDate = new Date(pubDate).toISOString();
      } catch {
        parsedDate = new Date().toISOString();
      }

      items.push({
        title,
        summary: desc.substring(0, 500),
        content: content.substring(0, 3000),
        source_name: sourceName,
        source_url: link,
        published_at: parsedDate,
        scope,
        category: "general",
      });
      count++;
    }

    // Also try Atom entries
    if (items.length === 0) {
      const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
      while ((match = entryRegex.exec(xml)) !== null && items.length < 10) {
        const block = match[1];
        const titleMatch = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
        const linkMatch = block.match(/<link[^>]*href="([^"]*)"[^>]*\/?>/i);
        const summaryMatch = block.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i);
        const updatedMatch = block.match(/<(?:updated|published)[^>]*>([\s\S]*?)<\/(?:updated|published)>/i);

        const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
        if (!title) continue;

        const link = linkMatch ? linkMatch[1].trim() : "";
        const desc = summaryMatch ? summaryMatch[1].replace(/<[^>]+>/g, "").trim() : "";
        const pubDate = updatedMatch ? updatedMatch[1].trim() : new Date().toISOString();

        let parsedDate: string;
        try { parsedDate = new Date(pubDate).toISOString(); } catch { parsedDate = new Date().toISOString(); }

        items.push({
          title,
          summary: desc.substring(0, 500),
          content: desc.substring(0, 3000),
          source_name: sourceName,
          source_url: link,
          published_at: parsedDate,
          scope,
          category: "general",
        });
      }
    }
  } catch (e) {
    console.error(`Error parsing RSS for ${sourceName}:`, e);
  }
  return items;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify caller is authenticated
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json().catch(() => ({}));
    const requestedScopes: string[] = body.scopes || ["national", "international", "state", "local"];

    console.log("Intel briefing sync starting for scopes:", requestedScopes);

    const allItems: any[] = [];

    // Fetch from all requested scopes in parallel
    const fetchPromises: Promise<any[]>[] = [];
    for (const scope of requestedScopes) {
      const sources = SOURCES[scope] || [];
      for (const source of sources) {
        fetchPromises.push(parseRSS(source.rssUrl, source.name, source.scope));
      }
    }

    const results = await Promise.allSettled(fetchPromises);
    for (const result of results) {
      if (result.status === "fulfilled") {
        allItems.push(...result.value);
      }
    }

    console.log(`Fetched ${allItems.length} total items`);

    if (allItems.length > 0) {
      // Delete items older than 48 hours
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      await supabase.from("intel_briefings").delete().lt("published_at", cutoff);

      // Upsert new items (deduplicate by title + source)
      const batchSize = 50;
      let inserted = 0;
      for (let i = 0; i < allItems.length; i += batchSize) {
        const batch = allItems.slice(i, i + batchSize);
        const { error } = await supabase.from("intel_briefings").upsert(
          batch.map((item) => ({
            title: item.title,
            summary: item.summary,
            content: item.content,
            source_name: item.source_name,
            source_url: item.source_url,
            published_at: item.published_at,
            scope: item.scope,
            category: item.category,
          })),
          { onConflict: "title,source_name", ignoreDuplicates: true }
        );
        if (error) {
          console.error("Upsert error:", error.message);
        } else {
          inserted += batch.length;
        }
      }
      console.log(`Inserted/updated ${inserted} briefings`);
    }

    return new Response(
      JSON.stringify({ success: true, count: allItems.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("intel-briefing error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
