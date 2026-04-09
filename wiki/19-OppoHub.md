# Feature: OppoHub

## Description

OppoHub is a consolidated opposition research hub that unifies three previously separate sidebar sections — **Candidate Profiles**, **Local Impact Reports**, and **Narrative Reports** — into a single tabbed interface. This consolidation reduces sidebar clutter while maintaining full access to all opposition research content types.

---

## Navigation Structure

OppoHub uses a two-level tab system:

### Top-Level Tabs

| Tab | Emoji | Description | Count Source |
|-----|-------|-------------|--------------|
| Candidates | 👥 | Candidate profiles + MAGA Files | `candidates.length + magaFiles.length` |
| Local Impact | 🌐 | State-level impact reports | `localImpactReports.length` |
| Narratives | 📄 | Thematic narrative reports | `narrativeReports.length` |

### Candidates Sub-Tabs

Within the Candidates tab, a secondary tab row provides:

| Sub-Tab | Emoji | Description |
|---------|-------|-------------|
| Profiles | 👥 | Standard candidate research profiles |
| MAGA Files | ⚠️ | Trump appointee vetting reports |

The Profiles sub-tab also includes race type filter buttons (`All`, `House`, `Senate`, `Gov`, `State`) managed by the parent `Index.tsx` filter state.

---

## Component Architecture

### `OppoHub.tsx`

```typescript
interface OppoHubProps {
  search: string;           // Current search query from parent
  filter: FilterCategory;   // Race type filter (all, house, senate, governor, state)
  dataVersion: number;      // Data refresh trigger
  isAdmin: boolean;         // Admin role flag
  onSelectSlug: (slug: string | null) => void;  // Detail navigation
  selectedSlug: string | null;                   // Currently selected item
  onNavigateSlug: (slug: string) => boolean;     // Cross-section slug navigation
  onEditCandidate?: (slug: string) => void;      // Admin edit handler
  onCreateCandidate?: () => void;                // Admin create handler
  onSetSection: (section: string) => void;       // Section navigation
}
```

### State Management

OppoHub manages its own tab state internally:
- `tab: "candidates" | "local-impact" | "narratives"` — Active top-level tab
- `candidateSub: "profiles" | "maga-files"` — Active candidates sub-tab

When switching tabs, the selected slug is cleared to prevent stale detail views.

### Detail View Delegation

OppoHub renders detail views inline using existing components:
- **CandidateDetail** — Full candidate profile with polls, finance, voting record
- **GenericDetail** — Renders MAGA files, local impact, and narrative reports

Each detail view includes a back button that clears `selectedSlug`.

---

## Data Flow

```
Index.tsx
  └─ OppoHub
       ├─ searchCandidates(search)     → filteredCandidates
       ├─ searchMagaFiles(search)      → filteredMaga
       ├─ searchLocalImpact(search)    → filteredLocal
       ├─ searchNarrativeReports(search) → filteredNarratives
       ├─ getCandidateBySlug(slug)     → selectedCandidate
       ├─ magaFiles.find(slug)         → selectedMaga
       ├─ getLocalImpactBySlug(slug)   → selectedLocal
       └─ narrativeReports.find(slug)  → selectedNarrative
```

All data sources are imported from `src/data/`:
- `candidates.ts` — Candidate profiles (GitHub-synced + Supabase)
- `magaFiles.ts` — MAGA Files (static data)
- `localImpact.ts` — Local Impact reports (static data)
- `narrativeReports.ts` — Narrative Reports (static data)

---

## Sidebar & Routing Changes

### Before (11 sidebar items)
```
Dashboard → Candidate Profiles → Local Impact → Narrative Reports → District Intel → ...
```

### After (9 sidebar items)
```
Dashboard → OppoHub → District Intel → LegHub → DataHub → MessagingHub → Research Tools → Live Elections → Documentation
```

The `Section` type union was updated:
```typescript
// Old sections removed: "candidates" | "local-impact" | "narratives"
// New section added: "oppohub" | "messaging"
type Section =
  | "dashboard"
  | "oppohub"        // NEW — replaces candidates, local-impact, narratives
  | "district-intel"
  | "leghub"
  | "polling"
  | "messaging"      // NEW — MessagingHub
  | "research-tools"
  | "live-elections"
  | "documentation";
```

### Cross-Section Navigation

The `navigateBySlug()` function in `Index.tsx` was updated to route candidate, MAGA file, local impact, and narrative matches to the `oppohub` section:

```typescript
if (candidateMatch) { setSection("oppohub"); setSelectedSlug(candidateMatch.slug); }
if (magaMatch) { setSection("oppohub"); setSelectedSlug(magaMatch.slug); }
if (localMatch) { setSection("oppohub"); setSelectedSlug(localMatch.slug); }
if (narrativeMatch) { setSection("oppohub"); setSelectedSlug(narrativeMatch.slug); }
```

---

## Admin Integration

When `isAdmin` is true:
- **Add Profile** button appears in the Profiles sub-tab header
- **Edit** button appears on candidate detail views via `onEditCandidate`
- Create/Edit flow uses the existing `CandidateEditor` component

Content management for all OppoHub content types (candidates, MAGA files, local impact, narratives) remains in the **Admin Panel** with separate tabs for each type.

---

## Section Count

The `sectionCounts` for OppoHub aggregates all three content types:
```typescript
oppohub: candidates.length + localImpactReports.length + narrativeReports.length
```

This combined count is displayed in the sidebar badge.
