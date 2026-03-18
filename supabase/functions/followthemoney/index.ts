import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FTM_BASE = "https://api.followthemoney.org";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("FOLLOWTHEMONEY_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "FollowTheMoney API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth check
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    let result: any;

    if (action === "search") {
      // Search contributions/candidates via the Ask Anything API
      const params = new URLSearchParams();
      params.set("APIKey", apiKey);
      params.set("mode", "json");

      // State filter
      if (body.state) params.set("s", body.state);
      // Year filter
      if (body.year) params.set("y", body.year);
      // Candidate name grouping
      if (body.group_by === "candidate") params.set("c-t-eid", "1");
      // Contributor grouping
      if (body.group_by === "contributor") params.set("d-eid", "1");
      // Contributor name search
      if (body.contributor_name) params.set("d-nme", body.contributor_name);
      // Candidate search
      if (body.candidate_name) params.set("c-t-id", body.candidate_name);
      // Office type
      if (body.office) params.set("c-r-oc", body.office);
      // Party
      if (body.party) params.set("c-t-p", body.party);
      // Page
      if (body.page) params.set("p", String(body.page));

      const url = `${FTM_BASE}/?${params.toString()}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`FTM API returned ${resp.status}`);
      }
      result = await resp.json();

    } else if (action === "entity") {
      // Get entity details
      const eid = body.eid;
      if (!eid) throw new Error("Entity ID required");

      const url = `${FTM_BASE}/entity.php?eid=${encodeURIComponent(eid)}&APIKey=${apiKey}&mode=json`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`FTM entity API returned ${resp.status}`);
      result = await resp.json();

    } else if (action === "candidates") {
      // Search for candidates in a state/year
      const params = new URLSearchParams();
      params.set("APIKey", apiKey);
      params.set("mode", "json");
      params.set("c-t-eid", "1"); // Group by candidate career summary
      if (body.state) params.set("s", body.state);
      if (body.year) params.set("y", body.year);
      if (body.office) params.set("c-r-oc", body.office);
      if (body.party) params.set("c-t-p", body.party);
      if (body.page) params.set("p", String(body.page));

      const url = `${FTM_BASE}/?${params.toString()}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`FTM API returned ${resp.status}`);
      result = await resp.json();

    } else if (action === "donors") {
      // Search for donors/contributors
      const params = new URLSearchParams();
      params.set("APIKey", apiKey);
      params.set("mode", "json");
      params.set("d-eid", "1"); // Group by contributor
      if (body.state) params.set("s", body.state);
      if (body.year) params.set("y", body.year);
      if (body.contributor_name) params.set("d-nme", body.contributor_name);
      if (body.employer) params.set("d-par", body.employer);
      if (body.page) params.set("p", String(body.page));

      const url = `${FTM_BASE}/?${params.toString()}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`FTM API returned ${resp.status}`);
      result = await resp.json();

    } else {
      throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("FTM error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
