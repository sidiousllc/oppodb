# Feature: MessagingHub — Technical Reference

> Companion technical document for [20-MessagingHub](20-MessagingHub). Auto-generated from registry; safe to extend manually.

## Overview
This page captures the **machine-relevant** surface area for *Feature: MessagingHub*: backing tables, edge functions, public-API endpoints, MCP tools, and offline-cached data.

## Database Tables
- `messaging_guidance`
- `messaging_audience_analyses`
- `messaging_impact_analyses`

## Edge Functions
- `messaging-sync` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `messaging-audience-analysis` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `messaging-impact` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `messaging-talking-points` — see [docs-edge-functions](/public-api/docs-edge-functions)

## Public API Endpoints
- `GET /public-api/messaging-guidance` — see [docs-endpoints?endpoint=messaging-guidance](/public-api/docs-endpoints?endpoint=messaging-guidance)

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
Full narrative: [`wiki/20-MessagingHub.md`](/public-api/docs-wiki?slug=20-MessagingHub).
