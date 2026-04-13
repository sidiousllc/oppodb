import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ScrapedArticle {
  title: string;
  slug: string;
  source: string;
  source_url: string;
  author: string | null;
  published_date: string | null;
  summary: string;
  content: string;
  issue_areas: string[];
  research_type: string;
}

/* ── Firecrawl helpers ─────────────────────────────────────── */

async function firecrawlScrape(url: string, firecrawlKey: string): Promise<{ markdown: string; title: string; links: string[] } | null> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown", "links"], onlyMainContent: true }),
    });
    const data = await res.json();
    return {
      markdown: data?.data?.markdown || data?.markdown || "",
      title: data?.data?.metadata?.title || data?.metadata?.title || "",
      links: data?.data?.links || data?.links || [],
    };
  } catch (e) {
    console.error(`Firecrawl scrape error for ${url}:`, e);
    return null;
  }
}

async function firecrawlSearch(query: string, firecrawlKey: string, limit = 3): Promise<Array<{ markdown: string; title: string; url: string; description: string }>> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit, scrapeOptions: { formats: ["markdown"] } }),
    });
    const data = await res.json();
    return (data?.data || []).map((r: any) => ({
      markdown: r.markdown || "",
      title: r.title || r.metadata?.title || "",
      url: r.url || "",
      description: r.description || "",
    }));
  } catch (e) {
    console.error(`Firecrawl search error:`, e);
    return [];
  }
}

function makeSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

/* ── Source scrapers ─────────────────────────────────────── */

async function scrapeNavigator(firecrawlKey: string): Promise<ScrapedArticle[]> {
  const articles: ScrapedArticle[] = [];
  try {
    const page = await firecrawlScrape("https://navigatorresearch.org/research/message-guidance/", firecrawlKey);
    if (!page) return articles;

    const guidanceLinks = page.links.filter(
      (l) => l.includes("navigatorresearch.org/") && !l.includes("/research/message-guidance") &&
        !l.includes("/about") && !l.includes("/contact") && !l.includes("/category") &&
        l !== "https://navigatorresearch.org/"
    );

    for (const link of guidanceLinks.slice(0, 3)) {
      const article = await firecrawlScrape(link, firecrawlKey);
      if (article && article.title && article.markdown.length > 100) {
        articles.push({
          title: article.title, slug: makeSlug(article.title),
          source: "Navigator Research", source_url: link, author: "Navigator Research",
          published_date: null, summary: article.markdown.slice(0, 300).replace(/[#*\n]/g, " ").trim(),
          content: article.markdown, issue_areas: ["Democrat"], research_type: "message-guidance",
        });
      }
    }
  } catch (e) { console.error("Error scraping Navigator:", e); }
  return articles;
}

async function scrapeHeritage(firecrawlKey: string): Promise<ScrapedArticle[]> {
  const articles: ScrapedArticle[] = [];
  try {
    const page = await firecrawlScrape("https://www.heritage.org/conservatism/commentary", firecrawlKey);
    if (!page) return articles;

    const commentaryLinks = page.links.filter(
      (l) => l.includes("heritage.org/") && l.includes("/commentary/") && l.split("/").length > 4
    );

    for (const link of commentaryLinks.slice(0, 2)) {
      const article = await firecrawlScrape(link, firecrawlKey);
      if (article && article.title && article.markdown.length > 100) {
        articles.push({
          title: article.title.replace(" | The Heritage Foundation", ""),
          slug: makeSlug(article.title), source: "Heritage Foundation", source_url: link,
          author: "Heritage Foundation", published_date: null,
          summary: article.markdown.slice(0, 300).replace(/[#*\n]/g, " ").trim(),
          content: article.markdown, issue_areas: detectIssueAreas(article.markdown, "Republican"),
          research_type: "message-guidance",
        });
      }
    }
  } catch (e) { console.error("Error scraping Heritage:", e); }
  return articles;
}

async function scrapeBPC(firecrawlKey: string): Promise<ScrapedArticle[]> {
  const articles: ScrapedArticle[] = [];
  try {
    const results = await firecrawlSearch("site:bipartisanpolicy.org messaging strategy polling guidance", firecrawlKey, 3);
    for (const result of results) {
      if (result.markdown.length > 100) {
        articles.push({
          title: result.title || "BPC Report", slug: makeSlug(result.title || "bpc-report"),
          source: "Bipartisan Policy Center", source_url: result.url, author: "BPC Staff",
          published_date: null, summary: result.description || result.markdown.slice(0, 300).replace(/[#*\n]/g, " ").trim(),
          content: result.markdown, issue_areas: detectIssueAreas(result.markdown, "Independent"),
          research_type: "message-guidance",
        });
      }
    }
  } catch (e) { console.error("Error scraping BPC:", e); }
  return articles;
}

// New sources

async function scrapeCAP(firecrawlKey: string): Promise<ScrapedArticle[]> {
  const articles: ScrapedArticle[] = [];
  try {
    const results = await firecrawlSearch("site:americanprogress.org messaging framing public opinion polling", firecrawlKey, 3);
    for (const result of results) {
      if (result.markdown.length > 100) {
        articles.push({
          title: result.title, slug: makeSlug(result.title),
          source: "Center for American Progress", source_url: result.url, author: "CAP Staff",
          published_date: null, summary: result.description || result.markdown.slice(0, 300).replace(/[#*\n]/g, " ").trim(),
          content: result.markdown, issue_areas: detectIssueAreas(result.markdown, "Democrat"),
          research_type: "message-guidance",
        });
      }
    }
  } catch (e) { console.error("Error scraping CAP:", e); }
  return articles;
}

async function scrapeThirdWay(firecrawlKey: string): Promise<ScrapedArticle[]> {
  const articles: ScrapedArticle[] = [];
  try {
    const results = await firecrawlSearch("site:thirdway.org messaging strategy polling memo framing", firecrawlKey, 3);
    for (const result of results) {
      if (result.markdown.length > 100) {
        articles.push({
          title: result.title, slug: makeSlug(result.title),
          source: "Third Way", source_url: result.url, author: "Third Way",
          published_date: null, summary: result.description || result.markdown.slice(0, 300).replace(/[#*\n]/g, " ").trim(),
          content: result.markdown, issue_areas: detectIssueAreas(result.markdown, "Democrat"),
          research_type: "message-guidance",
        });
      }
    }
  } catch (e) { console.error("Error scraping Third Way:", e); }
  return articles;
}

async function scrapeAEI(firecrawlKey: string): Promise<ScrapedArticle[]> {
  const articles: ScrapedArticle[] = [];
  try {
    const results = await firecrawlSearch("site:aei.org public opinion polling messaging strategy conservative", firecrawlKey, 3);
    for (const result of results) {
      if (result.markdown.length > 100) {
        articles.push({
          title: result.title, slug: makeSlug(result.title),
          source: "American Enterprise Institute", source_url: result.url, author: "AEI Staff",
          published_date: null, summary: result.description || result.markdown.slice(0, 300).replace(/[#*\n]/g, " ").trim(),
          content: result.markdown, issue_areas: detectIssueAreas(result.markdown, "Republican"),
          research_type: "message-guidance",
        });
      }
    }
  } catch (e) { console.error("Error scraping AEI:", e); }
  return articles;
}

async function scrapeBrookings(firecrawlKey: string): Promise<ScrapedArticle[]> {
  const articles: ScrapedArticle[] = [];
  try {
    const results = await firecrawlSearch("site:brookings.edu public opinion framing messaging polling strategy", firecrawlKey, 3);
    for (const result of results) {
      if (result.markdown.length > 100) {
        articles.push({
          title: result.title, slug: makeSlug(result.title),
          source: "Brookings Institution", source_url: result.url, author: "Brookings Staff",
          published_date: null, summary: result.description || result.markdown.slice(0, 300).replace(/[#*\n]/g, " ").trim(),
          content: result.markdown, issue_areas: detectIssueAreas(result.markdown, "Independent"),
          research_type: "message-guidance",
        });
      }
    }
  } catch (e) { console.error("Error scraping Brookings:", e); }
  return articles;
}

async function scrapeDataForProgress(firecrawlKey: string): Promise<ScrapedArticle[]> {
  const articles: ScrapedArticle[] = [];
  try {
    const results = await firecrawlSearch("site:dataforprogress.org polling memo messaging framing", firecrawlKey, 3);
    for (const result of results) {
      if (result.markdown.length > 100) {
        articles.push({
          title: result.title, slug: makeSlug(result.title),
          source: "Data for Progress", source_url: result.url, author: "DFP Staff",
          published_date: null, summary: result.description || result.markdown.slice(0, 300).replace(/[#*\n]/g, " ").trim(),
          content: result.markdown, issue_areas: detectIssueAreas(result.markdown, "Democrat"),
          research_type: "polling-memo",
        });
      }
    }
  } catch (e) { console.error("Error scraping DFP:", e); }
  return articles;
}

async function scrapeNiskanen(firecrawlKey: string): Promise<ScrapedArticle[]> {
  const articles: ScrapedArticle[] = [];
  try {
    const results = await firecrawlSearch("site:niskanencenter.org policy analysis messaging public opinion", firecrawlKey, 2);
    for (const result of results) {
      if (result.markdown.length > 100) {
        articles.push({
          title: result.title, slug: makeSlug(result.title),
          source: "Niskanen Center", source_url: result.url, author: "Niskanen Center",
          published_date: null, summary: result.description || result.markdown.slice(0, 300).replace(/[#*\n]/g, " ").trim(),
          content: result.markdown, issue_areas: detectIssueAreas(result.markdown, "Independent"),
          research_type: "message-guidance",
        });
      }
    }
  } catch (e) { console.error("Error scraping Niskanen:", e); }
  return articles;
}

async function scrapeNewDem(firecrawlKey: string): Promise<ScrapedArticle[]> {
  const articles: ScrapedArticle[] = [];
  try {
    const results = await firecrawlSearch("site:newdemocratcoalition.house.gov OR site:newdem.org messaging polling strategy", firecrawlKey, 2);
    for (const result of results) {
      if (result.markdown.length > 100) {
        articles.push({
          title: result.title, slug: makeSlug(result.title),
          source: "New Democrat Coalition", source_url: result.url, author: "New Dem Coalition",
          published_date: null, summary: result.description || result.markdown.slice(0, 300).replace(/[#*\n]/g, " ").trim(),
          content: result.markdown, issue_areas: detectIssueAreas(result.markdown, "Democrat"),
          research_type: "message-guidance",
        });
      }
    }
  } catch (e) { console.error("Error scraping New Dem:", e); }
  return articles;
}

async function scrapeRStreet(firecrawlKey: string): Promise<ScrapedArticle[]> {
  const articles: ScrapedArticle[] = [];
  try {
    const results = await firecrawlSearch("site:rstreet.org policy brief messaging public opinion conservative", firecrawlKey, 2);
    for (const result of results) {
      if (result.markdown.length > 100) {
        articles.push({
          title: result.title, slug: makeSlug(result.title),
          source: "R Street Institute", source_url: result.url, author: "R Street",
          published_date: null, summary: result.description || result.markdown.slice(0, 300).replace(/[#*\n]/g, " ").trim(),
          content: result.markdown, issue_areas: detectIssueAreas(result.markdown, "Republican"),
          research_type: "message-guidance",
        });
      }
    }
  } catch (e) { console.error("Error scraping R Street:", e); }
  return articles;
}

function detectIssueAreas(text: string, defaultParty: string): string[] {
  const lower = text.toLowerCase();
  const areas: string[] = [defaultParty];
  const keywords: Record<string, string> = {
    immigration: "Immigration", border: "Border Security", tariff: "Tariffs",
    trade: "Trade", economy: "Economy", healthcare: "Health Care",
    "health care": "Health Care", deficit: "Budget", spending: "Budget",
    election: "Elections", "election integrity": "Election Integrity",
    "foreign policy": "Foreign Policy", china: "China", fentanyl: "Fentanyl",
    abortion: "Reproductive Rights", reproductive: "Reproductive Rights",
    climate: "Climate", energy: "Energy", education: "Education",
    "ai ": "Technology", "artificial intelligence": "Technology",
    housing: "Housing", guns: "Gun Policy", "second amendment": "Gun Policy",
    inflation: "Inflation", crime: "Crime", "social security": "Social Security",
    medicare: "Medicare", medicaid: "Medicaid", veteran: "Veterans",
    infrastructure: "Infrastructure", tax: "Tax Policy", democracy: "Democracy",
    "voting rights": "Voting Rights", ukraine: "Ukraine", israel: "Israel",
    "student loan": "Student Loans", childcare: "Childcare",
  };

  for (const [keyword, area] of Object.entries(keywords)) {
    if (lower.includes(keyword) && !areas.includes(area)) {
      areas.push(area);
    }
  }
  return areas;
}

const ALL_SOURCES: Record<string, (key: string) => Promise<ScrapedArticle[]>> = {
  navigator: scrapeNavigator,
  heritage: scrapeHeritage,
  bpc: scrapeBPC,
  cap: scrapeCAP,
  thirdway: scrapeThirdWay,
  aei: scrapeAEI,
  brookings: scrapeBrookings,
  dfp: scrapeDataForProgress,
  niskanen: scrapeNiskanen,
  newdem: scrapeNewDem,
  rstreet: scrapeRStreet,
};

/* ── Main handler ────────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      return new Response(JSON.stringify({ error: "FIRECRAWL_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request
    const body = await req.json().catch(() => ({}));
    const sources: string[] = body.sources || Object.keys(ALL_SOURCES);

    console.log("Syncing messaging from sources:", sources);

    // Scrape sources in parallel (batch 4 at a time to avoid rate limits)
    const allArticles: ScrapedArticle[] = [];
    const scraperNames = sources.filter(s => ALL_SOURCES[s]);
    
    for (let i = 0; i < scraperNames.length; i += 4) {
      const batch = scraperNames.slice(i, i + 4);
      const results = await Promise.allSettled(batch.map(s => ALL_SOURCES[s](firecrawlKey)));
      for (const result of results) {
        if (result.status === "fulfilled") allArticles.push(...result.value);
      }
      if (i + 4 < scraperNames.length) await new Promise(r => setTimeout(r, 1000));
    }

    // Get existing slugs to avoid duplicates
    const { data: existing } = await supabase.from("messaging_guidance").select("slug");
    const existingSlugs = new Set((existing || []).map((e: any) => e.slug));

    // Insert new articles
    const newArticles = allArticles.filter((a) => !existingSlugs.has(a.slug));
    let inserted = 0;

    for (const article of newArticles) {
      const { error } = await supabase.from("messaging_guidance").insert(article);
      if (!error) inserted++;
      else console.error("Insert error:", error.message);
    }

    return new Response(
      JSON.stringify({
        success: true, scraped: allArticles.length, new: inserted,
        sources, message: `Found ${allArticles.length} articles, inserted ${inserted} new.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Messaging sync error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
