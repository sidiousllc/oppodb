import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { McpServer, StreamableHttpTransport } from "npm:mcp-lite@^0.10.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const app = new Hono();

const mcpServer = new McpServer({
  name: "ordb-mcp-server",
  version: "1.0.0",
});

// ─── Tool: Search Candidates ────────────────────────────────────────────────

mcpServer.tool({
  name: "search_candidates",
  description:
    "Search opposition research candidate profiles. Returns name, slug, content, and metadata. Use 'search' to filter by name.",
  inputSchema: {
    type: "object",
    properties: {
      search: { type: "string", description: "Filter candidates by name (optional)" },
      limit: { type: "number", description: "Max results (default 20, max 100)" },
      offset: { type: "number", description: "Pagination offset (default 0)" },
    },
  },
  handler: async ({ search, limit = 20, offset = 0 }: { search?: string; limit?: number; offset?: number }) => {
    let q = supabase
      .from("candidate_profiles")
      .select("name,slug,is_subpage,subpage_title,parent_slug,content,updated_at", { count: "exact" })
      .range(offset, offset + Math.min(limit, 100) - 1)
      .order("name");
    if (search) q = q.ilike("name", `%${search}%`);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ total: count, results: data }, null, 2),
        },
      ],
    };
  },
});

// ─── Tool: Get Candidate ────────────────────────────────────────────────────

mcpServer.tool({
  name: "get_candidate",
  description:
    "Get a specific candidate profile by slug. Returns full opposition research content.",
  inputSchema: {
    type: "object",
    properties: {
      slug: { type: "string", description: "Candidate slug (e.g. 'john-doe')" },
    },
    required: ["slug"],
  },
  handler: async ({ slug }: { slug: string }) => {
    const { data, error } = await supabase
      .from("candidate_profiles")
      .select("*")
      .eq("slug", slug);
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    if (!data || data.length === 0) return { content: [{ type: "text", text: `No candidate found with slug: ${slug}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ─── Tool: Search Districts ─────────────────────────────────────────────────

mcpServer.tool({
  name: "search_congressional_districts",
  description:
    "Search congressional district demographic profiles with census data including population, income, race/ethnicity, education, and housing.",
  inputSchema: {
    type: "object",
    properties: {
      state: { type: "string", description: "State abbreviation filter (e.g. 'CA', 'TX')" },
      search: { type: "string", description: "Search by district ID" },
      limit: { type: "number", description: "Max results (default 20, max 100)" },
      offset: { type: "number", description: "Pagination offset (default 0)" },
    },
  },
  handler: async ({ state, search, limit = 20, offset = 0 }: { state?: string; search?: string; limit?: number; offset?: number }) => {
    let q = supabase
      .from("district_profiles")
      .select("*", { count: "exact" })
      .range(offset, offset + Math.min(limit, 100) - 1)
      .order("district_id");
    if (state) q = q.eq("state", state.toUpperCase());
    if (search) q = q.ilike("district_id", `%${search}%`);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

// ─── Tool: Search State Legislative Districts ───────────────────────────────

mcpServer.tool({
  name: "search_state_legislative",
  description:
    "Search state legislative district profiles (house and senate) with census demographic data for all 50 states.",
  inputSchema: {
    type: "object",
    properties: {
      state: { type: "string", description: "State abbreviation (e.g. 'FL', 'NY')" },
      chamber: { type: "string", description: "'house' or 'senate'" },
      limit: { type: "number", description: "Max results (default 20, max 100)" },
      offset: { type: "number", description: "Pagination offset (default 0)" },
    },
  },
  handler: async ({ state, chamber, limit = 20, offset = 0 }: { state?: string; chamber?: string; limit?: number; offset?: number }) => {
    let q = supabase
      .from("state_legislative_profiles")
      .select("*", { count: "exact" })
      .range(offset, offset + Math.min(limit, 100) - 1)
      .order("district_id");
    if (state) q = q.eq("state_abbr", state.toUpperCase());
    if (chamber) q = q.eq("chamber", chamber.toLowerCase());
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

// ─── Tool: Election Results ─────────────────────────────────────────────────

mcpServer.tool({
  name: "get_election_results",
  description:
    "Get state legislative election results with vote counts, percentages, and winners. Filter by state, chamber, district, and year.",
  inputSchema: {
    type: "object",
    properties: {
      state: { type: "string", description: "State abbreviation (e.g. 'FL')" },
      chamber: { type: "string", description: "'house' or 'senate'" },
      district: { type: "string", description: "District number" },
      year: { type: "number", description: "Election year (e.g. 2022)" },
      limit: { type: "number", description: "Max results (default 50, max 200)" },
      offset: { type: "number", description: "Pagination offset (default 0)" },
    },
  },
  handler: async ({ state, chamber, district, year, limit = 50, offset = 0 }: { state?: string; chamber?: string; district?: string; year?: number; limit?: number; offset?: number }) => {
    let q = supabase
      .from("state_leg_election_results")
      .select("*", { count: "exact" })
      .range(offset, offset + Math.min(limit, 200) - 1)
      .order("election_year", { ascending: false });
    if (state) q = q.eq("state_abbr", state.toUpperCase());
    if (chamber) q = q.eq("chamber", chamber.toLowerCase());
    if (district) q = q.eq("district_number", district.replace(/^0+/, "") || "0");
    if (year) q = q.eq("election_year", year);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

// ─── Tool: Polling Data ─────────────────────────────────────────────────────

mcpServer.tool({
  name: "get_polling_data",
  description:
    "Get polling data with approval/favorability ratings, methodology, and margins. Search by candidate or topic.",
  inputSchema: {
    type: "object",
    properties: {
      search: { type: "string", description: "Search by candidate or topic name" },
      limit: { type: "number", description: "Max results (default 20, max 100)" },
      offset: { type: "number", description: "Pagination offset (default 0)" },
    },
  },
  handler: async ({ search, limit = 20, offset = 0 }: { search?: string; limit?: number; offset?: number }) => {
    let q = supabase
      .from("polling_data")
      .select("*", { count: "exact" })
      .range(offset, offset + Math.min(limit, 100) - 1)
      .order("date_conducted", { ascending: false });
    if (search) q = q.ilike("candidate_or_topic", `%${search}%`);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

// ─── Tool: MAGA Files ───────────────────────────────────────────────────────

mcpServer.tool({
  name: "get_maga_files",
  description:
    "Get vetting reports on Trump administration executive branch appointees. Search by appointee name or list all available reports.",
  inputSchema: {
    type: "object",
    properties: {
      search: { type: "string", description: "Search by appointee name" },
      slug: { type: "string", description: "Get specific report by slug" },
      limit: { type: "number", description: "Max results (default 20, max 100)" },
      offset: { type: "number", description: "Pagination offset (default 0)" },
    },
  },
  handler: async ({ search, slug, limit = 20, offset = 0 }: { search?: string; slug?: string; limit?: number; offset?: number }) => {
    if (slug) {
      const { data, error } = await supabase.from("maga_files").select("*").eq("slug", slug);
      if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
    let q = supabase
      .from("maga_files")
      .select("id,name,slug,created_at,updated_at", { count: "exact" })
      .range(offset, offset + Math.min(limit, 100) - 1)
      .order("name");
    if (search) q = q.ilike("name", `%${search}%`);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

// ─── Tool: Narrative Reports ────────────────────────────────────────────────

mcpServer.tool({
  name: "get_narrative_reports",
  description:
    "Get comprehensive issue-based policy reports on Trump administration impacts. Topics include housing, healthcare, education, retirement, and more.",
  inputSchema: {
    type: "object",
    properties: {
      search: { type: "string", description: "Search by report topic" },
      slug: { type: "string", description: "Get specific report by slug" },
      limit: { type: "number", description: "Max results (default 20, max 100)" },
      offset: { type: "number", description: "Pagination offset (default 0)" },
    },
  },
  handler: async ({ search, slug, limit = 20, offset = 0 }: { search?: string; slug?: string; limit?: number; offset?: number }) => {
    if (slug) {
      const { data, error } = await supabase.from("narrative_reports").select("*").eq("slug", slug);
      if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
    let q = supabase
      .from("narrative_reports")
      .select("id,name,slug,created_at,updated_at", { count: "exact" })
      .range(offset, offset + Math.min(limit, 100) - 1)
      .order("name");
    if (search) q = q.ilike("name", `%${search}%`);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

// ─── Tool: Local Impacts ────────────────────────────────────────────────────

mcpServer.tool({
  name: "get_local_impacts",
  description:
    "Get state-specific analyses of Trump administration policy impacts. Available for all 50 states covering economy, healthcare, education, agriculture, and more.",
  inputSchema: {
    type: "object",
    properties: {
      state: { type: "string", description: "State name or abbreviation" },
      limit: { type: "number", description: "Max results (default 20, max 50)" },
      offset: { type: "number", description: "Pagination offset (default 0)" },
    },
  },
  handler: async ({ state, limit = 20, offset = 0 }: { state?: string; limit?: number; offset?: number }) => {
    if (state && state.length <= 2) {
      // Try abbreviation lookup — local_impacts uses full state name, so we need a fuzzy match
      const { data, error } = await supabase
        .from("local_impacts")
        .select("*")
        .ilike("state", `%${state}%`);
      if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
    let q = supabase
      .from("local_impacts")
      .select("id,state,slug,summary,created_at,updated_at", { count: "exact" })
      .range(offset, offset + Math.min(limit, 50) - 1)
      .order("state");
    if (state) q = q.ilike("state", `%${state}%`);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify({ total: count, results: data }, null, 2) }] };
  },
});

// ─── HTTP Transport ─────────────────────────────────────────────────────────

const transport = new StreamableHttpTransport();

app.all("/*", async (c) => {
  return await transport.handleRequest(c.req.raw, mcpServer);
});

Deno.serve(app.fetch);
