# Live Elections — Technical Reference

> Companion technical document for [25-Live-Elections](25-Live-Elections). Auto-generated from registry; safe to extend manually.

## Overview
This page captures the **machine-relevant** surface area for *Live Elections*: backing tables, edge functions, public-API endpoints, MCP tools, and offline-cached data.

## Database Tables
- `election_night_streams`
- `congressional_election_results`

## Edge Functions
- `civic-api-proxy` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `election-results-sync` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `congressional-election-sync` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `mit-election-sync` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `state-voter-portal-lookup` — see [docs-edge-functions](/public-api/docs-edge-functions)

## Public API Endpoints
- `GET /public-api/election-results` — see [docs-endpoints?endpoint=election-results](/public-api/docs-endpoints?endpoint=election-results)
- `GET /public-api/election-night-streams` — see [docs-endpoints?endpoint=election-night-streams](/public-api/docs-endpoints?endpoint=election-night-streams)
- `GET /public-api/mit-elections` — see [docs-endpoints?endpoint=mit-elections](/public-api/docs-endpoints?endpoint=mit-elections)

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
Full narrative: [`wiki/25-Live-Elections.md`](/public-api/docs-wiki?slug=25-Live-Elections).
