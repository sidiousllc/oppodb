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
| Candidates | ✓ | ✓ |
| MAGA Files | ✓ | ✓ |
| Local Impact | ✓ | ✓ |
| Narratives | ✓ | ✓ |

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

Shows banned_until timestamp.

### Delete User
Confirmation prompt required, then permanent deletion.

---

## Role Groups Tab

### Purpose
Role Groups provide flexible team/project-based categorization.

### Create Group
- Name input
- Color picker (hex color)
- Creates group in `role_groups` table

### Manage Membership
- Add users to groups
- Remove users from groups
- Change group name/color
- Delete groups

---

## Access Control Tab

### Purpose
Fine-grained access permission management.

### Features
- View all current access rules
- Modify permissions by role
- Configure resource-level access
- Audit log of permission changes

---

## Candidates Tab (Content Management)

Moderators and admins can manage candidate profiles.

### Content List
- List of all candidates with slug
- Character count of content
- edit_file and Delete buttons

### Create Candidate
Form with:
- Name input
- Slug input (auto-generated from name)
- Content textarea (Markdown)
- github_path field (for GitHub sync reference)

### Edit Candidate
Same form as create, pre-filled with existing data.

### Delete Candidate
Confirmation required.

---

## MAGA Files Tab

### Content Management
- List view with name, slug, content preview
- Create new MAGA file
- Edit existing files
- Delete files

### Fields
- Name (display title)
- Slug (URL-safe)
- Content (Markdown)

---

## Local Impact Tab

### Content Management
- List view with state, slug, summary preview
- Create new report
- Edit existing reports
- Delete reports

### Fields
- State (dropdown or text)
- Slug
- Summary (brief description)
- Content (Markdown)

---

## Narratives Tab

### Content Management
- List view with name, slug
- Create new narrative
- Edit existing narratives
- Delete narratives

### Fields
- Name
- Slug
- Content (Markdown)

---

## Shared Content Components

### ContentList Component
Reusable table component for all content types:
- Item name/slug displayed
- Content length shown
- Action buttons (edit/delete)
- Empty state message

### ContentEditor Component
Reusable form for content editing:
- Name/State field (label configurable)
- Slug field
- Summary field (optional)
- Large content textarea (monospace font)
- Save / Cancel buttons
- Creates new or updates existing based on presence of ID

---

## Real-time Updates

After any content operation (create/edit/delete):
- UI updates immediately
- Data refreshes from Supabase
- Toast notifications confirm success/failure

---

## Admin API Functions (`lib/adminApi.ts`)

```typescript
listUsers(): Promise<AdminUser[]>
setUserRole(userId: string, role: string, hasRole: boolean): Promise<void>
deleteUser(userId: string): Promise<void>
createUser(email: string, password: string, role: string): Promise<void>
updateUser(userId: string, updates: {...}): Promise<void>
resetUserPassword(userId: string, newPassword: string): Promise<void>
banUser(userId: string, duration: string): Promise<void>
unbanUser(userId: string): Promise<void>
```

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
- Success (green): "User updated", "Candidate created"
- Error (red): "Failed to create: error message"
- Info (blue): "No changes detected"
