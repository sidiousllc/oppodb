# Feature: Multi-Windows UI Theme System

## Description

OppoDB wraps its modern political research functionality in a nostalgic Windows desktop interface. Users can choose from 7 Windows-era themes (98 through 11), each with light and dark mode variants. This is both a design choice and a UX strategy — making dense opposition research feel approachable through familiar computing aesthetics.

---

## Theme System Architecture

### Available Themes

| Theme ID | Label | Border Radius | Font Stack | Key Aesthetic |
|----------|-------|---------------|------------|---------------|
| `win98` | Windows 98 | 0px | Tahoma, MS Sans Serif | Classic 3D beveled borders |
| `winxp` | Windows XP | 3px | Tahoma, Trebuchet MS | Luna-style gradients |
| `vista` | Windows Vista | 4px | Segoe UI | Aero glass, backdrop blur |
| `win7` | Windows 7 | 4px | Segoe UI | Refined Aero glass |
| `win8` | Windows 8 | 0px | Segoe UI, Segoe UI Light | Flat Metro design |
| `win10` | Windows 10 | 0px | Segoe UI | Minimal flat, thin borders |
| `win11` | Windows 11 | 8px | Segoe UI Variable | Rounded, frosted glass |

### Theme Context (`ThemeContext.tsx`)

```typescript
export type WindowsTheme = "win98" | "winxp" | "vista" | "win7" | "win8" | "win10" | "win11";

interface ThemeContextType {
  theme: WindowsTheme;
  setTheme: (theme: WindowsTheme) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
}
```

### Theme Application Flow

1. On mount, theme loads from `localStorage` (fast path) → renders immediately
2. On login, theme loads from `profiles` table (`windows_theme`, `dark_mode` columns) → syncs across devices
3. Theme class `.theme-{name}` applied to `<html>` element
4. Dark mode class `.dark` applied to `<html>` element
5. On theme/dark change: save to `localStorage` + database, then `window.location.reload()`

### CSS Architecture

- **`index.css`** — Defines base Win98 theme CSS variables and utility classes (`:root`)
- **`themes.css`** — Contains CSS variable overrides per theme:
  - `.theme-winxp { --background: ...; --win98-face: ...; }` (light)
  - `.dark.theme-winxp { --background: ...; }` (dark)
  - Component-specific overrides (`.theme-winxp .win98-titlebar { ... }`)

### CSS Variables (HSL-based)

All themes override the same set of custom properties:

```css
/* Core palette */
--background, --foreground, --card, --card-foreground,
--popover, --popover-foreground, --primary, --primary-foreground,
--secondary, --secondary-foreground, --muted, --muted-foreground,
--accent, --accent-foreground, --destructive, --destructive-foreground,
--border, --input, --ring, --radius

/* Win98-era 3D border system */
--win98-highlight    /* Lightest edge (top-left) */
--win98-light        /* Light face */
--win98-face         /* Panel background */
--win98-shadow       /* Dark edge (bottom-right) */
--win98-dark-shadow  /* Darkest edge */
--win98-titlebar     /* Title bar color */
--win98-titlebar-inactive

/* Sidebar */
--sidebar-background, --sidebar-foreground, --sidebar-primary, etc.

/* Typography */
--font-body, --font-display, --font-pixel
```

### Dark Mode

Each theme has a dedicated dark mode variant defined in `themes.css`:

```css
/* Base dark mode (Win98 dark) */
.dark {
  --background: 180 30% 12%;
  --foreground: 0 0% 88%;
  --win98-face: 0 0% 24%;
  /* ... full palette override */
}

/* Theme-specific dark overrides */
.dark.theme-winxp { ... }
.dark.theme-vista { ... }
.dark.theme-win7 { ... }
.dark.theme-win8 { ... }
.dark.theme-win10 { ... }
.dark.theme-win11 { ... }
```

Dark mode also overrides scrollbar, input, and button styles for consistency.

### Database Persistence

Theme preferences are stored in the `profiles` table:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `windows_theme` | text | `'win98'` | Selected theme ID |
| `dark_mode` | boolean | `false` | Dark mode toggle state |

On login, preferences load from the database and override localStorage.

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
- Background color adapts to active theme

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
- Back, Forward, Refresh buttons
- Address bar showing current section and slug
- Current section label
- Retro aesthetic matching AOL 3.0/4.0 era

### AOLBuddyList
Simulated AOL Instant Messenger (AIM) buddy list:
- Appears as a sidebar
- Shows list of "online" researchers
- Online status indicators (green/yellow/red)
- Simulates a collaborative research environment

### AOLMailWindow
Simulated AOL Mail window:
- Overlay modal that can be opened/closed
- Inbox simulation with Compose
- From: "research@sidious.us"

### AOLDialUpAnimation
AOL dial-up connection animation:
- "Welcome to Sidious.us Group" header
- Progress bar animation
- "Connecting..." status messages
- Shown briefly on the Auth page before login form

---

## Theme Selection UI

Located in **Profile Settings** (`ProfilePage.tsx`):

- **Theme grid**: 2-3 column grid of theme buttons
- **Preview thumbnails**: Each theme shows a representative desktop screenshot (`src/assets/theme-{id}.jpg`)
- **Active indicator**: Primary-color border + glow + "✓ Active" badge
- **Dark mode toggle**: Button with Moon/Sun icons, triggers page reload

```tsx
// Theme selector imports
import themeWin98 from "@/assets/theme-win98.jpg";
// ... one thumbnail per theme
const THEME_THUMBNAILS: Record<WindowsTheme, string> = { ... };
```

---

## Win98 Visual Effects

### Raised borders (outset)
```css
.win98-raised {
  border: 2px solid;
  border-color: hsl(var(--win98-highlight)) hsl(var(--win98-dark-shadow))
                hsl(var(--win98-dark-shadow)) hsl(var(--win98-highlight));
  box-shadow: inset 1px 1px 0 hsl(var(--win98-light)),
              inset -1px -1px 0 hsl(var(--win98-shadow));
}
```

### Sunken borders (inset)
```css
.win98-sunken {
  border: 2px solid;
  border-color: hsl(var(--win98-shadow)) hsl(var(--win98-highlight))
                hsl(var(--win98-highlight)) hsl(var(--win98-shadow));
  box-shadow: inset 1px 1px 0 hsl(var(--win98-dark-shadow)),
              inset -1px -1px 0 hsl(var(--win98-light));
}
```

### Win98 Button (`.win98-button`)
- Raised outset border by default
- Pressed/inset border on click
- Font: system theme font, 11px
- Theme-adapted: gradients (XP/Vista/7), flat (8/10), rounded (11)

### Title bar gradient
- Win98: solid blue
- XP: Multi-stop vertical gradient
- Vista/7: Glass effect with `backdrop-filter: blur()`
- 8/10: Flat solid color
- 11: Frosted glass with rounded corners

---

## Tag Styling

Category-based color coding for candidates:
```css
.tag-house    /* Blue - House races */
.tag-senate   /* Purple - Senate races */
.tag-governor /* Red - Governor races */
.tag-state    /* Teal - State races */
```

---

## Color Palette

### Brand Colors
- Primary: `hsl(220 80% 40%)` (blue)
- Destructive: `hsl(0 80% 50%)` (red)

### Chart Colors
- Democrat: `hsl(210, 80%, 55%)` — Blue
- Republican: `hsl(0, 70%, 50%)` — Red
- Neutral/Even: `hsl(280, 40%, 55%)` — Purple
- Positive: `hsl(150, 55%, 45%)` — Green

---

## Typography

### Font Families (per theme)
- **Win98**: Tahoma, MS Sans Serif, Arial
- **XP**: Tahoma, Trebuchet MS
- **Vista/7/8/10**: Segoe UI
- **Win11**: Segoe UI Variable, Segoe UI
- **Monospace**: VT323 (pixel font, loaded via Google Fonts)

### Font Sizes (Win98 style)
- Title bar: 11px, bold
- Body: 11px
- Small text: 10px
- Tiny labels: 9px / 8px

---

## Responsive Design

### Mobile Adaptation
- **MobileNav** component replaces AppSidebar on small screens
- Bottom tab navigation for section switching
- Single-column layouts on mobile
- Theme chrome scales appropriately

### Breakpoints
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

---

## Animation System

### Page Transitions
```css
.animate-fade-in {
  animation: fadeIn 0.15s ease-out;
}
```

### Theme Transitions
- Win11 buttons: `transition: background 0.15s, border-color 0.15s`
- Win11 inputs: `transition: border-color 0.15s`
- Other themes: immediate (no transition, authentic retro feel)

### Loading States
- Skeleton loaders (`.animate-pulse`)
- Spinner: circular border with rotating border-t
- Win98 hourglass cursor for pending operations

---

## Print Styles

```css
@media print {
  [data-sidebar], nav, button, header, .win98-taskbar {
    display: none !important;
  }
  body { background: white; color: black; font-size: 11pt; }
}
```

---

## Scrollbar Theming

Each theme customizes scrollbar appearance:
- **Win98**: 16px wide, 3D beveled thumb and buttons
- **XP**: 17px, rounded thumb with gradient
- **8**: 10px, flat gray
- **10**: 8px, flat, no buttons
- **11**: 6px, rounded, transparent track, no buttons
- **Dark mode**: All themes get darker scrollbar colors
