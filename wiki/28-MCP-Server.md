# MCP Server

The **Model Context Protocol (MCP) server** exposes OppoDB data and operations to AI agents (Claude Desktop, Cursor, ChatGPT desktop, custom LLM clients) using the standard MCP transport.

## Endpoint
- URL: `https://<project>.functions.supabase.co/mcp-server`
- Transport: HTTP+SSE (streamable).
- Auth: API key passed via `Authorization: Bearer ordb_<key>` header. Generate keys at **Profile → API Keys**.

## Tool Catalogue (24+)

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

### Mutations (admin-keyed only)
- `create_polling_alert` — Provision a new alert.
- `pause_polling_alert`.
- `dispatch_polling_alert_test`.

## Security
- API key hashed with SHA-256 → `validate_api_key()` SQL function.
- `resolveUserId(req)` helper hashes the bearer token and looks up the owning user before any user-scoped tool runs.
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
