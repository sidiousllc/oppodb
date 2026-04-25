# ORDB Technical Reference

> Master index of every per-section technical page. Generated from `wiki/*-Technical.md`.
> For machine consumption see `/public-api/docs?include=all`.

## Platform Surface (live counts via API)
- **Public API endpoints**: see `/public-api/docs-endpoints`
- **Offline-synced tables**: see `/public-api/docs-tables`
- **Edge functions**: see `/public-api/docs-edge-functions`
- **MCP tools**: see `/public-api/docs-mcp-tools`
- **Wiki pages**: see `/public-api/docs-wiki`

## Per-Section Technical Pages
- [OppoDB — Opposition Research Database — Technical Reference](/public-api/docs-technical?slug=01-Overview-Technical)
- [Feature: Candidate Profiles — Technical Reference](/public-api/docs-technical?slug=02-Candidate-Profiles-Technical)
- [Feature: District Intelligence — Technical Reference](/public-api/docs-technical?slug=03-District-Intelligence-Technical)
- [Feature: DataHub (Polling Data, Prediction Markets & Campaign Finance) — Technical Reference](/public-api/docs-technical?slug=04-Polling-Data-Technical)
- [Feature: Campaign Finance — Technical Reference](/public-api/docs-technical?slug=05-Campaign-Finance-Technical)
- [Feature: State Legislative Districts — Technical Reference](/public-api/docs-technical?slug=06-State-Legislative-Districts-Technical)
- [Feature: Additional Sections — Technical Reference](/public-api/docs-technical?slug=07-Additional-Features-Technical)
- [Feature: Authentication & User Management — Technical Reference](/public-api/docs-technical?slug=08-Authentication-and-User-Management-Technical)
- [Feature: API Access — Technical Reference](/public-api/docs-technical?slug=09-API-Access-Technical)
- [Feature: Multi-Windows UI Theme System — Technical Reference](/public-api/docs-technical?slug=10-UI-Design-System-Technical)
- [Feature: Data Sync & External Sources — Technical Reference](/public-api/docs-technical?slug=11-Data-Sync-and-Sources-Technical)
- [Feature: Cook Ratings & Forecasting — Technical Reference](/public-api/docs-technical?slug=12-Cook-Ratings-and-Forecasting-Technical)
- [Feature: Admin Panel — Technical Reference](/public-api/docs-technical?slug=13-Admin-Panel-Technical)
- [Feature: Research Tools — Technical Reference](/public-api/docs-technical?slug=14-Research-Tools-Technical)
- [Android App — Technical Reference](/public-api/docs-technical?slug=15-Android-App-Technical)
- [Feature: Prediction Market Trading — Technical Reference](/public-api/docs-technical?slug=16-Prediction-Market-Trading-Technical)
- [Feature: LegHub — Legislative Intelligence Hub — Technical Reference](/public-api/docs-technical?slug=17-LegHub-Technical)
- [Feature: OppoDB Master Search — Technical Reference](/public-api/docs-technical?slug=18-OppoDB-Search-Technical)
- [Feature: OppoHub — Technical Reference](/public-api/docs-technical?slug=19-OppoHub-Technical)
- [Feature: MessagingHub — Technical Reference](/public-api/docs-technical?slug=20-MessagingHub-Technical)
- [Feature: IntelHub — Intelligence Briefings — Technical Reference](/public-api/docs-technical?slug=21-IntelHub-Technical)
- [DataHub — Technical Reference](/public-api/docs-technical?slug=22-DataHub-Technical)
- [ReportHub — Technical Reference](/public-api/docs-technical?slug=23-ReportHub-Technical)
- [InternationalHub — Technical Reference](/public-api/docs-technical?slug=24-InternationalHub-Technical)
- [Live Elections — Technical Reference](/public-api/docs-technical?slug=25-Live-Elections-Technical)
- [Polling Alerts & Email Preferences — Technical Reference](/public-api/docs-technical?slug=26-Polling-Alerts-and-Email-Preferences-Technical)
- [AOL Communication Suite — Technical Reference](/public-api/docs-technical?slug=27-AOL-Communication-Suite-Technical)
- [MCP Server — Technical Reference](/public-api/docs-technical?slug=28-MCP-Server-Technical)
- [Documentation System — Technical Reference](/public-api/docs-technical?slug=29-Documentation-System-Technical)
- [Sync Pipeline — Auto-Refresh Architecture — Technical Reference](/public-api/docs-technical?slug=30-Sync-Pipeline-Technical)
- [War Rooms — Collaborative Intelligence Spaces — Technical Reference](/public-api/docs-technical?slug=31-War-Rooms-Technical)
- [Geopolitics Intelligence System — Technical Reference](/public-api/docs-technical?slug=32-Geopolitics-Intelligence-Technical)

## Auth & Security
- All write paths require an admin/moderator JWT validated by `has_role()`.
- API keys are SHA-256-hashed and validated via `validate_api_key()` RPC.
- Section/subsection ACLs enforced by `check_section_access()`.

## Sync Pipeline
Daily 3:00 AM UTC `scheduled-sync` orchestrates the per-source sync functions with checkpointed batches.
See `wiki/30-Sync-Pipeline-Technical` for the full step matrix.

## Offline / PWA
Encrypted IndexedDB-backed offline cache with queued writes. Source of truth: `src/lib/offlineSync.ts`.
Manifest: `/public-api/offline-manifest`.

## Self-Documentation
Every endpoint, table, function, and tool is self-described:
```
GET /public-api/docs?include=all
```
