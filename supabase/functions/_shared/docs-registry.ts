// ============================================================================
// Shared documentation registry for the Public REST API and the MCP server.
//
// Both `public-api` and `mcp-server` import this file and use it to:
//   • return rich machine-readable docs from the /docs-* endpoints
//   • enrich the MCP `tools/list` JSON-RPC response with longer descriptions
//     and `annotations.category`/`annotations.subsection` for grouped UIs
//
// Adding a new endpoint or tool? Add it here. The two functions are
// intentionally thin pass-throughs over this single source of truth.
// ============================================================================

// ─── Section / subsection taxonomy ──────────────────────────────────────────
// Mirrors the user-facing hub navigation so docs UIs can render grouped trees.
export const SECTIONS = {
  candidates:    { label: "Candidates",            order: 10 },
  districts:     { label: "Districts",             order: 20 },
  elections:     { label: "Elections & Forecasts", order: 30 },
  polling:       { label: "Polling",               order: 40 },
  finance:       { label: "Campaign Finance",      order: 50 },
  congress:      { label: "Congress",              order: 60 },
  legislation:   { label: "Legislation",           order: 70 },
  intel:         { label: "Intel Hub",             order: 80 },
  messaging:     { label: "Messaging Hub",         order: 90 },
  research:      { label: "Research / OppoHub",    order: 100 },
  international: { label: "International Hub",     order: 110 },
  reports:       { label: "Reports Hub",           order: 120 },
  alerts:        { label: "Alerts Hub",            order: 130 },
  graph:         { label: "Graph Hub",             order: 140 },
  warroom:       { label: "War Rooms",             order: 150 },
  ai:            { label: "AI Generation",         order: 160 },
  markets:       { label: "Prediction Markets",    order: 170 },
  voter:         { label: "Voter Data",            order: 180 },
  osint:         { label: "OSINT",                 order: 190 },
  devices:       { label: "Devices & Location",    order: 200 },
  user:          { label: "User Settings",         order: 210 },
  admin:         { label: "Admin",                 order: 220 },
  offline:       { label: "Offline / Sync",        order: 230 },
  docs:          { label: "Documentation",         order: 240 },
  search:        { label: "Search",                order: 250 },
} as const;

export type SectionKey = keyof typeof SECTIONS;

// ─── REST endpoint specs ────────────────────────────────────────────────────
export interface ParamSpec {
  name: string;
  in: "query" | "body" | "path";
  type: "string" | "number" | "boolean" | "object" | "array" | "uuid" | "date";
  required?: boolean;
  description: string;
  example?: unknown;
  enum?: readonly string[];
}

export interface EndpointSpec {
  endpoint: string;
  section: SectionKey;
  subsection?: string;
  methods: ReadonlyArray<"GET" | "POST" | "PATCH" | "PUT" | "DELETE">;
  summary: string;
  /** Markdown-friendly long-form description (>= 1 sentence, may include hints). */
  description: string;
  auth: "public" | "api-key" | "user" | "admin";
  params?: ReadonlyArray<ParamSpec>;
  /** A worked example URL (no host) — what a curl would look like. */
  example?: string;
  /** Sample of one row from the `data[]` envelope. */
  responseSample?: unknown;
}

const PAGINATION: ReadonlyArray<ParamSpec> = [
  { name: "limit",  in: "query", type: "number", description: "Page size, default 20, max 100." },
  { name: "offset", in: "query", type: "number", description: "Zero-based row offset." },
];

export const ENDPOINT_SPECS: ReadonlyArray<EndpointSpec> = [
  // ── Candidates ────────────────────────────────────────────────────────────
  {
    endpoint: "candidates", section: "candidates", methods: ["GET"], auth: "api-key",
    summary: "Candidate profiles",
    description: "Opposition-research candidate profiles with markdown content, tags, and parent/sub-page hierarchy.",
    params: [
      { name: "search", in: "query", type: "string",  description: "Filter by name (ILIKE)." },
      { name: "slug",   in: "query", type: "string",  description: "Exact slug lookup." },
      { name: "tags",   in: "query", type: "string",  description: "Comma-separated tag filter." },
      ...PAGINATION,
    ],
    example: "/public-api/candidates?search=walz&limit=5",
    responseSample: { id: "uuid", slug: "tim-walz", name: "Tim Walz", tags: ["governor","democrat"], updated_at: "2026-04-01T00:00:00Z" },
  },

  // ── Districts ─────────────────────────────────────────────────────────────
  {
    endpoint: "districts", section: "districts", methods: ["GET"], auth: "api-key",
    summary: "U.S. congressional district profiles",
    description: "ACS-derived demographic profiles for all 435 congressional districts.",
    params: [
      { name: "state",    in: "query", type: "string", description: "2-letter state code." },
      { name: "district", in: "query", type: "string", description: "Zero-padded district number, e.g. `03`." },
      ...PAGINATION,
    ],
    example: "/public-api/districts?state=MN",
    responseSample: { district_id: "MN-03", state: "MN", population: 760123, median_income: 92000, top_issues: ["housing"] },
  },
  {
    endpoint: "state-legislative", section: "districts", subsection: "State legislative", methods: ["GET"], auth: "api-key",
    summary: "State legislative district profiles",
    description: "All ~9,300 upper- and lower-chamber state legislative districts with census data.",
    params: [
      { name: "state",   in: "query", type: "string", description: "2-letter state code." },
      { name: "chamber", in: "query", type: "string", description: "`house` or `senate`.", enum: ["house","senate"] },
      ...PAGINATION,
    ],
    example: "/public-api/state-legislative?state=FL&chamber=house",
  },

  // ── Elections / Forecasts ────────────────────────────────────────────────
  {
    endpoint: "election-results", section: "elections", subsection: "State legislative", methods: ["GET"], auth: "api-key",
    summary: "State legislative election results",
    description: "Vote totals and winners for state legislative races.",
    params: [
      { name: "state",  in: "query", type: "string", description: "2-letter state code." },
      { name: "year",   in: "query", type: "number", description: "Election year." },
      { name: "office", in: "query", type: "string", description: "Office filter." },
      ...PAGINATION,
    ],
  },
  {
    endpoint: "congressional-elections", section: "elections", subsection: "Congressional", methods: ["GET"], auth: "api-key",
    summary: "Congressional election results",
    description: "House and Senate election results with vote counts, percentages, incumbency, and write-in flags.",
    params: [
      { name: "state",           in: "query", type: "string", description: "2-letter state code." },
      { name: "district_number", in: "query", type: "string", description: "Zero-padded district number." },
      { name: "election_year",   in: "query", type: "number", description: "Election year." },
      { name: "election_type",   in: "query", type: "string", description: "`general`, `primary`, `runoff`, `special`." },
      ...PAGINATION,
    ],
  },
  {
    endpoint: "mit-elections", section: "elections", subsection: "Historical (MIT)", methods: ["GET"], auth: "api-key",
    summary: "MIT Election Lab historical results (1976-2024)",
    description: "President / Senate / House results with county-level data where available.",
    params: [
      { name: "year",     in: "query", type: "number", description: "Election year." },
      { name: "state",    in: "query", type: "string", description: "2-letter state code." },
      { name: "office",   in: "query", type: "string", description: "`president` | `senate` | `house`." },
      { name: "district", in: "query", type: "string", description: "Zero-padded district number (House only)." },
      ...PAGINATION,
    ],
  },
  {
    endpoint: "state-leg-elections", section: "elections", subsection: "State legislative", methods: ["GET"], auth: "api-key",
    summary: "State legislative election results (alias)",
    description: "Same data set as `election-results` with normalized parameter names.",
    params: PAGINATION,
  },
  {
    endpoint: "election-forecasts", section: "elections", subsection: "Forecasts", methods: ["GET"], auth: "api-key",
    summary: "Race ratings (Cook / Sabato / Inside Elections)",
    description: "Aggregated qualitative ratings (Safe → Tossup) and quantitative win probabilities.",
    params: [
      { name: "cycle",     in: "query", type: "number", description: "Cycle, e.g. 2026." },
      { name: "race_type", in: "query", type: "string", description: "`senate` | `house` | `governor` | `president`." },
      { name: "state",     in: "query", type: "string", description: "2-letter state code." },
      { name: "district",  in: "query", type: "string", description: "Zero-padded district (house only)." },
      { name: "source",    in: "query", type: "string", description: "`cook` | `sabato` | `inside`." },
      ...PAGINATION,
    ],
  },
  {
    endpoint: "forecast-history", section: "elections", subsection: "Forecasts", methods: ["GET"], auth: "api-key",
    summary: "Rating change history",
    description: "Every recorded rating change (old → new) for a forecast race.",
    params: [
      { name: "cycle",     in: "query", type: "number", description: "Cycle filter." },
      { name: "race_type", in: "query", type: "string", description: "Race type filter." },
      { name: "state",     in: "query", type: "string", description: "State filter." },
      { name: "district",  in: "query", type: "string", description: "District filter." },
      { name: "source",    in: "query", type: "string", description: "Rating source." },
      ...PAGINATION,
    ],
  },

  // ── Polling ───────────────────────────────────────────────────────────────
  {
    endpoint: "polling", section: "polling", methods: ["GET"], auth: "api-key",
    summary: "Polling rows",
    description: "Raw polling rows with approval / favorability / horse-race numbers.",
    params: [
      { name: "race",     in: "query", type: "string", description: "Race key, e.g. `2026-senate-mn`." },
      { name: "state",    in: "query", type: "string", description: "2-letter state code." },
      { name: "pollster", in: "query", type: "string", description: "Pollster name (ILIKE)." },
      ...PAGINATION,
    ],
  },
  {
    endpoint: "polling-charts", section: "polling", subsection: "Charts", methods: ["GET"], auth: "api-key",
    summary: "Pre-aggregated polling charts",
    description: "Approval trends, rolling averages, demographic breakdowns, source comparisons, methodology breakdown.",
    params: [
      { name: "race",  in: "query", type: "string", description: "Race key." },
      { name: "state", in: "query", type: "string", description: "State code." },
    ],
  },

  // ── Campaign finance ─────────────────────────────────────────────────────
  {
    endpoint: "campaign-finance", section: "finance", subsection: "Federal", methods: ["GET"], auth: "api-key",
    summary: "Federal campaign finance (FEC + OpenSecrets)",
    description: "Aggregated raised / spent / cash-on-hand and top contributors.",
    params: [
      { name: "candidate_slug", in: "query", type: "string", description: "Candidate slug." },
      { name: "state",          in: "query", type: "string", description: "State code." },
      { name: "cycle",          in: "query", type: "number", description: "Cycle, e.g. 2026." },
      ...PAGINATION,
    ],
  },
  {
    endpoint: "state-finance", section: "finance", subsection: "State", methods: ["GET"], auth: "api-key",
    summary: "Multi-state campaign finance",
    description: "Aggregator for 50-state campaign finance datasets.",
    params: [
      { name: "state_abbr", in: "query", type: "string", description: "State code." },
      { name: "cycle",      in: "query", type: "number", description: "Cycle." },
      { name: "office",     in: "query", type: "string", description: "Office filter." },
      ...PAGINATION,
    ],
  },
  {
    endpoint: "mn-finance", section: "finance", subsection: "Minnesota CFB", methods: ["GET"], auth: "api-key",
    summary: "Minnesota Campaign Finance Board",
    description: "MN CFB candidate-level finance, including LLC pass-through donor flagging.",
    params: [
      { name: "cycle",  in: "query", type: "number", description: "Cycle filter." },
      { name: "office", in: "query", type: "string", description: "Office filter." },
      ...PAGINATION,
    ],
  },

  // ── Congress ──────────────────────────────────────────────────────────────
  {
    endpoint: "congress-members", section: "congress", subsection: "Members", methods: ["GET"], auth: "api-key",
    summary: "Members of Congress",
    description: "Currently serving members with party, state, district, leadership, and contact info.",
    params: [
      { name: "state",        in: "query", type: "string", description: "State code." },
      { name: "chamber",      in: "query", type: "string", description: "`house` | `senate`." },
      { name: "party",        in: "query", type: "string", description: "Party filter." },
      { name: "bioguide_id",  in: "query", type: "string", description: "Bioguide ID lookup." },
      ...PAGINATION,
    ],
  },
  {
    endpoint: "congress-bills", section: "congress", subsection: "Bills", methods: ["GET"], auth: "api-key",
    summary: "Federal legislation",
    description: "Bills with sponsors, status, latest action, policy area, subjects.",
    params: [
      { name: "congress",              in: "query", type: "number", description: "Congress number, e.g. 119." },
      { name: "bill_type",             in: "query", type: "string", description: "`hr`,`s`,`hres`,`sres`,…" },
      { name: "sponsor_bioguide_id",   in: "query", type: "string", description: "Sponsor bioguide ID." },
      { name: "search",                in: "query", type: "string", description: "Title ILIKE." },
      ...PAGINATION,
    ],
  },
  {
    endpoint: "congress-committees", section: "congress", subsection: "Committees", methods: ["GET"], auth: "api-key",
    summary: "Congressional committees",
    description: "Committees with members and subcommittees.",
    params: PAGINATION,
  },
  {
    endpoint: "congress-votes", section: "congress", subsection: "Roll calls", methods: ["GET"], auth: "api-key",
    summary: "Roll-call votes",
    description: "Roll-call vote records with totals and result.",
    params: [
      { name: "congress",   in: "query", type: "number", description: "Congress number." },
      { name: "chamber",    in: "query", type: "string", description: "`house` | `senate`." },
      { name: "roll_number",in: "query", type: "number", description: "Roll number." },
      { name: "bill_id",    in: "query", type: "string", description: "Linked bill_id filter." },
      ...PAGINATION,
    ],
  },

  // ── Legislation ───────────────────────────────────────────────────────────
  {
    endpoint: "tracked-bills", section: "legislation", methods: ["GET","POST","PATCH","DELETE"], auth: "user",
    summary: "User-tracked state bills",
    description: "User-curated tracking list backed by LegiScan. POST to track a new bill, DELETE to untrack.",
    params: [
      { name: "id",      in: "query", type: "uuid",   description: "Tracked-bill row id (PATCH/DELETE)." },
      { name: "bill_id", in: "body",  type: "string", description: "LegiScan bill_id (POST)." },
      ...PAGINATION,
    ],
  },

  // ── Intel ─────────────────────────────────────────────────────────────────
  {
    endpoint: "intel-briefings", section: "intel", methods: ["GET"], auth: "api-key",
    summary: "Multi-source intel briefings",
    description: "150+ source intel briefings categorised by scope and topic.",
    params: [
      { name: "scope",    in: "query", type: "string", description: "Scope filter (national/state/etc)." },
      { name: "category", in: "query", type: "string", description: "Topic category." },
      ...PAGINATION,
    ],
  },
  {
    endpoint: "intel-clusters", section: "intel", subsection: "Clusters", methods: ["GET"], auth: "api-key",
    summary: "Topic-clustered intel",
    description: "Recent intel briefings clustered by topic to surface coverage bias and source diversity.",
    params: PAGINATION,
  },
  {
    endpoint: "news-ticker", section: "intel", subsection: "Ticker", methods: ["GET"], auth: "api-key",
    summary: "News ticker headlines",
    description: "Latest cross-scope news headlines optimized for tickers/marquees.",
    params: [
      { name: "scope",    in: "query", type: "string", description: "Scope filter." },
      { name: "category", in: "query", type: "string", description: "Category filter." },
      { name: "limit",    in: "query", type: "number", description: "1-100, default 30." },
    ],
  },

  // ── Messaging ─────────────────────────────────────────────────────────────
  {
    endpoint: "messaging-guidance", section: "messaging", methods: ["GET"], auth: "api-key",
    summary: "Messaging research library",
    description: "95+ multi-partisan messaging guidance reports (Navigator, Echelon, Trafalgar, etc.).",
    params: [
      { name: "issue_area", in: "query", type: "string", description: "Issue area filter." },
      { name: "source",     in: "query", type: "string", description: "Source filter." },
      ...PAGINATION,
    ],
  },
  {
    endpoint: "messaging-talking-points", section: "messaging", subsection: "AI", methods: ["GET","POST"], auth: "api-key",
    summary: "Cached/generate messaging talking points",
    description: "GET returns cached AI talking points for a messaging item. POST regenerates them (admin can `force=true`).",
    params: [
      { name: "slug",            in: "query", type: "string", description: "Messaging item slug (GET)." },
      { name: "messaging_slug",  in: "body",  type: "string", description: "Messaging item slug (POST)." },
      { name: "audience",        in: "body",  type: "string", description: "Optional audience override." },
      { name: "angle",           in: "body",  type: "string", description: "Angle / framing override." },
      { name: "model",           in: "body",  type: "string", description: "AI model override." },
      { name: "include_sections",in: "body",  type: "array",  description: "Sections to include." },
    ],
  },
  {
    endpoint: "messaging-audience", section: "messaging", subsection: "AI", methods: ["GET","POST"], auth: "api-key",
    summary: "Audience effectiveness analysis",
    description: "Cached or freshly generated audience analysis per messaging item.",
    params: [
      { name: "slug", in: "query", type: "string", description: "Messaging item slug (GET)." },
    ],
  },
  {
    endpoint: "messaging-impact", section: "messaging", subsection: "AI", methods: ["GET","POST"], auth: "api-key",
    summary: "Cross-section impact analysis",
    description: "Cached or freshly generated impact analysis for a messaging item.",
    params: [
      { name: "slug", in: "query", type: "string", description: "Messaging item slug (GET)." },
    ],
  },
  {
    endpoint: "messaging-ai-bundle", section: "messaging", subsection: "AI", methods: ["GET"], auth: "api-key",
    summary: "Combined AI bundle",
    description: "Single response containing the messaging item + talking points + audience + impact[].",
    params: [
      { name: "slug", in: "query", type: "string", required: true, description: "Messaging item slug." },
    ],
  },

  // ── Research / OppoHub ────────────────────────────────────────────────────
  {
    endpoint: "maga-files", section: "research", subsection: "MAGA Files", methods: ["GET"], auth: "api-key",
    summary: "Trump-administration appointee files",
    description: "Vetting reports on executive-branch appointees.",
    params: PAGINATION,
  },
  {
    endpoint: "narrative-reports", section: "research", subsection: "Narrative reports", methods: ["GET"], auth: "api-key",
    summary: "Narrative policy impact reports",
    description: "Topical issue narrative reports synthesising federal policy impacts.",
    params: PAGINATION,
  },
  {
    endpoint: "local-impacts", section: "research", subsection: "Local impacts", methods: ["GET"], auth: "api-key",
    summary: "State-level Trump policy impacts",
    description: "How federal actions have affected each state.",
    params: PAGINATION,
  },

  // ── International ─────────────────────────────────────────────────────────
  { endpoint: "international-profiles",  section: "international", subsection: "Country profiles", methods: ["GET"], auth: "api-key", summary: "Country profiles", description: "Country profiles for 140+ nations.", params: PAGINATION },
  { endpoint: "international-elections", section: "international", subsection: "Elections",        methods: ["GET"], auth: "api-key", summary: "International elections", description: "Election results filterable by country and year.", params: PAGINATION },
  { endpoint: "international-leaders",   section: "international", subsection: "Leaders",          methods: ["GET"], auth: "api-key", summary: "Heads of state/government", description: "Heads of state/government and key political figures.", params: PAGINATION },
  { endpoint: "international-polling",   section: "international", subsection: "Polling",          methods: ["GET"], auth: "api-key", summary: "International polling", description: "International public opinion polling by country and topic.", params: PAGINATION },
  {
    endpoint: "geopolitics", section: "international", subsection: "Geopolitics", methods: ["GET","POST"], auth: "api-key",
    summary: "Country geopolitics brief",
    description: "GET returns cached AI brief; POST regenerates with optional `force=true`.",
    params: [
      { name: "country_code", in: "query", type: "string", required: true, description: "ISO-2 country code." },
      { name: "force",        in: "body",  type: "boolean", description: "POST: bypass cache." },
    ],
  },

  // ── Voter ─────────────────────────────────────────────────────────────────
  {
    endpoint: "voter-registration-stats", section: "voter", methods: ["GET"], auth: "api-key",
    summary: "State voter registration statistics",
    description: "Per-state registration rates and 2024 turnout.",
    params: PAGINATION,
  },

  // ── Markets ───────────────────────────────────────────────────────────────
  {
    endpoint: "prediction-markets", section: "markets", methods: ["GET"], auth: "api-key",
    summary: "Prediction market quotes",
    description: "Latest quotes from Polymarket, Kalshi, Metaculus, Manifold, PredictIt.",
    params: [
      { name: "slug",     in: "query", type: "string", description: "Market slug." },
      { name: "platform", in: "query", type: "string", description: "Platform filter." },
      ...PAGINATION,
    ],
  },
  {
    endpoint: "prediction-markets-charts", section: "markets", subsection: "Charts", methods: ["GET"], auth: "api-key",
    summary: "Prediction market chart data",
    description: "Pre-aggregated source/category breakdowns and probability distributions.",
    params: PAGINATION,
  },

  // ── Search ────────────────────────────────────────────────────────────────
  {
    endpoint: "search", section: "search", methods: ["GET"], auth: "api-key",
    summary: "Master cross-index search",
    description: "Unified search across 50+ databases. Returns grouped results by category.",
    params: [
      { name: "search",     in: "query", type: "string", required: true, description: "Free-text query." },
      { name: "categories", in: "query", type: "string", description: "Comma-separated category filter." },
      { name: "limit",      in: "query", type: "number", description: "Per-category cap (default 10, max 20)." },
    ],
  },

  // ── Devices ───────────────────────────────────────────────────────────────
  { endpoint: "devices",          section: "devices", methods: ["GET"], auth: "admin", summary: "Registered user devices",      description: "Admin: paginated list of registered devices.", params: [{ name: "user_id", in: "query", type: "uuid", description: "Filter by user." },{ name: "platform", in: "query", type: "string", description: "Platform filter." },{ name: "tag", in: "query", type: "string", description: "Tag filter." },{ name: "search", in: "query", type: "string", description: "Free-text." }, ...PAGINATION] },
  { endpoint: "device-locations", section: "devices", subsection: "Locations", methods: ["GET"], auth: "admin", summary: "Device location pings",     description: "Admin: raw GPS pings.", params: [{ name: "device_id", in: "query", type: "uuid", description: "Device id." },{ name: "user_id", in: "query", type: "uuid", description: "User id." },{ name: "since", in: "query", type: "date", description: "ISO timestamp lower bound." },{ name: "until", in: "query", type: "date", description: "ISO timestamp upper bound." }, ...PAGINATION] },
  { endpoint: "user-locations",   section: "devices", subsection: "Locations", methods: ["GET"], auth: "admin", summary: "Latest position per user",   description: "Admin: most recent location per device, grouped by user.", params: [{ name: "user_id", in: "query", type: "uuid", description: "User filter." }] },

  // ── Reports ───────────────────────────────────────────────────────────────
  {
    endpoint: "reports", section: "reports", methods: ["GET","POST","PATCH","DELETE"], auth: "user",
    summary: "User reports",
    description: "Your reports + reports shared with you + public reports.",
    params: [
      { name: "id",             in: "query", type: "uuid",    description: "Single report fetch." },
      { name: "include_blocks", in: "query", type: "boolean", description: "Include `content_blocks` in response." },
      { name: "public_only",    in: "query", type: "boolean", description: "Restrict to public reports." },
      ...PAGINATION,
    ],
  },
  {
    endpoint: "report-schedules", section: "reports", subsection: "Schedules", methods: ["GET","POST","PATCH","DELETE"], auth: "user",
    summary: "Scheduled email delivery for reports",
    description: "Cadence + recipients + next_run_at per scheduled report.",
    params: PAGINATION,
  },

  // ── Alerts ────────────────────────────────────────────────────────────────
  { endpoint: "polling-alerts",     section: "alerts", subsection: "Polling",     methods: ["GET","POST","PATCH","DELETE"], auth: "user",  summary: "Polling alert subscriptions",  description: "Per-race polling alert subscriptions with thresholds.", params: PAGINATION },
  { endpoint: "alert-rules",        section: "alerts", subsection: "Generic",      methods: ["GET","POST","PATCH","DELETE"], auth: "user",  summary: "Alert rules",                  description: "Generic event-driven alert rules. Admins see all.", params: PAGINATION },
  { endpoint: "alert-dispatch-log", section: "alerts", subsection: "Dispatch log", methods: ["GET"],                          auth: "user",  summary: "Alert dispatch history",       description: "Read-only dispatch history. Admins see all.", params: PAGINATION },
  { endpoint: "webhook-endpoints",  section: "alerts", subsection: "Webhooks",     methods: ["GET","POST","PATCH","DELETE"], auth: "user",  summary: "Webhook endpoints",            description: "Slack/Discord/generic webhook endpoints.", params: PAGINATION },

  // ── Graph ─────────────────────────────────────────────────────────────────
  { endpoint: "entity-activity",       section: "graph", subsection: "Activity",       methods: ["GET"],                          auth: "user",  summary: "Entity activity feed", description: "Activity feed across entities.", params: PAGINATION },
  { endpoint: "entity-notes",          section: "graph", subsection: "Notes",          methods: ["GET","POST","PATCH","DELETE"], auth: "user",  summary: "Entity notes",         description: "Your notes + shared notes. Admins see all.", params: PAGINATION },
  { endpoint: "entity-relationships",  section: "graph", subsection: "Relationships",  methods: ["GET"],                          auth: "user",  summary: "Graph edges",          description: "Read-only edges. POST/PATCH/DELETE admin-only.", params: PAGINATION },

  // ── War Rooms ─────────────────────────────────────────────────────────────
  { endpoint: "war-rooms",         section: "warroom", methods: ["GET","POST","PATCH","DELETE"], auth: "user", summary: "War rooms",         description: "GET: caller's rooms. POST/PATCH/DELETE: room CRUD.", params: [{ name: "id", in: "query", type: "uuid", description: "Room id." }, ...PAGINATION] },
  { endpoint: "war-room-members",  section: "warroom", subsection: "Members", methods: ["GET","POST","DELETE"], auth: "user", summary: "War room members",  description: "List or invite members of a room.", params: [{ name: "room_id", in: "query", type: "uuid", required: true, description: "Room id." }] },
  { endpoint: "war-room-messages", section: "warroom", subsection: "Messages", methods: ["GET","POST"], auth: "user",          summary: "War room messages", description: "Chat history + post a new message.", params: [{ name: "room_id", in: "query", type: "uuid", required: true, description: "Room id." },{ name: "limit", in: "query", type: "number", description: "Max rows." }] },

  // ── AI ────────────────────────────────────────────────────────────────────
  { endpoint: "vulnerability-scores",     section: "ai", subsection: "Vulnerability",   methods: ["GET"], auth: "api-key", summary: "Candidate vulnerability scores", description: "AI-generated candidate vulnerability scores.", params: [{ name: "candidate_slug", in: "query", type: "string", description: "Candidate slug filter." }] },
  { endpoint: "talking-points",           section: "ai", subsection: "Talking points",  methods: ["GET"], auth: "api-key", summary: "Talking points cache",           description: "AI-generated talking points (read).", params: PAGINATION },
  { endpoint: "bill-impact",              section: "ai", subsection: "Bill impact",     methods: ["GET"], auth: "api-key", summary: "Bill impact analyses",           description: "Cached AI bill-impact analyses.", params: [{ name: "bill_id", in: "query", type: "string", description: "Bill id." },{ name: "scope", in: "query", type: "string", description: "Scope filter." }] },
  { endpoint: "subject-talking-points",   section: "ai", subsection: "Subject AI",      methods: ["GET","POST"], auth: "api-key", summary: "Subject talking points",   description: "GET cached or POST to generate. Subjects: district / state_leg / legislation.", params: [{ name: "subject_type", in: "query", type: "string", required: true, description: "`district` | `state_leg` | `legislation`." },{ name: "subject_ref", in: "query", type: "string", required: true, description: "Subject reference (e.g. district id)." }] },
  { endpoint: "subject-audience",         section: "ai", subsection: "Subject AI",      methods: ["GET","POST"], auth: "api-key", summary: "Subject audience analysis", description: "Cached or fresh subject audience analysis.", params: [{ name: "subject_type", in: "query", type: "string", required: true, description: "Subject type." },{ name: "subject_ref", in: "query", type: "string", required: true, description: "Subject reference." }] },
  { endpoint: "subject-impact",           section: "ai", subsection: "Subject AI",      methods: ["GET","POST"], auth: "api-key", summary: "Subject impact analysis",   description: "Cached or fresh subject impact analysis.", params: [{ name: "subject_type", in: "query", type: "string", required: true, description: "Subject type." },{ name: "subject_ref", in: "query", type: "string", required: true, description: "Subject reference." }] },
  { endpoint: "subject-ai-bundle",        section: "ai", subsection: "Subject AI",      methods: ["GET"],         auth: "api-key", summary: "Subject AI bundle",        description: "Combined talking points + audience + impact for a subject.", params: [{ name: "subject_type", in: "query", type: "string", required: true, description: "Subject type." },{ name: "subject_ref", in: "query", type: "string", required: true, description: "Subject reference." }] },

  // ── Admin ─────────────────────────────────────────────────────────────────
  { endpoint: "admin-dispatch-alerts",  section: "admin", methods: ["POST"], auth: "admin", summary: "Force-run alert dispatcher", description: "Triggers the dispatch-alerts cron job out-of-cycle." },
  { endpoint: "admin-regenerate-ai",    section: "admin", methods: ["POST"], auth: "admin", summary: "Force-regenerate AI cache",  description: "Body: `{ type: 'vulnerability'|'talking_points'|'bill_impact', payload: {...} }`." },

  // ── User settings ─────────────────────────────────────────────────────────
  { endpoint: "email-preferences", section: "user", subsection: "Email",         methods: ["GET","PATCH"], auth: "user", summary: "Email preferences",  description: "Digest frequency, quiet hours, per-category toggles." },
  { endpoint: "sync-preferences",  section: "user", subsection: "Offline sync",  methods: ["GET","PATCH"], auth: "user", summary: "Offline sync preferences", description: "Tables to mirror, sync cadence." },

  // ── Sync ──────────────────────────────────────────────────────────────────
  { endpoint: "sync-status", section: "user", subsection: "Sync status", methods: ["GET"], auth: "user", summary: "Sync status",  description: "Latest run per source from `sync_run_log`." },

  // ── Documentation ─────────────────────────────────────────────────────────
  { endpoint: "docs",                section: "docs", methods: ["GET"], auth: "public",  summary: "Documentation index",  description: "Top-level self-documentation index." },
  { endpoint: "docs-wiki",           section: "docs", subsection: "Wiki",           methods: ["GET"], auth: "public",  summary: "Wiki pages",         description: "List wiki pages or fetch one with `?slug=`." },
  { endpoint: "docs-endpoints",      section: "docs", subsection: "REST",           methods: ["GET"], auth: "public",  summary: "REST endpoint registry", description: "Full machine-readable spec for every public-api endpoint (this registry)." },
  { endpoint: "docs-tables",         section: "docs", subsection: "Database",       methods: ["GET"], auth: "public",  summary: "Database tables",    description: "Every offline-synced database table." },
  { endpoint: "docs-mcp-tools",      section: "docs", subsection: "MCP",            methods: ["GET"], auth: "public",  summary: "MCP tool registry",  description: "Every MCP server tool." },
  { endpoint: "docs-edge-functions", section: "docs", subsection: "Edge functions", methods: ["GET"], auth: "public",  summary: "Edge functions",     description: "Every deployed edge function." },

  // ── Offline / Sync ────────────────────────────────────────────────────────
  { endpoint: "offline-manifest", section: "offline", methods: ["GET"],  auth: "api-key", summary: "Offline-syncable tables",     description: "Manifest of tables the web app mirrors offline. Drives `offline-snapshot`/`offline-mutate`.", params: [] },
  { endpoint: "offline-snapshot", section: "offline", methods: ["GET"],  auth: "api-key", summary: "Paginated table snapshot",    description: "Paginated read of one offline table for mirroring.", params: [{ name: "table", in: "query", type: "string", required: true, description: "Table name from the manifest." },{ name: "page", in: "query", type: "number", description: "Zero-based page." },{ name: "page_size", in: "query", type: "number", description: "1..1000 (default per-table)." },{ name: "order_by", in: "query", type: "string", description: "Override column to order by." }] },
  { endpoint: "offline-mutate",   section: "offline", methods: ["POST"], auth: "user",    summary: "Replay queued offline write", description: "Body: `{ table, operation:'insert'|'update'|'delete', data }`. RLS still applies." },
] as const;

// ─── MCP tool specs ─────────────────────────────────────────────────────────
export interface McpToolSpec {
  name: string;
  section: SectionKey;
  subsection?: string;
  /** Multi-line description: what / when to use / example. */
  description: string;
  /** Optional admin-gating hint surfaced to clients. */
  adminOnly?: boolean;
}

export const MCP_TOOL_SPECS: ReadonlyArray<McpToolSpec> = [
  // Candidates
  { name: "search_candidates", section: "candidates", description:
    "Search opposition-research candidate profiles by name.\n\nWhen to use: starting point for any candidate-centric workflow.\nReturns: paginated `{ total, results[] }` of candidate rows (id, slug, name, tags, content)." },
  { name: "get_candidate", section: "candidates", description:
    "Fetch a single candidate profile by slug, including the full markdown content and any sub-pages.\n\nWhen to use: after `search_candidates` returned a slug, or when the slug is already known." },

  // Districts
  { name: "search_congressional_districts", section: "districts", description:
    "Search congressional district demographic profiles (population, income, race, education, housing).\n\nFilters: `state` (e.g. `CA`), `search` (district id ILIKE)." },
  { name: "search_state_legislative", section: "districts", subsection: "State legislative", description:
    "Search state legislative district profiles for ~9,300 upper- and lower-chamber districts across all 50 states." },

  // Elections
  { name: "get_election_results",         section: "elections", subsection: "State legislative", description: "State legislative election results with vote counts, percentages, and winners. Filter by state, chamber, district, year." },
  { name: "get_congressional_elections",  section: "elections", subsection: "Congressional", description: "Historical congressional election results filterable by state, district, year, election_type." },
  { name: "get_mit_elections",            section: "elections", subsection: "Historical (MIT)", description: "MIT Election Lab historical results 1976–2024 with county-level data." },
  { name: "get_state_leg_elections",      section: "elections", subsection: "State legislative", description: "Alias for state legislative election results with normalised parameter names." },
  { name: "get_election_forecasts",       section: "elections", subsection: "Forecasts", description: "Race ratings from Cook, Sabato, Inside Elections. Filter by cycle, race_type, state, district." },
  { name: "get_forecast_history",         section: "elections", subsection: "Forecasts", description: "Historical change log of forecast ratings (old → new)." },

  // Polling
  { name: "get_polling_data", section: "polling", description: "Polling rows with approval/favorability/horse-race numbers. Filter by race, state, pollster." },

  // Finance
  { name: "get_campaign_finance", section: "finance", subsection: "Federal",       description: "FEC + OpenSecrets aggregated federal campaign finance." },
  { name: "get_state_finance",    section: "finance", subsection: "State",         description: "Multi-state campaign finance aggregator (50 states)." },
  { name: "get_mn_finance",       section: "finance", subsection: "Minnesota CFB", description: "Minnesota CFB candidate finance with LLC pass-through donor flagging." },

  // Congress
  { name: "get_congress_members",     section: "congress", subsection: "Members",     description: "Currently serving members with party, state, district, leadership, contact info." },
  { name: "get_congress_bills",       section: "congress", subsection: "Bills",       description: "Federal legislation with sponsors, status, latest action, policy area." },
  { name: "get_congress_committees",  section: "congress", subsection: "Committees",  description: "House/Senate committees with members and subcommittees." },
  { name: "get_congress_votes",       section: "congress", subsection: "Roll calls",  description: "Roll-call votes with totals and result." },

  // Legislation
  { name: "get_tracked_bills", section: "legislation", description: "User-tracked LegiScan state legislation with status and actions." },

  // Intel
  { name: "get_intel_briefings", section: "intel", description: "150+ source intel briefings categorised by scope and topic." },
  { name: "get_intel_clusters",  section: "intel", subsection: "Clusters", description: "Topic-clustered intel briefings highlighting coverage bias and source diversity." },
  { name: "get_news_ticker",     section: "intel", subsection: "Ticker", description: "Latest cross-scope headlines optimised for tickers/marquees." },

  // Messaging
  { name: "get_messaging_guidance",                   section: "messaging", description: "95+ multi-partisan messaging guidance reports (Navigator, Echelon, Trafalgar, etc.)." },
  { name: "get_messaging_talking_points",             section: "messaging", subsection: "AI", description: "Read cached AI talking points for a messaging item." },
  { name: "generate_messaging_talking_points",        section: "messaging", subsection: "AI", description: "Generate (and cache) AI talking points for a messaging item." },
  { name: "get_messaging_audience_analysis",          section: "messaging", subsection: "AI", description: "Read cached AI audience analysis for a messaging item." },
  { name: "generate_messaging_audience_analysis",     section: "messaging", subsection: "AI", description: "Generate AI audience analysis for a messaging item." },
  { name: "get_messaging_impact",                     section: "messaging", subsection: "AI", description: "Read cached cross-section impact analysis for a messaging item." },
  { name: "generate_messaging_impact",                section: "messaging", subsection: "AI", description: "Generate cross-section impact analysis for a messaging item." },
  { name: "get_messaging_ai_bundle",                  section: "messaging", subsection: "AI", description: "Combined messaging item + talking points + audience + impact[]." },

  // Research
  { name: "get_maga_files",          section: "research", subsection: "MAGA Files",        description: "Trump-administration appointee vetting files." },
  { name: "get_narrative_reports",   section: "research", subsection: "Narrative reports", description: "Narrative policy impact reports." },
  { name: "get_local_impacts",       section: "research", subsection: "Local impacts",     description: "State-level Trump policy impact summaries." },

  // Voter
  { name: "get_voter_registration_stats", section: "voter", description: "Per-state voter registration statistics with 2024 turnout." },

  // Markets
  { name: "get_prediction_markets", section: "markets", description: "Latest prediction market quotes (Polymarket, Kalshi, Manifold, Metaculus, PredictIt)." },

  // International
  { name: "get_international_profile",     section: "international", subsection: "Country profiles", description: "Country profile by ISO-2 code." },
  { name: "list_international_elections",  section: "international", subsection: "Elections",        description: "International elections by country." },
  { name: "list_international_leaders",    section: "international", subsection: "Leaders",          description: "Heads of state/government by country." },
  { name: "get_country_geopolitics",       section: "international", subsection: "Geopolitics",      description: "Cached AI geopolitics brief for a country." },
  { name: "refresh_country_geopolitics",   section: "international", subsection: "Geopolitics",      description: "Force-refresh the cached AI geopolitics brief." },

  // Reports
  { name: "list_reports",          section: "reports", description: "User reports + shared + public." },
  { name: "list_report_schedules", section: "reports", subsection: "Schedules", description: "User report email schedules." },

  // Alerts
  { name: "list_polling_alerts",  section: "alerts", subsection: "Polling", description: "User polling alert subscriptions." },
  { name: "get_email_preferences",section: "alerts", subsection: "Email",   description: "User email notification preferences." },
  { name: "list_alert_rules",     section: "alerts", subsection: "Generic", description: "User alert rules." },
  { name: "create_alert_rule",    section: "alerts", subsection: "Generic", description: "Create a new alert rule." },

  // Graph
  { name: "list_entity_activity", section: "graph", subsection: "Activity",      description: "Entity activity feed." },
  { name: "list_entity_notes",    section: "graph", subsection: "Notes",         description: "Entity notes (caller's + shared)." },
  { name: "create_entity_note",   section: "graph", subsection: "Notes",         description: "Create a note on an entity." },
  { name: "get_entity_graph",     section: "graph", subsection: "Relationships", description: "Build the relationship graph for an entity." },

  // AI
  { name: "get_vulnerability_score",            section: "ai", subsection: "Vulnerability", description: "AI candidate vulnerability score." },
  { name: "get_talking_points",                 section: "ai", subsection: "Talking points", description: "AI-generated talking points (read)." },
  { name: "get_bill_impact",                    section: "ai", subsection: "Bill impact",   description: "AI bill impact analysis (cached)." },
  { name: "get_subject_talking_points",         section: "ai", subsection: "Subject AI",    description: "Cached subject talking points." },
  { name: "generate_subject_talking_points",    section: "ai", subsection: "Subject AI",    description: "Generate subject talking points." },
  { name: "get_subject_audience_analysis",      section: "ai", subsection: "Subject AI",    description: "Cached subject audience analysis." },
  { name: "generate_subject_audience_analysis", section: "ai", subsection: "Subject AI",    description: "Generate subject audience analysis." },
  { name: "get_subject_impact",                 section: "ai", subsection: "Subject AI",    description: "Cached subject impact analysis." },
  { name: "generate_subject_impact",            section: "ai", subsection: "Subject AI",    description: "Generate subject impact analysis." },
  { name: "get_subject_ai_bundle",              section: "ai", subsection: "Subject AI",    description: "Combined subject talking points + audience + impact." },

  // Search
  { name: "master_search", section: "search", description: "Unified search across 50+ databases. Returns grouped results by category." },

  // OSINT
  { name: "osint_list_tools", section: "osint", description: "List the OSINT tool registry." },
  { name: "osint_get_tool",   section: "osint", description: "Get details for a specific OSINT tool." },
  { name: "osint_search",     section: "osint", description: "Execute an OSINT lookup via the registry-driven dispatcher." },

  // Devices
  { name: "search_devices",       section: "devices", description: "Admin: registered user devices.", adminOnly: true },
  { name: "get_device_locations", section: "devices", subsection: "Locations", description: "Admin: device location pings.", adminOnly: true },
  { name: "get_user_locations",   section: "devices", subsection: "Locations", description: "Admin: latest position per user.", adminOnly: true },

  // War rooms
  { name: "list_war_rooms",        section: "warroom",                          description: "List war rooms the caller belongs to." },
  { name: "get_war_room_messages", section: "warroom", subsection: "Messages", description: "Fetch war room chat history." },

  // Sync
  { name: "get_sync_status", section: "user", subsection: "Sync status", description: "Latest sync run per source." },

  // Admin
  { name: "admin_regenerate_messaging_ai", section: "admin", description: "Force-regenerate messaging AI for an item.", adminOnly: true },
  { name: "admin_dispatch_alerts",         section: "admin", description: "Trigger the alert dispatcher cron out-of-cycle.", adminOnly: true },
  { name: "admin_delete_entity_note",      section: "admin", description: "Delete any entity note.", adminOnly: true },
  { name: "admin_update_entity_note",      section: "admin", description: "Update any entity note.", adminOnly: true },
  { name: "admin_create_graph_edge",       section: "admin", description: "Create a relationship graph edge.", adminOnly: true },
  { name: "admin_update_graph_edge",       section: "admin", description: "Update a relationship graph edge.", adminOnly: true },
  { name: "admin_delete_graph_edge",       section: "admin", description: "Delete a relationship graph edge.", adminOnly: true },
  { name: "admin_regenerate_ai",           section: "admin", description: "Regenerate any AI cache.", adminOnly: true },

  // Docs
  { name: "docs_index",                section: "docs", description: "Top-level documentation index (counts + links)." },
  { name: "docs_list_wiki_pages",      section: "docs", subsection: "Wiki",          description: "List all wiki pages." },
  { name: "docs_get_wiki_page",        section: "docs", subsection: "Wiki",          description: "Get a wiki page by slug." },
  { name: "docs_list_endpoints",       section: "docs", subsection: "REST",          description: "Full spec for every public-api endpoint." },
  { name: "docs_list_tables",          section: "docs", subsection: "Database",      description: "Every offline-synced DB table." },
  { name: "docs_list_edge_functions",  section: "docs", subsection: "Edge functions", description: "Every deployed edge function." },
  { name: "docs_list_mcp_tools",       section: "docs", subsection: "MCP",           description: "Every MCP tool with full description and inputSchema." },

  // Offline
  { name: "offline_manifest", section: "offline", description: "List offline-syncable tables and which are mutable." },
  { name: "offline_snapshot", section: "offline", description: "Paginated read of one offline table for mirroring." },
  { name: "offline_mutate",   section: "offline", description: "Replay a queued offline write. Mutable tables: entity_notes, alert_rules, reports." },
];

export const MCP_TOOL_SPEC_BY_NAME: Record<string, McpToolSpec> = Object.fromEntries(
  MCP_TOOL_SPECS.map((t) => [t.name, t]),
);
