# OppoDB — Opposition Research Database

## Overview

OppoDB is a comprehensive opposition research platform built for political campaigns, consultants, and journalists. It provides a unified database of candidate profiles, district intelligence, polling data, campaign finance records, and narrative research — all accessible through a retro Windows 98 / AOL-inspired interface.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **Database**: Supabase (PostgreSQL + Auth + Realtime)
- **State Management**: React Context + React Query (TanStack Query)
- **Routing**: React Router v6
- **Charts**: Recharts
- **Markdown Rendering**: react-markdown
- **Icons**: Lucide React
- **AI Integration**: Lovable (AI tooling layer)
- **Hosting**: Lovable.dev + GitHub integration

## Application Architecture

```
src/
├── App.tsx                    # Root app, routing, providers
├── pages/                     # Route-level page components
│   ├── Index.tsx             # Main dashboard/browser
│   ├── AuthPage.tsx          # Login/signup/invite flows
│   ├── AdminPanel.tsx        # Admin management
│   ├── ApiPage.tsx           # API key management
│   └── ProfilePage.tsx       # User profile
├── components/               # Reusable UI components
│   ├── Win98*.tsx            # Windows 98 chrome components
│   ├── AOL*.tsx              # AOL browser chrome components
│   ├── Candidate*.tsx        # Candidate-related components
│   ├── District*.tsx         # District-related components
│   ├── PollingSection.tsx    # Polling visualization
│   ├── CampaignFinancePanel  # FEC finance data
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
│   ├── campaignFinance.ts    # FEC finance
│   ├── cookRatings.ts        # Cook Political ratings
│   ├── githubSync.ts         # GitHub content sync
│   └── ...
├── lib/                      # Utility and export functions
│   ├── apiKeys.ts            # API key management
│   ├── contentExport.ts      # PDF export
│   ├── pollingExport.ts      # CSV/PDF polling export
│   └── researchLinkResolver.ts  # Internal slug linking
└── integrations/
    ├── supabase/             # Supabase client + types
    └── lovable/              # Lovable integration
```

## Key Data Models (Supabase)

### Tables
- `candidates` — Candidate profiles (house, senate, governor, state)
- `district_profiles` — Congressional district demographics
- `state_legislative_districts` — State legislature districts
- `polling_data` — Poll results (approval, generic ballot, issue)
- `campaign_finance` — FEC campaign finance records
- `maga_files` — Trump administration appointee files
- `narrative_reports` — Thematic narrative reports
- `local_impacts` — State-level local impact reports
- `election_results` — Historical election results
- `api_keys` — User API keys
- `role_groups` — Role group definitions
- `role_group_members` — User-role group mappings
- `profiles` — Extended user profiles

## User Roles & Permissions

| Role | Access |
|------|--------|
| **user** | Read-only access to all public data |
| **premium** | Read access + API key generation |
| **moderator** | Premium + can manage content (candidates, MAGA files, narratives) |
| **admin** | Full access including user management and role assignment |

## UI Theme: Win98 + AOL Desktop

The application wraps its modern functionality in a nostalgic Windows 98 / AOL desktop environment:
- **Win98Window** — Draggable/resizable window chrome with classic title bar buttons
- **Win98Taskbar** — Classic taskbar at the bottom with Start button
- **AOLToolbar** — AOL Browser-style navigation toolbar with Back/Forward/Refresh
- **AOLBuddyList** — Simulated AIM buddy list sidebar
- **AOLMailWindow** — Simulated AOL Mail window overlay
- **Win98Desktop** — Desktop view when the main window is minimized

This design choice makes heavy political research data feel approachable and distinctive.

## Supabase Configuration

OppoDB uses Supabase with defense-in-depth security:
- **JWT Verification Enabled** for all edge functions (including `election-results-sync`)
- Row Level Security (RLS) policies on all tables
- Auth via email/password with invite-only user creation
