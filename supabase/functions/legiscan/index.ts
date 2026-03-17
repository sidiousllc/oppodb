import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LEGISCAN_BASE = "https://api.legiscan.com/?key=";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("LEGISCAN_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "LEGISCAN_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const op = url.searchParams.get("op") || "getSessionList";

    // Build LegiScan URL
    let lsUrl = `${LEGISCAN_BASE}${apiKey}&op=${op}`;

    // Forward all other params
    for (const [k, v] of url.searchParams.entries()) {
      if (k === "op") continue;
      lsUrl += `&${k}=${encodeURIComponent(v)}`;
    }

    const resp = await fetch(lsUrl);
    const data = await resp.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
