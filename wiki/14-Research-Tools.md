# Feature: Research Tools

## Description

The Research Tools section consolidates investigative and public-records search capabilities into a single hub within OppoDB. It provides a dashboard with quick access to subsections for voter data lookups and court records searches.

---

## Architecture

### Section Layout

The Research Tools section (`research-tools`) replaces the former standalone "Voter Data" sidebar entry. It renders a dashboard (`ResearchToolsDashboard`) with cards linking to subsections:

| Subsection | Component | Description |
|-----------|-----------|-------------|
| Voter Data | `VoterDataSection` | Voter registration lookup, live races, election history, campaign finance |
| Court Records | `CourtRecordsSearch` | U.S. court case search via JudyRecords |

### Navigation Flow

```
Sidebar: "Research Tools" → ResearchToolsDashboard
  ├── Click "Voter Data" → VoterDataSection (existing component)
  └── Click "Court Records" → CourtRecordsSearch
       └── Each subsection has "Back to Research Tools" button
```

State is managed via `researchSubsection` in `Index.tsx`:
- `null` → show dashboard
- `"voter-data"` → show VoterDataSection
- `"court-records"` → show CourtRecordsSearch

---

## Court Records Search

### Overview

The Court Records subsection provides search access to over 400 million U.S. court cases via [JudyRecords](https://www.judyrecords.com). It uses JudyRecords' public search interface — no API key is required.

### How It Works

1. User enters a search query (name, case number, company, etc.)
2. The component constructs a URL: `https://www.judyrecords.com/search?q={encoded_query}`
3. Results open in a new browser tab on judyrecords.com
4. Recent searches are tracked in component state for quick re-use

### Search Syntax

| Operator | Example | Description |
|----------|---------|-------------|
| `"exact phrase"` | `"John Smith"` | Exact name match |
| `AND` | `"Jane Doe" AND state:california` | Both conditions required |
| `OR` | `fraud OR embezzlement` | Either term matches |
| `state:` | `state:new-york` | Filter by state |
| `court:` | `court:federal` | Filter by court type |

### Court Coverage

- **Federal Courts**: U.S. District Courts, Circuit Courts of Appeal, Supreme Court
- **State Courts**: All 50 states — superior, circuit, district, and appellate courts
- **Local Courts**: County and municipal courts (coverage varies)

### Component: `CourtRecordsSearch`

```
src/components/CourtRecordsSearch.tsx
```

**Props:**
- `onBack?: () => void` — Callback to return to Research Tools dashboard

**Features:**
- Search input with Enter key support
- Example search buttons (pre-fill query)
- Search syntax reference
- Court coverage overview cards
- Recent searches list (session-only, max 10)

### Security Considerations

- No API key or server-side proxy needed — uses public judyrecords.com URL
- Links open with `noopener,noreferrer` for security
- Query input is limited to 500 characters
- URL is constructed via `encodeURIComponent()` to prevent injection

---

## Voter Data (Moved)

The Voter Data subsection was previously a top-level sidebar section. It is now accessible under Research Tools → Voter Data. The component (`VoterDataSection`) is unchanged — see [wiki/07-Additional-Features.md](07-Additional-Features.md) for full documentation.

### Features (unchanged)
- Name / Address / District voter lookup via `voter-lookup` edge function
- Live race tracking via CivicAPI
- MIT Election Lab history via `MITElectionTab`
- State finance via `FollowTheMoneyPanel`
- WinRed donation lookup via `WinRedPanel`
- Voter registration stats via `VoterStatsPanel`
- Integration with NationBuilder, VAN, WinRed (via `integration-proxy`)

---

## Components

| Component | File | Purpose |
|-----------|------|---------|
| `ResearchToolsDashboard` | `src/components/ResearchToolsDashboard.tsx` | Dashboard with tool cards |
| `CourtRecordsSearch` | `src/components/CourtRecordsSearch.tsx` | Court records search UI |
| `VoterDataSection` | `src/components/VoterDataSection.tsx` | Voter data lookup (existing) |

---

## Future Enhancements

- **JudyRecords API Integration**: When an API key is obtained from `api@judyrecords.com`, results can be displayed in-app instead of opening a new tab
- **Additional Research Tools**: Property records, business entity searches, campaign expenditure analysis
- **Saved Searches**: Persist search queries to database for recurring research workflows
