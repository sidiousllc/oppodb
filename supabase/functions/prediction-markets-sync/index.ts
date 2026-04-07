import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/* ── helpers ─────────────────────────────────────────────────────────── */

function supaAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

/* ── Polymarket: fetch election-related markets ──────────────────────── */

async function fetchPolymarketData() {
  const markets: any[] = [];
  const keywords = [
    "congress",
    "senate",
    "house",
    "governor",
    "president",
    "election",
    "win",
    "representative",
  ];

  for (const kw of keywords) {
    try {
      const res = await fetch(
        `https://gamma-api.polymarket.com/markets?closed=false&limit=50&active=true&tag=politics&search=${encodeURIComponent(kw)}`,
        { headers: { Accept: "application/json" } }
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data)) {
        markets.push(...data);
      }
    } catch (e) {
      console.error(`Polymarket fetch error (${kw}):`, e);
    }
  }

  // Deduplicate by condition_id
  const seen = new Set<string>();
  return markets.filter((m) => {
    const id = m.condition_id || m.id || m.slug;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/* ── Kalshi: fetch election event markets ────────────────────────────── */

async function fetchKalshiData() {
  const markets: any[] = [];
  const categories = ["politics", "elections"];

  for (const cat of categories) {
    try {
      const res = await fetch(
        `https://api.elections.kalshi.com/trade-api/v2/markets?limit=50&status=open&series_ticker=&event_ticker=`,
        { headers: { Accept: "application/json" } }
      );
      if (!res.ok) {
        // Try alternative endpoint
        const res2 = await fetch(
          `https://trading-api.kalshi.com/trade-api/v2/markets?limit=50&status=open`,
          { headers: { Accept: "application/json" } }
        );
        if (res2.ok) {
          const data = await res2.json();
          if (data?.markets) markets.push(...data.markets);
        }
        continue;
      }
      const data = await res.json();
      if (data?.markets) markets.push(...data.markets);
    } catch (e) {
      console.error(`Kalshi fetch error (${cat}):`, e);
    }
  }

  const seen = new Set<string>();
  return markets.filter((m) => {
    const id = m.ticker || m.id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/* ── Classify market into category / state / district ────────────────── */

const STATE_ABBRS = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MO","MS","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

function classifyMarket(title: string) {
  const t = title.toLowerCase();
  let category = "other";
  if (t.includes("president") || t.includes("white house")) category = "president";
  else if (t.includes("senate")) category = "senate";
  else if (t.includes("house") || t.includes("representative") || t.includes("congress")) category = "house";
  else if (t.includes("governor")) category = "governor";
  else if (t.includes("election") || t.includes("win")) category = "general";

  let state_abbr: string | null = null;
  let district: string | null = null;

  for (const st of STATE_ABBRS) {
    const stateRegex = new RegExp(`\\b${st}\\b`, "i");
    if (stateRegex.test(title)) {
      state_abbr = st;
      break;
    }
  }

  const distMatch = title.match(/(?:district|CD|CD-)\s*(\d{1,2})/i);
  if (distMatch) district = distMatch[1];

  // Extract candidate name — look for patterns like "X to win" or "X wins"
  let candidate_name: string | null = null;
  const candidateMatch = title.match(/(?:Will\s+)?(.+?)\s+(?:to\s+)?win/i);
  if (candidateMatch && candidateMatch[1].length < 60) {
    candidate_name = candidateMatch[1].trim();
  }

  return { category, state_abbr, district, candidate_name };
}

/* ── Transform to DB row ─────────────────────────────────────────────── */

function polymarketToRow(m: any) {
  const { category, state_abbr, district, candidate_name } = classifyMarket(
    m.question || m.title || ""
  );
  return {
    market_id: m.condition_id || m.id || m.slug,
    source: "polymarket",
    title: m.question || m.title || "Untitled",
    category,
    state_abbr,
    district,
    candidate_name,
    yes_price: m.outcomePrices ? parseFloat(JSON.parse(m.outcomePrices)[0]) : null,
    no_price: m.outcomePrices ? parseFloat(JSON.parse(m.outcomePrices)[1]) : null,
    volume: m.volume != null ? parseFloat(m.volume) : 0,
    liquidity: m.liquidity != null ? parseFloat(m.liquidity) : 0,
    last_traded_at: m.end_date_iso || m.updatedAt || new Date().toISOString(),
    market_url: m.slug ? `https://polymarket.com/event/${m.slug}` : null,
    status: m.closed ? "closed" : m.active ? "active" : "inactive",
    raw_data: m,
    updated_at: new Date().toISOString(),
  };
}

function kalshiToRow(m: any) {
  const { category, state_abbr, district, candidate_name } = classifyMarket(
    m.title || m.subtitle || ""
  );
  return {
    market_id: m.ticker || m.id,
    source: "kalshi",
    title: m.title || m.subtitle || "Untitled",
    category,
    state_abbr,
    district,
    candidate_name,
    yes_price: m.yes_bid != null ? m.yes_bid / 100 : m.last_price != null ? m.last_price / 100 : null,
    no_price: m.no_bid != null ? m.no_bid / 100 : null,
    volume: m.volume ?? 0,
    liquidity: m.open_interest ?? 0,
    last_traded_at: m.last_price_time || m.close_time || new Date().toISOString(),
    market_url: m.ticker
      ? `https://kalshi.com/markets/${m.ticker}`
      : null,
    status: m.status === "open" ? "active" : m.status || "active",
    raw_data: m,
    updated_at: new Date().toISOString(),
  };
}

/* ── Main handler ────────────────────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sb = supaAdmin();

    console.log("Fetching Polymarket data...");
    const polyData = await fetchPolymarketData();
    console.log(`Polymarket: ${polyData.length} markets`);

    console.log("Fetching Kalshi data...");
    const kalshiData = await fetchKalshiData();
    console.log(`Kalshi: ${kalshiData.length} markets`);

    const rows = [
      ...polyData.map(polymarketToRow),
      ...kalshiData.map(kalshiToRow),
    ];

    let upserted = 0;
    // Batch upsert in chunks of 50
    for (let i = 0; i < rows.length; i += 50) {
      const chunk = rows.slice(i, i + 50);
      const { error } = await sb
        .from("prediction_markets")
        .upsert(chunk, { onConflict: "source,market_id" });
      if (error) {
        console.error("Upsert error:", error.message);
      } else {
        upserted += chunk.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        polymarket: polyData.length,
        kalshi: kalshiData.length,
        upserted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
