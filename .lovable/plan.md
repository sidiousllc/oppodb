# ORO — Competitor Parity Sweep Plan

Goal: bring ORO to feature parity with the leading platforms in 4 categories
(opposition research, political data/intel, polling & forecasting, campaign
finance & investigations) and ship every addition fully working.

Benchmarked against: Quorum, FiscalNote/PolicyNote, Axios Pro, NGP VAN,
Bluelabs, Civitech, Ballotpedia, GovTrack, FollowTheMoney/Aleph,
OpenSecrets, ProPublica, FollowTheMoney.org, Decision Desk HQ, 538,
Split Ticket.

---

## Phase 0 — Foundations (must land first)

These are shared primitives every later phase depends on. Without them the
later features ship as one-off silos.

1. **Saved Searches & Watchlists** (tables `saved_searches`, `watchlist_items`)
   - Save any OppoDB / OppoHub / DataHub query as a named view.
   - Subscribe a watchlist to entities (candidate, district, bill, donor,
     country, market). Powers alerts in Phase 2.
2. **Notes & Annotations** (table `entity_notes`)
   - Per-user + shared notes pinned to ANY entity (candidate, district, bill,
     finance record, poll, market, country, briefing).
   - Markdown body, mentions, attachments via storage bucket.
3. **Tags everywhere** — extend existing tagging system to bills, finance
   records, polls, briefings, markets. Tag-driven smart lists.
4. **Activity feed** (table `entity_activity`) — append-only timeline of every
   change/sync event keyed to an entity. Powers "what's new", alerts, war room.
5. **Storage bucket `oro-attachments`** (private, RLS by user/share) for note
   attachments, war room files, exported reports.

## Phase 1 — Opposition Research parity (Quorum / NGP / Civitech)

1. **Tracker Workflows** — `trackers`, `tracker_items`, `tracker_assignments`
   - Kanban + list views (To research / In review / Approved / Published).
   - Assign user, due date, status, priority, linked entity.
2. **War Room** — shared workspace per race with pinned notes, files,
   trackers, live chat (reuse `chat_messages`), and activity feed scoped
   to that race.
3. **Vulnerability Scoring** — AI pass over each candidate profile that
   produces a 0-100 score across Personal / Policy / Finance / Statements /
   Associations, with citations. Stored on `candidate_vulnerability_scores`.
4. **Talking-points & Rapid-response generator** — Lovable AI endpoint that
   takes a candidate + topic and returns ATTACK / DEFENSE / Q&A blocks; one
   click pushes into a tracker item.
5. **Surrogate / Spokesperson pages** — extend candidate subpages with
   `relationship_type` (donor, surrogate, family, business partner) so the
   network graph in Phase 4 can render them.

## Phase 2 — Political data/intel parity (FiscalNote / Axios Pro / Ballotpedia)

1. **Bill & race watchlists with real-time alerts**
   - `alert_subscriptions` (entity_type, entity_id, channel email/push,
     event mask: status_change / new_action / new_cosponsor / new_poll /
     rating_change / new_finance_filing).
   - Edge function `alert-dispatcher` runs on every sync and on a schedule;
     reuses existing pgmq + Resend pipeline.
2. **Stakeholder CRM** — `stakeholders`, `stakeholder_interactions` (call,
   meeting, email, event); link to bills they care about and candidates they
   support. Relationship score auto-computed from interaction recency.
3. **Bill impact analysis** — automatic AI summary, plain-English explainer,
   stance-by-cosponsor heatmap, similar-bill clustering.
4. **Regulatory/agency tracking tab** under LegHub — Federal Register +
   IG reports cross-referenced to bills and members.
5. **Daily briefing email** — auto-generated per user from their watchlists +
   activity feed; respects existing `email_notification_preferences`.

## Phase 3 — Polling & forecasting parity (538 / DDHQ / Split Ticket)

1. **Race scenario simulator**
   - Slider UI: tweak national environment, partisan turnout, candidate
     quality, fundraising. Recalculate every race using existing forecast
     blend; show House/Senate/Gov majority probability.
   - Save scenario snapshots (`forecast_scenarios`).
2. **Polling aggregator with house-effect adjustment** — extend
   `polling_data` with pollster ratings, weight by recency / sample / rating;
   surface a blended average per race.
3. **Polling vs forecast vs market triangulation chart** on every race page.
4. **Toplines & crosstabs viewer** — store raw crosstabs JSON on
   `polling_data.crosstabs`, render filterable table.
5. **Election Night live mode** — full-screen dashboard with auto-refreshing
   results, called races ticker, Decision Desk-style call confidence;
   reuses civic-api-proxy + new `live-elections-stream` edge function.

## Phase 4 — Investigations parity (OpenSecrets / FtM / Aleph / ProPublica)

1. **Entity graph** — unified `entities` + `entity_relationships` tables
   modelled after FollowTheMoney schema (Person, Company, PAC, Committee,
   Asset, Payment, Membership). Backfilled from candidates, congress_members,
   campaign_finance, fara_registrants, federal_spending, prediction markets.
2. **Network visualiser** — interactive force-directed graph with path-finding
   ("show me how donor X connects to bill Y").
3. **Document search & redaction** — bucket `oro-documents`, extracted text
   (Lovable AI vision OCR for uploaded PDFs/images), full-text `documents_fts`
   index, snippet search across docs + notes + briefings.
4. **Donor & PAC deep-dive pages** mirroring OpenSecrets — top recipients,
   industry breakdown, in-state vs out-of-state, year-over-year.
5. **FARA / Lobbying disclosure cross-reference** — already have
   fara_registrants; add `lobbying_disclosures` sync from Senate LDA + link
   into entity graph.

## Phase 5 — Cross-cutting polish

- Public read-only "evidence pack" share links (token-gated, expires).
- Slack / Discord webhook outbound for any alert.
- Per-section "What's new since I was last here" badge driven by activity feed.
- Mobile drawer parity for every new section.
- Update Public API + MCP server with endpoints for all new tables/features.
- Documentation pages for every new feature (extends existing wiki).

---

## Sequencing rule

Ship **Phase 0 before anything else**. Then Phases 1-4 can run in parallel
because they each depend only on Phase 0 primitives. Phase 5 lands
continuously.

Each phase produces: migration → edge functions (if any) → UI →
Public API + MCP entries → documentation page. Nothing is "done" until all
five exist for that feature.

---

## Previous plans (kept for reference)

### Prediction Markets Trading Integration  *(SHIPPED)*

- `user_market_credentials` table, AES-256-GCM encryption via
  `INTEGRATION_ENCRYPTION_KEY`.
- `market-trading` edge function (portfolio / order CRUD).
- Trading dashboard UI in `MarketTradingPanel.tsx` and credentials manager
  in `MarketCredentialsManager.tsx`.
