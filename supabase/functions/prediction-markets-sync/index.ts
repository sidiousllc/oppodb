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
    "congress", "senate", "house", "governor", "president",
    "election", "win", "representative", "midterm", "2026",
    "republican", "democrat", "primary", "runoff",
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
  const endpoints = [
    "https://api.elections.kalshi.com/trade-api/v2/markets?limit=100&status=open",
    "https://trading-api.kalshi.com/trade-api/v2/markets?limit=100&status=open",
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.markets) {
        // Filter for political markets
        const political = data.markets.filter((m: any) => {
          const t = (m.title || m.subtitle || "").toLowerCase();
          return (
            t.includes("congress") || t.includes("senate") || t.includes("house") ||
            t.includes("president") || t.includes("governor") || t.includes("election") ||
            t.includes("win") || t.includes("party") || t.includes("democrat") ||
            t.includes("republican") || t.includes("midterm") || t.includes("vote") ||
            (m.category === "politics") || (m.series_ticker?.startsWith("KXUS"))
          );
        });
        markets.push(...political);
      }
      break; // Use whichever endpoint works
    } catch (e) {
      console.error(`Kalshi fetch error:`, e);
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

/* ── Metaculus: fetch political prediction questions ─────────────────── */

async function fetchMetaculusData() {
  const markets: any[] = [];
  const apiToken = Deno.env.get("METACULUS_API_TOKEN");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiToken) headers["Authorization"] = `Token ${apiToken}`;

  const searchTerms = [
    "US congress 2026", "US senate 2026", "US house 2026",
    "US election 2026", "US midterm", "US governor",
    "republican win", "democrat win", "US president",
  ];

  // Try both API versions
  const apiPaths = [
    (term: string) => `https://www.metaculus.com/api/questions/?search=${encodeURIComponent(term)}&status=open&limit=50&order_by=-activity`,
    (term: string) => `https://www.metaculus.com/api2/questions/?search=${encodeURIComponent(term)}&type=forecast&status=open&limit=50&order_by=-activity`,
  ];

  for (const term of searchTerms) {
    for (const pathFn of apiPaths) {
      try {
        const res = await fetch(pathFn(term), { headers });
        if (!res.ok) continue;
        const data = await res.json();
        const results = data?.results || (Array.isArray(data) ? data : []);
        if (results.length > 0) {
          markets.push(...results);
          break; // this API path works, skip the other
        }
      } catch (e) {
        console.error(`Metaculus fetch error (${term}):`, e);
      }
    }
  }

  const seen = new Set<number>();
  return markets.filter((m) => {
    const id = m.id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/* ── Manifold Markets: fetch political markets ───────────────────────── */

async function fetchManifoldData() {
  const markets: any[] = [];
  const searchTerms = [
    "congress 2026", "senate 2026", "house 2026", "midterm 2026",
    "governor election", "US election", "republican win", "democrat win",
    "presidential approval",
  ];

  for (const term of searchTerms) {
    try {
      const res = await fetch(
        `https://api.manifold.markets/v0/search-markets?term=${encodeURIComponent(term)}&sort=liquidity&filter=open&limit=50`,
        { headers: { Accept: "application/json" } }
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data)) {
        // Filter for political/election markets
        const political = data.filter((m: any) => {
          const q = (m.question || "").toLowerCase();
          return (
            q.includes("congress") || q.includes("senate") || q.includes("house") ||
            q.includes("president") || q.includes("governor") || q.includes("election") ||
            q.includes("win") || q.includes("democrat") || q.includes("republican") ||
            q.includes("midterm") || q.includes("party") || q.includes("vote") ||
            q.includes("approval")
          );
        });
        markets.push(...political);
      }
    } catch (e) {
      console.error(`Manifold fetch error (${term}):`, e);
    }
  }

  const seen = new Set<string>();
  return markets.filter((m) => {
    const id = m.id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/* ── PredictIt: fetch political markets ──────────────────────────────── */

async function fetchPredictItData() {
  const markets: any[] = [];
  try {
    const res = await fetch(
      "https://www.predictit.org/api/marketdata/all/",
      { headers: { Accept: "application/json" } }
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.markets) {
        markets.push(...data.markets);
      }
    }
  } catch (e) {
    console.error("PredictIt fetch error:", e);
  }
  return markets;
}

/* ── Classify market into category / state / district ────────────────── */

const STATE_ABBRS = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MO","MS","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

const STATE_NAMES: Record<string, string> = {
  "alabama":"AL","alaska":"AK","arizona":"AZ","arkansas":"AR","california":"CA",
  "colorado":"CO","connecticut":"CT","delaware":"DE","florida":"FL","georgia":"GA",
  "hawaii":"HI","idaho":"ID","illinois":"IL","indiana":"IN","iowa":"IA","kansas":"KS",
  "kentucky":"KY","louisiana":"LA","maine":"ME","maryland":"MD","massachusetts":"MA",
  "michigan":"MI","minnesota":"MN","missouri":"MO","mississippi":"MS","montana":"MT",
  "nebraska":"NE","nevada":"NV","new hampshire":"NH","new jersey":"NJ","new mexico":"NM",
  "new york":"NY","north carolina":"NC","north dakota":"ND","ohio":"OH","oklahoma":"OK",
  "oregon":"OR","pennsylvania":"PA","rhode island":"RI","south carolina":"SC",
  "south dakota":"SD","tennessee":"TN","texas":"TX","utah":"UT","vermont":"VT",
  "virginia":"VA","washington":"WA","west virginia":"WV","wisconsin":"WI","wyoming":"WY",
};

function classifyMarket(title: string) {
  const t = title.toLowerCase();
  let category = "other";
  if (t.includes("president") || t.includes("white house")) category = "president";
  else if (t.includes("senate")) category = "senate";
  else if (t.includes("house") || t.includes("representative") || t.includes("congress")) category = "house";
  else if (t.includes("governor")) category = "governor";
  else if (t.includes("approval") || t.includes("favorab")) category = "approval";
  else if (t.includes("election") || t.includes("win") || t.includes("midterm")) category = "general";

  let state_abbr: string | null = null;
  let district: string | null = null;

  // Check abbreviations
  for (const st of STATE_ABBRS) {
    const stateRegex = new RegExp(`\\b${st}\\b`, "i");
    if (stateRegex.test(title)) {
      state_abbr = st;
      break;
    }
  }

  // Check full state names if no abbreviation found
  if (!state_abbr) {
    for (const [name, abbr] of Object.entries(STATE_NAMES)) {
      if (t.includes(name)) {
        state_abbr = abbr;
        break;
      }
    }
  }

  const distMatch = title.match(/(?:district|CD|CD-)\s*(\d{1,2})/i);
  if (distMatch) district = distMatch[1];

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
    market_url: m.ticker ? `https://kalshi.com/markets/${m.ticker}` : null,
    status: m.status === "open" ? "active" : m.status || "active",
    raw_data: m,
    updated_at: new Date().toISOString(),
  };
}

function metaculusToRow(m: any) {
  const title = m.title || m.title_short || "";
  const { category, state_abbr, district, candidate_name } = classifyMarket(title);
  const prediction = m.community_prediction?.full?.q2 ?? m.community_prediction?.full?.avg ?? null;
  return {
    market_id: `metaculus-${m.id}`,
    source: "metaculus",
    title,
    category,
    state_abbr,
    district,
    candidate_name,
    yes_price: prediction,
    no_price: prediction != null ? 1 - prediction : null,
    volume: m.number_of_forecasters ?? 0,
    liquidity: m.number_of_predictions ?? 0,
    last_traded_at: m.last_activity_time || m.publish_time || new Date().toISOString(),
    market_url: `https://www.metaculus.com/questions/${m.id}/`,
    status: m.active_state === "OPEN" ? "active" : m.active_state?.toLowerCase() || "active",
    raw_data: m,
    updated_at: new Date().toISOString(),
  };
}

function manifoldToRow(m: any) {
  const title = m.question || "";
  const { category, state_abbr, district, candidate_name } = classifyMarket(title);
  return {
    market_id: `manifold-${m.id}`,
    source: "manifold",
    title,
    category,
    state_abbr,
    district,
    candidate_name,
    yes_price: m.probability ?? null,
    no_price: m.probability != null ? 1 - m.probability : null,
    volume: m.volume ?? 0,
    liquidity: m.totalLiquidity ?? m.pool?.YES ?? 0,
    last_traded_at: m.lastBetTime ? new Date(m.lastBetTime).toISOString() : m.lastUpdatedTime ? new Date(m.lastUpdatedTime).toISOString() : new Date().toISOString(),
    market_url: m.url || `https://manifold.markets/${m.creatorUsername}/${m.slug}`,
    status: m.isResolved ? "closed" : "active",
    raw_data: m,
    updated_at: new Date().toISOString(),
  };
}

function predictitToRow(m: any) {
  const title = m.name || m.shortName || "";
  const { category, state_abbr, district, candidate_name } = classifyMarket(title);
  // PredictIt has contracts within markets
  const topContract = m.contracts?.[0];
  return {
    market_id: `predictit-${m.id}`,
    source: "predictit",
    title,
    category,
    state_abbr,
    district,
    candidate_name,
    yes_price: topContract?.lastTradePrice ?? topContract?.bestBuyYesCost ?? null,
    no_price: topContract?.bestBuyNoCost ?? null,
    volume: m.contracts?.reduce((sum: number, c: any) => sum + (c.totalSharesTraded ?? 0), 0) ?? 0,
    liquidity: 0,
    last_traded_at: topContract?.dateEnd || new Date().toISOString(),
    market_url: m.url || `https://www.predictit.org/markets/detail/${m.id}`,
    status: m.status === "Open" ? "active" : m.status?.toLowerCase() || "active",
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

    // Fetch from all sources in parallel
    console.log("Fetching from all prediction market sources...");
    const [polyData, kalshiData, metaculusData, manifoldData, predictitData] = await Promise.all([
      fetchPolymarketData().catch(e => { console.error("Polymarket failed:", e); return []; }),
      fetchKalshiData().catch(e => { console.error("Kalshi failed:", e); return []; }),
      fetchMetaculusData().catch(e => { console.error("Metaculus failed:", e); return []; }),
      fetchManifoldData().catch(e => { console.error("Manifold failed:", e); return []; }),
      fetchPredictItData().catch(e => { console.error("PredictIt failed:", e); return []; }),
    ]);

    console.log(`Polymarket: ${polyData.length}, Kalshi: ${kalshiData.length}, Metaculus: ${metaculusData.length}, Manifold: ${manifoldData.length}, PredictIt: ${predictitData.length}`);

    const rows = [
      ...polyData.map(polymarketToRow),
      ...kalshiData.map(kalshiToRow),
      ...metaculusData.map(metaculusToRow),
      ...manifoldData.map(manifoldToRow),
      ...predictitData.map(predictitToRow),
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
        metaculus: metaculusData.length,
        manifold: manifoldData.length,
        predictit: predictitData.length,
        total: rows.length,
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
