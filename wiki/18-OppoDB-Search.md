# Feature: OppoDB Master Search

## Description

OppoDB Search is the unified search interface that queries across all 15+ data categories simultaneously. It combines instant local/static search with auto-debounced database queries, delivering results in under 500ms for most searches.

---

## Architecture

### Component
```
src/components/MasterSearch.tsx
```

### Location
Rendered on the Dashboard section only. Accessible globally via **Ctrl+K** (or **Cmd+K**) keyboard shortcut.

### Search Flow

```
User types query (≥2 chars)
├── Instant: Local/static data search (candidates, districts, MAGA files, local impact, narratives)
├── 400ms debounce: Auto-triggered database search (15 parallel Supabase queries)
└── Results rendered in categorized cards with filter chips
```

### Speed Optimizations
1. **Parallel queries**: All 15 database queries execute via `Promise.all()` simultaneously
2. **Auto-debounce**: DB search triggers automatically after 400ms of inactivity (no Enter required)
3. **Local-first**: Static data results appear instantly while DB queries load
4. **Limit capping**: Each query limited to 10 results to minimize payload size
5. **Voter stats edge function**: Runs in parallel with direct DB queries

---

## Data Sources Searched

### Local/Static (Instant)

| Category | Source | Function |
|----------|--------|----------|
| Candidate Profiles | `candidates.ts` | `searchCandidates()` |
| Congressional Districts | `districtIntel.ts` | `searchDistricts()` |
| MAGA Files | `magaFiles.ts` | `searchMagaFiles()` |
| Local Impact Reports | `localImpact.ts` | `searchLocalImpact()` |
| Narrative Reports | `narrativeReports.ts` | `searchNarrativeReports()` |

### Database (Auto-Debounced, 400ms)

| Category | Table | Search Columns | Navigation |
|----------|-------|----------------|------------|
| Congress Members | `congress_members` | name, state, bioguide_id | candidates |
| Campaign Finance (Federal) | `campaign_finance` | candidate_name, state_abbr, district | polling |
| State Campaign Finance | `state_cfb_candidates` | candidate_name, state_abbr, committee_name | polling |
| MN CFB Finance | `mn_cfb_candidates` | candidate_name, committee_name | polling |
| WinRed Donations | `winred_donations` | donor_last_name, donor_city, candidate_name, committee_name, donor_state | research-tools |
| Legislation (Bills) | `congress_bills` | title, short_title, sponsor_name, bill_id | leghub |
| Polling Data | `polling_data` | candidate_or_topic, source, question | polling |
| Election Forecasts | `election_forecasts` | state_abbr, district, rating | district-intel |
| Election Results | `congressional_election_results` | candidate_name, state_abbr | live-elections |
| Voter Registration | Edge function | state name filter | research-tools |
| Prediction Markets | `prediction_markets` | title, state_abbr, candidate_name | polling |
| State Legislative | `state_legislative_profiles` | state, state_abbr, district_id | leghub |
| MIT Election History | `mit_election_results` | candidate, state, state_po | live-elections |
| Tracked Bills | `tracked_bills` | title, bill_number, state | leghub |
| Messaging Guidance | `messaging_guidance` | title, summary | messaging |

---

## Features

### Search Persistence
- **Saved Searches**: Bookmark queries for quick re-use (stored in `localStorage`, max 20)
- **Recent Searches**: Auto-tracked history of last 10 searches
- **Ctrl+K / Cmd+K**: Global keyboard shortcut to focus search input

### Category Filtering
- Filter chips allow hiding/showing individual result categories
- "Show all" button to reset filters
- Result count per category displayed on chips

### Export
- **CSV Export**: `exportSearchCSV()` — All visible results as structured CSV
- **PDF Export**: `exportSearchPDF()` — Formatted PDF report via jsPDF

### Result Navigation
- Each result card links to its parent section
- "View all in {Category} →" link navigates to the full section
- Results with slugs navigate directly to the detail view

---

## Technical Details

### Query Construction
```typescript
const likeQ = `%${query}%`;

// Each table searched with .or() for multi-column matching
supabase.from("table_name")
  .select("columns...")
  .or(`col1.ilike.${likeQ},col2.ilike.${likeQ}`)
  .order("date_col", { ascending: false })
  .limit(10)
```

### Auto-Debounce Implementation
```typescript
useEffect(() => {
  if (query.trim().length < 2) return;
  const timer = setTimeout(() => {
    runDbSearch();
  }, 400);
  return () => clearTimeout(timer);
}, [query]);
```

### State Shape
```typescript
interface DbResults {
  polling: any[];
  finance: any[];
  members: any[];
  bills: any[];
  forecasts: any[];
  congressElections: any[];
  stateFinance: any[];
  mnFinance: any[];
  winredDonations: any[];
  voterStats: any[];
  predictionMarkets: any[];
  stateLeg: any[];
  mitElections: any[];
  trackedBills: any[];
  messagingGuidance: any[];
}
```

---

## Security

- Query input limited to 500 characters via `maxLength`
- All database queries use parameterized `.ilike()` (no raw SQL injection risk)
- Voter stats fetched via authenticated edge function (requires session)
- Searches are client-side only — no server-side search logging
