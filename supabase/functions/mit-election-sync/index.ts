import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Harvard Dataverse file IDs for MIT Election Lab datasets
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

// Some datasets are CSV (quoted), others TSV. Handle both.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const dataset = url.searchParams.get("dataset") || "house";
    const minYear = parseInt(url.searchParams.get("min_year") || "2016");
    const stateFilter = url.searchParams.get("state") || "";

    const ds = DATASETS[dataset];
    if (!ds) {
      return new Response(
        JSON.stringify({ error: `Unknown dataset: ${dataset}. Options: ${Object.keys(DATASETS).join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth check - require admin
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

    console.log(`Downloading MIT Election Lab dataset: ${ds.description}`);

    // Download from Harvard Dataverse
    const downloadUrl = `https://dataverse.harvard.edu/api/access/datafile/${ds.fileId}`;
    const resp = await fetch(downloadUrl);
    if (!resp.ok) {
      throw new Error(`Failed to download dataset: ${resp.status}`);
    }
    const text = await resp.text();
    const allRows = parseData(text);

    console.log(`Parsed ${allRows.length} total rows from dataset`);

    // Filter by year and state
    const filtered = allRows.filter((r) => {
      const year = parseInt(r.year);
      if (isNaN(year) || year < minYear) return false;
      if (stateFilter && r.state_po !== stateFilter.toUpperCase()) return false;
      // Only general elections by default
      const stage = r.stage || "gen";
      if (stage !== "gen") return false;
      return true;
    });

    console.log(`Filtered to ${filtered.length} rows (year >= ${minYear}${stateFilter ? `, state=${stateFilter}` : ""})`);

    if (filtered.length === 0) {
      return new Response(
        JSON.stringify({ success: true, total_synced: 0, message: "No rows matched filters" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalSynced = 0;
    let totalErrors = 0;

    if (dataset === "house") {
      // Map to congressional_election_results format
      // Unique constraint: (state_abbr, district_number, election_year, election_type, candidate_name)
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
      // Senate, President, President County - upsert into mit_election_results
      // Unique index: (year, state_po, office, district, candidate, party, county_fips)
      // All columns must be non-null (use '' for missing values)
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

    console.log(`Synced ${totalSynced} rows for ${ds.description} (${totalErrors} batch errors)`);

    return new Response(
      JSON.stringify({
        success: true,
        dataset: ds.description,
        total_parsed: allRows.length,
        total_filtered: filtered.length,
        total_synced: totalSynced,
        total_errors: totalErrors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("MIT Election Lab sync error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
