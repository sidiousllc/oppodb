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

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/* ── Content cleanup (heuristic + AI) ─────────────────────── */

/** Fast heuristic pre-pass: drop nav/footer/share/subscribe/related-article noise. */
function cleanMarkdown(md: string): string {
  if (!md) return "";
  const lines = md.split("\n");
  const cleaned: string[] = [];
  const noisePatterns = [
    /^#{1,3}\s*(menu|navigation|nav|footer|sidebar|advertisement|cookie|subscribe|newsletter|sign up|log in|search|follow us|share this|related|trending|most read|popular|comments|leave a reply|more from|read more|recommended|you may also like|editor.?s pick|donate|support our work|about (us|the author))/i,
    /^\[?(menu|skip to|sign in|log in|subscribe|newsletter|cookie|accept|reject|privacy policy|terms of service|advertise|about us|contact us|careers|share on|tweet|email this|donate)\]?/i,
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
 * AI second-pass extractor: returns ONLY the main report/article body.
 * Strips related-articles widgets, share bars, subscribe boxes, comments,
 * "more from this section", author bios, and ads that survived the heuristic.
 * Returns null on any failure so callers fall back to the heuristic output.
 */
async function aiExtractMainArticle(rawMarkdown: string, sourceUrl: string): Promise<string | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;
  const input = rawMarkdown.length > 18000 ? rawMarkdown.slice(0, 18000) + "\n\n[truncated]" : rawMarkdown;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25_000);
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: [
              "You extract the MAIN REPORT/ARTICLE BODY from scraped political messaging guidance, polling memos, or policy briefs.",
              "Return ONLY the report via the tool. KEEP: headline, byline/dateline, all body paragraphs, blockquotes, inline lists, polling tables/findings, do/don't framing, recommended language, audience segments.",
              "REMOVE: site navigation, breadcrumbs, share/social buttons, 'related research', 'more from this section', 'recommended for you', 'trending', author bios at the end, subscribe/newsletter/donate boxes, comments, ads, 'sign in to read more', cookie banners, copyright footers, repeated section labels, and any widget that is not part of the report narrative.",
              "Do NOT summarize, rephrase, translate, or add commentary. Preserve original wording exactly.",
              "Output clean markdown: '# Headline' on first line, then byline/date if present, then sections separated by blank lines.",
            ].join(" "),
          },
          { role: "user", content: `Source URL: ${sourceUrl}\n\n--- SCRAPED CONTENT ---\n${input}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_article",
            description: "Return the cleaned main report body in markdown",
            parameters: {
              type: "object",
              properties: {
                article_markdown: { type: "string", description: "The report body in clean markdown. Empty string if no real report was found." },
                is_article: { type: "boolean", description: "False if the page is a paywall/login/404/listing page rather than an actual report." },
              },
              required: ["article_markdown", "is_article"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_article" } },
      }),
    }).finally(() => clearTimeout(t));

    if (!resp.ok) {
      console.log("AI extract failed:", resp.status);
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
    console.error("AI extract error:", (e as Error)?.message || e);
    return null;
  }
}

/** Two-pass cleanup: heuristic strip then AI extraction. Always returns usable markdown. */
async function cleanContent(rawMarkdown: string, sourceUrl: string): Promise<string> {
  const heuristic = cleanMarkdown(rawMarkdown);
  if (heuristic.length < 200) return heuristic;
  const aiOut = await aiExtractMainArticle(heuristic, sourceUrl);
  return aiOut || heuristic;
}

async function firecrawlScrape(url: string, firecrawlKey: string): Promise<{ markdown: string; title: string; links: string[] } | null> {
  try {
    const res = await fetchWithTimeout("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown", "links"], onlyMainContent: true }),
    }, 45_000);
    if (!res.ok) {
      console.error(`Firecrawl scrape ${res.status} for ${url}`);
      return null;
    }
    const data = await res.json();
    const rawMd = data?.data?.markdown || data?.markdown || "";
    return {
      markdown: await cleanContent(rawMd, url),
      title: data?.data?.metadata?.title || data?.metadata?.title || "",
      links: data?.data?.links || data?.links || [],
    };
  } catch (e) {
    console.error(`Firecrawl scrape error for ${url}:`, (e as Error)?.message || e);
    return null;
  }
}

async function firecrawlSearch(query: string, firecrawlKey: string, limit = 3): Promise<Array<{ markdown: string; title: string; url: string; description: string }>> {
  try {
    const res = await fetchWithTimeout("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit, scrapeOptions: { formats: ["markdown"] } }),
    }, 60_000);
    if (!res.ok) {
      console.error(`Firecrawl search ${res.status} for ${query}`);
      return [];
    }
    const data = await res.json();
    const rawResults = (data?.data || []).map((r: any) => ({
      markdown: r.markdown || "",
      title: r.title || r.metadata?.title || "",
      url: r.url || "",
      description: r.description || "",
    }));
    // Run AI cleanup sequentially per result to avoid bursting the AI gateway.
    const cleaned: Array<{ markdown: string; title: string; url: string; description: string }> = [];
    for (const r of rawResults) {
      cleaned.push({ ...r, markdown: await cleanContent(r.markdown, r.url) });
    }
    return cleaned;
  } catch (e) {
    console.error(`Firecrawl search error:`, (e as Error)?.message || e);
    return [];
  }
}

function makeSourceSlug(source: string, title: string): string {
  const base = (title || "report").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const prefix = source.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${prefix}-${base}`.slice(0, 100);
}

function makeSlug(title: string): string {
  return (title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
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
            slug: makeSourceSlug(sourceName, result.title || result.url || `${sourceName}-report`),
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
          title: article.title, slug: makeSourceSlug("navigator", article.title || link),
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
          slug: makeSourceSlug("heritage", article.title || link), source: "Heritage Foundation", source_url: link,
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
  // New Democrat sources
  lcv: makeSearchScraper("lcv.org", "environment climate scorecard voting record messaging", "League of Conservation Voters", "Democrat"),
  naacp: makeSearchScraper("naacp.org", "racial justice voting rights civil rights advocacy", "NAACP", "Democrat", "message-guidance", 2),
  emily_list: makeSearchScraper("emilyslist.org", "women candidates strategy messaging fundraising", "EMILY's List", "Democrat", "message-guidance", 2),
  nextgen: makeSearchScraper("nextgenamerica.org", "youth voter climate messaging mobilization", "NextGen America", "Democrat"),
  moveon: makeSearchScraper("moveon.org", "progressive advocacy grassroots messaging polling", "MoveOn", "Democrat", "message-guidance", 2),
  rockthevote: makeSearchScraper("rockthevote.org", "youth engagement voter registration turnout", "Rock the Vote", "Democrat", "message-guidance", 2),
  pod_save: makeSearchScraper("crooked.com", "progressive messaging strategy communication voter", "Crooked Media", "Democrat", "message-guidance", 2),
  afscme: makeSearchScraper("afscme.org", "labor union public worker advocacy messaging", "AFSCME", "Democrat"),
  sierra_club: makeSearchScraper("sierraclub.org", "environment climate energy advocacy messaging", "Sierra Club", "Democrat"),
  aclu: makeSearchScraper("aclu.org", "civil liberties rights advocacy voting policy", "ACLU", "Democrat"),

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
  // New Republican sources
  nra: makeSearchScraper("nraila.org", "second amendment gun rights firearms policy advocacy", "NRA-ILA", "Republican"),
  sba_list: makeSearchScraper("sbaprolife.org", "pro-life abortion policy advocacy messaging", "Susan B. Anthony Pro-Life America", "Republican", "message-guidance", 2),
  frc: makeSearchScraper("frc.org", "family values social conservative policy research", "Family Research Council", "Republican"),
  aclj: makeSearchScraper("aclj.org", "religious liberty legal advocacy conservative rights", "ACLJ", "Republican", "message-guidance", 2),
  heritage_action: makeSearchScraper("heritageaction.com", "conservative scorecard accountability advocacy", "Heritage Action", "Republican"),
  club_growth: makeSearchScraper("clubforgrowth.org", "economic growth tax reform spending conservative", "Club for Growth", "Republican"),
  turning_point: makeSearchScraper("tpusa.com", "youth conservative campus activism messaging", "Turning Point USA", "Republican", "message-guidance", 2),
  cato_msg: makeSearchScraper("cato.org", "libertarian policy analysis individual liberty limited government", "Cato Institute", "Republican"),
  discovery: makeSearchScraper("discovery.org", "science policy education technology conservative", "Discovery Institute", "Republican", "message-guidance", 2),
  jcn: makeSearchScraper("judicialnetwork.com", "judicial confirmation conservative courts legal", "Judicial Crisis Network", "Republican", "message-guidance", 2),

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
  // New Independent sources
  national_conference: makeSearchScraper("ncsl.org", "state legislation policy innovation bipartisan", "National Conference of State Legislatures", "Independent", "policy-analysis", 2),
  usip: makeSearchScraper("usip.org", "peace conflict resolution foreign policy bipartisan", "US Institute of Peace", "Independent"),
  woodrow_wilson: makeSearchScraper("wilsoncenter.org", "policy analysis international affairs bipartisan research", "Wilson Center", "Independent"),
  milken: makeSearchScraper("milkeninstitute.org", "economic policy innovation research prosperity", "Milken Institute", "Independent", "policy-analysis", 2),
  ced: makeSearchScraper("ced.org", "economic development business policy bipartisan", "Committee for Economic Development", "Independent"),
  propublica_research: makeSearchScraper("propublica.org", "investigative research government accountability data", "ProPublica", "Independent"),
  factcheck: makeSearchScraper("factcheck.org", "political claims fact checking accuracy verification", "FactCheck.org", "Independent", "policy-analysis", 2),
  governing_data: makeSearchScraper("governing.com", "state local government data policy analysis", "Governing", "Independent", "policy-analysis", 2),

  /* ── Expansion: additional Democrat / Left ── */
  prog_change: makeSearchScraper("boldprogressives.org", "progressive messaging strategy economic populist", "Progressive Change Campaign Committee", "Democrat", "message-guidance", 2),
  working_families: makeSearchScraper("workingfamilies.org", "labor messaging strategy worker progressive", "Working Families Party", "Democrat", "message-guidance", 2),
  blue_dog: makeSearchScraper("bluedogcaucus-costa.house.gov", "moderate centrist democrat messaging fiscal", "Blue Dog Coalition", "Democrat", "message-guidance", 2),
  cpc: makeSearchScraper("progressives.house.gov", "congressional progressive caucus messaging strategy", "Congressional Progressive Caucus", "Democrat", "message-guidance", 2),
  ndn: makeSearchScraper("ndn.org", "messaging research voter swing strategy", "NDN / New Policy Institute", "Democrat"),
  states_united: makeSearchScraper("statesuniteddemocracy.org", "election protection democracy messaging", "States United Democracy Center", "Democrat"),
  protect_democracy: makeSearchScraper("protectdemocracy.org", "democracy authoritarianism rule of law messaging", "Protect Democracy", "Democrat"),
  voto_latino: makeSearchScraper("votolatino.org", "latino voter engagement messaging mobilization", "Voto Latino", "Democrat", "message-guidance", 2),
  black_voters_matter: makeSearchScraper("blackvotersmatterfund.org", "black voter engagement turnout messaging", "Black Voters Matter", "Democrat", "message-guidance", 2),
  fair_fight: makeSearchScraper("fairfight.com", "voting rights election protection georgia messaging", "Fair Fight Action", "Democrat"),
  end_citizens_united: makeSearchScraper("endcitizensunited.org", "campaign finance reform dark money messaging", "End Citizens United", "Democrat"),
  giffords: makeSearchScraper("giffords.org", "gun safety violence prevention messaging policy", "Giffords", "Democrat"),
  brady: makeSearchScraper("bradyunited.org", "gun violence prevention background checks messaging", "Brady United", "Democrat"),
  human_rights_campaign: makeSearchScraper("hrc.org", "lgbtq equality messaging advocacy policy", "Human Rights Campaign", "Democrat"),
  planned_parenthood: makeSearchScraper("plannedparenthood.org", "reproductive rights healthcare messaging advocacy", "Planned Parenthood Action", "Democrat"),
  naral: makeSearchScraper("reproductivefreedomforall.org", "abortion reproductive freedom messaging strategy", "Reproductive Freedom for All", "Democrat"),
  unidos: makeSearchScraper("unidosus.org", "latino policy advocacy messaging research", "UnidosUS", "Democrat"),
  national_urban_league: makeSearchScraper("nul.org", "urban policy economic equity black messaging", "National Urban League", "Democrat", "message-guidance", 2),
  fwd_us: makeSearchScraper("fwd.us", "immigration reform criminal justice messaging", "FWD.us", "Democrat"),
  jstreet: makeSearchScraper("jstreet.org", "pro-israel pro-peace messaging foreign policy", "J Street", "Democrat", "message-guidance", 2),
  win_without_war: makeSearchScraper("winwithoutwar.org", "progressive foreign policy diplomacy messaging", "Win Without War", "Democrat", "message-guidance", 2),

  /* ── Expansion: additional Republican / Right ── */
  young_americas_foundation: makeSearchScraper("yaf.org", "conservative youth campus activism messaging", "Young America's Foundation", "Republican", "message-guidance", 2),
  prager_u: makeSearchScraper("prageru.com", "conservative education media messaging strategy", "PragerU", "Republican", "message-guidance", 2),
  cnp: makeSearchScraper("policycouncil.org", "conservative coalition strategy messaging", "Council for National Policy", "Republican", "message-guidance", 2),
  americans_for_tax_reform: makeSearchScraper("atr.org", "tax reform pledge anti-tax conservative messaging", "Americans for Tax Reform", "Republican"),
  ej_ref_action: makeSearchScraper("americasfuturenow.org", "conservative grassroots activism messaging policy", "America's Future", "Republican", "message-guidance", 2),
  alec: makeSearchScraper("alec.org", "state legislative conservative model legislation policy", "American Legislative Exchange Council", "Republican"),
  state_policy_network: makeSearchScraper("spn.org", "state think tank free market conservative network", "State Policy Network", "Republican"),
  goldwater: makeSearchScraper("goldwaterinstitute.org", "constitutional liberty conservative state policy", "Goldwater Institute", "Republican"),
  pacific_legal: makeSearchScraper("pacificlegal.org", "property rights individual liberty legal conservative", "Pacific Legal Foundation", "Republican"),
  rga: makeSearchScraper("rga.org", "republican governors strategy messaging gubernatorial", "Republican Governors Association", "Republican", "message-guidance", 2),
  nrcc: makeSearchScraper("nrcc.org", "republican congressional house messaging strategy", "NRCC", "Republican", "message-guidance", 2),
  nrsc: makeSearchScraper("nrsc.org", "republican senate messaging strategy candidate", "NRSC", "Republican", "message-guidance", 2),
  americans_for_prosperity_action: makeSearchScraper("americansforprosperityaction.com", "free market conservative grassroots messaging", "Americans for Prosperity Action", "Republican", "message-guidance", 2),
  young_voices: makeSearchScraper("youngvoices.com", "libertarian conservative young writers commentary", "Young Voices", "Republican", "message-guidance", 2),
  donors_trust: makeSearchScraper("donorstrust.org", "conservative philanthropy strategy messaging", "DonorsTrust", "Republican", "message-guidance", 2),
  faith_freedom: makeSearchScraper("ffcoalition.com", "faith family conservative voter mobilization messaging", "Faith & Freedom Coalition", "Republican"),
  judicial_watch: makeSearchScraper("judicialwatch.org", "government accountability conservative transparency legal", "Judicial Watch", "Republican"),
  america_first_policy: makeSearchScraper("americafirstpolicy.com", "america first conservative populist policy messaging", "America First Policy Institute", "Republican"),
  claremont_inst: makeSearchScraper("claremont.org", "conservative constitutional founding principles messaging", "Claremont Institute", "Republican"),
  ethics_public_policy: makeSearchScraper("eppc.org", "religious liberty conservative ethics public policy", "Ethics & Public Policy Center", "Republican"),

  /* ── Expansion: additional Independent / Bipartisan ── */
  no_labels: makeSearchScraper("nolabels.org", "centrist bipartisan problem-solver messaging", "No Labels", "Independent", "message-guidance", 2),
  bridge_alliance: makeSearchScraper("bridgealliance.us", "civic renewal bipartisan democracy messaging", "Bridge Alliance", "Independent", "message-guidance", 2),
  citizens_united_reform: makeSearchScraper("citizensunitedreform.org", "money politics campaign finance bipartisan", "Citizens for Responsibility", "Independent", "message-guidance", 2),
  crew: makeSearchScraper("citizensforethics.org", "ethics accountability watchdog bipartisan", "CREW", "Independent"),
  common_cause: makeSearchScraper("commoncause.org", "democracy reform voting rights ethics bipartisan", "Common Cause", "Independent"),
  league_women_voters: makeSearchScraper("lwv.org", "voter education civic engagement nonpartisan", "League of Women Voters", "Independent"),
  ballot_initiative: makeSearchScraper("ballot.org", "ballot initiative direct democracy nonpartisan", "Ballot Initiative Strategy Center", "Independent", "message-guidance", 2),
  brookings_governance: makeSearchScraper("brookings.edu", "governance reform democracy institutions analysis", "Brookings Governance Studies", "Independent", "policy-analysis", 2),
  urban_brookings_tax: makeSearchScraper("taxpolicycenter.org", "tax policy distributional analysis bipartisan", "Urban-Brookings Tax Policy Center", "Independent", "policy-analysis", 2),
  sandford_school: makeSearchScraper("sanford.duke.edu", "policy research analysis bipartisan academic", "Duke Sanford School", "Independent", "policy-analysis", 2),
  harris_school: makeSearchScraper("harris.uchicago.edu", "policy research bipartisan academic analysis", "Harris School (UChicago)", "Independent", "policy-analysis", 2),
  kennedy_school: makeSearchScraper("hks.harvard.edu", "policy research bipartisan academic analysis", "Harvard Kennedy School", "Independent", "policy-analysis", 2),
  pewtrusts: makeSearchScraper("pewtrusts.org", "policy research bipartisan analysis governance", "Pew Charitable Trusts", "Independent"),
  mit_election_lab: makeSearchScraper("electionlab.mit.edu", "election administration data nonpartisan research", "MIT Election Data Lab", "Independent", "policy-analysis", 2),
  baker_institute: makeSearchScraper("bakerinstitute.org", "policy research bipartisan houston analysis", "Baker Institute (Rice)", "Independent", "policy-analysis", 2),
  niskanen_climate: makeSearchScraper("niskanencenter.org", "climate policy bipartisan analysis pragmatic", "Niskanen Climate", "Independent", "policy-analysis", 2),
  data_society: makeSearchScraper("datasociety.net", "tech policy data society research nonpartisan", "Data & Society", "Independent", "policy-analysis", 2),
  electronic_frontier: makeSearchScraper("eff.org", "digital rights privacy tech policy nonpartisan", "Electronic Frontier Foundation", "Independent"),
  center_democracy_tech: makeSearchScraper("cdt.org", "civil liberties tech policy bipartisan analysis", "Center for Democracy & Technology", "Independent"),
  third_way_climate: makeSearchScraper("thirdway.org", "climate energy clean tech bipartisan analysis", "Third Way Climate", "Independent", "policy-analysis", 2),
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
    const requested: string[] | undefined = body.sources;
    const maxSources: number = Math.max(1, Math.min(Number(body.max_sources) || 8, 30));
    const allKeys = Object.keys(ALL_SOURCES);
    const scraperNames = (requested && requested.length > 0
      ? requested.filter((s) => ALL_SOURCES[s])
      : allKeys
    ).slice(0, maxSources);

    if (scraperNames.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No valid sources requested", available: allKeys }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Syncing messaging from sources:", scraperNames);

    // Scrape sources in parallel (batch 3 at a time to avoid rate limits / timeouts)
    const allArticles: ScrapedArticle[] = [];
    const perSource: Record<string, { ok: boolean; count: number; error?: string }> = {};

    for (let i = 0; i < scraperNames.length; i += 3) {
      const batch = scraperNames.slice(i, i + 3);
      const results = await Promise.allSettled(batch.map((s) => ALL_SOURCES[s](firecrawlKey)));
      results.forEach((result, idx) => {
        const name = batch[idx];
        if (result.status === "fulfilled") {
          allArticles.push(...result.value);
          perSource[name] = { ok: true, count: result.value.length };
        } else {
          console.error(`Scraper ${name} failed:`, result.reason);
          perSource[name] = { ok: false, count: 0, error: String(result.reason).slice(0, 200) };
        }
      });
      if (i + 3 < scraperNames.length) await new Promise((r) => setTimeout(r, 800));
    }

    // Dedupe in-memory by slug (keep first occurrence)
    const bySlug = new Map<string, ScrapedArticle>();
    for (const a of allArticles) {
      if (!a.slug) continue;
      if (!bySlug.has(a.slug)) bySlug.set(a.slug, a);
    }
    const deduped = Array.from(bySlug.values());

    // Upsert by slug — refresh existing rows and insert new ones
    let upserted = 0;
    let failed = 0;
    const errors: string[] = [];
    // Batch upserts in chunks of 50
    for (let i = 0; i < deduped.length; i += 50) {
      const chunk = deduped.slice(i, i + 50);
      const { error, count } = await supabase
        .from("messaging_guidance")
        .upsert(chunk, { onConflict: "slug", count: "exact" });
      if (error) {
        failed += chunk.length;
        errors.push(error.message);
        console.error("Upsert error:", error.message);
      } else {
        upserted += count ?? chunk.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        scraped: allArticles.length,
        deduped: deduped.length,
        upserted,
        failed,
        per_source: perSource,
        errors: errors.slice(0, 5),
        message: `Scraped ${allArticles.length}, deduped ${deduped.length}, upserted ${upserted}${failed ? `, failed ${failed}` : ""}.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Messaging sync error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
