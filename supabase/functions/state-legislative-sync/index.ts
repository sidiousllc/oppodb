import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Census ACS 5-Year API (2022 data)
const CENSUS_BASE = "https://api.census.gov/data/2022/acs/acs5";

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
  "01":"Alabama","02":"Alaska","04":"Arizona","05":"Arkansas","06":"California",
  "08":"Colorado","09":"Connecticut","10":"Delaware","11":"District of Columbia",
  "12":"Florida","13":"Georgia","15":"Hawaii","16":"Idaho","17":"Illinois",
  "18":"Indiana","19":"Iowa","20":"Kansas","21":"Kentucky","22":"Louisiana",
  "23":"Maine","24":"Maryland","25":"Massachusetts","26":"Michigan","27":"Minnesota",
  "28":"Mississippi","29":"Missouri","30":"Montana","31":"Nebraska","32":"Nevada",
  "33":"New Hampshire","34":"New Jersey","35":"New Mexico","36":"New York",
  "37":"North Carolina","38":"North Dakota","39":"Ohio","40":"Oklahoma","41":"Oregon",
  "42":"Pennsylvania","44":"Rhode Island","45":"South Carolina","46":"South Dakota",
  "47":"Tennessee","48":"Texas","49":"Utah","50":"Vermont","51":"Virginia",
  "53":"Washington","54":"West Virginia","55":"Wisconsin","56":"Wyoming",
};

const STATE_ABBREV: Record<string, string> = {
  "Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA",
  "Colorado":"CO","Connecticut":"CT","Delaware":"DE","District of Columbia":"DC",
  "Florida":"FL","Georgia":"GA","Hawaii":"HI","Idaho":"ID","Illinois":"IL",
  "Indiana":"IN","Iowa":"IA","Kansas":"KS","Kentucky":"KY","Louisiana":"LA",
  "Maine":"ME","Maryland":"MD","Massachusetts":"MA","Michigan":"MI","Minnesota":"MN",
  "Mississippi":"MS","Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV",
  "New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY",
  "North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK","Oregon":"OR",
  "Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD",
  "Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT","Virginia":"VA",
  "Washington":"WA","West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY",
};

// States that use different terminology for chambers
// Nebraska is unicameral — only has "senate" (49 legislative districts)
const UNICAMERAL_STATES = ["31"]; // Nebraska FIPS

function buildValidatedCensusUrl(
  baseUrl: string,
  getParam: string,
  forParam: string,
  inParam: string
): string {
  try {
    const url = new URL(baseUrl);
    
    // Validate the stateFips parameter (should be 2-digit FIPS code)
    if (!/^[0-9]{2}$/.test(inParam.replace('state:', ''))) {
      throw new Error('Invalid parameter');
    }
    
    url.searchParams.set('get', getParam);
    url.searchParams.set('for', forParam);
    url.searchParams.set('in', inParam);
    
    return url.href;
  } catch {
    throw new Error('Invalid URL');
  }
}

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

function parseRow(r: Record<string, string>) {
  const uninsuredTotal =
    (safeInt(r["B27010_017E"]) ?? 0) +
    (safeInt(r["B27010_033E"]) ?? 0) +
    (safeInt(r["B27010_050E"]) ?? 0) +
    (safeInt(r["B27010_066E"]) ?? 0);
  const healthTotal = safeInt(r["B27010_001E"]);
  const uninsuredPct = healthTotal && healthTotal > 0
    ? Math.round((uninsuredTotal / healthTotal) * 1000) / 10
    : null;

  return {
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
  };
}

async function fetchChamber(
  stateFips: string,
  chamber: "house" | "senate",
  stateAbbr: string,
  stateName: string,
): Promise<Array<Record<string, unknown>>> {
  // Census geography names:
  //   State Senate: "state legislative district (upper chamber)"
  //   State House: "state legislative district (lower chamber)"
  const geoType = chamber === "senate"
    ? "state%20legislative%20district%20(upper%20chamber)"
    : "state%20legislative%20district%20(lower%20chamber)";

  const url = buildValidatedCensusUrl(
    CENSUS_BASE,
    CENSUS_VARS,
    `${geoType}:*`,
    `state:${stateFips}`
  );
  console.log(`Fetching ${chamber} districts for ${stateAbbr}: ${url}`);

  let response: Response;
  try {
    response = await fetch(url);
  } catch (e) {
    console.error(`Fetch failed for ${stateAbbr} ${chamber}: ${e}`);
    return [];
  }

  if (!response.ok) {
    const text = await response.text();
    console.error(`Census API error for ${stateAbbr} ${chamber}: ${response.status} ${text}`);
    return [];
  }

  let rawData: string[][];
  try {
    const text = await response.text();
    if (!text || text.trim().length === 0) {
      console.warn(`Empty response for ${stateAbbr} ${chamber}, skipping`);
      return [];
    }
    rawData = JSON.parse(text);
  } catch (e) {
    console.warn(`JSON parse failed for ${stateAbbr} ${chamber}, skipping: ${e}`);
    return [];
  }
  if (!rawData || rawData.length < 2) return [];

  const headers = rawData[0];
  const rows = rawData.slice(1);

  const geoField = chamber === "senate"
    ? "state legislative district (upper chamber)"
    : "state legislative district (lower chamber)";

  const records: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    const r: Record<string, string> = {};
    headers.forEach((h, i) => { r[h] = row[i]; });

    const rawDistNum = r[geoField] || "00";
    // Skip "ZZ" districts (undefined/remainder)
    if (rawDistNum === "ZZZ" || rawDistNum.startsWith("ZZ")) continue;

    // Normalize: strip leading zeros from purely numeric district numbers
    const distNum = /^0+[0-9]+$/.test(rawDistNum) ? rawDistNum.replace(/^0+/, "") : rawDistNum;
    const prefix = chamber === "senate" ? "SD" : "HD";
    const districtId = `${stateAbbr}-${prefix}-${distNum}`;

    records.push({
      district_id: districtId,
      chamber,
      state: stateName,
      state_abbr: stateAbbr,
      district_number: distNum,
      ...parseRow(r),
    });
  }

  return records;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const stateFilter = url.searchParams.get("state") || undefined; // e.g. "CA"
    const chamberFilter = url.searchParams.get("chamber") as "house" | "senate" | undefined;

    // Determine which states to process
    const statesToProcess: Array<{ fips: string; abbr: string; name: string }> = [];

    for (const [fips, name] of Object.entries(FIPS_TO_STATE)) {
      const abbr = STATE_ABBREV[name];
      if (!abbr) continue;
      if (stateFilter && abbr !== stateFilter.toUpperCase()) continue;
      statesToProcess.push({ fips, abbr, name });
    }

    console.log(`Processing ${statesToProcess.length} states`);

    let totalUpserted = 0;
    let totalErrors = 0;
    let totalFetched = 0;

    // Process states in batches of 5 to avoid overwhelming Census API
    for (let si = 0; si < statesToProcess.length; si += 5) {
      const batch = statesToProcess.slice(si, si + 5);

      const batchPromises = batch.flatMap(({ fips, abbr, name }) => {
        const chambers: Array<"house" | "senate"> = [];

        if (UNICAMERAL_STATES.includes(fips)) {
          // Nebraska: only upper chamber (called "senators" but mapped as senate)
          if (!chamberFilter || chamberFilter === "senate") chambers.push("senate");
        } else {
          if (!chamberFilter || chamberFilter === "senate") chambers.push("senate");
          if (!chamberFilter || chamberFilter === "house") chambers.push("house");
        }

        return chambers.map((ch) => fetchChamber(fips, ch, abbr, name));
      });

      const results = await Promise.all(batchPromises);
      const allRecords = results.flat();
      totalFetched += allRecords.length;

      // Upsert in chunks of 100
      for (let i = 0; i < allRecords.length; i += 100) {
        const chunk = allRecords.slice(i, i + 100);
        const { error } = await supabase
          .from("state_legislative_profiles")
          .upsert(chunk, { onConflict: "district_id,chamber" });

        if (error) {
          console.error("Upsert error:", error);
          totalErrors += chunk.length;
        } else {
          totalUpserted += chunk.length;
        }
      }

      console.log(`Batch ${si / 5 + 1}: ${allRecords.length} records`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        states_processed: statesToProcess.length,
        total_fetched: totalFetched,
        upserted: totalUpserted,
        errors: totalErrors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("State legislative sync error:", error);
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
