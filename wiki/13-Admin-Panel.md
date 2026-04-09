# Feature: Admin Panel

## Description

The Admin Panel provides administrative oversight and management capabilities for OppoDB. It is accessible only to users with `admin` or `moderator` roles, and provides tools for user management, content management, role configuration, and access control.

---

## Access Control

### Role-Based Access
| Tab | Admin | Moderator |
|-----|-------|-----------|
| Users | ✓ | ✗ |
| Role Groups | ✓ | ✗ |
| Access Control | ✓ | ✗ |
| Activity Logs | ✓ | ✗ |
| Candidates | ✓ | ✓ |
| MAGA Files | ✓ | ✓ |
| Local Impact | ✓ | ✓ |
| Narratives | ✓ | ✓ |
| Messaging Guidance | ✓ | ✓ |

### Access Denied Page
Users without admin/moderator privileges see an "Access Denied" screen with:
- Blocked icon (🚫)
- Explanation text
- "Back to Dashboard" button

---

## Users Tab

Full user lifecycle management.

### User List Table
Columns:
- **User** — Email address
- **Status** — Active (green) or Suspended (red) badge
- **Joined** — Registration date
- **Last Sign In** — Most recent login date
- **Roles** — Toggle buttons for admin, moderator, premium
- **Groups** — Color-coded role group badges
- **Actions** — Suspend, Edit, Reset Password, Delete

### Role Toggle
Click any role button to grant or remove:
- Changes saved immediately via `setUserRole()`
- Visual feedback (green checkmark when active)

### User Group Badges
Users show colored badges for their role group memberships:
- Team-based color coding
- Hover shows group name

### Create User Form
Expandable form panel:
- Email input (with regex validation)
- Password input (min 6 chars)
- Role dropdown (user, premium, moderator, admin)
- Create button with loading state

### Edit User Modal
- Edit email (with validation)
- Edit display name
- Save button

### Reset Password Modal
- New password input
- Confirm password input
- Reset button (requires matching passwords)

### Suspend User Modal
Duration options:
- 1 Hour
- 24 Hours
- 7 Days
- 30 Days
- 90 Days
- Indefinite

Shows `banned_until` timestamp. "Restore Access" button to unban.

### Delete User
Confirmation prompt required, then permanent deletion.

---

## Role Groups Tab (`RoleGroupsTab`)

### Purpose
Role Groups provide flexible team/project-based categorization with automatic role synchronization.

### Create Group
- Name input
- Description field
- Color picker (hex color)
- Roles multi-select (admin, moderator, user)
- Creates group in `role_groups` table

### Manage Membership
- Add users to groups by email or user ID
- Remove users from groups
- Change group name, description, color, and roles
- Delete groups

### Automatic Role Sync
When group membership or group roles change, the system recalculates user roles as the union of all assigned groups' roles. This is handled atomically by the `admin-users` edge function.

---

## Access Control Tab (`AccessControlTab`)

### Invitations Sub-Tab
Manage user invitations:
- **Send Invite Form**: Email input + role dropdown (user, premium, moderator, admin)
- **Invitation List**: Shows all invitations with status (pending/used/expired)
- **Copy Invite Link**: Copies `/auth?invite=<token>` URL to clipboard
- **Delete Used/Expired Invites**: Trash button appears for invitations that are either used or expired
- Sends invite email via transactional email pipeline

### Access Requests Sub-Tab
Manage public access requests:
- **Status Filter**: Toggle between pending, approved, and denied views
- **Pending Count Badge**: Shows number of unreviewed requests
- **Approve Button**: Creates user account with default role, sends welcome email
- **Deny Button**: Marks as denied, sends denial notification email
- **Delete Processed Requests**: Trash button appears for non-pending requests (approved or denied)
- **Backend Safety Check**: The `delete_access_request` action verifies the request is not pending before allowing deletion

---

## Activity Logs Tab (`ActivityLogsTab`)

### Purpose
Provides administrators with a centralized audit trail of all user activity across the platform. Tracks page navigation, map access, API usage, content changes, and internal communications.

### Category Filters
Admins can filter logs by type using toggle buttons:

| Category | Emoji | Data Source | Description |
|----------|-------|-------------|-------------|
| All | 📋 | All sources | Combined view of all activity |
| Page Views | 👁️ | `user_activity_logs` | Which sections each user visited |
| Map Access | 🗺️ | `user_activity_logs` | Congressional district and state legislative map views |
| API Calls | 🔑 | `api_request_logs` | API request logs with endpoints and HTTP status codes |
| Content Changes | 📝 | `candidate_versions` | Git-backed content edit history (author, file, commit message) |
| Chat Logs | 💬 | `chat_messages` | All internal IM conversations between users |

### Activity Tracking (`useActivityTracker` hook)
Client-side tracking is implemented via the `useActivityTracker` hook in `src/hooks/useActivityTracker.ts`:
- **Debounced**: Identical events within 2 seconds are suppressed
- **Silent failures**: Logging never breaks the user experience
- **Automatic**: Page views and map views are tracked on section navigation in `Index.tsx`

Activity types tracked:
- `page_view` — Section navigation (dashboard, candidates, district-intel, etc.)
- `map_view` — Congressional district map or state legislative map views
- `content_edit` — Content modifications (available for future use)
- `chat_send` — Chat messages (available for future use)

### Database Table: `user_activity_logs`
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | User who performed the action |
| `activity_type` | text | Type of activity |
| `details` | jsonb | Contextual data (page name, map type, etc.) |
| `created_at` | timestamptz | When the activity occurred |

### RLS Policies
- **Admins**: Can read all activity logs
- **Authenticated users**: Can insert their own activity logs
- **Service role**: Full access for backend tracking

### Filtering & Search
Admins can narrow down logs using the filter bar:

| Filter | Control | Description |
|--------|---------|-------------|
| **User** | Dropdown | Filter by specific user (populated from all unique user IDs in logs) |
| **Search** | Text input | Case-insensitive search across message content, endpoints, activity details, and user names |
| **Date From** | Date picker | Show only logs on or after this date |
| **Date To** | Date picker | Show only logs on or before this date |

- **Clear button** appears when any filter is active, resets all filters
- **Results counter** displays "Showing X of Y logs" when filters are applied
- Filters work across all log types simultaneously via a unified internal data model (`UnifiedLog`)
- User filter also matches chat message recipients and content change authors

### Log Display
Each log category shows a table with:
- **User** — Display name resolved from profiles table
- **Type/Details** — Color-coded badges and formatted detail strings
- **Timestamp** — Localized date/time display
- Refresh button for real-time updates
- Up to 500 entries per category (200 for content changes)

---

## Content Management Tabs (Candidates, MAGA Files, Local Impact, Narratives, Messaging Guidance)

All content management tabs share a unified architecture with the `ContentTab`, `ContentList`, and `ContentEditor` components.

### Shared Features

#### Content List
- List of all items with slug, character count, and **tags** (comma-separated display)
- Edit and Delete buttons per item
- "New" button to create items

#### Content Editor (`ContentEditor`)
The editor provides fields for:

| Field | Type | Present In |
|-------|------|-----------|
| Name / State | Text input | All tabs (label varies: "Name" or "State") |
| Slug | Text input | All tabs |
| **Tags** | Comma-separated text input | All tabs |
| Summary | Text input | Local Impact only |
| Content | Monospace Markdown textarea | All tabs |

**Tags Input**: Accepts comma-separated values (e.g., `Republican, Healthcare, Economy`). On save, tags are split, trimmed, and stored as a PostgreSQL text array.

#### Save Flow
```typescript
// Tags are parsed from comma-separated string to array on save
const tags = form.tagsText.split(",").map(s => s.trim()).filter(Boolean);
// Passed to content-admin edge function with the record
const record = { slug, content, tags, ...otherFields };
```

### Tab-Specific Fields

#### Candidates Tab
- **Name Label**: "Name"
- **Has Summary**: No
- **github_path**: For GitHub sync reference

#### MAGA Files Tab
- **Name Label**: "Name"
- **Has Summary**: No

#### Local Impact Tab
- **Name Label**: "State"
- **Has Summary**: Yes

#### Narratives Tab
- **Name Label**: "Name"
- **Has Summary**: No

#### Messaging Guidance Tab
- Uses a separate specialized editor (see [MessagingHub](MessagingHub))
- Tags stored in `issue_areas` column (same concept, different column name)

---

## Admin API Functions (`lib/adminApi.ts`)

```typescript
listUsers(): Promise<AdminUser[]>
setUserRole(userId: string, role: string, remove?: boolean): Promise<void>
createUser(email: string, password: string, role?: string): Promise<void>
updateUser(userId: string, updates: { email?: string; display_name?: string }): Promise<void>
resetUserPassword(userId: string, newPassword: string): Promise<void>
deleteUser(userId: string): Promise<void>
banUser(userId: string, duration?: string): Promise<void>
unbanUser(userId: string): Promise<void>
```

### Edge Function Actions (`admin-users`)
The `admin-users` edge function handles all administrative operations:

**User Management:**
- `list_users` — List all users with roles and profiles
- `create_user` — Create new user with email/password/role
- `update_user` — Update email or display name
- `set_role` — Grant or revoke a role
- `reset_password` — Set new password for user
- `ban_user` — Suspend user for specified duration
- `delete_user` — Permanently delete user

**Invitation Management:**
- `create_invitation` — Generate invite token with 7-day expiry
- `list_invitations` — List all invitations
- `validate_invite` — Check invite token validity (public, no auth)
- `consume_invite` — Mark invite as used (public, no auth)
- `delete_invitation` — Remove invitation record

**Access Request Management:**
- `list_access_requests` — List requests with optional status filter
- `approve_access_request` — Create account + assign role + send welcome email
- `deny_access_request` — Mark denied + send notification
- `delete_access_request` — Remove processed request (safety check: cannot delete pending)

**Role Groups:**
- Role group CRUD and membership management
- Atomic role recalculation on membership changes

---

## Content Admin Functions (`lib/contentAdmin.ts`)

```typescript
insertContent(table: string, record: {...}): Promise<void>
updateContent(table: string, id: string, updates: {...}): Promise<void>
deleteContent(table: string, id: string): Promise<void>
```

---

## Toast Notifications

All admin actions show toast notifications:
- Success (green): "User updated", "Candidate created", "Invite deleted"
- Error (red): "Failed to create: error message"
- Info (blue): "No changes detected"
