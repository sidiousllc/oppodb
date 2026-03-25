# Feature: Authentication & User Management

## Description

OppoDB implements a full authentication and role-based access control system built on Supabase Auth with custom role extensions, invite-based onboarding, access request workflows, and a comprehensive admin panel.

---

## Authentication (`AuthContext`)

### Context Provider
`AuthContext.tsx` provides global authentication state:
- `user` — Current authenticated user (or null)
- `loading` — Auth state loading flag
- `signIn()` — Email/password login
- `signUp()` — New user registration
- `signOut()` — Logout
- `resetPassword()` — Password reset flow

### Auth Route Guards

Two route-level guards in `App.tsx`:

**`AuthRoute`** — Redirects authenticated users away from `/auth`
- If logged in → redirect to `/`
- If not logged in → show auth page

**`ProtectedRoute`** — Requires authentication
- If not logged in → redirect to `/auth`
- If logged in → show protected page
- Shows loading spinner during auth check

### Production Domain Pinning

All auth redirects (signup confirmation, password reset, OAuth) use a hardcoded production origin (`https://oppodb.com`) instead of `window.location.origin`. This prevents users from being redirected to a Lovable preview login gate during email verification flows.

```typescript
const PRODUCTION_ORIGIN = "https://oppodb.com";
const getRedirectOrigin = () => PRODUCTION_ORIGIN;

// Applied to all auth calls:
await supabase.auth.signUp({
  email, password,
  options: { emailRedirectTo: getRedirectOrigin() },
});
```

---

## Auth Page Modes

The `AuthPage.tsx` supports multiple modes:

### 1. Login Mode
- Email input
- Password input
- Submit button
- "Forgot Password?" link
- "Create Account" link
- "Request Access" link

### 2. Signup Mode
- Email input
- Password input
- Display name input
- Invite token input (required for private deployment)
- Validation: email regex, password min 6 chars
- Redirect URL pinned to production domain

### 3. Forgot Password Mode
- Email input
- Sends password reset email via Supabase
- Redirect URL pinned to production domain (`/reset-password`)

### 4. Request Access Mode
- Email input
- Display name input
- Reason textarea (optional)
- Submits to `access_requests` table
- Admin reviews and approves/denies from Access Control tab

### 5. Invite-based Signup
- Validates invite token from URL parameter `?invite=<token>`
- Pre-fills email from invite
- Assigns role from invite (e.g., "user", "premium")
- Creates account and consumes invite

### 6. AOL Dial-Up Animation
On initial load, a nostalgic AOL dial-up connection animation plays before the auth form appears:
- "Connecting to Sidious.us Group..." text
- Animated dial-up modem simulation
- 2-second display before transitioning to auth form

---

## User Roles & Permissions

### Role System
Roles are stored in the `user_roles` table using the `app_role` PostgreSQL enum:
```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
```

The `has_role()` function is a SECURITY DEFINER function that prevents RLS recursion when checking roles:
```sql
CREATE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

### Permission Checks (Hooks)

**`useIsAdmin()` hook**
- Returns `isAdmin: boolean`
- True if user has `admin` role

**`useUserRole()` hook**
- Returns full role object:
  - `isAdmin`
  - `isModerator`
  - `isPremium`
  - `canAccessApi`
  - `canManageContent`
  - `loading`

### Feature Access by Role

| Feature | User | Premium | Moderator | Admin |
|---------|------|---------|-----------|-------|
| Read candidates | ✓ | ✓ | ✓ | ✓ |
| Read districts | ✓ | ✓ | ✓ | ✓ |
| Read polling | ✓ | ✓ | ✓ | ✓ |
| API access | ✗ | ✓ | ✓ | ✓ |
| MCP server access | ✗ | ✓ | ✓ | ✓ |
| Edit content | ✗ | ✗ | ✓ | ✓ |
| Manage users | ✗ | ✗ | ✗ | ✓ |
| Role assignment | ✗ | ✗ | ✗ | ✓ |
| Access control | ✗ | ✗ | ✗ | ✓ |

---

## Role Groups

### Description
Role Groups provide flexible team-based categorization beyond basic roles. Each group defines:
- **Name** — Display name (e.g., "Senate Staff", "Field Team")
- **Color** — Visual color coding (hex)
- **Roles** — Array of roles assigned to the group

### Automatic Role Synchronization
When a user is added/removed from a group, or a group's roles are modified, the system automatically recalculates the user's effective roles as the **union** of all roles from their assigned groups. This is handled atomically by the `admin-users` edge function.

### Membership
Users can belong to multiple role groups. Group memberships are displayed as colored badges on the user list in the Admin Panel.

---

## Access Control (`AccessControlTab`)

### Invitations Sub-Tab
Admins can invite users by email:
- **Send Invite**: Email + role selection → generates a unique token with 7-day expiry
- **Copy Link**: Copies the invite URL to clipboard (`/auth?invite=<token>`)
- **Invite Status**: Shows whether invite is pending, used, or expired
- **Delete Invite**: Remove used or expired invitations (Trash2 icon button)

### Access Requests Sub-Tab
Public users can request access from the auth page:
- **Request Queue**: Shows pending, approved, and denied requests
- **Filter by Status**: Toggle between pending/approved/denied views
- **Pending Count Badge**: Shows number of pending requests
- **Approve**: Creates account with default role, sends welcome email
- **Deny**: Marks request as denied, sends denial notification email
- **Delete Request**: Remove processed (non-pending) access requests (Trash2 icon button)
- **Safety Check**: Backend prevents deletion of pending requests to avoid accidental data loss

### Backend Implementation
The `admin-users` edge function handles:
- `create_invitation` — Generates invite token, stores in `user_invitations`
- `list_invitations` — Returns all invitations
- `delete_invitation` — Removes an invitation record
- `list_access_requests` — Returns filtered access requests
- `approve_access_request` — Creates user account + assigns role
- `deny_access_request` — Marks request as denied
- `delete_access_request` — Removes processed requests (with pending safety check)

---

## Email Notifications for Access Flow

### Invite Email
When an admin sends an invite, the system:
1. Creates a `user_invitations` record with a unique token
2. Sends an invite email via the transactional email pipeline
3. Email contains a one-click link to `/auth?invite=<token>`

### Access Request Emails
- **Approved**: Welcome email sent to the requester
- **Denied**: Denial notification email sent to the requester

### Mail Notifications
When users send in-app AOL mail, the recipient receives a real email notification:
1. `send-mail-notification` edge function authenticates the sender
2. Looks up recipient email via service role
3. Routes through `send-transactional-email` for proper rendering, suppression checks, and unsubscribe tokens

---

## Password Reset Flow

### User-Initiated Reset
1. User clicks "Forgot Password?" on auth page
2. Enters email address
3. System sends reset email with link to `/reset-password`
4. User clicks link, enters new password on `ResetPassword.tsx` page
5. Password updated via `supabase.auth.updateUser()`

### Admin-Initiated Reset
1. Admin opens user's edit menu in Admin Panel
2. Clicks "Reset Password"
3. Enters new password (with confirmation)
4. Password set directly via `admin-users` edge function

---

## Supabase Auth Configuration

### Auth Methods
- Email + password (primary)
- Password reset via email
- Invite-based registration with token validation
- Access request + admin approval flow
- Google OAuth (configured, redirects to production domain)

### Supabase Tables Used
- `user_roles` — Role assignments (enum-based)
- `profiles` — Extended user profiles (display_name, avatar_url)
- `user_invitations` — Invite tokens with expiry
- `access_requests` — Public access request queue
- `role_groups` — Role group definitions
- `role_group_members` — User ↔ group mappings
