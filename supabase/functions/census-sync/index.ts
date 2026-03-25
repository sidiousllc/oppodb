import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1].replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    return JSON.parse(atob(payload)) as Record<string, unknown>;
  } catch { return null; }
}

// Census ACS 5-Year API (2022 data, latest available)
const CENSUS_BASE = "https://api.census.gov/data/2022/acs/acs5";

// Expanded variable set
// B01003_001E = Total population
// B19013_001E = Median household income
// B01002_001E = Median age
// B15003_022E = Bachelor's degree (count)
// B15003_001E = Total education universe
// B17001_002E = Population below poverty level
// B17001_001E = Total poverty universe
// B23025_005E = Unemployed
// B23025_003E = In labor force (civilian)
// B02001_002E = White alone
// B02001_003E = Black alone
// B02001_005E = Asian alone
// B02001_001E = Total race universe
// B03003_003E = Hispanic/Latino
// B03003_001E = Total Hispanic universe
// B25003_002E = Owner-occupied housing
// B25003_001E = Total occupied housing
// B25077_001E = Median home value
// B25064_001E = Median gross rent
// B21001_002E = Veteran population
// B21001_001E = Total veteran universe (18+)
// B05002_013E = Foreign-born population
// B05002_001E = Total nativity universe
// B27001_005E + more = Uninsured (simplified via B27010)
// B27010_017E = Uninsured under 19
// B27010_033E = Uninsured 19-34
// B27010_050E = Uninsured 35-64
// B27010_066E = Uninsured 65+
// B27010_001E = Total health insurance universe
// B11001_001E = Total households
// B25010_001E = Average household size

const CENSUS_VARS = [
  "B01003_001E", "B19013_001E", "B01002_001E",
  "B15003_022E", "B15003_001E",
  "B17001_002E", "B17001_001E",
  "B23025_005E", "B23025_003E",
  "B02001_002E", "B02001_003E", "B02001_005E", "B02001_001E",
  "B03003_003E", "B03003_001E",
  "B25003_002E", "B25003_001E",
  "B25077_001E", "B25064_001E",
  "B21001_002E", "B21001_001E",
  "B05002_013E", "B05002_001E",
  "B27010_017E", "B27010_033E", "B27010_050E", "B27010_066E", "B27010_001E",
  "B11001_001E", "B25010_001E",
].join(",");

const FIPS_TO_STATE: Record<string, string> = {
  "01": "Alabama", "02": "Alaska", "04": "Arizona", "05": "Arkansas",
  "06": "California", "08": "Colorado", "09": "Connecticut", "10": "Delaware",
  "11": "District of Columbia", "12": "Florida", "13": "Georgia", "15": "Hawaii",
  "16": "Idaho", "17": "Illinois", "18": "Indiana", "19": "Iowa",
  "20": "Kansas", "21": "Kentucky", "22": "Louisiana", "23": "Maine",
  "24": "Maryland", "25": "Massachusetts", "26": "Michigan", "27": "Minnesota",
  "28": "Mississippi", "29": "Missouri", "30": "Montana", "31": "Nebraska",
  "32": "Nevada", "33": "New Hampshire", "34": "New Jersey", "35": "New Mexico",
  "36": "New York", "37": "North Carolina", "38": "North Dakota", "39": "Ohio",
  "40": "Oklahoma", "41": "Oregon", "42": "Pennsylvania", "44": "Rhode Island",
  "45": "South Carolina", "46": "South Dakota", "47": "Tennessee", "48": "Texas",
  "49": "Utah", "50": "Vermont", "51": "Virginia", "53": "Washington",
  "54": "West Virginia", "55": "Wisconsin", "56": "Wyoming",
};

const STATE_ABBREV: Record<string, string> = {
  "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
  "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
  "District of Columbia": "DC", "Florida": "FL", "Georgia": "GA", "Hawaii": "HI",
  "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA",
  "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME",
  "Maryland": "MD", "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN",
  "Mississippi": "MS", "Missouri": "MO", "Montana": "MT", "Nebraska": "NE",
  "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM",
  "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH",
  "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI",
  "South Carolina": "SC", "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX",
  "Utah": "UT", "Vermont": "VT", "Virginia": "VA", "Washington": "WA",
  "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
};

function safeInt(val: string): number | null {
  const n = parseInt(val);
  return isNaN(n) || n < 0 ? null : n;
}

function safeFloat(val: string): number | null {
  const n = parseFloat(val);
  return isNaN(n) || n < 0 ? null : n;
}

function safePct(numerator: string, denominator: string): number | null {
  const num = parseInt(numerator);
  const den = parseInt(denominator);
  if (isNaN(num) || isNaN(den) || den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

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
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const token = authHeader.slice(7).trim();
    const claims = parseJwtClaims(token);

    if (claims?.role !== "service_role") {
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await authClient.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const adminClient = createClient(supabaseUrl, supabaseKey);
      const { data: roleCheck } = await adminClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!roleCheck) {
        return new Response(JSON.stringify({ error: "Forbidden: admin role required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const stateFips = url.searchParams.get("state_fips") || undefined;

    const geoParam = stateFips
      ? `&for=congressional%20district:*&in=state:${stateFips}`
      : `&for=congressional%20district:*&in=state:*`;

    const censusUrl = `${CENSUS_BASE}?get=${CENSUS_VARS}${geoParam}`;
    console.log("Fetching Census data:", censusUrl);

    const response = await fetch(censusUrl);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Census API error [${response.status}]: ${text}`);
    }

    const rawData: string[][] = await response.json();
    const headers = rawData[0];
    const rows = rawData.slice(1);
    console.log(`Fetched ${rows.length} districts from Census API`);

    const records = [];

    for (const row of rows) {
      const r: Record<string, string> = {};
      headers.forEach((h, i) => { r[h] = row[i]; });

      const stFips = r["state"];
      const cdNum = r["congressional district"];
      const stateName = FIPS_TO_STATE[stFips];
      if (!stateName) continue;
      const stateAbbrev = STATE_ABBREV[stateName];
      if (!stateAbbrev) continue;

      const districtId = `${stateAbbrev}-${cdNum.padStart(2, "0")}`;

      // Uninsured = sum of uninsured across age groups
      const uninsuredTotal =
        (safeInt(r["B27010_017E"]) ?? 0) +
        (safeInt(r["B27010_033E"]) ?? 0) +
        (safeInt(r["B27010_050E"]) ?? 0) +
        (safeInt(r["B27010_066E"]) ?? 0);
      const healthTotal = safeInt(r["B27010_001E"]);
      const uninsuredPct = healthTotal && healthTotal > 0
        ? Math.round((uninsuredTotal / healthTotal) * 1000) / 10
        : null;

      records.push({
        district_id: districtId,
        state: stateName,
        population: safeInt(r["B01003_001E"]),
        median_income: safeInt(r["B19013_001E"]),
        median_age: safeFloat(r["B01002_001E"]),
        education_bachelor_pct: safePct(r["B15003_022E"], r["B15003_001E"]),
        poverty_rate: safePct(r["B17001_002E"], r["B17001_001E"]),
        unemployment_rate: safePct(r["B23025_005E"], r["B23025_003E"]),
        white_pct: safePct(r["B02001_002E"], r["B02001_001E"]),
        black_pct: safePct(r["B02001_003E"], r["B02001_001E"]),
        asian_pct: safePct(r["B02001_005E"], r["B02001_001E"]),
        hispanic_pct: safePct(r["B03003_003E"], r["B03003_001E"]),
        owner_occupied_pct: safePct(r["B25003_002E"], r["B25003_001E"]),
        median_home_value: safeInt(r["B25077_001E"]),
        median_rent: safeInt(r["B25064_001E"]),
        veteran_pct: safePct(r["B21001_002E"], r["B21001_001E"]),
        foreign_born_pct: safePct(r["B05002_013E"], r["B05002_001E"]),
        uninsured_pct: uninsuredPct,
        total_households: safeInt(r["B11001_001E"]),
        avg_household_size: safeFloat(r["B25010_001E"]),
        raw_data: r,
        updated_at: new Date().toISOString(),
      });
    }

    let upserted = 0;
    let errors = 0;

    for (let i = 0; i < records.length; i += 50) {
      const chunk = records.slice(i, i + 50);
      const { error } = await supabase
        .from("district_profiles")
        .upsert(chunk, { onConflict: "district_id" });

      if (error) {
        console.error("Upsert error:", error);
        errors += chunk.length;
      } else {
        upserted += chunk.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_fetched: records.length,
        upserted,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Census sync error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
