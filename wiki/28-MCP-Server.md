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

---

## Phase 6 Tools (added)

### Geopolitics
- `get_country_geopolitics({ country_code })` — Cached brief (alliances, military, trade, stock markets, sources).
- `refresh_country_geopolitics({ country_code })` — Force-regenerate. Burns AI credits. Admin-only.

### International extras
- `list_international_elections({ country_code?, limit? })` — Election history per country.
- `list_international_leaders({ country_code?, limit? })` — Heads of state / PMs with terms.

### War Rooms
- `list_war_rooms()` — Returns rooms the caller owns or belongs to (deduped). Resolves caller via API key → user_id.
- `get_war_room_messages({ room_id, limit? })` — Member-gated message feed. Returns "Not a member of this war room" for non-members.

### Sync observability
- `get_sync_status({ source? })` — Latest 200 rows from `sync_run_log`. Surfaces the global 15-min cron's per-worker results so agents can detect stale data and decide whether to call `refresh_*` tools.

### Phase 7 — Messaging AI Suite
Cross-section AI tools that resonate MessagingHub items against polling, intel, legislation, finance, forecasts, and international context.

- `get_messaging_talking_points({ messaging_slug, audience?, angle? })` — Cached AI talking points filtered by audience/angle.
- `generate_messaging_talking_points({ messaging_slug, audience?, angle?, tone?, model?, include_sections? })` — Generate fresh talking points. `include_sections` accepts any of `polling`, `intel`, `legislation`, `finance`, `forecasts`, `international`.
- `get_messaging_audience_analysis({ messaging_slug })` — Cached effectiveness scoring (base/swing/independents/press/donors/opposition) with segment breakdown, resonance factors, and risks.
- `generate_messaging_audience_analysis({ messaging_slug, force_refresh?, model?, include_sections? })` — Generate fresh analysis. 7-day cache unless `force_refresh=true`.
- `get_messaging_impact({ messaging_slug, scope?, scope_ref? })` — Cached impact analyses (national/state/district scoped).
- `generate_messaging_impact({ messaging_slug, scope?, scope_ref?, model?, include_sections? })` — Generate fresh impact analysis.
- `get_messaging_ai_bundle({ messaging_slug })` — Combined item + talking points + audience + impact in one call. Powers PDF export and the `messaging_ai` report block.
- `admin_regenerate_messaging_ai({ type, messaging_slug, ... })` — [ADMIN] Force-bust + regenerate. `type` ∈ `talking_points|audience|impact`.

Total tool count: **52+** across all groups.
