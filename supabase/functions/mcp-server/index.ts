import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { McpServer, StreamableHttpTransport } from "https://esm.sh/mcp-lite@0.10.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const app = new Hono();

// --- Authentication: require a valid API key (same as public-api) ---
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

app.use("/*", async (c, next) => {
  // Allow CORS preflight
  if (c.req.method === "OPTIONS") {
    return c.newResponse(null, 204);
  }

  const apiKey = c.req.header("X-API-Key") || c.req.header("Authorization")?.replace("Bearer ", "");
  if (!apiKey) {
    return c.json({ error: "Missing API key. Provide via X-API-Key header." }, 401);
  }

  const keyHash = await hashKey(apiKey);
  const { data: keyData, error: keyError } = await supabase.rpc("validate_api_key", {
    p_key_hash: keyHash,
  });

  if (keyError || !keyData || keyData.length === 0) {
    return c.json({ error: "Invalid or revoked API key" }, 403);
  }

  // Verify user has premium or admin role
  const userId = keyData[0].user_id;
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  const hasPremiumAccess = roles?.some(
    (r: { role: string }) => r.role === "premium" || r.role === "admin"
  );
  if (!hasPremiumAccess) {
    return c.json({ error: "Premium or admin role required for MCP access" }, 403);
  }

  // Log the request
  supabase.rpc("log_api_request", {
    p_key_id: keyData[0].key_id,
    p_user_id: userId,
    p_endpoint: "mcp-server",
    p_status: 200,
  }).then(() => {});

  await next();
});

const mcpServer = new McpServer({
  name: "ordb-mcp-server",
  version: "1.0.0",
});

mcpServer.tool("search_candidates", {
  description: "Search opposition research candidate profiles. Returns name, slug, content. Use 'search' to filter by name.",
  inputSchema: {
    type: "object" as const,
    properties: {
      search: { type: "string" as const, description: "Filter candidates by name" },
      limit: { type: "number" as const, description: "Max results (default 20, max 100)" },
      offset: { type: "number" as const, description: "Pagination offset" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const search = args.search as string | undefined;
    const limit = Math.min((args.limit as number) || 20, 100);
    const offset = (args.offset as number) || 0;
    let q = supabase
      .from("candidate_profiles")
      .select("name,slug,is_subpage,subpage_title,parent_slug,content,updated_at", { count: "exact" })
      .range(offset, offset + limit - 1)
      .order("name");
    if (search) q = q.ilike("name", `%${search}%`);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

mcpServer.tool("get_candidate", {
  description: "Get a specific candidate profile by slug with full opposition research content.",
  inputSchema: {
    type: "object" as const,
    properties: {
      slug: { type: "string" as const, description: "Candidate slug (e.g. 'john-doe')" },
    },
    required: ["slug"],
  },
  handler: async (args: Record<string, unknown>) => {
    const slug = args.slug as string;
    const { data, error } = await supabase.from("candidate_profiles").select("*").eq("slug", slug);
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    if (!data?.length) return { content: [{ type: "text" as const, text: `No candidate found: ${slug}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("search_congressional_districts", {
  description: "Search congressional district demographic profiles with census data (population, income, race, education, housing).",
  inputSchema: {
    type: "object" as const,
    properties: {
      state: { type: "string" as const, description: "State abbreviation (e.g. 'CA')" },
      search: { type: "string" as const, description: "Search by district ID" },
      limit: { type: "number" as const, description: "Max results (default 20, max 100)" },
      offset: { type: "number" as const, description: "Pagination offset" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const state = args.state as string | undefined;
    const search = args.search as string | undefined;
    const limit = Math.min((args.limit as number) || 20, 100);
    const offset = (args.offset as number) || 0;
    let q = supabase.from("district_profiles").select("*", { count: "exact" }).range(offset, offset + limit - 1).order("district_id");
    if (state) q = q.eq("state", state.toUpperCase());
    if (search) q = q.ilike("district_id", `%${search}%`);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

mcpServer.tool("search_state_legislative", {
  description: "Search state legislative district profiles (house/senate) with census data for all 50 states (~9,300 districts).",
  inputSchema: {
    type: "object" as const,
    properties: {
      state: { type: "string" as const, description: "State abbreviation (e.g. 'FL')" },
      chamber: { type: "string" as const, description: "'house' or 'senate'" },
      limit: { type: "number" as const, description: "Max results (default 20, max 100)" },
      offset: { type: "number" as const, description: "Pagination offset" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const state = args.state as string | undefined;
    const chamber = args.chamber as string | undefined;
    const limit = Math.min((args.limit as number) || 20, 100);
    const offset = (args.offset as number) || 0;
    let q = supabase.from("state_legislative_profiles").select("*", { count: "exact" }).range(offset, offset + limit - 1).order("district_id");
    if (state) q = q.eq("state_abbr", state.toUpperCase());
    if (chamber) q = q.eq("chamber", chamber.toLowerCase());
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

mcpServer.tool("get_election_results", {
  description: "Get state legislative election results with vote counts, percentages, and winners. Filter by state, chamber, district, year.",
  inputSchema: {
    type: "object" as const,
    properties: {
      state: { type: "string" as const, description: "State abbreviation (e.g. 'FL')" },
      chamber: { type: "string" as const, description: "'house' or 'senate'" },
      district: { type: "string" as const, description: "District number" },
      year: { type: "number" as const, description: "Election year (e.g. 2022)" },
      limit: { type: "number" as const, description: "Max results (default 50, max 200)" },
      offset: { type: "number" as const, description: "Pagination offset" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const state = args.state as string | undefined;
    const chamber = args.chamber as string | undefined;
    const district = args.district as string | undefined;
    const year = args.year as number | undefined;
    const limit = Math.min((args.limit as number) || 50, 200);
    const offset = (args.offset as number) || 0;
    let q = supabase.from("state_leg_election_results").select("*", { count: "exact" }).range(offset, offset + limit - 1).order("election_year", { ascending: false });
    if (state) q = q.eq("state_abbr", state.toUpperCase());
    if (chamber) q = q.eq("chamber", chamber.toLowerCase());
    if (district) q = q.eq("district_number", district.replace(/^0+/, "") || "0");
    if (year) q = q.eq("election_year", year);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

mcpServer.tool("get_polling_data", {
  description: "Get polling data with approval/favorability ratings, methodology, and margins.",
  inputSchema: {
    type: "object" as const,
    properties: {
      search: { type: "string" as const, description: "Search by candidate or topic name" },
      limit: { type: "number" as const, description: "Max results (default 20, max 100)" },
      offset: { type: "number" as const, description: "Pagination offset" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const search = args.search as string | undefined;
    const limit = Math.min((args.limit as number) || 20, 100);
    const offset = (args.offset as number) || 0;
    let q = supabase.from("polling_data").select("*", { count: "exact" }).range(offset, offset + limit - 1).order("date_conducted", { ascending: false });
    if (search) q = q.ilike("candidate_or_topic", `%${search}%`);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

mcpServer.tool("get_maga_files", {
  description: "Get vetting reports on Trump administration executive branch appointees. Search by name or get by slug.",
  inputSchema: {
    type: "object" as const,
    properties: {
      search: { type: "string" as const, description: "Search by appointee name" },
      slug: { type: "string" as const, description: "Get specific report by slug" },
      limit: { type: "number" as const, description: "Max results (default 20, max 100)" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const search = args.search as string | undefined;
    const slug = args.slug as string | undefined;
    const limit = Math.min((args.limit as number) || 20, 100);
    if (slug) {
      const { data, error } = await supabase.from("maga_files").select("*").eq("slug", slug);
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
    let q = supabase.from("maga_files").select("id,name,slug,updated_at", { count: "exact" }).range(0, limit - 1).order("name");
    if (search) q = q.ilike("name", `%${search}%`);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

mcpServer.tool("get_narrative_reports", {
  description: "Get issue-based policy reports on Trump administration impacts (housing, healthcare, education, retirement, etc).",
  inputSchema: {
    type: "object" as const,
    properties: {
      search: { type: "string" as const, description: "Search by report topic" },
      slug: { type: "string" as const, description: "Get specific report by slug" },
      limit: { type: "number" as const, description: "Max results (default 20, max 100)" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const search = args.search as string | undefined;
    const slug = args.slug as string | undefined;
    const limit = Math.min((args.limit as number) || 20, 100);
    if (slug) {
      const { data, error } = await supabase.from("narrative_reports").select("*").eq("slug", slug);
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
    let q = supabase.from("narrative_reports").select("id,name,slug,updated_at", { count: "exact" }).range(0, limit - 1).order("name");
    if (search) q = q.ilike("name", `%${search}%`);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

mcpServer.tool("get_local_impacts", {
  description: "Get state-specific analyses of Trump administration policy impacts for all 50 states.",
  inputSchema: {
    type: "object" as const,
    properties: {
      state: { type: "string" as const, description: "State name or abbreviation" },
      limit: { type: "number" as const, description: "Max results (default 20, max 50)" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const state = args.state as string | undefined;
    const limit = Math.min((args.limit as number) || 20, 50);
    let q = supabase.from("local_impacts").select("id,state,slug,summary,updated_at", { count: "exact" }).range(0, limit - 1).order("state");
    if (state) q = q.ilike("state", `%${state}%`);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

mcpServer.tool("get_voter_registration_stats", {
  description: "Get state-level voter registration statistics including total registered, eligible voters, registration rates, and 2024 general election turnout.",
  inputSchema: {
    type: "object" as const,
    properties: {
      state: { type: "string" as const, description: "Filter by state name or abbreviation (e.g. 'Minnesota' or 'MN')" },
      limit: { type: "number" as const, description: "Max results (default 50, max 100)" },
      offset: { type: "number" as const, description: "Pagination offset" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const state = args.state as string | undefined;
    const limit = Math.min((args.limit as number) || 50, 100);
    const offset = (args.offset as number) || 0;
    let q = supabase
      .from("state_voter_stats")
      .select("*", { count: "exact" })
      .range(offset, offset + limit - 1)
      .order("total_registered", { ascending: false });
    if (state) q = q.ilike("state", `%${state}%`);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

mcpServer.tool("get_congress_members", {
  description: "Search current Congress members by name, state, party, chamber. Returns bioguide ID, party, state, district, and more.",
  inputSchema: {
    type: "object" as const,
    properties: {
      search: { type: "string" as const, description: "Search by name, state, or bioguide ID" },
      state: { type: "string" as const, description: "Filter by state abbreviation (e.g. 'CA')" },
      chamber: { type: "string" as const, description: "'house' or 'senate'" },
      party: { type: "string" as const, description: "Filter by party (e.g. 'Republican', 'Democrat')" },
      limit: { type: "number" as const, description: "Max results (default 20, max 100)" },
      offset: { type: "number" as const, description: "Pagination offset" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const search = args.search as string | undefined;
    const state = args.state as string | undefined;
    const chamber = args.chamber as string | undefined;
    const party = args.party as string | undefined;
    const limit = Math.min((args.limit as number) || 20, 100);
    const offset = (args.offset as number) || 0;
    let q = supabase.from("congress_members")
      .select("id,bioguide_id,name,first_name,last_name,party,state,district,chamber,congress,depiction_url,official_url,candidate_slug", { count: "exact" })
      .range(offset, offset + limit - 1).order("name");
    if (search) q = q.or(`name.ilike.%${search}%,bioguide_id.ilike.%${search}%,state.ilike.%${search}%`);
    if (state) q = q.eq("state", state.toUpperCase());
    if (chamber) q = q.eq("chamber", chamber.toLowerCase());
    if (party) q = q.ilike("party", `%${party}%`);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

mcpServer.tool("get_congress_bills", {
  description: "Search federal legislation (bills/resolutions) by title, sponsor, bill ID. Filter by congress number and policy area.",
  inputSchema: {
    type: "object" as const,
    properties: {
      search: { type: "string" as const, description: "Search by title, sponsor name, or bill ID" },
      congress: { type: "number" as const, description: "Congress number (e.g. 119)" },
      policy_area: { type: "string" as const, description: "Filter by policy area" },
      limit: { type: "number" as const, description: "Max results (default 20, max 100)" },
      offset: { type: "number" as const, description: "Pagination offset" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const search = args.search as string | undefined;
    const congress = args.congress as number | undefined;
    const policyArea = args.policy_area as string | undefined;
    const limit = Math.min((args.limit as number) || 20, 100);
    const offset = (args.offset as number) || 0;
    let q = supabase.from("congress_bills")
      .select("id,bill_id,bill_type,bill_number,congress,title,short_title,sponsor_name,status,policy_area,introduced_date,latest_action_date,latest_action_text,cosponsor_count", { count: "exact" })
      .range(offset, offset + limit - 1).order("latest_action_date", { ascending: false });
    if (search) q = q.or(`title.ilike.%${search}%,short_title.ilike.%${search}%,sponsor_name.ilike.%${search}%,bill_id.ilike.%${search}%`);
    if (congress) q = q.eq("congress", congress);
    if (policyArea) q = q.ilike("policy_area", `%${policyArea}%`);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

mcpServer.tool("get_campaign_finance", {
  description: "Get federal campaign finance data from FEC filings. Search by candidate name, filter by state, office, and election cycle.",
  inputSchema: {
    type: "object" as const,
    properties: {
      search: { type: "string" as const, description: "Search by candidate name" },
      state: { type: "string" as const, description: "Filter by state abbreviation" },
      office: { type: "string" as const, description: "Filter by office: 'house', 'senate', or 'president'" },
      cycle: { type: "number" as const, description: "Election cycle year (default 2026)" },
      limit: { type: "number" as const, description: "Max results (default 20, max 100)" },
      offset: { type: "number" as const, description: "Pagination offset" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const search = args.search as string | undefined;
    const state = args.state as string | undefined;
    const office = args.office as string | undefined;
    const cycle = args.cycle as number | undefined;
    const limit = Math.min((args.limit as number) || 20, 100);
    const offset = (args.offset as number) || 0;
    let q = supabase.from("campaign_finance")
      .select("id,candidate_name,candidate_slug,state_abbr,district,party,office,cycle,total_raised,total_spent,cash_on_hand,total_debt,individual_contributions,pac_contributions,self_funding,small_dollar_pct,large_donor_pct,out_of_state_pct,filing_date", { count: "exact" })
      .range(offset, offset + limit - 1).order("total_raised", { ascending: false });
    if (search) q = q.or(`candidate_name.ilike.%${search}%,state_abbr.ilike.%${search}%`);
    if (state) q = q.eq("state_abbr", state.toUpperCase());
    if (office) q = q.eq("office", office);
    if (cycle) q = q.eq("cycle", cycle);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

mcpServer.tool("get_election_forecasts", {
  description: "Get election race ratings and forecasts from Cook Political Report, Sabato's Crystal Ball, etc. Filter by state, race type, and source.",
  inputSchema: {
    type: "object" as const,
    properties: {
      state: { type: "string" as const, description: "Filter by state abbreviation" },
      race_type: { type: "string" as const, description: "'house', 'senate', or 'governor'" },
      source: { type: "string" as const, description: "Filter by forecast source (e.g. 'cook', 'sabato')" },
      cycle: { type: "number" as const, description: "Election cycle year (default 2026)" },
      limit: { type: "number" as const, description: "Max results (default 50, max 200)" },
      offset: { type: "number" as const, description: "Pagination offset" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const state = args.state as string | undefined;
    const raceType = args.race_type as string | undefined;
    const source = args.source as string | undefined;
    const cycle = (args.cycle as number) || 2026;
    const limit = Math.min((args.limit as number) || 50, 200);
    const offset = (args.offset as number) || 0;
    let q = supabase.from("election_forecasts")
      .select("id,source,state_abbr,district,race_type,rating,cycle,dem_win_prob,rep_win_prob,dem_vote_share,rep_vote_share,margin,last_updated", { count: "exact" })
      .eq("cycle", cycle).range(offset, offset + limit - 1).order("state_abbr");
    if (state) q = q.eq("state_abbr", state.toUpperCase());
    if (raceType) q = q.eq("race_type", raceType);
    if (source) q = q.eq("source", source);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

mcpServer.tool("get_congressional_elections", {
  description: "Get congressional election results with vote counts, percentages, and winners. Filter by state, year, and district.",
  inputSchema: {
    type: "object" as const,
    properties: {
      search: { type: "string" as const, description: "Search by candidate name" },
      state: { type: "string" as const, description: "Filter by state abbreviation" },
      year: { type: "number" as const, description: "Election year" },
      district: { type: "string" as const, description: "District number" },
      limit: { type: "number" as const, description: "Max results (default 50, max 200)" },
      offset: { type: "number" as const, description: "Pagination offset" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const search = args.search as string | undefined;
    const state = args.state as string | undefined;
    const year = args.year as number | undefined;
    const district = args.district as string | undefined;
    const limit = Math.min((args.limit as number) || 50, 200);
    const offset = (args.offset as number) || 0;
    let q = supabase.from("congressional_election_results")
      .select("id,candidate_name,state_abbr,district_number,party,election_year,election_type,votes,vote_pct,total_votes,is_winner,is_incumbent", { count: "exact" })
      .range(offset, offset + limit - 1).order("election_year", { ascending: false });
    if (search) q = q.or(`candidate_name.ilike.%${search}%,state_abbr.ilike.%${search}%`);
    if (state) q = q.eq("state_abbr", state.toUpperCase());
    if (year) q = q.eq("election_year", year);
    if (district) q = q.eq("district_number", district);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

mcpServer.tool("get_state_finance", {
  description: "Get state-level campaign finance data across all states. Search by candidate, filter by state and chamber.",
  inputSchema: {
    type: "object" as const,
    properties: {
      search: { type: "string" as const, description: "Search by candidate or committee name" },
      state: { type: "string" as const, description: "Filter by state abbreviation" },
      chamber: { type: "string" as const, description: "Filter by chamber" },
      limit: { type: "number" as const, description: "Max results (default 20, max 100)" },
      offset: { type: "number" as const, description: "Pagination offset" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const search = args.search as string | undefined;
    const state = args.state as string | undefined;
    const chamber = args.chamber as string | undefined;
    const limit = Math.min((args.limit as number) || 20, 100);
    const offset = (args.offset as number) || 0;
    let q = supabase.from("state_cfb_candidates")
      .select("id,candidate_name,state_abbr,chamber,party,office,committee_name,total_contributions,total_expenditures,net_cash,in_kind_total,contribution_count,expenditure_count,years_active", { count: "exact" })
      .range(offset, offset + limit - 1).order("total_contributions", { ascending: false });
    if (search) q = q.or(`candidate_name.ilike.%${search}%,committee_name.ilike.%${search}%,state_abbr.ilike.%${search}%`);
    if (state) q = q.eq("state_abbr", state.toUpperCase());
    if (chamber) q = q.eq("chamber", chamber);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

mcpServer.tool("get_mn_finance", {
  description: "Get Minnesota Campaign Finance Board candidate data including contributions, expenditures, and committee info.",
  inputSchema: {
    type: "object" as const,
    properties: {
      search: { type: "string" as const, description: "Search by candidate or committee name" },
      chamber: { type: "string" as const, description: "Filter by chamber" },
      limit: { type: "number" as const, description: "Max results (default 20, max 100)" },
      offset: { type: "number" as const, description: "Pagination offset" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const search = args.search as string | undefined;
    const chamber = args.chamber as string | undefined;
    const limit = Math.min((args.limit as number) || 20, 100);
    const offset = (args.offset as number) || 0;
    let q = supabase.from("mn_cfb_candidates")
      .select("id,candidate_name,chamber,committee_name,reg_num,total_contributions,total_expenditures,net_cash,in_kind_total,contribution_count,expenditure_count,years_active", { count: "exact" })
      .range(offset, offset + limit - 1).order("total_contributions", { ascending: false });
    if (search) q = q.or(`candidate_name.ilike.%${search}%,committee_name.ilike.%${search}%`);
    if (chamber) q = q.eq("chamber", chamber);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

mcpServer.tool("get_prediction_markets", {
  description: "Get real-time prediction market data from Polymarket, Kalshi, Metaculus, Manifold, PredictIt. Filter by state, category, source.",
  inputSchema: {
    type: "object" as const,
    properties: {
      search: { type: "string" as const, description: "Search by market title or candidate name" },
      state: { type: "string" as const, description: "Filter by state abbreviation" },
      category: { type: "string" as const, description: "Filter by category: house, senate, president, governor" },
      source: { type: "string" as const, description: "Filter by source: polymarket, kalshi, metaculus, manifold, predictit" },
      limit: { type: "number" as const, description: "Max results (default 20, max 100)" },
      offset: { type: "number" as const, description: "Pagination offset" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const search = args.search as string | undefined;
    const state = args.state as string | undefined;
    const category = args.category as string | undefined;
    const source = args.source as string | undefined;
    const limit = Math.min((args.limit as number) || 20, 100);
    const offset = (args.offset as number) || 0;
    let q = supabase.from("prediction_markets")
      .select("id,market_id,source,title,category,state_abbr,district,candidate_name,yes_price,no_price,volume,liquidity,last_traded_at,market_url,status", { count: "exact" })
      .eq("status", "active").range(offset, offset + limit - 1).order("volume", { ascending: false });
    if (search) q = q.or(`title.ilike.%${search}%,candidate_name.ilike.%${search}%`);
    if (state) q = q.eq("state_abbr", state.toUpperCase());
    if (category) q = q.eq("category", category);
    if (source) q = q.eq("source", source);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

mcpServer.tool("get_messaging_guidance", {
  description: "Get polling-based messaging guidance and strategic communications research from multiple partisan and non-partisan sources.",
  inputSchema: {
    type: "object" as const,
    properties: {
      search: { type: "string" as const, description: "Search by title, summary, or author" },
      issue_area: { type: "string" as const, description: "Filter by issue area" },
      slug: { type: "string" as const, description: "Get specific report by slug" },
      limit: { type: "number" as const, description: "Max results (default 20, max 100)" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const search = args.search as string | undefined;
    const issueArea = args.issue_area as string | undefined;
    const slug = args.slug as string | undefined;
    const limit = Math.min((args.limit as number) || 20, 100);
    if (slug) {
      const { data, error } = await supabase.from("messaging_guidance").select("*").eq("slug", slug);
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
    let q = supabase.from("messaging_guidance")
      .select("id,title,slug,source,author,published_date,summary,issue_areas,research_type", { count: "exact" })
      .range(0, limit - 1).order("published_date", { ascending: false });
    if (search) q = q.or(`title.ilike.%${search}%,summary.ilike.%${search}%,author.ilike.%${search}%`);
    if (issueArea) q = q.contains("issue_areas", [issueArea]);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

mcpServer.tool("get_intel_briefings", {
  description: "Get intelligence briefings from 150+ news sources. Filter by scope (local/state/national/international), category, and search by title/source.",
  inputSchema: {
    type: "object" as const,
    properties: {
      search: { type: "string" as const, description: "Search by title, source, or category" },
      scope: { type: "string" as const, description: "Filter by scope: local, state, national, international" },
      category: { type: "string" as const, description: "Filter by category: economy, health, fiscal, infrastructure, etc." },
      limit: { type: "number" as const, description: "Max results (default 20, max 100)" },
      offset: { type: "number" as const, description: "Pagination offset" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const search = args.search as string | undefined;
    const scope = args.scope as string | undefined;
    const category = args.category as string | undefined;
    const limit = Math.min((args.limit as number) || 20, 100);
    const offset = (args.offset as number) || 0;
    let q = supabase.from("intel_briefings")
      .select("id,title,summary,scope,category,source_name,source_url,region,published_at", { count: "exact" })
      .range(offset, offset + limit - 1).order("published_at", { ascending: false });
    if (search) q = q.or(`title.ilike.%${search}%,summary.ilike.%${search}%,source_name.ilike.%${search}%,category.ilike.%${search}%`);
    if (scope) q = q.eq("scope", scope);
    if (category) q = q.eq("category", category);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

mcpServer.tool("get_tracked_bills", {
  description: "Get state-level tracked legislation from LegiScan. Search by title, bill number, or state.",
  inputSchema: {
    type: "object" as const,
    properties: {
      search: { type: "string" as const, description: "Search by title or bill number" },
      state: { type: "string" as const, description: "Filter by state abbreviation" },
      limit: { type: "number" as const, description: "Max results (default 20, max 100)" },
      offset: { type: "number" as const, description: "Pagination offset" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const search = args.search as string | undefined;
    const state = args.state as string | undefined;
    const limit = Math.min((args.limit as number) || 20, 100);
    const offset = (args.offset as number) || 0;
    let q = supabase.from("tracked_bills")
      .select("id,bill_number,title,state,status_desc,last_action,last_action_date,url", { count: "exact" })
      .range(offset, offset + limit - 1).order("last_action_date", { ascending: false });
    if (search) q = q.or(`title.ilike.%${search}%,bill_number.ilike.%${search}%,state.ilike.%${search}%`);
    if (state) q = q.eq("state", state.toUpperCase());
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

mcpServer.tool("get_mit_elections", {
  description: "Get MIT Election Lab historical election results (1976-2024) at county level. Filter by state, year, office.",
  inputSchema: {
    type: "object" as const,
    properties: {
      search: { type: "string" as const, description: "Search by candidate name or state" },
      state: { type: "string" as const, description: "Filter by state abbreviation (state_po)" },
      year: { type: "number" as const, description: "Filter by election year" },
      office: { type: "string" as const, description: "Filter by office (US PRESIDENT, US HOUSE, US SENATE)" },
      limit: { type: "number" as const, description: "Max results (default 50, max 200)" },
      offset: { type: "number" as const, description: "Pagination offset" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const search = args.search as string | undefined;
    const state = args.state as string | undefined;
    const year = args.year as number | undefined;
    const office = args.office as string | undefined;
    const limit = Math.min((args.limit as number) || 50, 200);
    const offset = (args.offset as number) || 0;
    let q = supabase.from("mit_election_results")
      .select("id,candidate,state,state_po,office,year,party,district,county_name,candidatevotes,totalvotes,stage,special", { count: "exact" })
      .range(offset, offset + limit - 1).order("year", { ascending: false });
    if (search) q = q.or(`candidate.ilike.%${search}%,state.ilike.%${search}%,state_po.ilike.%${search}%`);
    if (state) q = q.eq("state_po", state.toUpperCase());
    if (year) q = q.eq("year", year);
    if (office) q = q.ilike("office", `%${office}%`);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

mcpServer.tool("get_congress_committees", {
  description: "Get congressional committee data including members and subcommittees.",
  inputSchema: {
    type: "object" as const,
    properties: {
      search: { type: "string" as const, description: "Search by committee name or code" },
      chamber: { type: "string" as const, description: "Filter by chamber: house, senate, joint" },
      limit: { type: "number" as const, description: "Max results (default 20, max 100)" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const search = args.search as string | undefined;
    const chamber = args.chamber as string | undefined;
    const limit = Math.min((args.limit as number) || 20, 100);
    let q = supabase.from("congress_committees")
      .select("id,system_code,name,chamber,committee_type,url,subcommittees,members", { count: "exact" })
      .range(0, limit - 1).order("name");
    if (search) q = q.or(`name.ilike.%${search}%,system_code.ilike.%${search}%`);
    if (chamber) q = q.eq("chamber", chamber);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

mcpServer.tool("get_congress_votes", {
  description: "Get congressional roll call votes with results. Filter by congress session, chamber, bill ID.",
  inputSchema: {
    type: "object" as const,
    properties: {
      search: { type: "string" as const, description: "Search by description, question, or bill ID" },
      congress: { type: "number" as const, description: "Congress number (e.g. 119)" },
      chamber: { type: "string" as const, description: "'house' or 'senate'" },
      limit: { type: "number" as const, description: "Max results (default 20, max 100)" },
      offset: { type: "number" as const, description: "Pagination offset" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const search = args.search as string | undefined;
    const congress = args.congress as number | undefined;
    const chamber = args.chamber as string | undefined;
    const limit = Math.min((args.limit as number) || 20, 100);
    const offset = (args.offset as number) || 0;
    let q = supabase.from("congress_votes")
      .select("id,vote_id,congress,session,chamber,roll_number,vote_date,question,description,result,bill_id,yea_total,nay_total,not_voting_total", { count: "exact" })
      .range(offset, offset + limit - 1).order("vote_date", { ascending: false });
    if (search) q = q.or(`description.ilike.%${search}%,question.ilike.%${search}%,bill_id.ilike.%${search}%`);
    if (congress) q = q.eq("congress", congress);
    if (chamber) q = q.eq("chamber", chamber);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

mcpServer.tool("get_state_leg_elections", {
  description: "Get state legislative election results. Filter by state, chamber, year, district.",
  inputSchema: {
    type: "object" as const,
    properties: {
      state: { type: "string" as const, description: "Filter by state abbreviation" },
      chamber: { type: "string" as const, description: "'house' or 'senate'" },
      year: { type: "number" as const, description: "Election year" },
      district: { type: "string" as const, description: "District number" },
      limit: { type: "number" as const, description: "Max results (default 50, max 200)" },
      offset: { type: "number" as const, description: "Pagination offset" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const state = args.state as string | undefined;
    const chamber = args.chamber as string | undefined;
    const year = args.year as number | undefined;
    const district = args.district as string | undefined;
    const limit = Math.min((args.limit as number) || 50, 200);
    const offset = (args.offset as number) || 0;
    let q = supabase.from("state_leg_election_results")
      .select("id,candidate_name,state_abbr,chamber,district_number,election_year,party,votes,vote_pct,total_votes,is_winner,is_incumbent,turnout", { count: "exact" })
      .range(offset, offset + limit - 1).order("election_year", { ascending: false });
    if (state) q = q.eq("state_abbr", state.toUpperCase());
    if (chamber) q = q.eq("chamber", chamber);
    if (year) q = q.eq("election_year", year);
    if (district) q = q.eq("district_number", district);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

mcpServer.tool("get_forecast_history", {
  description: "Get historical changes in election forecast ratings over time. Track when Cook, Sabato, etc. shifted race ratings.",
  inputSchema: {
    type: "object" as const,
    properties: {
      state: { type: "string" as const, description: "Filter by state abbreviation" },
      race_type: { type: "string" as const, description: "'house', 'senate', or 'governor'" },
      source: { type: "string" as const, description: "Filter by forecast source" },
      cycle: { type: "number" as const, description: "Election cycle year (default 2026)" },
      limit: { type: "number" as const, description: "Max results (default 50, max 200)" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const state = args.state as string | undefined;
    const raceType = args.race_type as string | undefined;
    const source = args.source as string | undefined;
    const cycle = (args.cycle as number) || 2026;
    const limit = Math.min((args.limit as number) || 50, 200);
    let q = supabase.from("election_forecast_history")
      .select("id,forecast_id,source,race_type,state_abbr,district,cycle,old_rating,new_rating,changed_at", { count: "exact" })
      .eq("cycle", cycle).range(0, limit - 1).order("changed_at", { ascending: false });
    if (state) q = q.eq("state_abbr", state.toUpperCase());
    if (raceType) q = q.eq("race_type", raceType);
    if (source) q = q.eq("source", source);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

mcpServer.tool("master_search", {
  description: "Unified search across 50+ OppoDB databases simultaneously: candidates, congress members, bills, polling, campaign finance, election results, forecasts, MAGA files, narrative reports, local impacts, voter stats, prediction markets, messaging guidance, intel briefings, tracked bills, MIT elections, committees, votes, state leg elections, forecast history, international (profiles/elections/leaders/legislation/polling), public records (court cases, FARA, federal spending, lobbying, gov contracts, IG reports, congressional record), district profiles, election night streams, state legislators+bills, polling aggregates, knowledge & collab (wiki, war rooms, stakeholders, notes, reports, trackers, watchlist), and AI cache (vulnerability scores, talking points, bill/subject/messaging impact). Returns results grouped by category.",
  inputSchema: {
    type: "object" as const,
    properties: {
      search: { type: "string" as const, description: "Search query (min 2 characters)" },
      categories: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "Optional list of categories to search. Available: candidates, congress_members, bills, polling, campaign_finance, state_finance, election_results, forecasts, maga_files, narrative_reports, local_impacts, voter_stats, mn_finance, prediction_markets, messaging_guidance, intel_briefings, tracked_bills, mit_elections, congress_committees, congress_votes, state_leg_elections, forecast_history, international_profiles, court_cases, fara_registrants, federal_spending, lobbying_disclosures, gov_contracts, ig_reports, congressional_record, district_profiles, election_night_streams, state_legislators, state_legislative_bills, polling_aggregates, international_elections, international_leaders, international_legislation, international_polling, wiki_pages, war_rooms, stakeholders, entity_notes, reports, oppo_trackers, watchlist_items, vulnerability_scores, talking_points, bill_impact_analyses, subject_impact_analyses, messaging_audience_analyses, messaging_impact_analyses. Defaults to all.",
      },
      limit: { type: "number" as const, description: "Max results per category (default 10, max 20)" },
    },
    required: ["search"],
  },
  handler: async (args: Record<string, unknown>) => {
    const q = args.search as string;
    if (!q || q.length < 2) {
      return { content: [{ type: "text" as const, text: "Error: search query must be at least 2 characters" }] };
    }

    const likeQ = `%${q}%`;
    const perLimit = Math.min((args.limit as number) || 10, 20);

    const ALL_CATEGORIES = [
      "candidates", "congress_members", "bills", "polling",
      "campaign_finance", "state_finance", "election_results",
      "forecasts", "maga_files", "narrative_reports",
      "local_impacts", "voter_stats", "mn_finance",
      "prediction_markets", "messaging_guidance",
      "intel_briefings", "tracked_bills", "mit_elections",
      "congress_committees", "congress_votes", "state_leg_elections",
      "forecast_history", "international_profiles",
      "court_cases", "fara_registrants", "federal_spending", "lobbying_disclosures",
      "gov_contracts", "ig_reports", "congressional_record", "district_profiles",
      "election_night_streams", "state_legislators", "state_legislative_bills",
      "polling_aggregates",
      "international_elections", "international_leaders", "international_legislation",
      "international_polling",
      "wiki_pages", "war_rooms", "stakeholders", "entity_notes", "reports",
      "oppo_trackers", "watchlist_items",
      "vulnerability_scores", "talking_points", "bill_impact_analyses",
      "subject_impact_analyses", "messaging_audience_analyses", "messaging_impact_analyses",
    ];

    const requestedCategories = args.categories as string[] | undefined;
    const activeCategories = requestedCategories?.length
      ? requestedCategories.filter(c => ALL_CATEGORIES.includes(c))
      : ALL_CATEGORIES;

    const queries: Record<string, Promise<{ label: string; data: unknown[] }>> = {};

    if (activeCategories.includes("candidates")) {
      queries.candidates = supabase.from("candidate_profiles")
        .select("name,slug,is_subpage,parent_slug").ilike("name", likeQ).limit(perLimit).order("name")
        .then(r => ({ label: "Candidate Profiles", data: r.data || [] }));
    }
    if (activeCategories.includes("congress_members")) {
      queries.congress_members = supabase.from("congress_members")
        .select("name,state,district,party,chamber,bioguide_id")
        .or(`name.ilike.${likeQ},state.ilike.${likeQ},bioguide_id.ilike.${likeQ}`).limit(perLimit)
        .then(r => ({ label: "Congress Members", data: r.data || [] }));
    }
    if (activeCategories.includes("bills")) {
      queries.bills = supabase.from("congress_bills")
        .select("bill_id,title,short_title,sponsor_name,status,latest_action_date")
        .or(`title.ilike.${likeQ},short_title.ilike.${likeQ},sponsor_name.ilike.${likeQ},bill_id.ilike.${likeQ}`)
        .order("latest_action_date", { ascending: false }).limit(perLimit)
        .then(r => ({ label: "Legislation", data: r.data || [] }));
    }
    if (activeCategories.includes("polling")) {
      queries.polling = supabase.from("polling_data")
        .select("candidate_or_topic,source,poll_type,approve_pct,disapprove_pct,date_conducted")
        .or(`candidate_or_topic.ilike.${likeQ},source.ilike.${likeQ}`)
        .order("date_conducted", { ascending: false }).limit(perLimit)
        .then(r => ({ label: "Polling Data", data: r.data || [] }));
    }
    if (activeCategories.includes("campaign_finance")) {
      queries.campaign_finance = supabase.from("campaign_finance")
        .select("candidate_name,state_abbr,district,party,total_raised,total_spent,cash_on_hand,office,cycle")
        .or(`candidate_name.ilike.${likeQ},state_abbr.ilike.${likeQ},district.ilike.${likeQ}`)
        .order("total_raised", { ascending: false }).limit(perLimit)
        .then(r => ({ label: "Campaign Finance (Federal)", data: r.data || [] }));
    }
    if (activeCategories.includes("state_finance")) {
      queries.state_finance = supabase.from("state_cfb_candidates")
        .select("candidate_name,state_abbr,chamber,party,office,total_contributions,total_expenditures,net_cash")
        .or(`candidate_name.ilike.${likeQ},state_abbr.ilike.${likeQ},committee_name.ilike.${likeQ}`)
        .order("total_contributions", { ascending: false }).limit(perLimit)
        .then(r => ({ label: "State Campaign Finance", data: r.data || [] }));
    }
    if (activeCategories.includes("election_results")) {
      queries.election_results = supabase.from("congressional_election_results")
        .select("candidate_name,state_abbr,district_number,party,election_year,votes,vote_pct,is_winner")
        .or(`candidate_name.ilike.${likeQ},state_abbr.ilike.${likeQ}`)
        .order("election_year", { ascending: false }).limit(perLimit)
        .then(r => ({ label: "Election Results", data: r.data || [] }));
    }
    if (activeCategories.includes("forecasts")) {
      queries.forecasts = supabase.from("election_forecasts")
        .select("state_abbr,district,source,rating,race_type")
        .or(`state_abbr.ilike.${likeQ},district.ilike.${likeQ},rating.ilike.${likeQ}`)
        .eq("cycle", 2026).limit(perLimit)
        .then(r => ({ label: "Election Forecasts", data: r.data || [] }));
    }
    if (activeCategories.includes("maga_files")) {
      queries.maga_files = supabase.from("maga_files")
        .select("name,slug").ilike("name", likeQ).limit(perLimit).order("name")
        .then(r => ({ label: "MAGA Files", data: r.data || [] }));
    }
    if (activeCategories.includes("narrative_reports")) {
      queries.narrative_reports = supabase.from("narrative_reports")
        .select("name,slug").ilike("name", likeQ).limit(perLimit).order("name")
        .then(r => ({ label: "Narrative Reports", data: r.data || [] }));
    }
    if (activeCategories.includes("local_impacts")) {
      queries.local_impacts = supabase.from("local_impacts")
        .select("state,slug,summary").ilike("state", likeQ).limit(perLimit).order("state")
        .then(r => ({ label: "Local Impacts", data: r.data || [] }));
    }
    if (activeCategories.includes("voter_stats")) {
      queries.voter_stats = supabase.from("state_voter_stats")
        .select("*").ilike("state", likeQ).limit(perLimit)
        .order("total_registered", { ascending: false })
        .then(r => ({ label: "Voter Registration Stats", data: r.data || [] }));
    }
    if (activeCategories.includes("mn_finance")) {
      queries.mn_finance = supabase.from("mn_cfb_candidates")
        .select("candidate_name,chamber,committee_name,total_contributions,total_expenditures,net_cash")
        .or(`candidate_name.ilike.${likeQ},committee_name.ilike.${likeQ}`)
        .order("total_contributions", { ascending: false }).limit(perLimit)
        .then(r => ({ label: "MN Campaign Finance", data: r.data || [] }));
    }
    if (activeCategories.includes("prediction_markets")) {
      queries.prediction_markets = supabase.from("prediction_markets")
        .select("title,source,category,yes_price,volume,state_abbr,candidate_name")
        .eq("status", "active")
        .or(`title.ilike.${likeQ},candidate_name.ilike.${likeQ}`)
        .order("volume", { ascending: false }).limit(perLimit)
        .then(r => ({ label: "Prediction Markets", data: r.data || [] }));
    }
    if (activeCategories.includes("messaging_guidance")) {
      queries.messaging_guidance = supabase.from("messaging_guidance")
        .select("title,slug,source,author,published_date,summary,issue_areas")
        .or(`title.ilike.${likeQ},summary.ilike.${likeQ},author.ilike.${likeQ}`)
        .order("published_date", { ascending: false }).limit(perLimit)
        .then(r => ({ label: "Messaging Guidance", data: r.data || [] }));
    }
    if (activeCategories.includes("intel_briefings")) {
      queries.intel_briefings = supabase.from("intel_briefings")
        .select("title,summary,scope,category,source_name,published_at")
        .or(`title.ilike.${likeQ},summary.ilike.${likeQ},source_name.ilike.${likeQ},category.ilike.${likeQ}`)
        .order("published_at", { ascending: false }).limit(perLimit)
        .then(r => ({ label: "Intel Briefings", data: r.data || [] }));
    }
    if (activeCategories.includes("tracked_bills")) {
      queries.tracked_bills = supabase.from("tracked_bills")
        .select("bill_number,title,state,status_desc,last_action_date")
        .or(`title.ilike.${likeQ},bill_number.ilike.${likeQ},state.ilike.${likeQ}`)
        .order("last_action_date", { ascending: false }).limit(perLimit)
        .then(r => ({ label: "Tracked Bills (LegiScan)", data: r.data || [] }));
    }
    if (activeCategories.includes("mit_elections")) {
      queries.mit_elections = supabase.from("mit_election_results")
        .select("candidate,state,state_po,office,year,party,candidatevotes,totalvotes")
        .or(`candidate.ilike.${likeQ},state.ilike.${likeQ},state_po.ilike.${likeQ}`)
        .order("year", { ascending: false }).limit(perLimit)
        .then(r => ({ label: "MIT Election History", data: r.data || [] }));
    }
    if (activeCategories.includes("congress_committees")) {
      queries.congress_committees = supabase.from("congress_committees")
        .select("system_code,name,chamber")
        .or(`name.ilike.${likeQ},system_code.ilike.${likeQ}`)
        .order("name").limit(perLimit)
        .then(r => ({ label: "Congress Committees", data: r.data || [] }));
    }
    if (activeCategories.includes("congress_votes")) {
      queries.congress_votes = supabase.from("congress_votes")
        .select("vote_id,chamber,vote_date,question,result,bill_id,yea_total,nay_total")
        .or(`description.ilike.${likeQ},question.ilike.${likeQ},bill_id.ilike.${likeQ}`)
        .order("vote_date", { ascending: false }).limit(perLimit)
        .then(r => ({ label: "Congress Votes", data: r.data || [] }));
    }
    if (activeCategories.includes("state_leg_elections")) {
      queries.state_leg_elections = supabase.from("state_leg_election_results")
        .select("candidate_name,state_abbr,chamber,district_number,election_year,party,votes,vote_pct,is_winner")
        .or(`candidate_name.ilike.${likeQ},state_abbr.ilike.${likeQ}`)
        .order("election_year", { ascending: false }).limit(perLimit)
        .then(r => ({ label: "State Leg Elections", data: r.data || [] }));
    }
    if (activeCategories.includes("forecast_history")) {
      queries.forecast_history = supabase.from("election_forecast_history")
        .select("source,state_abbr,district,race_type,old_rating,new_rating,changed_at")
        .or(`state_abbr.ilike.${likeQ},source.ilike.${likeQ}`)
        .eq("cycle", 2026)
        .order("changed_at", { ascending: false }).limit(perLimit)
        .then(r => ({ label: "Forecast Rating Changes", data: r.data || [] }));
    }
    if (activeCategories.includes("international_profiles")) {
      queries.international_profiles = supabase.from("international_profiles")
        .select("country_code,country_name,continent,region,population,gdp_per_capita,government_type,head_of_state")
        .or(`country_name.ilike.${likeQ},country_code.ilike.${likeQ},continent.ilike.${likeQ}`)
        .order("country_name").limit(perLimit)
        .then(r => ({ label: "International Profiles", data: r.data || [] }));
    }

    // ─── NEW categories ─────────────────────────────────────────────
    if (activeCategories.includes("court_cases")) {
      queries.court_cases = supabase.from("court_cases")
        .select("case_name,case_number,court,judge,status,filed_date,docket_url")
        .or(`case_name.ilike.${likeQ},case_number.ilike.${likeQ},judge.ilike.${likeQ},court.ilike.${likeQ}`)
        .order("filed_date", { ascending: false, nullsFirst: false }).limit(perLimit)
        .then(r => ({ label: "Court Cases", data: r.data || [] }));
    }
    if (activeCategories.includes("fara_registrants")) {
      queries.fara_registrants = supabase.from("fara_registrants")
        .select("registrant_name,country,status,registration_date,registration_number")
        .or(`registrant_name.ilike.${likeQ},country.ilike.${likeQ},registration_number.ilike.${likeQ}`)
        .order("registration_date", { ascending: false, nullsFirst: false }).limit(perLimit)
        .then(r => ({ label: "FARA Registrants", data: r.data || [] }));
    }
    if (activeCategories.includes("federal_spending")) {
      queries.federal_spending = supabase.from("federal_spending")
        .select("recipient_name,recipient_state,awarding_agency,description,award_amount,fiscal_year,award_type")
        .or(`recipient_name.ilike.${likeQ},awarding_agency.ilike.${likeQ},description.ilike.${likeQ},recipient_state.ilike.${likeQ}`)
        .order("award_amount", { ascending: false, nullsFirst: false }).limit(perLimit)
        .then(r => ({ label: "Federal Spending", data: r.data || [] }));
    }
    if (activeCategories.includes("lobbying_disclosures")) {
      queries.lobbying_disclosures = supabase.from("lobbying_disclosures")
        .select("registrant_name,client_name,filing_year,amount,filing_period")
        .or(`registrant_name.ilike.${likeQ},client_name.ilike.${likeQ}`)
        .order("filing_year", { ascending: false }).limit(perLimit)
        .then(r => ({ label: "Lobbying Disclosures", data: r.data || [] }));
    }
    if (activeCategories.includes("gov_contracts")) {
      queries.gov_contracts = supabase.from("gov_contracts")
        .select("recipient_name,awarding_agency,description,award_amount,recipient_state,fiscal_year")
        .or(`recipient_name.ilike.${likeQ},awarding_agency.ilike.${likeQ},description.ilike.${likeQ}`)
        .order("award_amount", { ascending: false, nullsFirst: false }).limit(perLimit)
        .then(r => ({ label: "Government Contracts", data: r.data || [] }));
    }
    if (activeCategories.includes("ig_reports")) {
      queries.ig_reports = supabase.from("ig_reports")
        .select("title,agency_name,summary,topic,published_on,url")
        .or(`title.ilike.${likeQ},agency_name.ilike.${likeQ},summary.ilike.${likeQ},topic.ilike.${likeQ}`)
        .order("published_on", { ascending: false, nullsFirst: false }).limit(perLimit)
        .then(r => ({ label: "IG Reports", data: r.data || [] }));
    }
    if (activeCategories.includes("congressional_record")) {
      queries.congressional_record = supabase.from("congressional_record")
        .select("speaker_name,title,chamber,date,category")
        .or(`speaker_name.ilike.${likeQ},title.ilike.${likeQ},content.ilike.${likeQ}`)
        .order("date", { ascending: false }).limit(perLimit)
        .then(r => ({ label: "Congressional Record", data: r.data || [] }));
    }
    if (activeCategories.includes("district_profiles")) {
      queries.district_profiles = supabase.from("district_profiles")
        .select("district_id,state,population,median_income,median_age")
        .or(`district_id.ilike.${likeQ},state.ilike.${likeQ}`).limit(perLimit)
        .then(r => ({ label: "District Profiles", data: r.data || [] }));
    }
    if (activeCategories.includes("election_night_streams")) {
      queries.election_night_streams = supabase.from("election_night_streams")
        .select("candidate_name,state_abbr,district,party,votes,vote_pct,precincts_reporting_pct,is_called,race_type,election_date")
        .or(`candidate_name.ilike.${likeQ},state_abbr.ilike.${likeQ}`)
        .order("election_date", { ascending: false }).limit(perLimit)
        .then(r => ({ label: "Election Night Streams", data: r.data || [] }));
    }
    if (activeCategories.includes("state_legislators")) {
      queries.state_legislators = supabase.from("state_legislators")
        .select("name,state_abbr,chamber,district,party,email")
        .or(`name.ilike.${likeQ},state_abbr.ilike.${likeQ},party.ilike.${likeQ}`).limit(perLimit)
        .then(r => ({ label: "State Legislators", data: r.data || [] }));
    }
    if (activeCategories.includes("state_legislative_bills")) {
      queries.state_legislative_bills = supabase.from("state_legislative_bills")
        .select("identifier,title,state_abbr,sponsor_name,status,latest_action_date")
        .or(`title.ilike.${likeQ},identifier.ilike.${likeQ},sponsor_name.ilike.${likeQ},state_abbr.ilike.${likeQ}`)
        .order("latest_action_date", { ascending: false, nullsFirst: false }).limit(perLimit)
        .then(r => ({ label: "State Legislative Bills", data: r.data || [] }));
    }
    if (activeCategories.includes("polling_aggregates")) {
      queries.polling_aggregates = supabase.from("polling_aggregates")
        .select("race_type,state_abbr,district,candidate_a,candidate_b,margin,candidate_a_pct,candidate_b_pct,last_poll_date")
        .or(`candidate_a.ilike.${likeQ},candidate_b.ilike.${likeQ},state_abbr.ilike.${likeQ}`)
        .order("last_poll_date", { ascending: false, nullsFirst: false }).limit(perLimit)
        .then(r => ({ label: "Polling Aggregates", data: r.data || [] }));
    }
    if (activeCategories.includes("international_elections")) {
      queries.international_elections = supabase.from("international_elections")
        .select("country_code,election_year,election_type,winner_name,winner_party,election_date,turnout_pct")
        .or(`country_code.ilike.${likeQ},winner_name.ilike.${likeQ},winner_party.ilike.${likeQ},election_type.ilike.${likeQ}`)
        .order("election_date", { ascending: false, nullsFirst: false }).limit(perLimit)
        .then(r => ({ label: "International Elections", data: r.data || [] }));
    }
    if (activeCategories.includes("international_leaders")) {
      queries.international_leaders = supabase.from("international_leaders")
        .select("country_code,name,title,party,in_office_since,term_ends")
        .or(`name.ilike.${likeQ},country_code.ilike.${likeQ},party.ilike.${likeQ},title.ilike.${likeQ}`).limit(perLimit)
        .then(r => ({ label: "International Leaders", data: r.data || [] }));
    }
    if (activeCategories.includes("international_legislation")) {
      queries.international_legislation = supabase.from("international_legislation")
        .select("country_code,title,bill_number,status,sponsor,introduced_date,policy_area")
        .or(`title.ilike.${likeQ},bill_number.ilike.${likeQ},sponsor.ilike.${likeQ},country_code.ilike.${likeQ},policy_area.ilike.${likeQ}`)
        .order("introduced_date", { ascending: false, nullsFirst: false }).limit(perLimit)
        .then(r => ({ label: "International Legislation", data: r.data || [] }));
    }
    if (activeCategories.includes("international_polling")) {
      queries.international_polling = supabase.from("international_polling")
        .select("country_code,poll_topic,question,source,date_conducted,approve_pct,key_finding")
        .or(`poll_topic.ilike.${likeQ},question.ilike.${likeQ},country_code.ilike.${likeQ},source.ilike.${likeQ}`)
        .order("date_conducted", { ascending: false, nullsFirst: false }).limit(perLimit)
        .then(r => ({ label: "International Polling", data: r.data || [] }));
    }
    if (activeCategories.includes("wiki_pages")) {
      queries.wiki_pages = supabase.from("wiki_pages")
        .select("slug,title").eq("published", true)
        .or(`title.ilike.${likeQ},content.ilike.${likeQ}`).limit(perLimit)
        .then(r => ({ label: "Wiki Pages", data: r.data || [] }));
    }
    if (activeCategories.includes("war_rooms")) {
      queries.war_rooms = supabase.from("war_rooms")
        .select("name,description,race_scope,updated_at")
        .or(`name.ilike.${likeQ},description.ilike.${likeQ}`)
        .order("updated_at", { ascending: false }).limit(perLimit)
        .then(r => ({ label: "War Rooms", data: r.data || [] }));
    }
    if (activeCategories.includes("stakeholders")) {
      queries.stakeholders = supabase.from("stakeholders")
        .select("name,type,organization,title,email,state_abbr,party")
        .or(`name.ilike.${likeQ},organization.ilike.${likeQ},email.ilike.${likeQ},title.ilike.${likeQ}`).limit(perLimit)
        .then(r => ({ label: "Stakeholders", data: r.data || [] }));
    }
    if (activeCategories.includes("entity_notes")) {
      queries.entity_notes = supabase.from("entity_notes")
        .select("entity_type,entity_id,body,is_shared,created_at")
        .ilike("body", likeQ).order("created_at", { ascending: false }).limit(perLimit)
        .then(r => ({ label: "Entity Notes", data: r.data || [] }));
    }
    if (activeCategories.includes("reports")) {
      queries.reports = supabase.from("reports")
        .select("id,title,description,is_public,updated_at")
        .or(`title.ilike.${likeQ},description.ilike.${likeQ}`)
        .order("updated_at", { ascending: false }).limit(perLimit)
        .then(r => ({ label: "Reports", data: r.data || [] }));
    }
    if (activeCategories.includes("oppo_trackers")) {
      queries.oppo_trackers = supabase.from("oppo_trackers")
        .select("name,description,scope,scope_ref,updated_at")
        .or(`name.ilike.${likeQ},description.ilike.${likeQ}`)
        .order("updated_at", { ascending: false }).limit(perLimit)
        .then(r => ({ label: "Oppo Trackers", data: r.data || [] }));
    }
    if (activeCategories.includes("watchlist_items")) {
      queries.watchlist_items = supabase.from("watchlist_items")
        .select("entity_type,entity_id,label,notes,created_at")
        .or(`label.ilike.${likeQ},notes.ilike.${likeQ},entity_id.ilike.${likeQ}`)
        .order("created_at", { ascending: false }).limit(perLimit)
        .then(r => ({ label: "Watchlist", data: r.data || [] }));
    }
    if (activeCategories.includes("vulnerability_scores")) {
      queries.vulnerability_scores = supabase.from("vulnerability_scores")
        .select("candidate_slug,overall_score,summary,generated_at")
        .or(`candidate_slug.ilike.${likeQ},summary.ilike.${likeQ}`)
        .order("generated_at", { ascending: false }).limit(perLimit)
        .then(r => ({ label: "Vulnerability Scores (AI)", data: r.data || [] }));
    }
    if (activeCategories.includes("talking_points")) {
      queries.talking_points = supabase.from("talking_points")
        .select("subject_type,subject_ref,audience,angle,generated_by,created_at")
        .or(`subject_ref.ilike.${likeQ},audience.ilike.${likeQ},angle.ilike.${likeQ},subject_type.ilike.${likeQ}`)
        .order("created_at", { ascending: false }).limit(perLimit)
        .then(r => ({ label: "Talking Points (AI)", data: r.data || [] }));
    }
    if (activeCategories.includes("bill_impact_analyses")) {
      queries.bill_impact_analyses = supabase.from("bill_impact_analyses")
        .select("bill_id,scope,scope_ref,summary,generated_at")
        .or(`bill_id.ilike.${likeQ},summary.ilike.${likeQ},scope_ref.ilike.${likeQ}`)
        .order("generated_at", { ascending: false }).limit(perLimit)
        .then(r => ({ label: "Bill Impact (AI)", data: r.data || [] }));
    }
    if (activeCategories.includes("subject_impact_analyses")) {
      queries.subject_impact_analyses = supabase.from("subject_impact_analyses")
        .select("subject_type,subject_ref,scope,scope_ref,summary,generated_at")
        .or(`subject_ref.ilike.${likeQ},summary.ilike.${likeQ},subject_type.ilike.${likeQ}`)
        .order("generated_at", { ascending: false }).limit(perLimit)
        .then(r => ({ label: "Subject Impact (AI)", data: r.data || [] }));
    }
    if (activeCategories.includes("messaging_audience_analyses")) {
      queries.messaging_audience_analyses = supabase.from("messaging_audience_analyses")
        .select("messaging_slug,effectiveness_score,summary,generated_at")
        .or(`messaging_slug.ilike.${likeQ},summary.ilike.${likeQ}`)
        .order("generated_at", { ascending: false }).limit(perLimit)
        .then(r => ({ label: "Messaging Audience (AI)", data: r.data || [] }));
    }
    if (activeCategories.includes("messaging_impact_analyses")) {
      queries.messaging_impact_analyses = supabase.from("messaging_impact_analyses")
        .select("messaging_slug,scope,scope_ref,summary,generated_at")
        .or(`messaging_slug.ilike.${likeQ},summary.ilike.${likeQ},scope_ref.ilike.${likeQ}`)
        .order("generated_at", { ascending: false }).limit(perLimit)
        .then(r => ({ label: "Messaging Impact (AI)", data: r.data || [] }));
    }

    const entries = Object.entries(queries);
    const settled = await Promise.all(entries.map(async ([key, promise]) => {
      const res = await promise.catch(() => ({ label: key, data: [] as unknown[] }));
      return { key, label: res.label, count: res.data.length, results: res.data };
    }));

    const categories = Object.fromEntries(
      settled.filter(s => s.count > 0).map(s => [s.key, { label: s.label, count: s.count, results: s.results }])
    );
    const totalResults = settled.reduce((sum, s) => sum + s.count, 0);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          query: q,
          total_results: totalResults,
          categories_searched: settled.length,
          categories_with_results: Object.keys(categories).length,
          categories,
        }, null, 2),
      }],
    };
  },
});

// ─── Location Tracking Tools (admin-only) ──────────────────────────────────

async function isAdmin(apiKey: string): Promise<boolean> {
  const keyHash = await hashKey(apiKey);
  const { data: keyData } = await supabase.rpc("validate_api_key", { p_key_hash: keyHash });
  if (!keyData || keyData.length === 0) return false;
  const { data: roles } = await supabase
    .from("user_roles").select("role").eq("user_id", keyData[0].user_id);
  return !!roles?.some((r: { role: string }) => r.role === "admin");
}

mcpServer.tool({
  name: "search_devices",
  description: "[ADMIN] List registered user devices being tracked. Filter by user_id, platform, tag, or search by name/browser.",
  inputSchema: {
    type: "object" as const,
    properties: {
      user_id: { type: "string" as const, description: "Filter to a specific user UUID" },
      platform: { type: "string" as const, description: "Filter by platform (e.g. 'iOS', 'Android', 'Windows')" },
      tag: { type: "string" as const, description: "Filter by a tag assigned to the device" },
      search: { type: "string" as const, description: "Search device_name, browser, or platform" },
      limit: { type: "number" as const, description: "Max results (default 50, max 200)" },
      offset: { type: "number" as const, description: "Pagination offset" },
    },
  },
  handler: async (args: Record<string, unknown>, ctx: { request: Request }) => {
    const apiKey = ctx.request.headers.get("X-API-Key") || ctx.request.headers.get("Authorization")?.replace("Bearer ", "") || "";
    if (!await isAdmin(apiKey)) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Admin role required" }) }] };
    }
    const limit = Math.min(Number(args.limit) || 50, 200);
    const offset = Number(args.offset) || 0;
    let q = supabase.from("user_devices")
      .select("id,user_id,device_name,platform,browser,tags,first_seen_at,last_seen_at")
      .range(offset, offset + limit - 1)
      .order("last_seen_at", { ascending: false, nullsFirst: false });
    if (args.user_id) q = q.eq("user_id", String(args.user_id));
    if (args.platform) q = q.ilike("platform", `%${args.platform}%`);
    if (args.tag) q = q.contains("tags", [String(args.tag)]);
    if (args.search) {
      const s = String(args.search);
      q = q.or(`device_name.ilike.%${s}%,browser.ilike.%${s}%,platform.ilike.%${s}%`);
    }
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ count: data?.length || 0, devices: data || [] }, null, 2) }] };
  },
});

mcpServer.tool({
  name: "get_device_locations",
  description: "[ADMIN] Get raw GPS location pings (lat/lng/accuracy/timestamp) recorded by tracked devices. Filter by device_id, user_id, or time range.",
  inputSchema: {
    type: "object" as const,
    properties: {
      device_id: { type: "string" as const, description: "Filter to a specific device UUID" },
      user_id: { type: "string" as const, description: "Filter to a specific user UUID" },
      since: { type: "string" as const, description: "ISO timestamp lower bound (e.g. 2026-04-01T00:00:00Z)" },
      until: { type: "string" as const, description: "ISO timestamp upper bound" },
      limit: { type: "number" as const, description: "Max results (default 100, max 500)" },
      offset: { type: "number" as const, description: "Pagination offset" },
    },
  },
  handler: async (args: Record<string, unknown>, ctx: { request: Request }) => {
    const apiKey = ctx.request.headers.get("X-API-Key") || ctx.request.headers.get("Authorization")?.replace("Bearer ", "") || "";
    if (!await isAdmin(apiKey)) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Admin role required" }) }] };
    }
    const limit = Math.min(Number(args.limit) || 100, 500);
    const offset = Number(args.offset) || 0;
    let q = supabase.from("device_locations")
      .select("id,device_id,user_id,latitude,longitude,accuracy,altitude,heading,speed,recorded_at")
      .range(offset, offset + limit - 1)
      .order("recorded_at", { ascending: false });
    if (args.device_id) q = q.eq("device_id", String(args.device_id));
    if (args.user_id) q = q.eq("user_id", String(args.user_id));
    if (args.since) q = q.gte("recorded_at", String(args.since));
    if (args.until) q = q.lte("recorded_at", String(args.until));
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ count: data?.length || 0, locations: data || [] }, null, 2) }] };
  },
});

mcpServer.tool({
  name: "get_user_locations",
  description: "[ADMIN] Get the latest known position for each device, grouped by user. Useful for a quick 'where is everyone right now' overview.",
  inputSchema: {
    type: "object" as const,
    properties: {
      user_id: { type: "string" as const, description: "Filter to a specific user UUID" },
    },
  },
  handler: async (args: Record<string, unknown>, ctx: { request: Request }) => {
    const apiKey = ctx.request.headers.get("X-API-Key") || ctx.request.headers.get("Authorization")?.replace("Bearer ", "") || "";
    if (!await isAdmin(apiKey)) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Admin role required" }) }] };
    }
    let devQ = supabase.from("user_devices").select("id,user_id,device_name,platform,browser,tags,last_seen_at");
    if (args.user_id) devQ = devQ.eq("user_id", String(args.user_id));
    const { data: devs, error: devErr } = await devQ;
    if (devErr) return { content: [{ type: "text" as const, text: JSON.stringify({ error: devErr.message }) }] };
    const deviceIds = (devs || []).map((d: { id: string }) => d.id);
    const latest: Record<string, unknown> = {};
    if (deviceIds.length > 0) {
      const { data: locs } = await supabase.from("device_locations")
        .select("device_id,latitude,longitude,accuracy,recorded_at")
        .in("device_id", deviceIds)
        .order("recorded_at", { ascending: false })
        .limit(deviceIds.length * 50);
      for (const l of (locs || []) as Array<{ device_id: string }>) {
        if (!latest[l.device_id]) latest[l.device_id] = l;
      }
    }
    const merged = (devs || []).map((d: { id: string }) => ({ ...d, latest_location: latest[d.id] || null }));
    return { content: [{ type: "text" as const, text: JSON.stringify({ count: merged.length, users: merged }, null, 2) }] };
  },
});

mcpServer.tool({
  name: "get_news_ticker",
  description: "Get the latest news headlines from IntelHub (150+ multi-partisan sources) optimized for tickers/marquees. Returns title, source, scope, link, and publish date. Optional filters: scope (local|state|national|international), category, limit (1-100, default 30).",
  inputSchema: {
    type: "object" as const,
    properties: {
      scope: { type: "string" as const, description: "Filter by scope: local, state, national, international" },
      category: { type: "string" as const, description: "Filter by category (e.g., economy, elections, legal, health)" },
      limit: { type: "number" as const, description: "Number of headlines (1-100, default 30)" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const limit = Math.min(Math.max((args.limit as number) || 30, 1), 100);
    let q = supabase
      .from("intel_briefings")
      .select("id,title,scope,category,source_name,source_url,published_at")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (args.scope) q = q.eq("scope", String(args.scope));
    if (args.category) q = q.eq("category", String(args.category));
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: JSON.stringify({ error: error.message }) }] };
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          count: data?.length || 0,
          generated_at: new Date().toISOString(),
          headlines: data || [],
        }, null, 2),
      }],
    };
  },
});

// ─── User-scoped helpers (resolve API-key owner) ────────────────────────────
async function resolveUserId(req: Request): Promise<string | null> {
  const apiKey = req.headers.get("X-API-Key") || req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!apiKey) return null;
  const keyHash = await hashKey(apiKey);
  const { data } = await supabase.rpc("validate_api_key", { p_key_hash: keyHash });
  return data?.[0]?.user_id || null;
}

mcpServer.tool({
  name: "list_reports",
  description: "List the calling user's reports plus reports shared with them plus public reports. Use include_blocks=true to fetch full block JSON.",
  inputSchema: {
    type: "object" as const,
    properties: {
      id: { type: "string" as const, description: "Single report UUID" },
      search: { type: "string" as const, description: "Filter by title" },
      include_blocks: { type: "boolean" as const, description: "Include full blocks JSON (default false)" },
      public_only: { type: "boolean" as const, description: "Only public reports" },
      limit: { type: "number" as const, description: "Max results (default 30)" },
    },
  },
  handler: async (args: Record<string, unknown>, ctx: { request: Request }) => {
    const userId = await resolveUserId(ctx.request);
    if (!userId) return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Unauthorized" }) }] };
    const includeBlocks = !!args.include_blocks;
    const cols = includeBlocks
      ? "id,owner_id,title,description,blocks,is_public,created_at,updated_at"
      : "id,owner_id,title,description,is_public,created_at,updated_at";
    if (args.id) {
      const { data, error } = await supabase.from("reports").select(cols).eq("id", String(args.id)).maybeSingle();
      if (error) return { content: [{ type: "text" as const, text: JSON.stringify({ error: error.message }) }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
    const limit = Math.min((args.limit as number) || 30, 100);
    let q = supabase.from("reports").select(cols).order("updated_at", { ascending: false }).limit(limit);
    if (args.public_only) {
      q = q.eq("is_public", true);
    } else {
      const { data: shares } = await supabase.from("report_shares").select("report_id").eq("shared_with_user_id", userId);
      const sharedIds = ((shares || []) as Array<{ report_id: string }>).map((s) => s.report_id);
      if (sharedIds.length > 0) {
        q = q.or(`owner_id.eq.${userId},is_public.eq.true,id.in.(${sharedIds.join(",")})`);
      } else {
        q = q.or(`owner_id.eq.${userId},is_public.eq.true`);
      }
    }
    if (args.search) q = q.ilike("title", `%${String(args.search)}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ count: data?.length || 0, reports: data || [] }, null, 2) }] };
  },
});

mcpServer.tool({
  name: "list_report_schedules",
  description: "List the calling user's scheduled report email deliveries (cadence, recipients, next run time).",
  inputSchema: { type: "object" as const, properties: {} },
  handler: async (_args, ctx: { request: Request }) => {
    const userId = await resolveUserId(ctx.request);
    if (!userId) return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Unauthorized" }) }] };
    const { data, error } = await supabase.from("report_schedules").select("*").eq("owner_id", userId).order("next_run_at");
    if (error) return { content: [{ type: "text" as const, text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ count: data?.length || 0, schedules: data || [] }, null, 2) }] };
  },
});

mcpServer.tool({
  name: "list_polling_alerts",
  description: "List the calling user's polling-data email alert subscriptions (scope, thresholds, cadence, last sent).",
  inputSchema: { type: "object" as const, properties: {} },
  handler: async (_args, ctx: { request: Request }) => {
    const userId = await resolveUserId(ctx.request);
    if (!userId) return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Unauthorized" }) }] };
    const { data, error } = await supabase.from("polling_alert_subscriptions").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) return { content: [{ type: "text" as const, text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ count: data?.length || 0, alerts: data || [] }, null, 2) }] };
  },
});

mcpServer.tool({
  name: "get_email_preferences",
  description: "Get the calling user's global email notification preferences (digest frequency, quiet hours, per-category toggles).",
  inputSchema: { type: "object" as const, properties: {} },
  handler: async (_args, ctx: { request: Request }) => {
    const userId = await resolveUserId(ctx.request);
    if (!userId) return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Unauthorized" }) }] };
    const { data, error } = await supabase.from("email_notification_preferences").select("*").eq("user_id", userId).maybeSingle();
    if (error) return { content: [{ type: "text" as const, text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data || { note: "No preferences set; defaults apply." }, null, 2) }] };
  },
});

mcpServer.tool({
  name: "get_intel_clusters",
  description: "Cluster recent IntelHub briefings by title similarity to surface coverage bias and source diversity. Each cluster lists the lead article, total article count, and unique source count.",
  inputSchema: {
    type: "object" as const,
    properties: {
      scope: { type: "string" as const, description: "Filter by scope: local, state, national, international" },
      limit: { type: "number" as const, description: "How many recent briefings to consider (default 60, max 200)" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const limit = Math.min((args.limit as number) || 60, 200);
    let q = supabase.from("intel_briefings")
      .select("id,title,summary,source_name,source_url,scope,category,published_at")
      .order("published_at", { ascending: false, nullsFirst: false }).limit(limit);
    if (args.scope) q = q.eq("scope", String(args.scope));
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: JSON.stringify({ error: error.message }) }] };

    const STOP = new Set(["the","a","an","of","in","on","for","to","and","or","but","with","at","by","from","is","are","was","were","be","been","as","this","that","it","its","into","over","after","before","new","amid","up","down","out"]);
    const tokenize = (s: string) => new Set((s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(t => t.length > 2 && !STOP.has(t)));
    const arts = (data || []).map((a: any) => ({ ...a, _tok: tokenize(a.title) }));
    const clusters: any[] = [];
    for (const art of arts) {
      let best: any = null; let bestScore = 0;
      for (const c of clusters) {
        const inter = [...art._tok].filter((t: string) => c.tokens.has(t)).length;
        const union = new Set([...art._tok, ...c.tokens]).size || 1;
        const score = inter / union;
        if (score > bestScore) { bestScore = score; best = c; }
      }
      if (best && bestScore >= 0.34) { best.articles.push(art); for (const t of art._tok) best.tokens.add(t); }
      else clusters.push({ id: art.id, lead: art, articles: [art], tokens: new Set(art._tok) });
    }
    const out = clusters.map((c: any) => ({
      id: c.id,
      lead_title: c.lead.title,
      lead_source: c.lead.source_name,
      article_count: c.articles.length,
      unique_sources: new Set(c.articles.map((a: any) => a.source_name)).size,
      sources: [...new Set(c.articles.map((a: any) => a.source_name))],
    })).sort((a: any, b: any) => b.article_count - a.article_count);
    return { content: [{ type: "text" as const, text: JSON.stringify({ cluster_count: out.length, clusters: out }, null, 2) }] };
  },
});

mcpServer.tool({
  name: "get_international_profile",
  description: "Get full country profile for one of 140+ nations (government, economy, demographics, leadership).",
  inputSchema: {
    type: "object" as const,
    properties: {
      country_code: { type: "string" as const, description: "ISO country code, e.g. 'FR'" },
      search: { type: "string" as const, description: "Search by country name" },
      continent: { type: "string" as const, description: "Filter by continent" },
      limit: { type: "number" as const, description: "Max results (default 20)" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const limit = Math.min((args.limit as number) || 20, 100);
    let q = supabase.from("international_profiles").select("*").limit(limit).order("country_name");
    if (args.country_code) q = q.eq("country_code", String(args.country_code).toUpperCase());
    if (args.continent) q = q.ilike("continent", `%${String(args.continent)}%`);
    if (args.search) q = q.ilike("country_name", `%${String(args.search)}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ count: data?.length || 0, results: data || [] }, null, 2) }] };
  },
});

// ─── Phase 1-5 tools (alerts, notes, graph, AI cache) ──────────────────────

async function resolveCallerUser(c: any): Promise<{ userId: string; isAdmin: boolean } | null> {
  const apiKey = c.req.header("X-API-Key") || c.req.header("Authorization")?.replace("Bearer ", "");
  if (!apiKey) return null;
  const keyHash = await hashKey(apiKey);
  const { data: keyData } = await supabase.rpc("validate_api_key", { p_key_hash: keyHash });
  if (!keyData?.length) return null;
  const userId = keyData[0].user_id;
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return { userId, isAdmin: (roles || []).some((r: { role: string }) => r.role === "admin") };
}

mcpServer.tool("list_alert_rules", {
  description: "List the caller's alert rules (admin-keyed callers see all).",
  inputSchema: { type: "object" as const, properties: { limit: { type: "number" as const } } },
  handler: async (args: Record<string, unknown>, ctx?: any) => {
    const caller = await resolveCallerUser(ctx?.request || ctx);
    const limit = Math.min((args.limit as number) || 50, 200);
    let q = supabase.from("alert_rules").select("*").order("created_at", { ascending: false }).limit(limit);
    if (caller && !caller.isAdmin) q = q.eq("user_id", caller.userId);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ count: data?.length, results: data }, null, 2) }] };
  },
});

mcpServer.tool("create_alert_rule", {
  description: "Create a new alert rule for the caller.",
  inputSchema: { type: "object" as const, properties: {
    name: { type: "string" as const }, entity_type: { type: "string" as const }, entity_id: { type: "string" as const },
    event_types: { type: "array" as const, items: { type: "string" as const } }, keywords: { type: "array" as const, items: { type: "string" as const } },
    channels: { type: "array" as const, items: { type: "string" as const } }, webhook_endpoint_id: { type: "string" as const },
  }, required: ["name"] },
  handler: async (args: Record<string, unknown>, ctx?: any) => {
    const caller = await resolveCallerUser(ctx?.request || ctx);
    if (!caller) return { content: [{ type: "text" as const, text: "Unauthorized" }] };
    const { data, error } = await supabase.from("alert_rules").insert({ ...args, user_id: caller.userId } as never).select();
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("list_entity_activity", {
  description: "Recent activity across entities (candidates, districts, bills). Optionally filter by entity_type/entity_id.",
  inputSchema: { type: "object" as const, properties: { entity_type: { type: "string" as const }, entity_id: { type: "string" as const }, limit: { type: "number" as const } } },
  handler: async (args: Record<string, unknown>) => {
    const limit = Math.min((args.limit as number) || 50, 200);
    let q = supabase.from("entity_activity").select("*").order("created_at", { ascending: false }).limit(limit);
    if (args.entity_type) q = q.eq("entity_type", String(args.entity_type));
    if (args.entity_id) q = q.eq("entity_id", String(args.entity_id));
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ count: data?.length, results: data }, null, 2) }] };
  },
});

mcpServer.tool("list_entity_notes", {
  description: "List entity notes the caller can see (own + shared; admins see all).",
  inputSchema: { type: "object" as const, properties: { entity_type: { type: "string" as const }, entity_id: { type: "string" as const }, limit: { type: "number" as const } } },
  handler: async (args: Record<string, unknown>, ctx?: any) => {
    const caller = await resolveCallerUser(ctx?.request || ctx);
    const limit = Math.min((args.limit as number) || 50, 200);
    let q;
    if (caller && !caller.isAdmin) {
      q = supabase.from("entity_notes").select("*").or(`user_id.eq.${caller.userId},is_shared.eq.true`).order("created_at", { ascending: false }).limit(limit);
    } else {
      q = supabase.from("entity_notes").select("*").order("created_at", { ascending: false }).limit(limit);
    }
    if (args.entity_type) q = q.eq("entity_type", String(args.entity_type));
    if (args.entity_id) q = q.eq("entity_id", String(args.entity_id));
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ count: data?.length, results: data }, null, 2) }] };
  },
});

mcpServer.tool("create_entity_note", {
  description: "Create a note on an entity. Set is_shared=true to share with team.",
  inputSchema: { type: "object" as const, properties: {
    entity_type: { type: "string" as const }, entity_id: { type: "string" as const }, body: { type: "string" as const },
    is_shared: { type: "boolean" as const }, mentions: { type: "array" as const, items: { type: "string" as const } },
  }, required: ["entity_type", "entity_id", "body"] },
  handler: async (args: Record<string, unknown>, ctx?: any) => {
    const caller = await resolveCallerUser(ctx?.request || ctx);
    if (!caller) return { content: [{ type: "text" as const, text: "Unauthorized" }] };
    const { data, error } = await supabase.from("entity_notes").insert({ ...args, user_id: caller.userId } as never).select();
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("get_entity_graph", {
  description: "Get relationship edges centered on an entity (donations, votes, lobbying, etc).",
  inputSchema: { type: "object" as const, properties: {
    entity_id: { type: "string" as const }, relationship_type: { type: "string" as const }, limit: { type: "number" as const },
  } },
  handler: async (args: Record<string, unknown>) => {
    const limit = Math.min((args.limit as number) || 100, 500);
    let q = supabase.from("entity_relationships").select("*").limit(limit).order("created_at", { ascending: false });
    if (args.entity_id) q = q.or(`source_id.eq.${args.entity_id},target_id.eq.${args.entity_id}`);
    if (args.relationship_type) q = q.eq("relationship_type", String(args.relationship_type));
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ count: data?.length, edges: data }, null, 2) }] };
  },
});

mcpServer.tool("get_vulnerability_score", {
  description: "AI-generated vulnerability score for a candidate (cached). Pass force=true to regenerate.",
  inputSchema: { type: "object" as const, properties: { candidate_slug: { type: "string" as const }, force: { type: "boolean" as const } }, required: ["candidate_slug"] },
  handler: async (args: Record<string, unknown>) => {
    if (args.force) {
      const { data, error } = await supabase.functions.invoke("vulnerability-score", { body: { candidate_slug: args.candidate_slug, force: true } });
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
    const { data, error } = await supabase.from("vulnerability_scores").select("*").eq("candidate_slug", String(args.candidate_slug)).maybeSingle();
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("get_talking_points", {
  description: "AI-generated talking points for a subject (candidate/issue/bill).",
  inputSchema: { type: "object" as const, properties: {
    subject_type: { type: "string" as const }, subject_ref: { type: "string" as const },
    audience: { type: "string" as const }, angle: { type: "string" as const }, force: { type: "boolean" as const },
  }, required: ["subject_type", "subject_ref"] },
  handler: async (args: Record<string, unknown>) => {
    if (args.force) {
      const { data, error } = await supabase.functions.invoke("talking-points", { body: { ...args, force: true } });
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
    let q = supabase.from("talking_points").select("*").eq("subject_type", String(args.subject_type)).eq("subject_ref", String(args.subject_ref)).limit(10);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("get_bill_impact", {
  description: "AI-generated bill impact analysis (national/state/district scoped).",
  inputSchema: { type: "object" as const, properties: {
    bill_id: { type: "string" as const }, scope: { type: "string" as const }, scope_ref: { type: "string" as const }, force: { type: "boolean" as const },
  }, required: ["bill_id"] },
  handler: async (args: Record<string, unknown>) => {
    if (args.force) {
      const { data, error } = await supabase.functions.invoke("bill-impact", { body: { ...args, force: true } });
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
    let q = supabase.from("bill_impact_analyses").select("*").eq("bill_id", String(args.bill_id));
    if (args.scope) q = q.eq("scope", String(args.scope));
    if (args.scope_ref) q = q.eq("scope_ref", String(args.scope_ref));
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

// ─── Messaging AI Tools (Phase 7) ───────────────────────────────────────────

mcpServer.tool("get_messaging_talking_points", {
  description: "Get cached AI-generated talking points for a MessagingHub item (by slug).",
  inputSchema: { type: "object" as const, properties: {
    messaging_slug: { type: "string" as const }, audience: { type: "string" as const }, angle: { type: "string" as const },
  }, required: ["messaging_slug"] },
  handler: async (args: Record<string, unknown>) => {
    let q = supabase.from("talking_points").select("*").eq("subject_type", "messaging").eq("subject_ref", String(args.messaging_slug)).order("created_at", { ascending: false }).limit(20);
    if (args.audience) q = q.eq("audience", String(args.audience));
    if (args.angle) q = q.eq("angle", String(args.angle));
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("generate_messaging_talking_points", {
  description: "Generate fresh AI talking points for a MessagingHub item using cross-section context (polling, intel, legislation, finance, forecasts).",
  inputSchema: { type: "object" as const, properties: {
    messaging_slug: { type: "string" as const }, audience: { type: "string" as const }, angle: { type: "string" as const },
    tone: { type: "string" as const }, model: { type: "string" as const },
    include_sections: { type: "array" as const, items: { type: "string" as const } },
  }, required: ["messaging_slug"] },
  handler: async (args: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("messaging-talking-points", { body: args });
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("get_messaging_audience_analysis", {
  description: "Get cached audience effectiveness analysis (resonance scores, segment breakdown, risks) for a MessagingHub item.",
  inputSchema: { type: "object" as const, properties: { messaging_slug: { type: "string" as const } }, required: ["messaging_slug"] },
  handler: async (args: Record<string, unknown>) => {
    const { data, error } = await (supabase.from as any)("messaging_audience_analyses").select("*").eq("messaging_slug", String(args.messaging_slug)).maybeSingle();
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("generate_messaging_audience_analysis", {
  description: "Generate fresh audience effectiveness analysis. Pass force_refresh=true to bypass 7-day cache.",
  inputSchema: { type: "object" as const, properties: {
    messaging_slug: { type: "string" as const }, force_refresh: { type: "boolean" as const },
    model: { type: "string" as const }, include_sections: { type: "array" as const, items: { type: "string" as const } },
  }, required: ["messaging_slug"] },
  handler: async (args: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("messaging-audience-analysis", { body: args });
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("get_messaging_impact", {
  description: "Get cached AI impact analyses for a MessagingHub item (national/state/district scoped).",
  inputSchema: { type: "object" as const, properties: {
    messaging_slug: { type: "string" as const }, scope: { type: "string" as const }, scope_ref: { type: "string" as const },
  }, required: ["messaging_slug"] },
  handler: async (args: Record<string, unknown>) => {
    let q = (supabase.from as any)("messaging_impact_analyses").select("*").eq("messaging_slug", String(args.messaging_slug)).order("generated_at", { ascending: false });
    if (args.scope) q = q.eq("scope", String(args.scope));
    if (args.scope_ref) q = q.eq("scope_ref", String(args.scope_ref));
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("generate_messaging_impact", {
  description: "Generate fresh impact analysis for a MessagingHub item.",
  inputSchema: { type: "object" as const, properties: {
    messaging_slug: { type: "string" as const }, scope: { type: "string" as const }, scope_ref: { type: "string" as const },
    model: { type: "string" as const }, include_sections: { type: "array" as const, items: { type: "string" as const } },
  }, required: ["messaging_slug"] },
  handler: async (args: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("messaging-impact", { body: args });
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("get_messaging_ai_bundle", {
  description: "Get the full AI bundle for a MessagingHub item: messaging metadata + cached talking points + audience analysis + impact analyses.",
  inputSchema: { type: "object" as const, properties: { messaging_slug: { type: "string" as const } }, required: ["messaging_slug"] },
  handler: async (args: Record<string, unknown>) => {
    const slug = String(args.messaging_slug);
    const [tp, aud, imp, item] = await Promise.all([
      supabase.from("talking_points").select("audience, angle, points, evidence, created_at").eq("subject_type", "messaging").eq("subject_ref", slug).order("created_at", { ascending: false }).limit(10),
      (supabase.from as any)("messaging_audience_analyses").select("*").eq("messaging_slug", slug).maybeSingle(),
      (supabase.from as any)("messaging_impact_analyses").select("*").eq("messaging_slug", slug).order("generated_at", { ascending: false }).limit(10),
      supabase.from("messaging_guidance").select("title, slug, source, author, summary, issue_areas").eq("slug", slug).maybeSingle(),
    ]);
    return { content: [{ type: "text" as const, text: JSON.stringify({
      item: item.data, talking_points: tp.data || [], audience_analysis: aud.data, impact_analyses: imp.data || [],
    }, null, 2) }] };
  },
});

mcpServer.tool("admin_regenerate_messaging_ai", {
  description: "[ADMIN] Force-regenerate any cached messaging AI artifact. type: 'talking_points' | 'audience' | 'impact'.",
  inputSchema: { type: "object" as const, properties: {
    type: { type: "string" as const }, messaging_slug: { type: "string" as const },
    audience: { type: "string" as const }, angle: { type: "string" as const },
    scope: { type: "string" as const }, scope_ref: { type: "string" as const },
    model: { type: "string" as const }, include_sections: { type: "array" as const, items: { type: "string" as const } },
  }, required: ["type", "messaging_slug"] },
  handler: async (args: Record<string, unknown>, ctx?: any) => {
    const caller = await resolveCallerUser(ctx?.request || ctx);
    if (!caller?.isAdmin) return { content: [{ type: "text" as const, text: "Admin role required" }] };
    const fnMap: Record<string, string> = {
      talking_points: "messaging-talking-points",
      audience: "messaging-audience-analysis",
      impact: "messaging-impact",
    };
    const fn = fnMap[String(args.type)];
    if (!fn) return { content: [{ type: "text" as const, text: "type must be talking_points|audience|impact" }] };
    const { type: _t, ...rest } = args as any;
    const { data, error } = await supabase.functions.invoke(fn, { body: { ...rest, force_refresh: true, force: true } });
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("admin_dispatch_alerts", {
  description: "[ADMIN] Force-run the dispatch-alerts cron job immediately.",
  inputSchema: { type: "object" as const, properties: {} },
  handler: async (_args: Record<string, unknown>, ctx?: any) => {
    const caller = await resolveCallerUser(ctx?.request || ctx);
    if (!caller?.isAdmin) return { content: [{ type: "text" as const, text: "Admin role required" }] };
    const { data, error } = await supabase.functions.invoke("dispatch-alerts");
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

// ─── Admin Mutation Tools ───────────────────────────────────────────────────

mcpServer.tool("admin_delete_entity_note", {
  description: "[ADMIN] Delete any user's entity note. Use for moderation of inappropriate content.",
  inputSchema: { type: "object" as const, properties: { note_id: { type: "string" as const } }, required: ["note_id"] },
  handler: async (args: Record<string, unknown>, ctx?: any) => {
    const caller = await resolveCallerUser(ctx?.request || ctx);
    if (!caller?.isAdmin) return { content: [{ type: "text" as const, text: "Admin role required" }] };
    const { error } = await supabase.from("entity_notes").delete().eq("id", String(args.note_id));
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true, deleted: args.note_id }) }] };
  },
});

mcpServer.tool("admin_update_entity_note", {
  description: "[ADMIN] Update any user's entity note (e.g. redact body, toggle is_shared).",
  inputSchema: { type: "object" as const, properties: {
    note_id: { type: "string" as const }, body: { type: "string" as const }, is_shared: { type: "boolean" as const },
  }, required: ["note_id"] },
  handler: async (args: Record<string, unknown>, ctx?: any) => {
    const caller = await resolveCallerUser(ctx?.request || ctx);
    if (!caller?.isAdmin) return { content: [{ type: "text" as const, text: "Admin role required" }] };
    const update: Record<string, unknown> = {};
    if (args.body !== undefined) update.body = args.body;
    if (args.is_shared !== undefined) update.is_shared = args.is_shared;
    const { data, error } = await supabase.from("entity_notes").update(update as never).eq("id", String(args.note_id)).select();
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("admin_create_graph_edge", {
  description: "[ADMIN] Create a relationship edge in the entity graph (donations, votes, lobbying, etc).",
  inputSchema: { type: "object" as const, properties: {
    source_type: { type: "string" as const }, source_id: { type: "string" as const }, source_label: { type: "string" as const },
    target_type: { type: "string" as const }, target_id: { type: "string" as const }, target_label: { type: "string" as const },
    relationship_type: { type: "string" as const }, amount: { type: "number" as const },
    weight: { type: "number" as const }, source: { type: "string" as const }, observed_at: { type: "string" as const },
    metadata: { type: "object" as const },
  }, required: ["source_type", "source_id", "source_label", "target_type", "target_id", "target_label", "relationship_type"] },
  handler: async (args: Record<string, unknown>, ctx?: any) => {
    const caller = await resolveCallerUser(ctx?.request || ctx);
    if (!caller?.isAdmin) return { content: [{ type: "text" as const, text: "Admin role required" }] };
    const { data, error } = await supabase.from("entity_relationships").insert(args as never).select();
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("admin_update_graph_edge", {
  description: "[ADMIN] Update an existing entity_relationships edge (amount, weight, metadata, etc).",
  inputSchema: { type: "object" as const, properties: {
    edge_id: { type: "string" as const }, amount: { type: "number" as const }, weight: { type: "number" as const },
    relationship_type: { type: "string" as const }, source: { type: "string" as const },
    observed_at: { type: "string" as const }, metadata: { type: "object" as const },
  }, required: ["edge_id"] },
  handler: async (args: Record<string, unknown>, ctx?: any) => {
    const caller = await resolveCallerUser(ctx?.request || ctx);
    if (!caller?.isAdmin) return { content: [{ type: "text" as const, text: "Admin role required" }] };
    const { edge_id, ...update } = args;
    const { data, error } = await supabase.from("entity_relationships").update(update as never).eq("id", String(edge_id)).select();
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("admin_delete_graph_edge", {
  description: "[ADMIN] Delete a relationship edge from the entity graph.",
  inputSchema: { type: "object" as const, properties: { edge_id: { type: "string" as const } }, required: ["edge_id"] },
  handler: async (args: Record<string, unknown>, ctx?: any) => {
    const caller = await resolveCallerUser(ctx?.request || ctx);
    if (!caller?.isAdmin) return { content: [{ type: "text" as const, text: "Admin role required" }] };
    const { error } = await supabase.from("entity_relationships").delete().eq("id", String(args.edge_id));
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true, deleted: args.edge_id }) }] };
  },
});

mcpServer.tool("admin_regenerate_ai", {
  description: "[ADMIN] Regenerate cached AI analysis. type=vulnerability_score|talking_points|bill_impact. Provide ref (slug/bill_id).",
  inputSchema: { type: "object" as const, properties: {
    type: { type: "string" as const }, ref: { type: "string" as const },
    scope: { type: "string" as const }, scope_ref: { type: "string" as const },
  }, required: ["type", "ref"] },
  handler: async (args: Record<string, unknown>, ctx?: any) => {
    const caller = await resolveCallerUser(ctx?.request || ctx);
    if (!caller?.isAdmin) return { content: [{ type: "text" as const, text: "Admin role required" }] };
    const fnMap: Record<string, string> = {
      vulnerability_score: "vulnerability-score",
      talking_points: "talking-points",
      bill_impact: "bill-impact",
    };
    const fn = fnMap[String(args.type)];
    if (!fn) return { content: [{ type: "text" as const, text: "Unknown type. Use vulnerability_score|talking_points|bill_impact" }] };
    const body: Record<string, unknown> = { force: true };
    if (args.type === "vulnerability_score") body.candidate_slug = args.ref;
    else if (args.type === "bill_impact") { body.bill_id = args.ref; if (args.scope) body.scope = args.scope; if (args.scope_ref) body.scope_ref = args.scope_ref; }
    else { body.subject_type = "candidate"; body.subject_ref = args.ref; }
    const { data, error } = await supabase.functions.invoke(fn, { body });
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

// ─── Phase 6: Geopolitics, War Rooms, Sync ────────────────────────────────

mcpServer.tool("get_country_geopolitics", {
  description: "Get the cached geopolitical intelligence brief for a country (alliances, rivalries, military, trade, stock markets, sources). Returns null if not yet generated.",
  inputSchema: {
    type: "object" as const,
    properties: { country_code: { type: "string" as const, description: "ISO-2 country code, e.g. 'DE'" } },
    required: ["country_code"],
  },
  handler: async (args: Record<string, unknown>) => {
    const code = String(args.country_code || "").toUpperCase();
    const { data, error } = await supabase
      .from("international_profiles")
      .select("country_code,country_name,geopolitics,geopolitics_generated_at,geopolitics_model")
      .eq("country_code", code).maybeSingle();
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("refresh_country_geopolitics", {
  description: "Force-regenerate the AI geopolitics brief for a country. Burns AI credits — use sparingly. Admin role required.",
  inputSchema: {
    type: "object" as const,
    properties: { country_code: { type: "string" as const } },
    required: ["country_code"],
  },
  handler: async (args: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("geopolitics-brief", {
      body: { country_code: String(args.country_code || "").toUpperCase(), force: true },
    });
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("list_international_elections", {
  description: "List elections for a country (presidential, parliamentary, etc.) with dates, results, turnout.",
  inputSchema: {
    type: "object" as const,
    properties: {
      country_code: { type: "string" as const },
      limit: { type: "number" as const },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const code = args.country_code ? String(args.country_code).toUpperCase() : undefined;
    const limit = Math.min((args.limit as number) || 50, 200);
    let q = supabase.from("international_elections").select("*").limit(limit).order("election_date", { ascending: false });
    if (code) q = q.eq("country_code", code);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("list_international_leaders", {
  description: "List political leaders (heads of state, prime ministers) for a country with terms and parties.",
  inputSchema: {
    type: "object" as const,
    properties: {
      country_code: { type: "string" as const },
      limit: { type: "number" as const },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const code = args.country_code ? String(args.country_code).toUpperCase() : undefined;
    const limit = Math.min((args.limit as number) || 50, 200);
    let q = supabase.from("international_leaders").select("*").limit(limit).order("term_start", { ascending: false });
    if (code) q = q.eq("country_code", code);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("list_war_rooms", {
  description: "List war rooms the calling user owns or is a member of. War rooms are private collaborative spaces with shared notes, alerts, and chat.",
  inputSchema: { type: "object" as const, properties: {} },
  handler: async (_args: Record<string, unknown>, ctx: Record<string, unknown>) => {
    const userId = (ctx as { userId?: string })?.userId;
    if (!userId) return { content: [{ type: "text" as const, text: "Caller user_id unavailable" }] };
    const [{ data: owned }, { data: memberRows }] = await Promise.all([
      supabase.from("war_rooms").select("*").eq("owner_id", userId),
      supabase.from("war_room_members").select("war_room_id").eq("user_id", userId),
    ]);
    const memberIds = (memberRows || []).map((m: { war_room_id: string }) => m.war_room_id);
    let rooms = (owned || []) as Array<Record<string, unknown>>;
    if (memberIds.length) {
      const { data: memberRooms } = await supabase.from("war_rooms").select("*").in("id", memberIds);
      rooms = [...rooms, ...(memberRooms || [])];
    }
    const seen = new Set<string>();
    rooms = rooms.filter((r) => { const id = String(r.id); if (seen.has(id)) return false; seen.add(id); return true; });
    return { content: [{ type: "text" as const, text: JSON.stringify(rooms, null, 2) }] };
  },
});

mcpServer.tool("get_war_room_messages", {
  description: "Read recent messages from a war room. Caller must be a member.",
  inputSchema: {
    type: "object" as const,
    properties: {
      room_id: { type: "string" as const },
      limit: { type: "number" as const },
    },
    required: ["room_id"],
  },
  handler: async (args: Record<string, unknown>, ctx: Record<string, unknown>) => {
    const userId = (ctx as { userId?: string })?.userId;
    const roomId = String(args.room_id);
    const limit = Math.min((args.limit as number) || 50, 500);
    const { data: isMember } = await supabase.rpc("is_war_room_member", { _room_id: roomId, _user_id: userId });
    if (!isMember) return { content: [{ type: "text" as const, text: "Not a member of this war room" }] };
    const { data, error } = await supabase.from("war_room_messages").select("*")
      .eq("war_room_id", roomId).order("created_at", { ascending: false }).limit(limit);
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("get_sync_status", {
  description: "Get the latest run status for each scheduled-sync source (success/error/partial, rows synced, last run time).",
  inputSchema: {
    type: "object" as const,
    properties: { source: { type: "string" as const, description: "Optional filter, e.g. 'polling'" } },
  },
  handler: async (args: Record<string, unknown>) => {
    let q = supabase.from("sync_run_log").select("*").order("started_at", { ascending: false }).limit(200);
    if (args.source) q = q.eq("source", String(args.source));
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

// ─── Subject AI Tools (district / state_leg / legislation / polling / country) ──

const SUBJ_TYPES = ["district", "state_leg", "legislation", "polling", "country"];

mcpServer.tool("get_subject_talking_points", {
  description: "List cached AI talking points for a subject. subject_type ∈ district|state_leg|legislation|polling|country.",
  inputSchema: { type: "object" as const, properties: {
    subject_type: { type: "string" as const }, subject_ref: { type: "string" as const }, limit: { type: "number" as const },
  }, required: ["subject_type", "subject_ref"] },
  handler: async (args: Record<string, unknown>) => {
    const st = String(args.subject_type);
    if (!SUBJ_TYPES.includes(st)) return { content: [{ type: "text" as const, text: `Invalid subject_type. Allowed: ${SUBJ_TYPES.join("|")}` }] };
    const { data, error } = await supabase.from("talking_points").select("*").eq("subject_type", st).eq("subject_ref", String(args.subject_ref)).order("created_at", { ascending: false }).limit(Math.min(50, Number(args.limit) || 10));
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("generate_subject_talking_points", {
  description: "Generate fresh AI talking points for a subject (district|state_leg|legislation|polling|country) with optional cross-section context.",
  inputSchema: { type: "object" as const, properties: {
    subject_type: { type: "string" as const }, subject_ref: { type: "string" as const },
    audience: { type: "string" as const }, angle: { type: "string" as const }, tone: { type: "string" as const },
    length: { type: "string" as const }, count: { type: "number" as const }, model: { type: "string" as const },
    include_sections: { type: "array" as const, items: { type: "string" as const } },
    custom_instructions: { type: "string" as const },
  }, required: ["subject_type", "subject_ref"] },
  handler: async (args: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("subject-talking-points", { body: args });
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("get_subject_audience_analysis", {
  description: "Cached audience effectiveness scoring for a subject.",
  inputSchema: { type: "object" as const, properties: {
    subject_type: { type: "string" as const }, subject_ref: { type: "string" as const },
  }, required: ["subject_type", "subject_ref"] },
  handler: async (args: Record<string, unknown>) => {
    const { data, error } = await (supabase.from as any)("subject_audience_analyses").select("*").eq("subject_type", String(args.subject_type)).eq("subject_ref", String(args.subject_ref)).maybeSingle();
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("generate_subject_audience_analysis", {
  description: "Generate (or refresh, when force_refresh=true) audience analysis for a subject.",
  inputSchema: { type: "object" as const, properties: {
    subject_type: { type: "string" as const }, subject_ref: { type: "string" as const },
    force_refresh: { type: "boolean" as const }, model: { type: "string" as const },
    include_sections: { type: "array" as const, items: { type: "string" as const } },
  }, required: ["subject_type", "subject_ref"] },
  handler: async (args: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("subject-audience-analysis", { body: args });
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("get_subject_impact", {
  description: "Cached impact analyses (national/state/district) for a subject.",
  inputSchema: { type: "object" as const, properties: {
    subject_type: { type: "string" as const }, subject_ref: { type: "string" as const },
    scope: { type: "string" as const }, scope_ref: { type: "string" as const },
  }, required: ["subject_type", "subject_ref"] },
  handler: async (args: Record<string, unknown>) => {
    let q = (supabase.from as any)("subject_impact_analyses").select("*").eq("subject_type", String(args.subject_type)).eq("subject_ref", String(args.subject_ref));
    if (args.scope) q = q.eq("scope", String(args.scope));
    if (args.scope_ref) q = q.eq("scope_ref", String(args.scope_ref));
    const { data, error } = await q.order("generated_at", { ascending: false }).limit(20);
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("generate_subject_impact", {
  description: "Generate impact analysis for a subject at a given scope (national|state|district).",
  inputSchema: { type: "object" as const, properties: {
    subject_type: { type: "string" as const }, subject_ref: { type: "string" as const },
    scope: { type: "string" as const }, scope_ref: { type: "string" as const },
    force_refresh: { type: "boolean" as const }, model: { type: "string" as const },
    include_sections: { type: "array" as const, items: { type: "string" as const } },
  }, required: ["subject_type", "subject_ref"] },
  handler: async (args: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("subject-impact-analysis", { body: args });
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

// =====================================================================
// OSINT Workbench (71 tools across people / business / property)
// =====================================================================
import { OSINT_CATALOG, getOsintCatalogEntry } from "../_shared/osint-catalog.ts";

mcpServer.tool("osint_list_tools", {
  description: "List all OSINT research tools (71 total) across People, Business, and Property categories. Returns id, label, source, kind (url|edge), category, requires_key (if any), and tags.",
  inputSchema: { type: "object" as const, properties: {
    category: { type: "string" as const, description: "Optional filter: people | business | property" },
    requires_key: { type: "boolean" as const, description: "If true, only tools needing a user API key" },
  } },
  handler: async (args: Record<string, unknown>) => {
    let list = OSINT_CATALOG;
    if (args.category) list = list.filter((t) => t.category === args.category);
    if (typeof args.requires_key === "boolean") {
      list = list.filter((t) => Boolean(t.requires_key) === args.requires_key);
    }
    return { content: [{ type: "text" as const, text: JSON.stringify({ count: list.length, tools: list }, null, 2) }] };
  },
});

mcpServer.tool("osint_get_tool", {
  description: "Get full metadata for a single OSINT tool by id.",
  inputSchema: { type: "object" as const, properties: {
    id: { type: "string" as const, description: "Tool id (e.g. 'opensanctions', 'whois-dns')" },
  }, required: ["id"] },
  handler: async (args: Record<string, unknown>) => {
    const tool = getOsintCatalogEntry(String(args.id));
    if (!tool) return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Tool not found" }) }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(tool, null, 2) }] };
  },
});

mcpServer.tool("osint_search", {
  description: "Execute an OSINT search. For 'edge' tools the request is dispatched to the osint-search edge function (uses caller's stored keys when needed). For 'url' tools returns a deep-link URL the client can open. Pass tool_id from osint_list_tools.",
  inputSchema: { type: "object" as const, properties: {
    tool_id: { type: "string" as const, description: "OSINT tool id" },
    query: { type: "string" as const, description: "Search query / target" },
  }, required: ["tool_id", "query"] },
  handler: async (args: Record<string, unknown>) => {
    const tool = getOsintCatalogEntry(String(args.tool_id));
    const query = String(args.query || "").trim();
    if (!tool) return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Unknown tool_id" }) }] };
    if (!query) return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Query required" }) }] };

    if (tool.kind === "url") {
      const url = (tool.url_template || "").replace("{q}", encodeURIComponent(query));
      return { content: [{ type: "text" as const, text: JSON.stringify({ tool: tool.id, kind: "url", url, source: tool.source, fetched_at: new Date().toISOString() }, null, 2) }] };
    }

    // edge dispatch
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/osint-search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
          "x-osint-caller": "mcp-server",
        },
        body: JSON.stringify({ action: tool.edge_action, query, tool_id: tool.id }),
      });
      const data = await resp.json();
      return { content: [{ type: "text" as const, text: JSON.stringify({ tool: tool.id, kind: "edge", ...data }, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Edge dispatch failed: ${(e as Error).message}` }) }] };
    }
  },
});

mcpServer.tool("get_subject_ai_bundle", {
  description: "One-call bundle: talking points + audience + impact analyses for a subject.",
  inputSchema: { type: "object" as const, properties: {
    subject_type: { type: "string" as const }, subject_ref: { type: "string" as const },
  }, required: ["subject_type", "subject_ref"] },
  handler: async (args: Record<string, unknown>) => {
    const st = String(args.subject_type), sr = String(args.subject_ref);
    const [tp, aud, imp] = await Promise.all([
      supabase.from("talking_points").select("*").eq("subject_type", st).eq("subject_ref", sr).order("created_at", { ascending: false }).limit(10),
      (supabase.from as any)("subject_audience_analyses").select("*").eq("subject_type", st).eq("subject_ref", sr).maybeSingle(),
      (supabase.from as any)("subject_impact_analyses").select("*").eq("subject_type", st).eq("subject_ref", sr).order("generated_at", { ascending: false }).limit(10),
    ]);
    return { content: [{ type: "text" as const, text: JSON.stringify({ talking_points: tp.data || [], audience_analysis: aud.data, impact_analyses: imp.data || [] }, null, 2) }] };
  },
});



// ─── Self-documentation tools (Phase 9) ─────────────────────────────────
// Proxy through public-api/docs* so the source-of-truth registry stays in one file.
const PUBLIC_API_BASE = `${supabaseUrl}/functions/v1/public-api`;

async function fetchDocs(path: string): Promise<unknown> {
  // Use service-role to bypass API-key validation when calling sibling function.
  const resp = await fetch(`${PUBLIC_API_BASE}/${path}`, {
    headers: {
      "Authorization": `Bearer ${supabaseKey}`,
      "X-API-Key": Deno.env.get("MCP_INTERNAL_API_KEY") ?? "",
    },
  });
  if (!resp.ok) {
    // Fallback: return error payload so MCP clients still see something useful.
    return { error: `docs fetch failed (${resp.status})`, status: resp.status };
  }
  return await resp.json();
}

mcpServer.tool("docs_index", {
  description: "Top-level self-documentation index: counts of wiki pages, endpoints, tables, edge functions, and MCP tools.",
  inputSchema: { type: "object" as const, properties: {} },
  handler: async () => {
    const data = await fetchDocs("docs");
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("docs_list_wiki_pages", {
  description: "List every wiki page (slug, title, sort order, updated_at).",
  inputSchema: { type: "object" as const, properties: {} },
  handler: async () => {
    const { data, error } = await supabase
      .from("wiki_pages").select("slug,title,sort_order,updated_at").order("sort_order", { ascending: true });
    if (error) return { content: [{ type: "text" as const, text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ data, count: data?.length ?? 0 }, null, 2) }] };
  },
});

mcpServer.tool("docs_get_wiki_page", {
  description: "Fetch the full markdown content of a single wiki page by slug.",
  inputSchema: {
    type: "object" as const,
    properties: { slug: { type: "string" as const, description: "Wiki page slug, e.g. '01-Overview'" } },
    required: ["slug"],
  },
  handler: async (args: Record<string, unknown>) => {
    const slug = String(args.slug ?? "");
    const { data, error } = await supabase.from("wiki_pages").select("*").eq("slug", slug).maybeSingle();
    if (error) return { content: [{ type: "text" as const, text: JSON.stringify({ error: error.message }) }] };
    if (!data) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Not found: ${slug}` }) }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ data }, null, 2) }] };
  },
});

mcpServer.tool("docs_list_endpoints", {
  description: "List every public-api REST endpoint with description and path.",
  inputSchema: { type: "object" as const, properties: {} },
  handler: async () => {
    const data = await fetchDocs("docs-endpoints");
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("docs_list_tables", {
  description: "List every database table available for offline sync.",
  inputSchema: { type: "object" as const, properties: {} },
  handler: async () => {
    const data = await fetchDocs("docs-tables");
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("docs_list_edge_functions", {
  description: "List every deployed edge function with purpose and auth requirement.",
  inputSchema: { type: "object" as const, properties: {} },
  handler: async () => {
    const data = await fetchDocs("docs-edge-functions");
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("docs_list_mcp_tools", {
  description: "List every MCP tool registered on this server with category and description.",
  inputSchema: { type: "object" as const, properties: {} },
  handler: async () => {
    const data = await fetchDocs("docs-mcp-tools");
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

const transport = new StreamableHttpTransport();
const httpHandler = transport.bind(mcpServer);

app.all("/*", async (c) => {
  return await httpHandler(c.req.raw);
});

Deno.serve(app.fetch);
