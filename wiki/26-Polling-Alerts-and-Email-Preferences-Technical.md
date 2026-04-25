# Polling Alerts & Email Preferences — Technical Reference

> Companion technical document for [26-Polling-Alerts-and-Email-Preferences](26-Polling-Alerts-and-Email-Preferences). Auto-generated from registry; safe to extend manually.

## Overview
This page captures the **machine-relevant** surface area for *Polling Alerts & Email Preferences*: backing tables, edge functions, public-API endpoints, MCP tools, and offline-cached data.

## Database Tables
- `polling_data`
- `polling_aggregates`
- `polling_alerts`
- `email_notification_preferences`
- `email_send_log`
- `email_unsubscribe_tokens`

## Edge Functions
- `polling-sync` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `polling-aggregator` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `polling-alerts-dispatch` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `seed-polling` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `send-transactional-email` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `process-email-queue` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `preview-transactional-email` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `handle-email-suppression` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `handle-email-unsubscribe` — see [docs-edge-functions](/public-api/docs-edge-functions)

## Public API Endpoints
- `GET /public-api/polling` — see [docs-endpoints?endpoint=polling](/public-api/docs-endpoints?endpoint=polling)
- `GET /public-api/polling-aggregates` — see [docs-endpoints?endpoint=polling-aggregates](/public-api/docs-endpoints?endpoint=polling-aggregates)

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
Full narrative: [`wiki/26-Polling-Alerts-and-Email-Preferences.md`](/public-api/docs-wiki?slug=26-Polling-Alerts-and-Email-Preferences).
