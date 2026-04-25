# Documentation System — Technical Reference

> Companion technical document for [29-Documentation-System](29-Documentation-System). Auto-generated from registry; safe to extend manually.

## Overview
This page captures the **machine-relevant** surface area for *Documentation System*: backing tables, edge functions, public-API endpoints, MCP tools, and offline-cached data.

## Database Tables
- `wiki_pages`
- `wiki_changelog`

## Edge Functions
- `auto-docs` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `wiki-sync` — see [docs-edge-functions](/public-api/docs-edge-functions)

## Public API Endpoints
- `GET /public-api/docs` — see [docs-endpoints?endpoint=docs](/public-api/docs-endpoints?endpoint=docs)
- `GET /public-api/docs-wiki` — see [docs-endpoints?endpoint=docs-wiki](/public-api/docs-endpoints?endpoint=docs-wiki)
- `GET /public-api/docs-endpoints` — see [docs-endpoints?endpoint=docs-endpoints](/public-api/docs-endpoints?endpoint=docs-endpoints)
- `GET /public-api/docs-tables` — see [docs-endpoints?endpoint=docs-tables](/public-api/docs-endpoints?endpoint=docs-tables)
- `GET /public-api/docs-mcp-tools` — see [docs-endpoints?endpoint=docs-mcp-tools](/public-api/docs-endpoints?endpoint=docs-mcp-tools)
- `GET /public-api/docs-edge-functions` — see [docs-endpoints?endpoint=docs-edge-functions](/public-api/docs-endpoints?endpoint=docs-edge-functions)
- `GET /public-api/docs-technical` — see [docs-endpoints?endpoint=docs-technical](/public-api/docs-endpoints?endpoint=docs-technical)

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
Full narrative: [`wiki/29-Documentation-System.md`](/public-api/docs-wiki?slug=29-Documentation-System).
