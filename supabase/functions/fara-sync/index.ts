import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FARA_API_BASE = "https://efile.fara.gov/api/v1";

interface FARARegistrant {
  Registration_Number: string;
  Registrant_Name: string;
  Address_1?: string;
  City?: string;
  State?: string;
  Country?: string;
  Registration_Date?: string;
  Termination_Date?: string;
  Registrant_Status?: string;
}

interface FARAForeignPrincipal {
  Registration_Number: string;
  FP_Name: string;
  FP_Country: string;
  FP_Reg_Date?: string;
  FP_Term_Date?: string;
  FP_State?: string;
}

interface FARAShortForm {
  Registration_Number: string;
  Short_Form_Name: string;
  Short_Form_Date?: string;
  Short_Form_Status?: string;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchFARAEndpoint(endpoint: string): Promise<any[]> {
  const url = `${FARA_API_BASE}/${endpoint}`;
  console.log(`Fetching FARA: ${url}`);
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FARA API ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  // FARA API returns { items: [...] } or array directly
  return Array.isArray(data) ? data : (data.items ?? data.REGISTRANTS ?? data.FOREIGNPRINCIPALS ?? data.SHORTFORMS ?? []);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const statusFilter = url.searchParams.get("status") || "active"; // active, terminated, all
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "200") || 200, 1000);

    console.log(`FARA sync: status=${statusFilter}, limit=${limit}`);

    // 1. Fetch registrants
    let registrants: FARARegistrant[] = [];
    try {
      registrants = await fetchFARAEndpoint("Registrants");
      console.log(`Fetched ${registrants.length} total registrants`);
    } catch (e) {
      console.error("Failed to fetch registrants, trying bulk CSV fallback:", e);
      // Fallback: try the bulk CSV endpoint
      try {
        const csvRes = await fetch("https://efile.fara.gov/bulk/zip/FARA_All_Registrants.csv.zip");
        if (csvRes.ok) {
          console.log("Bulk CSV fallback available but ZIP parsing not implemented in this version");
        }
      } catch { /* ignore fallback failure */ }
    }

    // Filter by status
    if (statusFilter !== "all") {
      registrants = registrants.filter((r) => {
        const s = (r.Registrant_Status || "").toLowerCase();
        return statusFilter === "active" ? !s.includes("terminated") : s.includes("terminated");
      });
    }

    // Limit
    registrants = registrants.slice(0, limit);

    await delay(500);

    // 2. Fetch foreign principals
    let foreignPrincipals: FARAForeignPrincipal[] = [];
    try {
      foreignPrincipals = await fetchFARAEndpoint("ForeignPrincipals");
      console.log(`Fetched ${foreignPrincipals.length} foreign principals`);
    } catch (e) {
      console.warn("Failed to fetch foreign principals:", e);
    }

    await delay(500);

    // 3. Fetch short forms (agents)
    let shortForms: FARAShortForm[] = [];
    try {
      shortForms = await fetchFARAEndpoint("ShortForms");
      console.log(`Fetched ${shortForms.length} short forms`);
    } catch (e) {
      console.warn("Failed to fetch short forms:", e);
    }

    // Build lookup maps by registration number
    const fpByRegNum = new Map<string, any[]>();
    for (const fp of foreignPrincipals) {
      const key = fp.Registration_Number;
      if (!fpByRegNum.has(key)) fpByRegNum.set(key, []);
      fpByRegNum.get(key)!.push({
        name: fp.FP_Name,
        country: fp.FP_Country,
        reg_date: fp.FP_Reg_Date || null,
        term_date: fp.FP_Term_Date || null,
        state: fp.FP_State || null,
      });
    }

    const sfByRegNum = new Map<string, any[]>();
    for (const sf of shortForms) {
      const key = sf.Registration_Number;
      if (!sfByRegNum.has(key)) sfByRegNum.set(key, []);
      sfByRegNum.get(key)!.push({
        name: sf.Short_Form_Name,
        date: sf.Short_Form_Date || null,
        status: sf.Short_Form_Status || null,
      });
    }

    // 4. Build rows and upsert
    let upserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < registrants.length; i += 50) {
      const batch = registrants.slice(i, i + 50).map((r) => ({
        registration_number: r.Registration_Number,
        registrant_name: r.Registrant_Name,
        address: [r.Address_1, r.City, r.State].filter(Boolean).join(", ") || null,
        state: r.State || null,
        country: r.Country || null,
        registration_date: r.Registration_Date || null,
        termination_date: r.Termination_Date || null,
        status: (r.Registrant_Status || "active").toLowerCase().includes("terminated") ? "terminated" : "active",
        foreign_principals: fpByRegNum.get(r.Registration_Number) || [],
        short_form_agents: sfByRegNum.get(r.Registration_Number) || [],
        source: "DOJ FARA",
        source_url: `https://efile.fara.gov/ords/fara/f?p=171:200::::RP,200:P200_REG_NUMBER:${r.Registration_Number}`,
        raw_data: r,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("fara_registrants")
        .upsert(batch, { onConflict: "registration_number" });

      if (error) {
        errors.push(`Batch ${i}: ${error.message}`);
        // Try individual fallback
        for (const row of batch) {
          const { error: singleErr } = await supabase
            .from("fara_registrants")
            .upsert(row, { onConflict: "registration_number" });
          if (singleErr) {
            errors.push(`${row.registrant_name}: ${singleErr.message}`);
          } else {
            upserted++;
          }
        }
      } else {
        upserted += batch.length;
      }
    }

    console.log(`FARA sync: ${upserted} upserted, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        registrants_fetched: registrants.length,
        foreign_principals_fetched: foreignPrincipals.length,
        short_forms_fetched: shortForms.length,
        upserted,
        errors: errors.slice(0, 20),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("FARA sync error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
