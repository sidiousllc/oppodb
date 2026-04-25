# AOL Communication Suite — Technical Reference

> Companion technical document for [27-AOL-Communication-Suite](27-AOL-Communication-Suite). Auto-generated from registry; safe to extend manually.

## Overview
This page captures the **machine-relevant** surface area for *AOL Communication Suite*: backing tables, edge functions, public-API endpoints, MCP tools, and offline-cached data.

## Database Tables
- `chat_messages`
- `mail_messages`
- `mail_recipients`
- `mail_attachments`
- `user_presence`

## Edge Functions
- `send-mail-notification` — see [docs-edge-functions](/public-api/docs-edge-functions)
- `send-external-mail` — see [docs-edge-functions](/public-api/docs-edge-functions)

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
Full narrative: [`wiki/27-AOL-Communication-Suite.md`](/public-api/docs-wiki?slug=27-AOL-Communication-Suite).
