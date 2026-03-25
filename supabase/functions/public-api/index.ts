import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const VALID_ENDPOINTS = [
  "candidates",
  "districts",
  "state-legislative",
  "election-results",
  "polling",
  "maga-files",
  "narrative-reports",
  "local-impacts",
  "voter-registration-stats",
  "search",
];

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Only GET requests are supported" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate via X-API-Key header only
    const apiKey = req.headers.get("X-API-Key");

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "Missing API key. Provide via X-API-Key header.",
          docs: "Generate an API key from your profile page.",
          example: 'curl -H "X-API-Key: ordb_xxxx" https://.../public-api/candidates',
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate API key
    const keyHash = await hashKey(apiKey);
    const { data: keyData, error: keyError } = await supabase.rpc("validate_api_key", {
      p_key_hash: keyHash,
    });

    if (keyError || !keyData || keyData.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid or revoked API key" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const keyId = keyData[0].key_id;
    const userId = keyData[0].user_id;

    // Parse endpoint from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    // Path: /public-api/{endpoint}
    const endpoint = pathParts[pathParts.length - 1] || "";

    if (!endpoint || endpoint === "public-api") {
      // Return API docs/index
      return new Response(
        JSON.stringify({
          message: "ORDB Public API",
          version: "1.0",
          endpoints: VALID_ENDPOINTS.map((e) => ({
            path: `/public-api/${e}`,
            method: "GET",
            description: endpointDescription(e),
          })),
          authentication: "Include X-API-Key header with your API key",
          query_params: {
            limit: "Max results per category (default 100, max 1000)",
            offset: "Pagination offset (default 0)",
            state: "Filter by state abbreviation (where applicable)",
            search: "Search text (where applicable)",
            categories: "Comma-separated category filter for /search (e.g. candidates,polling,bills)",
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!VALID_ENDPOINTS.includes(endpoint)) {
      return new Response(
        JSON.stringify({
          error: `Unknown endpoint: ${endpoint}`,
          valid_endpoints: VALID_ENDPOINTS,
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Common query params
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 1000);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const stateFilter = url.searchParams.get("state")?.toUpperCase();
    const searchQuery = url.searchParams.get("search");
    const chamber = url.searchParams.get("chamber");

    let result: { data: unknown; count: number | null };

    switch (endpoint) {
      case "candidates": {
        let q = supabase
          .from("candidate_profiles")
          .select("id,name,slug,is_subpage,subpage_title,parent_slug,content,created_at,updated_at", { count: "exact" })
          .range(offset, offset + limit - 1)
          .order("name");
        if (searchQuery) q = q.ilike("name", `%${searchQuery}%`);
        const { data, error, count } = await q;
        if (error) throw error;
        result = { data, count };
        break;
      }

      case "districts": {
        let q = supabase
          .from("district_profiles")
          .select("*", { count: "exact" })
          .range(offset, offset + limit - 1)
          .order("district_id");
        if (stateFilter) q = q.eq("state", stateFilter);
        if (searchQuery) q = q.ilike("district_id", `%${searchQuery}%`);
        const { data, error, count } = await q;
        if (error) throw error;
        result = { data, count };
        break;
      }

      case "state-legislative": {
        let q = supabase
          .from("state_legislative_profiles")
          .select("*", { count: "exact" })
          .range(offset, offset + limit - 1)
          .order("district_id");
        if (stateFilter) q = q.eq("state_abbr", stateFilter);
        if (chamber) q = q.eq("chamber", chamber);
        if (searchQuery) q = q.ilike("district_id", `%${searchQuery}%`);
        const { data, error, count } = await q;
        if (error) throw error;
        result = { data, count };
        break;
      }

      case "election-results": {
        let q = supabase
          .from("state_leg_election_results")
          .select("*", { count: "exact" })
          .range(offset, offset + limit - 1)
          .order("election_year", { ascending: false });
        if (stateFilter) q = q.eq("state_abbr", stateFilter);
        if (chamber) q = q.eq("chamber", chamber);
        const year = url.searchParams.get("year");
        if (year) q = q.eq("election_year", parseInt(year));
        const { data, error, count } = await q;
        if (error) throw error;
        result = { data, count };
        break;
      }

      case "polling": {
        let q = supabase
          .from("polling_data")
          .select("*", { count: "exact" })
          .range(offset, offset + limit - 1)
          .order("date_conducted", { ascending: false });
        if (searchQuery) q = q.ilike("candidate_or_topic", `%${searchQuery}%`);
        const { data, error, count } = await q;
        if (error) throw error;
        result = { data, count };
        break;
      }

      case "maga-files": {
        let q = supabase
          .from("maga_files")
          .select("id,name,slug,content,created_at,updated_at", { count: "exact" })
          .range(offset, offset + limit - 1)
          .order("name");
        if (searchQuery) q = q.ilike("name", `%${searchQuery}%`);
        const { data, error, count } = await q;
        if (error) throw error;
        result = { data, count };
        break;
      }

      case "narrative-reports": {
        let q = supabase
          .from("narrative_reports")
          .select("id,name,slug,content,created_at,updated_at", { count: "exact" })
          .range(offset, offset + limit - 1)
          .order("name");
        if (searchQuery) q = q.ilike("name", `%${searchQuery}%`);
        const { data, error, count } = await q;
        if (error) throw error;
        result = { data, count };
        break;
      }

      case "local-impacts": {
        let q = supabase
          .from("local_impacts")
          .select("id,state,slug,summary,content,created_at,updated_at", { count: "exact" })
          .range(offset, offset + limit - 1)
          .order("state");
        if (stateFilter) q = q.eq("state", stateFilter);
        if (searchQuery) q = q.ilike("state", `%${searchQuery}%`);
        const { data, error, count } = await q;
        if (error) throw error;
        result = { data, count };
        break;
      }

      case "voter-registration-stats": {
        let q = supabase
          .from("state_voter_stats")
          .select("*", { count: "exact" })
          .range(offset, offset + limit - 1)
          .order("total_registered", { ascending: false });
        if (stateFilter) q = q.ilike("state", `%${stateFilter}%`);
        if (searchQuery) q = q.ilike("state", `%${searchQuery}%`);
        const { data, error, count } = await q;
        if (error) throw error;
        result = { data, count };
        break;
      }

      case "search": {
        const q = searchQuery;
        if (!q || q.length < 2) {
          return new Response(
            JSON.stringify({ error: "search param required (min 2 chars)" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const likeQ = `%${q}%`;
        const perCategoryLimit = Math.min(limit, 20);

        const ALL_CATEGORIES = [
          "candidates", "congress_members", "bills", "polling",
          "campaign_finance", "state_finance", "election_results",
          "forecasts", "maga_files", "narrative_reports",
          "local_impacts", "voter_stats",
        ];

        const categoriesParam = url.searchParams.get("categories");
        const activeCategories = categoriesParam
          ? categoriesParam.split(",").map(c => c.trim().toLowerCase()).filter(c => ALL_CATEGORIES.includes(c))
          : ALL_CATEGORIES;

        const categoryQueries: Record<string, Promise<{ data: unknown[]; label: string }>> = {};

        if (activeCategories.includes("candidates")) {
          categoryQueries.candidates = supabase.from("candidate_profiles")
            .select("id,name,slug,is_subpage,parent_slug")
            .ilike("name", likeQ).limit(perCategoryLimit).order("name")
            .then(r => ({ data: r.data || [], label: "Candidate Profiles" }));
        }
        if (activeCategories.includes("congress_members")) {
          categoryQueries.congress_members = supabase.from("congress_members")
            .select("id,name,state,district,party,chamber,bioguide_id,candidate_slug")
            .or(`name.ilike.${likeQ},state.ilike.${likeQ},bioguide_id.ilike.${likeQ}`)
            .limit(perCategoryLimit)
            .then(r => ({ data: r.data || [], label: "Congress Members" }));
        }
        if (activeCategories.includes("bills")) {
          categoryQueries.bills = supabase.from("congress_bills")
            .select("id,bill_id,title,short_title,sponsor_name,status,latest_action_date")
            .or(`title.ilike.${likeQ},short_title.ilike.${likeQ},sponsor_name.ilike.${likeQ},bill_id.ilike.${likeQ}`)
            .order("latest_action_date", { ascending: false }).limit(perCategoryLimit)
            .then(r => ({ data: r.data || [], label: "Legislation" }));
        }
        if (activeCategories.includes("polling")) {
          categoryQueries.polling = supabase.from("polling_data")
            .select("id,candidate_or_topic,source,poll_type,approve_pct,disapprove_pct,date_conducted")
            .or(`candidate_or_topic.ilike.${likeQ},source.ilike.${likeQ}`)
            .order("date_conducted", { ascending: false }).limit(perCategoryLimit)
            .then(r => ({ data: r.data || [], label: "Polling Data" }));
        }
        if (activeCategories.includes("campaign_finance")) {
          categoryQueries.campaign_finance = supabase.from("campaign_finance")
            .select("id,candidate_name,state_abbr,district,party,total_raised,total_spent,cash_on_hand,office,cycle")
            .or(`candidate_name.ilike.${likeQ},state_abbr.ilike.${likeQ},district.ilike.${likeQ}`)
            .order("total_raised", { ascending: false }).limit(perCategoryLimit)
            .then(r => ({ data: r.data || [], label: "Campaign Finance (Federal)" }));
        }
        if (activeCategories.includes("state_finance")) {
          categoryQueries.state_finance = supabase.from("state_cfb_candidates")
            .select("id,candidate_name,state_abbr,chamber,party,office,total_contributions,total_expenditures,net_cash")
            .or(`candidate_name.ilike.${likeQ},state_abbr.ilike.${likeQ},committee_name.ilike.${likeQ}`)
            .order("total_contributions", { ascending: false }).limit(perCategoryLimit)
            .then(r => ({ data: r.data || [], label: "State Campaign Finance" }));
        }
        if (activeCategories.includes("election_results")) {
          categoryQueries.election_results = supabase.from("congressional_election_results")
            .select("id,candidate_name,state_abbr,district_number,party,election_year,votes,vote_pct,is_winner")
            .or(`candidate_name.ilike.${likeQ},state_abbr.ilike.${likeQ}`)
            .order("election_year", { ascending: false }).limit(perCategoryLimit)
            .then(r => ({ data: r.data || [], label: "Election Results" }));
        }
        if (activeCategories.includes("forecasts")) {
          categoryQueries.forecasts = supabase.from("election_forecasts")
            .select("id,state_abbr,district,source,rating,race_type")
            .or(`state_abbr.ilike.${likeQ},district.ilike.${likeQ},rating.ilike.${likeQ}`)
            .eq("cycle", 2026).limit(perCategoryLimit)
            .then(r => ({ data: r.data || [], label: "Election Forecasts" }));
        }
        if (activeCategories.includes("maga_files")) {
          categoryQueries.maga_files = supabase.from("maga_files")
            .select("id,name,slug").ilike("name", likeQ).limit(perCategoryLimit).order("name")
            .then(r => ({ data: r.data || [], label: "MAGA Files" }));
        }
        if (activeCategories.includes("narrative_reports")) {
          categoryQueries.narrative_reports = supabase.from("narrative_reports")
            .select("id,name,slug").ilike("name", likeQ).limit(perCategoryLimit).order("name")
            .then(r => ({ data: r.data || [], label: "Narrative Reports" }));
        }
        if (activeCategories.includes("local_impacts")) {
          categoryQueries.local_impacts = supabase.from("local_impacts")
            .select("id,state,slug,summary").ilike("state", likeQ).limit(perCategoryLimit).order("state")
            .then(r => ({ data: r.data || [], label: "Local Impacts" }));
        }
        if (activeCategories.includes("voter_stats")) {
          categoryQueries.voter_stats = supabase.from("state_voter_stats")
            .select("*").ilike("state", likeQ).limit(perCategoryLimit)
            .order("total_registered", { ascending: false })
            .then(r => ({ data: r.data || [], label: "Voter Registration Stats" }));
        }

        const entries = Object.entries(categoryQueries);
        const settled = await Promise.all(entries.map(async ([key, promise]) => {
          const res = await promise;
          return { key, label: res.label, count: res.data.length, results: res.data };
        }));

        const categories = Object.fromEntries(
          settled.filter(s => s.count > 0).map(s => [s.key, { label: s.label, count: s.count, results: s.results }])
        );
        const totalResults = settled.reduce((sum, s) => sum + s.count, 0);

        // Special response format for search
        supabase.rpc("log_api_request", {
          p_key_id: keyId,
          p_user_id: userId,
          p_endpoint: "search",
          p_status: 200,
        }).then(() => {});

        return new Response(
          JSON.stringify({
            query: q,
            total_results: totalResults,
            categories_searched: settled.length,
            categories_with_results: Object.keys(categories).length,
            available_categories: ALL_CATEGORIES,
            categories,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown endpoint" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    // Log the request (fire and forget)
    supabase.rpc("log_api_request", {
      p_key_id: keyId,
      p_user_id: userId,
      p_endpoint: endpoint,
      p_status: 200,
    }).then(() => {});

    return new Response(
      JSON.stringify({
        data: result.data,
        meta: {
          total: result.count,
          limit,
          offset,
          endpoint,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Public API error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function endpointDescription(endpoint: string): string {
  const descs: Record<string, string> = {
    candidates: "Candidate profiles with opposition research content",
    districts: "Congressional district demographic profiles",
    "state-legislative": "State legislative district profiles with census data",
    "election-results": "State legislative election results with vote counts",
    polling: "Polling data with approval/favorability ratings",
    "maga-files": "MAGA-related research files",
    "narrative-reports": "Narrative research reports",
    "local-impacts": "Local impact analyses by state",
    "voter-registration-stats": "State voter registration statistics with registration rates and turnout data",
    search: "Unified search across all databases (requires ?search= param, optional ?categories= filter)",
  };
  return descs[endpoint] || "";
}
