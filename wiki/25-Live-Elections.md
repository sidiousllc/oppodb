# Live Elections

The **Live Elections** section tracks upcoming races and surfaces real-time results on election night via the Google Civic API and AP-aligned sources.

## Location
- **Sidebar entry**: `Live Elections` (icon: 🏛️). Routed as `live-elections`.
- **File**: `src/components/LiveElectionsSection.tsx`, `src/components/CongressionalElectionsSection.tsx`, `src/components/StateLegislativeSection.tsx`.

## Tabs
1. **Upcoming** — Federal, state, and local races within next 90 days. Pulled from `election_calendar` table.
2. **Live Results** — On election night, this tab polls `civic-api-proxy` every 60s and renders precinct-level reporting.
3. **Federal Races** — House, Senate, Presidential. Combines `congressional_election_results` historicals + current cycle forecasts.
4. **State Legislative** — Cross-references `state_legislative_intel` with current cycle filings.
5. **Ballot Measures** — Initiatives, referenda, recalls (where Civic API provides data).

## Edge Functions
- `civic-api-proxy` — Server-side proxy for Google Civic Information API (rate-limited, key hidden from client).
- `state-voter-portal-lookup` — State-specific SOS lookups.
- `voter-registration-stats` — Aggregate registration counts.

## Sample Refresh Flow
```
LiveElectionsSection → useEffect(60s) → supabase.functions.invoke('civic-api-proxy', { body: { electionId, district } })
  → Civic API → reshape → cache in election_results_live → render
```

## Maps
- Presidential county-level: `PresidentialCountyMap.tsx` (uses `public/counties-10m.json`).
- Congressional district overlay: `DistrictBoundaryMap.tsx` (uses `public/us-cd-118.json`).
