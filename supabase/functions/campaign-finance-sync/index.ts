import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const TRUSTED_ORIGINS = [
  "https://oppodb.com", "https://db.oppodb.com", "https://ordb.lovable.app",
  "http://localhost:5173", "http://localhost:3000",
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

const FEC_BASE = "https://api.open.fec.gov/v1";
// FEC provides a demo key; for production use apply at api.data.gov
const FEC_API_KEY = "DEMO_KEY";

const OFFICE_MAP: Record<string, string> = { H: "house", S: "senate", P: "president" };

interface FECCandidate {
  name: string;
  candidate_id: string;
  office: string;
  office_full: string;
  state: string;
  district: string;
  party: string;
  party_full: string;
  incumbent_challenge: string;
  cycles: number[];
  has_raised_funds: boolean;
}

interface FECTotals {
  candidate_id: string;
  candidate_name?: string;
  name?: string;
  receipts: number;
  disbursements: number;
  cash_on_hand_end_period: number;
  debts_owed_by_committee: number;
  individual_contributions: number;
  other_political_committee_contributions: number;
  candidate_contribution: number;
  coverage_end_date: string;
  party: string;
  office: string;
  state: string;
  district: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function partyLetter(party: string | null): string | null {
  if (!party) return null;
  const p = party.toUpperCase();
  if (p === "DEM" || p === "DEMOCRAT" || p === "DEMOCRATIC") return "D";
  if (p === "REP" || p === "REPUBLICAN") return "R";
  if (p === "LIB" || p === "LIBERTARIAN") return "L";
  if (p === "GRE" || p === "GREEN") return "G";
  return p.slice(0, 3);
}

function buildValidatedFECUrl(baseUrl: string, endpoint: string, params: Record<string, string>): string {
  try {
    // Minimal path validation
    if (baseUrl.includes('/../') || /\/%2e%2e\//i.test(baseUrl)) {
      throw new Error('Invalid path');
    }
    if (endpoint.includes('/../') || /\/%2e%2e\//i.test(endpoint)) {
      throw new Error('Invalid path');
    }
    
    const url = new URL(baseUrl);
    
    // Validate endpoint parameter
    if (!/^\/[A-Za-z0-9_\/-]+\/?$/.test(endpoint)) {
      throw new Error('Invalid parameter');
    }
    
    // Build pathname from fixed base + validated endpoint
    url.pathname = url.pathname.replace(/\/$/, '') + endpoint;
    
    // Add query parameters
    url.searchParams.set("api_key", FEC_API_KEY);
    url.searchParams.set("per_page", "100");
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    
    return url.href;
  } catch {
    throw new Error('Invalid URL');
  }
}

async function fetchFECPage(endpoint: string, params: Record<string, string>): Promise<any> {
  const url = buildValidatedFECUrl(FEC_BASE, endpoint, params);
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FEC API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function syncStateFinance(
  supabase: any,
  stateAbbr: string,
  cycle: number,
): Promise<{ upserted: number; errors: string[] }> {
  const errors: string[] = [];
  const rows: any[] = [];
  const seenKeys = new Set<string>();

  // Fetch candidates with financial totals for this state & cycle
  for (const office of ["H", "S"]) {
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages && page <= 5) {
      try {
        const data = await fetchFECPage("/candidates/totals/", {
          state: stateAbbr,
          office: office,
          cycle: String(cycle),
          election_year: String(cycle),
          is_active_candidate: "true",
          sort: "-receipts",
          page: String(page),
        });

        totalPages = data.pagination?.pages ?? 1;
        const results: FECTotals[] = data.results ?? [];

        for (const c of results) {
          if (!c.receipts && !c.disbursements && !c.cash_on_hand_end_period) continue;

          const officeType = OFFICE_MAP[office] ?? "house";
          const districtId =
            office === "H" && c.district
              ? `${stateAbbr}-${String(c.district).padStart(2, "0")}`
              : null;

          const individualPct =
            c.receipts > 0 && c.individual_contributions
              ? Math.round((c.individual_contributions / c.receipts) * 100)
              : null;
          const pacPct =
            c.receipts > 0 && c.other_political_committee_contributions
              ? Math.round((c.other_political_committee_contributions / c.receipts) * 100)
              : null;
          const selfPct =
            c.receipts > 0 && c.candidate_contribution
              ? Math.round((c.candidate_contribution / c.receipts) * 100)
              : null;

          const slug = slugify(c.candidate_name ?? "unknown") + "-" + (c.candidate_id ?? "").toLowerCase();
          const upsertKey = `${slug}|${stateAbbr}|${cycle}|${officeType}`;
          if (seenKeys.has(upsertKey)) continue;
          seenKeys.add(upsertKey);

          rows.push({
            candidate_name: c.candidate_name ?? "Unknown",
            candidate_slug: slug,
            office: officeType,
            state_abbr: stateAbbr,
            district: districtId,
            party: partyLetter(c.party),
            cycle,
            source: "FEC",
            total_raised: c.receipts ?? null,
            total_spent: c.disbursements ?? null,
            cash_on_hand: c.cash_on_hand_end_period ?? null,
            total_debt: c.debts_owed_by_committee ?? null,
            individual_contributions: c.individual_contributions ?? null,
            pac_contributions: c.other_political_committee_contributions ?? null,
            self_funding: c.candidate_contribution ?? null,
            small_dollar_pct: null, // FEC totals endpoint doesn't break this out
            large_donor_pct: individualPct != null && pacPct != null ? Math.max(0, 100 - (individualPct ?? 0) - (pacPct ?? 0) - (selfPct ?? 0)) : null,
            out_of_state_pct: null,
            filing_date: c.coverage_end_date ?? null,
            source_url: `https://www.fec.gov/data/candidate/${c.candidate_id}/`,
            updated_at: new Date().toISOString(),
          });
        }

        page++;
        // Brief delay to respect rate limits
        if (page <= totalPages) {
          await new Promise((r) => setTimeout(r, 300));
        }
      } catch (e) {
        errors.push(`${stateAbbr} ${office} page ${page}: ${e instanceof Error ? e.message : String(e)}`);
        break;
      }
    }
  }

  // Also fetch governor races from the /candidates/totals endpoint with office=P won't work
  // FEC doesn't track governor races — they're state-level. We skip governor here.

  if (rows.length === 0) {
    return { upserted: 0, errors };
  }

  // Build a state aggregate row
  const totalRaised = rows.reduce((s, r) => s + (r.total_raised ?? 0), 0);
  const totalSpent = rows.reduce((s, r) => s + (r.total_spent ?? 0), 0);
  const totalCOH = rows.reduce((s, r) => s + (r.cash_on_hand ?? 0), 0);
  const totalPAC = rows.reduce((s, r) => s + (r.pac_contributions ?? 0), 0);

  rows.push({
    candidate_name: `${stateAbbr} Aggregate`,
    candidate_slug: `${stateAbbr.toLowerCase()}-aggregate`,
    office: "all",
    state_abbr: stateAbbr,
    district: null,
    party: null,
    cycle,
    source: "FEC",
    total_raised: totalRaised,
    total_spent: totalSpent,
    cash_on_hand: totalCOH,
    total_debt: null,
    individual_contributions: null,
    pac_contributions: totalPAC,
    self_funding: null,
    small_dollar_pct: null,
    large_donor_pct: null,
    out_of_state_pct: null,
    filing_date: null,
    source_url: null,
    updated_at: new Date().toISOString(),
  });

  // Upsert in batches of 50
  let upserted = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase
      .from("campaign_finance")
      .upsert(batch, { onConflict: "candidate_slug,state_abbr,cycle,office" });

    if (error) {
      errors.push(`Upsert batch ${i}: ${error.message}`);
      // Fall back to individual inserts
      for (const row of batch) {
        const { error: singleErr } = await supabase
          .from("campaign_finance")
          .upsert(row, { onConflict: "candidate_slug,state_abbr,cycle,office" });
        if (!singleErr) upserted++;
      }
    } else {
      upserted += batch.length;
    }
  }

  return { upserted, errors };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Authentication & Authorization ---
    // JWT validation is enforced at platform level (verify_jwt=true)
    // Extract user from validated JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create client with user's JWT to verify authentication
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated (JWT already validated by platform)
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify user has admin role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isAdmin, error: roleError } = await adminClient.rpc("has_role", { 
      _user_id: user.id, 
      _role: "admin" 
    });

    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use service role client for privileged operations (user is verified admin)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const stateParam = url.searchParams.get("state");
    const cycle = parseInt(url.searchParams.get("cycle") ?? "2026") || 2026;

    if (!stateParam) {
      return new Response(
        JSON.stringify({ success: false, error: "state parameter required (e.g. ?state=NC)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const state = stateParam.toUpperCase();
    console.log(`Starting FEC finance sync for ${state}, cycle ${cycle}`);

    const result = await syncStateFinance(supabase, state, cycle);

    console.log(`FEC sync ${state}: ${result.upserted} upserted, ${result.errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        state,
        cycle,
        upserted: result.upserted,
        errors: result.errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Campaign finance sync error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
