# Feature: Campaign Finance — Technical Reference

> Companion technical document for [05-Campaign-Finance](05-Campaign-Finance). Auto-generated from registry; safe to extend manually.

## Overview
This page captures the **machine-relevant** surface area for *Feature: Campaign Finance*: backing tables, edge functions, public-API endpoints, MCP tools, and offline-cached data.

## Database Tables
- `campaign_finance`
- `state_cfb_candidates`
- `mn_cfb_candidates`
- `winred_donations`

## Edge Functions
- `campaign-finance-sync` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `opensecrets-sync` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `mn-cfb-finance` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `state-cfb-finance` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `followthemoney` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `winred-webhook` — see [docs-edge-functions](/public-api/docs-edge-functions)

## Public API Endpoints
- `GET /public-api/campaign-finance` — see [docs-endpoints?endpoint=campaign-finance](/public-api/docs-endpoints?endpoint=campaign-finance)
- `GET /public-api/state-finance` — see [docs-endpoints?endpoint=state-finance](/public-api/docs-endpoints?endpoint=state-finance)
- `GET /public-api/winred-donations` — see [docs-endpoints?endpoint=winred-donations](/public-api/docs-endpoints?endpoint=winred-donations)

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
Full narrative: [`wiki/05-Campaign-Finance.md`](/public-api/docs-wiki?slug=05-Campaign-Finance).
