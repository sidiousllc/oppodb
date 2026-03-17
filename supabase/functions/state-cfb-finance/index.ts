// State Campaign Finance - serves cached data from DB, triggers sync for PA and MI

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { unzipSync } from "https://esm.sh/fflate@0.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPPORTED_STATES: Record<string, { name: string; source: string; source_url: string }> = {
  PA: {
    name: "Pennsylvania",
    source: "PA Department of State",
    source_url: "https://www.pa.gov/agencies/dos/resources/voting-and-elections-resources/campaign-finance-data",
  },
  MI: {
    name: "Michigan",
    source: "MI Secretary of State (CFR)",
    source_url: "https://miboecfr.nictusa.com/cfr/dumpall/cfrdetail/",
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const stateParam = (url.searchParams.get("state") || "").toUpperCase();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // List supported states
    if (action === "list") {
      return new Response(
        JSON.stringify({ success: true, states: Object.entries(SUPPORTED_STATES).map(([abbr, s]) => ({ state_abbr: abbr, ...s })) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sync: trigger background data import for a specific state
    if (action === "sync") {
      if (!stateParam || !SUPPORTED_STATES[stateParam]) {
        return new Response(
          JSON.stringify({ success: false, error: `Unsupported state. Supported: ${Object.keys(SUPPORTED_STATES).join(", ")}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      EdgeRuntime.waitUntil(syncStateData(supabase, stateParam));
      return new Response(
        JSON.stringify({ success: true, message: `${stateParam} sync started in background` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default: serve cached data from DB
    if (!stateParam || !SUPPORTED_STATES[stateParam]) {
      // If no state specified, return all states' data
      const allState = stateParam || undefined;
      let query = supabase
        .from("state_cfb_candidates")
        .select("*")
        .order("total_contributions", { ascending: false })
        .limit(500);

      if (allState) query = query.eq("state_abbr", allState);

      const chamber = url.searchParams.get("chamber") || "all";
      const search = (url.searchParams.get("search") || "").toLowerCase();
      if (chamber !== "all") query = query.eq("chamber", chamber);
      if (search) query = query.or(`candidate_name.ilike.%${search}%,committee_name.ilike.%${search}%`);

      const { data: candidates, error: dbError } = await query;
      if (dbError) throw new Error(dbError.message);

      return new Response(
        JSON.stringify({
          success: true,
          supported_states: Object.keys(SUPPORTED_STATES),
          candidates: candidates || [],
          cached: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // State-specific query
    const chamber = url.searchParams.get("chamber") || "all";
    const search = (url.searchParams.get("search") || "").toLowerCase();

    let query = supabase
      .from("state_cfb_candidates")
      .select("*")
      .eq("state_abbr", stateParam)
      .order("total_contributions", { ascending: false })
      .limit(500);

    if (chamber !== "all") query = query.eq("chamber", chamber);
    if (search) query = query.or(`candidate_name.ilike.%${search}%,committee_name.ilike.%${search}%`);

    const { data: candidates, error: dbError } = await query;
    if (dbError) throw new Error(dbError.message);

    const results = candidates || [];
    const totalRaised = results.reduce((s: number, r: any) => s + Number(r.total_contributions), 0);
    const totalSpent = results.reduce((s: number, r: any) => s + Number(r.total_expenditures), 0);

    const stateInfo = SUPPORTED_STATES[stateParam];

    return new Response(
      JSON.stringify({
        success: true,
        state: stateParam,
        source: stateInfo.source,
        source_url: stateInfo.source_url,
        filters: { chamber, search: search || null },
        summary: {
          total_raised: Math.round(totalRaised * 100) / 100,
          total_spent: Math.round(totalSpent * 100) / 100,
          candidate_count: results.length,
        },
        candidates: results,
        cached: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("State CFB finance error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── CSV parsing ────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = false; }
      } else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { fields.push(current.trim()); current = ""; }
      else { current += ch; }
    }
  }
  fields.push(current.trim());
  return fields;
}

// ─── Shared aggregation types ───────────────────────────────────────────────

interface CandidateAgg {
  name: string;
  committee_name: string;
  reg_num: string;
  chamber: string;
  office: string;
  party: string;
  total_contributions: number;
  total_expenditures: number;
  contribution_count: number;
  expenditure_count: number;
  top_contributors: Record<string, number>;
  expenditure_types: Record<string, number>;
  top_vendors: Record<string, number>;
  years_active: Set<string>;
  in_kind_total: number;
  yearly: Map<string, { contributions: number; expenditures: number; contribution_count: number; expenditure_count: number }>;
}

function topN(map: Record<string, number>, n: number): Array<{ name: string; amount: number }> {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }));
}

// ─── ZIP fetch helper ───────────────────────────────────────────────────────

async function fetchAndUnzip(url: string): Promise<Record<string, string>> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
  const buf = new Uint8Array(await resp.arrayBuffer());
  const files = unzipSync(buf);
  const result: Record<string, string> = {};
  for (const [name, data] of Object.entries(files)) {
    result[name] = new TextDecoder().decode(data as Uint8Array);
  }
  return result;
}

// ─── State-specific sync dispatchers ────────────────────────────────────────

async function syncStateData(supabase: any, state: string) {
  console.log(`State CFB sync: starting ${state}`);
  try {
    if (state === "PA") await syncPA(supabase);
    else if (state === "MI") await syncMI(supabase);
    console.log(`State CFB sync: ${state} complete`);
  } catch (err) {
    console.error(`State CFB sync ${state} error:`, err);
  }
}

// ─── Pennsylvania sync ──────────────────────────────────────────────────────

async function syncPA(supabase: any) {
  const candidates = new Map<string, CandidateAgg>();

  // Process recent years only to stay within memory limits
  for (const year of ["2026", "2025", "2024"]) {
    const zipUrl = year === "2025"
      ? `https://www.pa.gov/content/dam/copapwp-pagov/en/dos/resources/voting-and-elections/campaign-finance/campaign-finance-data/2025%20campaign%20finance%20full%20export%20.zip`
      : `https://www.pa.gov/content/dam/copapwp-pagov/en/dos/resources/voting-and-elections/campaign-finance/campaign-finance-data/${year}.zip`;

    let files: Record<string, string>;
    try {
      files = await fetchAndUnzip(zipUrl);
    } catch (e) {
      console.log(`PA: skipping ${year} - ${(e as Error).message}`);
      continue;
    }

    // Find filer, contribution, and expense files
    const filerFile = Object.keys(files).find(f => f.toLowerCase().includes("filer"));
    const contribFile = Object.keys(files).find(f => f.toLowerCase().includes("contrib"));
    const expenseFile = Object.keys(files).find(f => f.toLowerCase().includes("expense") || f.toLowerCase().includes("expend"));

    // Parse filer data for committee info
    const filerMap = new Map<string, { name: string; office: string; district: string; party: string }>();
    if (filerFile && files[filerFile]) {
      const lines = files[filerFile].split("\n");
      const headers = parseCSVLine(lines[0]);
      const idIdx = headers.findIndex(h => h.toUpperCase() === "FILERID");
      const nameIdx = headers.findIndex(h => h.toUpperCase() === "FILERNAME");
      const officeIdx = headers.findIndex(h => h.toUpperCase() === "OFFICE");
      const distIdx = headers.findIndex(h => h.toUpperCase() === "DISTRICT");
      const partyIdx = headers.findIndex(h => h.toUpperCase() === "PARTY");

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const vals = parseCSVLine(line);
        const fid = vals[idIdx] || "";
        if (fid) {
          filerMap.set(fid, {
            name: vals[nameIdx] || "",
            office: vals[officeIdx] || "",
            district: vals[distIdx] || "",
            party: vals[partyIdx] || "",
          });
        }
      }
    }

    // Parse contributions
    if (contribFile && files[contribFile]) {
      const lines = files[contribFile].split("\n");
      const headers = parseCSVLine(lines[0]);
      const fidIdx = headers.findIndex(h => h.toUpperCase() === "FILERID");
      const contribIdx = headers.findIndex(h => h.toUpperCase() === "CONTRIBUTOR");
      // PA has up to 3 contribution date/amount pairs per row
      const amt1Idx = headers.findIndex(h => h.toUpperCase() === "CONTAMT1");
      const amt2Idx = headers.findIndex(h => h.toUpperCase() === "CONTAMT2");
      const amt3Idx = headers.findIndex(h => h.toUpperCase() === "CONTAMT3");

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const vals = parseCSVLine(line);
        const fid = vals[fidIdx] || "";
        if (!fid) continue;

        const filerInfo = filerMap.get(fid);
        if (!candidates.has(fid)) {
          candidates.set(fid, {
            name: filerInfo?.name || fid,
            committee_name: filerInfo?.name || fid,
            reg_num: fid,
            chamber: detectPAChamber(filerInfo?.office || ""),
            office: filerInfo?.office || "",
            party: filerInfo?.party || "",
            total_contributions: 0, total_expenditures: 0,
            contribution_count: 0, expenditure_count: 0,
            top_contributors: {}, expenditure_types: {},
            top_vendors: {}, years_active: new Set(), in_kind_total: 0,
          });
        }

        const c = candidates.get(fid)!;
        c.years_active.add(year);
        const contributor = vals[contribIdx] || "";

        for (const idx of [amt1Idx, amt2Idx, amt3Idx]) {
          if (idx < 0) continue;
          const amt = parseFloat(vals[idx] || "0");
          if (amt === 0) continue;
          c.total_contributions += amt;
          c.contribution_count++;
          if (contributor) c.top_contributors[contributor] = (c.top_contributors[contributor] || 0) + amt;
        }
      }
    }

    // Parse expenses
    if (expenseFile && files[expenseFile]) {
      const lines = files[expenseFile].split("\n");
      const headers = parseCSVLine(lines[0]);
      const fidIdx = headers.findIndex(h => h.toUpperCase() === "FILERID");
      const vendorIdx = headers.findIndex(h => h.toUpperCase() === "EXPNAME");
      const amtIdx = headers.findIndex(h => h.toUpperCase() === "EXPAMT");
      const descIdx = headers.findIndex(h => h.toUpperCase() === "EXPDESC");

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const vals = parseCSVLine(line);
        const fid = vals[fidIdx] || "";
        if (!fid) continue;

        const filerInfo = filerMap.get(fid);
        if (!candidates.has(fid)) {
          candidates.set(fid, {
            name: filerInfo?.name || fid,
            committee_name: filerInfo?.name || fid,
            reg_num: fid,
            chamber: detectPAChamber(filerInfo?.office || ""),
            office: filerInfo?.office || "",
            party: filerInfo?.party || "",
            total_contributions: 0, total_expenditures: 0,
            contribution_count: 0, expenditure_count: 0,
            top_contributors: {}, expenditure_types: {},
            top_vendors: {}, years_active: new Set(), in_kind_total: 0,
          });
        }

        const c = candidates.get(fid)!;
        c.years_active.add(year);
        const amt = parseFloat(vals[amtIdx] || "0");
        const vendor = vals[vendorIdx] || "";
        const desc = vals[descIdx] || "";

        c.total_expenditures += amt;
        c.expenditure_count++;
        if (vendor) c.top_vendors[vendor] = (c.top_vendors[vendor] || 0) + amt;
        if (desc) c.expenditure_types[desc] = (c.expenditure_types[desc] || 0) + amt;
      }
    }

    // Free memory between years
    console.log(`PA: processed ${year}, ${candidates.size} candidates so far`);
  }

  await upsertCandidates(supabase, "PA", candidates);
}

function detectPAChamber(office: string): string {
  const lower = office.toLowerCase();
  if (lower.includes("house") || lower.includes("representative") || lower.includes("rep")) return "house";
  if (lower.includes("senate") || lower.includes("senator") || lower.includes("sen")) return "senate";
  if (lower.includes("governor") || lower.includes("gov")) return "governor";
  return "other";
}

// ─── Michigan sync ──────────────────────────────────────────────────────────

async function syncMI(supabase: any) {
  const candidates = new Map<string, CandidateAgg>();

  // Process recent years
  for (const year of ["2024", "2023", "2022"]) {
    // Contributions
    const contribUrl = `https://miboecfr.nictusa.com/cfr/dumpall/cfrdetail/${year}_mi_cfr_contributions.zip`;
    try {
      const files = await fetchAndUnzip(contribUrl);
      const csvFile = Object.keys(files).find(f => f.toLowerCase().endsWith(".csv") || f.toLowerCase().endsWith(".txt")) || Object.keys(files)[0];
      if (csvFile && files[csvFile]) {
        const lines = files[csvFile].split("\n");
        const headers = parseCSVLine(lines[0]);
        // MI CFR fields: doc_id, committee_id, committee_name, contriib_type, first_name, last_name, amount, etc.
        const cidIdx = headers.findIndex(h => h.toLowerCase().includes("committee_id") || h.toLowerCase().includes("com_id"));
        const cnameIdx = headers.findIndex(h => h.toLowerCase().includes("committee_name") || h.toLowerCase().includes("com_legal_name"));
        const amtIdx = headers.findIndex(h => h.toLowerCase().includes("amount"));
        const fnameIdx = headers.findIndex(h => h.toLowerCase().includes("first_name") || h.toLowerCase().includes("f_name"));
        const lnameIdx = headers.findIndex(h => h.toLowerCase().includes("last_name") || h.toLowerCase().includes("l_name"));
        const ctypeIdx = headers.findIndex(h => h.toLowerCase().includes("contri") && h.toLowerCase().includes("type"));

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const vals = parseCSVLine(line);
          const cid = vals[cidIdx] || "";
          if (!cid) continue;

          if (!candidates.has(cid)) {
            candidates.set(cid, {
              name: vals[cnameIdx] || cid,
              committee_name: vals[cnameIdx] || cid,
              reg_num: cid,
              chamber: "other",
              office: "", party: "",
              total_contributions: 0, total_expenditures: 0,
              contribution_count: 0, expenditure_count: 0,
              top_contributors: {}, expenditure_types: {},
              top_vendors: {}, years_active: new Set(), in_kind_total: 0,
            });
          }

          const c = candidates.get(cid)!;
          c.years_active.add(year);
          const amt = parseFloat(vals[amtIdx] || "0");
          c.total_contributions += amt;
          c.contribution_count++;
          const contribName = [vals[fnameIdx], vals[lnameIdx]].filter(Boolean).join(" ").trim();
          if (contribName) c.top_contributors[contribName] = (c.top_contributors[contribName] || 0) + amt;
        }
      }
    } catch (e) {
      console.log(`MI: skipping contributions ${year} - ${(e as Error).message}`);
    }

    // Expenditures
    const expendUrl = `https://miboecfr.nictusa.com/cfr/dumpall/cfrdetail/${year}_mi_cfr_expenditures.zip`;
    try {
      const files = await fetchAndUnzip(expendUrl);
      const csvFile = Object.keys(files).find(f => f.toLowerCase().endsWith(".csv") || f.toLowerCase().endsWith(".txt")) || Object.keys(files)[0];
      if (csvFile && files[csvFile]) {
        const lines = files[csvFile].split("\n");
        const headers = parseCSVLine(lines[0]);
        const cidIdx = headers.findIndex(h => h.toLowerCase().includes("committee_id") || h.toLowerCase().includes("com_id"));
        const cnameIdx = headers.findIndex(h => h.toLowerCase().includes("committee_name") || h.toLowerCase().includes("com_legal_name"));
        const amtIdx = headers.findIndex(h => h.toLowerCase().includes("amount"));
        const vendorIdx = headers.findIndex(h => h.toLowerCase().includes("l_name") || h.toLowerCase().includes("last_name"));
        const typeIdx = headers.findIndex(h => h.toLowerCase().includes("exp_type") || h.toLowerCase().includes("type"));

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const vals = parseCSVLine(line);
          const cid = vals[cidIdx] || "";
          if (!cid) continue;

          if (!candidates.has(cid)) {
            candidates.set(cid, {
              name: vals[cnameIdx] || cid,
              committee_name: vals[cnameIdx] || cid,
              reg_num: cid,
              chamber: "other",
              office: "", party: "",
              total_contributions: 0, total_expenditures: 0,
              contribution_count: 0, expenditure_count: 0,
              top_contributors: {}, expenditure_types: {},
              top_vendors: {}, years_active: new Set(), in_kind_total: 0,
            });
          }

          const c = candidates.get(cid)!;
          c.years_active.add(year);
          const amt = parseFloat(vals[amtIdx] || "0");
          c.total_expenditures += amt;
          c.expenditure_count++;
          const vendor = vals[vendorIdx] || "";
          const type = vals[typeIdx] || "";
          if (vendor) c.top_vendors[vendor] = (c.top_vendors[vendor] || 0) + amt;
          if (type) c.expenditure_types[type] = (c.expenditure_types[type] || 0) + amt;
        }
      }
    } catch (e) {
      console.log(`MI: skipping expenditures ${year} - ${(e as Error).message}`);
    }

    console.log(`MI: processed ${year}, ${candidates.size} candidates so far`);
  }

  await upsertCandidates(supabase, "MI", candidates);
}

// ─── Shared upsert logic ────────────────────────────────────────────────────

async function upsertCandidates(supabase: any, state: string, candidates: Map<string, CandidateAgg>) {
  const batch: any[] = [];
  for (const c of candidates.values()) {
    batch.push({
      state_abbr: state,
      reg_num: c.reg_num,
      committee_name: c.committee_name,
      candidate_name: c.name,
      chamber: c.chamber,
      office: c.office || null,
      party: c.party || null,
      total_contributions: Math.round(c.total_contributions * 100) / 100,
      total_expenditures: Math.round(c.total_expenditures * 100) / 100,
      net_cash: Math.round((c.total_contributions - c.total_expenditures) * 100) / 100,
      contribution_count: c.contribution_count,
      expenditure_count: c.expenditure_count,
      in_kind_total: Math.round(c.in_kind_total * 100) / 100,
      years_active: Array.from(c.years_active).sort().reverse(),
      top_contributors: topN(c.top_contributors, 15),
      expenditure_types: topN(c.expenditure_types, 10),
      top_vendors: topN(c.top_vendors, 15),
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (batch.length >= 50) {
      const { error } = await supabase.from("state_cfb_candidates").upsert(batch, { onConflict: "state_abbr,reg_num" });
      if (error) console.error(`${state} upsert error:`, error.message);
      batch.length = 0;
    }
  }

  if (batch.length > 0) {
    const { error } = await supabase.from("state_cfb_candidates").upsert(batch, { onConflict: "state_abbr,reg_num" });
    if (error) console.error(`${state} upsert error:`, error.message);
  }

  console.log(`${state}: upserted ${candidates.size} candidates`);
}
