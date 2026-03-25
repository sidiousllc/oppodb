# Feature: Data Sync & External Sources

## Description

OppoDB integrates with multiple external data sources to keep its database current. These integrations are implemented as Supabase Edge Functions and allow automatic syncing of election results, district demographics, congressional data, campaign finance, and research content.

---

## Edge Functions Overview

| Edge Function | Purpose | Auth Required |
|--------------|---------|---------------|
| `sync-github` | Sync candidate profiles from GitHub | Yes (admin) |
| `census-sync` | Census Bureau ACS demographics | Yes (admin) |
| `election-results-sync` | Congressional election results | Yes (JWT) |
| `congressional-election-sync` | Congressional election data | Yes |
| `state-legislative-sync` | State legislature districts | Yes |
| `congress-sync` | Congress.gov members/bills/votes | Yes |
| `campaign-finance-sync` | FEC campaign finance | Yes |
| `opensecrets-sync` | OpenSecrets data | Yes |
| `mn-cfb-finance` | Minnesota CFB finance | Yes |
| `state-cfb-finance` | Multi-state CFB finance | Yes |
| `followthemoney` | FollowTheMoney.org API | Yes |
| `polling-sync` | Polling data sync | Yes |
| `seed-polling` | Initial polling data seeding | Yes |
| `forecast-sync` | Election forecast sync | Yes |
| `forecast-scrape` | Forecast data scraping | Yes |
| `mit-election-sync` | MIT Election Lab data | Yes |
| `legiscan` | LegiScan legislative API | Yes |
| `voter-file-sync` | Voter file import | Yes |
| `voter-lookup` | Voter registration lookup | Yes |
| `voter-registration-stats` | Registration statistics | Yes |
| `state-voter-portal-lookup` | State voter portal queries | Yes |
| `candidate-scraper` | Candidate data scraping | Yes |
| `district-intel` | District intelligence queries | Yes |
| `scheduled-sync` | Scheduled automated sync | Yes |
| `version-history` | Git version history | Yes |

---

## GitHub Content Sync

### Purpose
Candidate research profiles are stored as Markdown files in a GitHub repository and synced to the Supabase database.

### Flow
1. Research markdown files exist in a GitHub repo (e.g., `candidates/joni-ernst.md`)
2. `sync-github` edge function fetches content via GitHub API
3. Content is upserted into `candidate_profiles` table
4. `sync_metadata` table tracks last commit SHA and sync time
5. UI displays the markdown content via `CandidateDetail`

### Key Functions (Client-side)
```typescript
fetchCandidatesFromDB(): Promise<DBCandidate[]>
fetchSubpages(candidateSlug: string): Promise<GitHubCandidate[]>
```

### Version History
- `version-history` edge function fetches git commit history
- Stored in `candidate_versions` table (commit_sha, content, date, author, message)
- `VersionHistory` component shows diffs between versions

---

## Census Data Sync

### Purpose
District demographic data is synced from the U.S. Census Bureau American Community Survey (ACS) 5-Year Estimates.

### Data Points
- Population, Median income, Median age
- Education (% with bachelor's degree)
- Race/ethnicity breakdown (White, Black, Hispanic, Asian, Foreign-born)
- Poverty rate, Unemployment rate
- Housing (owner-occupied %, median home value, median rent)
- Health (uninsured %, veteran %)
- Household data (total households, avg household size)

### Sync Trigger
- Admin button in District Intel section: "Census Sync"
- Calls `census-sync` edge function
- Updates both `district_profiles` and `state_legislative_profiles` tables

---

## Congressional Data Sync (Congress.gov)

### Purpose
Syncs member profiles, bill data, committee assignments, and roll call votes from Congress.gov API.

### Tables Updated
- `congress_members` — Member profiles (bioguide_id, party, state, district, terms, leadership)
- `congress_bills` — Bill tracking (sponsor, cosponsors, status, actions, committees, subjects)
- `congress_committees` — Committee data (members, subcommittees)
- `congress_votes` — Roll call votes (member_votes, yea/nay totals, result)

### API Key
Requires `CONGRESS_GOV_API_KEY` secret.

---

## Election Results Sync

### Purpose
Historical and current congressional election results synced across all 50 states.

### Security
- **JWT Verification Enabled**: The `election-results-sync` edge function requires valid JWT
- Defense-in-depth: Both edge function JWT verification and in-code authorization checks

### Bulk Sync Process
1. Admin triggers "Sync Elections" button
2. Iterates through all 50 states with 500ms delay (rate limiting)
3. Shows real-time progress: "TX (37/50)"
4. Results stored in `congressional_election_results` table
5. State legislative results stored in `state_leg_election_results` table

---

## Campaign Finance Sync

### Federal (FEC)
- `campaign-finance-sync` edge function
- `opensecrets-sync` for OpenSecrets patterns
- Data stored in `campaign_finance` table

### State-Level
- `mn-cfb-finance` — Minnesota Campaign Finance Board
- `state-cfb-finance` — Multi-state CFB support
- `followthemoney` — FollowTheMoney.org API (requires `FOLLOWTHEMONEY_API_KEY`)
- Data stored in `mn_cfb_candidates` and `state_cfb_candidates` tables

---

## Polling Data

### Source
Multiple polling aggregators and individual pollsters.

### Sync Functions
- `polling-sync` — Automated polling data sync
- `seed-polling` — Initial data seeding with sample data

### Data Flow
- Polling data stored in `polling_data` table
- Historical and current polls available
- Refreshed via admin button in Polling section

---

## Election Forecasts

### Sources
- Cook Political Report
- 538 / Nate Silver
- Inside Elections
- Sabato's Crystal Ball
- Custom OppoDB rankings

### Sync Functions
- `forecast-sync` — Sync forecast data from multiple sources
- `forecast-scrape` — Scrape forecast data

### Tracking
- `election_forecasts` table stores current forecasts
- `election_forecast_history` table tracks rating changes over time
- `track_forecast_rating_change()` trigger automatically logs changes

---

## MIT Election Lab Data

### Source
MIT Election Data + Science Lab (https://electionlab.mit.edu/data)

### Sync
- `mit-election-sync` edge function
- Data stored in `mit_election_results` table
- Includes presidential, congressional, and state-level results
- County-level breakdowns with FIPS codes

---

## LegiScan Integration

### Purpose
Legislative bill tracking and voting record analysis.

### Features
- Bill search and tracking via `legiscan` edge function
- Tracked bills stored in `tracked_bills` table (per-user)
- Requires `LEGISCAN_API_KEY` secret

---

## Voter Data

### Edge Functions
- `voter-file-sync` — Bulk voter file import
- `voter-lookup` — Individual voter registration lookup
- `voter-registration-stats` — Aggregate registration statistics
- `state-voter-portal-lookup` — Query state-specific voter portals

---

## WinRed Webhook

### Purpose
Receives real-time donation data from WinRed platform.

### Flow
1. WinRed sends webhook POST to `winred-webhook` edge function
2. Donation data validated and stored in `winred_donations` table
3. Data includes: amount, donor info, committee, candidate

---

## Scheduled Sync

### Purpose
The `scheduled-sync` edge function provides automated periodic data synchronization.

### Security
- JWT verification required
- Admin role check enforced

---

## Data Export Functions

### Polling Export
```typescript
exportPollingCSV()  // Export to CSV
exportPollingPDF()  // Export to PDF (jsPDF)
```

### Content Export
```typescript
exportContentPDF({ title, subtitle, tag, content, section })
```

### District Export
```typescript
exportDistrictPDF(district, cookRating)
exportDistrictDetailPDF(district)
```

### State Legislative Export
```typescript
exportStateLegPDF(district)
```

### Election Export
```typescript
exportElectionData(results)
```

---

## Integration Proxy

### Purpose
The `integration-proxy` edge function provides a secure proxy for third-party API calls:
- Prevents CORS issues
- Centralizes API key management
- Adds request logging

---

## Security & Rate Limiting

### API Key Management
External API keys are stored as Supabase secrets:
- `CONGRESS_GOV_API_KEY` — Congress.gov API
- `LEGISCAN_API_KEY` — LegiScan API
- `FOLLOWTHEMONEY_API_KEY` — FollowTheMoney.org
- `OPENSTATES_API_KEY` — OpenStates API
- `GOOGLE_CIVIC_API_KEY` — Google Civic API
- `GITHUB_TOKEN` — GitHub API access
- `FIRECRAWL_API_KEY` — Firecrawl web scraping
- `INTEGRATION_ENCRYPTION_KEY` — User credential vault encryption

### Rate Limiting
- 500ms delay between bulk state syncs
- Respects external API rate limits
- Checkpointing for resumable syncs
- Error handling with partial success reporting

### SSRF Protection
URL construction in finance panels includes:
- Domain allowlisting (only `supabase.co` subdomains)
- Protocol restriction (http/https only)
- Project ID validation (alphanumeric + hyphens only)
- Safe query parameter encoding
