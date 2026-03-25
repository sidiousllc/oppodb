# Feature: Data Sync & External Sources

## Description

OppoDB integrates with multiple external data sources to keep its database current. These integrations allow automatic syncing of election results, district demographics, and research content from GitHub.

---

## GitHub Content Sync

### Purpose
Candidate research profiles are stored as Markdown files in a GitHub repository and synced to the Supabase database.

### Flow
1. Research markdown files exist in a GitHub repo (e.g., `candidates/joni-ernst.md`)
2. `githubSync.ts` provides functions to fetch and sync this content
3. Content is loaded into `candidates` table in Supabase
4. UI displays the markdown content via `CandidateDetail`

### Key Functions

```typescript
// Fetch all candidates from Supabase
fetchCandidatesFromDB(): Promise<DBCandidate[]>

// Sync from GitHub
syncFromGitHub(): Promise<SyncResult>

// Fetch subpages for a candidate
fetchSubpages(candidateSlug: string): Promise<GitHubCandidate[]>

// Initialize candidates from GitHub data
initCandidates(candidates: CandidateInit[]): void
```

### Content Structure
```
candidates/
  joni-ernst.md           # Main profile
  joni-ernst-healthcare.md  # Issue subpage
  joni-ernst-immigration.md # Issue subpage
```

### Version History
Each candidate profile shows its Git commit history:
- Commit messages
- Dates
- Diff vs current content
- Allows tracking research evolution

---

## Census Data Sync

### Purpose
District demographic data is synced from the U.S. Census Bureau American Community Survey (ACS).

### Data Points
- Population
- Median income
- Median age
- Education (% with bachelor's degree)
- Race/ethnicity breakdown
- Foreign-born population
- Poverty rate
- Unemployment rate
- Housing (owner-occupied %, median home value, median rent)
- Health (uninsured %, veteran %)

### Sync Trigger
- Admin button in District Intel section: "Census Sync"
- Calls `syncCensusData()` in `districtIntel.ts`
- Updates `district_profiles` table in Supabase

---

## Congressional Election Results Sync

### Purpose
Historical and current congressional election results are synced across all 50 states.

### Security
- **JWT Verification Enabled**: The `election-results-sync` edge function requires valid JWT authentication
- Defense-in-depth: Both edge function JWT verification and in-code authorization checks

### Source
OpenElections API (https://openelections.net)

### Sync Process
1. `syncCongressionalElections(state)` is called per state
2. Fetches results for all House/Senate races
3. Stores in `election_results` table
4. Progress shown: "AL (1/50), AK (2/50)..."

### Bulk Sync
Admin can trigger bulk sync via "Sync Elections" button:
- Iterates through all 50 states
- 500ms delay between states (rate limiting)
- Shows real-time progress: "TX (37/50)"
- Final confirmation: "Done — 847 results synced"

### State-by-State Sync
Individual state syncs available via `handleStateLegSync(stateAbbr, chamber)` for targeted updates.

---

## State Legislative Data Sync

### Purpose
State legislature district data synced for all 50 states.

### Sync Function
```typescript
syncStateLegislativeData(stateAbbr?: string, chamber?: string): Promise<SyncResult>
```

### Capabilities
- Sync all states (no arguments)
- Sync specific state (`syncStateLegislativeData("MN")`)
- Sync specific chamber (`syncStateLegislativeData("MN", "senate")`)
- Shows loading state during sync

---

## Polling Data

### Source
Multiple polling aggregators and individual pollsters:
- 538 (Nate Silver's model)
- RealClearPolitics (RCP)
- Individual pollsters: Trafalgar, Remington, Quinnipiac, Emerson, etc.

### Data Flow
- Polling data seeded into `polling_data` table
- Refreshed via admin button in Polling section
- Historical and current polls available

### Poll Types
- Presidential approval
- Generic congressional ballot
- Candidate head-to-head
- Issue polling
- Favorability

---

## Cook Political Report Integration

### Ratings
Cook Political Report ratings stored in `cookRatings.ts`:
- Solid D, Likely D, Lean D
- Tossup
- Lean R, Likely R, Solid R
- Safe D, Safe R (alternate terminology)

### Rating Order
```typescript
COOK_RATING_ORDER = [
  "Solid D", "Likely D", "Lean D",
  "Tossup",
  "Lean R", "Likely R", "Solid R"
]
```

### Color Mapping
Each rating maps to a specific HSL color for consistent visualization.

### PVI (Partisan Voting Index)
Cook PVI values stored for each district:
- Shows partisan lean (e.g., "R+5", "D+3")
- Used in district filtering and map coloring

---

## MIT Election Lab Data

### Source
MIT Election Data + Science Lab (https://electionlab.mit.edu/data)

### Use
Historical election results for district-level analysis:
- Presidential results by district
- Historical turnout trends
- Partisan swing patterns

---

## OpenElections

### Source
OpenElections (https://openelections.net)

### Use
Raw election results for:
- Congressional races (House, Senate)
- Governor races
- State legislative races (where available)

---

## Data Export Functions

### Polling Export
```typescript
exportPollingCSV()  // Export to CSV
exportPollingPDF()  // Export to PDF
```

### Content Export
```typescript
exportContentPDF({ title, subtitle, tag, content, section })
```

### District Export
```typescript
exportDistrictPDF(district, cookRating)
```

### State Legislative Export
```typescript
exportStateLegPDF(district)
```

---

## Supabase Realtime

OppoDB uses Supabase Realtime for live data subscriptions where appropriate:
- Real-time polling updates (future)
- Live election result updates (future)
- Collaborative research notes (future)

---

## Security & Rate Limiting

### GitHub Rate Limits
- GitHub API has rate limits (5000 requests/hour for authenticated)
- Content sync respects rate limits
- Uses cached data when possible

### External API Rate Limits
- OpenElections: No explicit rate limit, polite usage
- Census Bureau: Public API, no auth required
- MIT Election Lab: Public data, polite scraping

### Sync Best Practices
- Delay between bulk operations (500ms)
- Checkpointing for resumable syncs
- Error handling with partial success reporting
