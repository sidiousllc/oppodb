import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const params = new URLSearchParams();

    // Forward allowed query params
    for (const key of ["country", "limit", "province", "type", "election_type", "election_date", "search"]) {
      const val = url.searchParams.get(key);
      if (val) params.set(key, val);
    }

    // Default to US
    if (!params.has("country")) params.set("country", "US");
    if (!params.has("limit")) params.set("limit", "20");

    const apiUrl = `https://civicapi.org/api/v2/race/search?${params.toString()}`;
    const response = await fetch(apiUrl, {
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) {
      const text = await response.text();
      return new Response(
        JSON.stringify({ ok: false, error: `civicAPI returned ${response.status}`, races: [], count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    return new Response(
      JSON.stringify({ ok: true, races: data.races || [], count: data.count || 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Unknown error", races: [], count: 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
