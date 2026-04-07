# OppoDB — Opposition Research Database

## Overview

OppoDB is a comprehensive opposition research platform built for political campaigns, consultants, and journalists. It provides a unified database of candidate profiles, district intelligence, polling data, campaign finance records, and narrative research — all accessible through a retro Windows 98 / AOL-inspired interface.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **Database**: Supabase (PostgreSQL + Auth + Realtime + Edge Functions)
- **State Management**: React Context + React Query (TanStack Query)
- **Routing**: React Router v6
- **Charts**: Recharts
- **Markdown Rendering**: react-markdown
- **Icons**: Lucide React
- **AI Integration**: Lovable (AI tooling layer)
- **Hosting**: Lovable.dev + GitHub integration
- **Email**: Transactional email pipeline via Supabase Edge Functions + pgmq queue
- **Maps**: react-simple-maps (GeoJSON-based district maps)

## Application Architecture

```
src/
├── App.tsx                    # Root app, routing, providers
├── pages/                     # Route-level page components
│   ├── Index.tsx             # Main dashboard/browser
│   ├── AuthPage.tsx          # Login/signup/invite/request flows
│   ├── AdminPanel.tsx        # Admin management
│   ├── ApiPage.tsx           # API key management
│   ├── ProfilePage.tsx       # User profile & settings
│   ├── ResetPassword.tsx     # Password reset flow
│   └── UnsubscribePage.tsx   # Email unsubscribe
├── components/               # Reusable UI components
│   ├── Win98*.tsx            # Windows 98 chrome components
│   ├── AOL*.tsx              # AOL browser chrome components
│   ├── Candidate*.tsx        # Candidate-related components
│   ├── District*.tsx         # District-related components
│   ├── PollingSection.tsx    # DataHub (polling, prediction markets, campaign finance)
│   ├── CampaignFinanceSection # Campaign finance (DataHub tab)
│   ├── DocumentationSection  # In-app wiki reader
│   ├── AccessControlTab.tsx  # Admin invite/request management
│   ├── ChatPanel.tsx         # Real-time chat
│   └── ...
├── contexts/                 # React contexts
│   ├── AuthContext.tsx       # Authentication state
│   ├── MailContext.tsx       # AOL mail simulation
│   └── WindowManagerContext  # Window z-index management
├── data/                     # Data access layer (Supabase queries)
│   ├── candidates.ts         # Candidate profiles
│   ├── districtIntel.ts      # Congressional districts
│   ├── stateLegislativeIntel.ts  # State legislature
│   ├── pollingData.ts        # Polling data
│   ├── cookRatings.ts        # Cook Political ratings
│   ├── githubSync.ts         # GitHub content sync
│   └── ...
├── hooks/                    # Custom React hooks
│   ├── useIsAdmin.ts         # Admin role check
│   ├── useUserRole.ts        # Full role/permission check
│   └── use-mobile.tsx        # Mobile breakpoint detection
├── lib/                      # Utility and export functions
│   ├── adminApi.ts           # Admin user management API
│   ├── apiKeys.ts            # API key management
│   ├── contentAdmin.ts       # Content CRUD operations
│   ├── contentExport.ts      # PDF export
│   ├── pollingExport.ts      # CSV/PDF polling export
│   ├── districtExport.ts     # District PDF export
│   ├── districtDetailExport.ts  # Detailed district export
│   ├── stateLegExport.ts     # State leg PDF export
│   ├── electionExport.ts     # Election data export
│   └── researchLinkResolver.ts  # Internal slug linking
└── integrations/
    ├── supabase/             # Supabase client + types (auto-generated)
    └── lovable/              # Lovable integration

supabase/
├── config.toml               # Supabase configuration
├── functions/                 # Edge Functions
│   ├── admin-users/          # User management + invites + access requests
│   ├── auth-email-hook/      # Custom auth email rendering
│   ├── send-transactional-email/  # Transactional email pipeline
│   ├── send-mail-notification/    # In-app mail → email notifications
│   ├── process-email-queue/       # Email queue processor
│   ├── handle-email-unsubscribe/  # Unsubscribe handling
│   ├── handle-email-suppression/  # Bounce/complaint suppression
│   ├── public-api/           # REST API for external consumers (17 endpoints)
│   ├── mcp-server/           # MCP server for AI agents (18 tools)
│   ├── research-chat/        # AI research chat
│   ├── credential-vault/     # Encrypted credential storage
│   ├── campaign-finance-sync/# FEC data sync
│   ├── census-sync/          # Census Bureau data sync
│   ├── congress-sync/        # Congress.gov data sync
│   ├── election-results-sync/# Election results sync
│   ├── polling-sync/         # Polling data sync
│   ├── state-legislative-sync/  # State legislature sync
│   ├── mn-cfb-finance/       # Minnesota CFB finance
│   ├── state-cfb-finance/    # State CFB finance
│   ├── followthemoney/       # FollowTheMoney.org API
│   ├── legiscan/             # LegiScan legislative data
│   ├── opensecrets-sync/     # OpenSecrets data
│   ├── forecast-sync/        # Election forecast sync
│   ├── forecast-scrape/      # Forecast scraping
│   ├── voter-file-sync/      # Voter file import
│   ├── voter-lookup/         # Voter registration lookup
│   ├── voter-registration-stats/ # Voter registration stats
│   ├── state-voter-portal-lookup/# State voter portal
│   ├── sync-github/          # GitHub content sync
│   ├── version-history/      # Git version history
│   ├── scheduled-sync/       # Scheduled data sync
│   ├── integration-proxy/    # Integration proxy
│   ├── content-admin/        # Content management
│   ├── candidate-scraper/    # Candidate data scraping
│   ├── district-intel/       # District intelligence
│   ├── mit-election-sync/    # MIT Election Lab sync
│   ├── congressional-election-sync/ # Congressional election sync
│   ├── winred-webhook/       # WinRed donation webhook
│   ├── seed-polling/         # Polling data seeding
│   ├── revoke-sessions/      # Session revocation
│   ├── elevenlabs-sfx/       # Sound effects
│   └── preview-transactional-email/ # Email template preview
└── _shared/
    ├── email-templates/      # Auth email templates (React)
    └── transactional-email-templates/ # Transactional templates
```

## Key Data Models (Supabase)

### Tables
- `candidate_profiles` — Candidate research profiles (markdown content, slugs, subpages)
- `candidate_versions` — Git commit history for candidate files
- `district_profiles` — Congressional district demographics (Census ACS data)
- `state_legislative_profiles` — State legislature district demographics
- `polling_data` — Poll results (approval, generic ballot, issue, favorability)
- `campaign_finance` — FEC campaign finance records
- `mn_cfb_candidates` — Minnesota Campaign Finance Board data
- `state_cfb_candidates` — State-level campaign finance (multi-state)
- `congress_members` — Congress.gov member profiles
- `congress_bills` — Federal bill tracking
- `congress_committees` — Congressional committee data
- `congress_votes` — Roll call vote records
- `congressional_election_results` — Historical congressional election results
- `state_leg_election_results` — State legislative election results
- `mit_election_results` — MIT Election Lab historical data
- `election_forecasts` — Multi-source election forecasts
- `election_forecast_history` — Forecast rating change tracking
- `state_voter_stats` — State-level voter registration statistics (registered, eligible, turnout)
- `maga_files` — Trump administration appointee files
- `narrative_reports` — Thematic narrative reports
- `local_impacts` — State-level local impact reports
- `tracked_bills` — User-tracked legislation (LegiScan)
- `api_keys` — User API keys (hashed)
- `api_request_logs` — API request audit trail
- `user_roles` — RBAC role assignments (enum: admin, moderator, user)
- `role_groups` — Custom role group definitions
- `role_group_members` — User ↔ group mappings
- `profiles` — Extended user profiles (display_name, avatar_url)
- `user_invitations` — Invite tokens for access
- `access_requests` — Public access request queue
- `user_mail` — In-app AOL mail messages
- `user_presence` — Online/offline status for buddy list
- `chat_messages` — Real-time instant messaging
- `user_integrations` — Third-party API key vault (encrypted)
- `winred_donations` — WinRed donation webhook data
- `sync_metadata` — GitHub sync state tracking
- `suppressed_emails` — Email bounce/complaint suppression list
- `email_unsubscribe_tokens` — Unsubscribe token management
- `email_send_log` — Email delivery audit log
- `email_send_state` — Email queue configuration (batch size, delays, TTLs)

### Database Functions
- `has_role(uuid, app_role)` — SECURITY DEFINER role check (prevents RLS recursion)
- `validate_api_key(text)` — API key hash validation
- `increment_api_key_usage(uuid)` — Atomic request counter
- `log_api_request(uuid, uuid, text, int)` — Request audit logging
- `handle_new_user()` — Trigger: auto-create profile on signup
- `track_forecast_rating_change()` — Trigger: log forecast rating changes
- `enqueue_email(text, jsonb)` — pgmq email queue insertion
- `read_email_batch(text, int, int)` — pgmq batch reader
- `delete_email(text, bigint)` — pgmq message deletion
- `move_to_dlq(text, text, bigint, jsonb)` — Dead letter queue handler

## User Roles & Permissions

| Role | Access |
|------|--------|
| **user** | Read-only access to all public data |
| **premium** | Read access + API key generation + MCP access |
| **moderator** | Premium + can manage content (candidates, MAGA files, narratives) |
| **admin** | Full access including user management, role assignment, and access control |

Roles are stored in a dedicated `user_roles` table using the `app_role` enum. Role checks use the `has_role()` SECURITY DEFINER function to prevent RLS recursion. Role Groups provide an additional layer of team-based access control with automatic role synchronization.

## UI Theme: Win98 + AOL Desktop

The application wraps its modern functionality in a nostalgic Windows 98 / AOL desktop environment:
- **Win98Window** — Draggable/resizable window chrome with classic title bar buttons
- **Win98Taskbar** — Classic taskbar at the bottom with Start button
- **AOLToolbar** — AOL Browser-style navigation toolbar with Back/Forward/Refresh
- **AOLBuddyList** — Real-time AIM-style buddy list with presence tracking
- **AOLMailWindow** — Functional in-app mail system with email notifications
- **Win98Desktop** — Desktop view when the main window is minimized
- **AOLDialUpAnimation** — Nostalgic dial-up modem connection screen on auth page

This design choice makes heavy political research data feel approachable and distinctive.

## Email Infrastructure

OppoDB uses a sophisticated email pipeline:
1. **Auth Emails**: Custom React-rendered templates via `auth-email-hook` (signup confirmation, password reset, magic link, invite)
2. **Transactional Emails**: Pipeline via `send-transactional-email` → pgmq queue → `process-email-queue` → Resend API
3. **Mail Notifications**: In-app mail triggers real email via `send-mail-notification` → `send-transactional-email`
4. **Suppression**: Automatic bounce/complaint handling via `handle-email-suppression`
5. **Unsubscribe**: One-click unsubscribe via tokenized links and `handle-email-unsubscribe`

## Security

OppoDB uses defense-in-depth security:
- **Signature-Verified JWT Authentication** on all edge functions using `getClaims()` (cryptographic signature verification, not base64 decoding)
- **Row Level Security (RLS)** policies on all tables
- **SECURITY DEFINER** functions for role checks (prevents RLS recursion)
- **SSRF Protection** on URL construction (domain allowlisting, protocol restriction)
- **API Key Hashing** (bcrypt, only prefix visible)
- **Encrypted Credential Vault** for third-party API keys
- **Email Suppression** for bounce/complaint handling
- **Restricted RLS on sensitive tables**: `user_invitations` (admin-only SELECT), `role_groups` (authenticated-only SELECT)
- Auth via email/password with invite-only or access-request user creation
- Production domain pinning for auth redirects (prevents Lovable preview gate)
