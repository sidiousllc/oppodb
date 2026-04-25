# Sync Pipeline — Auto-Refresh Architecture — Technical Reference

> Companion technical document for [30-Sync-Pipeline](30-Sync-Pipeline). Auto-generated from registry; safe to extend manually.

## Overview
This page captures the **machine-relevant** surface area for *Sync Pipeline — Auto-Refresh Architecture*: backing tables, edge functions, public-API endpoints, MCP tools, and offline-cached data.

## Database Tables
- `sync_metadata`
- `scheduled_sync`

## Edge Functions
- `scheduled-sync` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `sync-github` — see [docs-edge-functions](/public-api/docs-edge-functions)

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
Full narrative: [`wiki/30-Sync-Pipeline.md`](/public-api/docs-wiki?slug=30-Sync-Pipeline).
