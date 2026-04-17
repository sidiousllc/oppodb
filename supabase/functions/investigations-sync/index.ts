// Investigations sync: fetches FARA registrants, IG reports (Oversight.gov), and federal spending (USAspending)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function syncFara(query: string): Promise<number> {
  // DOJ FARA Active Registrants — public CSV-style endpoint via efile.fara.gov search.
  // We use the official JSON listing endpoint.
  const url = `https://efile.fara.gov/api/v1/Registrants/json/active`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`FARA fetch failed: ${res.status}`);
  const json = await res.json();
  const items: any[] = json?.REGISTRANTS_ACTIVE?.ROW ?? json?.rows ?? [];
  const filtered = query && query !== "1"
    ? items.filter((r) =>
        JSON.stringify(r).toLowerCase().includes(query.toLowerCase())
      )
    : items;
  const rows = filtered.slice(0, 500).map((r: any) => ({
    registrant_name: r.Name ?? r.registrant_name ?? "Unknown",
    registration_number: String(r.Registration_Number ?? r.registration_number ?? crypto.randomUUID()),
    address: r.Address_1 ?? null,
    state: r.State ?? null,
    country: r.Country ?? null,
    registration_date: r.Registration_Date ?? null,
    status: "active",
    foreign_principals: [],
    documents: [],
    short_form_agents: [],
    source: "DOJ FARA",
    source_url: `https://efile.fara.gov/ords/fara/f?p=API:DIRECTSEARCH::::RP,2:P2_REGISTRANT_NAME:${encodeURIComponent(r.Name ?? "")}`,
    raw_data: r,
  }));
  if (rows.length === 0) return 0;
  const { error } = await supabase
    .from("fara_registrants")
    .upsert(rows, { onConflict: "registration_number" });
  if (error) throw error;
  return rows.length;
}

async function syncIg(query: string): Promise<number> {
  // Oversight.gov public reports API (note: requires the www subdomain;
  // the apex `oversight.gov` host returns 404 for /api/v1/*).
  const q = query && query !== "1" ? `&search=${encodeURIComponent(query)}` : "";
  const candidates = [
    `https://www.oversight.gov/api/v1/reports?limit=100${q}`,
    `https://api.oversight.gov/v1/reports?limit=100${q}`,
  ];
  let json: any = null;
  let lastStatus = 0;
  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      lastStatus = res.status;
      if (res.ok) { json = await res.json(); break; }
      // Drain body to avoid resource leaks in Deno
      await res.text().catch(() => {});
    } catch (err) {
      console.warn(`Oversight.gov endpoint failed: ${url}`, err);
    }
  }
  if (!json) {
    console.warn(`All Oversight.gov endpoints failed (last status ${lastStatus}); skipping IG sync.`);
    return 0;
  }
  const items: any[] = json?.results ?? json?.data ?? json ?? [];
  const rows = items.slice(0, 200).map((r: any) => ({
    report_id: String(r.id ?? r.report_id ?? crypto.randomUUID()),
    title: r.title ?? r.report_title ?? "Untitled",
    agency: r.agency ?? r.agencyAbbreviation ?? "Unknown",
    agency_name: r.agency_name ?? r.agencyName ?? r.agency ?? "Unknown",
    inspector: r.inspector ?? r.inspectorGeneral ?? "Unknown",
    inspector_url: r.inspectorUrl ?? null,
    landing_url: r.landingPage ?? r.landing_url ?? null,
    pdf_url: r.pdfUrl ?? r.pdf_url ?? null,
    url: r.url ?? r.landingPage ?? null,
    summary: r.summary ?? r.description ?? null,
    topic: r.topic ?? null,
    type: r.type ?? r.reportType ?? null,
    published_on: r.publishedOn ?? r.published_on ?? r.date ?? null,
    year: r.year ?? (r.publishedOn ? new Date(r.publishedOn).getFullYear() : null),
    raw_data: r,
  }));
  if (rows.length === 0) return 0;
  const { error } = await supabase
    .from("ig_reports")
    .upsert(rows, { onConflict: "report_id" });
  if (error) throw error;
  return rows.length;
}

async function syncSpending(query: string): Promise<number> {
  // USAspending grants/loans/direct payments by recipient
  const recipient = query && query !== "1" ? query : "";
  if (!recipient) return 0;
  const body = {
    filters: {
      keywords: [recipient],
      award_type_codes: ["02", "03", "04", "05", "06", "07", "08", "09", "10", "11"],
      time_period: [{ start_date: "2020-01-01", end_date: new Date().toISOString().slice(0, 10) }],
    },
    fields: [
      "Award ID",
      "Recipient Name",
      "Award Amount",
      "Total Outlays",
      "Description",
      "Awarding Agency",
      "Awarding Sub Agency",
      "Award Type",
      "Place of Performance State Code",
      "Period of Performance Start Date",
      "Period of Performance Current End Date",
    ],
    page: 1,
    limit: 100,
    sort: "Award Amount",
    order: "desc",
  };
  const res = await fetch("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`USAspending fetch failed: ${res.status}`);
  const json = await res.json();
  const items: any[] = json?.results ?? [];
  const rows = items.map((r: any) => ({
    award_id: r["Award ID"] ?? crypto.randomUUID(),
    award_type: r["Award Type"] ?? "grant",
    recipient_name: r["Recipient Name"] ?? "Unknown",
    award_amount: Number(r["Award Amount"]) || 0,
    total_obligation: Number(r["Total Outlays"]) || Number(r["Award Amount"]) || 0,
    description: r["Description"] ?? null,
    awarding_agency: r["Awarding Agency"] ?? null,
    funding_agency: r["Awarding Sub Agency"] ?? null,
    place_of_performance_state: r["Place of Performance State Code"] ?? null,
    period_of_performance_start: r["Period of Performance Start Date"] ?? null,
    period_of_performance_end: r["Period of Performance Current End Date"] ?? null,
    fiscal_year: r["Period of Performance Start Date"]
      ? new Date(r["Period of Performance Start Date"]).getFullYear()
      : null,
    source: "USAspending",
    source_url: `https://www.usaspending.gov/award/${encodeURIComponent(r["Award ID"] ?? "")}`,
    raw_data: r,
  }));
  if (rows.length === 0) return 0;
  const { error } = await supabase
    .from("federal_spending")
    .upsert(rows, { onConflict: "award_id" });
  if (error) throw error;
  return rows.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const fara = url.searchParams.get("fara");
    const ig = url.searchParams.get("ig");
    const spending = url.searchParams.get("spending");

    let upserted = 0;
    let source = "";

    if (fara) {
      upserted = await syncFara(fara);
      source = "fara";
    } else if (ig) {
      upserted = await syncIg(ig);
      source = "ig";
    } else if (spending) {
      upserted = await syncSpending(spending);
      source = "spending";
    } else {
      return new Response(
        JSON.stringify({ error: "Provide ?fara=… or ?ig=… or ?spending=recipient" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ ok: true, source, upserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("investigations-sync error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
