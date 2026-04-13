# Feature: Campaign Finance

## Description

Campaign Finance tracks FEC (Federal Election Commission) filings for federal candidates and state-level finance data from multiple sources including OpenSecrets and FollowTheMoney.org. It provides comprehensive fundraising analysis including total raised, spending, cash on hand, donor composition, and industry/corporate giving patterns across historical and current election cycles (2012–2026).

> **Note**: Campaign Finance is now accessible as a tab within the **DataHub** section (alongside Polling Data and Prediction Markets). It was previously a standalone sidebar section.

---

## Federal Campaign Finance (FEC)

### Data Model

```typescript
interface FinanceRow {
  id: string;
  candidate_name: string;
  candidate_slug: string | null;
  office: string;            // house, senate, president, all (aggregate)
  state_abbr: string;        // e.g., "IA", "AZ"
  district: string | null;   // e.g., "IA-01", "TX-35" (for House)
  party: string | null;      // D, R, L, G
  cycle: number;             // 2012, 2014, 2016, 2018, 2020, 2022, 2024, 2026
  source: string;            // "FEC" or "OpenSecrets"
  source_url: string | null;
  
  // Financial totals
  total_raised: number | null;
  total_spent: number | null;
  cash_on_hand: number | null;
  total_debt: number | null;
  
  // Funding sources
  individual_contributions: number | null;
  pac_contributions: number | null;
  self_funding: number | null;
  
  // Donor profiles
  small_dollar_pct: number | null;
  large_donor_pct: number | null;
  out_of_state_pct: number | null;
  
  // Detailed breakdowns
  top_industries: Array<{ name: string; amount: number; indivs?: number; pacs?: number }>;
  top_contributors: Array<{ name: string; amount: number; indivs?: number; pacs?: number }>;
  quarterly_data: any;
  raw_data: any;
  
  filing_date: string | null;
}
```

### Sync Functions

#### `campaign-finance-sync` Edge Function

The primary FEC data sync function with the following capabilities:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `state` | State abbreviation or `ALL` for all 50 states | `?state=MN` or `?state=ALL` |
| `cycle` | Single cycle to sync | `?cycle=2024` |
| `historical` | Sync all cycles 2012–2026 | `?historical=true` |

**Default behavior** (no `historical` flag): Syncs cycles 2024 and 2026 for the specified state.

**Authentication**: Requires admin role (JWT verified via `getUser()` + `has_role()` RPC) or service-role token for scheduled cron calls.

**FEC API Integration**:
- Base URL: `https://api.open.fec.gov/v1`
- Endpoint: `/candidates/totals/` — fetches candidates with financial totals per state, office, and cycle
- Paginates up to 5 pages per office type (House + Senate)
- 400ms delay between pages for rate limiting
- 500ms delay between state/cycle combinations for bulk syncs
- URL construction validated against path traversal attacks

**Data Processing**:
1. Fetches candidate totals for House (H) and Senate (S) offices
2. Skips records with no receipts/disbursements/COH
3. Deduplicates by `candidate_slug|state_abbr|cycle|office` composite key
4. Calculates percentage breakdowns (individual, PAC, self-funding)
5. Generates per-state aggregate rows with totals
6. Upserts in batches of 50, falling back to individual inserts on batch failure

#### `opensecrets-sync` Edge Function

Syncs data from OpenSecrets API for enriched contributor and industry data:

| Parameter | Description |
|-----------|-------------|
| `state` | State abbreviation (required) |
| `cycle` | Election cycle (default: 2024) |
| `limit` | Max candidates to process (default: 10, manages rate limits) |

**API Endpoints Used**:
- `getLegislators` — Get CIDs for state legislators
- `candSummary` — Total raised/spent/COH/debt, source breakdown
- `candIndustry` — Top 10 donor industries
- `candContrib` — Top 10 contributors

**Authentication**: Requires `OPENSECRETS_API_KEY` secret. Rate limited to 200 calls/day (free tier).

### Campaign Finance Section UI (`CampaignFinanceSection`)

The main DataHub finance tab provides:

#### Summary Cards
- **Total Tracked** — Number of unique candidates
- **Total Raised** — Sum across all candidates
- **Avg Raised** — Per-candidate average
- **States Tracked** — Number of state aggregates

#### Filters & Controls
- **Search** — Filter by candidate name, state, or district
- **Office Filter** — All / House / Senate / Governor / By State (aggregate view)
- **Cycle Filter** — Dropdown for 2026, 2024, 2022, 2020, 2018, 2016, 2014, 2012, or All Cycles
- **Sort** — By total raised, total spent, cash on hand, or name
- **Sync All Button** — Triggers full 50-state historical sync (admin only)

#### Data Loading
Uses paginated batch fetching (1000 rows per batch) to handle datasets exceeding the Supabase default limit.

#### Record Detail View
Clicking any record opens a detailed view with:
- Top-line financials (raised, spent, COH, debt)
- Funding source breakdown with percentage bars
- Top industries chart
- Top contributors list
- Source attribution and filing date

### Campaign Finance Panel (`CampaignFinancePanel`)

Used in candidate detail views. Displays:
- Total raised, total spent, cash on hand, total debt
- Funding source breakdown (individual, PAC, self-funding)
- Donor profile (small dollar vs large donor, in-state vs out-of-state)
- Top 5 donor industries with bar charts
- Top 5 individual contributors
- Source: FEC filings

### Area Finance Panel (`AreaFinancePanel`)

District-level finance view showing:
- Summary of all candidates' fundraising in a district
- Comparison across candidates
- District-level aggregate metrics

### State Finance Panels

- **`StateFinancePanel`** — State-level overview
- **`MNFinancePanel`** — Minnesota-specific state finance data

### MNFinancePanel Security (SSRF Mitigation)

The `MNFinancePanel` component includes robust SSRF protection:

1. **Project ID Validation**: Only alphanumeric characters, hyphens, and underscores
2. **Domain Allowlisting**: Only `supabase.co` subdomains
3. **Protocol Restriction**: Only `http:` and `https:` protocols
4. **Safe Query Parameters**: Uses `url.searchParams.set()` for automatic encoding

---

## State Campaign Finance (FollowTheMoney.org)

### FollowTheMoneyPanel

State-level campaign finance data via FollowTheMoney.org:
- Industry contributions to state candidates
- Top contributors by sector
- Small donor vs large donor breakdown
- Requires `FOLLOWTHEMONEY_API_KEY` secret

---

## Scheduled Sync Integration

The `scheduled-sync` edge function (daily at 3:00 AM UTC) includes campaign finance sync:

- Processes 5 states per batch with checkpoint offsets (sync_metadata id=4)
- On first batch rotation (offset 0), automatically includes historical cycles
- Calls `campaign-finance-sync` for each state with `historical=true` flag
- Also syncs state-level CFB data for MN, PA, MI via `mn-cfb-finance` and `state-cfb-finance`

---

## Supabase Tables

| Table | Scope | Description |
|-------|-------|-------------|
| `campaign_finance` | Federal | FEC filings with fundraising, spending, donor composition (2012–2026) |
| `state_cfb_candidates` | Multi-state | State CFB candidate finance (all states with CFB data) |
| `mn_cfb_candidates` | Minnesota | Detailed MN CFB candidate finance data |

### Unique Constraint
`campaign_finance` uses a composite unique constraint on `(candidate_slug, state_abbr, cycle, office)` for upsert operations.

---

## API Access

| REST Endpoint | MCP Tool | Data Source |
|---------------|----------|-------------|
| `/campaign-finance` | `get_campaign_finance` | `campaign_finance` (FEC) |
| `/state-finance` | `get_state_finance` | `state_cfb_candidates` (multi-state) |
| `/mn-finance` | `get_mn_finance` | `mn_cfb_candidates` (Minnesota) |

All three are included in the unified `/search` endpoint and `master_search` MCP tool.

---

## Data Sources

| Level | Source | Cycles |
|-------|--------|--------|
| Federal candidates | FEC (Federal Election Commission) | 2012–2026 |
| Federal enrichment | OpenSecrets.org (industry/contributor data) | 2024 |
| State candidates | FollowTheMoney.org | Varies |
| Industry coding | OpenSecrets.org patterns | — |
| Minnesota | Minnesota Campaign Finance Board (CFB) | — |
| Multi-state | State CFBs via `state-cfb-finance` edge function | — |
| Real-time donations | WinRed webhook (`winred-webhook` edge function) | — |
