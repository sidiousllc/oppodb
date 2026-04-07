# Feature: DataHub (Polling Data, Prediction Markets & Campaign Finance)

## Description

The DataHub is the central intelligence section of OppoDB, consolidating three major data categories into tabbed subsections:

1. **Polling Data** — Presidential approval, generic ballot, issue polling, favorability, and demographic cross-tabs from 30+ sources
2. **Prediction Markets** — Real-time probability data and trading integration for Polymarket, Kalshi, PredictIt, Manifold Markets, and Metaculus
3. **Campaign Finance** — FEC federal filings and state-level campaign finance data (previously a standalone sidebar section, now integrated into DataHub)

OppoDB maintains a comprehensive polling database covering presidential approval, generic congressional ballot, issue polling, candidate favorability, and demographic cross-tabs. Data is visualized through multiple chart types including trend lines, bar charts, butterfly charts, dot plots, and gauge visualizations.

## Data Model

```typescript
interface PollEntry {
  id: string;
  source: string;                  // Pollster name
  candidate_or_topic: string;     // Candidate name or issue
  poll_type: "approval" | "favorability" | "generic_ballot" | "head_to_head" | "issue";
  date_conducted: string;          // YYYY-MM-DD
  end_date?: string;
  approve_pct?: number;            // For approval polls
  disapprove_pct?: number;
  margin?: number;
  favor_pct?: number;              // For favorability
  oppose_pct?: number;
  sample_size?: number;
  sample_type?: string;            // LV, RV, Adults
  partisan_lean?: string;          // e.g., "Lean D", "Lean R"
  source_url?: string;
  subgroup?: string;               // e.g., "Men", "Women", "White"
  question?: string;
}
```

## Poll Types

| Type | Description |
|------|-------------|
| `approval` | Presidential approval (e.g., Trump Approval) |
| `favorability` | Candidate favorability ratings |
| `generic_ballot` | Generic Democrat vs Republican ballot |
| `head_to_head` | Two-candidate matchup |
| `issue` | Issue-specific polling (immigration, healthcare, etc.) |

## Data Sources

Polling data is sourced from multiple pollsters defined in `POLLING_SOURCES`:

| Source | Color | URL |
|--------|-------|-----|
| 538 | Blue | https://projects.fivethirtyeight.com/polls/ |
| RCP | Red | https://www.realclearpolitics.com/ |
| Trafalgar | Orange | https://www.trafalgarsurvey.com/ |
| Remington | Purple | https://remingtonresearchgroup.com/ |
| InsiderAdvantage | Teal | https://insideradvantage.com/ |
| SoCal | Green | https://socialcapital.lab.ucla.edu/ |
| Quinnipiac | Navy | https://poll.qu.edu.edu/ |
| Emerson | Pink | https://emerson.college.edu/ |
| Susquehanna | Brown | https://www.susqpa.com/ |
| Datr | Cyan | https://datr.co/ |

## Polling Section Components

### 1. Stats Row
Animated stat cards showing:
- Total polls in database
- Date range of latest poll
- Number of unique sources

### 2. Source Distribution
- Poll count by source
- Poll type distribution (approval, favorability, generic ballot, etc.)

### 3. Multi-Source Trend Chart (`MultiSourceTrendChart`)
Interactive chart comparing approval ratings across pollsters:
- **Bar View**: Side-by-side bars per source for latest results
- **Trend View**: Line chart over time per source
- Source toggle (hide/show individual pollsters)
- Sorting by approve, disapprove, or margin
- Date range zoom controls
- Tooltip showing exact values on hover

### 4. Source Dot Plot (`SourceDotPlot`)
- Horizontal dot plot showing each pollster's latest result
- Color-coded by partisan lean
- Shows sample size and date

### 5. Issue Butterfly Chart (`IssueButterflyChart`)
- Back-to-back horizontal bars for each issue
- Left side: Approve/Favor (green)
- Right side: Disapprove/Oppose (red)
- Center divider
- Animated bar widths
- Average across all sources per issue

### 6. Generic Ballot Chart (`GenericBallotChart`)
- Democrat vs Republican generic ballot by party
- Shows lean and margin
- Source attribution

### 7. Favorability Chart
- Candidate favorability ratings
- Net favorability score

### 8. Generic Ballot Trend Chart (`GenericBallotTrendChart`)
- Time series of generic ballot polling
- Shows trend direction with color coding

### 9. Demographic Breakdown (`DemographicBreakdownChart`)
- Approval by demographic subgroup
- Gender, age, race breakdowns
- Stacked bar visualization

### 10. Issue Polling Deep Dive (`IssuePollingSection`)
- Individual poll selection via `PollPickerButton` / `PollPickerDropdown`
- Issue-by-issue approve/disapprove butterfly charts
- Custom poll selection (filter by specific pollsters/dates)

### 11. Source Comparison Table
- Sortable table of latest poll from each source
- Columns: Source, Approve, Disapprove, Margin, Sample, Date, Link
- Color-coded partisan lean badges

### 12. All Polls Table
- Complete polling data table
- Columns: Source, Topic, Type, Result, Margin, Date
- External links to poll sources

### 13. Source Attribution
- Grid of all polling sources with links to their websites

## Poll Picker System

The `usePollPicker` hook provides a reusable polling filter UI:
- Allows selecting specific polls by source + date
- "All" mode shows aggregated results
- Selective mode shows only chosen polls
- Used across multiple chart components for consistency

## Export Functions

Two export utilities are available:
- **`exportPollingCSV()`** — Exports polling data as CSV
- **`exportPollingPDF()`** — Generates a formatted PDF report

## Supabase Table

All polling data is stored in the `polling_data` Supabase table and queried via `fetchPollingData()` from `pollingData.ts`.

---

## Campaign Finance Tab

Campaign Finance is now accessible as the third tab in the DataHub section. It provides comprehensive fundraising analysis including total raised, spending, cash on hand, donor composition, and industry/corporate giving patterns. See [Campaign Finance](Campaign-Finance) for full documentation.

## Prediction Markets Tab

The Prediction Markets tab provides real-time probability data from multiple platforms and integrated trading capabilities. See [Prediction Market Trading](Prediction-Market-Trading) for full documentation.

## Navigation

The DataHub uses a tab-based navigation system:

| Tab | Component | Description |
|-----|-----------|-------------|
| 📊 Polling Data | `PollingSection` (inline) | All polling visualizations and tables |
| 📈 Prediction Markets | `PredictionMarketsPanel` (lazy-loaded) | Market data, trading, and portfolio |
| 💰 Campaign Finance | `CampaignFinanceSection` | FEC filings and state finance data |
