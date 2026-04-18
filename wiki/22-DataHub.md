# DataHub

The **DataHub** is the application's central intelligence repository, consolidating polling data, prediction markets, campaign finance, election results, congressional voting records, and election forecasts into a single tabbed interface. It is the most data-dense section of OppoDB.

## Location

- **Sidebar entry**: `DataHub` (icon: 📊). Internally routed as `polling` for backwards compatibility with the original "Polling Data" name.
- **File**: `src/components/PollingSection.tsx` (top-level), with sub-tabs in `IssuePollingSection.tsx`, `PredictionMarketsPanel.tsx`, `CampaignFinancePanel.tsx`, `ElectionResultsSection.tsx`, `CongressDataPanel.tsx`, `ForecastComparisonPanel.tsx`.

## Tabs

### 1. Polling
- Two display modes: **Race Polling** (head-to-head matchups, candidate vs. candidate) and **Issue Polling** (approval, favorability, topical questions).
- Filterable by state, candidate, pollster, methodology, sample size, and date range.
- Each row opens a **Poll Detail Window** (`PollDetailWindow.tsx`) with:
    - Trendline chart (recharts) of approve/disapprove or candidate margins over time.
    - Methodology badge (Live phone, IVR, Online panel, Mixed).
    - Pollster pollster-rating sourced from `pollster_ratings` table.
    - Sample composition (LV, RV, A) and weighting notes.
    - Crosstabs when present in `raw_data` JSON.
- "Test Alert" button (admin) dispatches `polling-alerts-dispatch` for the current row.

### 2. Prediction Markets
- See [Prediction Market Trading](Prediction-Market-Trading).
- Aggregates Polymarket, Kalshi, and PredictIt contracts.
- Each row opens **MarketDetailWindow** with probability gauge, YES/NO order book snapshot, and cross-platform comparison.

### 3. Campaign Finance
- See [Campaign Finance](Campaign-Finance).
- Cycle dropdown (2012–2026), state filter, "Sync All" button (admin).
- Sub-views: by candidate, by state, by area, donor concentration.

### 4. Election Results
- Historical results from MIT Election Lab, Wikipedia, and `congressional_election_results` table.
- Coverage 1976–2024 (House, Senate, Presidential).
- See [Cook Ratings & Forecasting](Cook-Ratings-and-Forecasting) for forecast layering.

### 5. Congressional Data
- Bills, committees, members, and roll-call votes.
- Sourced from `congress-sync` edge function (Congress.gov v3 API).
- Member detail view shows leadership positions, FEC IDs, social media, and voting record alignment.

### 6. Election Forecasts
- Side-by-side comparison of Cook Political Report, Sabato's Crystal Ball, Inside Elections, 538, and Decision Desk HQ ratings.
- `ForecastHistoryTimeline` shows rating-shift events from `election_forecast_history` (auto-tracked via DB trigger).

## Database Tables

| Table | Purpose |
|-------|---------|
| `polling_data` | Raw poll rows |
| `polling_alert_subscriptions` | User alert configs |
| `prediction_markets` | Market snapshots |
| `campaign_finance` | Aggregated finance per candidate/cycle |
| `congressional_election_results` | Historical results |
| `congress_bills`, `congress_members`, `congress_votes`, `congress_committees`, `congressional_record` | Congress.gov mirror |
| `election_forecasts`, `election_forecast_history` | Forecast ratings + change log |

## Edge Functions
- `polling-sync`, `seed-polling`, `polling-alerts-dispatch`
- `prediction-markets-sync`, `market-trading`, `credential-vault`
- `campaign-finance-sync`, `opensecrets-sync`, `mn-cfb-finance`, `state-cfb-finance`, `followthemoney`
- `congress-sync`, `congressional-election-sync`, `mit-election-sync`
- `forecast-sync`, `forecast-scrape`

## Polling Email Alerts
See [Polling Alerts & Email Preferences](Polling-Alerts-and-Email-Preferences).

## AI Intelligence (Polling)

`PollDetailWindow` mounts a `SubjectAIPanel` (`subject_type="polling"`, `subject_ref=polling_data.id`) with three sub-tabs: **Talking Points**, **Audience Fit**, **Impact**. Edge functions: `subject-talking-points`, `subject-audience-analysis`, `subject-impact-analysis`. Cache tables: `talking_points`, `subject_audience_analyses`, `subject_impact_analyses`. Available via REST `/public-api/v1/subject-ai-bundle?subject_type=polling&subject_ref=<uuid>` and MCP (`get_subject_ai_bundle`, `generate_subject_*`). Cross-section context toggles: polling / intel / legislation / finance / forecasts / international / demographics.

