import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Census ACS 5-Year API (2022 data, latest available)
const CENSUS_BASE = "https://api.census.gov/data/2022/acs/acs5";

// Variables we need
// B01003_001E = Total population
// B19013_001E = Median household income
// B01002_001E = Median age
// B15003_022E = Bachelor's degree (count)
// B15003_001E = Total education universe (for percentage calc)
const CENSUS_VARS = "B01003_001E,B19013_001E,B01002_001E,B15003_022E,B15003_001E";

// Map of state FIPS codes to state abbreviations
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

interface CensusDistrict {
  district_id: string;
  state: string;
  population: number | null;
  median_income: number | null;
  median_age: number | null;
  education_bachelor_pct: number | null;
  raw_data: Record<string, unknown>;
}

async function fetchCensusData(stateFips?: string): Promise<CensusDistrict[]> {
  // Fetch for congressional districts
  // geo: congressional district, in state
  const geoParam = stateFips
    ? `&for=congressional%20district:*&in=state:${stateFips}`
    : `&for=congressional%20district:*&in=state:*`;

  const url = `${CENSUS_BASE}?get=${CENSUS_VARS}${geoParam}`;
  console.log("Fetching Census data:", url);

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Census API error [${response.status}]: ${text}`);
  }

  const rawData: string[][] = await response.json();
  // First row is headers
  const headers = rawData[0];
  const rows = rawData.slice(1);

  const results: CensusDistrict[] = [];

  for (const row of rows) {
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      record[h] = row[i];
    });

    const stFips = record["state"];
    const cdNum = record["congressional district"];
    const stateName = FIPS_TO_STATE[stFips];
    if (!stateName) continue;

    const stateAbbrev = STATE_ABBREV[stateName];
    if (!stateAbbrev) continue;

    // Format district_id as "ST-XX" (e.g., "WA-07")
    const districtId = `${stateAbbrev}-${cdNum.padStart(2, "0")}`;

    const population = parseInt(record["B01003_001E"]);
    const medianIncome = parseInt(record["B19013_001E"]);
    const medianAge = parseFloat(record["B01002_001E"]);
    const bachelorCount = parseInt(record["B15003_022E"]);
    const eduTotal = parseInt(record["B15003_001E"]);

    const bachelorPct = eduTotal > 0 ? Math.round((bachelorCount / eduTotal) * 1000) / 10 : null;

    results.push({
      district_id: districtId,
      state: stateName,
      population: isNaN(population) || population < 0 ? null : population,
      median_income: isNaN(medianIncome) || medianIncome < 0 ? null : medianIncome,
      median_age: isNaN(medianAge) || medianAge < 0 ? null : medianAge,
      education_bachelor_pct: bachelorPct,
      raw_data: record,
    });
  }

  return results;
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
    const stateFips = url.searchParams.get("state_fips") || undefined;

    console.log("Starting Census data sync...");
    const censusData = await fetchCensusData(stateFips);
    console.log(`Fetched ${censusData.length} districts from Census API`);

    let upserted = 0;
    let errors = 0;

    // Batch upsert in chunks of 50
    for (let i = 0; i < censusData.length; i += 50) {
      const chunk = censusData.slice(i, i + 50);
      const { error } = await supabase
        .from("district_profiles")
        .upsert(
          chunk.map((d) => ({
            district_id: d.district_id,
            state: d.state,
            population: d.population,
            median_income: d.median_income,
            median_age: d.median_age,
            education_bachelor_pct: d.education_bachelor_pct,
            raw_data: d.raw_data,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "district_id" }
        );

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
        total_fetched: censusData.length,
        upserted,
        errors,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
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
