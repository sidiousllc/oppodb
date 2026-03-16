import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OS_BASE = "https://www.opensecrets.org/api/";

/**
 * OpenSecrets API endpoints used:
 * - candSummary: total raised/spent/COH/debt, source breakdown
 * - candContrib: top 10 contributors
 * - candIndustry: top 10 industries
 */

interface OSCandidate {
  cid: string;
  cand_name: string;
  party: string;
  state: string;
  office: string;
  chamber: string; // S or H
  district?: string;
  cycle: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function partyLetter(p: string | null): string | null {
  if (!p) return null;
  const u = p.toUpperCase();
  if (u === "D" || u.startsWith("DEM")) return "D";
  if (u === "R" || u.startsWith("REP")) return "R";
  if (u === "I" || u.startsWith("IND")) return "I";
  if (u === "L" || u.startsWith("LIB")) return "L";
  return u.slice(0, 1);
}

async function fetchOS(
  apiKey: string,
  method: string,
  params: Record<string, string>,
): Promise<any> {
  const url = new URL(OS_BASE);
  url.searchParams.set("method", method);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("output", "json");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenSecrets ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

// Small delay to respect rate limits (200 calls/day free tier)
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function syncCandidateFromOS(
  apiKey: string,
  cid: string,
  cycle: string,
): Promise<{
  summary: any;
  industries: any[];
  contributors: any[];
} | null> {
  try {
    // Fetch candidate summary
    const summaryData = await fetchOS(apiKey, "candSummary", { cid, cycle });
    const summary =
      summaryData?.response?.summary?.["@attributes"] ?? null;

    await delay(500);

    // Fetch top industries
    let industries: any[] = [];
    try {
      const indData = await fetchOS(apiKey, "candIndustry", { cid, cycle });
      const indList = indData?.response?.industries?.industry ?? [];
      industries = (Array.isArray(indList) ? indList : [indList])
        .map((i: any) => ({
          name: i["@attributes"]?.industry_name ?? i["@attributes"]?.industry_code,
          amount: parseFloat(i["@attributes"]?.total ?? "0"),
          indivs: parseFloat(i["@attributes"]?.indivs ?? "0"),
          pacs: parseFloat(i["@attributes"]?.pacs ?? "0"),
        }))
        .filter((i: any) => i.amount > 0)
        .slice(0, 10);
    } catch (e) {
      console.warn(`Industries fetch failed for ${cid}:`, e);
    }

    await delay(500);

    // Fetch top contributors
    let contributors: any[] = [];
    try {
      const contData = await fetchOS(apiKey, "candContrib", { cid, cycle });
      const contList = contData?.response?.contributors?.contributor ?? [];
      contributors = (Array.isArray(contList) ? contList : [contList])
        .map((c: any) => ({
          name: c["@attributes"]?.org_name,
          amount: parseFloat(c["@attributes"]?.total ?? "0"),
          indivs: parseFloat(c["@attributes"]?.indivs ?? "0"),
          pacs: parseFloat(c["@attributes"]?.pacs ?? "0"),
        }))
        .filter((c: any) => c.amount > 0)
        .slice(0, 10);
    } catch (e) {
      console.warn(`Contributors fetch failed for ${cid}:`, e);
    }

    return { summary, industries, contributors };
  } catch (e) {
    console.error(`Failed to fetch OS data for ${cid}:`, e);
    return null;
  }
}

async function getLegislators(
  apiKey: string,
  stateAbbr: string,
): Promise<OSCandidate[]> {
  try {
    const data = await fetchOS(apiKey, "getLegislators", { id: stateAbbr });
    const list = data?.response?.legislator ?? [];
    const arr = Array.isArray(list) ? list : [list];
    return arr.map((l: any) => {
      const a = l["@attributes"] ?? {};
      return {
        cid: a.cid ?? "",
        cand_name: `${a.firstlast ?? ""}`.trim(),
        party: a.party ?? "",
        state: stateAbbr,
        office: a.chamber === "S" ? "senate" : "house",
        chamber: a.chamber ?? "H",
        district: a.district ?? undefined,
        cycle: "2024", // OpenSecrets uses election cycles
      };
    }).filter((c: OSCandidate) => c.cid);
  } catch (e) {
    console.error(`getLegislators failed for ${stateAbbr}:`, e);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("OPENSECRETS_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "OPENSECRETS_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = new URL(req.url);
    const stateParam = url.searchParams.get("state");
    const cycle = url.searchParams.get("cycle") ?? "2024";
    // Optional: limit number of candidates to process (for rate limit management)
    const limit = parseInt(url.searchParams.get("limit") ?? "10") || 10;

    if (!stateParam) {
      return new Response(
        JSON.stringify({ success: false, error: "state parameter required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const state = stateParam.toUpperCase();
    console.log(`OpenSecrets sync: ${state}, cycle ${cycle}, limit ${limit}`);

    // 1. Get legislators for the state
    const legislators = await getLegislators(apiKey, state);
    console.log(`Found ${legislators.length} legislators for ${state}`);

    const processed: string[] = [];
    const errors: string[] = [];
    let upserted = 0;

    // 2. Process each legislator (up to limit)
    for (const leg of legislators.slice(0, limit)) {
      await delay(500);

      const osData = await syncCandidateFromOS(apiKey, leg.cid, cycle);
      if (!osData || !osData.summary) {
        errors.push(`No data for ${leg.cand_name} (${leg.cid})`);
        continue;
      }

      const s = osData.summary;
      const totalRaised = parseFloat(s.total ?? "0");
      const spent = parseFloat(s.spent ?? "0");
      const coh = parseFloat(s.cash_on_hand ?? "0");
      const debt = parseFloat(s.debt ?? "0");

      const districtId =
        leg.office === "house" && leg.district
          ? `${state}-${String(leg.district).padStart(2, "0")}`
          : null;

      const candidateSlug = `${slugify(leg.cand_name)}-os-${leg.cid.toLowerCase()}`;

      const row = {
        candidate_name: leg.cand_name,
        candidate_slug: candidateSlug,
        office: leg.office,
        state_abbr: state,
        district: districtId,
        party: partyLetter(leg.party),
        cycle: parseInt(cycle) || 2024,
        source: "OpenSecrets",
        source_url: `https://www.opensecrets.org/members-of-congress/summary?cid=${leg.cid}`,
        total_raised: totalRaised || null,
        total_spent: spent || null,
        cash_on_hand: coh || null,
        total_debt: debt || null,
        individual_contributions: null as number | null,
        pac_contributions: null as number | null,
        self_funding: null as number | null,
        small_dollar_pct: null as number | null,
        large_donor_pct: null as number | null,
        out_of_state_pct: null as number | null,
        top_industries: osData.industries,
        top_contributors: osData.contributors,
        filing_date: null,
        updated_at: new Date().toISOString(),
      };

      // Parse source breakdown from summary
      if (s.indiv) {
        row.individual_contributions = parseFloat(s.indiv) || null;
      }
      if (s.pac) {
        row.pac_contributions = parseFloat(s.pac) || null;
      }
      if (s.self) {
        row.self_funding = parseFloat(s.self) || null;
      }
      // small_dollar_pct from small_indiv if available
      if (s.small_indiv && totalRaised > 0) {
        row.small_dollar_pct = Math.round(
          (parseFloat(s.small_indiv) / totalRaised) * 100,
        );
      }

      const { error } = await supabase
        .from("campaign_finance")
        .upsert(row, { onConflict: "candidate_slug,state_abbr,cycle,office" });

      if (error) {
        errors.push(`Upsert ${leg.cand_name}: ${error.message}`);
      } else {
        upserted++;
        processed.push(leg.cand_name);
      }
    }

    // 3. Update state aggregate
    if (upserted > 0) {
      const { data: stateRows } = await supabase
        .from("campaign_finance")
        .select("total_raised, total_spent, cash_on_hand, pac_contributions")
        .eq("state_abbr", state)
        .neq("office", "all");

      if (stateRows && stateRows.length > 0) {
        const aggRow = {
          candidate_name: `${state} Aggregate`,
          candidate_slug: `${state.toLowerCase()}-aggregate`,
          office: "all",
          state_abbr: state,
          district: null,
          party: null,
          cycle: parseInt(cycle) || 2024,
          source: "OpenSecrets",
          total_raised: stateRows.reduce((s, r) => s + (Number(r.total_raised) || 0), 0),
          total_spent: stateRows.reduce((s, r) => s + (Number(r.total_spent) || 0), 0),
          cash_on_hand: stateRows.reduce((s, r) => s + (Number(r.cash_on_hand) || 0), 0),
          pac_contributions: stateRows.reduce((s, r) => s + (Number(r.pac_contributions) || 0), 0),
          updated_at: new Date().toISOString(),
        };

        await supabase
          .from("campaign_finance")
          .upsert(aggRow, { onConflict: "candidate_slug,state_abbr,cycle,office" });
      }
    }

    console.log(`OpenSecrets ${state}: ${upserted} upserted, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        state,
        cycle,
        legislators_found: legislators.length,
        upserted,
        processed,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("OpenSecrets sync error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
