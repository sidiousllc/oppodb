import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Rating normalization map
const RATING_ALIASES: Record<string, string> = {
  "solid democratic": "Solid D",
  "solid d": "Solid D",
  "safe democratic": "Safe D",
  "safe d": "Safe D",
  "likely democratic": "Likely D",
  "likely d": "Likely D",
  "lean democratic": "Lean D",
  "lean d": "Lean D",
  "leans democratic": "Lean D",
  "leans d": "Lean D",
  "tilt democratic": "Tilt D",
  "tilt d": "Tilt D",
  "tilts democratic": "Tilt D",
  "toss up": "Toss Up",
  "toss-up": "Toss Up",
  "tossup": "Toss Up",
  "tilt republican": "Tilt R",
  "tilt r": "Tilt R",
  "tilts republican": "Tilt R",
  "lean republican": "Lean R",
  "lean r": "Lean R",
  "leans republican": "Lean R",
  "leans r": "Lean R",
  "likely republican": "Likely R",
  "likely r": "Likely R",
  "solid republican": "Solid R",
  "solid r": "Solid R",
  "safe republican": "Safe R",
  "safe r": "Safe R",
};

function normalizeRating(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  return RATING_ALIASES[key] || null;
}

// State abbreviation map
const STATE_ABBREVS: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

function getStateAbbrev(name: string): string | null {
  return STATE_ABBREVS[name.trim().toLowerCase()] || null;
}

interface ParsedRating {
  source: string;
  race_type: string;
  state_abbr: string;
  district: string | null;
  rating: string;
}

/**
 * Parse Cook Political Report markdown for race ratings.
 * Cook uses headings like "Toss Up" followed by lists of districts.
 * Pattern: "CA-22", "CA-45", "NY-17" etc under rating headings.
 */
function parseCookMarkdown(md: string, raceType: string): ParsedRating[] {
  const results: ParsedRating[] = [];
  const source = "Cook Political Report";

  // Strategy: find rating category headings and collect districts/states under them
  const ratingCategories = [
    "Solid Democratic", "Likely Democratic", "Lean Democratic", "Tilt Democratic",
    "Toss Up", "Toss-Up", "Tossup",
    "Tilt Republican", "Lean Republican", "Likely Republican", "Solid Republican",
    "Safe Democratic", "Safe Republican",
  ];

  // Split into lines
  const lines = md.split("\n");

  let currentRating: string | null = null;

  for (const line of lines) {
    const trimmed = line.replace(/^[#*\-\s]+/, "").trim();

    // Check if this line is a rating heading
    for (const cat of ratingCategories) {
      if (trimmed.toLowerCase().includes(cat.toLowerCase())) {
        currentRating = normalizeRating(cat);
        break;
      }
    }

    if (!currentRating) continue;

    if (raceType === "house") {
      // Match patterns like "CA-22", "NY-17", "AK-AL", "PA-07"
      const districtMatches = line.matchAll(/\b([A-Z]{2})-(\d{1,2}|AL)\b/g);
      for (const m of districtMatches) {
        const stateAbbr = m[1];
        const dist = m[2] === "AL" ? "01" : m[2].padStart(2, "0");
        results.push({ source, race_type: "house", state_abbr: stateAbbr, district: dist, rating: currentRating });
      }
    } else if (raceType === "senate" || raceType === "governor") {
      // Match state names
      for (const [name, abbr] of Object.entries(STATE_ABBREVS)) {
        const regex = new RegExp(`\\b${name}\\b`, "i");
        if (regex.test(line)) {
          // Avoid matching states that are part of district patterns already found
          if (!line.match(new RegExp(`${abbr}-\\d`, "i"))) {
            results.push({ source, race_type: raceType, state_abbr: abbr, district: null, rating: currentRating });
          }
        }
      }
      // Also match state abbreviations like "GA Senate"
      const stateAbbrMatch = line.matchAll(/\b([A-Z]{2})\b/g);
      for (const m of stateAbbrMatch) {
        const abbr = m[1];
        if (Object.values(STATE_ABBREVS).includes(abbr) && !results.find(r => r.state_abbr === abbr && r.race_type === raceType)) {
          results.push({ source, race_type: raceType, state_abbr: abbr, district: null, rating: currentRating });
        }
      }
    }
  }

  return results;
}

/**
 * Parse Sabato's Crystal Ball markdown for race ratings.
 * Similar structure with rating categories and lists of races.
 */
function parseSabatoMarkdown(md: string, raceType: string): ParsedRating[] {
  const results: ParsedRating[] = [];
  const source = "Sabato's Crystal Ball";

  const ratingCategories = [
    "Safe Democratic", "Likely Democratic", "Leans Democratic", "Lean Democratic",
    "Toss Up", "Toss-Up", "Tossup",
    "Leans Republican", "Lean Republican", "Likely Republican", "Safe Republican",
  ];

  const lines = md.split("\n");
  let currentRating: string | null = null;

  for (const line of lines) {
    const trimmed = line.replace(/^[#*\-\s]+/, "").trim();

    for (const cat of ratingCategories) {
      if (trimmed.toLowerCase().includes(cat.toLowerCase())) {
        currentRating = normalizeRating(cat);
        break;
      }
    }

    if (!currentRating) continue;

    if (raceType === "house") {
      const districtMatches = line.matchAll(/\b([A-Z]{2})-(\d{1,2}|AL)\b/g);
      for (const m of districtMatches) {
        const stateAbbr = m[1];
        const dist = m[2] === "AL" ? "01" : m[2].padStart(2, "0");
        results.push({ source, race_type: "house", state_abbr: stateAbbr, district: dist, rating: currentRating });
      }
    } else if (raceType === "senate" || raceType === "governor") {
      for (const [name, abbr] of Object.entries(STATE_ABBREVS)) {
        const regex = new RegExp(`\\b${name}\\b`, "i");
        if (regex.test(line)) {
          if (!results.find(r => r.state_abbr === abbr && r.race_type === raceType)) {
            results.push({ source, race_type: raceType, state_abbr: abbr, district: null, rating: currentRating });
          }
        }
      }
    }
  }

  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl connector not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const today = new Date().toISOString().split("T")[0];

    // Define scrape targets
    const targets = [
      {
        url: "https://www.cookpolitical.com/ratings/house-race-ratings",
        parser: parseCookMarkdown,
        raceType: "house",
        label: "Cook House",
      },
      {
        url: "https://www.cookpolitical.com/ratings/senate-race-ratings",
        parser: parseCookMarkdown,
        raceType: "senate",
        label: "Cook Senate",
      },
      {
        url: "https://www.cookpolitical.com/ratings/governor-race-ratings",
        parser: parseCookMarkdown,
        raceType: "governor",
        label: "Cook Governor",
      },
      {
        url: "https://centerforpolitics.org/crystalball/2026-house/",
        parser: parseSabatoMarkdown,
        raceType: "house",
        label: "Sabato House",
      },
      {
        url: "https://centerforpolitics.org/crystalball/2026-senate/",
        parser: parseSabatoMarkdown,
        raceType: "senate",
        label: "Sabato Senate",
      },
      {
        url: "https://centerforpolitics.org/crystalball/2026-governor/",
        parser: parseSabatoMarkdown,
        raceType: "governor",
        label: "Sabato Governor",
      },
    ];

    const scrapeResults: { label: string; scraped: number; error?: string }[] = [];
    let totalUpserted = 0;

    for (const target of targets) {
      try {
        console.log(`Scraping ${target.label}: ${target.url}`);

        const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: target.url,
            formats: ["markdown"],
            onlyMainContent: true,
            waitFor: 3000,
          }),
        });

        const scrapeData = await scrapeResp.json();

        if (!scrapeResp.ok) {
          console.error(`Firecrawl error for ${target.label}:`, scrapeData);
          scrapeResults.push({
            label: target.label,
            scraped: 0,
            error: scrapeData.error || `HTTP ${scrapeResp.status}`,
          });
          continue;
        }

        const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";

        if (!markdown || markdown.length < 100) {
          console.warn(`${target.label}: insufficient content (${markdown.length} chars)`);
          scrapeResults.push({
            label: target.label,
            scraped: 0,
            error: "Insufficient content scraped (possibly paywalled)",
          });
          continue;
        }

        console.log(`${target.label}: got ${markdown.length} chars of markdown`);

        const parsed = target.parser(markdown, target.raceType);
        console.log(`${target.label}: parsed ${parsed.length} ratings`);

        // Deduplicate
        const seen = new Set<string>();
        const unique = parsed.filter((r) => {
          const key = `${r.source}|${r.race_type}|${r.state_abbr}|${r.district}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // Upsert to database
        let upserted = 0;
        for (const r of unique) {
          const { error } = await supabase.from("election_forecasts").upsert(
            {
              source: r.source,
              race_type: r.race_type,
              state_abbr: r.state_abbr,
              district: r.district,
              rating: r.rating,
              cycle: 2026,
              last_updated: today,
            },
            { onConflict: "source,race_type,state_abbr,district,cycle" }
          );
          if (!error) upserted++;
        }

        totalUpserted += upserted;
        scrapeResults.push({ label: target.label, scraped: upserted });
      } catch (e: any) {
        console.error(`Error scraping ${target.label}:`, e);
        scrapeResults.push({ label: target.label, scraped: 0, error: e.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_upserted: totalUpserted,
        results: scrapeResults,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Forecast scrape error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
