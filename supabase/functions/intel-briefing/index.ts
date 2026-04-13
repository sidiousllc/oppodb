import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Intelligence sources organized by scope — 90+ feeds
const SOURCES: Record<string, Array<{ name: string; rssUrl: string; scope: string }>> = {
  international: [
    // Wire services & major outlets
    { name: "Reuters World", rssUrl: "https://feeds.reuters.com/Reuters/worldNews", scope: "international" },
    { name: "AP World News", rssUrl: "https://rsshub.app/apnews/topics/world-news", scope: "international" },
    { name: "BBC World", rssUrl: "https://feeds.bbci.co.uk/news/world/rss.xml", scope: "international" },
    { name: "Al Jazeera", rssUrl: "https://www.aljazeera.com/xml/rss/all.xml", scope: "international" },
    { name: "The Guardian World", rssUrl: "https://www.theguardian.com/world/rss", scope: "international" },
    // Regional outlets
    { name: "Deutsche Welle", rssUrl: "https://rss.dw.com/rdf/rss-en-all", scope: "international" },
    { name: "France 24", rssUrl: "https://www.france24.com/en/rss", scope: "international" },
    { name: "Japan Times", rssUrl: "https://www.japantimes.co.jp/feed/", scope: "international" },
    { name: "South China Morning Post", rssUrl: "https://www.scmp.com/rss/91/feed", scope: "international" },
    { name: "Middle East Eye", rssUrl: "https://www.middleeasteye.net/rss", scope: "international" },
    { name: "The Diplomat", rssUrl: "https://thediplomat.com/feed/", scope: "international" },
    { name: "Global Post / The World", rssUrl: "https://theworld.org/rss.xml", scope: "international" },
    { name: "World Politics Review", rssUrl: "https://www.worldpoliticsreview.com/rss", scope: "international" },
    { name: "Nikkei Asia", rssUrl: "https://asia.nikkei.com/rss", scope: "international" },
    { name: "The Africa Report", rssUrl: "https://www.theafricareport.com/feed/", scope: "international" },
    { name: "Latin America Reports", rssUrl: "https://latinamericareports.com/feed/", scope: "international" },
    // Think tanks - international
    { name: "Foreign Affairs", rssUrl: "https://www.foreignaffairs.com/rss.xml", scope: "international" },
    { name: "Carnegie Endowment", rssUrl: "https://carnegieendowment.org/rss/solr/?fa=articles", scope: "international" },
    { name: "Council on Foreign Relations", rssUrl: "https://www.cfr.org/rss/analysis-brief", scope: "international" },
    { name: "CSIS Analysis", rssUrl: "https://www.csis.org/analysis/feed", scope: "international" },
    { name: "Brookings Global", rssUrl: "https://www.brookings.edu/topic/global-economy/feed/", scope: "international" },
    { name: "Chatham House", rssUrl: "https://www.chathamhouse.org/rss", scope: "international" },
    { name: "Atlantic Council", rssUrl: "https://www.atlanticcouncil.org/feed/", scope: "international" },
    { name: "Wilson Center", rssUrl: "https://www.wilsoncenter.org/rss.xml", scope: "international" },
    { name: "RAND Corporation", rssUrl: "https://www.rand.org/pubs/feed.xml", scope: "international" },
    { name: "Stimson Center", rssUrl: "https://www.stimson.org/feed/", scope: "international" },
  ],
  national: [
    // Major political news
    { name: "Politico Playbook", rssUrl: "https://rss.politico.com/playbook.xml", scope: "national" },
    { name: "Politico Congress", rssUrl: "https://rss.politico.com/congress.xml", scope: "national" },
    { name: "The Hill", rssUrl: "https://thehill.com/feed/", scope: "national" },
    { name: "Roll Call", rssUrl: "https://www.rollcall.com/feed/", scope: "national" },
    { name: "Axios", rssUrl: "https://api.axios.com/feed/", scope: "national" },
    { name: "1440 Daily Digest", rssUrl: "https://www.join1440.com/rss", scope: "national" },
    { name: "Ground News", rssUrl: "https://ground.news/rss", scope: "national" },
    { name: "CQ Roll Call", rssUrl: "https://plus.cq.com/rss/news", scope: "national" },
    // Wire & broadcast
    { name: "AP News Politics", rssUrl: "https://rsshub.app/apnews/topics/politics", scope: "national" },
    { name: "Reuters US Politics", rssUrl: "https://feeds.reuters.com/Reuters/PoliticsNews", scope: "national" },
    { name: "NPR Politics", rssUrl: "https://feeds.npr.org/1014/rss.xml", scope: "national" },
    { name: "NBC News Politics", rssUrl: "https://feeds.nbcnews.com/nbcnews/public/politics", scope: "national" },
    { name: "CBS News Politics", rssUrl: "https://www.cbsnews.com/latest/rss/politics", scope: "national" },
    { name: "Washington Post Politics", rssUrl: "https://feeds.washingtonpost.com/rss/politics", scope: "national" },
    // Newsletters & digests
    { name: "Punchbowl News", rssUrl: "https://punchbowl.news/feed/", scope: "national" },
    { name: "Semafor", rssUrl: "https://www.semafor.com/feed", scope: "national" },
    { name: "FiveThirtyEight", rssUrl: "https://fivethirtyeight.com/feed/", scope: "national" },
    { name: "RealClearPolitics", rssUrl: "https://www.realclearpolitics.com/index.xml", scope: "national" },
    // Investigative & policy
    { name: "ProPublica", rssUrl: "https://www.propublica.org/feeds/propublica/main", scope: "national" },
    { name: "The Intercept", rssUrl: "https://theintercept.com/feed/?lang=en", scope: "national" },
    { name: "Vox Policy", rssUrl: "https://www.vox.com/rss/policy-and-politics/index.xml", scope: "national" },
    // Multi-partisan / right-leaning
    { name: "Daily Caller", rssUrl: "https://dailycaller.com/feed/", scope: "national" },
    { name: "Washington Examiner", rssUrl: "https://www.washingtonexaminer.com/feed", scope: "national" },
    { name: "National Review", rssUrl: "https://www.nationalreview.com/feed/", scope: "national" },
    { name: "Washington Free Beacon", rssUrl: "https://freebeacon.com/feed/", scope: "national" },
    { name: "The Federalist", rssUrl: "https://thefederalist.com/feed/", scope: "national" },
    // Left-leaning
    { name: "The Nation", rssUrl: "https://www.thenation.com/feed/", scope: "national" },
    { name: "Mother Jones", rssUrl: "https://www.motherjones.com/feed/", scope: "national" },
    { name: "Talking Points Memo", rssUrl: "https://talkingpointsmemo.com/feed", scope: "national" },
    { name: "The New Republic", rssUrl: "https://newrepublic.com/feed", scope: "national" },
    // Think tanks - national
    { name: "Brookings US Policy", rssUrl: "https://www.brookings.edu/topic/us-politics-government/feed/", scope: "national" },
    { name: "Heritage Foundation", rssUrl: "https://www.heritage.org/rss/commentary", scope: "national" },
    { name: "Center for American Progress", rssUrl: "https://www.americanprogress.org/feed/", scope: "national" },
    { name: "AEI", rssUrl: "https://www.aei.org/feed/", scope: "national" },
    { name: "Cato Institute", rssUrl: "https://www.cato.org/rss/recent-opeds.xml", scope: "national" },
    { name: "Urban Institute", rssUrl: "https://www.urban.org/rss.xml", scope: "national" },
    { name: "Niskanen Center", rssUrl: "https://www.niskanencenter.org/feed/", scope: "national" },
    { name: "Third Way", rssUrl: "https://www.thirdway.org/feed", scope: "national" },
    { name: "R Street Institute", rssUrl: "https://www.rstreet.org/feed/", scope: "national" },
    { name: "Manhattan Institute", rssUrl: "https://www.manhattan-institute.org/feed", scope: "national" },
    { name: "Hoover Institution", rssUrl: "https://www.hoover.org/rss.xml", scope: "national" },
    { name: "Economic Policy Institute", rssUrl: "https://www.epi.org/feed/", scope: "national" },
    { name: "Center on Budget", rssUrl: "https://www.cbpp.org/rss/rss.xml", scope: "national" },
    { name: "Bipartisan Policy Center", rssUrl: "https://bipartisanpolicy.org/feed/", scope: "national" },
    // Legal
    { name: "SCOTUSblog", rssUrl: "https://www.scotusblog.com/feed/", scope: "national" },
    { name: "Lawfare", rssUrl: "https://www.lawfaremedia.org/feed", scope: "national" },
  ],
  state: [
    // National outlets with state focus
    { name: "Stateline (Pew)", rssUrl: "https://stateline.org/feed/", scope: "state" },
    { name: "Route Fifty", rssUrl: "https://www.route-fifty.com/rss/all/", scope: "state" },
    { name: "Governing", rssUrl: "https://www.governing.com/rss", scope: "state" },
    { name: "State Legislatures Magazine", rssUrl: "https://www.ncsl.org/rss", scope: "state" },
    { name: "Ballotpedia News", rssUrl: "https://news.ballotpedia.org/feed/", scope: "state" },
    { name: "States Newsroom", rssUrl: "https://statesnewsroom.com/feed/", scope: "state" },
    { name: "NCSL Blog", rssUrl: "https://www.ncsl.org/blog/feed", scope: "state" },
    { name: "NGA Newsroom", rssUrl: "https://www.nga.org/news/feed/", scope: "state" },
    // Issue-specific state coverage
    { name: "Kaiser Health News", rssUrl: "https://kffhealthnews.org/feed/", scope: "state" },
    { name: "The 19th", rssUrl: "https://19thnews.org/feed/", scope: "state" },
    { name: "Education Week", rssUrl: "https://www.edweek.org/feed", scope: "state" },
    { name: "Chalkbeat", rssUrl: "https://www.chalkbeat.org/feed/", scope: "state" },
    { name: "Tax Foundation", rssUrl: "https://taxfoundation.org/feed/", scope: "state" },
    { name: "Grist", rssUrl: "https://grist.org/feed/", scope: "state" },
    { name: "Inside Climate News", rssUrl: "https://insideclimatenews.org/feed/", scope: "state" },
    { name: "Pew Research State", rssUrl: "https://www.pewresearch.org/topic/politics-policy/political-issues/state-policy/feed/", scope: "state" },
    // Criminal justice & social policy
    { name: "The Marshall Project", rssUrl: "https://www.themarshallproject.org/rss/index.rss", scope: "state" },
    { name: "The Appeal", rssUrl: "https://theappeal.org/feed/", scope: "state" },
    { name: "Reason Foundation", rssUrl: "https://reason.org/feed/", scope: "state" },
    // Election-specific
    { name: "Cook Political Report", rssUrl: "https://www.cookpolitical.com/feed", scope: "state" },
    { name: "Sabato Crystal Ball", rssUrl: "https://centerforpolitics.org/crystalball/feed/", scope: "state" },
    { name: "Inside Elections", rssUrl: "https://insideelections.com/feed", scope: "state" },
    // State-specific networks
    { name: "CalMatters", rssUrl: "https://calmatters.org/feed/", scope: "state" },
    { name: "Texas Tribune", rssUrl: "https://www.texastribune.org/feeds/latest/", scope: "state" },
    { name: "The Nevada Independent", rssUrl: "https://thenevadaindependent.com/feed", scope: "state" },
    { name: "Bridge Michigan", rssUrl: "https://www.bridgemi.com/feed", scope: "state" },
    { name: "Wisconsin Watch", rssUrl: "https://wisconsinwatch.org/feed/", scope: "state" },
    { name: "Pennsylvania Capital-Star", rssUrl: "https://www.penncapital-star.com/feed/", scope: "state" },
    { name: "NC Policy Watch", rssUrl: "https://ncpolicywatch.com/feed/", scope: "state" },
    { name: "Georgia Recorder", rssUrl: "https://georgiarecorder.com/feed/", scope: "state" },
    { name: "Arizona Mirror", rssUrl: "https://azmirror.com/feed/", scope: "state" },
    { name: "Florida Phoenix", rssUrl: "https://floridaphoenix.com/feed/", scope: "state" },
    { name: "Minnesota Reformer", rssUrl: "https://minnesotareformer.com/feed/", scope: "state" },
    { name: "Ohio Capital Journal", rssUrl: "https://ohiocapitaljournal.com/feed/", scope: "state" },
    { name: "Virginia Mercury", rssUrl: "https://virginiamercury.com/feed/", scope: "state" },
    { name: "New Hampshire Bulletin", rssUrl: "https://newhampshirebulletin.com/feed/", scope: "state" },
    { name: "Iowa Capital Dispatch", rssUrl: "https://iowacapitaldispatch.com/feed/", scope: "state" },
  ],
  local: [
    { name: "CityLab", rssUrl: "https://www.bloomberg.com/citylab/feed/", scope: "local" },
    { name: "Next City", rssUrl: "https://nextcity.org/feed", scope: "local" },
    { name: "Patch National", rssUrl: "https://patch.com/feeds/national", scope: "local" },
    { name: "Local Government Review", rssUrl: "https://icma.org/rss.xml", scope: "local" },
    { name: "Strong Towns", rssUrl: "https://www.strongtowns.org/journal?format=rss", scope: "local" },
    { name: "National League of Cities", rssUrl: "https://www.nlc.org/feed/", scope: "local" },
    { name: "US Conference of Mayors", rssUrl: "https://www.usmayors.org/feed/", scope: "local" },
    { name: "Smart Cities Dive", rssUrl: "https://www.smartcitiesdive.com/feeds/news/", scope: "local" },
    { name: "Governing Local", rssUrl: "https://www.governing.com/topic/politics/rss", scope: "local" },
    { name: "Shelterforce", rssUrl: "https://shelterforce.org/feed/", scope: "local" },
    { name: "Route Fifty Local", rssUrl: "https://www.route-fifty.com/management/rss/", scope: "local" },
    { name: "Community Builders", rssUrl: "https://www.tcbinc.org/feed/", scope: "local" },
    { name: "CityMetric", rssUrl: "https://www.citymetric.com/feed", scope: "local" },
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

    // Detect category from content
    function detectCategory(title: string, desc: string): string {
      const text = (title + " " + desc).toLowerCase();
      if (text.match(/economy|gdp|inflation|market|trade|tariff|jobs|unemployment/)) return "economy";
      if (text.match(/election|ballot|vote|campaign|primary|caucus/)) return "elections";
      if (text.match(/court|judicial|scotus|legal|law|ruling|justice/)) return "legal";
      if (text.match(/military|defense|nato|pentagon|war|security/)) return "defense";
      if (text.match(/health|covid|pandemic|hospital|medicare|medicaid/)) return "health";
      if (text.match(/climate|environment|energy|epa|emission/)) return "environment";
      if (text.match(/immigration|border|asylum|migrant|refugee/)) return "immigration";
      if (text.match(/education|school|student|university|college/)) return "education";
      if (text.match(/housing|rent|mortgage|homelessness/)) return "housing";
      if (text.match(/crime|police|prison|gun|shooting/)) return "public-safety";
      if (text.match(/tech|ai|artificial intelligence|cyber|data privacy/)) return "technology";
      return "general";
    }

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
        category: detectCategory(title, desc),
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
          category: detectCategory(title, desc),
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

    // Fetch from all requested scopes in parallel (batch 10 at a time to avoid overwhelming)
    for (const scope of requestedScopes) {
      const sources = SOURCES[scope] || [];
      const batchSize = 10;
      for (let i = 0; i < sources.length; i += batchSize) {
        const batch = sources.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(s => parseRSS(s.rssUrl, s.name, s.scope))
        );
        for (const result of results) {
          if (result.status === "fulfilled") {
            allItems.push(...result.value);
          }
        }
      }
    }

    console.log(`Fetched ${allItems.length} total items from ${requestedScopes.length} scopes`);

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
