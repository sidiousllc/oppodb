# Feature: IntelHub — Intelligence Briefings — Technical Reference

> Companion technical document for [21-IntelHub](21-IntelHub). Auto-generated from registry; safe to extend manually.

## Overview
This page captures the **machine-relevant** surface area for *Feature: IntelHub — Intelligence Briefings*: backing tables, edge functions, public-API endpoints, MCP tools, and offline-cached data.

## Database Tables
- `intel_briefings`
- `news_clusters`

## Edge Functions
- `intel-briefing` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `news-cluster-stories` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `url-bias-check` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `news-source-rate` — see [docs-edge-functions](/public-api/docs-edge-functions)

## Public API Endpoints
- `GET /public-api/intel-briefings` — see [docs-endpoints?endpoint=intel-briefings](/public-api/docs-endpoints?endpoint=intel-briefings)

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
Full narrative: [`wiki/21-IntelHub.md`](/public-api/docs-wiki?slug=21-IntelHub).
