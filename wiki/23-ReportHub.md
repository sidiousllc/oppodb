# ReportHub

**ReportHub** (formerly "Reports") is the campaign-grade report builder, scheduler, and distribution system. It allows users to assemble research blocks (candidate cards, district demographics, finance charts, polling tables, news feeds, custom markdown) into a shareable, exportable, and emailable report.

## Location
- **Sidebar entry**: `ReportHub` (icon: 📝). Internally routed as `reports`.
- **Files**: `src/components/ReportsHub.tsx`, `src/components/ReportBuilder.tsx`, `src/components/reports/BlockViews.tsx`, `src/components/reports/BiasOverlay.tsx`, `src/components/reports/ReportSchedules.tsx`.
- **Public viewer**: `src/pages/PublicReport.tsx` at `/r/:slug`.

## Tabs

### 1. My Reports
- Lists reports owned by the user, plus reports shared via `report_shares`.
- Visibility states: **private**, **link** (anyone with slug), **public** (indexed in PublicReport route).
- Actions: open in builder, duplicate, delete, share, export (PDF/Markdown/JSON), print.

### 2. Shared with Me
- Reports where the current user is in `report_shares` with read or edit permission.
- Permission resolution via `user_has_report_access(report_id, user_id, need_edit)` SQL function.

### 3. Public Library
- Reports flagged `visibility = 'public'`.
- Indexable by state, race type, tag.

### 4. Schedules
- Recurring report deliveries via `scheduled-report-email` edge function.
- Cadences: daily, weekly, biweekly, monthly.
- Recipients: user-defined email list (auth not required for recipients).
- Each schedule snapshots the report at send time using `lib/reports/snapshots.ts` so the email reflects data as of dispatch.

## Block Types
Defined in `src/lib/reports/types.ts`:

| Block | Description |
|-------|-------------|
| `text` | Markdown body with bias overlay support |
| `candidate` | Embedded `CandidateCard` |
| `district` | District demographics + map |
| `finance` | Cycle-aware finance summary |
| `polling` | Poll table with trendline |
| `news` | IntelHub article cluster |
| `forecast` | Cook/Sabato/Inside Elections side-by-side |
| `image` | Uploaded asset from Supabase Storage |
| `chart` | Custom chart from JSON config |

## Bias Overlay
The `BiasOverlay` component scores each `text` block using `lib/newsBias.ts` heuristics and visualizes per-paragraph lean (Left, Center, Right) with citation-density warnings. Used to keep reports balanced before client delivery.

## Export
- **PDF**: `lib/reports/exporters.ts → exportReportPdf()` uses `jsPDF` + `applyPdfBranding` to produce multi-page branded PDFs with the standard ORO header/footer disclaimer.
- **Markdown**: `exportReportMarkdown()` produces portable `.md` for archival.
- **JSON**: Full block tree dump for migration/duplication.
- **Print**: `window.print()` against a print-stylesheet variant.

## Database Tables
| Table | Purpose |
|-------|---------|
| `reports` | Top-level report metadata |
| `report_blocks` | Ordered block tree |
| `report_shares` | Per-user share grants |
| `report_schedules` | Recurring delivery configs |
| `report_snapshots` | Point-in-time data dumps for scheduled sends |

## Security
- All mutating queries gated by RLS using `user_has_report_access`.
- Public reports served via anon key but stripped of sensitive owner-only blocks.
- Scheduled email recipients are validated against `email_unsubscribe_tokens` on every send.
