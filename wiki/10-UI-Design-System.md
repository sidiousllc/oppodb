# Feature: Win98 + AOL UI Design System

## Description

OppoDB wraps its modern political research functionality in a nostalgic Windows 98 / AOL desktop interface. This is both a design choice and a UX strategy — making dense opposition research feel approachable through familiar retro computing aesthetics.

---

## Win98 Components

### Win98Window
The primary container component simulating a Windows 98 window:
- Classic title bar with window title and icon
- Minimize, maximize, close buttons (styled as Win98 gray buttons)
- Draggable/resizable (if not maximized)
- Supports `maximized` prop for full-width/height mode
- `onMinimize` callback for taskbar minimize behavior
- Inside shadow / raised border effects using CSS

### Win98Taskbar
Bottom-of-screen taskbar:
- Start button (Sidios.us / Sidio.us Group branding)
- Window buttons for open/minimized windows
- System clock (current time)
- Background color: Win98 teal/gray

### Win98Desktop
Desktop background view shown when main window is minimized:
- Desktop icons for "My Computer", "Network", etc.
- Click to restore the main ORO window

### Win98PageLayout
Generic page layout using Win98 chrome:
- Win98 title bar at top
- Address bar showing `aol://` URL
- Win98 sunken content area
- Used by AdminPanel, ApiPage, ProfilePage

---

## AOL Components

### AOLToolbar
AOL Browser-style navigation toolbar:
- Back button (navigates to previous state)
- Forward button
- Refresh button (triggers page reload)
- Address bar showing current section and slug
- Current section label
- Retro aesthetic matching AOL 3.0/4.0 era

### AOLBuddyList
Simulated AOL Instant Messenger (AIM) buddy list:
- Appears as a sidebar
- Shows list of "online" researchers
- "Instant Message" buttons
- Online status indicators (green/yellow/red)
- Simulates a collaborative research environment

### AOLMailWindow
Simulated AOL Mail window:
- Overlay modal that can be opened/closed
- Inbox simulation
- Compose new message
- From: "research@sidious.us"
- Creates a sense of integrated communication

### AOLDialUpAnimation
AOL dial-up connection animation:
- "Welcome to Sidious.us Group" header
- "Dialing: 1-800-PC-SETUP" fake number
- Progress bar animation
- "Connecting..." status messages
- Shown briefly on the Auth page before login form

---

## Theme System

### CSS Variables
Uses HSL-based CSS custom properties for theming:
```css
--background: /* Main background */
--foreground: /* Main text */
--primary: /* Brand primary color */
--muted-foreground: /* Secondary text */
--win98-face: /* Win98 gray panel color */
--win98-light: /* Win98 light bevel */
--win98-shadow: /* Win98 dark bevel */
--win98-titlebar: /* Win98 title bar gradient */
--destructive: /* Red for warnings */
--accent: /* Accent color */
```

### Win98 Visual Effects

**Raised borders** (outset):
```css
border: 2px solid;
border-color: hsl(var(--win98-light)) hsl(var(--win98-shadow)) hsl(var(--win98-shadow)) hsl(var(--win98-light));
```

**Sunken borders** (inset):
```css
border: 2px solid;
border-color: hsl(var(--win98-shadow)) hsl(var(--win98-light)) hsl(var(--win98-light)) hsl(var(--win98-shadow));
```

**Win98 Button** (`.win98-button`):
- Raised outset border by default
- Pressed/inset border on click
- Font: MS Sans Serif / Arial, small size (11px)
- Used for all interactive buttons

**Title bar gradient**:
- Light gray at top → darker gray at bottom
- Blue accent for active window title
- White text on blue for active title

### Tag Styling
Category-based color coding for candidates:
```css
.tag-house   /* Blue - House races */
.tag-senate  /* Purple - Senate races */
.tag-governor/* Red - Governor races */
.tag-state   /* Teal - State races */
```

---

## Color Palette

### Brand Colors
- Primary: #0066CC (blue)
- Accent: #FF6600 (AOL orange)
- Destructive: #CC0000 (red)

### Win98 System
- Window face: #C0C0C0
- Light bevel: #FFFFFF
- Dark bevel: #808080
- Shadow: #404040
- Title bar active: #000080 (navy blue)
- Title bar text: #FFFFFF

### Chart Colors
- Democrat: hsl(210, 80%, 55%) — Blue
- Republican: hsl(0, 70%, 50%) — Red
- Neutral/Even: hsl(280, 40%, 55%) — Purple
- Positive: hsl(150, 55%, 45%) — Green
- Negative: hsl(0, 65%, 50%) — Dark Red

---

## Typography

### Font Families
- **UI / System**: "MS Sans Serif", "Arial", sans-serif
- **Headings**: "Segoe UI", system-ui, sans-serif
- **Monospace / Code**: "Courier New", monospace

### Font Sizes (Win98 style)
- Title bar: 11px, bold
- Body: 11px
- Small text: 10px
- Tiny labels: 9px

---

## Responsive Design

### Mobile Adaptation
- **MobileNav** component replaces AppSidebar on small screens
- Bottom tab navigation for section switching
- Single-column layouts on mobile
- Win98 chrome scales appropriately

### Breakpoints
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

---

## Animation System

### Page Transitions
```css
.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}
```

### Intersection Observer Animations
Components like `PollingSection` use `useInView` hook to trigger animations when scrolled into view:
- Cards fade and slide up
- Chart bars animate width
- Staggered delays for list items

### Loading States
- Skeleton loaders (`.animate-pulse`)
- Spinner: circular border with rotating border-t
- Win98 hourglass cursor for pending operations
