# Feature: Candidate Profiles — Technical Reference

> Companion technical document for [02-Candidate-Profiles](02-Candidate-Profiles). Auto-generated from registry; safe to extend manually.

## Overview
This page captures the **machine-relevant** surface area for *Feature: Candidate Profiles*: backing tables, edge functions, public-API endpoints, MCP tools, and offline-cached data.

## Database Tables
- `candidate_profiles`
- `candidate_versions`
- `congress_members`

## Edge Functions
- `sync-github` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `candidate-scraper` — see [docs-edge-functions](/public-api/docs-edge-functions)

## Public API Endpoints
- `GET /public-api/candidates` — see [docs-endpoints?endpoint=candidates](/public-api/docs-endpoints?endpoint=candidates)
- `GET /public-api/congress-members` — see [docs-endpoints?endpoint=congress-members](/public-api/docs-endpoints?endpoint=congress-members)
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
Full narrative: [`wiki/02-Candidate-Profiles.md`](/public-api/docs-wiki?slug=02-Candidate-Profiles).
