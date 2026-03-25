# Feature: Authentication & User Management

## Description

OppoDB implements a full authentication and role-based access control system built on Supabase Auth with custom role extensions.

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

---

## Auth Page Modes

The `AuthPage.tsx` supports multiple modes:

### 1. Login Mode
- Email input
- Password input
- Submit button
- "Forgot Password?" link
- "Create Account" link

### 2. Signup Mode
- Email input
- Password input
- Display name input
- Invite token input (required for private deployment)
- Validation: email regex, password min 6 chars

### 3. Forgot Password Mode
- Email input
- Sends password reset email via Supabase

### 4. Invite-based Signup
- Validates invite token from URL parameter `?invite=<token>`
- Pre-fills email from invite
- Assigns role from invite (e.g., "user", "premium")
- Creates account and consumes invite

### 5. AOL Dial-Up Animation
On initial load, a nostalgic AOL dial-up connection animation plays before the auth form appears:
- "Connecting to Sidious.us Group..." text
- Animated dial-up modem simulation
- 2-second display before transitioning to auth form

---

## User Roles & Permissions

### Role Hierarchy

| Role | Numeric Value | Description |
|------|--------------|-------------|
| `admin` | Highest | Full system access |
| `moderator` | Mid | Content management access |
| `premium` | Lower | API access + premium features |
| `user` | Base | Read-only access |

### Permission Checks

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
| Edit content | ✗ | ✗ | ✓ | ✓ |
| Manage users | ✗ | ✗ | ✗ | ✓ |
| Role assignment | ✗ | ✗ | ✗ | ✓ |

---

## Admin Panel User Management (`AdminPanel → Users Tab`)

Full user administration interface for admins:

### User List
Table showing all users with:
- Email
- Status (Active / Suspended)
- Joined date
- Last sign-in date
- Roles (toggleable)
- User group memberships (color-coded badges)

### Role Toggle
One-click role assignment:
- Click to toggle `admin`, `moderator`, `premium` roles
- Changes saved immediately via `setUserRole()`
- Visual feedback with colored badges

### Create User
Form to create new user:
- Email (with validation)
- Password (min 6 chars)
- Initial role selection
- Validates email format before submission

### Edit User
Modal to edit user:
- Email (with validation)
- Display name

### Reset Password
Admin-initiated password reset:
- Sets new password for user
- Confirmation required

### Suspend / Ban User
Time-limited or indefinite suspension:
- Duration options: 1 Hour, 24 Hours, 7 Days, 30 Days, 90 Days, Indefinite
- Suspended users cannot log in
- `banned_until` timestamp stored in user metadata
- "Restore Access" button to unban

### Delete User
Permanent account deletion with confirmation prompt.

---

## Role Groups

### Description
Role Groups allow flexible categorization of users beyond basic roles. Groups have:
- **Name** — Display name (e.g., "Senate Staff", "Field Team")
- **Color** — Visual color coding (hex)

### Membership
Users can belong to multiple role groups. Group memberships are displayed as colored badges on the user list.

### Admin Panel Tab
**Admin Panel → Role Groups tab** (`RoleGroupsTab`):
- Create new groups
- Edit group name and color
- Delete groups
- Manage membership

---

## Access Control (`AccessControlTab`)

Admin Panel tab for managing access permissions:
- View current access rules
- Modify permission assignments
- Role-based access control configuration

---

## Supabase Auth Configuration

Uses Supabase's built-in auth with additional profile/role metadata:

### Auth Methods
- Email + password (primary)
- Password reset via email
- Invite-based registration with token validation

### User Metadata Schema
```typescript
interface UserMetadata {
  role: "user" | "premium" | "moderator" | "admin";
  display_name?: string;
  banned_until?: string;  // ISO timestamp, null = not banned
}
```

### Supabase Tables Used
- `auth.users` — Built-in Supabase Auth users
- `profiles` — Extended user profiles (display_name, etc.)
- `role_groups` — Role group definitions
- `role_group_members` — User ↔ group mappings
