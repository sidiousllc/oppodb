/**
 * OSINT Tools Registry — 21 research tools across 3 categories.
 *
 * Each tool is a self-contained spec: the OSINTToolPanel reads this and renders
 * a search UI, builds a URL or invokes an edge function, and (optionally) shows
 * an AI panel pinned to the result.
 *
 * Tool kinds:
 *  - "url"     : query is encoded into a target URL; opened in a new tab.
 *  - "edge"    : invokes an edge function (osint-search) with `params`.
 *  - "lookup"  : fetches a public JSON endpoint client-side (CORS-permitting).
 *
 * Required API keys (when present) are looked up by `apiKey` field and read
 * from `user_integrations` via the credential-vault. If a required key is
 * missing, the panel deep-links the user to ProfilePage?tab=osint-keys.
 */

export type OSINTCategory = "people" | "business" | "property";

export type OSINTTool = {
  id: string;
  category: OSINTCategory;
  emoji: string;
  label: string;
  description: string;
  longDescription: string;
  source: string;
  sourceUrl: string;
  /** How the tool is invoked. */
  kind: "url" | "edge" | "lookup";
  /** For "url": template with `{q}` placeholder, encoded automatically. */
  urlTemplate?: string;
  /** For "edge": which osint-search backend handler to call. */
  edgeAction?: string;
  /** For "lookup": direct GET endpoint with `{q}` placeholder. */
  lookupUrl?: string;
  /** Optional API key requirement (matched against user_integrations.service). */
  apiKey?: {
    service: string;
    label: string;
    helpUrl: string;
    helpText: string;
    free: boolean;
  };
  /** Hint text shown above the search input. */
  inputHint: string;
  inputPlaceholder: string;
  /** Tags shown as pill chips on the dashboard card. */
  tags: string[];
  /** Default subject context for the Subject AI panel. */
  aiSubjectType: "person" | "org" | "asset" | "domain";
};

export const OSINT_TOOLS: OSINTTool[] = [
  // ============================================================
  // PEOPLE & IDENTITY (8 tools)
  // ============================================================
  {
    id: "username-search",
    category: "people",
    emoji: "👤",
    label: "Username Search",
    description: "Find a username across 400+ social networks (Sherlock-style).",
    longDescription:
      "Discovers profile pages on Twitter/X, GitHub, Reddit, Instagram, TikTok, LinkedIn, YouTube, Twitch, and 400+ more sites by checking which network responds with a profile page for the supplied username. Powered by WhatsMyName public registry.",
    source: "WhatsMyName / Sherlock registry",
    sourceUrl: "https://whatsmyname.app/",
    kind: "edge",
    edgeAction: "username_search",
    inputHint: "Enter a username (no @ prefix). Tries all major social networks.",
    inputPlaceholder: "e.g. johndoe123",
    tags: ["Free", "400+ sites", "No key required"],
    aiSubjectType: "person",
  },
  {
    id: "email-breach",
    category: "people",
    emoji: "🔓",
    label: "Email Breach Check",
    description: "Have I Been Pwned — known data breaches an email appeared in.",
    longDescription:
      "Queries the Have I Been Pwned database (12B+ leaked credentials) to determine which breaches an email address has been part of, including breach dates, data classes exposed (passwords, addresses, SSNs, etc.), and severity.",
    source: "Have I Been Pwned API v3",
    sourceUrl: "https://haveibeenpwned.com/API/v3",
    kind: "edge",
    edgeAction: "email_breach",
    apiKey: {
      service: "hibp",
      label: "HIBP API Key",
      helpUrl: "https://haveibeenpwned.com/API/Key",
      helpText: "$3.95/mo subscription. Use the 'hibp-api-key' header value from your dashboard.",
      free: false,
    },
    inputHint: "Enter an email address. Returns breach list with severity & data classes.",
    inputPlaceholder: "user@example.com",
    tags: ["Paid API", "12B+ records"],
    aiSubjectType: "person",
  },
  {
    id: "phone-lookup",
    category: "people",
    emoji: "📞",
    label: "Phone Reverse Lookup",
    description: "Carrier, line type (mobile/landline/VoIP), country, region.",
    longDescription:
      "Identifies the carrier, line type, and approximate region for any phone number using NumVerify (free tier 100/month). Cross-references with public spam-reporting databases for known robocaller flags.",
    source: "NumVerify + OpenCNAM",
    sourceUrl: "https://numverify.com/documentation",
    kind: "edge",
    edgeAction: "phone_lookup",
    apiKey: {
      service: "numverify",
      label: "NumVerify API Key",
      helpUrl: "https://numverify.com/product",
      helpText: "Free tier: 100 lookups/month. Paid plans from $14.99/mo.",
      free: true,
    },
    inputHint: "E.164 format (+15551234567) or US 10-digit. Returns carrier + line type.",
    inputPlaceholder: "+15551234567",
    tags: ["Free tier", "Carrier + region"],
    aiSubjectType: "person",
  },
  {
    id: "social-archive",
    category: "people",
    emoji: "🗄️",
    label: "Social Media Archive",
    description: "Find deleted tweets, archived posts, removed Reddit threads.",
    longDescription:
      "Searches the Wayback Machine, Politwoops (deleted politician tweets), Reddit Pushshift archive, and ArchiveToday for deleted or modified social media posts attributable to a person, handle, or topic.",
    source: "Wayback Machine + Politwoops + ArchiveToday",
    sourceUrl: "https://web.archive.org/",
    kind: "edge",
    edgeAction: "social_archive",
    inputHint: "Enter a username, handle, or full social URL to find archived/deleted versions.",
    inputPlaceholder: "@username or https://twitter.com/user/status/...",
    tags: ["Free", "Deleted posts", "Multi-source"],
    aiSubjectType: "person",
  },
  {
    id: "public-records",
    category: "people",
    emoji: "📋",
    label: "Public Records Aggregator",
    description: "TruePeopleSearch / FastPeopleSearch / BeenVerified portals.",
    longDescription:
      "Builds direct deep-links into the major free public-records aggregators (TruePeopleSearch, FastPeopleSearch, ThatsThem, Spokeo, BeenVerified) so you can pivot from a name + state to known addresses, relatives, and phone numbers without paying per-lookup.",
    source: "Multiple aggregators (deep-link)",
    sourceUrl: "https://www.truepeoplesearch.com/",
    kind: "url",
    urlTemplate: "https://www.truepeoplesearch.com/results?name={q}",
    inputHint: "First Last (optionally add a state in the input). Opens in a new tab.",
    inputPlaceholder: "John Smith California",
    tags: ["Free", "Multi-portal", "Deep-link"],
    aiSubjectType: "person",
  },
  {
    id: "license-lookup",
    category: "people",
    emoji: "📜",
    label: "Professional License Lookup",
    description: "State licensure boards: medical, legal, accounting, real estate.",
    longDescription:
      "Indexes 200+ state licensing board search portals for professionals (doctors, lawyers, CPAs, real-estate brokers, nurses, contractors). Useful for verifying credentials, checking disciplinary actions, and confirming a candidate's stated profession.",
    source: "State licensing board portals",
    sourceUrl: "https://www.docinfo.org/",
    kind: "url",
    urlTemplate: "https://www.docinfo.org/#!/search/{q}",
    inputHint: "Last name (and state code for some boards). Defaults to physician search.",
    inputPlaceholder: "Smith CA",
    tags: ["Free", "Disciplinary records"],
    aiSubjectType: "person",
  },
  {
    id: "sex-offender",
    category: "people",
    emoji: "⚠️",
    label: "Sex Offender Registry",
    description: "DOJ National Sex Offender Public Website (NSOPW).",
    longDescription:
      "Searches the federal NSOPW unified registry, which aggregates data from all 50 states, DC, US territories, and federally recognized tribes. Returns offender details, address, conviction info, and risk level (where assigned).",
    source: "DOJ NSOPW",
    sourceUrl: "https://www.nsopw.gov/",
    kind: "url",
    urlTemplate: "https://www.nsopw.gov/search-public-sex-offender-registries?keyword={q}",
    inputHint: "Last name + state. Federal NSOPW covers all 50 states.",
    inputPlaceholder: "Smith TX",
    tags: ["Free", "Federal"],
    aiSubjectType: "person",
  },
  {
    id: "obituary-genealogy",
    category: "people",
    emoji: "🌳",
    label: "Obituary & Genealogy",
    description: "FamilySearch, Find a Grave, Newspapers.com obituaries.",
    longDescription:
      "Cross-searches Find a Grave (210M+ memorials), Legacy.com obituary network (1500+ newspapers), and the FamilySearch genealogy database (free with account). Useful for confirming family relationships, dates of death, and historical context.",
    source: "Find a Grave + Legacy.com + FamilySearch",
    sourceUrl: "https://www.findagrave.com/",
    kind: "url",
    urlTemplate: "https://www.findagrave.com/memorial/search?firstname=&lastname={q}",
    inputHint: "Last name (optionally add first name and birth year).",
    inputPlaceholder: "Smith John 1942",
    tags: ["Free", "210M memorials"],
    aiSubjectType: "person",
  },

  // ============================================================
  // BUSINESS & CORPORATE (7 tools)
  // ============================================================
  {
    id: "sec-edgar",
    category: "business",
    emoji: "📈",
    label: "SEC EDGAR Filings",
    description: "Public company filings: 10-K, 10-Q, 8-K, proxy, insider trades.",
    longDescription:
      "Direct access to the SEC EDGAR full-text search across all public company filings since 2001. Includes 10-K (annual), 10-Q (quarterly), 8-K (material events), DEF 14A (proxy), Form 4 (insider trades), and Schedule 13D/G (beneficial ownership).",
    source: "SEC EDGAR full-text search",
    sourceUrl: "https://efts.sec.gov/LATEST/search-index",
    kind: "edge",
    edgeAction: "sec_edgar",
    inputHint: "Company name, ticker, CIK, or full-text query (e.g. 'climate risk exposure').",
    inputPlaceholder: "Tesla OR climate risk",
    tags: ["Free", "Federal", "Full-text"],
    aiSubjectType: "org",
  },
  {
    id: "opencorporates",
    category: "business",
    emoji: "🏢",
    label: "OpenCorporates Entity Search",
    description: "200M+ corporate entities across 140+ jurisdictions.",
    longDescription:
      "World's largest open corporate database. Returns entity name, jurisdiction, registration number, status, registered address, officers, and parent/subsidiary relationships. Free tier permits ~500 reads/month per API key.",
    source: "OpenCorporates v0.4 API",
    sourceUrl: "https://api.opencorporates.com/documentation/API-Reference",
    kind: "edge",
    edgeAction: "opencorporates",
    apiKey: {
      service: "opencorporates",
      label: "OpenCorporates API Token",
      helpUrl: "https://opencorporates.com/api_accounts/new",
      helpText: "Free tier (500/mo). Paid plans from $39/mo. Add token to user_integrations.",
      free: true,
    },
    inputHint: "Company name; results across 140+ jurisdictions.",
    inputPlaceholder: "Acme Holdings LLC",
    tags: ["Free tier", "200M entities", "140 jurisdictions"],
    aiSubjectType: "org",
  },
  {
    id: "ucc-filings",
    category: "business",
    emoji: "📄",
    label: "UCC Filings",
    description: "Secured-debt filings from state Secretary of State databases.",
    longDescription:
      "Uniform Commercial Code Article 9 filings reveal secured debt: who lent money to a business, what assets are pledged as collateral, and when. Indexes the 50 state SOS UCC search portals via deep-link.",
    source: "Secretary of State UCC portals",
    sourceUrl: "https://www.nass.org/can-I-vote/business-services",
    kind: "url",
    urlTemplate: "https://www.google.com/search?q=%22ucc+filing+search%22+{q}",
    inputHint: "Debtor name + state. Cross-state UCC search via state SOS portals.",
    inputPlaceholder: "Acme Holdings Texas",
    tags: ["Free", "Per-state"],
    aiSubjectType: "org",
  },
  {
    id: "bankruptcy",
    category: "business",
    emoji: "⚖️",
    label: "Bankruptcy Records",
    description: "PACER federal bankruptcy court filings (RECAP/CourtListener).",
    longDescription:
      "Federal bankruptcy court records via the RECAP archive (CourtListener), which mirrors PACER documents at no cost. Returns case number, chapter (7/11/13), filing date, debtor entity, and creditor list.",
    source: "CourtListener RECAP (PACER mirror)",
    sourceUrl: "https://www.courtlistener.com/help/api/rest/",
    kind: "edge",
    edgeAction: "bankruptcy",
    inputHint: "Debtor name or business. Federal bankruptcy court records via RECAP.",
    inputPlaceholder: "Acme Holdings Inc",
    tags: ["Free", "Federal", "PACER mirror"],
    aiSubjectType: "org",
  },
  {
    id: "trademark-patent",
    category: "business",
    emoji: "®️",
    label: "Trademark & Patent Search",
    description: "USPTO trademark (TESS) and patent (PatFT) databases.",
    longDescription:
      "Searches USPTO Trademark Electronic Search System (TESS) for registered marks and the patent full-text database (PatFT) for granted patents. Reveals brand portfolios, IP strategy, and inventor/assignee relationships.",
    source: "USPTO TESS + PatFT",
    sourceUrl: "https://tmsearch.uspto.gov/",
    kind: "url",
    urlTemplate: "https://tmsearch.uspto.gov/bin/showfield?f=toc&state=4801%3Ar1jp1m.1.1&p_search=searchss&p_L=50&BackReference=&p_plural=yes&p_s_PARA1=&p_tagrepl%7E%3A=PARA1%24LD&expr=PARA1+AND+PARA2&p_s_PARA2={q}",
    inputHint: "Trademark text or patent keyword. Opens USPTO TESS in new tab.",
    inputPlaceholder: "Apple OR neural network",
    tags: ["Free", "Federal"],
    aiSubjectType: "org",
  },
  {
    id: "sam-exclusion",
    category: "business",
    emoji: "🚫",
    label: "SAM.gov Exclusions",
    description: "Federal contractor debarment & suspension list.",
    longDescription:
      "System for Award Management (SAM.gov) Exclusions search — companies and individuals barred from receiving federal contracts. Returns exclusion type, agency, dates, and reason codes.",
    source: "SAM.gov Exclusions API",
    sourceUrl: "https://open.gsa.gov/api/sam-exclusions/",
    kind: "edge",
    edgeAction: "sam_exclusion",
    apiKey: {
      service: "sam_gov",
      label: "SAM.gov API Key",
      helpUrl: "https://open.gsa.gov/api/sam-exclusions/",
      helpText: "Free; register at api.data.gov for an API key.",
      free: true,
    },
    inputHint: "Entity or person name. Federal debarment registry.",
    inputPlaceholder: "Acme Holdings",
    tags: ["Free", "Federal debarment"],
    aiSubjectType: "org",
  },
  {
    id: "fda-enforcement",
    category: "business",
    emoji: "💊",
    label: "FDA Enforcement Actions",
    description: "FDA recalls, warning letters, and 483 inspection observations.",
    longDescription:
      "openFDA enforcement reports across drug, device, food, and cosmetic recalls, plus FDA Warning Letters and 483 inspection observations. Indicates regulatory exposure for healthcare and food companies.",
    source: "openFDA API",
    sourceUrl: "https://open.fda.gov/apis/",
    kind: "edge",
    edgeAction: "fda_enforcement",
    inputHint: "Company or product name. FDA recalls + warning letters + 483s.",
    inputPlaceholder: "Pfizer OR Tylenol",
    tags: ["Free", "No key required", "Federal"],
    aiSubjectType: "org",
  },

  // ============================================================
  // PROPERTY & WEB INTEL (6 tools)
  // ============================================================
  {
    id: "property-deed",
    category: "property",
    emoji: "🏠",
    label: "Property & Deed Records",
    description: "County assessor & recorder portals for property ownership.",
    longDescription:
      "Indexes county-level assessor and recorder portals across all 50 states. Reveals property ownership, sale history, deed transfers, mortgage liens, and assessed valuation. Coverage varies — most populous counties offer free online search.",
    source: "County assessor portals",
    sourceUrl: "https://publicrecords.netronline.com/",
    kind: "url",
    urlTemplate: "https://publicrecords.netronline.com/search?q={q}",
    inputHint: "Owner name + county/state. Pivots to county assessor portal.",
    inputPlaceholder: "Smith Los Angeles County",
    tags: ["Free", "County-level"],
    aiSubjectType: "asset",
  },
  {
    id: "faa-aircraft",
    category: "property",
    emoji: "✈️",
    label: "FAA Aircraft Registry",
    description: "FAA N-Number registry: aircraft owner & registration details.",
    longDescription:
      "Federal Aviation Administration aircraft registration database covering every US-registered aircraft. Search by N-number (tail number), owner name, or aircraft serial. Returns owner address, aircraft make/model, year, and registration status.",
    source: "FAA Aircraft Registry",
    sourceUrl: "https://registry.faa.gov/",
    kind: "edge",
    edgeAction: "faa_aircraft",
    inputHint: "N-number (e.g. N12345) or owner name.",
    inputPlaceholder: "N12345",
    tags: ["Free", "No key required", "Federal"],
    aiSubjectType: "asset",
  },
  {
    id: "uscg-vessels",
    category: "property",
    emoji: "🚢",
    label: "USCG Vessel Registry",
    description: "US Coast Guard documented vessels & MMSI lookup.",
    longDescription:
      "US Coast Guard documented vessel registry (vessels ≥5 net tons engaged in commerce) plus MMSI lookup for AIS-tracked ships. Returns vessel name, owner, hailing port, dimensions, and current AIS position (where available via MarineTraffic).",
    source: "USCG NVDC + MarineTraffic",
    sourceUrl: "https://cgmix.uscg.mil/PSIX/Default.aspx",
    kind: "url",
    urlTemplate: "https://cgmix.uscg.mil/PSIX/PSIXSearch.aspx?SearchType=2&VesselName={q}",
    inputHint: "Vessel name, USCG number, or MMSI.",
    inputPlaceholder: "Black Pearl",
    tags: ["Free", "Federal"],
    aiSubjectType: "asset",
  },
  {
    id: "real-estate-tx",
    category: "property",
    emoji: "💰",
    label: "Real Estate Transactions",
    description: "Recent property sales (Zillow / Redfin / Realtor.com).",
    longDescription:
      "Aggregates recent real-estate sale data from public listings on Zillow, Redfin, and Realtor.com. Useful for cross-checking declared income, primary-residence claims, or hidden investment properties.",
    source: "Zillow / Redfin / Realtor.com",
    sourceUrl: "https://www.zillow.com/",
    kind: "url",
    urlTemplate: "https://www.zillow.com/homes/{q}_rb/",
    inputHint: "Address, ZIP, or city/state. Opens Zillow listings in new tab.",
    inputPlaceholder: "1600 Pennsylvania Ave NW Washington DC",
    tags: ["Free", "Multi-portal"],
    aiSubjectType: "asset",
  },
  {
    id: "wayback-machine",
    category: "property",
    emoji: "⏪",
    label: "Wayback Machine",
    description: "Internet Archive snapshots of any URL through history.",
    longDescription:
      "Internet Archive's Wayback Machine — 800B+ archived web pages going back to 1996. Find old versions of websites, deleted statements, removed press releases, and discontinued bios. Powered by the Wayback Machine CDX API for snapshot listing.",
    source: "Internet Archive Wayback Machine",
    sourceUrl: "https://web.archive.org/",
    kind: "edge",
    edgeAction: "wayback",
    inputHint: "Full URL to find archived snapshots. Returns snapshot timeline.",
    inputPlaceholder: "https://example.com/about",
    tags: ["Free", "No key required", "800B pages"],
    aiSubjectType: "domain",
  },
  {
    id: "whois-dns",
    category: "property",
    emoji: "🌐",
    label: "WHOIS & DNS Intel",
    description: "Domain registrant, DNS records, MX/SPF, hosting history.",
    longDescription:
      "WHOIS registrant info (where not redacted by GDPR/privacy proxies), full DNS record set (A/AAAA/MX/TXT/NS/SPF/DMARC), reverse DNS, hosting provider, and historical DNS via SecurityTrails (free tier).",
    source: "WHOIS + Cloudflare DoH + SecurityTrails",
    sourceUrl: "https://securitytrails.com/corp/api",
    kind: "edge",
    edgeAction: "whois_dns",
    apiKey: {
      service: "securitytrails",
      label: "SecurityTrails API Key",
      helpUrl: "https://securitytrails.com/corp/api",
      helpText: "Free tier 50/month. WHOIS + current DNS work without a key.",
      free: true,
    },
    inputHint: "Domain (no protocol). Returns WHOIS, DNS, hosting info.",
    inputPlaceholder: "example.com",
    tags: ["Free", "DNS + WHOIS"],
    aiSubjectType: "domain",
  },

  // ============================================================
  // EXPANSION BATCH — People & Identity (12 more)
  // ============================================================
  { id: "gravatar", category: "people", emoji: "🖼️", label: "Gravatar Profile", description: "Email → public Gravatar profile (name, bio, social links).", longDescription: "Resolves an email address to its public Gravatar profile (avatar, display name, bio, verified accounts, URLs). Useful for tying an email to social presence without paid services.", source: "Gravatar", sourceUrl: "https://docs.gravatar.com/api/profiles/", kind: "edge", edgeAction: "gravatar", inputHint: "Email address. Returns public Gravatar profile if one exists.", inputPlaceholder: "user@example.com", tags: ["Free", "No key"], aiSubjectType: "person" },
  { id: "github-user", category: "people", emoji: "🐙", label: "GitHub User Intel", description: "Public profile, repos, orgs, email leaks, recent activity.", longDescription: "Pulls a GitHub user's public profile, top repositories, organizations, and recent public events. Surfaces email addresses leaked via commits and links to other developers.", source: "GitHub REST API", sourceUrl: "https://docs.github.com/rest", kind: "edge", edgeAction: "github_user", inputHint: "GitHub username (no @). Returns profile + repos + orgs.", inputPlaceholder: "octocat", tags: ["Free", "No key", "Dev OSINT"], aiSubjectType: "person" },
  { id: "ssdi-search", category: "people", emoji: "📑", label: "SSDI / Death Index", description: "Social Security Death Index via FamilySearch (1936–present).", longDescription: "Searches the Social Security Death Index (100M+ records since 1936) via FamilySearch. Returns name, SSN state of issue, birth/death dates. Free with FamilySearch account.", source: "FamilySearch SSDI", sourceUrl: "https://www.familysearch.org/search/collection/1202535", kind: "url", urlTemplate: "https://www.familysearch.org/search/record/results?f.collectionId=1202535&q.givenName=&q.surname={q}", inputHint: "Last name (and optionally first name + birth year).", inputPlaceholder: "Smith John 1942", tags: ["Free", "100M records"], aiSubjectType: "person" },
  { id: "voter-registration", category: "people", emoji: "🗳️", label: "Voter Registration Lookup", description: "Multi-state portal for verifying voter registration status.", longDescription: "Indexes the 50 state Secretary of State voter-lookup portals via Vote.org. Confirm registration status, polling place, and party affiliation (where public).", source: "Vote.org / state SOS portals", sourceUrl: "https://www.vote.org/am-i-registered-to-vote/", kind: "url", urlTemplate: "https://www.vote.org/am-i-registered-to-vote/?q={q}", inputHint: "Name + state. Opens Vote.org's per-state registration check.", inputPlaceholder: "John Smith TX", tags: ["Free", "All 50 states"], aiSubjectType: "person" },
  { id: "fec-individual", category: "people", emoji: "💵", label: "FEC Donor Search", description: "Individual federal political contributions (FEC).", longDescription: "Federal Election Commission individual contribution database. Search by donor name, employer, or city/state to find every federal political donation since 1980.", source: "FEC OpenFEC API", sourceUrl: "https://api.open.fec.gov/", kind: "url", urlTemplate: "https://www.fec.gov/data/receipts/individual-contributions/?contributor_name={q}", inputHint: "Donor name (Last, First). Federal contributions only — state lookups via Voter Data tab.", inputPlaceholder: "Smith John", tags: ["Free", "Federal", "1980→present"], aiSubjectType: "person" },
  { id: "judyrecords", category: "people", emoji: "👨‍⚖️", label: "JudyRecords State Courts", description: "660M+ state court cases — civil, criminal, family, probate.", longDescription: "JudyRecords aggregates 660M+ state-level court records across the US (federal cases via CourtListener separately). Free name search; results link out to court detail.", source: "JudyRecords", sourceUrl: "https://www.judyrecords.com/", kind: "url", urlTemplate: "https://www.judyrecords.com/search?q={q}", inputHint: "Party name (Last, First). Returns matching state court cases.", inputPlaceholder: "John Smith", tags: ["Free", "660M cases", "All 50 states"], aiSubjectType: "person" },
  { id: "linkedin-people", category: "people", emoji: "💼", label: "LinkedIn People Search", description: "Google-dorked LinkedIn profile discovery.", longDescription: "Uses Google site-search to surface LinkedIn profiles indexed publicly without requiring a LinkedIn login. Effective for finding current employer, role, and history.", source: "Google site:linkedin.com", sourceUrl: "https://www.google.com/", kind: "url", urlTemplate: "https://www.google.com/search?q=site%3Alinkedin.com%2Fin+{q}", inputHint: "Name + employer or location. Opens Google site:linkedin.com search.", inputPlaceholder: "Jane Doe Acme Corp", tags: ["Free", "Google dork"], aiSubjectType: "person" },
  { id: "twitter-advanced", category: "people", emoji: "🐦", label: "Twitter/X Advanced Search", description: "Direct deep-link to X advanced search operators.", longDescription: "Builds a Twitter/X advanced search URL with phrase, from-account, date range, and engagement filters pre-populated. Works without a logged-in session.", source: "twitter.com/search-advanced", sourceUrl: "https://twitter.com/search-advanced", kind: "url", urlTemplate: "https://twitter.com/search?q={q}&src=typed_query&f=live", inputHint: "Use X operators: from:user, since:2024-01-01, \"exact phrase\".", inputPlaceholder: "from:elonmusk since:2024-01-01", tags: ["Free", "X operators"], aiSubjectType: "person" },
  { id: "reddit-user", category: "people", emoji: "🤖", label: "Reddit User History", description: "Public comments, posts, karma, subreddit activity.", longDescription: "Fetches a Reddit user's public profile, account age, karma totals, and recent comments/posts via the public reddit.com/user/{name}.json endpoint.", source: "Reddit public API", sourceUrl: "https://www.reddit.com/dev/api", kind: "edge", edgeAction: "reddit_user", inputHint: "Reddit username (no /u/ prefix).", inputPlaceholder: "spez", tags: ["Free", "No key"], aiSubjectType: "person" },
  { id: "ip-geo", category: "people", emoji: "📍", label: "IP Geolocation & ASN", description: "IP → country, city, ASN, ISP, hosting provider.", longDescription: "Resolves an IPv4/IPv6 address to country, region, city, latitude/longitude, ASN, ISP, and whether it's a known datacenter/VPN/Tor exit. Powered by ip-api.com (free, 45 req/min).", source: "ip-api.com", sourceUrl: "https://ip-api.com/", kind: "edge", edgeAction: "ip_geo", inputHint: "Public IPv4 or IPv6 address.", inputPlaceholder: "8.8.8.8", tags: ["Free", "No key"], aiSubjectType: "person" },
  { id: "discord-id", category: "people", emoji: "💬", label: "Discord ID → Account", description: "Resolve Discord snowflake to creation date + lookup tools.", longDescription: "Decodes a Discord user ID (snowflake) to its account creation timestamp and links to public lookup utilities (DiscordLookup, Lanyard) for username/avatar resolution.", source: "Discord snowflake decoder", sourceUrl: "https://discordlookup.com/", kind: "url", urlTemplate: "https://discordlookup.com/user/{q}", inputHint: "18-19 digit Discord user ID (snowflake).", inputPlaceholder: "294882584201003009", tags: ["Free", "No key"], aiSubjectType: "person" },
  { id: "telegram-username", category: "people", emoji: "✈️", label: "Telegram Username Check", description: "Verify a Telegram @username and link to the public preview.", longDescription: "Checks whether a Telegram @username is registered and provides the public t.me preview link, channel/group identification, and member count where available.", source: "t.me public preview", sourceUrl: "https://t.me/", kind: "url", urlTemplate: "https://t.me/{q}", inputHint: "Telegram @username (without @).", inputPlaceholder: "telegram", tags: ["Free", "No key"], aiSubjectType: "person" },

  // ============================================================
  // EXPANSION BATCH — Business & Corporate (15 more)
  // ============================================================
  { id: "opensanctions", category: "business", emoji: "🛑", label: "OpenSanctions / PEPs", description: "Sanctions lists, PEPs, criminal watchlists (250+ sources).", longDescription: "Cross-checks an entity or person against OFAC SDN, EU/UN/UK sanctions, OpenSanctions PEP list, Interpol Red Notices, and 250+ other watchlists. Free public API.", source: "OpenSanctions API", sourceUrl: "https://www.opensanctions.org/docs/api/", kind: "edge", edgeAction: "opensanctions", inputHint: "Entity name (person, company, vessel, aircraft).", inputPlaceholder: "Vladimir Putin", tags: ["Free", "No key", "250 sources"], aiSubjectType: "org" },
  { id: "ofac-sdn", category: "business", emoji: "🚨", label: "OFAC SDN List", description: "US Treasury Specially Designated Nationals search.", longDescription: "US Treasury OFAC Specially Designated Nationals (SDN) and Consolidated Sanctions List. Direct deep-link to the official Treasury sanctions search.", source: "US Treasury OFAC", sourceUrl: "https://sanctionssearch.ofac.treas.gov/", kind: "url", urlTemplate: "https://sanctionssearch.ofac.treas.gov/", inputHint: "Open OFAC sanctions search portal in new tab.", inputPlaceholder: "Acme Holdings", tags: ["Free", "Federal", "Treasury"], aiSubjectType: "org" },
  { id: "world-bank-debarred", category: "business", emoji: "🌍", label: "World Bank Debarred Firms", description: "World Bank ineligible/debarred firms & individuals.", longDescription: "World Bank Group's list of firms and individuals ineligible to be awarded contracts (fraud, corruption, collusion). Reveals international corporate misconduct.", source: "World Bank Sanctions", sourceUrl: "https://projects.worldbank.org/en/projects-operations/procurement/debarred-firms", kind: "url", urlTemplate: "https://projects.worldbank.org/en/projects-operations/procurement/debarred-firms?lang=en&searchTerm={q}", inputHint: "Firm or individual name.", inputPlaceholder: "Acme Construction", tags: ["Free", "International"], aiSubjectType: "org" },
  { id: "usaspending", category: "business", emoji: "💸", label: "USAspending Federal Awards", description: "Federal contracts, grants, loans by recipient.", longDescription: "USAspending.gov — every federal award (contracts, grants, loans, financial assistance) since FY2008 with recipient name, agency, amount, and period of performance.", source: "USAspending.gov API", sourceUrl: "https://api.usaspending.gov/", kind: "edge", edgeAction: "usaspending", inputHint: "Recipient name (company or nonprofit). Federal awards since 2008.", inputPlaceholder: "Lockheed Martin", tags: ["Free", "No key", "Federal"], aiSubjectType: "org" },
  { id: "irs-990", category: "business", emoji: "📊", label: "IRS Form 990 (Nonprofits)", description: "Nonprofit financials via ProPublica Nonprofit Explorer.", longDescription: "ProPublica Nonprofit Explorer — IRS Form 990 filings for 1.8M+ tax-exempt orgs. Returns EIN, revenue, expenses, executive compensation, grants made.", source: "ProPublica Nonprofit Explorer", sourceUrl: "https://projects.propublica.org/nonprofits/api", kind: "edge", edgeAction: "irs_990", inputHint: "Nonprofit name or EIN.", inputPlaceholder: "Sierra Club Foundation", tags: ["Free", "No key", "1.8M orgs"], aiSubjectType: "org" },
  { id: "fec-committee", category: "business", emoji: "🏛️", label: "FEC Committees & PACs", description: "Federal PAC, super PAC, and party committee filings.", longDescription: "FEC committee search — find a PAC, super PAC, party committee, or campaign committee. Returns treasurer, address, designated candidate, and totals raised/spent.", source: "FEC OpenFEC", sourceUrl: "https://www.fec.gov/data/committees/", kind: "url", urlTemplate: "https://www.fec.gov/data/committees/?q={q}", inputHint: "Committee name or FEC ID.", inputPlaceholder: "ActBlue", tags: ["Free", "Federal"], aiSubjectType: "org" },
  { id: "lobbying-senate", category: "business", emoji: "📢", label: "Senate LDA Lobbying", description: "Federal lobbying disclosures (LDA filings).", longDescription: "Senate Office of Public Records LDA filings — every registered federal lobbyist, client, issue, and quarterly spend since 1999.", source: "Senate LDA", sourceUrl: "https://lda.senate.gov/system/public/", kind: "url", urlTemplate: "https://lda.senate.gov/system/public/#/search?q={q}", inputHint: "Lobbyist firm or client name.", inputPlaceholder: "Akin Gump", tags: ["Free", "Federal"], aiSubjectType: "org" },
  { id: "fara-doj", category: "business", emoji: "🌐", label: "DOJ FARA Registrants", description: "Foreign Agents Registration Act filings.", longDescription: "DOJ FARA database — agents acting on behalf of foreign principals (governments, parties, corporations). Required disclosures of activities, payments, and informational materials.", source: "DOJ FARA", sourceUrl: "https://efile.fara.gov/", kind: "url", urlTemplate: "https://efile.fara.gov/ords/fara/f?p=1381:1:::NO::P1_SEARCH_TERM:{q}", inputHint: "Registrant or foreign principal name.", inputPlaceholder: "Saudi Arabia", tags: ["Free", "Federal", "Foreign agents"], aiSubjectType: "org" },
  { id: "dnb-quick", category: "business", emoji: "🔢", label: "D&B / DUNS Lookup", description: "Dun & Bradstreet DUNS number lookup (free portal).", longDescription: "Free Dun & Bradstreet entity & DUNS lookup — confirm corporate identity, parent company, and basic firmographics.", source: "D&B free lookup", sourceUrl: "https://www.dnb.com/duns-number/lookup.html", kind: "url", urlTemplate: "https://www.dnb.com/site-search-results.html?q={q}", inputHint: "Company name.", inputPlaceholder: "Acme Holdings", tags: ["Free", "Firmographics"], aiSubjectType: "org" },
  { id: "secstate-business", category: "business", emoji: "🏤", label: "Secretary of State Business", description: "All-50-state business entity search portal index.", longDescription: "Indexes the 50 state Secretary of State business entity search portals. Find an LLC/Corp, registered agent, formation date, status, and annual report history.", source: "NASS state portals", sourceUrl: "https://www.nass.org/can-I-vote/business-services", kind: "url", urlTemplate: "https://www.google.com/search?q=%22business+entity+search%22+{q}", inputHint: "Entity name + state. Pivots to that state's SOS portal.", inputPlaceholder: "Acme Holdings Delaware", tags: ["Free", "All 50 states"], aiSubjectType: "org" },
  { id: "osha-violations", category: "business", emoji: "🦺", label: "OSHA Violations", description: "Federal workplace safety inspections & citations.", longDescription: "OSHA establishment search — every federal workplace inspection, citation, and penalty since 1972. Reveals safety record and willful/serious violations.", source: "OSHA Establishment Search", sourceUrl: "https://www.osha.gov/ords/imis/establishment.html", kind: "url", urlTemplate: "https://www.osha.gov/ords/imis/establishment.search?establishment={q}", inputHint: "Establishment / employer name.", inputPlaceholder: "Acme Manufacturing", tags: ["Free", "Federal"], aiSubjectType: "org" },
  { id: "epa-echo", category: "business", emoji: "🏭", label: "EPA ECHO Enforcement", description: "EPA enforcement & compliance history (air, water, waste).", longDescription: "EPA Enforcement and Compliance History Online (ECHO) — federal environmental violations, penalties, inspections for any regulated facility.", source: "EPA ECHO", sourceUrl: "https://echo.epa.gov/", kind: "url", urlTemplate: "https://echo.epa.gov/facilities/facility-search/results?facility_name={q}", inputHint: "Facility or company name.", inputPlaceholder: "Acme Refining", tags: ["Free", "Federal"], aiSubjectType: "org" },
  { id: "nlrb-cases", category: "business", emoji: "⚒️", label: "NLRB Labor Cases", description: "National Labor Relations Board case search.", longDescription: "NLRB case search — unfair labor practice charges, representation petitions, and decisions involving any employer.", source: "NLRB", sourceUrl: "https://www.nlrb.gov/search/case", kind: "url", urlTemplate: "https://www.nlrb.gov/search/case?search_term={q}", inputHint: "Employer name.", inputPlaceholder: "Starbucks", tags: ["Free", "Federal"], aiSubjectType: "org" },
  { id: "sec-litigation", category: "business", emoji: "🏛️", label: "SEC Litigation Releases", description: "SEC enforcement actions and litigation releases.", longDescription: "SEC Litigation Release archive — every SEC civil enforcement action since 1995 with defendants, allegations, and outcomes.", source: "SEC Litigation Releases", sourceUrl: "https://www.sec.gov/litigation/litreleases", kind: "url", urlTemplate: "https://www.sec.gov/cgi-bin/srqsb?text=form-type%3DLR+{q}", inputHint: "Defendant or topic.", inputPlaceholder: "insider trading", tags: ["Free", "Federal", "SEC"], aiSubjectType: "org" },
  { id: "patent-grants", category: "business", emoji: "💡", label: "Google Patents", description: "Full-text patent search (USPTO + EPO + WIPO).", longDescription: "Google Patents covers USPTO + EPO + WIPO + 100+ patent offices with full-text search, citations, and inventor/assignee networks.", source: "Google Patents", sourceUrl: "https://patents.google.com/", kind: "url", urlTemplate: "https://patents.google.com/?q={q}", inputHint: "Inventor, assignee, or keyword.", inputPlaceholder: "neural network compression", tags: ["Free", "Global"], aiSubjectType: "org" },

  // ============================================================
  // EXPANSION BATCH — Web, Domain & Threat Intel (15 more)
  // ============================================================
  { id: "crtsh", category: "property", emoji: "🔐", label: "Certificate Transparency (crt.sh)", description: "All TLS certs ever issued for a domain → subdomain enum.", longDescription: "crt.sh aggregates every TLS certificate ever issued from public CT logs. Reveals every subdomain ever certificated for a target — gold for attack-surface mapping.", source: "crt.sh", sourceUrl: "https://crt.sh/", kind: "edge", edgeAction: "crtsh", inputHint: "Apex domain (no protocol). Returns all subdomains ever certificated.", inputPlaceholder: "example.com", tags: ["Free", "No key", "Subdomain enum"], aiSubjectType: "domain" },
  { id: "urlscan", category: "property", emoji: "🔬", label: "URLScan.io", description: "Live URL scan: screenshot, requests, IOCs.", longDescription: "URLScan.io performs a live browser-based scan of any URL: screenshot, full request waterfall, contacted IPs/ASNs, indicators of compromise. Free tier (no key) returns recent public scans.", source: "URLScan.io", sourceUrl: "https://urlscan.io/docs/api/", kind: "edge", edgeAction: "urlscan", inputHint: "Domain or full URL. Returns recent public scans + IOCs.", inputPlaceholder: "example.com", tags: ["Free", "No key", "IOCs"], aiSubjectType: "domain" },
  { id: "virustotal", category: "property", emoji: "🦠", label: "VirusTotal Domain/IP/Hash", description: "Multi-AV scan results for a domain, IP, URL, or file hash.", longDescription: "VirusTotal aggregates 70+ antivirus engines and threat-intel sources. Lookup a domain, IP, URL, or file hash to see detection ratio, categorization, and related samples.", source: "VirusTotal v3 API", sourceUrl: "https://docs.virustotal.com/reference/", kind: "edge", edgeAction: "virustotal", apiKey: { service: "virustotal", label: "VirusTotal API Key", helpUrl: "https://www.virustotal.com/gui/my-apikey", helpText: "Free public API: 4 req/min, 500/day. Sign up at virustotal.com.", free: true }, inputHint: "Domain, IP, URL, or SHA256 hash.", inputPlaceholder: "example.com", tags: ["Free tier", "70+ AV engines"], aiSubjectType: "domain" },
  { id: "abuseipdb", category: "property", emoji: "🛡️", label: "AbuseIPDB", description: "IP reputation: spam, scanning, brute-force, DDoS reports.", longDescription: "AbuseIPDB crowdsourced IP reputation — community-reported abuse, spam, scanning, brute-force, DDoS, and malware activity per IP address.", source: "AbuseIPDB API v2", sourceUrl: "https://docs.abuseipdb.com/", kind: "edge", edgeAction: "abuseipdb", apiKey: { service: "abuseipdb", label: "AbuseIPDB API Key", helpUrl: "https://www.abuseipdb.com/account/api", helpText: "Free tier: 1,000 checks/day. Register at abuseipdb.com.", free: true }, inputHint: "IPv4 or IPv6 address.", inputPlaceholder: "8.8.8.8", tags: ["Free tier", "Crowdsourced"], aiSubjectType: "domain" },
  { id: "builtwith", category: "property", emoji: "🧱", label: "BuiltWith Tech Stack", description: "Detect tech stack, CMS, analytics, ad tags on any site.", longDescription: "BuiltWith identifies the entire technology stack of a website — CMS, framework, analytics, ad networks, server tech, payment processors, hosting provider.", source: "BuiltWith", sourceUrl: "https://builtwith.com/", kind: "url", urlTemplate: "https://builtwith.com/{q}", inputHint: "Domain (no protocol).", inputPlaceholder: "example.com", tags: ["Free", "Tech detection"], aiSubjectType: "domain" },
  { id: "wappalyzer", category: "property", emoji: "🧪", label: "Wappalyzer Lookup", description: "Alternative tech stack detection (via deep-link).", longDescription: "Wappalyzer technology lookup — alternative to BuiltWith for detecting CMS, framework, analytics, and tracking tags.", source: "Wappalyzer", sourceUrl: "https://www.wappalyzer.com/lookup/", kind: "url", urlTemplate: "https://www.wappalyzer.com/lookup/{q}/", inputHint: "Domain (no protocol).", inputPlaceholder: "example.com", tags: ["Free", "Tech detection"], aiSubjectType: "domain" },
  { id: "shodan-host", category: "property", emoji: "🛰️", label: "Shodan Host Lookup", description: "Internet-connected device + open-port intelligence.", longDescription: "Shodan scans every IPv4 address — find open ports, banners, vulnerabilities, ICS/SCADA exposure, and historical changes. Free deep-link to host page.", source: "Shodan", sourceUrl: "https://www.shodan.io/", kind: "url", urlTemplate: "https://www.shodan.io/host/{q}", inputHint: "IPv4 address. Free Shodan account required to view full results.", inputPlaceholder: "8.8.8.8", tags: ["Free preview", "Account required"], aiSubjectType: "domain" },
  { id: "censys-host", category: "property", emoji: "📡", label: "Censys Host Search", description: "Alternative internet-wide scanner (Shodan competitor).", longDescription: "Censys provides daily internet-wide scans of every IPv4 — services, certificates, software versions. Free deep-link to host page.", source: "Censys", sourceUrl: "https://search.censys.io/", kind: "url", urlTemplate: "https://search.censys.io/hosts/{q}", inputHint: "IPv4 address.", inputPlaceholder: "8.8.8.8", tags: ["Free preview", "Daily scans"], aiSubjectType: "domain" },
  { id: "greynoise", category: "property", emoji: "🌫️", label: "GreyNoise IP Context", description: "Is this IP scanning the entire internet? (noise filter).", longDescription: "GreyNoise tags IPs that scan the entire internet (mass scanners, security researchers, malicious bots). Helps separate targeted attacks from background noise.", source: "GreyNoise Visualizer", sourceUrl: "https://viz.greynoise.io/", kind: "url", urlTemplate: "https://viz.greynoise.io/ip/{q}", inputHint: "IPv4 address.", inputPlaceholder: "8.8.8.8", tags: ["Free", "Noise filter"], aiSubjectType: "domain" },
  { id: "alienvault-otx", category: "property", emoji: "👽", label: "AlienVault OTX", description: "Threat intel pulses: IOCs, malware families, actors.", longDescription: "AlienVault Open Threat Exchange — community threat-intel pulses tagged to a domain/IP/hash. Reveals known malware C2, phishing, APT activity.", source: "OTX AlienVault", sourceUrl: "https://otx.alienvault.com/", kind: "url", urlTemplate: "https://otx.alienvault.com/indicator/domain/{q}", inputHint: "Domain, IP, or file hash.", inputPlaceholder: "example.com", tags: ["Free", "Threat intel"], aiSubjectType: "domain" },
  { id: "phishtank", category: "property", emoji: "🎣", label: "PhishTank", description: "Community-reported phishing URL database.", longDescription: "PhishTank — community-verified phishing URL database. Confirms whether a URL has been reported as a phishing site.", source: "PhishTank", sourceUrl: "https://phishtank.org/", kind: "url", urlTemplate: "https://phishtank.org/phish_search.php?valid=y&active=All&Search=Search&page=&search_url={q}", inputHint: "URL or domain.", inputPlaceholder: "https://suspicious.example.com", tags: ["Free", "Phishing"], aiSubjectType: "domain" },
  { id: "dnsdumpster", category: "property", emoji: "🗺️", label: "DNSDumpster", description: "Free passive DNS recon + domain map.", longDescription: "DNSDumpster — passive DNS recon tool that maps a domain's hosts, MX, NS, and discovered subdomains in a visual graph.", source: "DNSDumpster", sourceUrl: "https://dnsdumpster.com/", kind: "url", urlTemplate: "https://dnsdumpster.com/?target={q}", inputHint: "Apex domain.", inputPlaceholder: "example.com", tags: ["Free", "Passive DNS"], aiSubjectType: "domain" },
  { id: "ssl-labs", category: "property", emoji: "🔒", label: "SSL Labs Test", description: "TLS/SSL configuration grade and vulnerability scan.", longDescription: "Qualys SSL Labs server test — grades a domain's TLS configuration (A+ to F), reveals supported ciphers, protocol versions, and known vulnerabilities.", source: "Qualys SSL Labs", sourceUrl: "https://www.ssllabs.com/ssltest/", kind: "url", urlTemplate: "https://www.ssllabs.com/ssltest/analyze.html?d={q}", inputHint: "Domain (no protocol). Test takes ~90 seconds.", inputPlaceholder: "example.com", tags: ["Free", "TLS audit"], aiSubjectType: "domain" },
  { id: "wayback-cdx", category: "property", emoji: "📅", label: "Wayback CDX Deep Search", description: "Full URL inventory ever captured for a domain.", longDescription: "Internet Archive CDX API returns every distinct URL ever captured for a domain — discover deleted pages, hidden assets, leaked PDFs, old admin paths.", source: "Wayback CDX", sourceUrl: "https://github.com/internetarchive/wayback/tree/master/wayback-cdx-server", kind: "edge", edgeAction: "wayback_cdx", inputHint: "Apex domain (no protocol). Returns up to 200 unique captured URLs.", inputPlaceholder: "example.com", tags: ["Free", "No key", "URL inventory"], aiSubjectType: "domain" },
  { id: "google-dork", category: "property", emoji: "🔍", label: "Google Dork Builder", description: "Pre-built Google operators for filetype/site/intitle search.", longDescription: "Generates a Google search URL with common OSINT dorks — site:, filetype:pdf, intitle:, intext:, ext: — for finding leaked docs, exposed admin panels, and indexed credentials.", source: "Google", sourceUrl: "https://www.google.com/", kind: "url", urlTemplate: "https://www.google.com/search?q={q}", inputHint: "Use operators: site:example.com filetype:pdf \"confidential\"", inputPlaceholder: "site:example.com filetype:pdf", tags: ["Free", "Operators"], aiSubjectType: "domain" },
];

export const OSINT_CATEGORY_META: Record<OSINTCategory, { label: string; emoji: string; description: string }> = {
  people: {
    label: "People & Identity",
    emoji: "👥",
    description: "Username search, breach data, public records, licensure, registry checks.",
  },
  business: {
    label: "Business & Corporate",
    emoji: "🏢",
    description: "SEC filings, corporate registries, IP, debarment, regulatory actions.",
  },
  property: {
    label: "Property & Web Intel",
    emoji: "🏘️",
    description: "Deeds, aircraft, vessels, real estate, archived web, DNS/WHOIS.",
  },
};

export function getOSINTToolById(id: string): OSINTTool | undefined {
  return OSINT_TOOLS.find((t) => t.id === id);
}

export function getOSINTToolsByCategory(category: OSINTCategory): OSINTTool[] {
  return OSINT_TOOLS.filter((t) => t.category === category);
}
