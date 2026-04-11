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

/* ── Source scrapers ─────────────────────────────────────── */

async function scrapeNavigator(): Promise<ScrapedArticle[]> {
  const articles: ScrapedArticle[] = [];
  try {
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      console.log("No FIRECRAWL_API_KEY — skipping Navigator scrape");
      return articles;
    }

    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: "https://navigatorresearch.org/research/message-guidance/",
        formats: ["markdown", "links"],
        onlyMainContent: true,
      }),
    });

    const data = await res.json();
    const md = data?.data?.markdown || data?.markdown || "";
    const links: string[] = data?.data?.links || data?.links || [];

    // Parse article links from the page
    const guidanceLinks = links.filter(
      (l: string) =>
        l.includes("navigatorresearch.org/") &&
        !l.includes("/research/message-guidance") &&
        !l.includes("/about") &&
        !l.includes("/contact") &&
        !l.includes("/category") &&
        l !== "https://navigatorresearch.org/"
    );

    // Scrape first 3 new links to avoid rate limits
    for (const link of guidanceLinks.slice(0, 3)) {
      try {
        const articleRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: link,
            formats: ["markdown"],
            onlyMainContent: true,
          }),
        });
        const articleData = await articleRes.json();
        const articleMd =
          articleData?.data?.markdown || articleData?.markdown || "";
        const title =
          articleData?.data?.metadata?.title || articleData?.metadata?.title || "";

        if (title && articleMd.length > 100) {
          const slug = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 80);

          articles.push({
            title,
            slug,
            source: "Navigator Research",
            source_url: link,
            author: "Navigator Research",
            published_date: null,
            summary: articleMd.slice(0, 300).replace(/[#*\n]/g, " ").trim(),
            content: articleMd,
            issue_areas: ["Democrat"],
            research_type: "message-guidance",
          });
        }
      } catch (e) {
        console.error("Error scraping Navigator article:", e);
      }
    }
  } catch (e) {
    console.error("Error scraping Navigator:", e);
  }
  return articles;
}

async function scrapeHeritage(): Promise<ScrapedArticle[]> {
  const articles: ScrapedArticle[] = [];
  try {
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) return articles;

    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: "https://www.heritage.org/conservatism/commentary",
        formats: ["markdown", "links"],
        onlyMainContent: true,
      }),
    });

    const data = await res.json();
    const links: string[] = data?.data?.links || data?.links || [];

    const commentaryLinks = links.filter(
      (l: string) =>
        l.includes("heritage.org/") &&
        l.includes("/commentary/") &&
        l.split("/").length > 4
    );

    for (const link of commentaryLinks.slice(0, 2)) {
      try {
        const articleRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: link,
            formats: ["markdown"],
            onlyMainContent: true,
          }),
        });
        const articleData = await articleRes.json();
        const articleMd =
          articleData?.data?.markdown || articleData?.markdown || "";
        const title =
          articleData?.data?.metadata?.title || articleData?.metadata?.title || "";

        if (title && articleMd.length > 100) {
          const slug = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 80);

          // Detect issue areas from content
          const issueAreas = detectIssueAreas(articleMd, "Republican");

          articles.push({
            title: title.replace(" | The Heritage Foundation", ""),
            slug,
            source: "Heritage Foundation",
            source_url: link,
            author: "Heritage Foundation",
            published_date: null,
            summary: articleMd.slice(0, 300).replace(/[#*\n]/g, " ").trim(),
            content: articleMd,
            issue_areas: issueAreas,
            research_type: "message-guidance",
          });
        }
      } catch (e) {
        console.error("Error scraping Heritage article:", e);
      }
    }
  } catch (e) {
    console.error("Error scraping Heritage:", e);
  }
  return articles;
}

async function scrapeBPC(): Promise<ScrapedArticle[]> {
  const articles: ScrapedArticle[] = [];
  try {
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) return articles;

    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: "site:bipartisanpolicy.org messaging strategy polling guidance",
        limit: 3,
        scrapeOptions: { formats: ["markdown"] },
      }),
    });

    const data = await res.json();
    const results = data?.data || [];

    for (const result of results) {
      if (result.markdown && result.markdown.length > 100) {
        const title = result.title || result.metadata?.title || "BPC Report";
        const slug = title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 80);

        articles.push({
          title,
          slug,
          source: "Bipartisan Policy Center",
          source_url: result.url || "",
          author: "BPC Staff",
          published_date: null,
          summary: result.description || result.markdown.slice(0, 300).replace(/[#*\n]/g, " ").trim(),
          content: result.markdown,
          issue_areas: detectIssueAreas(result.markdown, "Independent"),
          research_type: "message-guidance",
        });
      }
    }
  } catch (e) {
    console.error("Error scraping BPC:", e);
  }
  return articles;
}

function detectIssueAreas(text: string, defaultParty: string): string[] {
  const lower = text.toLowerCase();
  const areas: string[] = [defaultParty];
  const keywords: Record<string, string> = {
    immigration: "Immigration",
    border: "Border Security",
    tariff: "Tariffs",
    trade: "Trade",
    economy: "Economy",
    healthcare: "Health Care",
    "health care": "Health Care",
    deficit: "Budget",
    spending: "Budget",
    election: "Elections",
    "election integrity": "Election Integrity",
    "foreign policy": "Foreign Policy",
    china: "China",
    fentanyl: "Fentanyl",
    abortion: "Reproductive Rights",
    "reproductive": "Reproductive Rights",
    climate: "Climate",
    energy: "Energy",
    education: "Education",
    "ai ": "Technology",
    "artificial intelligence": "Technology",
    housing: "Housing",
    guns: "Gun Policy",
    "second amendment": "Gun Policy",
  };

  for (const [keyword, area] of Object.entries(keywords)) {
    if (lower.includes(keyword) && !areas.includes(area)) {
      areas.push(area);
    }
  }
  return areas;
}

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
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Parse request
    const body = await req.json().catch(() => ({}));
    const sources: string[] = body.sources || ["navigator", "heritage", "bpc"];

    console.log("Syncing messaging from sources:", sources);

    // Scrape sources in parallel
    const scrapers: Promise<ScrapedArticle[]>[] = [];
    if (sources.includes("navigator")) scrapers.push(scrapeNavigator());
    if (sources.includes("heritage")) scrapers.push(scrapeHeritage());
    if (sources.includes("bpc")) scrapers.push(scrapeBPC());

    const results = await Promise.all(scrapers);
    const allArticles = results.flat();

    // Get existing slugs to avoid duplicates
    const { data: existing } = await supabase
      .from("messaging_guidance")
      .select("slug");
    const existingSlugs = new Set((existing || []).map((e: any) => e.slug));

    // Insert new articles
    const newArticles = allArticles.filter((a) => !existingSlugs.has(a.slug));
    let inserted = 0;

    for (const article of newArticles) {
      const { error } = await supabase
        .from("messaging_guidance")
        .insert(article);
      if (!error) inserted++;
      else console.error("Insert error:", error.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        scraped: allArticles.length,
        new: inserted,
        sources: sources,
        message: `Found ${allArticles.length} articles, inserted ${inserted} new.`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Messaging sync error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
