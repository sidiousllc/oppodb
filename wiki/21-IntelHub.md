# Feature: IntelHub — Intelligence Briefings

## Description

IntelHub is the intelligence briefings section of OppoDB, aggregating news and analysis from **150+ RSS/Atom sources** across four scopes: Local, State, National, and International. It provides automated category detection across 19 categories, full article text rendering, and PDF export capabilities.

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

## Data Sources (150+ RSS/Atom Feeds)

### International Sources (40+)
**Wire Services & Major Outlets:** Reuters World, AP World News, BBC World, Al Jazeera, The Guardian World, The Economist, Financial Times World, UN News, Euronews

**Regional Outlets:** Deutsche Welle, France 24, Japan Times, South China Morning Post, Middle East Eye, The Diplomat, Nikkei Asia, Times of India, Kyiv Independent, Moscow Times, Haaretz, GlobalVoices, The New Humanitarian, The Africa Report, Latin America Reports, World Politics Review

**Think Tanks:** Foreign Affairs, Carnegie Endowment, Council on Foreign Relations, CSIS, Brookings Global/Foreign Policy, Chatham House, Atlantic Council, Wilson Center, RAND Corporation, Stimson Center, International Crisis Group, War on the Rocks, Just Security

### National Sources (60+)
**Major Political News:** Politico Playbook, Politico Congress, The Hill, Roll Call, Axios, 1440 Daily Digest, Ground News, CQ Roll Call

**Wire & Broadcast:** AP News Politics, Reuters US Politics, NPR Politics, NBC/CBS/CNN/ABC/PBS News Politics, Washington Post, USA Today, C-SPAN

**Newsletters & Digests:** Punchbowl News, Semafor, FiveThirtyEight, RealClearPolitics, The Dispatch, AllSides

**Investigative:** ProPublica, The Intercept, Vox Policy, Slate Politics, The Atlantic Politics

**Right-Leaning:** Daily Caller, Washington Examiner, National Review, Washington Free Beacon, The Federalist, Townhall, Daily Wire, Breitbart, RedState

**Left-Leaning:** The Nation, Mother Jones, Talking Points Memo, The New Republic, Daily Beast, HuffPost, Salon, Jacobin, Democracy Now!

**Think Tanks:** Brookings, Heritage Foundation, CAP, AEI, Cato, Urban Institute, Niskanen, Third Way, R Street, Manhattan Institute, Hoover, EPI, CBPP, BPC, Tax Foundation, CRFB, American Action Forum, New America

**Legal & Economy:** SCOTUSblog, Lawfare, Brennan Center, Volokh Conspiracy, MarketWatch Economy, CNBC Politics

### State Sources (55+)
**State-Focused National:** Stateline (Pew), Route Fifty, Governing, NCSL, Ballotpedia, States Newsroom, StateScoop, CSG, POLITICO State

**Issue-Specific:** Kaiser Health News, The 19th, Education Week, Chalkbeat, Tax Foundation, Grist, Inside Climate News, Hechinger Report, Marshall Project, The Appeal, Reason Foundation

**Election-Specific:** Cook Political Report, Sabato Crystal Ball, Inside Elections, Decision Desk HQ

**State-Specific Networks (30+ states):** CalMatters, Texas Tribune, Nevada Independent, Bridge Michigan, Wisconsin Watch, PA Capital-Star, NC Policy Watch, Georgia Recorder, Arizona Mirror, Florida Phoenix, Minnesota Reformer, Ohio Capital Journal, Virginia Mercury, NH Bulletin, Iowa Capital Dispatch, Colorado Sun, Oregon Capital Chronicle, Kansas Reflector, Missouri Independent, NJ Monitor, CT Mirror, Kentucky Lantern, Indiana Capital Chronicle, Maryland Matters, Louisiana Illuminator, Alaska Beacon, Montana Free Press, SD Searchlight, Idaho Capital Sun, Wyoming News Exchange, Nebraska Examiner, Maine Morning Star

### Local Sources (25+)
**National Local Outlets:** CityLab, Next City, Patch National, ICMA, Strong Towns, NLC, US Conference of Mayors, Smart Cities Dive, Governing Local, Shelterforce, Route Fifty Local, County News (NACo)

**Local Issue Coverage:** NLIHC Housing, Education Dive, Smart Growth America, TransitCenter, Streetsblog USA

**Community Journalism:** PublicSource, Documented, City Bureau, The Oaklandside, Block Club Chicago, THE CITY NYC

---

## Edge Function: `intel-briefing`

### Sync Process
1. Fetches RSS/Atom feeds from all configured sources (150+)
2. Parses XML entries for title, link, summary, publication date
3. Applies automated category detection via keyword matching across 19 categories
4. Parallelized fetching in batches of 10 for performance
5. Deduplicates by title + source_name before upserting to `intel_briefings` table
6. Assigns scope based on source configuration
7. Auto-prunes entries older than 48 hours

### Category Detection (19 Categories)

| Category | Keywords |
|----------|----------|
| economy | economy, GDP, inflation, market, trade, tariff, jobs, unemployment, recession, interest rate |
| elections | election, ballot, vote, campaign, primary, caucus, gerrymandering, redistrict |
| legal | court, judicial, SCOTUS, legal, law, ruling, justice, indictment, lawsuit |
| defense | military, defense, NATO, Pentagon, war, security, weapon, drone |
| health | health, COVID, pandemic, hospital, Medicare, Medicaid, opioid, fentanyl |
| environment | climate, environment, energy, EPA, emission, renewable, solar, wind, fossil |
| immigration | immigration, border, asylum, migrant, refugee, deportation, ICE |
| education | education, school, student, university, college, teacher, tuition |
| housing | housing, rent, mortgage, homelessness, eviction, affordable housing |
| public-safety | crime, police, prison, gun, shooting, FBI, DOJ |
| technology | tech, AI, artificial intelligence, cyber, data privacy, social media, TikTok |
| fiscal | tax, budget, deficit, debt ceiling, appropriation, spending bill |
| labor | labor, union, strike, minimum wage, worker, overtime |
| infrastructure | infrastructure, bridge, highway, broadband, rail, transit |
| veterans | veteran, VA, military family, service member |
| reproductive-rights | abortion, reproductive, Roe, Dobbs, IVF, contraception |
| social-security | Social Security, retirement, pension, 401k |
| agriculture | agriculture, farm, crop, USDA, rural |
| general | (default fallback) |

---

## Full Article Rendering

When a user clicks a briefing, IntelHub fetches the full article text:

1. Calls `scrape-article` edge function with the article URL
2. Uses Firecrawl API (`FIRECRAWL_API_KEY`) to extract article content
3. Strips navigation, ads, and non-article elements
4. Renders as Markdown in a Win98-style draggable window
5. Falls back to summary text if scraping fails

---

## UI Features

### List View
- Briefings grouped by source, sorted by publication date (newest first)
- Source name and publication date
- Scope tab filtering (Local/State/National/International)
- Per-scope and "Sync All" buttons
- PDF export of all briefings in current scope

### Detail View (Win98 Window)
- Full article text rendered as Markdown via ReactMarkdown
- Source attribution with external link
- Publication date and scope badge
- Loading spinner during article fetch
- Individual PDF export button

### PDF Export
- Generates branded PDF of selected briefing or full scope
- Includes title, source, date, category, and full content
- Uses `jsPDF` with `applyPdfBranding()` utility

---

## Database Table: `intel_briefings`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `scope` | text | local, state, national, international |
| `category` | text | Auto-detected category (19 options) |
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
