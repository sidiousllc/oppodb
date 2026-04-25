# Feature: Research Tools — Technical Reference

> Companion technical document for [14-Research-Tools](14-Research-Tools). Auto-generated from registry; safe to extend manually.

## Overview
This page captures the **machine-relevant** surface area for *Feature: Research Tools*: backing tables, edge functions, public-API endpoints, MCP tools, and offline-cached data.

## Database Tables
- `court_cases`
- `voter_stats`

## Edge Functions
- `court-search` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `court-cases-sync` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `voter-lookup` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `voter-registration-stats` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `scrape-article` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `public-api` — see [docs-edge-functions](/public-api/docs-edge-functions)

## Public API Endpoints
- `GET /public-api/search` — see [docs-endpoints?endpoint=search](/public-api/docs-endpoints?endpoint=search)

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
Full narrative: [`wiki/14-Research-Tools.md`](/public-api/docs-wiki?slug=14-Research-Tools).
