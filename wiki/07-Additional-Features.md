# Feature: Additional Sections

## Description

OppoDB includes several additional content sections beyond candidate profiles, district intelligence, polling, and campaign finance. These sections provide supplementary research data.

---

## MAGA Files

### Description
MAGA Files document Trump administration appointees and their backgrounds, controversies, and relevant opposition research.

### Data Model
```typescript
interface MagaFile {
  slug: string;
  name: string;
  content: string;   // Markdown research content
}
```

### Features
- Full-text search via `searchMagaFiles()`
- Content displayed in `GenericDetail` component
- Warning emoji icon (⚠️) for visual distinction
- Tag: "MAGA File" with destructive red styling
- Internal link resolution for cross-references

### Admin Management
In **Admin Panel → MAGA Files tab**, moderators can:
- Create new MAGA files
- Edit name, slug, and content
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
}
```

### Features
- Search by state or content
- Globe emoji icon (🌐) 
- Summary displayed on list cards
- Full report in detail view

### Admin Management
In **Admin Panel → Local Impact tab**, moderators can:
- Create new reports
- Edit state, slug, summary, and content
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
}
```

### Features
- Search by name or content
- Document emoji icon (📄)
- Senate-colored tag
- Used for long-form research narratives

### Admin Management
In **Admin Panel → Narratives tab**, moderators can:
- Create new narrative reports
- Edit name, slug, and content
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

## Legislation (`LegislationSection`)

### Description
Tracks legislation relevant to tracked candidates and districts.

### Features
- Bill sponsorship lookup
- Key vote tracking
- Legislative scorecards
- Links to full bill text and status

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

## Search

### Global Search (`SearchBar`)

A unified search bar available across all sections:
- Searches candidates, districts, MAGA files, local impact reports, and narratives simultaneously
- Auto-complete suggestions as user types
- Navigates directly to search result
- Used in district filter context for quick district lookup

### Cross-Section Navigation
The `researchLinkResolver.ts` system allows content in any section to link to any other section via slug resolution:
```
/joni-ernst → Candidate profile
/ia-01 → District profile
/tx-14 → State legislative district
```

---

## Generic Card & Detail Components

### `GenericCard`
Reusable card component for displaying list items:
- Icon (emoji or component)
- Title
- Optional tag/badge
- Preview text (first non-empty line of content)
- Click handler

### `GenericDetail`
Reusable detail view for content types:
- Header with icon, title, subtitle, tag
- Markdown-rendered content
- Back button
- Internal link navigation
- PDF export capability

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

All exports use browser print / PDF generation to create formatted documents.

---

## CSV Export

### `exportPollingCSV()`
Exports polling data to CSV format for spreadsheet analysis.

---

## GitHub Content Sync

The `githubSync.ts` module syncs candidate profiles from a GitHub repository:

### `fetchCandidatesFromDB()`
Loads all candidates from Supabase.

### `fetchSubpages(candidateSlug)`
Loads subpages (issue research pages) for a specific candidate.

### Content Structure
GitHub markdown files organized as:
```
candidates/{slug}.md          # Main profile
candidates/{slug}-{topic}.md  # Issue subpages
```

Each file contains markdown research content that is loaded into Supabase and displayed in the app.

### Version History

The `VersionHistory` component shows git commit history for research files:
- Commit messages
- Commit dates
- File diffs (added/removed lines)
- Shows the current content vs previous versions
