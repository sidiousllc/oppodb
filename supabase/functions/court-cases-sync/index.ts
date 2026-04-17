import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// CourtListener API for federal court cases
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const url = new URL(req.url);
    const q = url.searchParams.get("q");
    if (!q) return new Response(JSON.stringify({ error: "Missing q parameter" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const apiUrl = `https://www.courtlistener.com/api/rest/v4/search/?type=r&q=${encodeURIComponent(q)}&order_by=dateFiled+desc`;
    const headers: any = { Accept: "application/json", "User-Agent": "ORO-OppoDB/1.0" };
    const clToken = Deno.env.get("COURTLISTENER_TOKEN");
    if (clToken) headers.Authorization = `Token ${clToken}`;

    const resp = await fetch(apiUrl, { headers });
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `CourtListener ${resp.status}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await resp.json();
    const results = data.results ?? [];

    let upserted = 0;
    for (const r of results.slice(0, 50)) {
      const caseId = r.docket_id ? String(r.docket_id) : r.id ? String(r.id) : null;
      if (!caseId) continue;
      const { error } = await supabase.from("court_cases").upsert({
        case_id: caseId,
        court: r.court ?? r.court_id ?? "Unknown",
        case_name: r.caseName ?? r.case_name ?? "Untitled",
        case_number: r.docketNumber,
        filed_date: r.dateFiled,
        nature_of_suit: r.suitNature,
        parties: r.party ?? [],
        judge: r.judge,
        status: r.status,
        docket_url: r.absolute_url ? `https://www.courtlistener.com${r.absolute_url}` : null,
        raw_data: r,
      }, { onConflict: "case_id" });
      if (!error) upserted++;
    }

    return new Response(JSON.stringify({ success: true, upserted, total: results.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
