import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STATE_ABBREV_TO_LOWER: Record<string, string> = {
  AL:"al",AK:"ak",AZ:"az",AR:"ar",CA:"ca",CO:"co",CT:"ct",DE:"de",
  FL:"fl",GA:"ga",HI:"hi",ID:"id",IL:"il",IN:"in",IA:"ia",KS:"ks",
  KY:"ky",LA:"la",ME:"me",MD:"md",MA:"ma",MI:"mi",MN:"mn",MS:"ms",
  MO:"mo",MT:"mt",NE:"ne",NV:"nv",NH:"nh",NJ:"nj",NM:"nm",NY:"ny",
  NC:"nc",ND:"nd",OH:"oh",OK:"ok",OR:"or",PA:"pa",RI:"ri",SC:"sc",
  SD:"sd",TN:"tn",TX:"tx",UT:"ut",VT:"vt",VA:"va",WA:"wa",WV:"wv",
  WI:"wi",WY:"wy",
};

// Map OpenElections office names to our chamber types
function classifyChamber(office: string): "house" | "senate" | null {
  const o = office.toLowerCase().trim();
  if (
    o === "state house" || o === "state representative" ||
    o === "state assembly" || o === "house of delegates" ||
    o === "general assembly" || o.includes("state house") ||
    o.includes("house of representatives") || o.includes("assembly member") ||
    o.includes("assemblymember") || o.includes("state rep")
  ) return "house";
  if (
    o === "state senate" || o === "state senator" ||
    o.includes("state senate") || o === "state legislature"
  ) return "senate";
  return null;
}

type DistrictAggregate = {
  candidate: string;
  party: string;
  votes: number;
  district: string;
  chamber: "house" | "senate";
  winner: boolean;
  writeIn: boolean;
};

function splitCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }

  fields.push(current.trim());
  return fields;
}

async function processCSVResponse(
  response: Response,
): Promise<{ districtResults: Map<string, DistrictAggregate>; processedRows: number }> {
  const districtResults = new Map<string, DistrictAggregate>();
  let processedRows = 0;

  const stream = response.body?.pipeThrough(new TextDecoderStream());
  if (!stream) return { districtResults, processedRows };

  const reader = stream.getReader();
  let headers: string[] | null = null;
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (!headers) {
        headers = splitCSVLine(line).map((h) => h.toLowerCase().replace(/"/g, ""));
        continue;
      }

      const vals = splitCSVLine(line);
      if (vals.length < headers.length - 2) continue;

      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = (vals[idx] || "").replace(/"/g, "");
      });

      const office = row["office"] || "";
      const chamber = classifyChamber(office);
      if (!chamber) continue;

      const district = (row["district"] || "").replace(/^0+/, "") || "0";
      const candidate = row["candidate"] || "";
      if (!candidate || candidate === "Total") continue;

      const votes = parseInt(row["votes"] || "0") || 0;
      const party = row["party"] || "";
      const winner = (row["winner"] || "").toLowerCase() === "true";
      const writeIn = (row["write_in"] || row["writein"] || "").toLowerCase() === "true";

      const key = `${chamber}-${district}-${candidate}`;
      const existing = districtResults.get(key);
      if (existing) {
        existing.votes += votes;
        if (winner) existing.winner = true;
      } else {
        districtResults.set(key, {
          candidate,
          party,
          votes,
          district,
          chamber,
          winner,
          writeIn,
        });
      }

      processedRows++;
    }
  }

  if (buffer.trim() && headers) {
    const vals = splitCSVLine(buffer.trim());
    if (vals.length >= headers.length - 2) {
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = (vals[idx] || "").replace(/"/g, "");
      });

      const office = row["office"] || "";
      const chamber = classifyChamber(office);
      if (chamber) {
        const district = (row["district"] || "").replace(/^0+/, "") || "0";
        const candidate = row["candidate"] || "";
        if (candidate && candidate !== "Total") {
          const votes = parseInt(row["votes"] || "0") || 0;
          const party = row["party"] || "";
          const winner = (row["winner"] || "").toLowerCase() === "true";
          const writeIn = (row["write_in"] || row["writein"] || "").toLowerCase() === "true";

          const key = `${chamber}-${district}-${candidate}`;
          const existing = districtResults.get(key);
          if (existing) {
            existing.votes += votes;
            if (winner) existing.winner = true;
          } else {
            districtResults.set(key, {
              candidate,
              party,
              votes,
              district,
              chamber,
              winner,
              writeIn,
            });
          }
          processedRows++;
        }
      }
    }
  }

  return { districtResults, processedRows };
}

async function fetchElectionFilesFromGitHub(
  stateAbbr: string,
  githubToken: string | undefined,
): Promise<{ files: string[]; branch: string }> {
  const stateLower = STATE_ABBREV_TO_LOWER[stateAbbr];
  if (!stateLower) return { files: [], branch: "master" };

  // Use GitHub API to list files - try master first, then main
  const headers: Record<string, string> = { "User-Agent": "ORDB-Election-Sync" };
  if (githubToken) headers["Authorization"] = `token ${githubToken}`;

  let response: Response | null = null;
  for (const branch of ["master", "main"]) {
    const repoUrl = `https://api.github.com/repos/openelections/openelections-data-${stateLower}/git/trees/${branch}?recursive=1`;
    try {
      const r = await fetch(repoUrl, { headers });
      if (r.ok) {
        response = r;
        break;
      }
    } catch (e) {
      console.error(`Failed to fetch repo tree for ${stateAbbr} (${branch}): ${e}`);
    }
  }

  if (!response) {
    console.error(`Could not find repo for ${stateAbbr}`);
    return { files: [], branch: "master" };
  }

  // Determine which branch worked
  const usedBranch = response.url.includes("/main?") ? "main" : "master";

  const data = await response.json();
  if (!data.tree) return { files: [], branch: usedBranch };

  // Filter for CSV files containing state legislative results
  // Some states have dedicated state_house/state_senate files, others have combined files
  const dedicatedFiles: string[] = [];
  const combinedFiles: string[] = [];
  const precinctFallbackFiles: string[] = [];

  for (const item of data.tree) {
    if (item.type !== "blob") continue;
    const path = item.path as string;
    if (!path.endsWith(".csv")) continue;
    const lower = path.toLowerCase();
    if (!lower.includes("general")) continue;

    // Dedicated state legislative files
    if (
      lower.includes("state_house") || lower.includes("state_senate") ||
      lower.includes("state_rep") || lower.includes("state_assembly") ||
      lower.includes("state_legislature")
    ) {
      if (!lower.includes("precinct")) {
        dedicatedFiles.push(path);
      }
      continue;
    }

    // Combined files (have all offices) - prefer county/statewide files
    if (lower.includes("__county.csv") || lower.match(/__general\.csv$/)) {
      combinedFiles.push(path);
    } else if (lower.includes("precinct")) {
      // only use precinct if nothing else exists
      precinctFallbackFiles.push(path);
    }
  }

  // Use dedicated files if available, otherwise combined files, finally precinct fallback
  let files = dedicatedFiles.length > 0
    ? dedicatedFiles
    : (combinedFiles.length > 0 ? combinedFiles : precinctFallbackFiles);

  // Sort by date descending, take recent elections
  files.sort().reverse();
  return { files: files.slice(0, 8), branch: usedBranch };
}

async function fetchCSVResponse(
  stateAbbr: string,
  filePath: string,
  branch: string,
  githubToken: string | undefined,
): Promise<Response | null> {
  const stateLower = STATE_ABBREV_TO_LOWER[stateAbbr];
  const rawUrl = `https://raw.githubusercontent.com/openelections/openelections-data-${stateLower}/${branch}/${filePath}`;
  const headers: Record<string, string> = { "User-Agent": "ORDB-Election-Sync" };
  if (githubToken) headers["Authorization"] = `token ${githubToken}`;

  try {
    const response = await fetch(rawUrl, { headers });
    if (!response.ok) {
      console.error(`CSV fetch error ${filePath}: ${response.status}`);
      return null;
    }

    const contentLength = Number(response.headers.get("content-length") || "0");
    if (contentLength > 6_000_000) {
      console.warn(`Skipping large file ${filePath} (${contentLength} bytes)`);
      return null;
    }

    return response;
  } catch (e) {
    console.error(`Failed to fetch CSV ${filePath}: ${e}`);
    return null;
  }
}

function extractElectionDate(filename: string): { date: string; year: number } | null {
  // Filenames like 20221108__md__general__state_house.csv
  const match = filename.match(/(\d{8})/);
  if (!match) return null;
  const ds = match[1];
  const year = parseInt(ds.substring(0, 4));
  const month = ds.substring(4, 6);
  const day = ds.substring(6, 8);
  return { date: `${year}-${month}-${day}`, year };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const githubToken = Deno.env.get("GITHUB_TOKEN") || undefined;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const stateFilter = url.searchParams.get("state")?.toUpperCase();

    // CRITICAL: Only process ONE state per invocation to stay within memory limits
    if (!stateFilter) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Please specify a state parameter, e.g. ?state=CA. Processing all states at once exceeds memory limits. Use the frontend batch sync instead.",
          all_states: Object.keys(STATE_ABBREV_TO_LOWER),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`Processing election results for ${stateFilter}`);

    const { files, branch } = await fetchElectionFilesFromGitHub(stateFilter, githubToken);
    console.log(`Found ${files.length} election files for ${stateFilter} (${branch})`);

    if (files.length === 0) {
      return new Response(
        JSON.stringify({ success: true, state: stateFilter, upserted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Limit to 3 most recent files to stay within resource limits
    const filesToProcess = files.slice(0, 3);
    let totalUpserted = 0;
    let totalErrors = 0;
    const skippedFiles: Array<{ file: string; reason: string }> = [];

    // Also track files we already skipped due to size in fetchCSVResponse
    for (const file of filesToProcess) {
      const electionInfo = extractElectionDate(file);
      if (!electionInfo) {
        skippedFiles.push({ file, reason: "Could not parse election date from filename" });
        continue;
      }

      const csvResponse = await fetchCSVResponse(stateFilter, file, branch, githubToken);
      if (!csvResponse) {
        skippedFiles.push({ file, reason: "File too large (>6MB) or fetch failed" });
        continue;
      }

      const { districtResults, processedRows } = await processCSVResponse(csvResponse);
      console.log(`${file}: ${processedRows} rows processed`);

      if (districtResults.size === 0) {
        skippedFiles.push({ file, reason: "No state legislative races found in file" });
        continue;
      }
      // Calculate totals and find winners per race
      const districtTotals = new Map<string, number>();
      const districtTopVotes = new Map<string, number>();
      for (const [, result] of districtResults) {
        const raceKey = `${result.chamber}-${result.district}`;
        districtTotals.set(raceKey, (districtTotals.get(raceKey) || 0) + result.votes);
        const current = districtTopVotes.get(raceKey) || 0;
        if (result.votes > current) districtTopVotes.set(raceKey, result.votes);
      }

      const records: Array<Record<string, unknown>> = [];
      for (const [, result] of districtResults) {
        const raceKey = `${result.chamber}-${result.district}`;
        const totalVotes = districtTotals.get(raceKey) || 0;
        const votePct = totalVotes > 0 ? Math.round((result.votes / totalVotes) * 1000) / 10 : null;
        const isWinner = result.winner || (result.votes > 0 && result.votes === districtTopVotes.get(raceKey));

        records.push({
          state_abbr: stateFilter,
          chamber: result.chamber,
          district_number: result.district.replace(/^0+/, "") || "0",
          election_year: electionInfo.year,
          election_date: electionInfo.date,
          election_type: "general",
          candidate_name: result.candidate,
          party: result.party,
          votes: result.votes,
          vote_pct: votePct,
          is_winner: isWinner,
          is_write_in: result.writeIn,
          total_votes: totalVotes,
          source: "openelections",
          updated_at: new Date().toISOString(),
        });
      }

      // Upsert in chunks
      for (let i = 0; i < records.length; i += 100) {
        const chunk = records.slice(i, i + 100);
        const { error } = await supabase
          .from("state_leg_election_results")
          .upsert(chunk, {
            onConflict: "state_abbr,chamber,district_number,election_year,election_type,candidate_name",
          });

        if (error) {
          console.error(`Upsert error for ${stateFilter}: ${error.message}`);
          totalErrors += chunk.length;
        } else {
          totalUpserted += chunk.length;
        }
      }
    }

    console.log(`${stateFilter}: ${totalUpserted} results upserted`);

    return new Response(
      JSON.stringify({
        success: true,
        state: stateFilter,
        upserted: totalUpserted,
        errors: totalErrors,
        files_processed: filesToProcess.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Election results sync error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
