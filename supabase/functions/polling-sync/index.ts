import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

// ── Source scrapers ──────────────────────────────────────────────────────────

async function scrapeWithFirecrawl(url: string, apiKey: string): Promise<string> {
  const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
  });
  const data = await resp.json();
  return data?.data?.markdown || data?.markdown || "";
}

async function searchWithFirecrawl(query: string, apiKey: string, limit = 5): Promise<any[]> {
  const resp = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, limit, scrapeOptions: { formats: ["markdown"] } }),
  });
  const data = await resp.json();
  return data?.data || [];
}

// Use AI to extract structured polling data from scraped markdown
async function extractPollsWithAI(markdown: string, sourceName: string, sourceUrl: string): Promise<PollRecord[]> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) return [];

  const prompt = `Extract polling data from this content. Return a JSON array of poll objects.
Each object should have these fields (use null for missing values):
- poll_type: one of "approval", "generic-ballot", "favorability", "issue", "head-to-head"
- question: the poll question
- date_conducted: YYYY-MM-DD format (use the most recent date mentioned)
- candidate_or_topic: who/what is being polled
- approve_pct: approval percentage (number or null)
- disapprove_pct: disapproval percentage (number or null)  
- favor_pct: favorable percentage for generic ballot/favorability (number or null)
- oppose_pct: oppose/unfavorable percentage (number or null)
- margin: the margin between approve/favor and disapprove/oppose (number or null)
- sample_size: number of respondents (number or null)
- sample_type: "Adults", "RV" (registered voters), "LV" (likely voters), or null
- methodology: polling methodology or null

Only include polls from 2025 or 2026. Return ONLY the JSON array, no other text.
If no polls found, return [].

Content from ${sourceName}:
${markdown.substring(0, 8000)}`;

  try {
    const resp = await fetch("https://ai-gateway.lovable.dev/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      }),
    });

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content || "";
    
    // Extract JSON array from response
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    
    const polls: any[] = JSON.parse(match[0]);
    return polls.map((p: any) => ({
      source: sourceName,
      source_url: sourceUrl,
      poll_type: p.poll_type || "approval",
      question: p.question,
      date_conducted: p.date_conducted || new Date().toISOString().split("T")[0],
      candidate_or_topic: p.candidate_or_topic || "Unknown",
      approve_pct: p.approve_pct,
      disapprove_pct: p.disapprove_pct,
      favor_pct: p.favor_pct,
      oppose_pct: p.oppose_pct,
      margin: p.margin,
      sample_size: p.sample_size,
      sample_type: p.sample_type,
      methodology: p.methodology,
      raw_data: { source_name: sourceName, extracted_at: new Date().toISOString() },
    }));
  } catch (e) {
    console.error(`AI extraction failed for ${sourceName}:`, e);
    return [];
  }
}

// Define all polling sources
const POLLING_SOURCES = [
  // National aggregators
  { name: "RealClearPolitics", url: "https://www.realclearpolling.com/polls/approval/donald-trump", category: "national" },
  { name: "FiveThirtyEight", url: "https://projects.fivethirtyeight.com/polls/approval/donald-trump/", category: "national" },
  { name: "The Economist", url: "https://www.economist.com/interactive/us-midterms-2026/polling", category: "national" },
  
  // Individual pollsters
  { name: "Morning Consult", url: "https://morningconsult.com/tracking-trump-2/", category: "national" },
  { name: "YouGov", url: "https://today.yougov.com/topics/politics/trackers/donald-trump-approval-rating", category: "national" },
  { name: "Civiqs", url: "https://civiqs.com/results/approve_president_trump", category: "national" },
  { name: "Gallup", url: "https://news.gallup.com/poll/203198/presidential-approval-ratings-donald-trump.aspx", category: "national" },
  { name: "Reuters/Ipsos", url: "https://www.reuters.com/graphics/USA-BIDEN/POLL/gkvlgqnmwpb/", category: "national" },
  { name: "Pew Research", url: "https://www.pewresearch.org/topic/politics-policy/political-parties-polarization/", category: "national" },
  
  // Generic ballot / Congressional
  { name: "RCP Generic Ballot", url: "https://www.realclearpolling.com/polls/congress/generic-congressional-vote", category: "generic-ballot" },
  
  // International perspective
  { name: "Pew Global", url: "https://www.pewresearch.org/global/", category: "international" },
  
  // State-level
  { name: "MN Poll", searchQuery: "Minnesota polling 2026 approval Trump", category: "state" },
  { name: "MI Poll", searchQuery: "Michigan polling 2026 approval midterm", category: "state" },
  { name: "PA Poll", searchQuery: "Pennsylvania polling 2026 approval midterm", category: "state" },
  { name: "WI Poll", searchQuery: "Wisconsin polling 2026 midterm election", category: "state" },
  { name: "AZ Poll", searchQuery: "Arizona polling 2026 senate midterm", category: "state" },
  { name: "GA Poll", searchQuery: "Georgia polling 2026 midterm election", category: "state" },
  { name: "NV Poll", searchQuery: "Nevada polling 2026 senate midterm", category: "state" },
  { name: "NC Poll", searchQuery: "North Carolina polling 2026 midterm", category: "state" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");

    let sources: string[] = [];
    let maxSources = 5;
    try {
      const body = await req.json();
      sources = body?.sources || [];
      maxSources = body?.maxSources || 5;
    } catch {}

    // Filter sources if specific ones requested
    let targetSources = POLLING_SOURCES;
    if (sources.length > 0) {
      targetSources = POLLING_SOURCES.filter(s => 
        sources.some(rs => s.name.toLowerCase().includes(rs.toLowerCase()) || s.category === rs.toLowerCase())
      );
    }
    // Limit to prevent timeout
    targetSources = targetSources.slice(0, maxSources);

    const results: { source: string; polls_found: number; error?: string }[] = [];
    let totalInserted = 0;

    for (const src of targetSources) {
      try {
        let markdown = "";
        let sourceUrl = src.url || "";

        if (firecrawlKey) {
          if (src.url) {
            console.log(`Scraping ${src.name} from ${src.url}`);
            markdown = await scrapeWithFirecrawl(src.url, firecrawlKey);
          } else if (src.searchQuery) {
            console.log(`Searching for ${src.name}: ${src.searchQuery}`);
            const searchResults = await searchWithFirecrawl(src.searchQuery, firecrawlKey, 3);
            markdown = searchResults.map((r: any) => `## ${r.title}\n${r.markdown || r.description || ""}`).join("\n\n");
            sourceUrl = searchResults[0]?.url || "";
          }
        }

        if (!markdown || markdown.length < 100) {
          results.push({ source: src.name, polls_found: 0, error: "No content scraped" });
          continue;
        }

        // Extract polls using AI
        const polls = await extractPollsWithAI(markdown, src.name, sourceUrl);
        
        if (polls.length > 0) {
          // Deduplicate: check if poll with same source + date + topic exists
          for (const poll of polls) {
            const { data: existing } = await supabase
              .from("polling_data")
              .select("id")
              .eq("source", poll.source)
              .eq("date_conducted", poll.date_conducted)
              .eq("candidate_or_topic", poll.candidate_or_topic)
              .maybeSingle();

            if (!existing) {
              const { error: insertError } = await supabase
                .from("polling_data")
                .insert(poll);
              
              if (!insertError) totalInserted++;
              else console.error(`Insert error for ${src.name}:`, insertError.message);
            }
          }
        }

        results.push({ source: src.name, polls_found: polls.length });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        console.error(`Error processing ${src.name}:`, msg);
        results.push({ source: src.name, polls_found: 0, error: msg });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sources_processed: results.length,
        total_new_polls: totalInserted,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Polling sync error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
