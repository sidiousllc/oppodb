# OppoDB - Opposition Research Database

Welcome to the OppoDB documentation wiki.

## Quick Links

- [Overview](Overview) — Architecture, tech stack, data models, and security
- [OppoHub](OppoHub) — Consolidated opposition research hub (Candidates, Local Impact, Narratives)
- [Candidate Profiles](Candidate-Profiles) — Research profiles, subpages, and voting records
- [District Intelligence](District-Intelligence) — Congressional district demographics and maps
- [Polling Data / DataHub](Polling-Data) — Polling visualization, prediction markets, and campaign finance
- [Campaign Finance](Campaign-Finance) — FEC and state-level finance tracking (accessed via DataHub)
- [LegHub](LegHub) — Consolidated legislative hub (State Legislatures + Legislation)
- [MessagingHub](MessagingHub) — Polling-based message guidance and communications strategy
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
- [LegHub](LegHub) — State Legislatures + Legislation in a unified tabbed interface
- [OppoDB Search](OppoDB-Search) — Unified master search across 14+ data categories
- [OppoHub](OppoHub) — Consolidated Candidates + Local Impact + Narratives
- [MessagingHub](MessagingHub) — Navigator Research message guidance

## About

OppoDB is a comprehensive opposition research database for political campaigns, consultants, and journalists. Built with React + TypeScript + Supabase, it features a nostalgic Windows 98 / AOL desktop interface wrapping modern political research tools.

## Key Features

- **50+ Edge Functions** for data sync, API access, email, and administration
- **Role-Based Access Control** with admin, moderator, premium, and user tiers
- **Role Groups** with automatic role synchronization
- **Invite & Access Request** workflows for controlled onboarding
- **Transactional Email Pipeline** with queue, suppression, and unsubscribe support
- **Public REST API** with 17+ endpoints covering all data sources
- **Prediction Market Trading** with encrypted credential storage for Kalshi, Polymarket, and PredictIt
- **MCP Server** with 18 tools for AI agent access (Claude, GPT, etc.)
- **Unified Master Search** across 14+ data categories with auto-debounced DB queries
- **OppoHub** — Consolidated Candidate Profiles + Local Impact + Narrative Reports in tabbed interface
- **LegHub** — Consolidated State Legislatures + Legislation in tabbed interface
- **MessagingHub** — Polling-based messaging guidance from Navigator Research
- **Poll Detail Windows** — Click any poll row for deep-dive analysis with charts
- **Market Detail Windows** — Click any prediction market for probability gauges and cross-platform comparison
- **In-App Mail & Chat** with real email notification delivery
- **Real-Time Presence** via AOL Buddy List
- **Documentation Wiki** accessible directly within the application (20 pages)
