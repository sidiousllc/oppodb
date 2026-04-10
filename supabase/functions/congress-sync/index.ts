import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const CONGRESS_API_KEY = Deno.env.get("CONGRESS_GOV_API_KEY");
    if (!CONGRESS_API_KEY) {
      return new Response(JSON.stringify({ error: "CONGRESS_GOV_API_KEY not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const currentCongress = url.searchParams.get("congress") || "119";
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const pageSize = 250;

    // Single page fetch
    const apiUrl = `https://api.congress.gov/v3/member?api_key=${CONGRESS_API_KEY}&limit=${pageSize}&offset=${offset}&format=json&currentMember=true`;
    const resp = await fetch(apiUrl);
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Congress API error ${resp.status}: ${text}`);
    }
    const data = await resp.json();
    const members = data.members || [];

    // Batch upsert
    const records = members.map((m: any) => {
      const terms = m.terms?.item || m.terms || [];
      let chamber = "House";
      if (Array.isArray(terms) && terms.length > 0) {
        chamber = terms[terms.length - 1].chamber || "House";
      }

      return {
        bioguide_id: m.bioguideId,
        name: m.name || `${m.firstName || ""} ${m.lastName || ""}`.trim(),
        first_name: m.firstName || null,
        last_name: m.lastName || null,
        party: m.partyName || m.party || null,
        state: m.state || null,
        district: m.district != null ? m.district.toString() : null,
        chamber,
        congress: parseInt(currentCongress),
        depiction_url: m.depiction?.imageUrl || null,
        official_url: m.url || m.officialWebsiteUrl || null,
        terms: JSON.stringify(terms),
        updated_at: new Date().toISOString(),
      };
    }).filter((r: any) => r.bioguide_id);

    let upserted = 0;
    let errors = 0;

    // Batch in chunks of 50
    for (let i = 0; i < records.length; i += 50) {
      const batch = records.slice(i, i + 50);
      const { error } = await sb
        .from("congress_members")
        .upsert(batch, { onConflict: "bioguide_id" });
      if (error) {
        console.error("Batch upsert error:", error.message);
        errors += batch.length;
      } else {
        upserted += batch.length;
      }
    }

    return new Response(
      JSON.stringify({
        fetched: members.length,
        upserted,
        errors,
        offset,
        hasMore: members.length === pageSize,
        nextOffset: offset + pageSize,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("congress-sync error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
