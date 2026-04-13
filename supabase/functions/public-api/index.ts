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
  "polling-charts",
  "prediction-markets",
  "prediction-markets-charts",
  "maga-files",
  "narrative-reports",
  "local-impacts",
  "messaging-guidance",
  "voter-registration-stats",
  "congress-members",
  "congress-bills",
  "congress-committees",
  "congress-votes",
  "campaign-finance",
  "election-forecasts",
  "forecast-history",
  "congressional-elections",
  "state-finance",
  "mn-finance",
  "intel-briefings",
  "tracked-bills",
  "mit-elections",
  "state-leg-elections",
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

      case "polling-charts": {
        // Fetch all polling data for chart aggregation
        const pollType = url.searchParams.get("poll_type") || "approval";
        const topic = url.searchParams.get("topic") || "Trump Approval";
        
        // 1. Approval trend data (time series)
        const { data: trendData } = await supabase
          .from("polling_data")
          .select("source,date_conducted,approve_pct,disapprove_pct,margin,sample_size,methodology")
          .eq("poll_type", pollType)
          .ilike("candidate_or_topic", `%${topic}%`)
          .is("raw_data->group_type", null)
          .order("date_conducted", { ascending: true })
          .limit(500);

        // 2. Demographic breakdowns
        const { data: demoData } = await supabase
          .from("polling_data")
          .select("source,date_conducted,approve_pct,disapprove_pct,margin,raw_data")
          .eq("poll_type", pollType)
          .ilike("candidate_or_topic", `%${topic}%`)
          .not("raw_data->group_type", "is", null)
          .order("date_conducted", { ascending: false })
          .limit(500);

        // 3. Source comparison (latest per source)
        const sourceMap = new Map<string, any>();
        (trendData || []).forEach((p: any) => {
          if (!sourceMap.has(p.source) || p.date_conducted > sourceMap.get(p.source).date_conducted) {
            sourceMap.set(p.source, p);
          }
        });
        const latestBySource = [...sourceMap.values()];

        // 4. Rolling average (7-point)
        const sorted = [...(trendData || [])].sort((a: any, b: any) => a.date_conducted.localeCompare(b.date_conducted));
        const rollingAverage = sorted.map((p: any, i: number) => {
          const window = sorted.slice(Math.max(0, i - 6), i + 1);
          const avgApprove = window.reduce((s: number, x: any) => s + (x.approve_pct || 0), 0) / window.length;
          const avgDisapprove = window.reduce((s: number, x: any) => s + (x.disapprove_pct || 0), 0) / window.length;
          return { date: p.date_conducted, approve_avg: +avgApprove.toFixed(1), disapprove_avg: +avgDisapprove.toFixed(1), window_size: window.length };
        });

        // 5. Aggregate demographics by group_type
        const demoAgg = new Map<string, Map<string, { totalApprove: number; totalDisapprove: number; count: number }>>();
        (demoData || []).forEach((p: any) => {
          const rd = p.raw_data;
          if (!rd?.group_type || !rd?.demographic) return;
          if (!demoAgg.has(rd.group_type)) demoAgg.set(rd.group_type, new Map());
          const group = demoAgg.get(rd.group_type)!;
          if (!group.has(rd.demographic)) group.set(rd.demographic, { totalApprove: 0, totalDisapprove: 0, count: 0 });
          const entry = group.get(rd.demographic)!;
          entry.totalApprove += p.approve_pct || 0;
          entry.totalDisapprove += p.disapprove_pct || 0;
          entry.count++;
        });
        const demographics: Record<string, any[]> = {};
        demoAgg.forEach((demos, groupType) => {
          demographics[groupType] = [];
          demos.forEach((val, demo) => {
            demographics[groupType].push({
              demographic: demo,
              approve: +(val.totalApprove / val.count).toFixed(1),
              disapprove: +(val.totalDisapprove / val.count).toFixed(1),
              margin: +((val.totalApprove - val.totalDisapprove) / val.count).toFixed(1),
              poll_count: val.count,
            });
          });
          demographics[groupType].sort((a: any, b: any) => b.margin - a.margin);
        });

        // 6. Methodology breakdown
        const methodCounts: Record<string, number> = {};
        (trendData || []).forEach((p: any) => {
          const m = p.methodology || "Unknown";
          methodCounts[m] = (methodCounts[m] || 0) + 1;
        });
        const methodologyBreakdown = Object.entries(methodCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

        supabase.rpc("log_api_request", { p_key_id: keyId, p_user_id: userId, p_endpoint: "polling-charts", p_status: 200 }).then(() => {});

        return new Response(
          JSON.stringify({
            charts: {
              approval_trend: { description: "Approval/disapproval over time by pollster", data: trendData || [] },
              rolling_average: { description: "7-point rolling average of approve/disapprove", data: rollingAverage },
              source_comparison: { description: "Latest poll result per source", data: latestBySource },
              demographic_breakdowns: { description: "Approval by demographic group (party, age, gender, race, education, region)", data: demographics },
              methodology_breakdown: { description: "Poll count by methodology type", data: methodologyBreakdown },
            },
            meta: {
              poll_type: pollType,
              topic,
              total_polls: (trendData || []).length,
              total_demographic_polls: (demoData || []).length,
              sources: [...new Set((trendData || []).map((p: any) => p.source))],
              demographic_groups: Object.keys(demographics),
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "prediction-markets": {
        let q = supabase
          .from("prediction_markets")
          .select("id,market_id,source,title,category,state_abbr,district,candidate_name,yes_price,no_price,volume,liquidity,last_traded_at,market_url,status,updated_at", { count: "exact" })
          .eq("status", "active")
          .range(offset, offset + limit - 1)
          .order("volume", { ascending: false });
        if (stateFilter) q = q.eq("state_abbr", stateFilter);
        if (searchQuery) q = q.or(`title.ilike.%${searchQuery}%,candidate_name.ilike.%${searchQuery}%`);
        const catParam = url.searchParams.get("category");
        if (catParam) q = q.eq("category", catParam);
        const srcParam = url.searchParams.get("source");
        if (srcParam) q = q.eq("source", srcParam);
        const { data, error, count } = await q;
        if (error) throw error;
        result = { data, count };
        break;
      }

      case "prediction-markets-charts": {
        // Fetch all active markets for aggregation
        const { data: allMarkets } = await supabase
          .from("prediction_markets")
          .select("id,market_id,source,title,category,state_abbr,district,candidate_name,yes_price,no_price,volume,liquidity,last_traded_at,status")
          .eq("status", "active")
          .order("volume", { ascending: false })
          .limit(1000);

        const mkts = allMarkets || [];

        // 1. Source breakdown
        const srcBreakdown: Record<string, { count: number; totalProb: number; totalVolume: number }> = {};
        mkts.forEach((m: any) => {
          if (!srcBreakdown[m.source]) srcBreakdown[m.source] = { count: 0, totalProb: 0, totalVolume: 0 };
          srcBreakdown[m.source].count++;
          srcBreakdown[m.source].totalProb += (m.yes_price || 0) * 100;
          srcBreakdown[m.source].totalVolume += m.volume || 0;
        });
        const sourceBreakdown = Object.entries(srcBreakdown).map(([source, data]) => ({
          source, count: data.count, avg_probability: +(data.totalProb / data.count).toFixed(1), total_volume: data.totalVolume,
        })).sort((a, b) => b.count - a.count);

        // 2. Category breakdown
        const catBreakdown: Record<string, { count: number; totalVolume: number }> = {};
        mkts.forEach((m: any) => {
          if (!catBreakdown[m.category]) catBreakdown[m.category] = { count: 0, totalVolume: 0 };
          catBreakdown[m.category].count++;
          catBreakdown[m.category].totalVolume += m.volume || 0;
        });
        const categoryBreakdown = Object.entries(catBreakdown).map(([category, data]) => ({
          category, count: data.count, total_volume: data.totalVolume,
        })).sort((a, b) => b.count - a.count);

        // 3. Probability distribution (10% buckets)
        const probDist = Array.from({ length: 10 }, (_, i) => ({ range: `${i * 10}-${(i + 1) * 10}%`, count: 0 }));
        mkts.forEach((m: any) => {
          const p = (m.yes_price || 0) * 100;
          const idx = Math.min(Math.floor(p / 10), 9);
          probDist[idx].count++;
        });

        // 4. Top markets by probability
        const topByProb = [...mkts]
          .filter((m: any) => m.yes_price != null && m.yes_price > 0 && m.yes_price < 1)
          .sort((a: any, b: any) => (b.yes_price || 0) - (a.yes_price || 0))
          .slice(0, 15)
          .map((m: any) => ({ title: m.title, source: m.source, probability: +((m.yes_price || 0) * 100).toFixed(1), volume: m.volume, category: m.category }));

        // 5. Top markets by volume
        const topByVolume = [...mkts]
          .sort((a: any, b: any) => (b.volume || 0) - (a.volume || 0))
          .slice(0, 15)
          .map((m: any) => ({ title: m.title, source: m.source, probability: +((m.yes_price || 0) * 100).toFixed(1), volume: m.volume, category: m.category }));

        // 6. Cross-source comparison
        const titleMap = new Map<string, Map<string, number>>();
        mkts.forEach((m: any) => {
          if (m.yes_price == null) return;
          const key = (m.candidate_name || m.title).toLowerCase().trim();
          if (!titleMap.has(key)) titleMap.set(key, new Map());
          titleMap.get(key)!.set(m.source, +((m.yes_price || 0) * 100).toFixed(1));
        });
        const crossSource: any[] = [];
        titleMap.forEach((sources, key) => {
          if (sources.size >= 2) {
            const entry: any = { market: key, sources: Object.fromEntries(sources) };
            const vals = [...sources.values()];
            entry.spread = +(Math.max(...vals) - Math.min(...vals)).toFixed(1);
            crossSource.push(entry);
          }
        });
        crossSource.sort((a, b) => b.spread - a.spread);

        // 7. State heatmap
        const stateAgg: Record<string, { count: number; totalProb: number }> = {};
        mkts.forEach((m: any) => {
          if (!m.state_abbr || m.yes_price == null) return;
          if (!stateAgg[m.state_abbr]) stateAgg[m.state_abbr] = { count: 0, totalProb: 0 };
          stateAgg[m.state_abbr].count++;
          stateAgg[m.state_abbr].totalProb += (m.yes_price || 0) * 100;
        });
        const stateHeatmap = Object.entries(stateAgg)
          .map(([state, data]) => ({ state, count: data.count, avg_probability: +(data.totalProb / data.count).toFixed(1) }))
          .sort((a, b) => b.count - a.count);

        // 8. Highest and lowest probability
        const sorted2 = [...mkts].filter((m: any) => m.yes_price != null && m.yes_price > 0 && m.yes_price < 1)
          .sort((a: any, b: any) => (b.yes_price || 0) - (a.yes_price || 0));
        const highest = sorted2.slice(0, 5).map((m: any) => ({ title: m.title, source: m.source, probability: +((m.yes_price || 0) * 100).toFixed(1) }));
        const lowest = sorted2.slice(-5).reverse().map((m: any) => ({ title: m.title, source: m.source, probability: +((m.yes_price || 0) * 100).toFixed(1) }));

        // 9. Scatter data (volume vs probability)
        const scatterData = mkts
          .filter((m: any) => m.yes_price != null && m.volume != null && m.volume > 0)
          .map((m: any) => ({ probability: +((m.yes_price || 0) * 100).toFixed(1), volume: m.volume, source: m.source, liquidity: m.liquidity || 0 }));

        supabase.rpc("log_api_request", { p_key_id: keyId, p_user_id: userId, p_endpoint: "prediction-markets-charts", p_status: 200 }).then(() => {});

        return new Response(
          JSON.stringify({
            charts: {
              source_breakdown: { description: "Market count, avg probability, and total volume per platform", data: sourceBreakdown },
              category_breakdown: { description: "Market count and volume per category (president, senate, house, etc.)", data: categoryBreakdown },
              probability_distribution: { description: "Number of markets in each 10% probability bucket", data: probDist },
              top_by_probability: { description: "Top 15 markets by YES probability", data: topByProb },
              top_by_volume: { description: "Top 15 markets by trading volume", data: topByVolume },
              cross_source_comparison: { description: "Markets listed on multiple platforms with price spreads (arbitrage opportunities)", data: crossSource.slice(0, 20) },
              state_heatmap: { description: "Market coverage and avg probability per state", data: stateHeatmap },
              extremes: { description: "Highest and lowest probability markets", data: { highest, lowest } },
              scatter: { description: "Volume vs probability for all markets (for scatter plots)", data: scatterData },
            },
            meta: {
              total_markets: mkts.length,
              total_sources: [...new Set(mkts.map((m: any) => m.source))].length,
              sources: [...new Set(mkts.map((m: any) => m.source))],
              categories: [...new Set(mkts.map((m: any) => m.category))],
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
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

      case "messaging-guidance": {
        let q = supabase
          .from("messaging_guidance")
          .select("id,title,slug,source,source_url,author,published_date,summary,content,issue_areas,research_type,created_at,updated_at", { count: "exact" })
          .range(offset, offset + limit - 1)
          .order("published_date", { ascending: false });
        if (searchQuery) q = q.or(`title.ilike.%${searchQuery}%,summary.ilike.%${searchQuery}%`);
        const issueArea = url.searchParams.get("issue_area");
        if (issueArea) q = q.contains("issue_areas", [issueArea]);
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

      case "congress-members": {
        let q = supabase
          .from("congress_members")
          .select("id,bioguide_id,name,first_name,last_name,party,state,district,chamber,congress,depiction_url,official_url,candidate_slug", { count: "exact" })
          .range(offset, offset + limit - 1)
          .order("name");
        if (stateFilter) q = q.eq("state", stateFilter);
        if (searchQuery) q = q.or(`name.ilike.%${searchQuery}%,bioguide_id.ilike.%${searchQuery}%,state.ilike.%${searchQuery}%`);
        if (chamber) q = q.eq("chamber", chamber);
        const { data, error, count } = await q;
        if (error) throw error;
        result = { data, count };
        break;
      }

      case "congress-bills": {
        let q = supabase
          .from("congress_bills")
          .select("id,bill_id,bill_type,bill_number,congress,title,short_title,sponsor_name,sponsor_bioguide_id,status,policy_area,origin_chamber,introduced_date,latest_action_date,latest_action_text,cosponsor_count", { count: "exact" })
          .range(offset, offset + limit - 1)
          .order("latest_action_date", { ascending: false });
        if (searchQuery) q = q.or(`title.ilike.%${searchQuery}%,short_title.ilike.%${searchQuery}%,sponsor_name.ilike.%${searchQuery}%,bill_id.ilike.%${searchQuery}%`);
        const congressParam = url.searchParams.get("congress");
        if (congressParam) q = q.eq("congress", parseInt(congressParam));
        const policyArea = url.searchParams.get("policy_area");
        if (policyArea) q = q.ilike("policy_area", `%${policyArea}%`);
        const { data, error, count } = await q;
        if (error) throw error;
        result = { data, count };
        break;
      }

      case "campaign-finance": {
        let q = supabase
          .from("campaign_finance")
          .select("id,candidate_name,candidate_slug,state_abbr,district,party,office,cycle,total_raised,total_spent,cash_on_hand,total_debt,individual_contributions,pac_contributions,self_funding,small_dollar_pct,large_donor_pct,out_of_state_pct,filing_date", { count: "exact" })
          .range(offset, offset + limit - 1)
          .order("total_raised", { ascending: false });
        if (stateFilter) q = q.eq("state_abbr", stateFilter);
        if (searchQuery) q = q.or(`candidate_name.ilike.%${searchQuery}%,state_abbr.ilike.%${searchQuery}%,district.ilike.%${searchQuery}%`);
        const cycleParam = url.searchParams.get("cycle");
        if (cycleParam) q = q.eq("cycle", parseInt(cycleParam));
        const officeParam = url.searchParams.get("office");
        if (officeParam) q = q.eq("office", officeParam);
        const { data, error, count } = await q;
        if (error) throw error;
        result = { data, count };
        break;
      }

      case "election-forecasts": {
        let q = supabase
          .from("election_forecasts")
          .select("id,source,state_abbr,district,race_type,rating,cycle,dem_win_prob,rep_win_prob,dem_vote_share,rep_vote_share,margin,last_updated", { count: "exact" })
          .range(offset, offset + limit - 1)
          .order("state_abbr");
        if (stateFilter) q = q.eq("state_abbr", stateFilter);
        const raceType = url.searchParams.get("race_type");
        if (raceType) q = q.eq("race_type", raceType);
        const forecastCycle = url.searchParams.get("cycle");
        q = q.eq("cycle", forecastCycle ? parseInt(forecastCycle) : 2026);
        if (searchQuery) q = q.or(`state_abbr.ilike.%${searchQuery}%,district.ilike.%${searchQuery}%,rating.ilike.%${searchQuery}%`);
        const forecastSource = url.searchParams.get("source");
        if (forecastSource) q = q.eq("source", forecastSource);
        const { data, error, count } = await q;
        if (error) throw error;
        result = { data, count };
        break;
      }

      case "congressional-elections": {
        let q = supabase
          .from("congressional_election_results")
          .select("id,candidate_name,state_abbr,district_number,party,election_year,election_type,election_date,votes,vote_pct,total_votes,is_winner,is_incumbent,is_write_in", { count: "exact" })
          .range(offset, offset + limit - 1)
          .order("election_year", { ascending: false });
        if (stateFilter) q = q.eq("state_abbr", stateFilter);
        if (searchQuery) q = q.or(`candidate_name.ilike.%${searchQuery}%,state_abbr.ilike.%${searchQuery}%`);
        const congElYear = url.searchParams.get("year");
        if (congElYear) q = q.eq("election_year", parseInt(congElYear));
        const congDistrict = url.searchParams.get("district");
        if (congDistrict) q = q.eq("district_number", congDistrict);
        const { data, error, count } = await q;
        if (error) throw error;
        result = { data, count };
        break;
      }

      case "state-finance": {
        let q = supabase
          .from("state_cfb_candidates")
          .select("id,candidate_name,state_abbr,chamber,party,office,committee_name,reg_num,total_contributions,total_expenditures,net_cash,in_kind_total,contribution_count,expenditure_count,years_active", { count: "exact" })
          .range(offset, offset + limit - 1)
          .order("total_contributions", { ascending: false });
        if (stateFilter) q = q.eq("state_abbr", stateFilter);
        if (searchQuery) q = q.or(`candidate_name.ilike.%${searchQuery}%,state_abbr.ilike.%${searchQuery}%,committee_name.ilike.%${searchQuery}%`);
        if (chamber) q = q.eq("chamber", chamber);
        const { data, error, count } = await q;
        if (error) throw error;
        result = { data, count };
        break;
      }

      case "mn-finance": {
        let q = supabase
          .from("mn_cfb_candidates")
          .select("id,candidate_name,chamber,committee_name,reg_num,total_contributions,total_expenditures,net_cash,in_kind_total,contribution_count,expenditure_count,years_active", { count: "exact" })
          .range(offset, offset + limit - 1)
          .order("total_contributions", { ascending: false });
        if (searchQuery) q = q.or(`candidate_name.ilike.%${searchQuery}%,committee_name.ilike.%${searchQuery}%`);
        if (chamber) q = q.eq("chamber", chamber);
        const { data, error, count } = await q;
        if (error) throw error;
        result = { data, count };
        break;
      }

      case "intel-briefings": {
        let q = supabase
          .from("intel_briefings")
          .select("id,title,summary,content,scope,category,source_name,source_url,region,published_at,created_at,updated_at", { count: "exact" })
          .range(offset, offset + limit - 1)
          .order("published_at", { ascending: false });
        if (searchQuery) q = q.or(`title.ilike.%${searchQuery}%,summary.ilike.%${searchQuery}%,source_name.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%`);
        const scopeParam = url.searchParams.get("scope");
        if (scopeParam) q = q.eq("scope", scopeParam);
        const catParam2 = url.searchParams.get("category");
        if (catParam2) q = q.eq("category", catParam2);
        const { data, error, count } = await q;
        if (error) throw error;
        result = { data, count };
        break;
      }

      case "tracked-bills": {
        let q = supabase
          .from("tracked_bills")
          .select("id,bill_number,title,state,status_desc,last_action,last_action_date,bill_id,session_id,url", { count: "exact" })
          .range(offset, offset + limit - 1)
          .order("last_action_date", { ascending: false });
        if (searchQuery) q = q.or(`title.ilike.%${searchQuery}%,bill_number.ilike.%${searchQuery}%,state.ilike.%${searchQuery}%`);
        if (stateFilter) q = q.eq("state", stateFilter);
        const { data, error, count } = await q;
        if (error) throw error;
        result = { data, count };
        break;
      }

      case "mit-elections": {
        let q = supabase
          .from("mit_election_results")
          .select("id,candidate,state,state_po,office,year,party,district,county_name,county_fips,candidatevotes,totalvotes,stage,special,writein", { count: "exact" })
          .range(offset, offset + limit - 1)
          .order("year", { ascending: false });
        if (searchQuery) q = q.or(`candidate.ilike.%${searchQuery}%,state.ilike.%${searchQuery}%,state_po.ilike.%${searchQuery}%`);
        if (stateFilter) q = q.eq("state_po", stateFilter);
        const yearParam = url.searchParams.get("year");
        if (yearParam) q = q.eq("year", parseInt(yearParam));
        const officeParam2 = url.searchParams.get("office");
        if (officeParam2) q = q.ilike("office", `%${officeParam2}%`);
        const { data, error, count } = await q;
        if (error) throw error;
        result = { data, count };
        break;
      }

      case "congress-committees": {
        let q = supabase
          .from("congress_committees")
          .select("id,system_code,name,chamber,committee_type,parent_system_code,url,subcommittees,members", { count: "exact" })
          .range(offset, offset + limit - 1)
          .order("name");
        if (searchQuery) q = q.or(`name.ilike.%${searchQuery}%,system_code.ilike.%${searchQuery}%`);
        if (chamber) q = q.eq("chamber", chamber);
        const { data, error, count } = await q;
        if (error) throw error;
        result = { data, count };
        break;
      }

      case "congress-votes": {
        let q = supabase
          .from("congress_votes")
          .select("id,vote_id,congress,session,chamber,roll_number,vote_date,question,description,result,bill_id,yea_total,nay_total,not_voting_total,present_total", { count: "exact" })
          .range(offset, offset + limit - 1)
          .order("vote_date", { ascending: false });
        if (searchQuery) q = q.or(`description.ilike.%${searchQuery}%,question.ilike.%${searchQuery}%,bill_id.ilike.%${searchQuery}%`);
        const congressParam2 = url.searchParams.get("congress");
        if (congressParam2) q = q.eq("congress", parseInt(congressParam2));
        if (chamber) q = q.eq("chamber", chamber);
        const { data, error, count } = await q;
        if (error) throw error;
        result = { data, count };
        break;
      }

      case "state-leg-elections": {
        let q = supabase
          .from("state_leg_election_results")
          .select("id,candidate_name,state_abbr,chamber,district_number,election_year,election_type,election_date,party,votes,vote_pct,total_votes,is_winner,is_incumbent,turnout", { count: "exact" })
          .range(offset, offset + limit - 1)
          .order("election_year", { ascending: false });
        if (stateFilter) q = q.eq("state_abbr", stateFilter);
        if (chamber) q = q.eq("chamber", chamber);
        if (searchQuery) q = q.or(`candidate_name.ilike.%${searchQuery}%,state_abbr.ilike.%${searchQuery}%`);
        const yearParam2 = url.searchParams.get("year");
        if (yearParam2) q = q.eq("election_year", parseInt(yearParam2));
        const districtParam = url.searchParams.get("district");
        if (districtParam) q = q.eq("district_number", districtParam);
        const { data, error, count } = await q;
        if (error) throw error;
        result = { data, count };
        break;
      }

      case "forecast-history": {
        let q = supabase
          .from("election_forecast_history")
          .select("id,forecast_id,source,race_type,state_abbr,district,cycle,old_rating,new_rating,changed_at", { count: "exact" })
          .range(offset, offset + limit - 1)
          .order("changed_at", { ascending: false });
        if (stateFilter) q = q.eq("state_abbr", stateFilter);
        if (searchQuery) q = q.or(`state_abbr.ilike.%${searchQuery}%,source.ilike.%${searchQuery}%`);
        const raceType2 = url.searchParams.get("race_type");
        if (raceType2) q = q.eq("race_type", raceType2);
        const cycleParam = url.searchParams.get("cycle");
        q = q.eq("cycle", cycleParam ? parseInt(cycleParam) : 2026);
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
          "local_impacts", "voter_stats", "mn_finance",
          "prediction_markets", "messaging_guidance",
          "intel_briefings", "tracked_bills", "mit_elections",
          "congress_committees", "congress_votes", "state_leg_elections",
          "forecast_history",
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
        if (activeCategories.includes("mn_finance")) {
          categoryQueries.mn_finance = supabase.from("mn_cfb_candidates")
            .select("id,candidate_name,chamber,committee_name,total_contributions,total_expenditures,net_cash")
            .or(`candidate_name.ilike.${likeQ},committee_name.ilike.${likeQ}`)
            .order("total_contributions", { ascending: false }).limit(perCategoryLimit)
            .then(r => ({ data: r.data || [], label: "MN Campaign Finance" }));
        }
        if (activeCategories.includes("prediction_markets")) {
          categoryQueries.prediction_markets = supabase.from("prediction_markets")
            .select("id,title,source,category,yes_price,volume,state_abbr,candidate_name,status")
            .eq("status", "active")
            .or(`title.ilike.${likeQ},candidate_name.ilike.${likeQ}`)
            .order("volume", { ascending: false }).limit(perCategoryLimit)
            .then(r => ({ data: r.data || [], label: "Prediction Markets" }));
        }
        if (activeCategories.includes("messaging_guidance")) {
          categoryQueries.messaging_guidance = supabase.from("messaging_guidance")
            .select("id,title,slug,source,author,published_date,summary,issue_areas")
            .or(`title.ilike.${likeQ},summary.ilike.${likeQ},author.ilike.${likeQ}`)
            .order("published_date", { ascending: false }).limit(perCategoryLimit)
            .then(r => ({ data: r.data || [], label: "Messaging Guidance" }));
        }
        if (activeCategories.includes("intel_briefings")) {
          categoryQueries.intel_briefings = supabase.from("intel_briefings")
            .select("id,title,summary,scope,category,source_name,published_at")
            .or(`title.ilike.${likeQ},summary.ilike.${likeQ},source_name.ilike.${likeQ},category.ilike.${likeQ}`)
            .order("published_at", { ascending: false }).limit(perCategoryLimit)
            .then(r => ({ data: r.data || [], label: "Intel Briefings" }));
        }
        if (activeCategories.includes("tracked_bills")) {
          categoryQueries.tracked_bills = supabase.from("tracked_bills")
            .select("id,bill_number,title,state,status_desc,last_action_date")
            .or(`title.ilike.${likeQ},bill_number.ilike.${likeQ},state.ilike.${likeQ}`)
            .order("last_action_date", { ascending: false }).limit(perCategoryLimit)
            .then(r => ({ data: r.data || [], label: "Tracked Bills (LegiScan)" }));
        }
        if (activeCategories.includes("mit_elections")) {
          categoryQueries.mit_elections = supabase.from("mit_election_results")
            .select("id,candidate,state,state_po,office,year,party,candidatevotes,totalvotes")
            .or(`candidate.ilike.${likeQ},state.ilike.${likeQ},state_po.ilike.${likeQ}`)
            .order("year", { ascending: false }).limit(perCategoryLimit)
            .then(r => ({ data: r.data || [], label: "MIT Election History" }));
        }
        if (activeCategories.includes("congress_committees")) {
          categoryQueries.congress_committees = supabase.from("congress_committees")
            .select("id,system_code,name,chamber")
            .or(`name.ilike.${likeQ},system_code.ilike.${likeQ}`)
            .order("name").limit(perCategoryLimit)
            .then(r => ({ data: r.data || [], label: "Congress Committees" }));
        }
        if (activeCategories.includes("congress_votes")) {
          categoryQueries.congress_votes = supabase.from("congress_votes")
            .select("id,vote_id,chamber,vote_date,question,result,bill_id,yea_total,nay_total")
            .or(`description.ilike.${likeQ},question.ilike.${likeQ},bill_id.ilike.${likeQ}`)
            .order("vote_date", { ascending: false }).limit(perCategoryLimit)
            .then(r => ({ data: r.data || [], label: "Congress Votes" }));
        }
        if (activeCategories.includes("state_leg_elections")) {
          categoryQueries.state_leg_elections = supabase.from("state_leg_election_results")
            .select("id,candidate_name,state_abbr,chamber,district_number,election_year,party,votes,vote_pct,is_winner")
            .or(`candidate_name.ilike.${likeQ},state_abbr.ilike.${likeQ}`)
            .order("election_year", { ascending: false }).limit(perCategoryLimit)
            .then(r => ({ data: r.data || [], label: "State Leg Elections" }));
        }
        if (activeCategories.includes("forecast_history")) {
          categoryQueries.forecast_history = supabase.from("election_forecast_history")
            .select("id,source,state_abbr,district,race_type,old_rating,new_rating,changed_at")
            .or(`state_abbr.ilike.${likeQ},source.ilike.${likeQ}`)
            .eq("cycle", 2026)
            .order("changed_at", { ascending: false }).limit(perCategoryLimit)
            .then(r => ({ data: r.data || [], label: "Forecast Rating Changes" }));
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
    "polling-charts": "Pre-aggregated polling chart data: approval trends, rolling averages, demographic breakdowns, source comparisons, methodology breakdown",
    "prediction-markets": "Real-time prediction market data from Polymarket, Kalshi, Metaculus, Manifold, PredictIt",
    "prediction-markets-charts": "Pre-aggregated prediction market chart data: source/category breakdowns, probability distributions, cross-source comparisons, state heatmaps, scatter data",
    "maga-files": "MAGA-related research files",
    "narrative-reports": "Narrative research reports",
    "local-impacts": "Local impact analyses by state",
    "messaging-guidance": "Polling-based messaging guidance from Navigator Research and other sources (supports ?issue_area= filter)",
    "voter-registration-stats": "State voter registration statistics with registration rates and turnout data",
    "congress-members": "Current Congress members with party, state, district, and committee data",
    "congress-bills": "Federal legislation with sponsors, status, and policy areas",
    "campaign-finance": "Federal campaign finance data from FEC filings",
    "election-forecasts": "Election race ratings and forecasts from Cook, Sabato, etc.",
    "congressional-elections": "Congressional election results with vote counts and winners",
    "state-finance": "State-level campaign finance data across all states",
    "mn-finance": "Minnesota Campaign Finance Board candidate data",
    "intel-briefings": "Intelligence briefings from 150+ news sources categorized by scope and topic",
    "tracked-bills": "LegiScan tracked state legislation with status and actions",
    "mit-elections": "MIT Election Lab historical election results (1976-2024) with county-level data",
    "congress-committees": "Congressional committees with members and subcommittees",
    "congress-votes": "Congressional roll call votes with vote totals and results",
    "state-leg-elections": "State legislative election results with vote counts and winners",
    "forecast-history": "Historical changes in election forecast ratings over time",
    search: "Unified search across all 24 databases (requires ?search= param, optional ?categories= filter)",
  };
  return descs[endpoint] || "";
}
