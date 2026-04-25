# Feature: State Legislative Districts — Technical Reference

> Companion technical document for [06-State-Legislative-Districts](06-State-Legislative-Districts). Auto-generated from registry; safe to extend manually.

## Overview
This page captures the **machine-relevant** surface area for *Feature: State Legislative Districts*: backing tables, edge functions, public-API endpoints, MCP tools, and offline-cached data.

## Database Tables
- `district_profiles`
- `district_news_cache`
- `congressional_election_results`
- `state_legislative_districts`
- `state_leg_elections`
- `state_legislative_bills`

## Edge Functions
- `census-sync` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `district-intel` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `district-news` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `state-legislative-sync` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `legiscan` — see [docs-edge-functions](/public-api/docs-edge-functions)

## Public API Endpoints
- `GET /public-api/districts` — see [docs-endpoints?endpoint=districts](/public-api/docs-endpoints?endpoint=districts)
- `GET /public-api/district-news` — see [docs-endpoints?endpoint=district-news](/public-api/docs-endpoints?endpoint=district-news)
- `GET /public-api/state-legislative` — see [docs-endpoints?endpoint=state-legislative](/public-api/docs-endpoints?endpoint=state-legislative)
- `GET /public-api/state-leg-elections` — see [docs-endpoints?endpoint=state-leg-elections](/public-api/docs-endpoints?endpoint=state-leg-elections)

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
Full narrative: [`wiki/06-State-Legislative-Districts.md`](/public-api/docs-wiki?slug=06-State-Legislative-Districts).
