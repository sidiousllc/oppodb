import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// USASpending.gov API v2 — free, no API key required
const USA_SPENDING_API = "https://api.usaspending.gov/api/v2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let body: any = {};
    try { body = await req.json(); } catch {}
    
    const stateAbbr = body.state || "ALL";
    const fiscalYear = body.fiscal_year || 2025;
    const awardType = body.award_type || "contracts"; // contracts or grants
    const limit = body.limit || 100;

    const states = stateAbbr === "ALL" 
      ? ["MN", "PA", "MI", "WI", "AZ", "GA", "NV", "NC", "OH", "FL"]
      : [stateAbbr];

    let totalInserted = 0;
    let errors: string[] = [];

    for (const state of states) {
      try {
        // Build the search payload for USASpending.gov
        const searchPayload: any = {
          filters: {
            time_period: [{ start_date: `${fiscalYear}-01-01`, end_date: `${fiscalYear}-12-31` }],
            place_of_performance_locations: [{ country: "USA", state: state }],
          },
          fields: [
            "Award ID", "Recipient Name", "Award Amount", "Total Obligation",
            "Description", "Start Date", "End Date", "Awarding Agency",
            "Funding Agency", "recipient_id", "Place of Performance State Code",
            "Place of Performance Congressional District",
            "NAICS Code", "NAICS Description", "CFDA Number",
          ],
          page: 1,
          limit: Math.min(limit, 100),
          sort: "Award Amount",
          order: "desc",
        };

        const endpoint = awardType === "grants"
          ? `${USA_SPENDING_API}/search/spending_by_award/`
          : `${USA_SPENDING_API}/search/spending_by_award/`;

        // Add award type filter
        searchPayload.filters.award_type_codes = awardType === "grants"
          ? ["02", "03", "04", "05"] // grants, direct payments, insurance, other
          : ["A", "B", "C", "D"]; // contracts

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(searchPayload),
        });

        if (!res.ok) {
          const errText = await res.text();
          errors.push(`${state}: HTTP ${res.status} - ${errText.substring(0, 200)}`);
          continue;
        }

        const data = await res.json();
        const results = data.results || [];

        if (results.length === 0) continue;

        const rows = results.map((r: any) => ({
          award_type: awardType === "grants" ? "grant" : "contract",
          recipient_name: r["Recipient Name"] || r.recipient_name || "Unknown",
          recipient_state: state,
          recipient_district: null,
          awarding_agency: r["Awarding Agency"] || r.awarding_agency_name || null,
          funding_agency: r["Funding Agency"] || r.funding_agency_name || null,
          description: (r["Description"] || r.description || "").substring(0, 2000),
          award_amount: parseFloat(r["Award Amount"] || r.award_amount || 0) || null,
          total_obligation: parseFloat(r["Total Obligation"] || r.total_obligation || 0) || null,
          period_of_performance_start: r["Start Date"] || r.period_of_performance_start_date || null,
          period_of_performance_end: r["End Date"] || r.period_of_performance_current_end_date || null,
          fiscal_year: fiscalYear,
          naics_code: r["NAICS Code"] || r.naics_code || null,
          naics_description: r["NAICS Description"] || r.naics_description || null,
          cfda_number: r["CFDA Number"] || r.cfda_number || null,
          cfda_title: null,
          place_of_performance_state: r["Place of Performance State Code"] || state,
          place_of_performance_district: r["Place of Performance Congressional District"] || null,
          award_id: r["Award ID"] || r.internal_id?.toString() || `${state}-${awardType}-${r["Recipient Name"]}-${fiscalYear}`,
          source_url: r.generated_internal_id
            ? `https://www.usaspending.gov/award/${r.generated_internal_id}`
            : null,
          raw_data: { internal_id: r.internal_id, generated_id: r.generated_internal_id },
        }));

        // Upsert in batches of 50
        for (let j = 0; j < rows.length; j += 50) {
          const batch = rows.slice(j, j + 50);
          const { error } = await supabase
            .from("federal_spending")
            .upsert(batch, { onConflict: "award_type,award_id" });
          if (error) {
            errors.push(`${state} batch ${j}: ${error.message}`);
          } else {
            totalInserted += batch.length;
          }
        }
      } catch (e) {
        errors.push(`${state}: ${e.message}`);
      }

      // Rate limit between states
      await new Promise(r => setTimeout(r, 500));
    }

    return new Response(JSON.stringify({
      success: true,
      totalInserted,
      fiscalYear,
      awardType,
      states,
      errors: errors.slice(0, 15),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
