# Feature: District Intelligence

## Description

District Intelligence provides comprehensive data on all 435 U.S. Congressional Districts. It combines demographic data from the U.S. Census, partisan lean metrics from Cook Political Report, election history, polling data, campaign finance, and legislative tracking into a single viewable profile for each district.

## Data Model

```typescript
interface DistrictProfile {
  district_id: string;        // e.g., "IA-01", "TX-35"
  state: string;               // Full state name
  population?: number;
  median_income?: number;
  median_age?: number;
  education_bachelor_pct?: number;
  // Demographics
  white_pct?: number;
  black_pct?: number;
  hispanic_pct?: number;
  asian_pct?: number;
  foreign_born_pct?: number;
  // Economic
  poverty_rate?: number;
  unemployment_rate?: number;
  total_households?: number;
  avg_household_size?: number;
  // Housing
  owner_occupied_pct?: number;
  median_home_value?: number;
  median_rent?: number;
  // Health
  uninsured_pct?: number;
  veteran_pct?: number;
  // Top issues (derived)
  top_issues: string[];
}
```

## District List View

### Filters
- **Tracked Only** toggle — shows only districts with linked candidates
- **Cook Rating filter** — filter by rating (Solid D, Likely D, Lean D, Tossup, Lean R, Likely R, Solid R)
- **PVI filter** — filter by PVI ranges (D+10+, D+5-9, D+1-4, Even, R+1-4, R+5-9, R+10+)

### Census Sync Button
Admin-triggered sync of district demographics from Census Bureau ACS 5-Year Estimates.

### Election Sync Button
Bulk sync of congressional election results across all 50 states. Progress shown state-by-state.

### District Map
Interactive SVG-based map with PVI-based coloring (blue-to-red gradient), filterable and clickable.

### District Compare Mode
Side-by-side comparison of multiple districts with demographic bar charts, Cook ratings, PVI, and economic metrics.

---

## District Detail Page Components

### 1. District Header
- District ID, state badge, Cook rating badge, PDF Export button

### 2. District Boundary Map (`DistrictBoundaryMap`)
- SVG district boundary rendered with highlighted district shape within state context

### 3. Cook Rating Banner
- Current Cook Political Report rating with color-coded banner

### 4. Cook Rating History (`CookRatingHistory`)
- Historical Cook ratings across election cycles

### 5. Cook PVI Chart (`CookPVIChart`)
- Partisan Voting Index visualization relative to national average

### 6. Congressional Delegation (`DistrictCongressPanel`)
- Current representatives with links to candidate profiles

### 7. District Polling (`DistrictPollingPanel`)
- District-specific polling data and generic ballot tests

### 8. Campaign Finance (`AreaFinancePanel`)
- Top-line fundraising for district candidates, donor composition, top industries/contributors

### 9. Forecast Model Comparison (`ForecastComparisonPanel`)
- Cross-model predictions (Cook, 538, Inside Elections, Sabato, Race Ranking)

### 10. Election History (`CongressionalElectionsSection`)
- Historical results, vote totals by party, incumbent records

### 11. MIT Election Lab Data (`MITElectionHistoryPanel`)
- Historical presidential and congressional results with county-level data

### 12. Presidential County Map (`PresidentialCountyMap`)
- County-level presidential result breakdown within the district

### 13. Demographics Sections
- **Economic**: Population, Median Income, Age, Poverty, Unemployment, Households
- **Racial & Ethnic**: White, Black, Hispanic, Asian, Foreign-born %
- **Housing**: Owner-occupied, median home value, median rent
- **Health & Veterans**: Uninsured rate, veteran population

### 14. Tracked Representatives
- All OppoDB-tracked candidates for the district, clickable to profile

### 15. Top Issues
- Algorithmically derived top issues based on district characteristics
- Derives from demographic metrics when explicit data is missing (e.g., high poverty → "Economy", high uninsured → "Healthcare")

---

## Issues & Impact Tab (Enhanced April 2026)

The Issues & Impact tab within the District Detail view provides comprehensive cross-referenced data for each district. It fetches six additional data sections dynamically:

### 1. Election Forecasts
- Fetches from `election_forecasts` table filtered by state, district, and `race_type = "house"`
- Displays source (Cook, Sabato, etc.), rating, and win probabilities (Dem/Rep)
- Color-coded badges for ratings

### 2. Relevant Polling
- Matches district's `effectiveTopIssues` against `polling_data` table
- Searches `candidate_or_topic` field for issue keywords
- Shows recent polls relevant to district voter concerns

### 3. Intelligence Briefings
- Fetches from `intel_briefings` filtered by state abbreviation as region
- Matches briefings relevant to the district's geographic area
- Links to full briefing text in IntelHub

### 4. Campaign Finance
- Fetches from `campaign_finance` filtered by district ID (e.g., "MN-01")
- Shows per-candidate raised/spent/COH for the current cycle
- Source attribution (FEC)

### 5. Current Representatives
- Fetches from `congress_members` filtered by state and district
- Displays name, party, official URL, depiction

### 6. Relevant Legislation
- Fetches from `congress_bills` and matches `policy_area`, `short_title`, and `title` against district `effectiveTopIssues`
- Shows bills relevant to local voter concerns

### 7. State Legislative History
- Fetches from `state_leg_election_results` for the state
- Shows recent winners and margins for state-level races

### 8. Opposition Research (MAGA Files)
- Matches relevant MAGA Files content to district concerns

### Effective Top Issues Derivation

When `top_issues` is empty in the database, the system derives issues from demographics:
```typescript
if (poverty_rate > 15) → "Economy"
if (uninsured_pct > 10) → "Healthcare"
if (median_home_value > 400000) → "Housing"
if (education_bachelor_pct < 20) → "Education"
if (unemployment_rate > 5) → "Jobs"
// ... additional heuristics
```

---

## District News Tab

The News tab aggregates representative-specific news:
- RSS proxy via `district-news` edge function
- Full article text rendered as Markdown via `scrape-article` edge function
- Win98-style draggable windows for article reading
- `localStorage` caching for offline viewing
- Cached in `district_news_cache` table

---

## Data Sources

| Data Type | Source |
|-----------|--------|
| Demographics | U.S. Census ACS 5-Year Estimates (2022) |
| Cook Ratings | Cook Political Report (March 2026) |
| PVI | Cook Political Report PVI (2024) |
| Election Results | OpenElections, MIT Election Lab |
| Campaign Finance | FEC via campaign-finance-sync, OpenSecrets |
| District Boundaries | GeoJSON shapes (compiled) |
| News | RSS aggregation via district-news edge function |
| Forecasts | Cook, 538, Sabato, Inside Elections |
| Intelligence | intel_briefings (90+ sources) |
| Legislation | congress_bills (Congress.gov) |

## Supabase Table: `district_profiles`

All district data stored in `district_profiles` and queried via `fetchAllDistricts()` and `searchDistricts()` in `districtIntel.ts`.
