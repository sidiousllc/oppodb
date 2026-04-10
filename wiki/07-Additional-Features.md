# Feature: Additional Sections

## Description

OppoDB includes several additional content sections beyond the main hubs (OppoHub, DataHub, LegHub, MessagingHub). These sections provide supplementary research data, communication tools, and export capabilities.

> **Note**: Candidate Profiles, Local Impact Reports, and Narrative Reports have been consolidated into **[OppoHub](OppoHub)**. MAGA Files are accessible as a sub-tab within OppoHub's Candidates tab. Messaging Guidance is now in **[MessagingHub](MessagingHub)**.

---

## MAGA Files (Subsection of Candidate Profiles)

### Description
MAGA Files document Trump administration appointees and their backgrounds, controversies, and relevant opposition research. They are now accessible as a subsection tab within the **Candidate Profiles** section (previously a standalone sidebar section).

### Data Model
```typescript
interface MagaFile {
  slug: string;
  name: string;
  content: string;   // Markdown research content
  tags: string[];    // Categorization tags (e.g., "Cabinet", "Appointee")
}
```

### Features
- Full-text search via `searchMagaFiles()`
- Content displayed in `GenericDetail` component
- Warning emoji icon (⚠️) for visual distinction
- Tag: "MAGA File" with destructive red styling
- Internal link resolution for cross-references
- **Tags**: Editable via admin panel, stored as PostgreSQL text array with GIN index

### Admin Management
In **Admin Panel → MAGA Files tab**, moderators can:
- Create new MAGA files
- Edit name, slug, tags, and content
- Delete existing files

---

## Local Impact Reports

### Description
State-level reports on the local impact of political decisions, policies, or trends. Organized by state.

### Data Model
```typescript
interface LocalImpact {
  slug: string;
  state: string;      // Full state name
  summary: string;   // Brief description
  content: string;   // Markdown report
  tags: string[];    // Categorization tags (e.g., "Economy", "Infrastructure")
}
```

### Features
- Search by state or content
- Globe emoji icon (🌐) 
- Summary displayed on list cards
- Full report in detail view
- **Tags**: Editable via admin panel, stored as PostgreSQL text array with GIN index

### Admin Management
In **Admin Panel → Local Impact tab**, moderators can:
- Create new reports
- Edit state, slug, summary, tags, and content
- Delete reports

---

## Narrative Reports

### Description
Thematic narrative reports covering specific topics or storylines in political research.

### Data Model
```typescript
interface NarrativeReport {
  slug: string;
  name: string;
  content: string;   // Markdown report
  tags: string[];    // Categorization tags (e.g., "Immigration", "Budget")
}
```

### Features
- Search by name or content
- Document emoji icon (📄)
- Senate-colored tag
- Used for long-form research narratives
- **Tags**: Editable via admin panel, stored as PostgreSQL text array with GIN index

### Admin Management
In **Admin Panel → Narratives tab**, moderators can:
- Create new narrative reports
- Edit name, slug, tags, and content
- Delete reports

---

## Voter Data (`VoterDataSection`)

### Description
Voter data analysis and registration statistics.

### Features
- Registration statistics by state
- Demographic breakdowns of voter rolls
- Historical voter turnout trends
- Party registration data where available
- Voter lookup via `voter-lookup` and `state-voter-portal-lookup` edge functions

---

## Live Elections (`LiveElectionsSection`)

### Description
Real-time election results and returns for ongoing elections.

### Features
- Live vote count updates
- Race call projections
- County-level results
- Turnout indicators
- Comparison to previous cycles

---

## Legislation (Now in LegHub)

### Description
Legislation tracking has been consolidated into the **LegHub** section alongside State Legislatures. See [LegHub](LegHub) for full documentation.

### Features
- **Federal Bills Tab** (`FederalBillsTab`): Congress.gov bill tracking via `congress_bills` table
- **Bill Tracking**: Users can track specific bills via `tracked_bills` table (LegiScan integration)
- **Auto-Matching**: Links candidate profiles to LegiScan records using name heuristics
- **PDF Viewer**: Integrated document viewer for bill text via `pdfjs-dist`
- Bill sponsorship lookup
- Key vote tracking
- Legislative scorecards
- Links to full bill text and status

---

## In-App Communication

### AOL Mail System (`AOLMailWindow` + `MailContext`)
Functional in-app mail system simulating AOL Mail:
- **Compose**: Send messages to other OppoDB users
- **Inbox**: View received messages with read/unread status
- **Sent Mail**: View sent messages
- **Delete**: Soft-delete (per-user: `deleted_by_sender` / `deleted_by_recipient`)
- **Email Notifications**: Sends real email to recipient via `send-mail-notification` edge function
- **Real-time**: Messages stored in `user_mail` table

### Chat / Instant Messaging (`ChatPanel`)
Real-time chat between users:
- Messages stored in `chat_messages` table
- Read receipts via `read_at` timestamp
- Real-time updates via Supabase Realtime

### Buddy List (`AOLBuddyList`)
AIM-style buddy list with real presence tracking:
- Online/Away/Offline status via `user_presence` table
- Heartbeat-based presence updates
- Click to start IM conversation

---

## Email Notification Pipeline

### Architecture
In-app mail triggers real email notifications through a standardized pipeline:

1. **`send-mail-notification`** edge function:
   - Authenticates the sender via JWT
   - Looks up recipient email via service role
   - Gets sender display name from `profiles` table
   - Generates unique idempotency key
   - Routes through `send-transactional-email`

2. **`send-transactional-email`** edge function:
   - Renders React email template (`mail-notification` template)
   - Checks suppression list
   - Generates unsubscribe token
   - Enqueues to pgmq email queue

3. **`process-email-queue`** edge function:
   - Reads batch from pgmq queue
   - Sends via Resend API
   - Logs delivery status
   - Moves failures to dead letter queue

### Email Templates
Templates are React components in `supabase/functions/_shared/transactional-email-templates/`:
- `welcome.tsx` — Welcome email for new users
- `access-approved.tsx` — Access request approved
- `access-denied.tsx` — Access request denied
- `invite-link.tsx` — Invitation email
- `mail-notification.tsx` — In-app mail notification

---

## Dashboard (`Dashboard`)

### Description
The landing page when users log in, providing an overview of the entire database.

### Features
- Total candidate count
- Total district count
- Quick navigation to each section
- Recent activity or updates
- Key statistics

---

## Documentation Wiki (`DocumentationSection`)

### Description
An in-app documentation reader that provides access to all OppoDB wiki documentation directly within the application. Documentation can be managed from the Admin Panel.

### Features
- **Table of Contents Index**: Grid view of all documentation pages with numbered entries
- **Search**: Filter documentation pages by title
- **Database-Backed Content**: Wiki pages can be stored in the `wiki_pages` database table, overriding static files
- **Static File Fallback**: If no DB entry exists for a page, the static markdown file from `wiki/` is loaded via Vite raw imports
- **Lazy Loading**: Content loaded on-demand (DB fetch or dynamic import)
- **Markdown Rendering**: Full markdown support with Win98-styled components (tables, code blocks, blockquotes)
- **Breadcrumb Navigation**: Shows current location within documentation hierarchy
- **Quick Page Navigation**: Bottom nav allows jumping to other documentation pages without returning to index
- **Draft Support**: Unpublished pages are only visible to admins/moderators
- **Integration**: Accessible from sidebar navigation and mobile nav

### Content Resolution Strategy
```
1. On mount, fetch all published wiki_pages from database
2. Merge with static page list (DB pages override by slug match)
3. DB-only pages (not in static list) are appended
4. On page select:
   a. If DB has content for slug → use DB content
   b. Else → lazy-load static file via Vite raw import
   c. Else → show "Page Not Found"
```

### Admin Management
In **Admin Panel → Documentation tab**, moderators and admins can:
- Create new wiki pages with title, slug, content, sort order, and published flag
- Edit existing pages (markdown editor with monospace font)
- Delete pages (admin only)
- Toggle published/draft status
- Reorder pages via sort_order field

### Database Table: `wiki_pages`
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `slug` | text (unique) | URL identifier matching static page slugs |
| `title` | text | Display title |
| `content` | text | Full markdown content |
| `sort_order` | integer | Controls display ordering |
| `published` | boolean | Visibility to non-admin users |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last modification |

### Wiki Sections (20+ pages)
1. Overview
2. Candidate Profiles
3. District Intelligence
4. Polling Data
5. Campaign Finance
6. State Legislative Districts
7. Additional Features
8. Authentication & User Management
9. API Access
10. UI Design System
11. Data Sync & Sources
12. Cook Ratings & Forecasting
13. Admin Panel
14. Research Tools
15. Android App
16. Prediction Market Trading
17. LegHub
18. OppoDB Search
19. OppoHub
20. MessagingHub
+ Any additional pages created via Admin Panel

---

## Search

### OppoDB Master Search (`MasterSearch`)
The unified master search interface on the Dashboard, querying across **14+ data categories** simultaneously:
- **Instant local search**: Candidates, districts, MAGA files, local impact, narratives
- **Auto-debounced DB search (400ms)**: Polling, finance (federal + state + MN), Congress members, bills, forecasts, election results, prediction markets, state legislative districts, MIT election history, tracked bills, WinRed donations, voter stats
- All 14 DB queries execute in parallel via `Promise.all()`
- Category filter chips, saved/recent searches, CSV/PDF export
- Global Ctrl+K / Cmd+K shortcut
- See [OppoDB Search](OppoDB-Search) for full technical documentation

### Section Search (`SearchBar`)
A contextual search bar available within individual sections:
- Searches candidates, districts, MAGA files, local impact reports, and narratives
- Auto-complete suggestions as user types
- Navigates directly to search result

### Cross-Section Navigation
The `researchLinkResolver.ts` system allows content in any section to link to any other section via structured link extraction. The enhanced `extractInternalLink()` function returns slug, parent slug, and all path segments, enabling:
- Direct subpage navigation (e.g., `/andy-ogles/health-care-backup`)
- Parent candidate resolution for orphaned subpage slugs
- Internal host recognition (e.g., `research-books.com`)
- Fallback to external URL opening for non-matching links

---

## Integration Settings (`IntegrationSettings`)

### Description
User-configurable third-party API key management:
- Store API keys for external services (encrypted in `user_integrations` table)
- Managed via `credential-vault` edge function with AES encryption
- Supports: LegiScan, FollowTheMoney, OpenStates, Congress.gov, and more

---

## Prediction Market Trading (`MarketTradingPanel`)

### Description
Users can connect their prediction market accounts and trade directly from OppoDB:
- **Supported Platforms**: Kalshi, Polymarket, PredictIt
- **Credential Storage**: AES-256-GCM encrypted in `user_market_credentials` table
- **Credential Management**: Add/remove API keys per platform via `MarketCredentialsManager` (Profile page)
- **Trading Features**: View portfolio positions, manage open orders, place buy/sell orders
- **Edge Function**: `market-trading` handles all credential decryption and API proxying server-side
- **Security**: Credentials never returned to client; RLS ensures user isolation

See [Prediction Market Trading](Prediction-Market-Trading) for full technical documentation.

---

## WinRed Donations (`WinRedPanel`)

### Description
Tracks WinRed donation data received via webhook:
- Donation amounts and donor information
- Committee/candidate attribution
- Stored in `winred_donations` table
- Webhook endpoint: `winred-webhook` edge function

---

## PDF Export

### `exportContentPDF()`
Generic PDF export for any content section (candidates, MAGA files, narratives, local impact).

### `exportDistrictPDF()`
District-specific PDF export including all district metrics.

### `exportPollingPDF()`
Polling data PDF export.

### `exportStateLegPDF()`
State legislative district PDF export.

All exports use jsPDF + jspdf-autotable for formatted document generation.

---

## CSV Export

### `exportPollingCSV()`
Exports polling data to CSV format for spreadsheet analysis.

---

## GitHub Content Sync

The `githubSync.ts` module syncs candidate profiles from a GitHub repository:

### Content Structure
```
candidates/{slug}.md          # Main profile
candidates/{slug}-{topic}.md  # Issue subpages
```

### Version History
The `VersionHistory` component shows git commit history:
- Commit messages, dates, and diffs
- Powered by `version-history` edge function
- Data stored in `candidate_versions` table
