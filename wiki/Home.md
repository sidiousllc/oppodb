# OppoDB - Opposition Research Database

Welcome to the OppoDB documentation wiki.

## Quick Links

- [Overview](Overview) — Architecture, tech stack, data models, and security
- [OppoHub](OppoHub) — Consolidated opposition research hub (Candidates, Local Impact, Narratives)
- [Candidate Profiles](Candidate-Profiles) — Research profiles, subpages, and voting records
- [District Intelligence](District-Intelligence) — Congressional district demographics, maps, and Issues & Impact
- [Polling Data / DataHub](Polling-Data) — Polling visualization, prediction markets, and campaign finance
- [Campaign Finance](Campaign-Finance) — FEC and state-level finance tracking with historical cycles (accessed via DataHub)
- [LegHub](LegHub) — Consolidated legislative hub (State Legislatures + Legislation)
- [MessagingHub](MessagingHub) — Multi-partisan message guidance from 30+ organizations
- [IntelHub](IntelHub) — Intelligence briefings from 90+ RSS sources across 4 scopes
- [Additional Features](Additional-Features) — MAGA files, narratives, in-app mail, documentation wiki, email pipeline
- [Authentication & User Management](Authentication-and-User-Management) — Auth flows, RBAC, invites, access requests
- [API Access](API-Access) — REST API, MCP server, API key management
- [UI Design System](UI-Design-System) — Win98/AOL theme, components, and styling
- [Data Sync & External Sources](Data-Sync-and-Sources) — Edge functions, external APIs, sync processes
- [Cook Ratings & Forecasting](Cook-Ratings-and-Forecasting) — PVI, ratings, forecast models
- [Admin Panel](Admin-Panel) — User management, content CRUD, role groups, access control
- [Research Tools](Research-Tools) — Court records search, voter data, and investigative tools
- [Prediction Market Trading](Prediction-Market-Trading) — Trading integration, API key management, portfolio & orders
- [Android App](Android-App) — Download APKs, build instructions, and version history
- [OppoDB Search](OppoDB-Search) — Unified master search across 15+ data categories
- [MCP Server](MCP-Server) — 42+ agent tools for Claude/GPT/Cursor over the full database
- [Documentation System](Documentation-System) — How the in-app wiki itself works
- [Sync Pipeline](Sync-Pipeline) — 15-min global cron + per-user preferences
- [War Rooms](War-Rooms) — Collaborative spaces with shared notes, alerts, and chat
- [Geopolitics Intelligence](Geopolitics-Intelligence) — AI-cached country briefs from 15+ sources

## About

OppoDB is a comprehensive opposition research database for political campaigns, consultants, and journalists. Built with React + TypeScript + Supabase, it features a nostalgic Windows 98 / AOL desktop interface wrapping modern political research tools.

## Key Features

- **7 Windows Desktop Themes** — Win98, XP, Vista, 7, 8, 10, 11 with light & dark mode variants
- **Theme Preview Thumbnails** — Visual theme selector with preview screenshots
- **Cross-Device Theme Sync** — Theme preferences stored in database, synced on login
- **50+ Edge Functions** for data sync, API access, email, and administration
- **Role-Based Access Control** with admin, moderator, premium, and user tiers
- **Role Groups** with automatic role synchronization
- **Invite & Access Request** workflows for controlled onboarding
- **Transactional Email Pipeline** with queue, suppression, and unsubscribe support
- **Public REST API** with 22+ endpoints covering all data sources
- **Prediction Market Trading** with encrypted credential storage for Kalshi, Polymarket, and PredictIt
- **MCP Server** with 18 tools for AI agent access (Claude, GPT, etc.)
- **Unified Master Search** across 15+ data categories with auto-debounced DB queries
- **OppoHub** — Consolidated Candidate Profiles + Local Impact + Narrative Reports in tabbed interface
- **LegHub** — Consolidated State Legislatures + Legislation in tabbed interface
- **IntelHub** — Intelligence briefings from 90+ RSS/Atom sources across local, state, national, and international scopes with full article rendering
- **MessagingHub** — Multi-partisan messaging guidance from 30+ organizations (Navigator Research, CAP, AEI, Brookings, Third Way, Data for Progress, etc.)
- **Campaign Finance** — FEC data synced across all 50 states with historical cycles (2012–2026), OpenSecrets integration, and state-level CFB data
- **Poll Detail Windows** — Click any poll row for deep-dive analysis with charts
- **Market Detail Windows** — Click any prediction market for probability gauges and cross-platform comparison
- **In-App Mail & Chat** with real email notification delivery
- **Real-Time Presence** via AOL Buddy List
- **Documentation Wiki** accessible directly within the application (20+ pages, admin-editable via database)
- **Admin Documentation Management** — Create, edit, and publish wiki pages from the Admin Panel with sync status indicator (last sync time + commit SHA)
- **GitHub Sync Status** — Admin Panel shows last sync timestamp and commit SHA from `sync_metadata`
- **District Issues & Impact** — Deep-dive tab with election forecasts, relevant polling, legislation, campaign finance, opposition research, and state legislative history per district

## Recent Updates (April 2026)

### Campaign Finance Overhaul
- `campaign-finance-sync` edge function now supports `state=ALL` for bulk 50-state sync
- Historical cycle support: `historical=true` parameter syncs cycles 2012–2026
- Default sync now pulls both 2024 and 2026 cycles
- UI: Cycle filter dropdown (2012–2026) and "Sync All" button added to DataHub Campaign Finance tab
- `scheduled-sync` automatically includes historical cycles on first batch rotation
- Aggregate rows per state per cycle track total raised/spent/COH

### IntelHub Expansion
- Expanded from ~20 to 90+ RSS/Atom sources across all scopes (international, national, state, local)
- Automated category detection (economy, health, immigration, etc.) via keyword matching
- Parallelized fetching in batches of 10 for performance
- Full article text rendering via `scrape-article` edge function (strips ads/navigation)

### MessagingHub Expansion
- Expanded from 7 initial reports to 30+ scrapers using `makeSearchScraper` factory
- Sources now include CAP, Third Way, AEI, Brookings, Data for Progress, Heritage Foundation, and more
- Expanded keyword set (40+ terms) for automated issue area detection
- Multi-partisan coverage: Democrat, Republican, and Independent organizations

### District Intelligence Enhancement
- Issues & Impact tab now fetches 6 additional data sections per district:
  - Election forecasts (source, rating, win probabilities)
  - Relevant polling matched to district top issues
  - Intelligence briefings filtered by state
  - Campaign finance for district candidates
  - Current representatives from Congress data
  - Relevant federal legislation matched by policy area
  - State legislative election history
  - Opposition research (MAGA Files) relevant to local issues

### Security Hardening
- `version-history` edge function: Added JWT authentication + admin role verification
- `congressional-election-sync` edge function: Added JWT + admin auth, restricted CORS
- Signature-verified JWT via `getClaims()` on all sync functions
- `campaign-finance-sync`: Now accepts service-role tokens for scheduled-sync cron calls
