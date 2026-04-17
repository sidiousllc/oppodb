import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Senate LDA (Lobbying Disclosure Act) sync — public API, no auth needed
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const url = new URL(req.url);
    const year = url.searchParams.get("year") ?? String(new Date().getFullYear());
    const limit = parseInt(url.searchParams.get("limit") ?? "100");

    // Senate LDA REST API
    const apiUrl = `https://lda.senate.gov/api/v1/filings/?filing_year=${year}&page_size=${Math.min(limit, 100)}`;
    const resp = await fetch(apiUrl, { headers: { Accept: "application/json", "User-Agent": "ORO-OppoDB/1.0" } });

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `LDA API ${resp.status}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await resp.json();
    const filings = data.results ?? [];

    let upserted = 0;
    for (const f of filings) {
      const { error } = await supabase.from("lobbying_disclosures").upsert({
        filing_uuid: f.filing_uuid,
        registrant_name: f.registrant?.name ?? "Unknown",
        client_name: f.client?.name,
        filing_year: f.filing_year,
        filing_period: f.filing_period_display ?? f.filing_period,
        amount: f.income ? Number(f.income) : (f.expenses ? Number(f.expenses) : null),
        issues: f.lobbying_activities?.map((a: any) => a.general_issue_code_display) ?? [],
        lobbyists: f.lobbying_activities?.flatMap((a: any) => a.lobbyists ?? []).map((l: any) => l.lobbyist?.first_name + " " + l.lobbyist?.last_name) ?? [],
        govt_entities: f.lobbying_activities?.flatMap((a: any) => a.government_entities ?? []).map((g: any) => g.name) ?? [],
        filing_date: f.dt_posted?.split("T")[0],
        source_url: f.url,
        raw_data: f,
      }, { onConflict: "filing_uuid" });
      if (!error) upserted++;
    }

    return new Response(JSON.stringify({ success: true, upserted, total: filings.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
