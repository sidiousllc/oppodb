# Feature: API Access

## Description

OppoDB provides a comprehensive public REST API and MCP (Model Context Protocol) server that allow authenticated users to programmatically access the entire database. API access is available to premium users and above, enabling integration with external tools, scripts, and AI agents. The API exposes **22 REST endpoints** (including 2 chart-data endpoints) and **18 MCP tools** covering all data sources available in the web application.

---

## API Key Management (`ApiPage`)

### Access Control
- **User**: No API access (sees "Premium Access Required" message)
- **Premium+**: Full API access with key generation

### Create API Key
Users can generate named API keys with two options:

#### Auto-Generated Key
1. Click "Generate New API Key"
2. Enter a descriptive key name (e.g., "Production Bot", "Claude Desktop")
3. Leave "Use my own key value" unchecked
4. Click "Generate Key"
5. **Critical**: The full key is shown ONCE — users must copy it immediately (yellow warning banner)
6. Key is stored hashed in the database (only prefix visible afterward)

#### Custom Key (Bring Your Own)
1. Click "Generate New API Key"
2. Enter a descriptive key name
3. Check "Use my own key value"
4. Enter your custom API key string
5. Click "Save Custom Key"
6. The custom key is hashed and stored identically to auto-generated keys
7. **Note**: The key is shown once for confirmation — it should already be saved by the user

### Key Management
For each key, users can:
- View key name and creation date
- See request count and last used timestamp
- **Revoke** — disables the key (soft delete via `revoked_at` timestamp)
- **Delete** — permanently removes the key

### Active vs Revoked Keys
- Active keys shown at top with full functionality
- Revoked keys shown separately (grayed out) for historical reference

---

## API Key Data Model

```typescript
interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;        // First 8 chars visible (e.g., "opdb_sk_...")
  key_hash: string;          // SHA-256 hashed value stored in DB
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  request_count: number;
}
```

### Database Functions
```sql
-- Validate API key by hash lookup (SECURITY DEFINER — bypasses RLS)
validate_api_key(p_key_hash text) RETURNS TABLE(user_id uuid, key_id uuid)

-- Increment usage counter atomically
increment_api_key_usage(p_key_id uuid) RETURNS void

-- Log API request with full audit trail
log_api_request(p_key_id uuid, p_user_id uuid, p_endpoint text, p_status integer DEFAULT 200)
```

### Key Generation Flow (Client-Side)
```typescript
// lib/apiKeys.ts
createApiKey(name: string, customKey?: string): Promise<{ id: string; key: string }>
// 1. Uses customKey if provided, otherwise generates cryptographically random key with "ordb_" prefix
// 2. Computes SHA-256 hash
// 3. Stores hash + prefix in api_keys table via RLS INSERT policy
// 4. Returns plaintext key ONCE to caller
```

---

## Public REST API

### Base URL
```
https://yysbtxpupmwkxovgkama.supabase.co/functions/v1/public-api
```

### Authentication
All API requests require the `X-API-Key` header:
```bash
curl -H "X-API-Key: ordb_xxxx" \
  https://[base-url]/public-api/candidates
```

### Common Query Parameters

All endpoints (except `/search`) support these parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 100 | Max results per request (max 1000) |
| `offset` | integer | 0 | Pagination offset |
| `state` | string | — | Filter by state abbreviation (where applicable) |
| `search` | string | — | Text search filter (where applicable) |
| `chamber` | string | — | Filter by chamber: `house` or `senate` (where applicable) |

### Standard Response Format
All non-search endpoints return:
```json
{
  "data": [...],
  "meta": {
    "total": 1234,
    "limit": 100,
    "offset": 0,
    "endpoint": "candidates"
  }
}
```

### Error Responses
```json
// 401 — Missing API key
{
  "error": "Missing API key. Provide via X-API-Key header.",
  "docs": "Generate an API key from your profile page.",
  "example": "curl -H \"X-API-Key: ordb_xxxx\" https://.../public-api/candidates"
}

// 403 — Invalid or revoked key
{ "error": "Invalid or revoked API key" }

// 404 — Unknown endpoint
{
  "error": "Unknown endpoint: foo",
  "valid_endpoints": ["candidates", "districts", ...]
}

// 405 — Method not allowed
{ "error": "Only GET requests are supported" }

// 500 — Internal server error
{ "error": "Internal server error" }
```

---

## REST API Endpoints

### 1. `/candidates` — Candidate Profiles

Opposition research candidate profiles with markdown content.

| Parameter | Description |
|-----------|-------------|
| `search` | Filter by candidate name (case-insensitive) |

**Selected Fields**: `id, name, slug, is_subpage, subpage_title, parent_slug, content, created_at, updated_at`

```bash
curl -H "X-API-Key: KEY" "https://.../public-api/candidates?search=ernst&limit=5"
```

---

### 2. `/districts` — Congressional District Profiles

Census ACS 5-Year demographic data for all 435 congressional districts.

| Parameter | Description |
|-----------|-------------|
| `state` | Filter by state abbreviation (e.g., `CA`) |
| `search` | Search by district ID (e.g., `PA-07`) |

**Fields**: All columns from `district_profiles` including population, median_income, race/ethnicity percentages, education, poverty, housing, voting_patterns, top_issues.

```bash
curl -H "X-API-Key: KEY" "https://.../public-api/districts?state=PA"
```

---

### 3. `/state-legislative` — State Legislative Districts

Census demographics for ~9,300 state legislative districts (house + senate) across all 50 states.

| Parameter | Description |
|-----------|-------------|
| `state` | Filter by state abbreviation |
| `chamber` | `house` or `senate` |
| `search` | Search by district ID |

**Fields**: All columns from `state_legislative_profiles` including population, demographics, income, housing, education.

```bash
curl -H "X-API-Key: KEY" "https://.../public-api/state-legislative?state=FL&chamber=house&limit=20"
```

---

### 4. `/election-results` — State Legislative Election Results

Historical state legislative election results with vote counts, margins, and winner flags.

| Parameter | Description |
|-----------|-------------|
| `state` | Filter by state abbreviation |
| `chamber` | `house` or `senate` |
| `year` | Filter by election year (e.g., `2022`) |

**Fields**: All columns from `state_leg_election_results`.

```bash
curl -H "X-API-Key: KEY" "https://.../public-api/election-results?state=MN&year=2022&chamber=house"
```

---

### 5. `/polling` — Polling Data

Approval ratings, generic ballot, favorability, and issue polls from multiple sources.

| Parameter | Description |
|-----------|-------------|
| `search` | Search by candidate name or poll topic |

**Fields**: All columns from `polling_data` including approve_pct, disapprove_pct, margin, sample_size, methodology, source.

```bash
curl -H "X-API-Key: KEY" "https://.../public-api/polling?search=trump&limit=20"
```

---

### 6. `/polling-charts` — Polling Chart Data (Pre-Aggregated)

Returns pre-computed chart-ready data for rendering polling visualizations. This eliminates the need for clients to aggregate raw polling data themselves.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `poll_type` | string | `approval` | Poll type filter: `approval`, `favorability`, `generic_ballot`, `issue` |
| `topic` | string | `Trump Approval` | Topic/candidate to filter by (case-insensitive match) |

**Response Structure:**
```json
{
  "charts": {
    "approval_trend": {
      "description": "Approval/disapproval over time by pollster",
      "data": [
        { "source": "ap", "date_conducted": "2026-04-01", "approve_pct": 43, "disapprove_pct": 52, "margin": -9, "sample_size": 1082, "methodology": "Online/Phone" }
      ]
    },
    "rolling_average": {
      "description": "7-point rolling average of approve/disapprove",
      "data": [
        { "date": "2026-03-15", "approve_avg": 42.3, "disapprove_avg": 53.1, "window_size": 7 }
      ]
    },
    "source_comparison": {
      "description": "Latest poll result per source",
      "data": [
        { "source": "quinnipiac", "date_conducted": "2026-03-31", "approve_pct": 40, "disapprove_pct": 55 }
      ]
    },
    "demographic_breakdowns": {
      "description": "Approval by demographic group",
      "data": {
        "party": [
          { "demographic": "Republican", "approve": 89, "disapprove": 8, "margin": 81, "poll_count": 4 },
          { "demographic": "Independent", "approve": 35, "disapprove": 52, "margin": -17, "poll_count": 4 },
          { "demographic": "Democrat", "approve": 8, "disapprove": 88, "margin": -80, "poll_count": 4 }
        ],
        "age": [...],
        "gender": [...],
        "race": [...],
        "education": [...],
        "region": [...]
      }
    },
    "methodology_breakdown": {
      "description": "Poll count by methodology type",
      "data": [ { "name": "Online/Phone", "count": 12 }, { "name": "Phone", "count": 8 } ]
    }
  },
  "meta": {
    "poll_type": "approval",
    "topic": "Trump Approval",
    "total_polls": 45,
    "total_demographic_polls": 68,
    "sources": ["ap", "quinnipiac", "foxnews", "emerson"],
    "demographic_groups": ["party", "age", "gender", "race", "education", "region"]
  }
}
```

**Chart types returned:**

| Chart | Description | Use Case |
|-------|-------------|----------|
| `approval_trend` | Raw time-series of approve/disapprove per pollster | Line charts, scatter plots |
| `rolling_average` | 7-point moving average smoothing noise | Trend line charts |
| `source_comparison` | Latest result per pollster (deduped) | Bar charts, dot plots |
| `demographic_breakdowns` | Averaged crosstabs by group type | Horizontal bar charts, heatmaps |
| `methodology_breakdown` | Count of polls by methodology | Pie/donut charts |

```bash
curl -H "X-API-Key: KEY" "https://.../public-api/polling-charts?poll_type=approval&topic=Trump+Approval"
```

---

### 7. `/prediction-markets` — Prediction Market Data

Real-time prediction market odds from Polymarket, Kalshi, Metaculus, Manifold Markets, and PredictIt.

| Parameter | Description |
|-----------|-------------|
| `state` | Filter by state abbreviation |
| `search` | Search by market title or candidate name |
| `category` | Filter by category: `president`, `senate`, `house`, `governor`, `general` |
| `source` | Filter by platform: `polymarket`, `kalshi`, `metaculus`, `manifold`, `predictit` |

**Selected Fields**: `id, market_id, source, title, category, state_abbr, district, candidate_name, yes_price, no_price, volume, liquidity, last_traded_at, market_url, status, updated_at`

```bash
curl -H "X-API-Key: KEY" "https://.../public-api/prediction-markets?category=senate&source=polymarket&limit=20"
```

---

### 8. `/prediction-markets-charts` — Prediction Market Chart Data (Pre-Aggregated)

Returns pre-computed chart-ready data for rendering prediction market visualizations. Aggregates data across all active markets server-side.

**No query parameters** — returns aggregated data across all active markets.

**Response Structure:**
```json
{
  "charts": {
    "source_breakdown": {
      "description": "Market count, avg probability, and total volume per platform",
      "data": [
        { "source": "polymarket", "count": 50, "avg_probability": 48.2, "total_volume": 12500000 }
      ]
    },
    "category_breakdown": {
      "description": "Market count and volume per category",
      "data": [
        { "category": "president", "count": 85, "total_volume": 45000000 }
      ]
    },
    "probability_distribution": {
      "description": "Number of markets in each 10% probability bucket",
      "data": [
        { "range": "0-10%", "count": 45 },
        { "range": "10-20%", "count": 32 }
      ]
    },
    "top_by_probability": {
      "description": "Top 15 markets by YES probability",
      "data": [
        { "title": "Will Trump win 2028?", "source": "polymarket", "probability": 95.2, "volume": 5000000, "category": "president" }
      ]
    },
    "top_by_volume": {
      "description": "Top 15 markets by trading volume",
      "data": [...]
    },
    "cross_source_comparison": {
      "description": "Markets listed on multiple platforms with price spreads (arbitrage opportunities)",
      "data": [
        { "market": "trump wins 2028", "sources": { "polymarket": 52.3, "kalshi": 48.1 }, "spread": 4.2 }
      ]
    },
    "state_heatmap": {
      "description": "Market coverage and avg probability per state",
      "data": [
        { "state": "PA", "count": 12, "avg_probability": 51.3 }
      ]
    },
    "extremes": {
      "description": "Highest and lowest probability markets",
      "data": {
        "highest": [ { "title": "...", "source": "kalshi", "probability": 98.5 } ],
        "lowest": [ { "title": "...", "source": "manifold", "probability": 1.2 } ]
      }
    },
    "scatter": {
      "description": "Volume vs probability for all markets (for scatter plots)",
      "data": [
        { "probability": 52.3, "volume": 1200000, "source": "polymarket", "liquidity": 450000 }
      ]
    }
  },
  "meta": {
    "total_markets": 748,
    "total_sources": 5,
    "sources": ["polymarket", "kalshi", "metaculus", "manifold", "predictit"],
    "categories": ["president", "senate", "house", "governor", "general"]
  }
}
```

**Chart types returned:**

| Chart | Description | Visualization Type |
|-------|-------------|-------------------|
| `source_breakdown` | Market count + avg prob + volume per platform | Stacked bars, radar |
| `category_breakdown` | Market count + volume per race category | Pie/donut, bars |
| `probability_distribution` | Markets bucketed by 10% probability ranges | Histogram |
| `top_by_probability` | 15 highest-probability markets | Horizontal bar chart |
| `top_by_volume` | 15 highest-volume markets | Horizontal bar chart |
| `cross_source_comparison` | Same-market prices across platforms (arbitrage) | Grouped bar chart |
| `state_heatmap` | State-level market density + avg probability | Choropleth, tile grid |
| `extremes` | Top 5 highest + lowest probability markets | Diverging bar chart |
| `scatter` | Every market as (probability, volume, source) | Scatter plot |

```bash
curl -H "X-API-Key: KEY" "https://.../public-api/prediction-markets-charts"
```

---

### 9. `/maga-files` — MAGA Files

Vetting reports on Trump administration executive branch appointees. (In the web UI, MAGA Files are accessed as a subsection of Candidate Profiles.)

| Parameter | Description |
|-----------|-------------|
| `search` | Search by appointee name |

**Selected Fields**: `id, name, slug, content, created_at, updated_at`

```bash
curl -H "X-API-Key: KEY" "https://.../public-api/maga-files?search=hegseth"
```

---

### 10. `/narrative-reports` — Narrative Reports

Issue-based policy reports synthesizing Trump administration impacts (housing, healthcare, education, etc.).

| Parameter | Description |
|-----------|-------------|
| `search` | Search by report name/topic |

**Selected Fields**: `id, name, slug, content, created_at, updated_at`

```bash
curl -H "X-API-Key: KEY" "https://.../public-api/narrative-reports"
```

---

### 11. `/local-impacts` — Local Impact Reports

State-specific analyses of federal policy impacts across all 50 states.

| Parameter | Description |
|-----------|-------------|
| `state` | Filter by state abbreviation |
| `search` | Search by state name |

**Selected Fields**: `id, state, slug, summary, content, created_at, updated_at`

```bash
curl -H "X-API-Key: KEY" "https://.../public-api/local-impacts?state=OH"
```

---

### 12. `/voter-registration-stats` — Voter Registration Statistics

State-level voter registration data including total registered, eligible voters, registration rates, and 2024 general election turnout.

| Parameter | Description |
|-----------|-------------|
| `state` | Filter by state name (case-insensitive match) |
| `search` | Search by state name |

**Fields**: All columns from `state_voter_stats` including total_registered, total_eligible, registration_rate, turnout_general_2024, source, source_url.

```bash
curl -H "X-API-Key: KEY" "https://.../public-api/voter-registration-stats?state=MN"
```

---

### 13. `/congress-members` — Congress Members

Current members of Congress from Congress.gov with party, state, district, chamber, and biographical data.

| Parameter | Description |
|-----------|-------------|
| `state` | Filter by state abbreviation (exact match) |
| `chamber` | `house` or `senate` |
| `search` | Search by name, bioguide ID, or state |

**Selected Fields**: `id, bioguide_id, name, first_name, last_name, party, state, district, chamber, congress, depiction_url, official_url, candidate_slug`

```bash
curl -H "X-API-Key: KEY" "https://.../public-api/congress-members?state=CA&chamber=house"
```

---

### 14. `/congress-bills` — Federal Legislation

Federal bills and resolutions with sponsors, status, policy areas, and action history.

| Parameter | Description |
|-----------|-------------|
| `search` | Search by title, short title, sponsor name, or bill ID |
| `congress` | Filter by Congress number (e.g., `119`) |
| `policy_area` | Filter by policy area (case-insensitive match) |

**Selected Fields**: `id, bill_id, bill_type, bill_number, congress, title, short_title, sponsor_name, sponsor_bioguide_id, status, policy_area, origin_chamber, introduced_date, latest_action_date, latest_action_text, cosponsor_count`

```bash
curl -H "X-API-Key: KEY" "https://.../public-api/congress-bills?search=veterans&congress=119&limit=10"
```

---

### 15. `/campaign-finance` — Federal Campaign Finance

FEC campaign finance filings with fundraising totals, donor composition, and spending data.

| Parameter | Description |
|-----------|-------------|
| `state` | Filter by state abbreviation |
| `search` | Search by candidate name, state, or district |
| `cycle` | Election cycle year (e.g., `2026`; no default) |
| `office` | Filter by office: `house`, `senate`, or `president` |

**Selected Fields**: `id, candidate_name, candidate_slug, state_abbr, district, party, office, cycle, total_raised, total_spent, cash_on_hand, total_debt, individual_contributions, pac_contributions, self_funding, small_dollar_pct, large_donor_pct, out_of_state_pct, filing_date`

```bash
curl -H "X-API-Key: KEY" "https://.../public-api/campaign-finance?state=IA&office=senate&cycle=2026"
```

---

### 16. `/election-forecasts` — Election Forecasts & Race Ratings

Race ratings from Cook Political Report, Sabato's Crystal Ball, Inside Elections, and other forecasters.

| Parameter | Description |
|-----------|-------------|
| `state` | Filter by state abbreviation |
| `race_type` | `house`, `senate`, or `governor` |
| `cycle` | Election cycle year (default: `2026`) |
| `source` | Filter by forecast source (e.g., `cook`, `sabato`) |
| `search` | Search by state, district, or rating text |

**Selected Fields**: `id, source, state_abbr, district, race_type, rating, cycle, dem_win_prob, rep_win_prob, dem_vote_share, rep_vote_share, margin, last_updated`

```bash
curl -H "X-API-Key: KEY" "https://.../public-api/election-forecasts?race_type=house&source=cook"
```

---

### 17. `/congressional-elections` — Congressional Election Results

Historical U.S. House and Senate election results with vote counts, percentages, and winner/incumbent flags.

| Parameter | Description |
|-----------|-------------|
| `state` | Filter by state abbreviation |
| `search` | Search by candidate name or state |
| `year` | Filter by election year |
| `district` | Filter by district number |

**Selected Fields**: `id, candidate_name, state_abbr, district_number, party, election_year, election_type, election_date, votes, vote_pct, total_votes, is_winner, is_incumbent, is_write_in`

```bash
curl -H "X-API-Key: KEY" "https://.../public-api/congressional-elections?state=PA&year=2024&district=07"
```

---

### 18. `/state-finance` — State Campaign Finance

State-level campaign finance data from Campaign Finance Board filings across all states.

| Parameter | Description |
|-----------|-------------|
| `state` | Filter by state abbreviation |
| `search` | Search by candidate name, state, or committee name |
| `chamber` | Filter by chamber |

**Selected Fields**: `id, candidate_name, state_abbr, chamber, party, office, committee_name, reg_num, total_contributions, total_expenditures, net_cash, in_kind_total, contribution_count, expenditure_count, years_active`

```bash
curl -H "X-API-Key: KEY" "https://.../public-api/state-finance?state=PA&chamber=house"
```

---

### 19. `/mn-finance` — Minnesota Campaign Finance

Minnesota Campaign Finance Board (CFB) candidate data with detailed contribution and expenditure breakdowns.

| Parameter | Description |
|-----------|-------------|
| `search` | Search by candidate name or committee name |
| `chamber` | Filter by chamber |

**Selected Fields**: `id, candidate_name, chamber, committee_name, reg_num, total_contributions, total_expenditures, net_cash, in_kind_total, contribution_count, expenditure_count, years_active`

```bash
curl -H "X-API-Key: KEY" "https://.../public-api/mn-finance?search=walz"
```

---

### 20. `/messaging-guidance` — Messaging Guidance

Polling-based message guidance and communications strategy reports from Navigator Research and other sources.

| Parameter | Description |
|-----------|-------------|
| `search` | Search by title or summary (case-insensitive) |
| `issue_area` | Filter by issue area tag (e.g., `Immigration`, `Tariffs`) |

**Selected Fields**: `id, title, slug, source, source_url, author, published_date, summary, content, issue_areas, research_type, created_at, updated_at`

```bash
curl -H "X-API-Key: KEY" "https://.../public-api/messaging-guidance?search=tariff"
curl -H "X-API-Key: KEY" "https://.../public-api/messaging-guidance?issue_area=Immigration"
```

---

### 21. `/search` — Unified Master Search

Searches across **14 categories** simultaneously. This mirrors the web application's Master Search functionality.

| Parameter | Description |
|-----------|-------------|
| `search` | **Required** — Search query (minimum 2 characters) |
| `categories` | Comma-separated category filter (default: all) |
| `limit` | Max results per category (default 100, max 1000 — capped at 20 per category internally) |

**Available Categories**:
`candidates`, `congress_members`, `bills`, `polling`, `campaign_finance`, `state_finance`, `election_results`, `forecasts`, `maga_files`, `narrative_reports`, `local_impacts`, `voter_stats`, `mn_finance`, `messaging_guidance`

**Response Format** (different from standard endpoints):
```json
{
  "query": "smith",
  "total_results": 47,
  "categories_searched": 14,
  "categories_with_results": 5,
  "available_categories": ["candidates", "congress_members", ...],
  "categories": {
    "candidates": {
      "label": "Candidate Profiles",
      "count": 3,
      "results": [...]
    },
    "congress_members": {
      "label": "Congress Members",
      "count": 8,
      "results": [...]
    }
  }
}
```

```bash
# Search everything
curl -H "X-API-Key: KEY" "https://.../public-api/search?search=smith"

# Search specific categories only
curl -H "X-API-Key: KEY" "https://.../public-api/search?search=smith&categories=candidates,polling,bills,messaging_guidance"
```

### Search Category → Table Mapping

| Category | Database Table | Search Fields |
|----------|---------------|---------------|
| `candidates` | `candidate_profiles` | name |
| `congress_members` | `congress_members` | name, state, bioguide_id |
| `bills` | `congress_bills` | title, short_title, sponsor_name, bill_id |
| `polling` | `polling_data` | candidate_or_topic, source |
| `campaign_finance` | `campaign_finance` | candidate_name, state_abbr, district |
| `state_finance` | `state_cfb_candidates` | candidate_name, state_abbr, committee_name |
| `election_results` | `congressional_election_results` | candidate_name, state_abbr |
| `forecasts` | `election_forecasts` | state_abbr, district, rating (cycle=2026 only) |
| `maga_files` | `maga_files` | name |
| `narrative_reports` | `narrative_reports` | name |
| `local_impacts` | `local_impacts` | state |
| `voter_stats` | `state_voter_stats` | state |
| `mn_finance` | `mn_cfb_candidates` | candidate_name, committee_name |
| `messaging_guidance` | `messaging_guidance` | title, summary |

---

## MCP Server (Model Context Protocol)

### Description
OppoDB exposes a Streamable HTTP MCP server endpoint that allows AI agents (Claude Desktop, GPT agents, custom MCP clients) to access the database directly using structured tool calls. Built with `mcp-lite` on Hono.

### MCP URL
```
https://yysbtxpupmwkxovgkama.supabase.co/functions/v1/mcp-server
```

### Authentication
Requires `X-API-Key` header (same keys as REST API). Also accepts `Authorization: Bearer <key>`.

**Access Control**: User must have `premium` or `admin` role. Role is verified via `user_roles` table lookup after API key validation.

### Claude Desktop Configuration

```json
{
  "mcpServers": {
    "ordb": {
      "type": "streamable-http",
      "url": "https://yysbtxpupmwkxovgkama.supabase.co/functions/v1/mcp-server",
      "headers": {
        "X-API-Key": "YOUR_API_KEY"
      }
    }
  }
}
```

### MCP Tools Reference

The MCP server exposes **18 tools** organized by data category:

#### Candidate & Content Tools

| Tool | Description | Key Parameters |
|------|-------------|---------------|
| `search_candidates` | Search candidate profiles by name | `search`, `limit`, `offset` |
| `get_candidate` | Get specific candidate by slug (full content) | `slug` (required) |
| `get_maga_files` | Search/retrieve MAGA appointee files | `search`, `slug`, `limit` |
| `get_narrative_reports` | Search/retrieve policy reports | `search`, `slug`, `limit` |
| `get_local_impacts` | State-specific federal policy impacts | `state`, `limit` |

#### Congressional Data Tools

| Tool | Description | Key Parameters |
|------|-------------|---------------|
| `get_congress_members` | Search Congress members by name, state, party, chamber | `search`, `state`, `chamber`, `party`, `limit`, `offset` |
| `get_congress_bills` | Search federal legislation | `search`, `congress`, `policy_area`, `limit`, `offset` |

#### District & Demographics Tools

| Tool | Description | Key Parameters |
|------|-------------|---------------|
| `search_congressional_districts` | Search district profiles with census data | `state`, `search`, `limit`, `offset` |
| `search_state_legislative` | Search state legislative districts | `state`, `chamber`, `limit`, `offset` |

#### Election & Forecasting Tools

| Tool | Description | Key Parameters |
|------|-------------|---------------|
| `get_election_results` | State legislative election results | `state`, `chamber`, `district`, `year`, `limit`, `offset` |
| `get_congressional_elections` | Congressional election results | `search`, `state`, `year`, `district`, `limit`, `offset` |
| `get_election_forecasts` | Race ratings from Cook, Sabato, etc. | `state`, `race_type`, `source`, `cycle`, `limit`, `offset` |

#### Finance Tools

| Tool | Description | Key Parameters |
|------|-------------|---------------|
| `get_campaign_finance` | Federal FEC campaign finance data | `search`, `state`, `office`, `cycle`, `limit`, `offset` |
| `get_state_finance` | State-level campaign finance (all states) | `search`, `state`, `chamber`, `limit`, `offset` |
| `get_mn_finance` | Minnesota CFB candidate finance data | `search`, `chamber`, `limit`, `offset` |

#### Polling & Voter Data Tools

| Tool | Description | Key Parameters |
|------|-------------|---------------|
| `get_polling_data` | Approval/favorability/issue polls | `search`, `limit`, `offset` |
| `get_voter_registration_stats` | State voter registration statistics | `state`, `limit`, `offset` |

#### Unified Search Tool

| Tool | Description | Key Parameters |
|------|-------------|---------------|
| `master_search` | Search ALL 13 categories simultaneously | `search` (required), `categories` (array), `limit` |

### MCP Tool Response Format

All MCP tools return structured JSON in the MCP content format:
```json
{
  "content": [{
    "type": "text",
    "text": "{\"total\": 42, \"results\": [...]}"
  }]
}
```

Error responses:
```json
{
  "content": [{
    "type": "text",
    "text": "Error: <error message>"
  }]
}
```

### MCP Authentication Flow (Technical Detail)

```
1. Client sends request with X-API-Key header
2. Hono middleware intercepts ALL routes ("/*")
3. SHA-256 hash computed from key
4. validate_api_key() RPC called with hash → returns user_id, key_id
5. user_roles table queried for user_id
6. Check if user has 'premium' or 'admin' role
7. If valid: log request via log_api_request() RPC (fire-and-forget), proceed to MCP handler
8. If invalid: return 401/403 JSON error
```

---

## API Analytics (`ApiAnalytics`)

Dashboard component showing API usage metrics:
- Total requests (all time)
- Requests by endpoint breakdown
- Key usage statistics per API key
- Error rate tracking
- Request timeline

Data sourced from `api_request_logs` table with RLS policy allowing users to read only their own logs.

### Database Schema

```sql
-- api_request_logs table
CREATE TABLE api_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES api_keys(id),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  status_code integer NOT NULL DEFAULT 200,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: Users can only read their own logs
CREATE POLICY "Users can read own api_request_logs"
  ON api_request_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());
```

---

## Security Features

### Key Hashing
- API keys are stored as SHA-256 hashes (computed via `crypto.subtle.digest`)
- Only the key prefix (first 8 chars) is ever shown to users after creation
- Keys cannot be recovered once lost — must be regenerated

### Request Validation
- `validate_api_key()` SECURITY DEFINER function checks hash against `api_keys` table
- Returns `user_id` and `key_id` for authorization and logging
- Revoked keys (`revoked_at IS NOT NULL`) are rejected

### Request Logging
- All API requests logged via `log_api_request()` SECURITY DEFINER function
- Logs include: endpoint, timestamp, key ID, user ID, response status
- Atomic counter increment on `api_keys.request_count` and `last_used_at`
- Stored in `api_request_logs` table (INSERT only via function, SELECT via RLS)

### CORS Configuration
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
```

### Method Restriction
Only `GET` and `OPTIONS` (CORS preflight) requests are accepted. All other methods return `405 Method Not Allowed`.

### Revocation
- Users can revoke their own API keys (RLS UPDATE policy)
- Revoked keys immediately lose access on next request
- Keys can be permanently deleted (RLS DELETE policy)

---

## Library Functions (`lib/apiKeys.ts`)

```typescript
createApiKey(name: string): Promise<{ id: string; key: string } | null>
// Generates random key with "ordb_" prefix, stores SHA-256 hash, returns plaintext ONCE

listApiKeys(): Promise<ApiKey[]>
// Lists user's keys via RLS SELECT policy

revokeApiKey(keyId: string): Promise<boolean>
// Sets revoked_at timestamp

deleteApiKey(keyId: string): Promise<boolean>
// Permanently removes key record

getApiBaseUrl(): string
// Constructs full API base URL from VITE_SUPABASE_URL env var
```

---

## Edge Function Architecture

### `public-api/index.ts`
- **Runtime**: Deno (Supabase Edge Functions)
- **Framework**: Raw `Deno.serve()` handler
- **Database**: `@supabase/supabase-js` with `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS for data reads)
- **Authentication**: Custom API key validation (not JWT-based)
- **Routing**: URL path parsing — last segment of `/public-api/{endpoint}` used as endpoint identifier
- **Pagination**: All queries use `.range(offset, offset + limit - 1)` with configurable limits

### `mcp-server/index.ts`
- **Runtime**: Deno (Supabase Edge Functions)
- **Framework**: Hono web framework
- **MCP Library**: `mcp-lite` (npm, Streamable HTTP transport)
- **Authentication**: Hono middleware validates API key + checks premium/admin role
- **Transport**: `StreamableHttpTransport` from mcp-lite, bound to all Hono routes
- **Database**: Same Supabase service role client for data access

---

## Use Cases

### External Research Tools
Integrate OppoDB data into external research workflows, spreadsheets, or databases.

### AI Agent Access
AI agents (Claude, GPT, etc.) can use the MCP server or REST API to answer political research questions using OppoDB's full database.

### Data Journalism
Journalists can pull live data for stories, visualizations, or interactive graphics.

### Campaign Operations
Campaigns can sync OppoDB data with their own CRM, voter file, or targeting tools.

### Automated Monitoring
Set up scripts to monitor for changes in polling, forecasts, or campaign finance data.

### Cross-Platform Search
The `/search` and `master_search` endpoints enable building custom search interfaces that query all 13 data categories simultaneously.
