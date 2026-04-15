import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OS_BASE = "https://v3.openstates.org";
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchOS(apiKey: string, path: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${OS_BASE}${path}`);
  url.searchParams.set("apikey", apiKey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenStates ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

function stateToJurisdiction(abbr: string): string {
  return `ocd-jurisdiction/country:us/state:${abbr.toLowerCase()}/government`;
}

async function syncPeople(
  apiKey: string,
  supabase: any,
  stateAbbr: string,
): Promise<{ upserted: number; errors: string[] }> {
  const jurisdiction = stateToJurisdiction(stateAbbr);
  let upserted = 0;
  const errors: string[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 5) {
    try {
      const data = await fetchOS(apiKey, "/people", {
        jurisdiction,
        page: String(page),
        per_page: "50",
        include: "other_names",
      });

      const results = data.results ?? [];
      if (results.length === 0) { hasMore = false; break; }

      const rows = results.map((p: any) => {
        const currentRole = p.current_role ?? {};
        return {
          openstates_id: p.id,
          name: p.name,
          first_name: p.given_name || p.name.split(" ")[0] || null,
          last_name: p.family_name || p.name.split(" ").slice(-1)[0] || null,
          party: p.party || null,
          state_abbr: stateAbbr.toUpperCase(),
          chamber: currentRole.org_classification === "upper" ? "senate" : "house",
          district: currentRole.district || null,
          image_url: p.image || null,
          email: p.email || null,
          source_url: p.openstates_url || null,
          raw_data: p,
          updated_at: new Date().toISOString(),
        };
      });

      const { error } = await supabase
        .from("state_legislators")
        .upsert(rows, { onConflict: "openstates_id" });

      if (error) {
        errors.push(`People page ${page}: ${error.message}`);
      } else {
        upserted += rows.length;
      }

      hasMore = (data.pagination?.max_page ?? 1) > page;
      page++;
      await delay(500);
    } catch (e) {
      errors.push(`People page ${page}: ${e instanceof Error ? e.message : String(e)}`);
      hasMore = false;
    }
  }

  return { upserted, errors };
}

async function syncBills(
  apiKey: string,
  supabase: any,
  stateAbbr: string,
): Promise<{ upserted: number; errors: string[] }> {
  const jurisdiction = stateToJurisdiction(stateAbbr);
  let upserted = 0;
  const errors: string[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 5) {
    try {
      const data = await fetchOS(apiKey, "/bills", {
        jurisdiction,
        page: String(page),
        per_page: "50",
        sort: "updated_desc",
        include: "sponsorships",
      });

      const results = data.results ?? [];
      if (results.length === 0) { hasMore = false; break; }

      const rows = results.map((b: any) => {
        const primarySponsor = (b.sponsorships ?? []).find((s: any) => s.primary);
        return {
          openstates_id: b.id,
          state_abbr: stateAbbr.toUpperCase(),
          session: b.session || "",
          identifier: b.identifier || "",
          title: b.title || "",
          subjects: b.subject ?? [],
          classification: b.classification ?? [],
          latest_action_date: b.latest_action_date || null,
          latest_action_description: b.latest_action_description || null,
          first_action_date: b.first_action_date || null,
          sponsor_name: primarySponsor?.name || null,
          sponsor_party: primarySponsor?.party || null,
          source_url: b.openstates_url || null,
          raw_data: b,
          updated_at: new Date().toISOString(),
        };
      });

      const { error } = await supabase
        .from("state_legislative_bills")
        .upsert(rows, { onConflict: "openstates_id" });

      if (error) {
        errors.push(`Bills page ${page}: ${error.message}`);
      } else {
        upserted += rows.length;
      }

      hasMore = (data.pagination?.max_page ?? 1) > page;
      page++;
      await delay(500);
    } catch (e) {
      errors.push(`Bills page ${page}: ${e instanceof Error ? e.message : String(e)}`);
      hasMore = false;
    }
  }

  return { upserted, errors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("OPENSTATES_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "OPENSTATES_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = new URL(req.url);
    const stateParam = url.searchParams.get("state");
    const action = url.searchParams.get("action") || "all"; // people, bills, all

    if (!stateParam) {
      return new Response(
        JSON.stringify({ success: false, error: "state parameter required (e.g. ?state=MN)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const state = stateParam.toUpperCase();
    console.log(`OpenStates sync: ${state}, action=${action}`);

    const result: any = { success: true, state };

    if (action === "people" || action === "all") {
      const peopleResult = await syncPeople(apiKey, supabase, state);
      result.people_upserted = peopleResult.upserted;
      result.people_errors = peopleResult.errors;
      await delay(500);
    }

    if (action === "bills" || action === "all") {
      const billsResult = await syncBills(apiKey, supabase, state);
      result.bills_upserted = billsResult.upserted;
      result.bills_errors = billsResult.errors;
    }

    console.log(`OpenStates ${state} sync complete:`, JSON.stringify(result));

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("OpenStates sync error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
