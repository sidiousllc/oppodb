# Feature: MessagingHub

## Description

MessagingHub is a dedicated section for multi-partisan message guidance and communications strategy research. It aggregates 95+ messaging reports from 30+ organizations spanning Democrat, Republican, and Independent/nonpartisan sources, providing searchable, tag-filterable access to polling-backed communications guidance for political campaigns.

---

## Data Model

### Database Table: `messaging_guidance`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | uuid | `gen_random_uuid()` | Primary key |
| `title` | text | — | Title of the guidance report |
| `slug` | text (unique) | — | URL-safe identifier |
| `source` | text | `'Navigator Research'` | Source organization |
| `source_url` | text | null | Link to original report |
| `author` | text | null | Author name(s) |
| `published_date` | date | null | Publication date |
| `summary` | text | `''` | Short description/preview |
| `content` | text | `''` | Full markdown content |
| `issue_areas` | text[] | `'{}'` | Array of issue/party tags |
| `research_type` | text | `'message-guidance'` | Type of research |
| `created_at` | timestamptz | `now()` | Creation timestamp |
| `updated_at` | timestamptz | `now()` | Last update timestamp |

---

## Data Sources (30+ Organizations)

### Democrat-Aligned
| Organization | Focus |
|-------------|-------|
| Navigator Research | Polling-backed progressive messaging |
| Center for American Progress (CAP) | Progressive policy research |
| Third Way | Center-left policy and messaging |
| Data for Progress | Progressive polling and messaging |
| American Progress Action Fund | Progressive advocacy |
| Democratic Policy Committee | Congressional Democratic messaging |

### Republican-Aligned
| Organization | Focus |
|-------------|-------|
| American Enterprise Institute (AEI) | Conservative policy research |
| Heritage Foundation | Conservative policy and messaging |
| Manhattan Institute | Free-market policy |
| Cato Institute | Libertarian policy |

### Nonpartisan / Bipartisan
| Organization | Focus |
|-------------|-------|
| Brookings Institution | Centrist policy analysis |
| Bipartisan Policy Center | Cross-party governance |
| RAND Corporation | Defense and security research |
| Urban Institute | Social and economic policy |
| Pew Research Center | Public opinion data |

---

## Edge Function: `messaging-sync`

### Architecture
Uses the `makeSearchScraper` factory pattern for consistent scraper creation:

```typescript
function makeSearchScraper(
  name: string,
  searchUrl: string,
  source: string,
  researchType: string
): Scraper
```

### Sync Process
1. Iterates through 30+ configured scrapers
2. Each scraper uses Firecrawl API (`FIRECRAWL_API_KEY`) to fetch and parse source pages
3. Extracts title, URL, summary, and content
4. Applies automated issue area detection via 40+ keyword matching
5. Tags with party affiliation (Democrat, Republican, Independent)
6. Upserts by slug to prevent duplicates

### Issue Area Detection (40+ Keywords)

| Issue Area | Keywords |
|-----------|----------|
| Immigration | immigration, border, ICE, asylum, migrant, deportation, DACA |
| Economy | economy, inflation, jobs, wages, unemployment, recession, GDP |
| Healthcare | health, medicare, medicaid, ACA, insurance, hospital, drug |
| Tariffs | tariff, trade, customs, import, export, trade war |
| Education | education, school, student, college, teacher, Title I |
| Climate | climate, environment, EPA, emissions, renewable, energy |
| Defense | military, defense, Pentagon, veteran, NATO |
| Abortion | abortion, reproductive, Roe, Dobbs, pro-choice, pro-life |
| Gun Policy | gun, firearm, Second Amendment, NRA, shooting |
| Social Security | social security, Medicare, retirement, entitlement |
| And 30+ more | ... |

---

## Component: `MessagingHub.tsx`

### Features
- **Data Loading**: Fetches all records from `messaging_guidance` table, ordered by `published_date` descending
- **Search**: Client-side text search across title, summary, author, and issue area tags
- **Tag Filtering**: Dynamic tag buttons generated from all unique `issue_areas`
- **Party Filtering**: Filter by Democrat, Republican, or nonpartisan sources
- **Detail View**: Full report with source link, metadata, and markdown content in Win98-style mini-window
- **Pull Updates**: Manual sync button triggers `messaging-sync` edge function
- **PDF Export**: Theme-aware PDF generation via jsPDF

### Win98 Mini-Windows
Reports open in draggable Win98-style windows supporting:
- Resize and minimize
- Z-index management via WindowManagerContext
- Full markdown rendering with "Do/Don't" framing
- Audience segmentation sections

---

## Search Integration

MessagingHub data is included in **OppoDB Master Search**:
- Queries `messaging_guidance` with `ilike` on `title` and `summary`
- Results appear under "📢 Messaging Guidance" category
- Clicking navigates to the `messaging` section

---

## API Access

### REST: `/messaging-guidance`

| Parameter | Description |
|-----------|-------------|
| `search` | Search by title or summary |
| `issue_area` | Filter by issue area tag |

### REST: Messaging AI (Phase 7)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/messaging-talking-points?slug=…` | GET | Cached AI talking points for a messaging item |
| `/messaging-talking-points` | POST | Generate talking points (body: `{ messaging_slug, audience, angle, tone, model, include_sections[] }`) |
| `/messaging-audience?slug=…` | GET | Cached audience effectiveness analysis |
| `/messaging-audience` | POST | Generate audience analysis. Body supports `force_refresh` (admin-only) |
| `/messaging-impact?slug=…` | GET | Cached impact analyses (national/state/district) |
| `/messaging-impact` | POST | Generate impact analysis (body: `{ messaging_slug, scope, scope_ref, model, include_sections[] }`) |
| `/messaging-ai-bundle?slug=…` | GET | One-shot fetch of item + talking points + audience + impact. Powers report blocks and PDF export. |

`include_sections` accepts any combination of `polling`, `intel`, `legislation`, `finance`, `forecasts`, `international`. The corresponding edge functions enrich AI prompts with current data from those sections to produce contextual, evidence-backed output.

### MCP Tools (Phase 7)

| Tool | Purpose |
|------|---------|
| `get_messaging_talking_points` | Read cached AI talking points |
| `generate_messaging_talking_points` | Create new talking points with cross-section context |
| `get_messaging_audience_analysis` | Read cached audience effectiveness scoring |
| `generate_messaging_audience_analysis` | Recompute audience analysis (7-day cache) |
| `get_messaging_impact` | Read cached impact analyses by scope |
| `generate_messaging_impact` | Generate scope-specific impact analysis |
| `get_messaging_ai_bundle` | Combined item + AI artifacts in a single call |
| `admin_regenerate_messaging_ai` | [ADMIN] Force-regenerate any cached artifact |

### MCP: `master_search`
Included in unified search under `messaging_guidance` category.

---

## Report Builder Integration

A `messaging_ai` block type is available in the Report Builder under the **Intelligence** group. It snapshots the full AI bundle (talking points + audience analysis + impact) for a messaging item, renders effectiveness scores, segment breakdowns, risks, and the latest talking points in PDF exports. The classic `messaging` block now also captures source/author/issue tags in its snapshot for richer rendering.

---

## PDF Export Bundle

`MessagingHub` PDFs auto-append the latest cached AI artifacts under an "AI Messaging Intelligence" section. This includes:
- Audience effectiveness score and per-segment breakdown
- Top resonance factors and risks (severity-ranked)
- Most recent talking points blocks (audience/angle/points/evidence)
- Latest impact analyses by scope

---

## Admin Panel Integration

In **Admin Panel → Messaging Guidance** tab:
- Create, edit, delete messaging guidance entries
- Fields: title, slug, source, source_url, author, published_date, summary, content, issue_areas, research_type
- Tags stored in `issue_areas` column (comma-separated input, stored as text array)
