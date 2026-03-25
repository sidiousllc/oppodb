# Feature: District Intelligence

## Description

District Intelligence provides comprehensive data on all 435 U.S. Congressional Districts. It combines demographic data from the U.S. Census, partisan lean metrics from Cook Political Report, election history, and polling data into a single viewable profile for each district.

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

The District Intel section supports:

### Filters
- **Tracked Only** toggle — shows only districts with linked candidates
- **Cook Rating filter** — filter by rating (Solid D, Likely D, Lean D, Tossup, Lean R, Likely R, Solid R)
- **PVI (Partisan Voting Index) filter** — filter by PVI ranges (D+10+, D+5-9, D+1-4, Even, R+1-4, R+5-9, R+10+)

### Census Sync Button
Admin-triggered sync of district demographics from the Census Bureau ACS 5-Year Estimates.

### Election Sync Button
Bulk sync of congressional election results across all 50 states via the OpenElections API. Progress is shown state-by-state.

### District Map
Interactive SVG-based district map that:
- Colors districts by PVI (blue-to-red gradient)
- Is filterable by PVI ranges
- Clickable districts navigate to the detail view

### District Compare Mode
Allows comparing multiple districts side-by-side with:
- Demographic bar charts
- Cook rating comparison
- PVI comparison
- Key economic metrics

## District Detail Page Components

### 1. District Header
- District ID (e.g., "IA-01")
- State badge
- Cook rating badge
- **PDF Export** button

### 2. District Boundary Map (`DistrictBoundaryMap`)
- SVG district boundary rendered via `DistrictBoundaryMap.tsx`
- Highlighted district shape within state context

### 3. Cook Rating Banner
- Displays current Cook Political Report rating
- Color-coded banner with Cook rating text

### 4. Cook Rating History (`CookRatingHistory`)
- Historical Cook ratings over time for the district
- Shows rating changes across election cycles

### 5. Cook PVI Chart (`CookPVIChart`)
- Partisan Voting Index visualization
- Shows district's partisan lean relative to national average

### 6. Congressional Delegation (`DistrictCongressPanel`)
- Current representatives for the district
- Links to candidate profiles

### 7. District Polling (`DistrictPollingPanel`)
- District-specific polling data
- Generic ballot tests for the district

### 8. Campaign Finance (`AreaFinancePanel`)
- Top-line fundraising numbers for candidates in the district
- Donor composition (individual, PAC, party, small donor)
- Top industries and contributors
- Source: FEC data via OpenSecrets patterns

### 9. Forecast Model Comparison (`ForecastComparisonPanel`)
- Compares district-level predictions across forecasting models
- Shows win probability ranges

### 10. Election History (`CongressionalElectionsSection`)
- Historical election results for the district
- Vote totals by party across cycles
- Incumbent win/loss record

### 11. MIT Election Lab Data (`MITElectionHistoryPanel`)
- MIT Election Data + Science Lab historical results
- Presidential and congressional ticket performance

### 12. Presidential County Map (`PresidentialCountyMap`)
- County-level breakdown of presidential results in the district
- Shows which counties vote most heavily for each party

### 13. Demographics Sections
- **Economic Indicators**: Population, Median Income, Median Age, Poverty Rate, Unemployment, Household Data
- **Racial & Ethnic Demographics**: White, Black, Hispanic, Asian, Foreign-born percentages
- **Housing**: Owner-occupied vs renter-occupied, median home value, median rent
- **Health & Veterans**: Uninsured rate, veteran population

### 14. Tracked Representatives
- Lists all OppoDB-tracked candidates for this district
- Clickable to navigate to candidate profile

### 15. Top Issues
- Algorithmically determined top issues based on district characteristics

## Data Sources

| Data Type | Source |
|-----------|--------|
| Demographics | U.S. Census ACS 5-Year Estimates (2022) |
| Cook Ratings | Cook Political Report (March 2026) |
| PVI | Cook Political Report PVI (2024) |
| Election Results | OpenElections, MIT Election Lab |
| Campaign Finance | FEC via OpenSecrets patterns |
| District Boundaries | GeoJSON shapes (compiled) |

## Supabase Table: `district_profiles`

All district data is stored in the `district_profiles` Supabase table and queried via `fetchAllDistricts()` and `searchDistricts()` in `districtIntel.ts`.
