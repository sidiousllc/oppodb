import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const districtId = url.searchParams.get("district_id");
    const action = url.searchParams.get("action") || "profile";

    // List all districts
    if (action === "list") {
      const { data, error } = await supabase
        .from("district_profiles")
        .select("district_id, state, population, top_issues")
        .order("district_id");

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Search districts
    if (action === "search") {
      const query = url.searchParams.get("q")?.toLowerCase() || "";
      const { data, error } = await supabase
        .from("district_profiles")
        .select("*")
        .order("district_id");

      if (error) throw error;

      const filtered = (data || []).filter(
        (d) =>
          d.district_id.toLowerCase().includes(query) ||
          d.state.toLowerCase().includes(query) ||
          (d.top_issues || []).some((i: string) =>
            i.toLowerCase().includes(query)
          )
      );

      return new Response(JSON.stringify({ success: true, data: filtered }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get specific district profile
    if (action === "profile" && districtId) {
      const { data, error } = await supabase
        .from("district_profiles")
        .select("*")
        .eq("district_id", districtId.toUpperCase())
        .single();

      if (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "District profile not found",
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get district issues
    if (action === "issues" && districtId) {
      const { data, error } = await supabase
        .from("district_profiles")
        .select("district_id, top_issues")
        .eq("district_id", districtId.toUpperCase())
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: "District not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          district: data.district_id,
          issues: data.top_issues,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error:
          'Missing parameters. Use ?action=list, ?action=search&q=term, ?action=profile&district_id=WA-22, or ?action=issues&district_id=WA-22',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("District intel error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
