# Feature: Candidate Profiles

## Description

Candidate Profiles form the core content of OppoDB. Each profile contains opposition research on a political candidate — opposition research notes, issue positions, voting records, scandal information, and biographical data.

> **Note**: Candidate Profiles are now accessed through **[OppoHub](OppoHub)**, which consolidates Candidates (with MAGA Files sub-tab), Local Impact Reports, and Narrative Reports into a single tabbed interface.

## Supported Candidate Types

| Category | Description | Example |
|----------|-------------|---------|
| `house` | U.S. House of Representatives candidates | Ashley Hinson (IA), Eli Crane (AZ) |
| `senate` | U.S. Senate candidates | Dan Sullivan (AK), Joni Ernst (IA) |
| `governor` | Gubernatorial candidates | Doug Mastriano (PA), Joe Lombardo (NV) |
| `state` | State-level candidates | John Lujan (TX) |

## Data Model

```typescript
interface Candidate {
  name: string;       // Full display name
  slug: string;        // URL-safe identifier (e.g., "joni-ernst")
  category: "house" | "senate" | "governor" | "state";
  state: string;       // Two-letter state abbreviation
  content: string;     // Markdown research content
}
```

## Candidate Detail Page Components

When viewing a candidate profile, the following panels are loaded:

### 1. Basic Profile Header
- Candidate name and category tag
- State badge
- **PDF Export** button — generates a formatted research PDF
- **edit_file** button (admin/moderator only) — opens the markdown editor

### 2. Issue Research Subpages
Candidates can have subpages for specific issues. Each subpage:
- Has its own markdown content
- Is fetched from GitHub via `fetchSubpages()`
- Displayed as a clickable list in the candidate detail view
- Subpage titles are cleaned (removing "Rep.", "Sen.", "Gov." prefixes)

### 3. Candidate Polling Panel (`CandidatePollingPanel`)
- Shows polling data specific to this candidate
- Fetches from `polling_data` table filtered by candidate name
- Displays trend charts with approve/disapprove margins
- Source attribution with external links

### 4. Legislative Voting Record (`CandidateVotingRecord`)
- Cross-references LegiScan API for roll call votes
- Shows key votes on: immigration, healthcare, economy, abortion, guns
- Displays vote choice (Yes/No/Pass) with explanation
- Links to LegiScan for full legislative details

### 5. Congress.gov Profile (`CandidateCongressPanel`)
- Shows official Congress.gov profile data
- Committee assignments
- Sponsored legislation

### 6. Campaign Finance (`CampaignFinancePanel`)
- Total raised, total spent, cash on hand, total debt
- Funding source breakdown (individual, PAC, self-funding)
- Donor profile (small dollar vs large donor, in-state vs out-of-state)
- Top 5 donor industries with bar charts
- Top 5 individual contributors
- Source: FEC filings

### 7. State Finance (`FollowTheMoneyPanel`)
- State-level campaign finance data via FollowTheMoney.org
- Industry and individual contributor data at state level

### 8. Version History (`VersionHistory`)
- Shows git commit history for the candidate's research file
- Displays commit messages, dates, and diffs
- Pulls from GitHub repository

## Markdown Content Format

Candidate profiles are stored as Markdown with custom internal linking:

```markdown
# Joni Ernst - Biography

## Background
Born in 1970 in Ainsworth, Iowa...

## Key Issues

### [Healthcare](/joni-ernst-healthcare)
See my healthcare research page for details on her vote on AHCA.

## Voting Record
Voted [YES](/joni-ernst-immigration) on H.R. 2 (2023).

## Scandal Database
- 2021: Car accident incident...
```

### Internal Link Resolver

The `researchLinkResolver.ts` library parses internal links in format `/slug` or `/slug/subpage`:
- Extracts slug from markdown links
- Routes to subpages if available
- Opens external links in new tabs
- Handles cross-candidate navigation

## Admin Content Management

In the **Admin Panel → Candidates tab**, moderators can:
- **Create** new candidate profiles
- **edit_file** existing profiles (name, slug, content)
- **Delete** profiles
- Content is edited as raw Markdown with a monospace textarea

## Data Sources

- **Candidate profiles**: GitHub-synced markdown files via `githubSync.ts`
- **Polling data**: Seeded from538, RCP, Trafalgar, Remington, InsiderAdvantage, SoCal, Trafalgar, Quinnipiac, Emerson, Susquehanna, Datr

---

## MAGA Files Subsection

MAGA Files are accessible as the second tab within the Candidate Profiles section (previously a standalone sidebar section). They document Trump administration appointees and their backgrounds, controversies, and relevant opposition research.

### Navigation

The Candidate Profiles section uses a tab-based subsection system:

| Tab | Description |
|-----|-------------|
| 👥 Profiles | Standard candidate research profiles |
| ⚠️ MAGA Files | Trump appointee vetting reports |

### Features
- Full-text search via `searchMagaFiles()`
- Content displayed in `GenericDetail` component
- Warning emoji icon (⚠️) for visual distinction
- Tag: "MAGA File" with destructive red styling
- Internal link resolution for cross-references

See [Additional Features](Additional-Features) for the full MAGA Files data model and admin management details.
