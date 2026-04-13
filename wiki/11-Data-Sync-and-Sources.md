# Feature: Data Sync & External Sources

## Description

OppoDB integrates with multiple external data sources to keep its database current. These integrations are implemented as Supabase Edge Functions and allow automatic syncing of election results, district demographics, congressional data, campaign finance, intelligence briefings, messaging guidance, and research content.

---

## Edge Functions Overview

| Edge Function | Purpose | Auth Required |
|--------------|---------|---------------|
| `sync-github` | Sync candidate profiles from GitHub | Yes (admin) |
| `census-sync` | Census Bureau ACS demographics | Yes (admin) |
| `election-results-sync` | Congressional election results | Yes (JWT) |
| `congressional-election-sync` | Congressional election data | Yes (JWT + admin) |
| `state-legislative-sync` | State legislature districts | Yes |
| `congress-sync` | Congress.gov members/bills/votes | Yes |
| `campaign-finance-sync` | FEC campaign finance (all states, historical) | Yes (JWT + admin or service-role) |
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
| `district-news` | District-specific news via RSS proxy | No |
| `intel-briefing` | Intelligence briefings from 90+ RSS feeds | Yes |
| `messaging-sync` | Messaging guidance from 30+ scrapers | Yes |
| `scheduled-sync` | Scheduled automated sync (daily 3 AM UTC) | Yes |
| `version-history` | Git version history | Yes (JWT + admin) |
| `prediction-markets-sync` | Polymarket, Kalshi, PredictIt, Manifold, Metaculus | Yes |
| `market-trading` | User trading proxy (portfolio, orders, trade) | Yes (JWT) |
| `civic-api-proxy` | Proxy for CivicAPI.org (Live Elections) | No |
| `winred-webhook` | WinRed donation webhook receiver | HMAC signature |
| `scrape-article` | Full article text extraction via Firecrawl | Yes |

---

## Campaign Finance Sync

### Federal (FEC) — `campaign-finance-sync`

The primary FEC sync function supports bulk and historical syncing:

| Parameter | Description |
|-----------|-------------|
| `state` | Single state abbreviation or `ALL` for all 50 states |
| `cycle` | Single cycle year (default: 2024, 2026) |
| `historical` | `true` to sync all cycles 2012–2026 |

**Key features**:
- Processes House and Senate candidates per state
- Paginates up to 5 pages per office type
- 400ms delay between pages, 500ms between state/cycle combos
- Generates per-state aggregate rows
- Upserts in batches of 50 with individual fallback
- Accepts both admin JWT and service-role tokens

### OpenSecrets — `opensecrets-sync`

Enriches FEC data with industry/contributor breakdowns:
- `candSummary`, `candIndustry`, `candContrib` API calls
- Rate limited: 500ms between calls (200 calls/day free tier)
- Requires `OPENSECRETS_API_KEY`

### State-Level
- `mn-cfb-finance` — Minnesota Campaign Finance Board
- `state-cfb-finance` — Multi-state CFB support (PA, MI, etc.)
- `followthemoney` — FollowTheMoney.org API (requires `FOLLOWTHEMONEY_API_KEY`)

---

## Intelligence Briefings — `intel-briefing`

Aggregates news from 90+ RSS/Atom sources across 4 scopes:
- **International**: DW, France 24, Al Jazeera, SCMP, BBC World, Reuters
- **National**: WaPo, Punchbowl, ProPublica, Politico, The Hill, NPR, AP, Axios, Vox, NRO, The Federalist, Reason
- **State**: Kaiser Health, The 19th, Stateline, Route Fifty, Ballotpedia
- **Local**: Strong Towns, NLC, ICMA, CityLab, Next City, Governing

**Processing**: Parallelized in batches of 10, automated category detection (economy, health, immigration, etc.), deduplication by title.

---

## Messaging Guidance — `messaging-sync`

Scrapes messaging research from 30+ organizations using Firecrawl:

| Organization | Type |
|-------------|------|
| Navigator Research | Democrat |
| Center for American Progress (CAP) | Democrat |
| Third Way | Democrat |
| Data for Progress | Democrat |
| American Enterprise Institute (AEI) | Republican |
| Heritage Foundation | Republican |
| Brookings Institution | Nonpartisan |
| Bipartisan Policy Center | Nonpartisan |
| And 20+ more | Various |

**Features**:
- `makeSearchScraper` factory for consistent scraper creation
- 40+ keyword issue area detection (immigration, tariffs, healthcare, economy, etc.)
- Party affiliation tagging (Democrat, Republican, Independent)
- Upsert by slug to prevent duplicates

---

## Scheduled Sync — `scheduled-sync`

Daily automated sync at 3:00 AM UTC processing data in batches:

| Step | Function | Batch Size | Notes |
|------|----------|------------|-------|
| 1 | `sync-github` | Full | All candidate profiles |
| 2 | `election-results-sync` | 5 states | Checkpoint: sync_metadata id=2 |
| 3 | `congressional-election-sync` | 5 states | Checkpoint: sync_metadata id=3 |
| 4 | `campaign-finance-sync` | 5 states | Checkpoint: id=4; historical on offset=0 |
| 5 | `mn-cfb-finance` + `state-cfb-finance` | MN, PA, MI | State-level CFB |
| 6 | `prediction-markets-sync` | Full | All 5 platforms |
| 7 | `candidate-scraper` | 5 candidates | Checkpoint: id=5; auto-discovery |

**Security**: JWT signature verification, admin/moderator role for manual triggers, service-role for cron.

---

## Security & Authentication

### JWT Verification
All sync functions use signature-verified JWT authentication:
- Service-role tokens compared against `SUPABASE_SERVICE_ROLE_KEY`
- User tokens validated via `supabase.auth.getUser()`
- Admin role verified via `has_role()` RPC
- The previous `parseJwtClaims()` (base64-only) was replaced in March 2026

### CORS Configuration
Sync functions use trusted-origin CORS:
- `oppodb.com`, `db.oppodb.com`, `ordb.lovable.app`
- `*.lovableproject.com`, `*.lovable.app`
- `localhost:5173`, `localhost:3000`

### API Key Management
External API keys stored as Supabase secrets:
- `CONGRESS_GOV_API_KEY`, `LEGISCAN_API_KEY`, `FOLLOWTHEMONEY_API_KEY`
- `OPENSTATES_API_KEY`, `GOOGLE_CIVIC_API_KEY`, `GITHUB_TOKEN`
- `FIRECRAWL_API_KEY`, `INTEGRATION_ENCRYPTION_KEY`
- `OPENSECRETS_API_KEY`, `ELEVENLABS_API_KEY`

### SSRF Protection
URL construction in finance panels includes domain allowlisting, protocol restriction, project ID validation, and safe query parameter encoding.

### Rate Limiting
- 400-500ms delays between API calls
- Batch checkpointing for resumable syncs
- Partial success reporting with error arrays
