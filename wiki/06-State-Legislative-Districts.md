# Feature: State Legislative Districts

## Description

State Legislative Districts provides intelligence on state legislature races — both House and Senate chambers across all 50 states. This feature allows users to track state legislative elections, view district demographics, and monitor state-level electoral competition.

## Data Model

```typescript
interface StateLegislativeProfile {
  district_id: string;         // e.g., "MN-15A", "TX-14"
  district_number: number;      // e.g., 15
  chamber: "house" | "senate";
  state: string;                // Two-letter abbreviation
  state_name: string;           // Full state name
  // Demographics
  population?: number;
  median_income?: number;
  median_age?: number;
  education_bachelor_pct?: number;
  white_pct?: number;
  black_pct?: number;
  hispanic_pct?: number;
  asian_pct?: number;
  // Economic
  poverty_rate?: number;
  unemployment_rate?: number;
  total_households?: number;
  // Housing
  owner_occupied_pct?: number;
  median_home_value?: number;
  // Voter profile
  total_registered?: number;
  total_voters?: number;
  // Election data
  last_election?: string;
  last_winner?: string;
  last_margin?: number;
  last_turnout?: number;
}
```

## State Legislative Section (`StateLegislativeSection`)

### List View

- Shows all state legislative districts
- Filter by state via `ALL_STATE_ABBRS` (all 50 states)
- Filter by chamber (House or Senate) via `ChamberFilter`
- Search functionality via `searchStateLegislative()`
- Color-coded chamber badges (blue for House, purple for Senate)

### District Card (`StateLegCard`)

Each district card displays:
- District number
- Chamber badge (House/Senate)
- State name
- State abbreviation
- Key demographic preview (population, median income, education)
- Last election result (winner and margin)
- Trending indicator

### State Maps

- **`StateLegBoundaryMap`** — Individual district boundary map
- **`StateLegOverviewMap`** — State-wide overview map showing all districts

### District Detail View

When a district is selected:
- Full demographic breakdown (same categories as congressional districts)
- Economic indicators
- Housing data
- Voter registration data
- Last election results and margins
- Chamber-specific information

### Election Results (`ElectionResultsSection`)

Historical election results for state legislative districts:
- Past election results
- Turnout data
- Margin trends

### Sync Results Panel (`SyncResultsPanel`)

Admin-facing panel showing sync status from external sources.

## Data Sync

### Census Data Sync
Demographic data synced from Census Bureau ACS via `syncCensusData()`.

### State Legislative Data Sync
State legislative data synced via `syncStateLegislativeData()`:
- By state (`syncStateLegislativeData(stateAbbr)`)
- By chamber (`syncStateLegislativeData(stateAbbr, chamber)`)
- Bulk sync across all states

### Election Results Sync
Election results synced via `syncElectionResults()` from `electionResults.ts`.

## Supabase Table

All state legislative data is stored in the `state_legislative_districts` Supabase table, queried via `fetchStateLegislativeDistricts()` from `stateLegislativeIntel.ts`.

## Coverage

All 50 U.S. states are covered with both House and Senate districts where applicable.
