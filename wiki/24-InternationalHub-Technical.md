# InternationalHub — Technical Reference

> Companion technical document for [24-InternationalHub](24-InternationalHub). Auto-generated from registry; safe to extend manually.

## Overview
This page captures the **machine-relevant** surface area for *InternationalHub*: backing tables, edge functions, public-API endpoints, MCP tools, and offline-cached data.

## Database Tables
- `international_profiles`
- `international_elections`
- `international_leaders`
- `international_legislation`
- `international_polling`

## Edge Functions
- `international-sync` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `geopolitics-brief` — see [docs-edge-functions](/public-api/docs-edge-functions)

## Public API Endpoints
- `GET /public-api/international-profiles` — see [docs-endpoints?endpoint=international-profiles](/public-api/docs-endpoints?endpoint=international-profiles)
- `GET /public-api/international-elections` — see [docs-endpoints?endpoint=international-elections](/public-api/docs-endpoints?endpoint=international-elections)
- `GET /public-api/international-leaders` — see [docs-endpoints?endpoint=international-leaders](/public-api/docs-endpoints?endpoint=international-leaders)
- `GET /public-api/international-polling` — see [docs-endpoints?endpoint=international-polling](/public-api/docs-endpoints?endpoint=international-polling)

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
Full narrative: [`wiki/24-InternationalHub.md`](/public-api/docs-wiki?slug=24-InternationalHub).
