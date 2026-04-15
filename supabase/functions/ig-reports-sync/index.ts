import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Oversight.garden API — public aggregator of federal IG reports
const OVERSIGHT_API = "https://oversight.garden/api";

// Major IGs to scrape
const INSPECTORS = [
  "agriculture", "commerce", "defense", "education", "energy",
  "epa", "gao", "hhs", "homeland", "hud",
  "interior", "justice", "labor", "nasa", "nrc",
  "opm", "sba", "sec", "ssa", "state",
  "transportation", "treasury", "usps", "va",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let body: any = {};
    try { body = await req.json(); } catch {}
    const inspectors = body.inspectors || INSPECTORS;
    const maxPerIG = body.maxPerIG || 25;

    let totalInserted = 0;
    let errors: string[] = [];

    for (const inspector of inspectors) {
      try {
        const res = await fetch(`${OVERSIGHT_API}/reports/search?inspector=${inspector}&per_page=${maxPerIG}`);
        if (!res.ok) {
          errors.push(`${inspector}: HTTP ${res.status}`);
          continue;
        }

        const data = await res.json();
        const reports = data.results || [];

        if (reports.length === 0) continue;

        const rows = reports.map((r: any) => ({
          inspector: r.inspector || inspector,
          inspector_url: r.inspector_url || null,
          agency: r.agency || inspector,
          agency_name: r.agency_name || inspector.toUpperCase(),
          report_id: r.report_id,
          title: r.title || "Untitled",
          url: r.url || null,
          published_on: r.published_on || null,
          type: r.type || "report",
          summary: (r.summary || "").substring(0, 5000),
          topic: r.topic || null,
          pdf_url: r.pdf_url || r.file_url || null,
          landing_url: r.landing_url || r.url || null,
          year: r.year || (r.published_on ? parseInt(r.published_on.substring(0, 4)) : null),
          raw_data: {
            tracking_number: r.tracking_number,
            unreleased: r.unreleased,
            missing: r.missing,
          },
        }));

        const { error } = await supabase
          .from("ig_reports")
          .upsert(rows, { onConflict: "inspector,report_id" });

        if (error) {
          errors.push(`${inspector}: ${error.message}`);
        } else {
          totalInserted += rows.length;
        }
      } catch (e) {
        errors.push(`${inspector}: ${e.message}`);
      }

      // Rate limit between IGs
      await new Promise(r => setTimeout(r, 300));
    }

    return new Response(JSON.stringify({
      success: true,
      totalInserted,
      inspectors: inspectors.length,
      errors: errors.slice(0, 15),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
