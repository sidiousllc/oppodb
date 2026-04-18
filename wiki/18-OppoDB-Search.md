# Feature: OppoDB Master Search

## Description

OppoDB Search is the unified search interface that queries across **48+ data categories** simultaneously. The same catalog is mirrored in the **public-api `/search` endpoint** and the **MCP `master_search` tool**, giving programmatic and AI-agent clients identical coverage to the in-app experience.

---

## Architecture

### Surfaces
| Surface | Entry point |
|---|---|
| In-app UI | `src/components/MasterSearch.tsx` (Dashboard, Ctrl/Cmd+K) |
| REST API  | `GET /functions/v1/public-api/search?search=…&categories=…&limit=…` |
| MCP tool  | `master_search({ search, categories?, limit? })` |

### Search Flow

```
User types query (≥2 chars)
├── Instant: Local/static data search (candidates, districts, MAGA files, local impact, narratives)
├── 400ms debounce: Auto-triggered database search (48 parallel Supabase queries)
└── Results rendered in categorized cards with filter chips
```

### Speed & Resilience
1. **Parallel queries**: All 48 category queries fire via `Promise.all()` simultaneously
2. **Per-query isolation**: A `safe()` wrapper catches per-category failures so one bad table can't blank the result set
3. **Auto-debounce**: DB search triggers automatically after 400ms of inactivity
4. **Local-first**: Static data results appear instantly while DB queries load
5. **Limit capping**: Each query limited to **20 results** (was 10) to balance coverage and payload size
6. **RLS auto-scoping**: User-owned categories (notes, war rooms, reports, trackers, watchlist, stakeholders, AI caches) are silently filtered to what the caller can see — no extra auth code needed

---

## Categories (48 total)

**Core records (23)** — candidates, congress_members, bills, polling, campaign_finance, state_finance, election_results, forecasts, maga_files, narrative_reports, local_impacts, voter_stats, mn_finance, prediction_markets, messaging_guidance, intel_briefings, tracked_bills, mit_elections, congress_committees, congress_votes, state_leg_elections, forecast_history, international_profiles

**Public records & investigations (12)** — court_cases, fara_registrants, federal_spending, lobbying_disclosures, gov_contracts, ig_reports, congressional_record, district_profiles, election_night_streams, state_legislators, state_legislative_bills, polling_aggregates

**International extras (4)** — international_elections, international_leaders, international_legislation, international_polling

**Knowledge & collaboration (7, RLS-scoped)** — wiki_pages, war_rooms, stakeholders, entity_notes, reports, oppo_trackers, watchlist_items

**AI cache (6)** — vulnerability_scores, talking_points, bill_impact_analyses, subject_impact_analyses, messaging_audience_analyses, messaging_impact_analyses

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
