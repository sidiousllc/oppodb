# Sync Pipeline — Auto-Refresh Architecture

The application uses a **two-tier sync model**: a global server-side cron that ingests data from upstream sources, and per-user client refresh preferences that control how frequently the React app re-fetches from the database.

---

## Tier 1 — Global Server Cron (every 15 minutes)

A `pg_cron` job (`scheduled-sync-15min`) invokes the `scheduled-sync` edge function every 15 minutes via `pg_net.http_post`. The cron is registered in the Postgres database, not in `supabase/config.toml`, because it carries the service-role bearer token.

### Cron registration
```sql
SELECT cron.schedule(
  'scheduled-sync-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/scheduled-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('trigger', 'cron', 'invoked_at', now())
  );
  $$
);
```

### `scheduled-sync` orchestration
The function fans out to **14 downstream sync workers**, batching state-level work to stay under edge-function timeouts:

| # | Source | Worker | Strategy |
|---|--------|--------|----------|
| 1 | GitHub research repo | `sync-github` | Full pull, diff against `candidate_versions` |
| 2 | State election results | `election-results-sync` | 5-state batch, rotating offset stored in `sync_metadata` id=2 |
| 3 | Congressional elections | `congressional-election-sync` | 5-state batch, offset id=3 |
| 4 | Federal campaign finance | `campaign-finance-sync` | 5-state batch, offset id=4 |
| 5 | State CFB (MN, PA, MI) | `mn-cfb-finance`, `state-cfb-finance` | All 3 every run |
| 6 | Prediction markets | `prediction-markets-sync` | Polymarket + Kalshi + Metaculus + Manifold + PredictIt |
| 7 | International profiles | `international-sync` | Top 18 countries, full upsert |
| 8 | Candidate auto-discovery | `candidate-scraper` | 5/run, only for members lacking profiles |
| 9 | Polling | `polling-sync` | RealClearPolitics + 538 + state pollsters |
| 10 | Forecasts | `forecast-sync` | Cook + Sabato + Inside Elections |
| 11 | Congress | `congress-sync` | Members + bills + votes (incremental) |
| 12 | Geopolitics briefs | `geopolitics-brief` | 6-batch rotation × 5 countries (full coverage every ~90 min) |
| 13 | Intel briefings | `intel-briefing` | News clusters + bias coverage |
| 14 | Lobbying / contracts / courts | `lobbying-sync`, `contracts-sync`, `court-cases-sync` | Full upsert |

### `sync_run_log`
Every sync step writes a row:

| Column | Type | Notes |
|--------|------|-------|
| `source` | text | e.g. `polling`, `geopolitics`, `congress`, `all` |
| `status` | text | `success` / `error` / `partial` / `skipped` |
| `rows_synced` | int | Worker-reported count |
| `error_message` | text | Captured exception |
| `duration_ms` | int | Wall clock |
| `started_at` / `finished_at` | timestamptz | |

**RLS**: any authenticated user can read; only service-role inserts. Surfaces in Profile → Sync.

---

## Tier 2 — Per-User Client Preferences

Stored in `user_sync_preferences` (one row per user × source):

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `source` | text | — | Source key: `all`, `polling`, `prediction_markets`, `geopolitics`, `congress`, `intel`, `forecasts`, `elections`, `lobbying`, `courts`, `campaign_finance` |
| `interval_minutes` | int | 15 | Allowed range 5–1440. Drives client refetch interval. |
| `enabled` | bool | true | Disables auto-refetch for that source |

**RLS**: per-user (owner can SELECT/INSERT/UPDATE/DELETE; nobody else).

The `SyncPreferencesPanel` component (Profile → Sync tab) renders a table of all sources with dropdowns for interval and an enabled checkbox. Changes are upserted on the spot.

---

## API Surface

REST: `GET /public-api/sync-status?source=polling`, `GET /public-api/sync-preferences`.
MCP: `get_sync_status` tool.

---

## Failure Handling

- Per-step `try/catch`: one failing worker never aborts the cron run.
- Errors recorded with `status='error'` and `error_message` for dashboard visibility.
- Heavy AI sources (geopolitics) use **rotation indexing** (`Math.floor(Date.now() / 900_000) % 6`) so each 15-min tick hits a different 5-country batch — full 30-country coverage every ~90 minutes without burning AI credits.

---

## Manual Trigger

Admins can force-run via `POST /public-api/admin-dispatch-alerts` (alerts only) or directly invoke `scheduled-sync` from the Admin Panel → Phase 5 → Manual Sync button (service-role bearer).

---

## Related

- [Data Sync & Sources](Data-Sync-and-Sources) — per-worker details
- [API Access](API-Access) — REST contract
- [MCP Server](MCP-Server) — agent tools
