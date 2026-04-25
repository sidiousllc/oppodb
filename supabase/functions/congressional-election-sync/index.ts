import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const TRUSTED_ORIGINS = [
  "https://oppodb.com", "https://db.oppodb.com", "https://ordb.lovable.app",
  "https://id-preview--4f0f9990-c3c0-4e04-9ceb-2c41704d227e.lovable.app",
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

  const dedicatedFiles: string[] = [];
  const combinedFiles: string[] = [];

  for (const item of data.tree) {
    if (item.type !== "blob") continue;
    const path = item.path as string;
    if (!path.endsWith(".csv")) continue;
    const lower = path.toLowerCase();
    if (!lower.includes("general")) continue;

    if (
      lower.includes("us_house") || lower.includes("u.s._house") ||
      lower.includes("congress") || lower.includes("us_rep")
    ) {
      if (!lower.includes("precinct")) {
        dedicatedFiles.push(path);
      }
      continue;
    }

    if (lower.includes("__county.csv") || lower.match(/__general\.csv$/)) {
      combinedFiles.push(path);
    }
  }

  let files = dedicatedFiles.length > 0 ? dedicatedFiles : combinedFiles;
  files.sort().reverse();
  return { files, branch: usedBranch };
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

// ─── MIT Election Lab fallback ──────────────────────────────────────────────

function parseFullCSV(text: string): Record<string, string>[] {
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

async function syncFromMITElectionLab(
  stateAbbr: string,
  // deno-lint-ignore no-explicit-any
  supabase: any,
  minYear = 2000,
): Promise<{ synced: number; errors: number }> {
  console.log(`[MIT fallback] Downloading House dataset for ${stateAbbr}...`);

  // Harvard Dataverse file ID for US House 1976–2024
  const fileId = 13592823;
  const downloadUrl = `https://dataverse.harvard.edu/api/access/datafile/${fileId}`;

  let resp: Response;
  try {
    resp = await fetch(downloadUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  } catch (e) {
    console.error(`[MIT fallback] Download failed: ${e}`);
    return { synced: 0, errors: 1 };
  }

  const text = await resp.text();
  const allRows = parseFullCSV(text);
  console.log(`[MIT fallback] Parsed ${allRows.length} total rows`);

  const filtered = allRows.filter((r) => {
    const year = parseInt(r.year);
    if (isNaN(year) || year < minYear) return false;
    if (r.state_po !== stateAbbr) return false;
    const stage = r.stage || "gen";
    return stage === "gen";
  });

  console.log(`[MIT fallback] ${filtered.length} rows for ${stateAbbr} (year >= ${minYear})`);
  if (filtered.length === 0) return { synced: 0, errors: 0 };

  let totalSynced = 0;
  let totalErrors = 0;
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

    const { error } = await supabase
      .from("congressional_election_results")
      .upsert(batch, {
        onConflict: "state_abbr,district_number,election_year,election_type,candidate_name",
      });

    if (error) {
      console.error(`[MIT fallback] Batch error at ${i}: ${error.message}`);
      totalErrors++;
    } else {
      totalSynced += batch.length;
    }
  }

  return { synced: totalSynced, errors: totalErrors };
}

// ─── BallotpediaCSV via DailyKos / Wikipedia tables fallback ────────────────
// Uses the FEC results API as an additional source for recent cycles

async function syncFromFEC(
  stateAbbr: string,
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<{ synced: number; errors: number }> {
  console.log(`[FEC fallback] Fetching House results for ${stateAbbr}...`);

  let totalSynced = 0;
  let totalErrors = 0;

  // FEC results API - cycles from 2012 to 2024
  for (const cycle of [2024, 2022, 2020, 2018, 2016, 2014, 2012]) {
    try {
      const fecUrl = `https://api.open.fec.gov/v1/elections/results/?api_key=DEMO_KEY&state=${stateAbbr}&office=house&cycle=${cycle}&per_page=100&sort_null_only=false&sort_hide_null=false`;
      const resp = await fetch(fecUrl);
      if (!resp.ok) {
        console.warn(`[FEC] ${stateAbbr} cycle ${cycle}: HTTP ${resp.status}`);
        continue;
      }

      const json = await resp.json();
      const results = json.results || [];
      if (results.length === 0) continue;

      const records: Array<Record<string, unknown>> = [];
      for (const r of results) {
        const districtNum = r.district_number?.toString() || "0";
        const district = districtNum === "0" ? "AL" : districtNum;
        const totalVotes = r.total_votes || 0;
        const votes = r.candidate_votes || 0;

        records.push({
          state_abbr: stateAbbr,
          district_number: district,
          election_year: cycle,
          election_type: "general",
          candidate_name: r.candidate_name || r.candidate || "Unknown",
          party: r.party || null,
          votes: votes || null,
          vote_pct: totalVotes > 0 ? Math.round((votes / totalVotes) * 1000) / 10 : null,
          is_winner: r.won === true,
          is_write_in: false,
          total_votes: totalVotes || null,
          source: "fec",
          updated_at: new Date().toISOString(),
        });
      }

      if (records.length > 0) {
        const { error } = await supabase
          .from("congressional_election_results")
          .upsert(records, {
            onConflict: "state_abbr,district_number,election_year,election_type,candidate_name",
          });

        if (error) {
          console.error(`[FEC] ${stateAbbr} ${cycle} upsert error: ${error.message}`);
          totalErrors++;
        } else {
          totalSynced += records.length;
        }
      }
    } catch (e) {
      console.error(`[FEC] ${stateAbbr} ${cycle} error: ${e}`);
      totalErrors++;
    }
  }

  return { synced: totalSynced, errors: totalErrors };
}

// ─── Main handler ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: roleCheck } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const githubToken = Deno.env.get("GITHUB_TOKEN") || undefined;
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

    // ── Source 1: OpenElections (GitHub CSVs) ──────────────────────────────
    const { files, branch } = await fetchElectionFilesFromGitHub(stateFilter, githubToken);
    console.log(`Found ${files.length} OpenElections files for ${stateFilter} (${branch})`);

    let totalUpserted = 0;
    let totalErrors = 0;
    const skippedFiles: Array<{ file: string; reason: string }> = [];
    const sources: string[] = [];

    if (files.length > 0) {
      sources.push("openelections");
      const filesToProcess = files; // process ALL historical files

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

      // (no overflow — all files processed)
    }

    // ── Source 2: MIT Election Lab (Harvard Dataverse) ─────────────────────
    // Always try MIT as it has comprehensive data 1976–2024 for all 50 states
    try {
      sources.push("mit_election_lab");
      const mit = await syncFromMITElectionLab(stateFilter, supabase);
      totalUpserted += mit.synced;
      totalErrors += mit.errors;
      console.log(`[MIT] ${stateFilter}: ${mit.synced} synced, ${mit.errors} errors`);
    } catch (e) {
      console.error(`[MIT] ${stateFilter} fallback failed: ${e}`);
    }

    // ── Source 3: FEC API (recent cycles 2012–2024) ───────────────────────
    try {
      sources.push("fec");
      const fec = await syncFromFEC(stateFilter, supabase);
      totalUpserted += fec.synced;
      totalErrors += fec.errors;
      console.log(`[FEC] ${stateFilter}: ${fec.synced} synced, ${fec.errors} errors`);
    } catch (e) {
      console.error(`[FEC] ${stateFilter} fallback failed: ${e}`);
    }

    console.log(`${stateFilter}: ${totalUpserted} total congressional results upserted from [${sources.join(", ")}]`);

    return new Response(
      JSON.stringify({
        success: true,
        state: stateFilter,
        upserted: totalUpserted,
        errors: totalErrors,
        sources,
        files_processed: files.length > 0 ? Math.min(files.length, 3) : 0,
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
        headers: { ...getCorsHeaders(req.headers.get("Origin")), "Content-Type": "application/json" },
      },
    );
  }
});
