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

function classifyAsCongressional(office: string): boolean {
  const o = office.toLowerCase().trim();
  return (
    o === "u.s. house" || o === "us house" ||
    o === "u.s. representative" || o === "us representative" ||
    o.includes("u.s. house") || o.includes("us house") ||
    o.includes("u.s. representative") || o.includes("us representative") ||
    o === "representative in congress" ||
    o.includes("representative in congress") ||
    o === "member of congress" ||
    o.includes("congress") && !o.includes("senate")
  );
}

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

type DistrictAggregate = {
  candidate: string;
  party: string;
  votes: number;
  district: string;
  winner: boolean;
  writeIn: boolean;
};

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
      headers.forEach((h, idx) => { row[h] = (vals[idx] || "").replace(/"/g, ""); });

      const office = row["office"] || "";
      if (!classifyAsCongressional(office)) continue;

      const district = (row["district"] || "").replace(/^0+/, "") || "0";
      const candidate = row["candidate"] || "";
      if (!candidate || candidate === "Total") continue;

      const votes = parseInt(row["votes"] || "0") || 0;
      const party = row["party"] || "";
      const winner = (row["winner"] || "").toLowerCase() === "true";
      const writeIn = (row["write_in"] || row["writein"] || "").toLowerCase() === "true";

      const key = `${district}-${candidate}`;
      const existing = districtResults.get(key);
      if (existing) {
        existing.votes += votes;
        if (winner) existing.winner = true;
      } else {
        districtResults.set(key, { candidate, party, votes, district, winner, writeIn });
      }
      processedRows++;
    }
  }

  // Process remaining buffer
  if (buffer.trim() && headers) {
    const vals = splitCSVLine(buffer.trim());
    if (vals.length >= headers.length - 2) {
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = (vals[idx] || "").replace(/"/g, ""); });
      const office = row["office"] || "";
      if (classifyAsCongressional(office)) {
        const district = (row["district"] || "").replace(/^0+/, "") || "0";
        const candidate = row["candidate"] || "";
        if (candidate && candidate !== "Total") {
          const votes = parseInt(row["votes"] || "0") || 0;
          const party = row["party"] || "";
          const winner = (row["winner"] || "").toLowerCase() === "true";
          const writeIn = (row["write_in"] || row["writein"] || "").toLowerCase() === "true";
          const key = `${district}-${candidate}`;
          const existing = districtResults.get(key);
          if (existing) {
            existing.votes += votes;
            if (winner) existing.winner = true;
          } else {
            districtResults.set(key, { candidate, party, votes, district, winner, writeIn });
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

  const headers: Record<string, string> = { "User-Agent": "ORDB-Election-Sync" };
  if (githubToken) headers["Authorization"] = `token ${githubToken}`;

  let response: Response | null = null;
  let usedBranch = "master";
  for (const branch of ["master", "main"]) {
    const repoUrl = `https://api.github.com/repos/openelections/openelections-data-${stateLower}/git/trees/${branch}?recursive=1`;
    try {
      const r = await fetch(repoUrl, { headers });
      if (r.ok) {
        response = r;
        usedBranch = branch;
        break;
      }
    } catch (e) {
      console.error(`Failed to fetch repo tree for ${stateAbbr} (${branch}): ${e}`);
    }
  }

  if (!response) return { files: [], branch: "master" };

  const data = await response.json();
  if (!data.tree) return { files: [], branch: usedBranch };

  // Look for files with congressional/US House results
  const dedicatedFiles: string[] = [];
  const combinedFiles: string[] = [];

  for (const item of data.tree) {
    if (item.type !== "blob") continue;
    const path = item.path as string;
    if (!path.endsWith(".csv")) continue;
    const lower = path.toLowerCase();
    if (!lower.includes("general")) continue;

    // Dedicated congressional files
    if (
      lower.includes("us_house") || lower.includes("u.s._house") ||
      lower.includes("congress") || lower.includes("us_rep")
    ) {
      if (!lower.includes("precinct")) {
        dedicatedFiles.push(path);
      }
      continue;
    }

    // Combined files that contain all offices
    if (lower.includes("__county.csv") || lower.match(/__general\.csv$/)) {
      combinedFiles.push(path);
    }
  }

  let files = dedicatedFiles.length > 0 ? dedicatedFiles : combinedFiles;
  files.sort().reverse();
  return { files: files.slice(0, 5), branch: usedBranch };
}

function extractElectionDate(filename: string): { date: string; year: number } | null {
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

    if (!stateFilter) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Please specify a state parameter, e.g. ?state=CA",
          all_states: Object.keys(STATE_ABBREV_TO_LOWER),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`Processing congressional election results for ${stateFilter}`);

    const { files, branch } = await fetchElectionFilesFromGitHub(stateFilter, githubToken);
    console.log(`Found ${files.length} election files for ${stateFilter} (${branch})`);

    if (files.length === 0) {
      return new Response(
        JSON.stringify({ success: true, state: stateFilter, upserted: 0, files_found: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const filesToProcess = files.slice(0, 3);
    let totalUpserted = 0;
    let totalErrors = 0;
    const skippedFiles: Array<{ file: string; reason: string }> = [];

    for (const file of filesToProcess) {
      const electionInfo = extractElectionDate(file);
      if (!electionInfo) {
        skippedFiles.push({ file, reason: "Could not parse election date" });
        continue;
      }

      const stateLower = STATE_ABBREV_TO_LOWER[stateFilter];
      const rawUrl = `https://raw.githubusercontent.com/openelections/openelections-data-${stateLower}/${branch}/${file}`;
      const fetchHeaders: Record<string, string> = { "User-Agent": "ORDB-Election-Sync" };
      if (githubToken) fetchHeaders["Authorization"] = `token ${githubToken}`;

      let csvResponse: Response;
      try {
        csvResponse = await fetch(rawUrl, { headers: fetchHeaders });
        if (!csvResponse.ok) {
          skippedFiles.push({ file, reason: `Fetch failed: ${csvResponse.status}` });
          continue;
        }
        const contentLength = Number(csvResponse.headers.get("content-length") || "0");
        if (contentLength > 6_000_000) {
          skippedFiles.push({ file, reason: "File too large (>6MB)" });
          continue;
        }
      } catch (e) {
        skippedFiles.push({ file, reason: `Fetch error: ${e}` });
        continue;
      }

      const { districtResults, processedRows } = await processCSVResponse(csvResponse);
      console.log(`${file}: ${processedRows} rows, ${districtResults.size} candidates`);

      if (districtResults.size === 0) {
        skippedFiles.push({ file, reason: "No congressional races found" });
        continue;
      }

      // Calculate totals per district
      const districtTotals = new Map<string, number>();
      const districtTopVotes = new Map<string, number>();
      for (const [, result] of districtResults) {
        districtTotals.set(result.district, (districtTotals.get(result.district) || 0) + result.votes);
        const current = districtTopVotes.get(result.district) || 0;
        if (result.votes > current) districtTopVotes.set(result.district, result.votes);
      }

      const records: Array<Record<string, unknown>> = [];
      for (const [, result] of districtResults) {
        const totalVotes = districtTotals.get(result.district) || 0;
        const votePct = totalVotes > 0 ? Math.round((result.votes / totalVotes) * 1000) / 10 : null;
        const isWinner = result.winner || (result.votes > 0 && result.votes === districtTopVotes.get(result.district));

        records.push({
          state_abbr: stateFilter,
          district_number: result.district,
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

      for (let i = 0; i < records.length; i += 100) {
        const chunk = records.slice(i, i + 100);
        const { error } = await supabase
          .from("congressional_election_results")
          .upsert(chunk, {
            onConflict: "state_abbr,district_number,election_year,election_type,candidate_name",
          });
        if (error) {
          console.error(`Upsert error: ${error.message}`);
          totalErrors += chunk.length;
        } else {
          totalUpserted += chunk.length;
        }
      }
    }

    for (const file of files.slice(3)) {
      skippedFiles.push({ file, reason: "Exceeded per-invocation file limit (max 3)" });
    }

    console.log(`${stateFilter}: ${totalUpserted} congressional results upserted`);

    return new Response(
      JSON.stringify({
        success: true,
        state: stateFilter,
        upserted: totalUpserted,
        errors: totalErrors,
        files_processed: filesToProcess.length,
        files_found: files.length,
        skipped_files: skippedFiles,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Congressional election sync error:", error);
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
