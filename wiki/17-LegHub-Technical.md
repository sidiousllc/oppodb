# Feature: LegHub — Legislative Intelligence Hub — Technical Reference

> Companion technical document for [17-LegHub](17-LegHub). Auto-generated from registry; safe to extend manually.

## Overview
This page captures the **machine-relevant** surface area for *Feature: LegHub — Legislative Intelligence Hub*: backing tables, edge functions, public-API endpoints, MCP tools, and offline-cached data.

## Database Tables
- `congress_bills`
- `congress_committees`
- `congress_votes`
- `congressional_record`
- `tracked_bills`

## Edge Functions
- `congress-sync` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `legiscan` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `bill-impact` — see [docs-edge-functions](/public-api/docs-edge-functions)

## Public API Endpoints
- `GET /public-api/bills` — see [docs-endpoints?endpoint=bills](/public-api/docs-endpoints?endpoint=bills)
- `GET /public-api/tracked-bills` — see [docs-endpoints?endpoint=tracked-bills](/public-api/docs-endpoints?endpoint=tracked-bills)
- `GET /public-api/congress-committees` — see [docs-endpoints?endpoint=congress-committees](/public-api/docs-endpoints?endpoint=congress-committees)
- `GET /public-api/congress-votes` — see [docs-endpoints?endpoint=congress-votes](/public-api/docs-endpoints?endpoint=congress-votes)

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
Full narrative: [`wiki/17-LegHub.md`](/public-api/docs-wiki?slug=17-LegHub).
