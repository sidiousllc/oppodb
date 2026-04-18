# InternationalHub

**InternationalHub** is OppoDB's global intelligence module covering 140+ countries, organized by continental subsections.

## Location
- **Sidebar entry**: `InternationalHub` (icon: 🌐). Routed as `internationalhub`.
- **File**: `src/components/InternationalHub.tsx`, `src/components/CountryDetail.tsx`, `src/data/internationalCountries.ts`.

## Subsections (Continental Tabs)
1. **Europe** — EU members, UK, Ukraine, Balkans, Russia.
2. **Americas** — Canada, Mexico, Central & South America, Caribbean.
3. **Asia-Pacific** — China, Japan, Korea, ASEAN, Australia/NZ, India, Pakistan.
4. **Middle East & North Africa** — GCC, Levant, Iran, Maghreb.
5. **Sub-Saharan Africa** — All AU member states.
6. **Multilateral** — UN, NATO, G7/G20, IMF, World Bank, WTO references.

## Country Detail Tabs
When a country is selected, `CountryDetail.tsx` opens with:

1. **Overview** — Capital, government type, head of state/government, population, GDP, currency, official languages, key statistics from `international_country_profiles`.
2. **Leadership** — Current leaders (`international_leaders`) with bio, party, term dates, controversies list.
3. **Elections** — Past and upcoming elections (`international_elections`) with turnout, results JSON, winner.
4. **Legislation** — Major bills/laws (`international_legislation`) by status (introduced, debated, enacted, repealed).
5. **Polling** — Country-specific polls (`international_polling`) with approve/disapprove and issue questions.
6. **Policy Issues** — Active issues (`international_policy_issues`) tagged by category, severity, affected regions.
7. **News** — IntelHub international-scope feeds filtered by country.

## Edge Functions
- `international-sync` — Bulk country profile/election/leader sync.
- `intel-briefing` — International scope briefings.

## Database Tables
- `international_country_profiles`
- `international_leaders`
- `international_elections`
- `international_legislation`
- `international_polling`
- `international_policy_issues`

## AI Intelligence (Country)

`CountryDetail.tsx` mounts a `SubjectAIPanel` with `subject_type="country"` and `subject_ref=<country_code>` (e.g. `DEU`, `JPN`). Three sub-tabs:

| Tab | Edge function | Cache table |
|-----|---------------|-------------|
| Talking Points | `subject-talking-points` | `talking_points` |
| Audience Fit | `subject-audience-analysis` | `subject_audience_analyses` (7-day cache) |
| Impact | `subject-impact-analysis` | `subject_impact_analyses` (per-scope) |

Cross-section context pulls from `polling_data`, `intel_briefings`, `congress_bills`, `campaign_finance`, `election_forecasts`, plus the country's own `international_profiles` row. Surfaced via REST (`/public-api/v1/subject-ai-bundle?subject_type=country&subject_ref=DEU`) and MCP (`generate_subject_*`, `get_subject_ai_bundle`).
