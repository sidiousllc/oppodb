# Feature: Research Tools

## Description

The Research Tools section is a centralized **OSINT (Open-Source Intelligence) Workbench** within OppoDB. It consolidates investigative utilities — voter records, court records, and **71 OSINT tools** across People, Business, and Property — into a single dashboard, each backed by a "Full Subject AI" suite (analyst summary, talking points, vulnerability angle), themed Win98 result windows, and full Public API + MCP coverage.

---

## Architecture

### Section Layout

The Research Tools section (`research-tools`) renders a dashboard (`ResearchToolsDashboard`) with cards for each tool. Selecting a card opens a full-page subsection.

| Subsection            | Component             | Purpose                                                |
|-----------------------|-----------------------|--------------------------------------------------------|
| Voter Data            | `VoterDataSection`    | Voter registration, live races, finance, donations     |
| Court Records         | `CourtRecordsSearch`  | U.S. court case search via JudyRecords                 |
| **OSINT (71 tools)**  | `OSINTToolPanel`      | Unified search panel + Subject AI + themed result window |

### Navigation Flow

```
Sidebar: "Research Tools" → ResearchToolsDashboard
  ├── Voter Data       → VoterDataSection
  ├── Court Records    → CourtRecordsSearch
  └── osint:<id>       → OSINTToolPanel (driven by src/data/osintTools.ts)
```

State is managed via `researchSubsection` in `Index.tsx`. OSINT tools route under the `osint:<tool-id>` slug pattern. Master Search supports two passthrough slugs:

- `osint-tool:<id>` — open a tool panel pre-focused
- `osint-run:<id>:<query>` — for `url` tools, opens the deep-link in a new tab using the active query

### Themed Result Window

After an OSINT search returns, results render inside `OSINTResultWindow` — a draggable, resizable Win98 popup window themed via the user's selected style (Win98 → Win11). It surfaces:

- The full result set with key/value tables for every field
- Subject AI buttons (📋 Analyst Summary · 🎯 Talking Points · ⚠️ Vulnerability Score) with copy-to-clipboard
- Raw JSON in a collapsible section
- Window manager z-index handling so multiple OSINT searches can stack side-by-side

---

## OSINT Workbench (71 tools)

Tool registry: `src/data/osintTools.ts` (UI). Server-side mirror: `supabase/functions/_shared/osint-catalog.ts` (used by `public-api`, `mcp-server`, and `osint-search`). Keep both in sync when adding tools.

### Categories

**People & Identity (20)** — Username Search, HIBP Email Breach, Phone Reverse, Social Archive, Public Records Aggregator, Professional License Lookup, Sex-Offender Registry, Obituary & Genealogy, Gravatar, GitHub User Intel, SSDI / Death Index, Voter Registration, FEC Donor Search, JudyRecords State Courts, LinkedIn People Search, Twitter/X Advanced, Reddit User History, IP Geolocation & ASN, Discord ID, Telegram Username Check.

**Business & Corporate (20)** — SEC EDGAR, OpenCorporates, UCC Filings, Bankruptcy (RECAP), USPTO Trademark/Patent, SAM.gov Exclusions, FDA Enforcement, OpenSanctions/PEPs, OFAC SDN, World Bank Debarred Firms, USAspending Federal Awards, IRS Form 990, FEC Committees & PACs, Senate LDA Lobbying, DOJ FARA Registrants, D&B / DUNS, Secretary of State Business Search, OSHA Violations, EPA ECHO, NLRB Labor Cases.

**Property & Web Intel (11)** — Property/Deed Records, FAA Aircraft Registry, USCG Vessel Registry, Real Estate Transactions (Zillow), Wayback Machine, WHOIS / DNS, Certificate Transparency (crt.sh), URLScan.io, VirusTotal, AbuseIPDB, Wayback CDX (URL Inventory).

### Tool Kinds

| Kind     | Behavior                                                                 |
|----------|--------------------------------------------------------------------------|
| `url`    | Opens upstream provider in a new tab via templated `urlTemplate`         |
| `edge`   | POSTs to `osint-search` edge function; returns normalized JSON envelope  |
| `lookup` | Direct CORS GET from the browser (rare; legacy)                          |

### Backend: `supabase/functions/osint-search`

Single dispatcher with typed handlers (`username_search`, `email_breach`, `phone_lookup`, `social_archive`, `gravatar`, `github_user`, `reddit_user`, `ip_geo`, `sec_edgar`, `opencorporates`, `bankruptcy`, `sam_exclusion`, `fda_enforcement`, `opensanctions`, `usaspending`, `irs_990`, `wayback`, `whois_dns`, `crtsh`, `urlscan`, `virustotal`, `abuseipdb`, `wayback_cdx`). Each handler:

1. Validates the query (Zod)
2. Decrypts the caller's API key when required (`credential-vault`) — or accepts a service-role caller (`x-osint-caller: mcp-server`/`public-api`) and resolves the user via the API-key context
3. Calls the upstream provider and returns a normalized `{ results, source, fetched_at }` envelope

### API Key Management

Profile → **🔑 OSINT Keys** tab (`OSINTApiKeysTab`) lists every tool with a free-tier badge, "Get key" deep link, and an encrypted save form (AES-256-GCM via `credential-vault`, stored in `user_integrations`). If a tool is invoked without the required key, the panel deep-links the user to `?tab=osint-keys`.

Tools requiring keys: `email-breach` (HIBP), `phone-lookup` (NumVerify), `opencorporates`, `sam-exclusion` (SAM.gov), `whois-dns` (SecurityTrails), `virustotal`, `abuseipdb`. All other 64 tools are **no-key / free-tier**.

---

## Master Search Integration

The OSINT registry is indexed as a static **🔎 OSINT Research Tools** group in the global Master Search. Two slug patterns are produced:

- **Tool launchers** — typing `whois`, `opensanctions`, `nlrb`, etc. surfaces matching tools (label/description/source/tags). Click → `osint-tool:<id>` opens the panel.
- **Live query passthrough** — when the search query is non-empty, each result also exposes a `Run "<query>" in <Tool>` shortcut (`osint-run:<id>:<query>`) that, for `url` tools, deep-links straight to the upstream provider.

Slug routing lives in `src/pages/Index.tsx`.

---

## Public API & MCP Coverage

### REST endpoints (`/public-api`)

| Method | Path                  | Description                                              |
|--------|-----------------------|----------------------------------------------------------|
| GET    | `/osint/tools`        | List the full 71-tool catalog (filterable by category)   |
| GET    | `/osint/tools/{id}`   | Single tool metadata                                     |
| POST   | `/osint/search`       | Execute a tool (`{tool_id, query}`); URL tools return a deep-link, edge tools return upstream JSON. Uses the caller's stored OSINT keys for keyed providers. |

Authentication: `X-API-Key: ordb_…` (same scheme as the rest of the public API). Per-key rate limits (default 600 req/hr) apply.

### MCP tools (`/mcp-server`)

- `osint_list_tools({ category?, requires_key? })` — Enumerate the catalog.
- `osint_get_tool({ id })` — Single-tool metadata.
- `osint_search({ tool_id, query })` — Full passthrough; edge tools dispatch to `osint-search` with the caller's resolved user context, URL tools return a constructed deep-link.

Total MCP tool count is now **63+** across all groups.

---

## Court Records Search

Searches 660M+ U.S. court cases via [JudyRecords](https://www.judyrecords.com) — no API key. Results open on judyrecords.com. Supports `"exact phrase"`, `AND`/`OR`, `state:`, and `court:` operators. See `CourtRecordsSearch` for syntax helpers and recent-search cache.

---

## Voter Data (Moved)

Previously a top-level sidebar entry; now nested under Research Tools. `VoterDataSection` is unchanged — see [wiki/07-Additional-Features.md](07-Additional-Features.md) for full feature docs (NationBuilder/VAN/WinRed integrations, MIT Election Lab, voter stats, etc.).

---

## Components

| Component                | File                                      | Purpose                                |
|--------------------------|-------------------------------------------|----------------------------------------|
| `ResearchToolsDashboard` | `src/components/ResearchToolsDashboard.tsx` | Card grid for all 73+ tools           |
| `OSINTToolPanel`         | `src/components/OSINTToolPanel.tsx`       | Unified OSINT search UI + Subject AI   |
| `OSINTResultWindow`      | `src/components/OSINTResultWindow.tsx`    | Themed Win98 popup result window       |
| `OSINTApiKeysTab`        | `src/components/OSINTApiKeysTab.tsx`      | Profile tab for encrypted key storage  |
| `CourtRecordsSearch`     | `src/components/CourtRecordsSearch.tsx`   | JudyRecords search                     |
| `VoterDataSection`       | `src/components/VoterDataSection.tsx`     | Voter lookup (existing)                |

## Backend

| Function           | File                                              | Purpose                                  |
|--------------------|---------------------------------------------------|------------------------------------------|
| `osint-search`     | `supabase/functions/osint-search/index.ts`        | Dispatcher for 23 OSINT provider handlers |
| `credential-vault` | `supabase/functions/credential-vault/index.ts`    | AES-256-GCM key storage & decrypt        |
| `_shared/osint-catalog.ts` | `supabase/functions/_shared/osint-catalog.ts` | Server-side mirror of the 71-tool registry |

---

## Future Enhancements

- JudyRecords API integration for in-app result rendering
- Saved Searches persisted to database (per-user history)
- Cross-tool "Subject Dossier" combining results from all OSINT handlers into one AI-generated brief
- Webhook / scheduled OSINT monitors (alert when new sanctions / breaches / filings appear for a tracked subject)
