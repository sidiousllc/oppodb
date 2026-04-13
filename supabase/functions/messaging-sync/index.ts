import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

/* ── Issue area detection ─────────────────────────────────── */

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
    opioid: "Opioid Crisis",
    labor: "Labor", union: "Labor", "minimum wage": "Labor",
    "racial justice": "Racial Justice", policing: "Criminal Justice",
    "criminal justice": "Criminal Justice", prison: "Criminal Justice",
    environment: "Environment", water: "Environment",
    "food stamp": "Social Safety Net", snap: "Social Safety Net",
    "national security": "National Security", terrorism: "National Security",
    disability: "Disability Rights", "mental health": "Mental Health",
    rural: "Rural Issues", agriculture: "Agriculture", farming: "Agriculture",
    internet: "Broadband", broadband: "Broadband",
    transgender: "LGBTQ+ Rights", lgbtq: "LGBTQ+ Rights",
    religion: "Religious Liberty", "religious liberty": "Religious Liberty",
    // Additional issue areas
    "drug pricing": "Drug Pricing", "prescription drug": "Drug Pricing",
    "free speech": "Free Speech", censorship: "Free Speech",
    "supply chain": "Supply Chain", manufacturing: "Manufacturing",
    semiconductor: "Technology", chips: "Technology",
    "book ban": "Education", "school choice": "Education",
    "police reform": "Criminal Justice", "defund": "Criminal Justice",
    crypto: "Cryptocurrency", bitcoin: "Cryptocurrency",
    "social media": "Technology", tiktok: "Technology",
    "electric vehicle": "Energy", ev: "Energy",
    nato: "Foreign Policy", "foreign aid": "Foreign Policy",
    "two-state": "Israel", palestinian: "Israel",
    "voter id": "Election Integrity", "mail-in": "Elections",
    "debt ceiling": "Budget", shutdown: "Budget",
    drought: "Water", wildfire: "Environment",
    "gun control": "Gun Policy", "assault weapon": "Gun Policy",
    "death penalty": "Criminal Justice", "capital punishment": "Criminal Justice",
    "minimum wage": "Labor",
    statehood: "Statehood", "puerto rico": "Statehood", "dc statehood": "Statehood",
    reparation: "Racial Justice",
    marijuana: "Drug Policy", cannabis: "Drug Policy",
    "supreme court": "Judiciary", "court reform": "Judiciary",
  };

  for (const [keyword, area] of Object.entries(keywords)) {
    if (lower.includes(keyword) && !areas.includes(area)) {
      areas.push(area);
    }
  }
  return areas;
}

/* ── Source scrapers ─────────────────────────────────────── */

function makeSearchScraper(
  siteDomain: string,
  searchTerms: string,
  sourceName: string,
  party: string,
  researchType: string = "message-guidance",
  limit: number = 3,
) {
  return async (firecrawlKey: string): Promise<ScrapedArticle[]> => {
    const articles: ScrapedArticle[] = [];
    try {
      const results = await firecrawlSearch(
        `site:${siteDomain} ${searchTerms}`,
        firecrawlKey,
        limit,
      );
      for (const result of results) {
        if (result.markdown.length > 100) {
          articles.push({
            title: result.title || `${sourceName} Report`,
            slug: makeSlug(result.title || `${sourceName}-report`),
            source: sourceName,
            source_url: result.url,
            author: sourceName,
            published_date: null,
            summary: result.description || result.markdown.slice(0, 300).replace(/[#*\n]/g, " ").trim(),
            content: result.markdown,
            issue_areas: detectIssueAreas(result.markdown, party),
            research_type: researchType,
          });
        }
      }
    } catch (e) {
      console.error(`Error scraping ${sourceName}:`, e);
    }
    return articles;
  };
}

// Navigator Research (custom scraper with link crawling)
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

// Heritage Foundation (custom scraper with link crawling)
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

const ALL_SOURCES: Record<string, (key: string) => Promise<ScrapedArticle[]>> = {
  /* ── Democrat / Left-leaning ── */
  navigator: scrapeNavigator,
  cap: makeSearchScraper("americanprogress.org", "messaging framing public opinion polling strategy", "Center for American Progress", "Democrat"),
  thirdway: makeSearchScraper("thirdway.org", "messaging strategy polling memo framing voter", "Third Way", "Democrat"),
  dfp: makeSearchScraper("dataforprogress.org", "polling memo messaging framing voter opinion", "Data for Progress", "Democrat", "polling-memo"),
  newdem: makeSearchScraper("newdemocratcoalition.house.gov", "messaging polling strategy economic", "New Democrat Coalition", "Democrat", "message-guidance", 2),
  democracycorps: makeSearchScraper("democracycorps.com", "polling memo strategy messaging battleground", "Democracy Corps", "Democrat", "polling-memo"),
  lakoff: makeSearchScraper("georgelakoff.com", "framing messaging moral politics language", "George Lakoff / Framing", "Democrat", "message-guidance", 2),
  equis: makeSearchScraper("equisresearch.com", "latino polling opinion research voter", "Equis Research", "Democrat", "polling-memo"),
  catalist: makeSearchScraper("catalist.us", "voter analysis electorate modeling turnout", "Catalist", "Democrat", "polling-memo", 2),
  civiqs: makeSearchScraper("civiqs.com", "polling tracker opinion approval public", "Civiqs", "Democrat", "polling-memo", 2),
  // New Democrat sources
  everytown: makeSearchScraper("everytown.org", "gun violence polling messaging advocacy research", "Everytown for Gun Safety", "Democrat"),
  indivisible: makeSearchScraper("indivisible.org", "messaging strategy activism grassroots advocacy", "Indivisible", "Democrat", "message-guidance", 2),
  swingleft: makeSearchScraper("swingleft.org", "messaging battleground district volunteer strategy", "Swing Left", "Democrat", "message-guidance", 2),
  demos: makeSearchScraper("demos.org", "democracy voting rights economic inequality research", "Demos", "Democrat"),
  americanbridge: makeSearchScraper("americanbridgepac.org", "research tracking opposition accountability", "American Bridge 21st Century", "Democrat", "opposition-research", 2),
  cbpp_msg: makeSearchScraper("cbpp.org", "messaging framing budget poverty safety net analysis", "Center on Budget and Policy Priorities", "Democrat"),
  epi_msg: makeSearchScraper("epi.org", "workers wages inequality messaging research analysis", "Economic Policy Institute", "Democrat"),
  americanpromise: makeSearchScraper("americanpromise.net", "campaign finance reform dark money citizens united", "American Promise", "Democrat", "message-guidance", 2),
  futureforward: makeSearchScraper("futureforwardusa.com", "research polling testing messaging voter persuasion", "Future Forward USA", "Democrat", "polling-memo", 2),
  civic_engagement: makeSearchScraper("civicengagement.org", "voter registration turnout civic participation", "Civic Engagement Fund", "Democrat", "message-guidance", 2),

  /* ── Republican / Right-leaning ── */
  heritage: scrapeHeritage,
  aei: makeSearchScraper("aei.org", "public opinion polling messaging strategy conservative voter", "American Enterprise Institute", "Republican"),
  rstreet: makeSearchScraper("rstreet.org", "policy brief messaging public opinion conservative reform", "R Street Institute", "Republican"),
  manhattan: makeSearchScraper("manhattan-institute.org", "policy messaging framing public opinion urban", "Manhattan Institute", "Republican"),
  hoover: makeSearchScraper("hoover.org", "policy strategy messaging opinion conservative economics", "Hoover Institution", "Republican"),
  claremont: makeSearchScraper("claremontreviewofbooks.com", "conservative messaging politics strategy", "Claremont Institute", "Republican", "message-guidance", 2),
  aaf: makeSearchScraper("americanactionforum.org", "policy analysis economic healthcare regulation", "American Action Forum", "Republican"),
  tnr_conservative: makeSearchScraper("nationalaffairs.com", "public policy conservative strategy reform", "National Affairs", "Republican", "message-guidance", 2),
  winning_message: makeSearchScraper("winningmessage.org", "polling messaging strategy conservative voters", "Winning the Message", "Republican", "polling-memo", 2),
  // New Republican sources
  afp: makeSearchScraper("americansforprosperity.org", "policy strategy grassroots conservative economic freedom", "Americans for Prosperity", "Republican"),
  aba_conservative: makeSearchScraper("amac.us", "conservative seniors policy advocacy messaging", "AMAC (Assoc. of Mature American Citizens)", "Republican", "message-guidance", 2),
  freedomworks: makeSearchScraper("freedomworks.org", "liberty economic freedom grassroots conservative", "FreedomWorks", "Republican"),
  taxpayers: makeSearchScraper("ntu.org", "tax policy spending fiscal responsibility conservative", "National Taxpayers Union", "Republican"),
  cis: makeSearchScraper("cis.org", "immigration policy research enforcement border messaging", "Center for Immigration Studies", "Republican"),
  clp: makeSearchScraper("competitiveenterprise.org", "regulation deregulation free market policy analysis", "Competitive Enterprise Institute", "Republican"),
  ipi: makeSearchScraper("ipi.org", "free market economics liberty policy analysis conservative", "Institute for Policy Innovation", "Republican", "message-guidance", 2),
  pacificresearch: makeSearchScraper("pacificresearch.org", "education school choice healthcare free market western", "Pacific Research Institute", "Republican", "message-guidance", 2),
  gop_strategy: makeSearchScraper("thebulwark.com", "conservative never-trump analysis strategy commentary", "The Bulwark", "Republican"),
  texaspolicy: makeSearchScraper("texaspolicy.com", "conservative policy state government limited regulation", "Texas Public Policy Foundation", "Republican"),
  hudson: makeSearchScraper("hudson.org", "foreign policy national security defense conservative", "Hudson Institute", "Republican"),

  /* ── Independent / Bipartisan / Nonpartisan ── */
  bpc: makeSearchScraper("bipartisanpolicy.org", "messaging strategy polling guidance bipartisan", "Bipartisan Policy Center", "Independent"),
  brookings: makeSearchScraper("brookings.edu", "public opinion framing messaging polling strategy voter", "Brookings Institution", "Independent"),
  niskanen: makeSearchScraper("niskanencenter.org", "policy analysis messaging public opinion reform", "Niskanen Center", "Independent", "message-guidance", 2),
  pewresearch: makeSearchScraper("pewresearch.org", "public opinion polling political attitudes voter", "Pew Research Center", "Independent", "polling-memo"),
  gallup: makeSearchScraper("gallup.com", "polling public opinion approval economy voter", "Gallup", "Independent", "polling-memo"),
  annenberg: makeSearchScraper("annenbergpublicpolicycenter.org", "public opinion media messaging factcheck", "Annenberg Public Policy Center", "Independent"),
  urban: makeSearchScraper("urban.org", "policy analysis social safety net economic mobility", "Urban Institute", "Independent"),
  newamerica: makeSearchScraper("newamerica.org", "policy analysis technology education economic security", "New America", "Independent"),
  cbo: makeSearchScraper("cbo.gov", "budget analysis economic outlook policy cost estimate", "Congressional Budget Office", "Independent", "policy-analysis", 2),
  rand: makeSearchScraper("rand.org", "policy analysis research public opinion defense health", "RAND Corporation", "Independent"),
  aspen: makeSearchScraper("aspeninstitute.org", "policy strategy leadership civic engagement voter", "Aspen Institute", "Independent", "message-guidance", 2),
  kff: makeSearchScraper("kff.org", "health policy polling public opinion affordable care", "KFF (Kaiser Family Foundation)", "Independent", "polling-memo"),
  brennan: makeSearchScraper("brennancenter.org", "voting rights election reform democracy messaging", "Brennan Center for Justice", "Independent"),
  // New Independent sources
  ipsos: makeSearchScraper("ipsos.com", "polling public opinion survey research voter attitudes", "Ipsos", "Independent", "polling-memo"),
  morningconsult: makeSearchScraper("morningconsult.com", "polling tracking public opinion survey data voter", "Morning Consult", "Independent", "polling-memo"),
  marist: makeSearchScraper("maristpoll.marist.edu", "polling survey public opinion national state voter", "Marist Poll", "Independent", "polling-memo", 2),
  quinnipiac: makeSearchScraper("poll.qu.edu", "polling public opinion swing state battleground voter", "Quinnipiac Poll", "Independent", "polling-memo", 2),
  apnorc: makeSearchScraper("apnorc.org", "polling public opinion research survey methodology", "AP-NORC Center", "Independent", "polling-memo"),
  kaiser_tracking: makeSearchScraper("kff.org", "health tracking poll public opinion aca medicaid", "KFF Health Tracking", "Independent", "polling-memo", 2),
  crs: makeSearchScraper("sgp.fas.org", "congressional research service policy analysis legislation", "Congressional Research Service", "Independent", "policy-analysis", 2),
  gao: makeSearchScraper("gao.gov", "government accountability audit analysis program evaluation", "GAO", "Independent", "policy-analysis", 2),
  cfr: makeSearchScraper("cfr.org", "foreign policy analysis global affairs national security", "Council on Foreign Relations", "Independent"),
  publicagenda: makeSearchScraper("publicagenda.org", "public opinion issue framing engagement civic", "Public Agenda", "Independent", "message-guidance", 2),
  issue_one: makeSearchScraper("issueone.org", "money politics ethics reform bipartisan transparency", "Issue One", "Independent"),
  represent_us: makeSearchScraper("represent.us", "anti-corruption reform ranked choice voting democracy", "RepresentUs", "Independent"),
  sunlight: makeSearchScraper("sunlightfoundation.com", "transparency open data government accountability", "Sunlight Foundation", "Independent", "message-guidance", 2),
  maplight: makeSearchScraper("maplight.org", "money politics influence voting transparency", "MapLight", "Independent"),
  opensecrets: makeSearchScraper("opensecrets.org", "campaign finance dark money lobbying political spending", "OpenSecrets", "Independent"),
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
        sources: scraperNames, message: `Found ${allArticles.length} articles, inserted ${inserted} new.`,
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
