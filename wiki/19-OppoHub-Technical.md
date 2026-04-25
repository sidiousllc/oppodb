# Feature: OppoHub — Technical Reference

> Companion technical document for [19-OppoHub](19-OppoHub). Auto-generated from registry; safe to extend manually.

## Overview
This page captures the **machine-relevant** surface area for *Feature: OppoHub*: backing tables, edge functions, public-API endpoints, MCP tools, and offline-cached data.

## Database Tables
- `maga_files`
- `narrative_reports`
- `local_impacts`
- `oppo_trackers`
- `oppo_tracker_items`

## Edge Functions
- _No edge function mapping registered._

## Public API Endpoints
- _No public endpoint mapping registered._

## MCP Tools
Discover tools related to this section via:
```
GET /public-api/docs-mcp-tools
```
Then filter `data[]` by `section` matching this page's domain.

## Offline Behavior
The PWA syncs a subset of the above tables to the encrypted IndexedDB store (see `src/lib/offlineSync.ts`). For the live manifest:
```
GET /public-api/offline-manifest
```

## Authentication
- **Read endpoints**: API key or session JWT (see `api-key-manager`).
- **Write/admin operations**: Admin-role JWT validated via `has_role()` RPC.

## Source Document
Full narrative: [`wiki/19-OppoHub.md`](/public-api/docs-wiki?slug=19-OppoHub).
