# Feature: Cook Ratings & Forecasting — Technical Reference

> Companion technical document for [12-Cook-Ratings-and-Forecasting](12-Cook-Ratings-and-Forecasting). Auto-generated from registry; safe to extend manually.

## Overview
This page captures the **machine-relevant** surface area for *Feature: Cook Ratings & Forecasting*: backing tables, edge functions, public-API endpoints, MCP tools, and offline-cached data.

## Database Tables
- `election_forecasts`
- `election_forecast_history`

## Edge Functions
- `forecast-sync` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `forecast-scrape` — see [docs-edge-functions](/public-api/docs-edge-functions)

## Public API Endpoints
- `GET /public-api/forecasts` — see [docs-endpoints?endpoint=forecasts](/public-api/docs-endpoints?endpoint=forecasts)
- `GET /public-api/forecast-history` — see [docs-endpoints?endpoint=forecast-history](/public-api/docs-endpoints?endpoint=forecast-history)

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
Full narrative: [`wiki/12-Cook-Ratings-and-Forecasting.md`](/public-api/docs-wiki?slug=12-Cook-Ratings-and-Forecasting).
