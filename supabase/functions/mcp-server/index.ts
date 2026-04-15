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
  description: "Unified search across ALL 24 OppoDB databases simultaneously: candidates, congress members, bills, polling, campaign finance, election results, forecasts, MAGA files, narrative reports, local impacts, voter stats, prediction markets, messaging guidance, intel briefings, tracked bills, MIT elections, committees, votes, state leg elections, and forecast history. Returns results grouped by category.",
  inputSchema: {
    type: "object" as const,
    properties: {
      search: { type: "string" as const, description: "Search query (min 2 characters)" },
      categories: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "Optional list of categories to search. Available: candidates, congress_members, bills, polling, campaign_finance, state_finance, election_results, forecasts, maga_files, narrative_reports, local_impacts, voter_stats, mn_finance, prediction_markets, messaging_guidance, intel_briefings, tracked_bills, mit_elections, congress_committees, congress_votes, state_leg_elections, forecast_history. Defaults to all.",
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
      "international_legislation", "international_policy_issues",
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

    const settled = await Promise.all(entries.map(async ([key, promise]) => {
      const res = await promise;
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

// ─── HTTP Transport ─────────────────────────────────────────────────────────

const transport = new StreamableHttpTransport();
const httpHandler = transport.bind(mcpServer);

app.all("/*", async (c) => {
  return await httpHandler(c.req.raw);
});

Deno.serve(app.fetch);
