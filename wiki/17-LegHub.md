# Feature: LegHub — Legislative Intelligence Hub

## Description

LegHub is the consolidated legislative intelligence section of OppoDB, combining two previously separate sections into a unified tabbed interface:

1. **State Legislatures** — State legislative district demographics, boundary maps, and election results
2. **Legislation** — Federal and state bill tracking via Congress.gov and LegiScan APIs

LegHub provides a single entry point for all legislative research, accessible from the sidebar under the ⚖️ icon.

---

## Architecture

### Component Structure

```
src/components/LegHub.tsx          # Tab container component
├── StateLegislativeSection.tsx    # State Legislatures tab
│   ├── StateLegCard.tsx           # District card component
│   ├── StateLegBoundaryMap.tsx    # Individual district map
│   ├── StateLegOverviewMap.tsx    # State-wide overview map
│   ├── ElectionResultsSection.tsx # Historical election results
│   └── SyncResultsPanel.tsx      # Admin sync status
└── LegislationSection.tsx         # Legislation tab
    ├── FederalBillsTab.tsx        # Congress.gov bill search/sync
    └── TrackedBills (inline)      # LegiScan bill tracking
```

### Navigation

```
Sidebar: "LegHub" (⚖️) → LegHub component
  ├── Tab: "State Legislatures" → StateLegislativeSection
  └── Tab: "Legislation" → LegislationSection
```

### Props Interface

```typescript
interface LegHubProps {
  stateLegDistricts: StateLegislativeProfile[];
  stateLegLoading: boolean;
  onStateLegSync: (stateAbbr?: string, chamber?: string) => void;
  stateLegSyncing: boolean;
}
```

---

## State Legislatures Tab

### Features
- Filter by state (all 50 states) and chamber (House/Senate)
- Full-text search across district IDs, states, and demographics
- Color-coded chamber badges (blue for House, purple for Senate)
- Interactive boundary maps via Esri Living Atlas
- Demographic data from Census ACS 5-Year survey (30+ variables)
- Historical election results with turnout and margin data

### Data Model

```typescript
interface StateLegislativeProfile {
  district_id: string;           // e.g., "MN-15A", "TX-14"
  district_number: string;
  chamber: "house" | "senate";
  state: string;                 // Full state name
  state_abbr: string;            // Two-letter abbreviation
  population?: number;
  median_income?: number;
  median_age?: number;
  education_bachelor_pct?: number;
  white_pct?: number;
  black_pct?: number;
  hispanic_pct?: number;
  asian_pct?: number;
  poverty_rate?: number;
  unemployment_rate?: number;
  owner_occupied_pct?: number;
  median_home_value?: number;
  median_rent?: number;
  veteran_pct?: number;
  foreign_born_pct?: number;
  uninsured_pct?: number;
  total_households?: number;
  avg_household_size?: number;
}
```

### Database Tables
- `state_legislative_profiles` — District demographics and metadata
- `state_leg_election_results` — Historical election results

### Sync
- Census data via `census-sync` edge function
- State legislative data via `state-legislative-sync` edge function
- Election results via `election-results-sync` edge function

---

## Legislation Tab

### Features
- **Federal Bills** (`FederalBillsTab`): Search and sync federal legislation from Congress.gov API (v3)
- **Bill Tracking**: Track specific bills via LegiScan API with `tracked_bills` table
- **Auto-Matching**: Links candidate profiles to LegiScan legislative records using name-matching heuristics
- **PDF Viewer**: Integrated document viewer using `pdfjs-dist` for bill text
- **Voting Records**: Roll call votes displayed on candidate profiles via `congress_votes` table

### Database Tables
- `congress_bills` — Federal bill metadata (title, sponsor, status, actions)
- `tracked_bills` — User-tracked bills with LegiScan data
- `congress_votes` — Roll call vote records with member-level detail
- `congress_committees` — Committee assignments and membership

### Edge Functions
- `legiscan` — LegiScan API integration for bill search and tracking
- `congress-sync` — Congress.gov member, bill, committee, and vote sync

### Auto-Match Engine
The system automatically links candidates to legislators:
1. Strips suffixes (Jr., Sr., III)
2. Requires exact last name match
3. Requires partial first name match
4. Updates `candidate_profiles.legiscan_people_id` on confident match

---

## Section Counts

The sidebar displays the count of state legislative districts loaded. The Legislation tab count is not displayed separately but contributes to the LegHub section.

## Previous Architecture

Prior to consolidation, State Legislatures and Legislation were separate sidebar entries:
- `"state-legislative"` → `StateLegislativeSection`
- `"legislation"` → `LegislationSection`

These have been merged into the single `"leghub"` section with internal tab navigation.
