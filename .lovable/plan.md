

## Plan: Set Up Transactional (App) Email Templates

### Overview
Set up Lovable's transactional email infrastructure and create branded email templates for common app scenarios, all styled with the existing Win98/AOL retro aesthetic. Then wire up triggers and test delivery.

### Templates to Create
1. **Welcome Email** — sent after user signup/approval
2. **Access Request Approved** — sent when admin approves an access request
3. **Access Request Denied** — sent when admin denies an access request
4. **In-App Mail Notification** — (already exists as `send-mail-notification` edge function, but will create a proper template version)
5. **Invite Link** — sent when admin generates an invitation for a new user

### Steps

**Step 1 — Set up email infrastructure**
- Call `setup_email_infra` to create pgmq queues, RPC wrappers, tables, and cron job
- Call `scaffold_transactional_email` to create the `send-transactional-email` Edge Function, registry, and sample template

**Step 2 — Create 5 branded email templates**
- Create `.tsx` files in `supabase/functions/_shared/transactional-email-templates/`
- All templates use the Win98/AOL style matching existing auth emails: `#c0c0c0` outer background, white container with `2px solid #808080` border, Tahoma font, `#1a47a6` blue buttons with `0px` border-radius
- Register all templates in `registry.ts`

**Step 3 — Create unsubscribe page**
- Add `/unsubscribe` route to the app
- Page reads `token` query param, validates via Edge Function, shows branded confirm/success UI

**Step 4 — Wire up triggers**
- Welcome email: trigger after successful signup in AuthContext or approval flow
- Access approved/denied: trigger from admin panel approval actions
- Invite: trigger when admin creates invitation
- Update existing `send-mail-notification` to use the new template system (or keep as-is since it already works)

**Step 5 — Deploy and test**
- Deploy all edge functions (`send-transactional-email`, `handle-email-unsubscribe`, `handle-email-suppression`)
- Test each template by invoking the edge function

### Technical Details

- **Sender domain**: `notify.oppodb.com` (verified, active)
- **From address**: `ordb <noreply@notify.oppodb.com>`
- **Style constants** (matching auth templates):
  - main: `backgroundColor: '#c0c0c0'`, `fontFamily: "Tahoma, 'MS Sans Serif', Arial, sans-serif"`
  - container: `backgroundColor: '#ffffff'`, `border: '2px solid #808080'`
  - h1: `color: '#1a47a6'`
  - button: `backgroundColor: '#1a47a6'`, `borderRadius: '0px'`
- **Unsubscribe page**: `/unsubscribe` route with Win98-styled UI
- **Files created/modified**:
  - `supabase/functions/_shared/transactional-email-templates/welcome.tsx`
  - `supabase/functions/_shared/transactional-email-templates/access-approved.tsx`
  - `supabase/functions/_shared/transactional-email-templates/access-denied.tsx`
  - `supabase/functions/_shared/transactional-email-templates/mail-notification.tsx`
  - `supabase/functions/_shared/transactional-email-templates/invite-link.tsx`
  - `supabase/functions/_shared/transactional-email-templates/registry.ts`
  - `src/pages/UnsubscribePage.tsx`
  - `src/App.tsx` (add unsubscribe route)
  - Trigger wiring in admin/auth components

