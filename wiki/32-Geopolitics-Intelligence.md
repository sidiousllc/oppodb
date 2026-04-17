# Geopolitics Intelligence System

A hybrid AI-cached + multi-source intelligence brief for every country in the International Hub.

---

## Data Storage

Three columns added to `international_profiles`:

| Column | Type | Notes |
|--------|------|-------|
| `geopolitics` | jsonb | Structured brief (see schema below) |
| `geopolitics_generated_at` | timestamptz | Last AI regeneration |
| `geopolitics_model` | text | e.g. `google/gemini-2.5-flash` |

### Brief JSON schema (validated by edge function)
```ts
{
  alliances: { name: string; type: 'military'|'economic'|'political'; status: string }[],
  rivalries: { with: string; type: 'frozen'|'active'|'sanctions'; summary: string }[],
  military: {
    spending_usd: number; gdp_pct: number; active_personnel: number;
    nuclear: 'declared'|'undeclared'|'none'; major_systems: string[];
  },
  trade: { partners: { country: string; share_pct: number; flow: 'export'|'import' }[] },
  stock_markets: { index: string; market_cap_usd: number; top_listed: string[] }[],
  macro: {
    sp_rating?: string; moodys_rating?: string; fitch_rating?: string;
    central_bank_rate?: number; currency_regime?: string;
  },
  energy: { oil_reserves_bbl?: number; gas_reserves_m3?: number; critical_minerals?: string[] },
  soft_power: {
    rsf_press_freedom_rank?: number; ti_corruption_rank?: number; un_hdi_rank?: number;
  },
  sources: { name: string; url: string; accessed_at: string }[]
}
```

---

## `geopolitics-brief` Edge Function

### Input
```json
POST /functions/v1/geopolitics-brief
{ "country_code": "DE", "force": false }
```
- `force: true` bypasses the 30-day TTL cache.

### Pipeline
1. **Cache check** — return existing `geopolitics` if `generated_at > now() - 30 days` and `force !== true`.
2. **Live context gathering** — `Promise.all` of:
   - REST Countries (`/v3.1/alpha/{code}`) — capital, region, currency, UN status
   - Wikipedia REST (`/api/rest_v1/page/summary/{title}`) — narrative summary
   - World Bank API — GDP, inflation, debt, military personnel (multiple `indicator/*` endpoints)
   - Wikidata `wbgetentities` — diplomatic relations, organizational memberships (P530, P463)
3. **AI generation** via `lovable-ai-gateway` → `google/gemini-2.5-flash` with the live context as system prompt and a strict JSON schema. Falls back to `google/gemini-2.5-flash-lite` on rate limits.
4. **Persist** to `international_profiles` + emit a `sync_run_log` row with source `geopolitics`.

### Sources cited (15–25 per brief)
CIA World Factbook, SIPRI, IISS Military Balance, World Bank, IMF, OECD, NATO, UN, EU, ASEAN, BRICS, Wikipedia, Wikidata, REST Countries, RSF Press Freedom Index, Transparency International, S&P/Moody's/Fitch, central bank publications, Bloomberg/Reuters indices, EIA (energy).

---

## Auto-Refresh

The `scheduled-sync` cron rotates through 6 batches × 5 countries every 15 min — full 30-country coverage every ~90 minutes. Heavier countries (US, CN, RU, UA, IL, IR, KP) live in batches 0–1 and refresh first.

---

## UI

`CountryGeopoliticsTab` renders 6 collapsible sections:
1. **Alliances & Blocs** — table with status badges
2. **Rivalries & Conflicts** — color-coded by type
3. **Military & Defense** — spending, personnel, nuclear status, major systems
4. **Trade & Economics** — partner share bars, stock markets
5. **Macroeconomics** — credit ratings, central bank rate, currency
6. **Energy & Resources** — reserves, critical minerals
7. **Soft Power & Governance** — press freedom, corruption, HDI ranks
8. **Sources** — clickable list of citations

---

## API & MCP

| Surface | Operation |
|---------|-----------|
| `GET /public-api/geopolitics?country_code=DE` | Read cached brief |
| MCP `get_country_geopolitics` | Same, agent-friendly |
| MCP `refresh_country_geopolitics` | Force regenerate (admin) |

---

## Cost Controls

- 30-day TTL cache (configurable per country via `force`)
- Rotation batching limits AI calls to ~5 per 15 min
- Lite model fallback on rate-limit (HTTP 429)
- AI credit usage logged per request via `lovable-ai-gateway`
