# Feature: MessagingHub

## Description

MessagingHub is a dedicated section for polling-based message guidance and communications strategy research. It aggregates messaging reports from Navigator Research and other sources, providing searchable, tag-filterable access to polling-backed communications guidance for political campaigns.

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
| `issue_areas` | text[] | `'{}'` | Array of issue tags (e.g., "Immigration", "Tariffs") |
| `research_type` | text | `'message-guidance'` | Type of research |
| `created_at` | timestamptz | `now()` | Creation timestamp |
| `updated_at` | timestamptz | `now()` | Last update timestamp |

### Indexes
- `idx_messaging_guidance_slug` — B-tree on `slug` for fast lookups
- `idx_messaging_guidance_issue_areas` — GIN on `issue_areas` for tag filtering

### RLS Policies

| Policy | For | To | Rule |
|--------|-----|-----|------|
| Anyone can read | SELECT | public | `true` |
| Admins and mods can insert | INSERT | authenticated | `has_role('admin') OR has_role('moderator')` |
| Admins and mods can update | UPDATE | authenticated | `has_role('admin') OR has_role('moderator')` |
| Admins can delete | DELETE | authenticated | `has_role('admin')` |

---

## Component: `MessagingHub.tsx`

### Features
- **Data Loading**: Fetches all records from `messaging_guidance` table on mount, ordered by `published_date` descending
- **Search**: Client-side text search across title, summary, author, and issue area tags
- **Tag Filtering**: Dynamically generated tag buttons from all unique `issue_areas` across loaded data
- **Detail View**: Click any report to view full details with source link, metadata, and content
- **External Links**: Each report links to its original source URL

### UI Layout

```
┌──────────────────────────────────────────┐
│ 📢 MessagingHub — Message guidance...    │
├──────────────────────────────────────────┤
│ 🔍 [Search messaging guidance...]       │
├──────────────────────────────────────────┤
│ [All Topics] [Immigration] [Tariffs] ... │
├──────────────────────────────────────────┤
│ 7 reports                                │
├──────────────────────────────────────────┤
│ ┌─ The More Americans Learn About...  ─┐│
│ │ Summary text preview...               ││
│ │ 📅 3/19/2026 • Maryann Cousens       ││
│ │ [Election Integrity] [Elections]      ││
│ └───────────────────────────────────────┘│
│ ┌─ Perceptions And Concerns About... ──┐│
│ │ ...                                   ││
│ └───────────────────────────────────────┘│
└──────────────────────────────────────────┘
```

### Detail View

When a report is selected:
- Back button returns to list
- Header card with title, source, author, date, and issue tags
- Source link button (opens external URL)
- Content card with summary and full report body
- Fallback message if full content not yet available

---

## Data Sources

### Navigator Research (`navigatorresearch.org`)

Navigator Research is a project of Global Strategy Group and GS Strategy Group focused on providing polling-backed messaging guidance for progressive communicators.

**Seeded Reports** (initial dataset):

| Title | Published | Issue Areas |
|-------|-----------|-------------|
| The More Americans Learn About the SAVE Act... | 2026-03-19 | Election Integrity, Elections, Congress |
| Perceptions And Concerns About Trump's War Against Iran | 2026-03-18 | Foreign Policy, Trump, National Security |
| Message Guidance on Tariff SCOTUS Ruling | 2026-02-20 | Tariffs, Supreme Court, Economy |
| Do's and Don'ts about Discussing ICE and Immigration | 2026-02-09 | Immigration, Trump |
| All eyes are on ICE | 2026-02-05 | Immigration, Trump |
| State of the Shutdown: Families are Paying the Price... | 2025-10-31 | Shutdown, Budget, Congress, Republicans |
| Winning Messages on Reproductive Rights Post-Dobbs | 2025-09-15 | Abortion, Reproductive Rights, Health Care |

### Adding New Sources

New messaging guidance can be added:
1. **Admin Panel**: Via the Messaging Guidance content management tab
2. **Direct DB Insert**: Via Supabase with appropriate role
3. **API**: Via the `/messaging-guidance` public API endpoint (when implemented)

---

## Search Integration

MessagingHub data is included in the **OppoDB Master Search** (`MasterSearch.tsx`):
- Queries `messaging_guidance` table with `ilike` on `title` and `summary` columns
- Results appear under the "📢 Messaging Guidance" category
- Clicking a result navigates to the `messaging` section

---

## API Access

### Public REST API Endpoint: `/messaging-guidance`

| Parameter | Description |
|-----------|-------------|
| `search` | Search by title or summary (case-insensitive) |
| `issue_area` | Filter by issue area tag |

**Fields**: `id, title, slug, source, source_url, author, published_date, summary, content, issue_areas, research_type, created_at, updated_at`

```bash
curl -H "X-API-Key: KEY" "https://.../public-api/messaging-guidance?search=tariff"
curl -H "X-API-Key: KEY" "https://.../public-api/messaging-guidance?issue_area=Immigration"
```

---

## Admin Panel Integration

MessagingHub content is manageable from the **Admin Panel → Messaging Guidance** tab:

### Content Management
- **List View**: Shows all guidance with title, source, published date, issue areas
- **Create**: Form with title, slug (auto-generated), source, source_url, author, published_date, summary, content, issue_areas, research_type
- **Edit**: Pre-filled form for existing entries
- **Delete**: Admin-only with confirmation

### Fields
| Field | Input Type | Required |
|-------|-----------|----------|
| Title | Text | ✓ |
| Slug | Text (auto-generated from title) | ✓ |
| Source | Text | ✓ (default: "Navigator Research") |
| Source URL | URL | ✗ |
| Author | Text | ✗ |
| Published Date | Date picker | ✗ |
| Summary | Textarea | ✓ |
| Content | Textarea (Markdown) | ✗ |
| Issue Areas | Comma-separated tags | ✗ |
| Research Type | Dropdown | ✓ (default: "message-guidance") |
