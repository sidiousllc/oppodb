import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { McpServer, StreamableHttpTransport } from "npm:mcp-lite@^0.10.0";

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

// ─── HTTP Transport ─────────────────────────────────────────────────────────

const transport = new StreamableHttpTransport();
const httpHandler = transport.bind(mcpServer);

app.all("/*", async (c) => {
  return await httpHandler(c.req.raw);
});

Deno.serve(app.fetch);
