# Feature: Multi-Windows UI Theme System — Technical Reference

> Companion technical document for [10-UI-Design-System](10-UI-Design-System). Auto-generated from registry; safe to extend manually.

## Overview
This page captures the **machine-relevant** surface area for *Feature: Multi-Windows UI Theme System*: backing tables, edge functions, public-API endpoints, MCP tools, and offline-cached data.

## Database Tables
- _No table mapping registered. See [docs-tables](/public-api/docs-tables)._

## Edge Functions
- _No edge function mapping registered._

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
Full narrative: [`wiki/10-UI-Design-System.md`](/public-api/docs-wiki?slug=10-UI-Design-System).
