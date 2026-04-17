# MCP Server

The **Model Context Protocol (MCP) server** exposes OppoDB data and operations to AI agents (Claude Desktop, Cursor, ChatGPT desktop, custom LLM clients) using the standard MCP transport.

## Endpoint
- URL: `https://<project>.functions.supabase.co/mcp-server`
- Transport: HTTP+SSE (streamable).
- Auth: API key passed via `Authorization: Bearer ordb_<key>` header. Generate keys at **Profile → API Keys**.

## Tool Catalogue (35+)

### Public/Reference
- `search_candidates` — Hybrid search across candidate profiles and DB.
- `get_candidate_profile` — Full profile by slug.
- `list_districts` / `get_district` — Congressional district detail.
- `get_state_overview` — State-level rollup.
- `list_polls` / `get_poll_detail`.
- `list_prediction_markets` / `get_market_detail`.
- `list_campaign_finance` / `get_finance_summary`.
- `list_legislation` / `get_bill_detail`.
- `get_intel_clusters` — Topic-clustered news with bias coverage.
- `list_intel_briefings`.
- `get_international_profile`.
- `list_state_legislators`.

### User-Scoped (resolved via API key → user_id)
- `list_reports` — Owned + shared + public reports for the calling user.
- `list_report_schedules`.
- `list_polling_alerts` — User's polling alert subscriptions.
- `get_email_preferences`.
- `list_messages` — Recent in-app mail/IM (read-only).
- `list_api_usage` — Caller's own request history.

### Phase 5 — Alerts, Activity, Notes, Graph, AI Cache
- `list_alert_rules` — Caller's alert rules with status & trigger counts.
- `create_alert_rule` — Provision a custom alert (entity filter, event types, channels, optional webhook target).
- `list_entity_activity` — Cross-entity activity feed (filterable by entity_type/entity_id).
- `list_entity_notes` — Notes the caller can see (own + shared; admins see all).
- `create_entity_note` — Attach a note to any entity, optionally shared with team.
- `get_entity_graph` — Relationship edges centered on an entity (donations, votes, lobbying).
- `get_vulnerability_score` — AI-cached vulnerability assessment for a candidate (`force=true` to regenerate).
- `get_talking_points` — AI-cached talking points by subject.
- `get_bill_impact` — AI-cached national/state/district bill impact analysis.

### Mutations (admin-keyed only)
- `create_polling_alert` — Provision a new polling alert.
- `pause_polling_alert`.
- `dispatch_polling_alert_test`.
- `admin_dispatch_alerts` — Force-run the `dispatch-alerts` cron job immediately.
- `admin_delete_entity_note` — Moderate by removing any user's note.
- `admin_update_entity_note` — Redact body or toggle is_shared on any note.
- `admin_create_graph_edge` — Insert a new relationship edge into `entity_relationships`.
- `admin_update_graph_edge` — Edit amount/weight/metadata on an existing edge.
- `admin_delete_graph_edge` — Remove a relationship edge.
- `admin_regenerate_ai` — Bust + regenerate cached AI analysis (`type=vulnerability_score|talking_points|bill_impact`).

## Security
- API key hashed with SHA-256 → `validate_api_key()` SQL function.
- `resolveCallerUser(req)` helper hashes the bearer token, looks up the owning user, and resolves admin role before any user-scoped or admin tool runs.
- Admin tools return `"Admin role required"` for non-admin keys instead of executing.
- Per-key rate limits (default: 600 req/hr) enforced by `api_request_logs` rolling window.
- `verify_jwt = false` in `supabase/config.toml` for `mcp-server` (uses API key auth instead of Supabase session JWTs).

## Sample MCP Client Config (Claude Desktop)
```json
{
  "mcpServers": {
    "ordb": {
      "url": "https://yysbtxpupmwkxovgkama.functions.supabase.co/mcp-server",
      "headers": { "Authorization": "Bearer ordb_…" }
    }
  }
}
```

See also [API Access](API-Access) for the parallel REST surface.
