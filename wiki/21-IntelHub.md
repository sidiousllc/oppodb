# Feature: IntelHub — Intelligence Briefings

## Description

IntelHub is the intelligence briefings section of OppoDB, aggregating news and analysis from 90+ RSS/Atom sources across four scopes: Local, State, National, and International. It provides automated category detection, full article text rendering, and PDF export capabilities.

---

## Architecture

### Component: `IntelHub.tsx`

```typescript
interface Briefing {
  id: string;
  scope: string;       // "local" | "state" | "national" | "international"
  category: string;    // "economy" | "health" | "immigration" | "general" | etc.
  title: string;
  summary: string;
  content: string;
  source_name: string;
  source_url: string | null;
  published_at: string | null;
  region: string | null;
  created_at: string;
}
```

### Scope Tabs

| Scope | Icon | Description |
|-------|------|-------------|
| Local | 📍 | Municipal, county, and local governance news |
| State | 🏛️ | State-level policy, legislature, and political news |
| National | 🇺🇸 | Federal policy, Congress, White House, national politics |
| International | 🌍 | Global affairs, foreign policy, international relations |

---

## Data Sources (90+ RSS/Atom Feeds)

### International Sources
DW News, France 24, Al Jazeera, BBC World, Reuters, South China Morning Post, The Guardian World, Foreign Policy, Japan Times, Middle East Eye

### National Sources
Washington Post, Punchbowl News, ProPublica, Politico, The Hill, Roll Call, NPR Politics, AP News, Reuters US, Axios, Vox, Slate, The Intercept, Mother Jones, The Atlantic, National Review, The Federalist, Daily Caller, Reason Magazine, and more

### State Sources
Kaiser Health News, The 19th, Stateline (Pew), Route Fifty, Ballotpedia, StateScoop, and state-specific outlets

### Local Sources
Strong Towns, National League of Cities, ICMA, CityLab, Next City, Governing Magazine, and local news aggregators

---

## Edge Function: `intel-briefing`

### Sync Process
1. Fetches RSS/Atom feeds from all configured sources (90+)
2. Parses XML entries for title, link, summary, publication date
3. Applies automated category detection via keyword matching
4. Parallelized fetching in batches of 10 for performance
5. Deduplicates by title before upserting to `intel_briefings` table
6. Assigns scope based on source configuration

### Category Detection

The system automatically categorizes articles using keyword matching across title and summary text:

| Category | Keywords |
|----------|----------|
| economy | economy, inflation, jobs, unemployment, trade, tariff, GDP, recession |
| health | health, medicare, medicaid, hospital, insurance, pandemic, drug |
| immigration | immigration, border, ICE, asylum, migrant, deportation |
| education | education, school, student, university, college, teacher |
| environment | climate, environment, EPA, pollution, energy, renewable |
| defense | military, defense, Pentagon, veteran, NATO, troops |
| justice | court, judge, justice, police, crime, prison, law enforcement |
| technology | tech, AI, cybersecurity, data, digital, internet, privacy |
| general | (default fallback) |

---

## Full Article Rendering

When a user clicks a briefing, IntelHub fetches the full article text:

1. Calls `scrape-article` edge function with the article URL
2. Uses Firecrawl API (`FIRECRAWL_API_KEY`) to extract article content
3. Strips navigation, ads, and non-article elements
4. Renders as Markdown in a Win98-style draggable window
5. Falls back to summary text if scraping fails

### Article Caching
- Articles are cached in `localStorage` for offline viewing
- Cache key: article URL hash
- Supports offline-first pattern for previously viewed articles

---

## UI Features

### List View
- Briefings sorted by publication date (newest first)
- Category badges with color coding
- Source name and publication date
- Search filter across title and summary
- Manual "Pull Updates" sync button (admin)

### Detail View (Win98 Window)
- Full article text rendered as Markdown
- Source attribution with external link
- Publication date and category badge
- Loading spinner during article fetch
- PDF export button

### PDF Export
- Generates branded PDF of the selected briefing
- Includes title, source, date, category, and full content
- Uses `jsPDF` with `applyPdfBranding()` utility

---

## Database Table: `intel_briefings`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `scope` | text | local, state, national, international |
| `category` | text | Auto-detected category (economy, health, etc.) |
| `title` | text | Article title |
| `summary` | text | Brief description |
| `content` | text | Full article text (when scraped) |
| `source_name` | text | Name of the source outlet |
| `source_url` | text | URL to original article |
| `published_at` | timestamptz | Publication date |
| `region` | text | Geographic region (optional) |
| `created_at` | timestamptz | Record creation time |
| `updated_at` | timestamptz | Last update time |

### RLS Policies
- **Authenticated users** can read all intel briefings
- **Admins** can manage (create, update, delete) intel briefings

---

## Sidebar Integration

IntelHub is accessible from the sidebar under the 🕵️ icon as "IntelHub". The section count reflects the total number of briefings loaded.

## Dashboard Quick Navigation

IntelHub is included in the Dashboard quick navigation grid alongside all other main sections.
