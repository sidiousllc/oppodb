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
    const chamber = url.searchParams.get("chamber") || "house";
    const congress = url.searchParams.get("congress") || "119";
    const limit = parseInt(url.searchParams.get("limit") || "250");

    let allMembers: any[] = [];
    let offset = 0;
    const pageSize = Math.min(limit, 250);

    // Paginate through all members
    while (offset < limit) {
      const apiUrl = `https://api.congress.gov/v3/member/congress/${congress}/${chamber}?api_key=${CONGRESS_API_KEY}&limit=${pageSize}&offset=${offset}&format=json`;
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

      // Rate limit: 1 req/sec
      await new Promise((r) => setTimeout(r, 1100));
    }

    // Upsert members
    let upserted = 0;
    for (const m of allMembers) {
      const bioguideId = m.bioguideId;
      if (!bioguideId) continue;

      const record: Record<string, unknown> = {
        bioguide_id: bioguideId,
        name: m.name || `${m.firstName || ""} ${m.lastName || ""}`.trim(),
        first_name: m.firstName || null,
        last_name: m.lastName || null,
        party: m.partyName || m.party || null,
        state: m.state || null,
        district: m.district?.toString() || null,
        chamber: chamber === "senate" ? "Senate" : "House",
        congress: parseInt(congress),
        depiction_url: m.depiction?.imageUrl || null,
        official_url: m.url || m.officialWebsiteUrl || null,
        terms: m.terms ? JSON.stringify(m.terms) : "[]",
        updated_at: new Date().toISOString(),
      };

      const { error } = await sb
        .from("congress_members")
        .upsert(record, { onConflict: "bioguide_id" });

      if (error) {
        console.error(`Error upserting ${bioguideId}:`, error.message);
      } else {
        upserted++;
      }
    }

    // Also sync Senate if requested
    const syncSenate = url.searchParams.get("include_senate") === "true";
    let senateUpserted = 0;

    if (syncSenate && chamber === "house") {
      let senateOffset = 0;
      let senateMembers: any[] = [];
      while (senateOffset < 250) {
        const senateUrl = `https://api.congress.gov/v3/member/congress/${congress}/senate?api_key=${CONGRESS_API_KEY}&limit=250&offset=${senateOffset}&format=json`;
        const resp = await fetch(senateUrl);
        if (!resp.ok) break;
        const data = await resp.json();
        const members = data.members || [];
        if (members.length === 0) break;
        senateMembers = senateMembers.concat(members);
        senateOffset += 250;
        if (members.length < 250) break;
        await new Promise((r) => setTimeout(r, 1100));
      }

      for (const m of senateMembers) {
        const bioguideId = m.bioguideId;
        if (!bioguideId) continue;
        const record: Record<string, unknown> = {
          bioguide_id: bioguideId,
          name: m.name || `${m.firstName || ""} ${m.lastName || ""}`.trim(),
          first_name: m.firstName || null,
          last_name: m.lastName || null,
          party: m.partyName || m.party || null,
          state: m.state || null,
          district: null,
          chamber: "Senate",
          congress: parseInt(congress),
          depiction_url: m.depiction?.imageUrl || null,
          official_url: m.url || m.officialWebsiteUrl || null,
          terms: m.terms ? JSON.stringify(m.terms) : "[]",
          updated_at: new Date().toISOString(),
        };
        const { error } = await sb
          .from("congress_members")
          .upsert(record, { onConflict: "bioguide_id" });
        if (!error) senateUpserted++;
      }
    }

    return new Response(
      JSON.stringify({
        fetched: allMembers.length,
        upserted,
        senate_upserted: senateUpserted,
        chamber,
        congress,
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
