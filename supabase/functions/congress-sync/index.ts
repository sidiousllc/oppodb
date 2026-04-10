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
    const limit = parseInt(url.searchParams.get("limit") || "500");

    // Congress.gov API v3: /member endpoint lists all members, filter by currentMember
    let allMembers: any[] = [];
    let offset = 0;
    const pageSize = 250;

    while (offset < limit) {
      const apiUrl = `https://api.congress.gov/v3/member?api_key=${CONGRESS_API_KEY}&limit=${pageSize}&offset=${offset}&format=json&currentMember=true`;
      console.log(`Fetching offset=${offset}...`);
      const resp = await fetch(apiUrl);
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Congress API error ${resp.status}: ${text}`);
      }
      const data = await resp.json();
      const members = data.members || [];
      if (members.length === 0) break;
      allMembers = allMembers.concat(members);
      offset += pageSize;
      if (members.length < pageSize) break;

      // Rate limit
      await new Promise((r) => setTimeout(r, 1100));
    }

    let upserted = 0;
    let errors = 0;

    for (const m of allMembers) {
      const bioguideId = m.bioguideId;
      if (!bioguideId) continue;

      // Determine chamber and district from terms
      let chamber = "House";
      let district: string | null = null;
      let state: string | null = m.state || null;

      // The member endpoint returns terms as an array of { chamber, startYear, endYear }
      // or via depiction, partyName, etc.
      const terms = m.terms?.item || m.terms || [];
      if (Array.isArray(terms) && terms.length > 0) {
        const latestTerm = terms[terms.length - 1];
        chamber = latestTerm.chamber || "House";
        // For House members, district comes from the member object
      }

      // District is in the member's district field
      if (m.district != null) {
        district = m.district.toString();
      }

      const record: Record<string, unknown> = {
        bioguide_id: bioguideId,
        name: m.name || `${m.firstName || ""} ${m.lastName || ""}`.trim(),
        first_name: m.firstName || null,
        last_name: m.lastName || null,
        party: m.partyName || m.party || null,
        state: state,
        district: district,
        chamber: chamber,
        congress: parseInt(currentCongress),
        depiction_url: m.depiction?.imageUrl || null,
        official_url: m.url || m.officialWebsiteUrl || null,
        terms: JSON.stringify(terms),
        updated_at: new Date().toISOString(),
      };

      const { error } = await sb
        .from("congress_members")
        .upsert(record, { onConflict: "bioguide_id" });

      if (error) {
        console.error(`Error upserting ${bioguideId}:`, error.message);
        errors++;
      } else {
        upserted++;
      }
    }

    return new Response(
      JSON.stringify({
        fetched: allMembers.length,
        upserted,
        errors,
        congress: currentCongress,
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
