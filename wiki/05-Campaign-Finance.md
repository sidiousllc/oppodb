# Feature: Campaign Finance

## Description

Campaign Finance tracks FEC (Federal Election Commission) filings for federal candidates and state-level finance data from FollowTheMoney.org. It provides comprehensive fundraising analysis including total raised, spending, cash on hand, donor composition, and industry/corporate giving patterns.

> **Note**: Campaign Finance is now accessible as a tab within the **DataHub** section (alongside Polling Data and Prediction Markets). It was previously a standalone sidebar section.

## Federal Campaign Finance (FEC)

### Data Model

```typescript
interface FinanceRow {
  id: string;
  candidate_name: string;
  office: string;            // House, Senate, President
  state_abbr: string;        // e.g., "IA", "AZ"
  district: string | null;   // e.g., "01", "02" (for House)
  party: string | null;
  cycle: number;             // e.g., 2024, 2026
  source: string;            // FEC source attribution
  
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
  top_industries: Array<{ name: string; amount: number }>;
  top_contributors: Array<{ name: string; amount: number }>;
  
  filing_date: string | null;
}
```

### Campaign Finance Panel (`CampaignFinancePanel`)

Used in candidate detail views and district-level views. Displays:

#### Top-Line Numbers
- **Total Raised** — Total receipts
- **Total Spent** — Total disbursements
- **Cash on Hand** — Available funds
- **Total Debt** — Outstanding debts

#### Funding Sources
- Individual contributions (with %)
- PAC contributions (with %)
- Self-funding (with %)

#### Donor Profile
- Small dollar donors % (individuals giving < $200)
- Large donor % (individuals giving > $200)
- Out-of-state donor %

Visualized as percentage bar charts.

#### Top Industries
Horizontal bar chart showing top 5 donor industries:
- Real Estate, Health Professionals, Lawyers/Law Firms, etc.
- Shows dollar amounts and relative proportions

#### Top Contributors
Top 5 individual/organization donors with amounts.

#### Sources Attribution
Credits FEC as the data source with filing date and cycle.

### Area Finance Panel (`AreaFinancePanel`)

District-level finance view showing:
- Summary of all candidates' fundraising in a district
- Comparison across candidates
- District-level aggregate metrics

### State Finance Panels

- **`StateFinancePanel`** — State-level overview
- **`MNFinancePanel`** — Minnesota-specific state finance data

### MNFinancePanel Security (SSRF Mitigation)

The `MNFinancePanel` component includes robust Server-Side Request Forgery (SSRF) protection for URL construction:

**`buildValidatedUrl` Function (lines 52-92 in MNFinancePanel.tsx)**

The function validates all URL inputs before making requests to Supabase edge functions:

1. **Project ID Validation**: Only allows alphanumeric characters, hyphens, and underscores (`^[A-Za-z0-9_-]+$`)
2. **Domain Allowlisting**: Enforces only `supabase.co` subdomains
3. **Protocol Restriction**: Only `http:` and `https:` protocols allowed
4. **Safe Query Parameters**: Uses `url.searchParams.set()` for automatic encoding

This prevents attackers from manipulating URL construction to target internal services or arbitrary endpoints.

## State Campaign Finance (FollowTheMoney.org)

### FollowTheMoneyPanel

Provides state-level campaign finance data via FollowTheMoney.org patterns:
- Industry contributions to state candidates
- Top contributors by sector
- Small donor vs large donor breakdown

## Supabase Tables

| Table | Scope | Description |
|-------|-------|-------------|
| `campaign_finance` | Federal | FEC filings with fundraising, spending, donor composition |
| `state_cfb_candidates` | Multi-state | State CFB candidate finance (all states with CFB data) |
| `mn_cfb_candidates` | Minnesota | Detailed MN CFB candidate finance data |

## API Access

All campaign finance data is accessible via the public API and MCP server:

| REST Endpoint | MCP Tool | Data Source |
|---------------|----------|-------------|
| `/campaign-finance` | `get_campaign_finance` | `campaign_finance` (FEC) |
| `/state-finance` | `get_state_finance` | `state_cfb_candidates` (multi-state) |
| `/mn-finance` | `get_mn_finance` | `mn_cfb_candidates` (Minnesota) |

All three are also included in the unified `/search` endpoint and `master_search` MCP tool under the `campaign_finance`, `state_finance`, and `mn_finance` categories respectively.

## Data Sources

| Level | Source |
|-------|--------|
| Federal candidates | FEC (Federal Election Commission) |
| State candidates | FollowTheMoney.org |
| Industry coding | OpenSecrets.org patterns |
| Minnesota | Minnesota Campaign Finance Board (CFB) |
| Multi-state | State CFBs via `state-cfb-finance` edge function |
