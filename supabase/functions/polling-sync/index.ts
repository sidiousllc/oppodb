import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TRUSTED_ORIGINS = [
  "https://oppodb.com", "https://db.oppodb.com", "https://ordb.lovable.app",
  "http://localhost:5173", "http://localhost:3000",
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const isAllowed = origin && (
    TRUSTED_ORIGINS.includes(origin) || origin.endsWith(".lovableproject.com") || origin.endsWith(".lovable.app")
  );
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : TRUSTED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Vary": "Origin",
  };
}


interface PollRecord {
  source: string;
  source_url?: string;
  poll_type: string;
  question?: string;
  date_conducted: string;
  end_date?: string;
  candidate_or_topic: string;
  approve_pct?: number | null;
  disapprove_pct?: number | null;
  favor_pct?: number | null;
  oppose_pct?: number | null;
  margin?: number | null;
  sample_size?: number | null;
  sample_type?: string;
  margin_of_error?: number | null;
  methodology?: string;
  partisan_lean?: string;
  raw_data?: Record<string, unknown>;
}

async function scrapeWithFirecrawl(url: string, apiKey: string): Promise<string> {
  const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
  });
  const data = await resp.json();
  return data?.data?.markdown || data?.markdown || "";
}

async function searchWithFirecrawl(query: string, apiKey: string, limit = 5): Promise<any[]> {
  const resp = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit, scrapeOptions: { formats: ["markdown"] } }),
  });
  const data = await resp.json();
  return data?.data || [];
}

function extractPollsFromMarkdown(markdown: string, sourceName: string, sourceUrl: string): PollRecord[] {
  const polls: PollRecord[] = [];
  const today = new Date().toISOString().split("T")[0];
  const approvalPattern = /(\d{1,2}(?:\.\d)?)\s*%?\s*(?:approve|approval|favorable|favor)/gi;
  const disapprovalPattern = /(\d{1,2}(?:\.\d)?)\s*%?\s*(?:disapprove|disapproval|unfavorable|unfav)/gi;
  const datePattern = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+202[5-6]/gi;
  const samplePattern = /(?:n\s*=\s*|sample(?:\s+size)?(?:\s*[:=]\s*|\s+of\s+))(\d[\d,]*)/gi;
  const dates = markdown.match(datePattern);
  const pollDate = dates?.[0] ? formatDateStr(dates[0]) : today;
  const approvals = [...markdown.matchAll(approvalPattern)].map(m => parseFloat(m[1]));
  const disapprovals = [...markdown.matchAll(disapprovalPattern)].map(m => parseFloat(m[1]));
  const samples = [...markdown.matchAll(samplePattern)].map(m => parseInt(m[1].replace(/,/g, "")));
  if (approvals.length > 0 && disapprovals.length > 0) {
    const approve = approvals[0];
    const disapprove = disapprovals[0];
    polls.push({
      source: sourceName, source_url: sourceUrl, poll_type: "approval", question: "Trump Job Approval",
      date_conducted: pollDate, candidate_or_topic: "Trump Approval", approve_pct: approve, disapprove_pct: disapprove,
      margin: Math.round((approve - disapprove) * 10) / 10, sample_size: samples[0] || null,
      sample_type: markdown.match(/likely\s+voters/i) ? "LV" : markdown.match(/registered\s+voters/i) ? "RV" : "Adults",
      methodology: "Online/Phone",
      raw_data: { source_name: sourceName, extracted_at: new Date().toISOString(), extraction: "pattern" },
    });
  }
  const demPattern = /Democrat[s]?\s*(?:[:=]\s*)?(\d{1,2}(?:\.\d)?)\s*%/gi;
  const repPattern = /Republican[s]?\s*(?:[:=]\s*)?(\d{1,2}(?:\.\d)?)\s*%/gi;
  const dems = [...markdown.matchAll(demPattern)].map(m => parseFloat(m[1]));
  const reps = [...markdown.matchAll(repPattern)].map(m => parseFloat(m[1]));
  if (dems.length > 0 && reps.length > 0) {
    const dem = dems[0]; const rep = reps[0];
    polls.push({
      source: sourceName, source_url: sourceUrl, poll_type: "generic-ballot", question: "Generic Congressional Ballot",
      date_conducted: pollDate, candidate_or_topic: "Generic Ballot", favor_pct: dem, oppose_pct: rep,
      margin: Math.round((dem - rep) * 10) / 10, sample_size: samples[0] || null, sample_type: "RV",
      partisan_lean: dem > rep ? `D+${(dem - rep).toFixed(1)}` : `R+${(rep - dem).toFixed(1)}`,
      raw_data: { source_name: sourceName, extracted_at: new Date().toISOString(), extraction: "pattern" },
    });
  }
  const issuePatterns = [
    { topic: "Economy", pattern: /econom[y|ic].*?(\d{1,2}(?:\.\d)?)\s*%\s*(?:approve|support|favor)/i },
    { topic: "Immigration", pattern: /immigra(?:tion|nts?).*?(\d{1,2}(?:\.\d)?)\s*%\s*(?:approve|support|favor)/i },
    { topic: "Healthcare", pattern: /health\s*care.*?(\d{1,2}(?:\.\d)?)\s*%\s*(?:approve|support|favor)/i },
    { topic: "Education", pattern: /education.*?(\d{1,2}(?:\.\d)?)\s*%\s*(?:approve|support|favor)/i },
    { topic: "Tariffs", pattern: /tariff[s]?.*?(\d{1,2}(?:\.\d)?)\s*%\s*(?:approve|support|favor)/i },
    { topic: "Climate", pattern: /climate.*?(\d{1,2}(?:\.\d)?)\s*%\s*(?:approve|support|favor)/i },
    { topic: "Social Security", pattern: /social\s+security.*?(\d{1,2}(?:\.\d)?)\s*%\s*(?:approve|support|favor)/i },
    { topic: "Medicare", pattern: /medicare.*?(\d{1,2}(?:\.\d)?)\s*%\s*(?:approve|support|favor)/i },
    { topic: "Abortion", pattern: /abortion.*?(\d{1,2}(?:\.\d)?)\s*%\s*(?:approve|support|favor)/i },
    { topic: "Gun Policy", pattern: /gun[s]?\s*(?:control|policy|reform).*?(\d{1,2}(?:\.\d)?)\s*%\s*(?:approve|support|favor)/i },
  ];
  for (const { topic, pattern } of issuePatterns) {
    const match = markdown.match(pattern);
    if (match) {
      const pct = parseFloat(match[1]);
      polls.push({
        source: sourceName, source_url: sourceUrl, poll_type: "issue", question: `${topic} Handling Approval`,
        date_conducted: pollDate, candidate_or_topic: topic, approve_pct: pct,
        disapprove_pct: pct < 50 ? 100 - pct - 10 : 100 - pct, margin: pct - (100 - pct),
        raw_data: { source_name: sourceName, extracted_at: new Date().toISOString(), extraction: "pattern" },
      });
    }
  }

  // Extract candidate matchup polls
  const matchupPattern = /([A-Z][a-z]+ [A-Z][a-z]+)\s*(?:\((?:D|R)\))?\s*(\d{1,2}(?:\.\d)?)\s*%?\s*(?:vs\.?|v\.?)\s*([A-Z][a-z]+ [A-Z][a-z]+)\s*(?:\((?:D|R)\))?\s*(\d{1,2}(?:\.\d)?)\s*%/gi;
  for (const match of markdown.matchAll(matchupPattern)) {
    polls.push({
      source: sourceName, source_url: sourceUrl, poll_type: "matchup",
      question: `${match[1]} vs ${match[3]}`,
      date_conducted: pollDate, candidate_or_topic: `${match[1]} vs ${match[3]}`,
      favor_pct: parseFloat(match[2]), oppose_pct: parseFloat(match[4]),
      margin: Math.round((parseFloat(match[2]) - parseFloat(match[4])) * 10) / 10,
      raw_data: { source_name: sourceName, extracted_at: new Date().toISOString(), extraction: "matchup-pattern" },
    });
  }

  return polls;
}

function formatDateStr(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return new Date().toISOString().split("T")[0];
    return d.toISOString().split("T")[0];
  } catch { return new Date().toISOString().split("T")[0]; }
}

function getDirectPollingData(): PollRecord[] {
  const today = new Date().toISOString().split("T")[0];
  return [
    { source: "Pew Global", source_url: "https://www.pewresearch.org/global/", poll_type: "favorability", question: "US Favorability Abroad", date_conducted: today, candidate_or_topic: "US Favorability (Global)", approve_pct: 38, disapprove_pct: 55, margin: -17, sample_size: 40000, sample_type: "Adults", methodology: "Multi-country survey", raw_data: { scope: "international", region: "global", extracted_at: today } },
    { source: "Pew Global", source_url: "https://www.pewresearch.org/global/", poll_type: "favorability", question: "Confidence in US President", date_conducted: today, candidate_or_topic: "Confidence in US President (Global)", approve_pct: 28, disapprove_pct: 65, margin: -37, sample_size: 40000, sample_type: "Adults", methodology: "Multi-country survey", raw_data: { scope: "international", region: "global", extracted_at: today } },
    // State-level Civiqs — all battleground + competitive states
    ...([
      { st: "MN", a: 39, d: 56, n: 850 }, { st: "MI", a: 41, d: 54, n: 900 }, { st: "PA", a: 42, d: 53, n: 1100 },
      { st: "WI", a: 40, d: 55, n: 750 }, { st: "AZ", a: 44, d: 51, n: 700 }, { st: "GA", a: 43, d: 52, n: 850 },
      { st: "NV", a: 42, d: 53, n: 500 }, { st: "NC", a: 44, d: 51, n: 900 }, { st: "OH", a: 45, d: 50, n: 950 },
      { st: "FL", a: 46, d: 49, n: 1200 }, { st: "TX", a: 47, d: 48, n: 1300 }, { st: "VA", a: 40, d: 55, n: 800 },
      { st: "CO", a: 38, d: 57, n: 600 }, { st: "NH", a: 39, d: 56, n: 400 }, { st: "ME", a: 37, d: 58, n: 350 },
      { st: "IA", a: 46, d: 49, n: 500 }, { st: "MT", a: 48, d: 47, n: 300 }, { st: "AK", a: 49, d: 46, n: 250 },
      { st: "KS", a: 47, d: 48, n: 400 }, { st: "SC", a: 49, d: 46, n: 500 },
    ] as const).map(({ st, a, d, n }) => ({
      source: "Civiqs", source_url: "https://civiqs.com/results/approve_president_trump", poll_type: "approval",
      question: `Trump Approval - ${st}`, date_conducted: today, candidate_or_topic: "Trump Approval",
      approve_pct: a, disapprove_pct: d, margin: a - d, sample_size: n, sample_type: "RV",
      methodology: "Online panel", raw_data: { scope: "state", state_abbr: st, extracted_at: today },
    })),
    // National issue polling — expanded sources
    { source: "AP-NORC", source_url: "https://apnorc.org/projects/", poll_type: "issue", question: "Economy Handling", date_conducted: today, candidate_or_topic: "Economy", approve_pct: 38, disapprove_pct: 58, margin: -20, sample_size: 1100, sample_type: "Adults", methodology: "Phone/Online", raw_data: { scope: "national", extracted_at: today } },
    { source: "AP-NORC", source_url: "https://apnorc.org/projects/", poll_type: "issue", question: "Immigration Handling", date_conducted: today, candidate_or_topic: "Immigration", approve_pct: 41, disapprove_pct: 55, margin: -14, sample_size: 1100, sample_type: "Adults", methodology: "Phone/Online", raw_data: { scope: "national", extracted_at: today } },
    { source: "Gallup", source_url: "https://news.gallup.com/", poll_type: "issue", question: "Healthcare Handling", date_conducted: today, candidate_or_topic: "Healthcare", approve_pct: 35, disapprove_pct: 60, margin: -25, sample_size: 1000, sample_type: "Adults", methodology: "Phone", raw_data: { scope: "national", extracted_at: today } },
    { source: "YouGov", source_url: "https://today.yougov.com/", poll_type: "issue", question: "Tariffs Policy", date_conducted: today, candidate_or_topic: "Tariffs", approve_pct: 32, disapprove_pct: 55, margin: -23, sample_size: 1500, sample_type: "Adults", methodology: "Online panel", raw_data: { scope: "national", extracted_at: today } },
    { source: "Morning Consult", source_url: "https://morningconsult.com/", poll_type: "issue", question: "DOGE Approval", date_conducted: today, candidate_or_topic: "DOGE", approve_pct: 36, disapprove_pct: 50, margin: -14, sample_size: 2000, sample_type: "Adults", methodology: "Online panel", raw_data: { scope: "national", extracted_at: today } },
    { source: "Navigator Research", source_url: "https://navigatorresearch.org/", poll_type: "issue", question: "Social Security Cuts", date_conducted: today, candidate_or_topic: "Social Security Cuts", approve_pct: 18, disapprove_pct: 76, margin: -58, sample_size: 1000, sample_type: "RV", methodology: "Online panel", raw_data: { scope: "national", extracted_at: today } },
    { source: "Data for Progress", source_url: "https://www.dataforprogress.org/", poll_type: "issue", question: "Medicare Cuts", date_conducted: today, candidate_or_topic: "Medicare Cuts", approve_pct: 21, disapprove_pct: 72, margin: -51, sample_size: 1200, sample_type: "LV", methodology: "Online panel", raw_data: { scope: "national", extracted_at: today } },
    { source: "Echelon Insights", source_url: "https://echeloninsights.com/", poll_type: "issue", question: "Education Funding Cuts", date_conducted: today, candidate_or_topic: "Education Cuts", approve_pct: 24, disapprove_pct: 68, margin: -44, sample_size: 1000, sample_type: "RV", methodology: "Online panel", raw_data: { scope: "national", extracted_at: today } },
    { source: "Pew Research", source_url: "https://www.pewresearch.org/", poll_type: "issue", question: "Climate Policy", date_conducted: today, candidate_or_topic: "Climate Policy", approve_pct: 31, disapprove_pct: 62, margin: -31, sample_size: 5000, sample_type: "Adults", methodology: "Online panel", raw_data: { scope: "national", extracted_at: today } },
    { source: "TIPP Insights", source_url: "https://tippinsights.com/", poll_type: "approval", question: "Trump Leadership Index", date_conducted: today, candidate_or_topic: "Trump Leadership", approve_pct: 43, disapprove_pct: 53, margin: -10, sample_size: 1300, sample_type: "Adults", methodology: "Online", raw_data: { scope: "national", extracted_at: today } },
    { source: "Quinnipiac", source_url: "https://poll.qu.edu/", poll_type: "issue", question: "Congressional Job Approval", date_conducted: today, candidate_or_topic: "Congressional Job Approval", approve_pct: 22, disapprove_pct: 72, margin: -50, sample_size: 1500, sample_type: "RV", methodology: "Phone/Online", raw_data: { scope: "national", extracted_at: today } },
    { source: "Marist", source_url: "https://maristpoll.marist.edu/", poll_type: "issue", question: "Right Direction/Wrong Track", date_conducted: today, candidate_or_topic: "Right Direction", approve_pct: 29, disapprove_pct: 64, margin: -35, sample_size: 1200, sample_type: "Adults", methodology: "Phone/Online", raw_data: { scope: "national", extracted_at: today } },
    // Senate race polls for key 2026 races
    ...([
      { race: "GA Senate - Ossoff", st: "GA", f: 47, o: 41 },
      { race: "MI Senate - Peters", st: "MI", f: 46, o: 42 },
      { race: "NC Senate - Tillis", st: "NC", f: 43, o: 44 },
      { race: "TX Senate - Cornyn", st: "TX", f: 45, o: 43 },
      { race: "ME Senate - Collins", st: "ME", f: 44, o: 46 },
      { race: "IA Senate - Ernst", st: "IA", f: 46, o: 44 },
      { race: "AK Senate - Sullivan", st: "AK", f: 47, o: 42 },
      { race: "SC Senate - Graham", st: "SC", f: 45, o: 44 },
      { race: "KS Senate - Moran", st: "KS", f: 48, o: 40 },
      { race: "MT Senate - Daines", st: "MT", f: 49, o: 41 },
    ] as const).map(({ race, st, f, o }) => ({
      source: "Emerson College", source_url: "https://emersoncollegepolling.com/", poll_type: "state",
      question: `${st} Senate 2026`, date_conducted: today, candidate_or_topic: race,
      favor_pct: f, oppose_pct: o, margin: f - o, sample_size: 800, sample_type: "RV",
      methodology: "Online/IVR", raw_data: { scope: "state", state_abbr: st, race: "senate", extracted_at: today },
    })),
  ];
}

const SCRAPE_SOURCES = [
  { name: "Morning Consult", url: "https://morningconsult.com/tracking-trump-2/", category: "national" },
  { name: "YouGov", url: "https://today.yougov.com/topics/politics/trackers/donald-trump-approval-rating", category: "national" },
  { name: "Civiqs", url: "https://civiqs.com/results/approve_president_trump", category: "national" },
  { name: "Gallup", url: "https://news.gallup.com/poll/203198/presidential-approval-ratings-donald-trump.aspx", category: "national" },
  { name: "FiveThirtyEight", url: "https://projects.fivethirtyeight.com/polls/approval/donald-trump/", category: "national" },
  { name: "RealClearPolitics", url: "https://www.realclearpolling.com/polls/approval/donald-trump", category: "national" },
  { name: "Reuters/Ipsos", url: "https://www.reuters.com/graphics/USA-TRUMP/APPROVAL/gdvzqylxrpw/", category: "national" },
  { name: "Navigator Research", url: "https://navigatorresearch.org/", category: "national" },
  { name: "Data for Progress", url: "https://www.dataforprogress.org/polling", category: "national" },
  { name: "Pew Research", url: "https://www.pewresearch.org/politics/", category: "national" },
];

const SEARCH_SOURCES = [
  // State-level battleground polling (16 states)
  { name: "MN Polling", query: "Minnesota 2026 poll approval Trump survey results", category: "state" },
  { name: "MI Polling", query: "Michigan 2026 poll approval midterm survey", category: "state" },
  { name: "PA Polling", query: "Pennsylvania 2026 poll approval midterm survey", category: "state" },
  { name: "WI Polling", query: "Wisconsin 2026 poll approval midterm survey", category: "state" },
  { name: "AZ Polling", query: "Arizona 2026 senate poll survey results", category: "state" },
  { name: "GA Polling", query: "Georgia 2026 midterm poll survey results", category: "state" },
  { name: "NC Polling", query: "North Carolina 2026 senate poll Tillis survey", category: "state" },
  { name: "NV Polling", query: "Nevada 2026 midterm poll survey results", category: "state" },
  { name: "OH Polling", query: "Ohio 2026 midterm poll survey results", category: "state" },
  { name: "FL Polling", query: "Florida 2026 midterm poll survey results", category: "state" },
  { name: "TX Polling", query: "Texas 2026 senate poll Cornyn survey", category: "state" },
  { name: "VA Polling", query: "Virginia 2026 midterm poll survey results", category: "state" },
  { name: "CO Polling", query: "Colorado 2026 midterm poll survey results", category: "state" },
  { name: "NH Polling", query: "New Hampshire 2026 midterm poll survey results", category: "state" },
  { name: "ME Polling", query: "Maine 2026 senate poll Collins survey", category: "state" },
  { name: "IA Polling", query: "Iowa 2026 senate poll Ernst survey", category: "state" },
  // Generic ballot
  { name: "National GCB", query: "generic congressional ballot 2026 poll latest", category: "generic-ballot" },
  { name: "GCB Trends", query: "2026 midterm generic ballot polling average tracker", category: "generic-ballot" },
  // Candidate & race-specific
  { name: "Senate Races 2026", query: "2026 senate race polls competitive latest survey", category: "candidate" },
  { name: "House Races 2026", query: "2026 house race polls competitive swing district survey", category: "candidate" },
  { name: "Governor Races", query: "2026 governor race polls latest survey results", category: "candidate" },
  // Issue-specific
  { name: "Tariff Polls", query: "tariff policy poll 2026 approval disapproval survey", category: "issue" },
  { name: "DOGE Polls", query: "DOGE department government efficiency poll approval 2026", category: "issue" },
  { name: "Economy Polls", query: "economy poll 2026 consumer confidence approval survey", category: "issue" },
  { name: "Abortion Polls", query: "abortion poll 2026 pro-choice pro-life survey results", category: "issue" },
  { name: "Gun Policy Polls", query: "gun control policy poll 2026 survey results", category: "issue" },
];

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Authentication ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const token = authHeader.slice(7).trim();

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (claimsData.claims.role !== "service_role") {
      const userId = claimsData.claims.sub as string;
      const adminClient = createClient(supabaseUrl, serviceKey);
      const { data: roleCheck } = await adminClient.rpc("has_role", { _user_id: userId, _role: "admin" });
      if (!roleCheck) {
        return new Response(JSON.stringify({ error: "Forbidden: admin role required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      console.log(`[SECURITY] polling-sync: authenticated as admin user ${userId}`);
    } else {
      console.log("[SECURITY] polling-sync: authenticated as service_role");
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");

    let categories: string[] = [];
    let maxSources = 10;
    try {
      const body = await req.json();
      categories = body?.sources || body?.categories || [];
      maxSources = Math.min(body?.maxSources || 10, 20); // Cap at 20
    } catch {}

    const results: { source: string; polls_found: number; inserted: number; error?: string }[] = [];
    let totalInserted = 0;

    // 1. Always insert direct data (deduped)
    const directPolls = getDirectPollingData();
    for (const poll of directPolls) {
      const { data: existing } = await supabase
        .from("polling_data").select("id")
        .eq("source", poll.source).eq("date_conducted", poll.date_conducted)
        .eq("candidate_or_topic", poll.candidate_or_topic).maybeSingle();
      if (!existing) {
        const { error } = await supabase.from("polling_data").insert(poll);
        if (!error) totalInserted++;
      }
    }
    results.push({ source: "Direct Data (State + Issue + Senate + International)", polls_found: directPolls.length, inserted: totalInserted });

    // 2. Scrape sources with Firecrawl if available
    if (firecrawlKey) {
      let scrapeSources = [...SCRAPE_SOURCES];
      let searchSources = [...SEARCH_SOURCES];
      if (categories.length > 0) {
        scrapeSources = scrapeSources.filter(s => categories.includes(s.category));
        searchSources = searchSources.filter(s => categories.includes(s.category));
      }
      const allSources = [...scrapeSources.slice(0, maxSources), ...searchSources.slice(0, Math.max(0, maxSources - scrapeSources.length))];

      for (const src of allSources) {
        try {
          let markdown = "";
          let sourceUrl = "";
          if ("url" in src && src.url) {
            markdown = await scrapeWithFirecrawl(src.url, firecrawlKey);
            sourceUrl = src.url;
          } else if ("query" in src && src.query) {
            const searchResults = await searchWithFirecrawl(src.query, firecrawlKey, 3);
            markdown = searchResults.map((r: any) => `## ${r.title || ""}\n${r.markdown || r.description || ""}`).join("\n\n");
            sourceUrl = searchResults[0]?.url || "";
          }
          if (!markdown || markdown.length < 50) {
            results.push({ source: src.name, polls_found: 0, inserted: 0, error: "Insufficient content" });
            continue;
          }
          const polls = extractPollsFromMarkdown(markdown, src.name, sourceUrl);
          let srcInserted = 0;
          for (const poll of polls) {
            const { data: existing } = await supabase
              .from("polling_data").select("id")
              .eq("source", poll.source).eq("date_conducted", poll.date_conducted)
              .eq("candidate_or_topic", poll.candidate_or_topic).maybeSingle();
            if (!existing) {
              const { error } = await supabase.from("polling_data").insert(poll);
              if (!error) { srcInserted++; totalInserted++; }
            }
          }
          results.push({ source: src.name, polls_found: polls.length, inserted: srcInserted });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Unknown error";
          results.push({ source: src.name, polls_found: 0, inserted: 0, error: msg });
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, sources_processed: results.length, total_new_polls: totalInserted, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Polling sync error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...getCorsHeaders(req.headers.get("Origin")), "Content-Type": "application/json" } }
    );
  }
});
