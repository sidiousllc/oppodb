import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// USAspending.gov contracts sync
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const url = new URL(req.url);
    const recipient = url.searchParams.get("recipient");
    const state = url.searchParams.get("state");
    const fy = url.searchParams.get("fiscal_year") ?? String(new Date().getFullYear());

    const filters: any = {
      award_type_codes: ["A", "B", "C", "D"], // contract types
      time_period: [{ start_date: `${parseInt(fy) - 1}-10-01`, end_date: `${fy}-09-30` }],
    };
    if (recipient) filters.recipient_search_text = [recipient];
    if (state) filters.place_of_performance_locations = [{ country: "USA", state }];

    const apiUrl = "https://api.usaspending.gov/api/v2/search/spending_by_award/";
    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        filters,
        fields: ["Award ID", "Recipient Name", "Award Amount", "Description", "Awarding Agency", "Start Date", "End Date", "recipient_id"],
        page: 1, limit: 100, sort: "Award Amount", order: "desc",
      }),
    });

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `USAspending ${resp.status}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await resp.json();
    const results = data.results ?? [];

    let upserted = 0;
    for (const r of results) {
      const awardId = r["Award ID"] ?? r.generated_internal_id;
      if (!awardId) continue;
      const { error } = await supabase.from("gov_contracts").upsert({
        award_id: String(awardId),
        recipient_name: r["Recipient Name"] ?? "Unknown",
        recipient_state: state,
        awarding_agency: r["Awarding Agency"],
        award_amount: r["Award Amount"] ? Number(r["Award Amount"]) : null,
        award_type: "contract",
        description: r["Description"],
        start_date: r["Start Date"],
        end_date: r["End Date"],
        fiscal_year: parseInt(fy),
        source_url: `https://www.usaspending.gov/award/${r.generated_internal_id ?? awardId}`,
        raw_data: r,
      }, { onConflict: "award_id" });
      if (!error) upserted++;
    }

    return new Response(JSON.stringify({ success: true, upserted, total: results.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
