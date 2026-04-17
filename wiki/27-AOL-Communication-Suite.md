# AOL Communication Suite

The application ships a fully-functional communication suite themed after AOL/AIM circa 1999, blending nostalgic UI with modern real-time messaging, mail, and presence.

## Components
- `AOLBuddyList.tsx` — Real-time presence sidebar.
- `AOLIMWindow.tsx` — 1:1 chat windows with sound effects.
- `AOLMailWindow.tsx` — Inbox/Sent/Drafts mail client.
- `AOLToolbar.tsx` — Top-bar toolbar with You've Got Mail indicator.
- `AOLDialUpAnimation.tsx` — Login dial-up sequence (see [Authentication](Authentication-and-User-Management)).

## Buddy List
- Real-time presence via Supabase Realtime channels.
- States: **online**, **idle** (5+ min no input), **away** (manual), **offline**.
- Hover reveals last-seen timestamp; double-click opens IM window.
- Sound effects: door open/close on online/offline events (toggleable in profile).

## Instant Messages
- Backed by `chat_messages` table.
- RLS: sender or receiver can read; only sender can insert.
- Realtime subscription on `INSERT` events filtered by `receiver_id = auth.uid()`.
- Supports markdown, link previews, and message read receipts (`read_at`).
- Chat history pagination at 50 messages per scroll.

## Mail
- `mail` schema with `mail_messages`, `mail_recipients`, `mail_attachments`.
- Internal-only by default; external sending requires admin approval per recipient domain.
- `MailContext.tsx` provides global unread count for the toolbar's "You've Got Mail" alert.
- External delivery via `send-external-mail` edge function (Resend).

## Notifications
- Web Push for new mail and IMs (where granted).
- Browser tab title flashes with unread count.
- AOL-style notification sounds (toggleable).
