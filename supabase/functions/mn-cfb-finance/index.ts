// MN Campaign Finance Board - serves cached data from DB, triggers sync

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Sync: trigger background data import
    if (action === "sync") {
      EdgeRuntime.waitUntil(syncMNCFBData(supabase));
      return new Response(
        JSON.stringify({ success: true, message: "Sync started in background" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Yearly breakdown for a single candidate (lightweight)
    if (action === "yearly") {
      const regNum = url.searchParams.get("reg_num") || "";
      if (!regNum) throw new Error("reg_num required");
      const yearly = await fetchYearlyForCandidate(regNum);
      return new Response(
        JSON.stringify({ success: true, yearly_breakdown: yearly }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default: serve cached data from DB
    const chamber = url.searchParams.get("chamber") || "all";
    const search = (url.searchParams.get("search") || "").toLowerCase();

    let query = supabase
      .from("mn_cfb_candidates")
      .select("*")
      .order("total_contributions", { ascending: false })
      .limit(500);

    if (chamber !== "all") query = query.eq("chamber", chamber);
    if (search) query = query.or(`candidate_name.ilike.%${search}%,committee_name.ilike.%${search}%`);

    const { data: candidates, error: dbError } = await query;
    if (dbError) throw new Error(dbError.message);

    const results = (candidates || []).map((c: any) => ({
      committee_name: c.committee_name,
      candidate_name: c.candidate_name,
      reg_num: c.reg_num,
      chamber: c.chamber,
      total_contributions: Number(c.total_contributions),
      total_expenditures: Number(c.total_expenditures),
      net_cash: Number(c.net_cash),
      contribution_count: c.contribution_count,
      expenditure_count: c.expenditure_count,
      in_kind_total: Number(c.in_kind_total),
      years_active: c.years_active || [],
      yearly_breakdown: c.yearly_breakdown || [],
      top_contributors: c.top_contributors || [],
      contributor_types: c.contributor_types || [],
      expenditure_types: c.expenditure_types || [],
      top_vendors: c.top_vendors || [],
    }));

    const totalRaised = results.reduce((s: number, r: any) => s + r.total_contributions, 0);
    const totalSpent = results.reduce((s: number, r: any) => s + r.total_expenditures, 0);

    return new Response(
      JSON.stringify({
        success: true,
        state: "MN",
        source: "Minnesota Campaign Finance Board",
        source_url: "https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/",
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
    console.error("MN CFB finance error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Yearly breakdown on-demand (lightweight: fetches CSVs, filters to single candidate) ───

const CONTRIB_CANDIDATES_URL =
  "https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/?download=-2026985457";
const EXPEND_CANDIDATES_URL =
  "https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/?download=-1315784544";

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

async function fetchYearlyForCandidate(regNum: string): Promise<Array<{ year: string; contributions: number; expenditures: number; contribution_count: number; expenditure_count: number }>> {
  const yearly = new Map<string, { contributions: number; expenditures: number; contribution_count: number; expenditure_count: number }>();

  // Fetch contributions CSV and filter to this candidate only
  const contribResp = await fetch(CONTRIB_CANDIDATES_URL);
  if (contribResp.ok) {
    const text = await contribResp.text();
    const lines = text.split("\n");
    const headers = parseCSVLine(lines[0]);
    const regIdx = headers.indexOf("Recipient reg num");
    const amtIdx = headers.indexOf("Amount");
    const yearIdx = headers.indexOf("Year");

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = parseCSVLine(line);
      if (values[regIdx] !== regNum) continue;
      const year = values[yearIdx] || "";
      const amount = parseFloat(values[amtIdx] || "0");
      if (!yearly.has(year)) yearly.set(year, { contributions: 0, expenditures: 0, contribution_count: 0, expenditure_count: 0 });
      const yd = yearly.get(year)!;
      yd.contributions += amount;
      yd.contribution_count++;
    }
  }

  // Fetch expenditures CSV
  const expendResp = await fetch(EXPEND_CANDIDATES_URL);
  if (expendResp.ok) {
    const text = await expendResp.text();
    const lines = text.split("\n");
    const headers = parseCSVLine(lines[0]);
    const regIdx = headers.indexOf("Committee reg num");
    const amtIdx = headers.indexOf("Amount");
    const yearIdx = headers.indexOf("Year");

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = parseCSVLine(line);
      if (values[regIdx] !== regNum) continue;
      const year = values[yearIdx] || "";
      const amount = parseFloat(values[amtIdx] || "0");
      if (!yearly.has(year)) yearly.set(year, { contributions: 0, expenditures: 0, contribution_count: 0, expenditure_count: 0 });
      const yd = yearly.get(year)!;
      yd.expenditures += amount;
      yd.expenditure_count++;
    }
  }

  return Array.from(yearly.entries())
    .map(([year, d]) => ({
      year,
      contributions: Math.round(d.contributions * 100) / 100,
      expenditures: Math.round(d.expenditures * 100) / 100,
      contribution_count: d.contribution_count,
      expenditure_count: d.expenditure_count,
    }))
    .sort((a, b) => a.year.localeCompare(b.year));
}

// ─── Background sync logic (no yearly - too CPU intensive) ──────────────────

interface CandidateAgg {
  name: string;
  reg_num: string;
  total_contributions: number;
  total_expenditures: number;
  contribution_count: number;
  expenditure_count: number;
  top_contributors: Record<string, number>;
  contributor_types: Record<string, number>;
  expenditure_types: Record<string, number>;
  top_vendors: Record<string, number>;
  years_active: Set<string>;
  in_kind_total: number;
}

function topN(map: Record<string, number>, n: number): Array<{ name: string; amount: number }> {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }));
}

function detectChamber(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("house committee")) return "house";
  if (lower.includes("senate committee")) return "senate";
  if (lower.includes("gov committee") || lower.includes("governor")) return "governor";
  return "other";
}

function extractCandidateName(committeeName: string): string {
  const cleaned = committeeName
    .replace(/\s*(House|Senate|Gov|Governor|Atty Gen|Sec of State|State Aud|Sup Court)\s*Committee\s*/i, "")
    .trim();
  const parts = cleaned.split(",").map((s) => s.trim());
  if (parts.length >= 2) return `${parts[1]} ${parts[0]}`;
  return cleaned;
}

async function syncMNCFBData(supabase: any) {
  console.log("MN CFB sync: starting background sync");
  try {
    const [contribResp, expendResp] = await Promise.all([
      fetch(CONTRIB_CANDIDATES_URL),
      fetch(EXPEND_CANDIDATES_URL),
    ]);

    if (!contribResp.ok || !expendResp.ok) {
      console.error(`MN CFB sync: fetch failed contrib=${contribResp.status} expend=${expendResp.status}`);
      return;
    }

    const candidates = new Map<string, CandidateAgg>();

    const contribText = await contribResp.text();
    const contribLines = contribText.split("\n");
    const contribHeaders = parseCSVLine(contribLines[0]);

    for (let i = 1; i < contribLines.length; i++) {
      const line = contribLines[i].trim();
      if (!line) continue;
      const values = parseCSVLine(line);
      const row: Record<string, string> = {};
      for (let j = 0; j < contribHeaders.length; j++) row[contribHeaders[j]] = values[j] || "";

      const regNum = row["Recipient reg num"] || "";
      const name = row["Recipient"] || "";
      const amount = parseFloat(row["Amount"] || "0");
      const year = row["Year"] || "";
      const contributor = row["Contributor"] || "";
      const contribType = row["Contrib type"] || "";
      const isInKind = row["In kind?"] === "Yes";

      if (!candidates.has(regNum)) {
        candidates.set(regNum, {
          name, reg_num: regNum,
          total_contributions: 0, total_expenditures: 0,
          contribution_count: 0, expenditure_count: 0,
          top_contributors: {}, contributor_types: {},
          expenditure_types: {}, top_vendors: {},
          years_active: new Set(), in_kind_total: 0,
        });
      }

      const c = candidates.get(regNum)!;
      c.total_contributions += amount;
      c.contribution_count++;
      c.years_active.add(year);
      if (isInKind) c.in_kind_total += amount;
      if (contributor) c.top_contributors[contributor] = (c.top_contributors[contributor] || 0) + amount;
      if (contribType) c.contributor_types[contribType] = (c.contributor_types[contribType] || 0) + amount;
    }

    // @ts-ignore - free memory
    contribLines.length = 0;
    console.log(`MN CFB sync: processed contributions for ${candidates.size} candidates`);

    const expendText = await expendResp.text();
    const expendLines = expendText.split("\n");
    const expendHeaders = parseCSVLine(expendLines[0]);

    for (let i = 1; i < expendLines.length; i++) {
      const line = expendLines[i].trim();
      if (!line) continue;
      const values = parseCSVLine(line);
      const row: Record<string, string> = {};
      for (let j = 0; j < expendHeaders.length; j++) row[expendHeaders[j]] = values[j] || "";

      const regNum = row["Committee reg num"] || "";
      const name = row["Committee name"] || "";
      const amount = parseFloat(row["Amount"] || "0");
      const year = row["Year"] || "";
      const vendor = row["Vendor name"] || "";
      const type = row["Type"] || "";

      if (!candidates.has(regNum)) {
        candidates.set(regNum, {
          name, reg_num: regNum,
          total_contributions: 0, total_expenditures: 0,
          contribution_count: 0, expenditure_count: 0,
          top_contributors: {}, contributor_types: {},
          expenditure_types: {}, top_vendors: {},
          years_active: new Set(), in_kind_total: 0,
        });
      }

      const c = candidates.get(regNum)!;
      c.total_expenditures += amount;
      c.expenditure_count++;
      c.years_active.add(year);
      if (vendor) c.top_vendors[vendor] = (c.top_vendors[vendor] || 0) + amount;
      if (type) c.expenditure_types[type] = (c.expenditure_types[type] || 0) + amount;
    }

    console.log(`MN CFB sync: processed expenditures, total ${candidates.size} candidates`);

    const batch: any[] = [];
    for (const c of candidates.values()) {
      batch.push({
        reg_num: c.reg_num,
        committee_name: c.name,
        candidate_name: extractCandidateName(c.name),
        chamber: detectChamber(c.name),
        total_contributions: Math.round(c.total_contributions * 100) / 100,
        total_expenditures: Math.round(c.total_expenditures * 100) / 100,
        net_cash: Math.round((c.total_contributions - c.total_expenditures) * 100) / 100,
        contribution_count: c.contribution_count,
        expenditure_count: c.expenditure_count,
        in_kind_total: Math.round(c.in_kind_total * 100) / 100,
        years_active: Array.from(c.years_active).sort().reverse(),
        top_contributors: topN(c.top_contributors, 15),
        contributor_types: topN(c.contributor_types, 10),
        expenditure_types: topN(c.expenditure_types, 10),
        top_vendors: topN(c.top_vendors, 15),
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (batch.length >= 50) {
        const { error } = await supabase.from("mn_cfb_candidates").upsert(batch, { onConflict: "reg_num" });
        if (error) console.error("MN CFB sync upsert error:", error.message);
        batch.length = 0;
      }
    }

    if (batch.length > 0) {
      const { error } = await supabase.from("mn_cfb_candidates").upsert(batch, { onConflict: "reg_num" });
      if (error) console.error("MN CFB sync upsert error:", error.message);
    }

    console.log(`MN CFB sync: complete, upserted ${candidates.size} candidates`);
  } catch (err) {
    console.error("MN CFB sync error:", err);
  }
}
