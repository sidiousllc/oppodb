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
