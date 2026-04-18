# Feature: Research Tools

## Description

The Research Tools section is a centralized **OSINT (Open-Source Intelligence) Workbench** within OppoDB. It consolidates investigative utilities — voter records, court records, and **21 OSINT tools** across People, Business, and Property — into a single dashboard, each backed by a "Full Subject AI" suite (analyst summary, talking points, vulnerability angle).

---

## Architecture

### Section Layout

The Research Tools section (`research-tools`) renders a dashboard (`ResearchToolsDashboard`) with cards for each tool. Selecting a card opens a full-page subsection.

| Subsection            | Component             | Purpose                                                |
|-----------------------|-----------------------|--------------------------------------------------------|
| Voter Data            | `VoterDataSection`    | Voter registration, live races, finance, donations     |
| Court Records         | `CourtRecordsSearch`  | U.S. court case search via JudyRecords                 |
| **OSINT (21 tools)**  | `OSINTToolPanel`      | Unified search panel + Subject AI for each registered tool |

### Navigation Flow

```
Sidebar: "Research Tools" → ResearchToolsDashboard
  ├── Voter Data       → VoterDataSection
  ├── Court Records    → CourtRecordsSearch
  └── osint:<id>       → OSINTToolPanel (driven by src/data/osintTools.ts)
```

State is managed via `researchSubsection` in `Index.tsx`. OSINT tools route under the `osint:<tool-id>` slug pattern.

---

## OSINT Workbench (21 tools)

Tool registry: `src/data/osintTools.ts`. Each entry declares:

- **`kind`**: `"url"` (open external search), `"edge"` (call `osint-search` function), or `"lookup"` (direct CORS GET)
- **`apiKey`** (optional): `service`, help URL, free-tier flag — keys are stored AES-256-GCM encrypted in `user_integrations` via the `credential-vault` function
- **`aiSubjectType`**: drives the Subject AI suite (`person | org | asset | domain`)

### Categories

**People & Identity (8)** — Username Search, HIBP Email Breach, Phone Reverse, Social Archive, People Search Aggregator, Voter Registration (cross-state), Death Index, Sex-Offender Registry.

**Business & Corporate (7)** — SEC EDGAR, OpenCorporates, UCC Filings, Bankruptcy (PACER), USPTO Trademark, USPTO Patent, FINRA BrokerCheck.

**Property & Web Intel (6)** — Property/Deed Records, FAA Aircraft Registry, USCG Vessel Registry, Wayback Machine, WHOIS / DNS, Shodan Host Scan.

### Backend: `supabase/functions/osint-search`

Single dispatcher with 12 typed handlers. Each handler:
1. Validates the query (Zod)
2. Decrypts the caller's API key when required (`credential-vault`)
3. Calls the upstream provider and returns a normalized `{ results, source, fetched_at }` envelope

### API Key Management

Profile → **🔑 OSINT Keys** tab (`OSINTApiKeysTab`) lists every tool with a free-tier badge, "Get key" deep link, and an encrypted save form. If a tool is invoked without the required key, the panel deep-links the user to `?tab=osint-keys`.

---

## Court Records Search

Searches 400M+ U.S. court cases via [JudyRecords](https://www.judyrecords.com) — no API key. Results open on judyrecords.com. Supports `"exact phrase"`, `AND`/`OR`, `state:`, and `court:` operators. See `CourtRecordsSearch` for syntax helpers and recent-search cache.

---

## Voter Data (Moved)

Previously a top-level sidebar entry; now nested under Research Tools. `VoterDataSection` is unchanged — see [wiki/07-Additional-Features.md](07-Additional-Features.md) for full feature docs (NationBuilder/VAN/WinRed integrations, MIT Election Lab, voter stats, etc.).

---

## Master Search / API / MCP Coverage

- **In-app Master Search** indexes the OSINT registry as a static "🔎 OSINT Research Tools" group — typing matches a tool's label, description, source, or tags routes the user to the corresponding `osint:<id>` panel.
- **Public API & MCP `master_search`** continue to cover the 48 database-backed categories (see [wiki/18-OppoDB-Search.md](18-OppoDB-Search.md)). External clients can enumerate OSINT tools via the `OSINT_TOOLS` registry shipped in the frontend bundle and invoke `osint-search` directly with a per-user API key.

---

## Components

| Component                | File                                      | Purpose                                |
|--------------------------|-------------------------------------------|----------------------------------------|
| `ResearchToolsDashboard` | `src/components/ResearchToolsDashboard.tsx` | Card grid for all 23+ tools            |
| `OSINTToolPanel`         | `src/components/OSINTToolPanel.tsx`       | Unified OSINT search UI + Subject AI   |
| `OSINTApiKeysTab`        | `src/components/OSINTApiKeysTab.tsx`      | Profile tab for encrypted key storage  |
| `CourtRecordsSearch`     | `src/components/CourtRecordsSearch.tsx`   | JudyRecords search                     |
| `VoterDataSection`       | `src/components/VoterDataSection.tsx`     | Voter lookup (existing)                |

## Backend

| Function       | File                                       | Purpose                                  |
|----------------|--------------------------------------------|------------------------------------------|
| `osint-search` | `supabase/functions/osint-search/index.ts` | Dispatcher for 12 OSINT provider handlers |
| `credential-vault` | `supabase/functions/credential-vault/index.ts` | AES-256-GCM key storage & decrypt    |

---

## Future Enhancements

- JudyRecords API integration for in-app result rendering
- Saved Searches persisted to database (per-user history)
- Cross-tool "Subject Dossier" combining results from all OSINT handlers into one AI-generated brief
