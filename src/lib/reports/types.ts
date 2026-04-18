// Type definitions for the WYSIWYG drag-and-drop Report Builder.
// Each block represents a single piece of content that can be rendered
// inline in the report and exported to PDF/CSV.

export type ReportBlockType =
  | "heading"
  | "subheading"
  | "text"
  | "image"
  | "divider"
  | "page_break"
  | "tabs"           // tabbed container with sub-blocks
  | "candidate"      // snapshot from candidate_profiles
  | "district"       // snapshot from district_profiles
  | "intel"          // intel briefing(s) by scope/category
  | "polling"        // polling snapshot
  | "finance"        // campaign finance snapshot
  | "election"       // congressional election results
  | "international"  // country profile
  | "legislation"    // congress bill/votes
  | "messaging"      // messaging hub doc
  | "messaging_ai"   // bundled AI talking points + audience analysis + impact for a messaging item
  | "research"       // candidate research subpage
  | "talking_points"      // AI talking points cached for a candidate/bill
  | "vulnerability"       // AI vulnerability score for candidate
  | "bill_impact"         // AI bill impact analysis
  | "forecast"            // election forecast (Cook/Sabato/538) for state-district-cycle
  | "prediction_market"   // prediction market snapshot
  | "investigations"      // bundled court cases + IG reports + FARA + spending + contracts
  | "war_room"            // war room digest
  | "entity_graph"        // entity relationships snapshot
  | "admin_activity" // admin only — activity logs table
  | "admin_locations" // admin only — locations w/ map
  | "api_data"       // raw call to public-api endpoint
  | "mcp_data"       // raw call to mcp-server tool
  | "chart"          // bar/line/pie chart from custom data
  | "table"          // arbitrary tabular data
  | "map"            // generic geo points / district highlight map
  | "osint_results"  // NEW — AI-parsed OSINT search results from any catalog tool
  | "subject_ai";    // NEW — AI subject panel: talking points + audience + impact for arbitrary subject

export interface BaseBlock {
  id: string;
  type: ReportBlockType;
  /** Display label shown above the block. */
  title?: string;
}

export interface HeadingBlock extends BaseBlock {
  type: "heading" | "subheading";
  text: string;
}

export interface TextBlock extends BaseBlock {
  type: "text";
  /** Markdown content. */
  text: string;
}

export interface ImageBlock extends BaseBlock {
  type: "image";
  url: string;
  caption?: string;
}

export interface DividerBlock extends BaseBlock {
  type: "divider";
}

export interface PageBreakBlock extends BaseBlock {
  type: "page_break";
}

export interface TabsBlock extends BaseBlock {
  type: "tabs";
  tabs: Array<{ id: string; label: string; blocks: ReportBlock[] }>;
}

export interface DataBlock extends BaseBlock {
  type:
    | "candidate"
    | "district"
    | "intel"
    | "polling"
    | "finance"
    | "election"
    | "international"
    | "legislation"
    | "messaging"
    | "messaging_ai"
    | "research"
    | "talking_points"
    | "vulnerability"
    | "bill_impact"
    | "forecast"
    | "prediction_market"
    | "investigations"
    | "war_room"
    | "entity_graph";
  /** Reference to the source row (slug, district id, country code, etc.) */
  refId: string;
  /** Optional sub-tab/subsection identifier inside that source. */
  subsectionId?: string;
  /** Cached snapshot at the time the block was added (for offline export). */
  snapshot?: Record<string, unknown>;
}

export interface AdminActivityBlock extends BaseBlock {
  type: "admin_activity";
  filters: {
    user_id?: string | null;
    date_from?: string | null;
    date_to?: string | null;
  };
  snapshot?: Record<string, unknown>;
}

export interface AdminLocationsBlock extends BaseBlock {
  type: "admin_locations";
  filters: {
    user_id?: string | null;
    date_from?: string | null;
    date_to?: string | null;
  };
  /** Show map vs raw table. */
  showMap?: boolean;
  snapshot?: Record<string, unknown>;
}

export interface ApiDataBlock extends BaseBlock {
  type: "api_data";
  endpoint: string;
  /** Cached response. */
  snapshot?: unknown;
}

export interface McpDataBlock extends BaseBlock {
  type: "mcp_data";
  toolName: string;
  args: Record<string, unknown>;
  snapshot?: unknown;
}

export interface ChartBlock extends BaseBlock {
  type: "chart";
  chartType: "bar" | "line" | "pie";
  /** Rows like [{label:"Q1", value:12, value2:8}, ...] — value/value2/value3 are numeric series. */
  data: Array<Record<string, string | number>>;
  /** Series keys, in order. Default ["value"]. */
  series?: string[];
  caption?: string;
}

export interface TableBlock extends BaseBlock {
  type: "table";
  columns: string[];
  rows: Array<Array<string | number>>;
  caption?: string;
}

export interface MapBlock extends BaseBlock {
  type: "map";
  /** Either highlight congressional districts ["MN-05", "TX-22"] or plot points. */
  mode: "districts" | "points";
  districts?: string[];
  points?: Array<{ lat: number; lng: number; label?: string }>;
  caption?: string;
}

export type ReportBlock =
  | HeadingBlock
  | TextBlock
  | ImageBlock
  | DividerBlock
  | PageBreakBlock
  | TabsBlock
  | DataBlock
  | AdminActivityBlock
  | AdminLocationsBlock
  | ApiDataBlock
  | McpDataBlock
  | ChartBlock
  | TableBlock
  | MapBlock;

export interface Report {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  blocks: ReportBlock[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export const BLOCK_PALETTE: Array<{
  type: ReportBlockType;
  label: string;
  emoji: string;
  adminOnly?: boolean;
  group: "Content" | "Data" | "Intelligence" | "Visuals" | "Admin" | "API";
}> = [
  { type: "heading", label: "Heading", emoji: "🅷", group: "Content" },
  { type: "subheading", label: "Subheading", emoji: "🅢", group: "Content" },
  { type: "text", label: "Text / Markdown", emoji: "📝", group: "Content" },
  { type: "image", label: "Image", emoji: "🖼️", group: "Content" },
  { type: "divider", label: "Divider", emoji: "—", group: "Content" },
  { type: "page_break", label: "Page Break", emoji: "📄", group: "Content" },
  { type: "tabs", label: "Tabs Container", emoji: "📑", group: "Content" },

  { type: "chart", label: "Chart", emoji: "📈", group: "Visuals" },
  { type: "table", label: "Table", emoji: "🧮", group: "Visuals" },
  { type: "map", label: "Map", emoji: "🗺️", group: "Visuals" },

  { type: "candidate", label: "Candidate Snapshot", emoji: "👤", group: "Data" },
  { type: "research", label: "Candidate Research", emoji: "🔍", group: "Data" },
  { type: "district", label: "District Snapshot", emoji: "🗺️", group: "Data" },
  { type: "intel", label: "Intel Briefing", emoji: "🕵️", group: "Data" },
  { type: "polling", label: "Polling", emoji: "📊", group: "Data" },
  { type: "finance", label: "Campaign Finance", emoji: "💰", group: "Data" },
  { type: "election", label: "Election Results", emoji: "🗳️", group: "Data" },
  { type: "international", label: "International", emoji: "🌐", group: "Data" },
  { type: "legislation", label: "Legislation", emoji: "⚖️", group: "Data" },
  { type: "messaging", label: "Messaging Doc", emoji: "📢", group: "Data" },
  { type: "messaging_ai", label: "Messaging AI Bundle", emoji: "🧠", group: "Intelligence" },

  { type: "talking_points", label: "AI Talking Points", emoji: "🗣️", group: "Intelligence" },
  { type: "vulnerability", label: "Vulnerability Score", emoji: "🛡️", group: "Intelligence" },
  { type: "bill_impact", label: "Bill Impact (AI)", emoji: "🧠", group: "Intelligence" },
  { type: "forecast", label: "Race Forecast", emoji: "🎲", group: "Intelligence" },
  { type: "prediction_market", label: "Prediction Market", emoji: "📉", group: "Intelligence" },
  { type: "investigations", label: "Investigations Bundle", emoji: "🔎", group: "Intelligence" },
  { type: "war_room", label: "War Room Digest", emoji: "⚔️", group: "Intelligence" },
  { type: "entity_graph", label: "Entity Graph", emoji: "🕸️", group: "Intelligence" },

  { type: "admin_activity", label: "Activity Logs", emoji: "📋", adminOnly: true, group: "Admin" },
  { type: "admin_locations", label: "Location History", emoji: "📍", adminOnly: true, group: "Admin" },

  { type: "api_data", label: "Public API Call", emoji: "🔌", group: "API" },
  { type: "mcp_data", label: "MCP Tool Call", emoji: "🤖", group: "API" },
];
