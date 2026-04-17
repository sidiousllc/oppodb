# Polling Alerts & Email Preferences

OppoDB ships a granular notification system that lets users subscribe to polling shifts and fine-tune every email category they receive.

## Location
- **UI**: Profile page (`src/pages/ProfilePage.tsx`) → "Notifications" section.
- **Component**: `src/components/PollingAlertsManager.tsx`.
- **Dispatcher**: `supabase/functions/polling-alerts-dispatch/index.ts`.

## Polling Alert Subscriptions
Stored in `polling_alert_subscriptions`. Each row lets a user subscribe to a slice of polling activity.

### Filters
| Field | Description |
|-------|-------------|
| `scope` | `state`, `candidate`, `topic`, or `all` |
| `state_abbr` | 2-letter state filter (when scope=state) |
| `candidate_slug` | Candidate match (when scope=candidate) |
| `topic` | Issue tag (e.g., 'abortion', 'economy') |
| `poll_types` | Array filter: race, approval, favorability, issue |
| `min_margin_change` | Trigger only if absolute margin shift ≥ N points vs. last delivered poll |
| `min_sample_size` | Ignore polls below threshold |
| `pollster_min_grade` | Only B+ or above (uses pollster_ratings) |
| `cadence` | `instant`, `hourly_digest`, `daily_digest`, `weekly_digest` |
| `paused` | Pause without deletion |

### Test Button
Each subscription has a "Test" button that invokes the dispatcher with `dry_run: false, force: true, subscription_id: …` to send a sample alert immediately.

## Email Preferences
Stored in `email_notification_preferences` (one row per user).

| Field | Default | Purpose |
|-------|---------|---------|
| `polling_alerts` | true | Master switch for polling alerts |
| `intel_briefings` | true | IntelHub digest |
| `forecast_changes` | true | Election rating shifts |
| `scheduled_reports` | true | ReportHub recurring deliveries |
| `digest_frequency` | `daily` | Global digest cadence |
| `quiet_hours_start` | 22 | Hour (0-23, user's timezone) when sends pause |
| `quiet_hours_end` | 7 | Hour when sends resume |
| `timezone` | `UTC` | IANA TZ for quiet-hour calculation |

## Dispatcher Logic
1. Cron triggers `polling-alerts-dispatch` hourly.
2. For each non-paused subscription, query `polling_data` rows newer than `last_sent_at` matching scope filters.
3. Apply `min_margin_change`, `min_sample_size`, `pollster_min_grade`.
4. Group by cadence; respect `quiet_hours_*` from `email_notification_preferences`.
5. Render via `polling-alert` transactional template (registry in `_shared/transactional-email-templates/registry.ts`).
6. Send via Resend; log to `email_send_log`; update `last_sent_at`.

## Unsubscribe Flow
Every email contains an `email_unsubscribe_tokens` link → `/unsubscribe?token=…` (`src/pages/UnsubscribePage.tsx`) → `handle-email-unsubscribe` edge function flips category bit and records suppression.
