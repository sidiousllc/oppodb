import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import type { SupabaseLike } from "../_shared/supabase-types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Harvard Dataverse file IDs for MIT Election Lab datasets ───────────────

const DATASETS: Record<string, { fileId: number; office: string; description: string }> = {
  house: {
    fileId: 13592823,
    office: "US HOUSE",
    description: "U.S. House 1976–2024 (district-level)",
  },
  senate: {
    fileId: 7609736,
    office: "US SENATE",
    description: "U.S. Senate 1976–2020 (state-level)",
  },
  president: {
    fileId: 10244938,
    office: "US PRESIDENT",
    description: "U.S. President 1976–2020 (state-level)",
  },
  president_county: {
    fileId: 13573089,
    office: "US PRESIDENT",
    description: "County Presidential Returns 2000–2024",
  },
};

// ─── Additional GitHub-hosted county presidential data sources ──────────────

const GITHUB_COUNTY_SOURCES: Array<{
  year: number;
  url: string;
  description: string;
  colMap: Record<string, string>; // maps standard field -> CSV column name
}> = [
  {
    year: 2024,
    url: "https://raw.githubusercontent.com/tonmcg/US_County_Level_Election_Results_08-24/master/2024_US_County_Level_Presidential_Results.csv",
    description: "tonmcg 2024 County Presidential Results",
    colMap: {
      county_fips: "county_fips",
      county_name: "county_name",
      state_po: "state_abbr",
      dem_votes: "votes_dem",
      rep_votes: "votes_gop",
      total_votes: "total_votes_president",
    },
  },
  {
    year: 2020,
    url: "https://raw.githubusercontent.com/tonmcg/US_County_Level_Election_Results_08-20/master/2020_US_County_Level_Presidential_Results.csv",
    description: "tonmcg 2020 County Presidential Results",
    colMap: {
      county_fips: "county_fips",
      county_name: "county_name",
      state_po: "state_abbr",
      dem_votes: "votes_dem",
      rep_votes: "votes_gop",
      total_votes: "total_votes",
    },
  },
  {
    year: 2016,
    url: "https://raw.githubusercontent.com/tonmcg/US_County_Level_Election_Results_08-20/master/2016_US_County_Level_Presidential_Results.csv",
    description: "tonmcg 2016 County Presidential Results",
    colMap: {
      county_fips: "combined_fips",
      county_name: "county_name",
      state_po: "state_abbr",
      dem_votes: "votes_dem",
      rep_votes: "votes_gop",
      total_votes: "total_votes",
    },
  },
  {
    year: 2012,
    url: "https://raw.githubusercontent.com/tonmcg/US_County_Level_Election_Results_08-20/master/2012_US_County_Level_Presidential_Results.csv",
    description: "tonmcg 2012 County Presidential Results",
    colMap: {
      county_fips: "combined_fips",
      county_name: "county_name",
      state_po: "state_abbr",
      dem_votes: "votes_dem",
      rep_votes: "votes_gop",
      total_votes: "total_votes",
    },
  },
  {
    year: 2008,
    url: "https://raw.githubusercontent.com/tonmcg/US_County_Level_Election_Results_08-20/master/2008_US_County_Level_Presidential_Results.csv",
    description: "tonmcg 2008 County Presidential Results",
    colMap: {
      county_fips: "combined_fips",
      county_name: "county_name",
      state_po: "state_abbr",
      dem_votes: "votes_dem",
      rep_votes: "votes_gop",
      total_votes: "total_votes",
    },
  },
];

// Presidential candidate names by year
const PRES_CANDIDATES: Record<number, { dem: string; rep: string }> = {
  2024: { dem: "HARRIS, KAMALA D.", rep: "TRUMP, DONALD J." },
  2020: { dem: "BIDEN, JOSEPH R. JR", rep: "TRUMP, DONALD J." },
  2016: { dem: "CLINTON, HILLARY", rep: "TRUMP, DONALD J." },
  2012: { dem: "OBAMA, BARACK H.", rep: "ROMNEY, MITT" },
  2008: { dem: "OBAMA, BARACK H.", rep: "MCCAIN, JOHN" },
  2004: { dem: "KERRY, JOHN", rep: "BUSH, GEORGE W." },
  2000: { dem: "GORE, AL", rep: "BUSH, GEORGE W." },
};

// ─── CSV parsing ────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if ((ch === "," || ch === "\t") && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseData(text: string): Record<string, string>[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map((h) => h.replace(/"/g, "").toLowerCase());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (vals[idx] || "").replace(/^"|"$/g, "");
    });
    rows.push(row);
  }
  return rows;
}

// ─── GitHub county source sync ──────────────────────────────────────────────

async function syncGitHubCountySource(
  source: typeof GITHUB_COUNTY_SOURCES[0],
  stateFilter: string,
  supabase: SupabaseLike,
): Promise<{ synced: number; errors: number }> {
  console.log(`[GitHub] Downloading ${source.description}...`);

  let resp: Response;
  try {
    resp = await fetch(source.url, {
      headers: { "User-Agent": "ORDB-Election-Sync" },
    });
    if (!resp.ok) {
      console.warn(`[GitHub] ${source.description}: HTTP ${resp.status}`);
      return { synced: 0, errors: 0 };
    }
  } catch (e) {
    console.error(`[GitHub] ${source.description} fetch error: ${e}`);
    return { synced: 0, errors: 1 };
  }

  const text = await resp.text();
  const allRows = parseData(text);
  console.log(`[GitHub] Parsed ${allRows.length} rows from ${source.description}`);

  const cm = source.colMap;
  const candidates = PRES_CANDIDATES[source.year] || { dem: "DEMOCRAT", rep: "REPUBLICAN" };

  // Filter by state if specified
  const filtered = stateFilter
    ? allRows.filter((r) => (r[cm.state_po] || "").toUpperCase() === stateFilter)
    : allRows;

  if (filtered.length === 0) return { synced: 0, errors: 0 };

  // Convert to mit_election_results format (one row per candidate per county)
  const records: Array<Record<string, unknown>>[] = [];
  const batch: Array<Record<string, unknown>> = [];

  for (const r of filtered) {
    const fips = (r[cm.county_fips] || "").toString().padStart(5, "0");
    const countyName = r[cm.county_name] || "";
    const stateAbbr = (r[cm.state_po] || "").toUpperCase();
    const demVotes = parseInt(r[cm.dem_votes] || "0") || 0;
    const repVotes = parseInt(r[cm.rep_votes] || "0") || 0;
    const totalVotes = parseInt(r[cm.total_votes] || "0") || (demVotes + repVotes);

    if (!fips || fips === "00000" || !stateAbbr) continue;

    // Determine state name from abbreviation
    const stateName = STATE_NAMES[stateAbbr] || stateAbbr;

    // Democrat row
    batch.push({
      year: source.year,
      state: stateName,
      state_po: stateAbbr,
      office: "US PRESIDENT",
      district: "statewide",
      county_name: countyName,
      county_fips: fips,
      stage: "gen",
      special: false,
      candidate: candidates.dem,
      party: "DEMOCRAT",
      writein: false,
      candidatevotes: demVotes,
      totalvotes: totalVotes,
      source: "github_tonmcg",
    });

    // Republican row
    batch.push({
      year: source.year,
      state: stateName,
      state_po: stateAbbr,
      office: "US PRESIDENT",
      district: "statewide",
      county_name: countyName,
      county_fips: fips,
      stage: "gen",
      special: false,
      candidate: candidates.rep,
      party: "REPUBLICAN",
      writein: false,
      candidatevotes: repVotes,
      totalvotes: totalVotes,
      source: "github_tonmcg",
    });

    if (batch.length >= 500) {
      records.push([...batch]);
      batch.length = 0;
    }
  }
  if (batch.length > 0) records.push([...batch]);

  let totalSynced = 0;
  let totalErrors = 0;

  for (const chunk of records) {
    const { error } = await supabase
      .from("mit_election_results")
      .upsert(chunk, {
        onConflict: "year,state_po,office,district,candidate,party,county_fips",
      });

    if (error) {
      console.error(`[GitHub] Batch error for ${source.year}: ${error.message}`);
      totalErrors++;
    } else {
      totalSynced += chunk.length;
    }
  }

  return { synced: totalSynced, errors: totalErrors };
}

const STATE_NAMES: Record<string, string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",
  CO:"Colorado",CT:"Connecticut",DE:"Delaware",DC:"District of Columbia",
  FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",
  IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",
  ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",
  MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",
  NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",
  NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",
  PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",
  TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",
  WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",
};

// ─── Main handler ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const dataset = url.searchParams.get("dataset") || "house";
    const minYear = parseInt(url.searchParams.get("min_year") || "2000");
    const stateFilter = url.searchParams.get("state") || "";

    const ds = DATASETS[dataset];
    if (!ds) {
      return new Response(
        JSON.stringify({ error: `Unknown dataset: ${dataset}. Options: ${Object.keys(DATASETS).join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth check - require authenticated user (admin for write ops)
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: roleData } = await adminClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sources: string[] = [];
    let totalSynced = 0;
    let totalErrors = 0;
    let totalParsed = 0;
    let totalFiltered = 0;

    // ── Source 1: Harvard Dataverse (MIT Election Lab) ─────────────────────
    console.log(`Downloading MIT Election Lab dataset: ${ds.description}`);
    sources.push("harvard_dataverse");

    try {
      const downloadUrl = `https://dataverse.harvard.edu/api/access/datafile/${ds.fileId}`;
      const resp = await fetch(downloadUrl);
      if (!resp.ok) {
        console.warn(`Harvard Dataverse download failed: ${resp.status}, trying fallback sources...`);
      } else {
        const text = await resp.text();
        const allRows = parseData(text);
        totalParsed = allRows.length;
        console.log(`Parsed ${allRows.length} total rows from Harvard Dataverse`);

        const filtered = allRows.filter((r) => {
          const year = parseInt(r.year);
          if (isNaN(year) || year < minYear) return false;
          if (stateFilter && r.state_po !== stateFilter.toUpperCase()) return false;
          const stage = r.stage || "gen";
          if (stage !== "gen") return false;
          return true;
        });

        totalFiltered = filtered.length;
        console.log(`Filtered to ${filtered.length} rows (year >= ${minYear}${stateFilter ? `, state=${stateFilter}` : ""})`);

        if (filtered.length > 0) {
          if (dataset === "house") {
            const batchSize = 500;
            for (let i = 0; i < filtered.length; i += batchSize) {
              const batch = filtered.slice(i, i + batchSize).map((r) => ({
                election_year: parseInt(r.year),
                state_abbr: r.state_po,
                district_number: r.district === "0" ? "AL" : String(parseInt(r.district)),
                candidate_name: r.candidate,
                party: r.party || r.party_detailed || r.party_simplified || null,
                votes: r.candidatevotes ? parseInt(r.candidatevotes) : null,
                total_votes: r.totalvotes ? parseInt(r.totalvotes) : null,
                vote_pct: r.candidatevotes && r.totalvotes && parseInt(r.totalvotes) > 0
                  ? Math.round((parseInt(r.candidatevotes) / parseInt(r.totalvotes)) * 10000) / 100
                  : null,
                is_write_in: r.writein === "TRUE" || r.writein === "true",
                election_type: r.special === "TRUE" || r.special === "true" ? "special" : "general",
                source: "mit_election_lab",
              }));

              const { error } = await adminClient
                .from("congressional_election_results")
                .upsert(batch, {
                  onConflict: "state_abbr,district_number,election_year,election_type,candidate_name",
                });

              if (error) {
                console.error(`House batch error at ${i}: ${error.message}`);
                totalErrors++;
              } else {
                totalSynced += batch.length;
              }
            }
          } else {
            const batchSize = 500;
            for (let i = 0; i < filtered.length; i += batchSize) {
              const batch = filtered.slice(i, i + batchSize).map((r) => ({
                year: parseInt(r.year),
                state: r.state,
                state_po: r.state_po,
                office: ds.office,
                district: r.district || "statewide",
                county_name: r.county_name || null,
                county_fips: r.county_fips || "",
                stage: r.stage || "gen",
                special: r.special === "TRUE" || r.special === "true",
                candidate: r.candidate,
                party: r.party || r.party_detailed || r.party_simplified || "",
                writein: r.writein === "TRUE" || r.writein === "true",
                candidatevotes: r.candidatevotes ? parseInt(r.candidatevotes) : null,
                totalvotes: r.totalvotes ? parseInt(r.totalvotes) : null,
                source: "mit_election_lab",
              }));

              const { error } = await adminClient
                .from("mit_election_results")
                .upsert(batch, {
                  onConflict: "year,state_po,office,district,candidate,party,county_fips",
                });

              if (error) {
                console.error(`MIT batch error at ${i}: ${error.message}`);
                totalErrors++;
              } else {
                totalSynced += batch.length;
              }
            }
          }
        }
      }
    } catch (e) {
      console.error(`Harvard Dataverse error: ${e}`);
    }

    // ── Source 2: GitHub county data (for president_county dataset) ────────
    if (dataset === "president_county") {
      const applicableSources = GITHUB_COUNTY_SOURCES.filter((s) => s.year >= minYear);
      if (applicableSources.length > 0) {
        sources.push("github_tonmcg");
        console.log(`[GitHub] Syncing ${applicableSources.length} county presidential datasets...`);

        for (const src of applicableSources) {
          try {
            const result = await syncGitHubCountySource(src, stateFilter.toUpperCase(), adminClient);
            totalSynced += result.synced;
            totalErrors += result.errors;
            console.log(`[GitHub] ${src.year}: ${result.synced} synced, ${result.errors} errors`);
          } catch (e) {
            console.error(`[GitHub] ${src.year} error: ${e}`);
            totalErrors++;
          }
        }
      }
    }

    console.log(`Synced ${totalSynced} rows for ${ds.description} from [${sources.join(", ")}] (${totalErrors} errors)`);

    return new Response(
      JSON.stringify({
        success: true,
        dataset: ds.description,
        sources,
        total_parsed: totalParsed,
        total_filtered: totalFiltered,
        total_synced: totalSynced,
        total_errors: totalErrors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("MIT Election Lab sync error:", err);
    // Return 200 with fallback signal so the client can degrade gracefully
    // instead of treating upstream/network failures as a hard crash.
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
        fallback: true,
        total_synced: 0,
        total_errors: 1,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
