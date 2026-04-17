# Documentation System

This page documents the documentation system itself.

## Location
- **Sidebar entry**: `Documentation` (icon: 📖).
- **File**: `src/components/DocumentationSection.tsx`.

## Architecture
1. **Static fallback**: Every page in `wiki/*.md` is bundled into the client via Vite `?raw` imports for offline-first operation.
2. **Database override**: The `wiki_pages` table can override or supplement static pages. Admins edit pages via Admin Panel → Documentation.
3. **Merge logic**: On load, DB pages with matching slugs override static; DB-only pages are appended to the navigation.

## Features

### Search
- Live filter on page titles (`searchQuery` state).
- Future: full-text search across rendered content.

### Single-Page Export
- Each page has **Export Markdown** (`.md` download) and **Export PDF** buttons.
- PDF export uses `jsPDF` + `applyPdfBranding` for ORO-branded headers/footers.

### Bulk Export
- "Export Multiple" button opens a checkbox list of all pages.
- Select any subset (or "Select All") and choose **PDF** to receive a single multi-page document.
- Optional "Combined Markdown" download bundles selected pages as one `.md` file with section separators.

### Markdown Rendering
- Powered by `react-markdown` with custom Win98-themed components for `h1`–`h3`, tables, code blocks, links, blockquotes, and horizontal rules.
- All themes (Win98 → Win11) inherit the same renderer with theme-aware tokens.

## Database Schema (`wiki_pages`)
| Column | Type | Notes |
|--------|------|-------|
| `slug` | text PK | URL-safe identifier matching static file basename |
| `title` | text | Display name |
| `content` | text | Markdown body |
| `published` | bool | Hides drafts from public users |
| `sort_order` | int | Navigation order |
| `updated_at` | timestamptz | Auto-updated by trigger |

## Admin Editing
See [Admin Panel](Admin-Panel) → Documentation tab.
