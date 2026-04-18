/**
 * Lightweight OSINT tool catalog for server-side consumption (public-api,
 * mcp-server). Mirrors src/data/osintTools.ts but keeps only the fields the
 * server needs — full UI metadata stays client-side. Keep this in sync when
 * adding/removing tools.
 *
 * `requires_key` is the user_integrations.service name when truthy.
 */
export type OsintCatalogEntry = {
  id: string;
  label: string;
  category: "people" | "business" | "property";
  source: string;
  kind: "url" | "edge";
  edge_action?: string;
  url_template?: string;
  requires_key?: string | null;
  description: string;
  tags: string[];
};

export const OSINT_CATALOG: OsintCatalogEntry[] = [
  // People
  { id: "username-search", label: "Username Search", category: "people", source: "WhatsMyName", kind: "edge", edge_action: "username_search", description: "Find a username across 400+ social networks.", tags: ["Free", "400+ sites"] },
  { id: "email-breach", label: "Email Breach Check", category: "people", source: "Have I Been Pwned", kind: "edge", edge_action: "email_breach", requires_key: "hibp", description: "HIBP — known data breaches an email appeared in.", tags: ["Paid API", "12B+ records"] },
  { id: "phone-lookup", label: "Phone Reverse Lookup", category: "people", source: "NumVerify", kind: "edge", edge_action: "phone_lookup", requires_key: "numverify", description: "Carrier, line type, country, region.", tags: ["Free tier"] },
  { id: "social-archive", label: "Social Media Archive", category: "people", source: "Wayback + Politwoops", kind: "edge", edge_action: "social_archive", description: "Find deleted tweets / archived posts.", tags: ["Free"] },
  { id: "public-records", label: "Public Records Aggregator", category: "people", source: "TruePeopleSearch", kind: "url", url_template: "https://www.truepeoplesearch.com/results?name={q}", description: "Free people-search portals (deep-link).", tags: ["Free", "Deep-link"] },
  { id: "license-lookup", label: "Professional License Lookup", category: "people", source: "DocInfo", kind: "url", url_template: "https://www.docinfo.org/#!/search/{q}", description: "State licensing board search.", tags: ["Free"] },
  { id: "sex-offender", label: "Sex Offender Registry", category: "people", source: "DOJ NSOPW", kind: "url", url_template: "https://www.nsopw.gov/search-public-sex-offender-registries?keyword={q}", description: "Federal NSOPW unified registry.", tags: ["Free", "Federal"] },
  { id: "obituary-genealogy", label: "Obituary & Genealogy", category: "people", source: "Find a Grave", kind: "url", url_template: "https://www.findagrave.com/memorial/search?firstname=&lastname={q}", description: "210M+ memorials.", tags: ["Free"] },
  { id: "gravatar", label: "Gravatar Profile", category: "people", source: "Gravatar", kind: "edge", edge_action: "gravatar", description: "Email → public Gravatar profile.", tags: ["Free", "No key"] },
  { id: "github-user", label: "GitHub User Intel", category: "people", source: "GitHub", kind: "edge", edge_action: "github_user", description: "Public profile, repos, orgs, recent events.", tags: ["Free", "No key"] },
  { id: "ssdi-search", label: "SSDI / Death Index", category: "people", source: "FamilySearch", kind: "url", url_template: "https://www.familysearch.org/search/record/results?f.collectionId=1202535&q.givenName=&q.surname={q}", description: "Social Security Death Index.", tags: ["Free"] },
  { id: "voter-registration", label: "Voter Registration Lookup", category: "people", source: "Vote.org", kind: "url", url_template: "https://www.vote.org/am-i-registered-to-vote/?q={q}", description: "Multi-state voter portal.", tags: ["Free"] },
  { id: "fec-individual", label: "FEC Donor Search", category: "people", source: "FEC OpenFEC", kind: "url", url_template: "https://www.fec.gov/data/receipts/individual-contributions/?contributor_name={q}", description: "Federal individual contributions.", tags: ["Free", "Federal"] },
  { id: "judyrecords", label: "JudyRecords State Courts", category: "people", source: "JudyRecords", kind: "url", url_template: "https://www.judyrecords.com/search?q={q}", description: "660M+ state court cases.", tags: ["Free"] },
  { id: "linkedin-people", label: "LinkedIn People Search", category: "people", source: "Google site-search", kind: "url", url_template: "https://www.google.com/search?q=site%3Alinkedin.com%2Fin+{q}", description: "Google-dorked LinkedIn discovery.", tags: ["Free"] },
  { id: "twitter-advanced", label: "Twitter/X Advanced Search", category: "people", source: "X advanced search", kind: "url", url_template: "https://twitter.com/search?q={q}&src=typed_query&f=live", description: "Direct deep-link to X search.", tags: ["Free"] },
  { id: "reddit-user", label: "Reddit User History", category: "people", source: "Reddit", kind: "edge", edge_action: "reddit_user", description: "Public profile + recent comments/posts.", tags: ["Free", "No key"] },
  { id: "ip-geo", label: "IP Geolocation & ASN", category: "people", source: "ip-api.com", kind: "edge", edge_action: "ip_geo", description: "IP → country/city/ASN/ISP.", tags: ["Free", "No key"] },
  { id: "discord-id", label: "Discord ID → Account", category: "people", source: "DiscordLookup", kind: "url", url_template: "https://discordlookup.com/user/{q}", description: "Decode Discord snowflake.", tags: ["Free"] },
  { id: "telegram-username", label: "Telegram Username Check", category: "people", source: "t.me", kind: "url", url_template: "https://t.me/{q}", description: "Public preview link.", tags: ["Free"] },

  // Business
  { id: "sec-edgar", label: "SEC EDGAR Filings", category: "business", source: "SEC EDGAR", kind: "edge", edge_action: "sec_edgar", description: "10-K/10-Q/8-K/proxy/insider trades full-text.", tags: ["Free", "Federal"] },
  { id: "opencorporates", label: "OpenCorporates Entity Search", category: "business", source: "OpenCorporates", kind: "edge", edge_action: "opencorporates", requires_key: "opencorporates", description: "200M+ entities across 140+ jurisdictions.", tags: ["Free tier"] },
  { id: "ucc-filings", label: "UCC Filings", category: "business", source: "State SOS portals", kind: "url", url_template: "https://www.google.com/search?q=%22ucc+filing+search%22+{q}", description: "Secured-debt filings.", tags: ["Free"] },
  { id: "bankruptcy", label: "Bankruptcy Records", category: "business", source: "RECAP / CourtListener", kind: "edge", edge_action: "bankruptcy", description: "Federal bankruptcy court records.", tags: ["Free", "Federal"] },
  { id: "trademark-patent", label: "Trademark & Patent Search", category: "business", source: "USPTO TESS + PatFT", kind: "url", url_template: "https://tmsearch.uspto.gov/", description: "Trademark + patent full-text.", tags: ["Free", "Federal"] },
  { id: "sam-exclusion", label: "SAM.gov Exclusions", category: "business", source: "SAM.gov", kind: "edge", edge_action: "sam_exclusion", requires_key: "sam_gov", description: "Federal contractor debarment list.", tags: ["Free", "Federal"] },
  { id: "fda-enforcement", label: "FDA Enforcement Actions", category: "business", source: "openFDA", kind: "edge", edge_action: "fda_enforcement", description: "Recalls + warning letters + 483s.", tags: ["Free", "Federal", "No key"] },
  { id: "opensanctions", label: "OpenSanctions / PEPs", category: "business", source: "OpenSanctions", kind: "edge", edge_action: "opensanctions", description: "OFAC/EU/UN/PEP/criminal watchlists.", tags: ["Free", "No key"] },
  { id: "ofac-sdn", label: "OFAC SDN List", category: "business", source: "US Treasury OFAC", kind: "url", url_template: "https://sanctionssearch.ofac.treas.gov/", description: "US Treasury sanctions search.", tags: ["Free", "Federal"] },
  { id: "world-bank-debarred", label: "World Bank Debarred Firms", category: "business", source: "World Bank", kind: "url", url_template: "https://projects.worldbank.org/en/projects-operations/procurement/debarred-firms?lang=en&searchTerm={q}", description: "Ineligible/debarred firms.", tags: ["Free", "International"] },
  { id: "usaspending", label: "USAspending Federal Awards", category: "business", source: "USAspending.gov", kind: "edge", edge_action: "usaspending", description: "Federal contracts + grants + loans.", tags: ["Free", "No key", "Federal"] },
  { id: "irs-990", label: "IRS Form 990 (Nonprofits)", category: "business", source: "ProPublica Nonprofit Explorer", kind: "edge", edge_action: "irs_990", description: "1.8M+ nonprofit financials.", tags: ["Free", "No key"] },
  { id: "fec-committee", label: "FEC Committees & PACs", category: "business", source: "FEC OpenFEC", kind: "url", url_template: "https://www.fec.gov/data/committees/?q={q}", description: "Federal PAC/super PAC search.", tags: ["Free", "Federal"] },
  { id: "lobbying-senate", label: "Senate LDA Lobbying", category: "business", source: "Senate LDA", kind: "url", url_template: "https://lda.senate.gov/system/public/#/search?q={q}", description: "Federal lobbying disclosures.", tags: ["Free", "Federal"] },
  { id: "fara-doj", label: "DOJ FARA Registrants", category: "business", source: "DOJ FARA", kind: "url", url_template: "https://efile.fara.gov/ords/fara/f?p=1381:1:::NO::P1_SEARCH_TERM:{q}", description: "Foreign Agents Registration Act.", tags: ["Free", "Federal"] },
  { id: "dnb-quick", label: "D&B / DUNS Lookup", category: "business", source: "D&B free", kind: "url", url_template: "https://www.dnb.com/site-search-results.html?q={q}", description: "D&B entity & DUNS lookup.", tags: ["Free"] },
  { id: "secstate-business", label: "Secretary of State Business", category: "business", source: "NASS state portals", kind: "url", url_template: "https://www.google.com/search?q=%22business+entity+search%22+{q}", description: "All-50-state business entity search.", tags: ["Free"] },
  { id: "osha-violations", label: "OSHA Violations", category: "business", source: "OSHA", kind: "url", url_template: "https://www.osha.gov/ords/imis/establishment.search?establishment={q}", description: "Workplace safety inspections.", tags: ["Free", "Federal"] },
  { id: "epa-echo", label: "EPA ECHO Enforcement", category: "business", source: "EPA ECHO", kind: "url", url_template: "https://echo.epa.gov/facilities/facility-search/results?facility_name={q}", description: "Environmental compliance history.", tags: ["Free", "Federal"] },
  { id: "nlrb-cases", label: "NLRB Labor Cases", category: "business", source: "NLRB", kind: "url", url_template: "https://www.nlrb.gov/search/case?search_term={q}", description: "Labor relations cases.", tags: ["Free", "Federal"] },

  // Property / Web Intel
  { id: "property-deed", label: "Property & Deed Records", category: "property", source: "County assessors", kind: "url", url_template: "https://publicrecords.netronline.com/search?q={q}", description: "County-level property records.", tags: ["Free"] },
  { id: "faa-aircraft", label: "FAA Aircraft Registry", category: "property", source: "FAA", kind: "edge", edge_action: "faa_aircraft", description: "FAA N-Number registry.", tags: ["Free", "Federal", "No key"] },
  { id: "uscg-vessels", label: "USCG Vessel Registry", category: "property", source: "USCG NVDC", kind: "url", url_template: "https://cgmix.uscg.mil/PSIX/PSIXSearch.aspx?SearchType=2&VesselName={q}", description: "USCG documented vessels.", tags: ["Free", "Federal"] },
  { id: "real-estate-tx", label: "Real Estate Transactions", category: "property", source: "Zillow", kind: "url", url_template: "https://www.zillow.com/homes/{q}_rb/", description: "Recent sales (Zillow/Redfin).", tags: ["Free"] },
  { id: "wayback-machine", label: "Wayback Machine", category: "property", source: "Internet Archive", kind: "edge", edge_action: "wayback", description: "Snapshot timeline for any URL.", tags: ["Free", "No key"] },
  { id: "whois-dns", label: "WHOIS & DNS Intel", category: "property", source: "WHOIS + Cloudflare DoH", kind: "edge", edge_action: "whois_dns", requires_key: "securitytrails", description: "Domain WHOIS + DNS records.", tags: ["Free"] },
  { id: "crtsh", label: "Certificate Transparency (crt.sh)", category: "property", source: "crt.sh", kind: "edge", edge_action: "crtsh", description: "TLS certificate transparency logs.", tags: ["Free", "No key"] },
  { id: "urlscan", label: "URLScan.io", category: "property", source: "urlscan.io", kind: "edge", edge_action: "urlscan", description: "URL reputation + page intel.", tags: ["Free", "No key"] },
  { id: "virustotal", label: "VirusTotal", category: "property", source: "VirusTotal", kind: "edge", edge_action: "virustotal", requires_key: "virustotal", description: "Hash/URL/domain reputation (70+ engines).", tags: ["Free tier"] },
  { id: "abuseipdb", label: "AbuseIPDB", category: "property", source: "AbuseIPDB", kind: "edge", edge_action: "abuseipdb", requires_key: "abuseipdb", description: "IP abuse confidence + report history.", tags: ["Free tier"] },
  { id: "wayback-cdx", label: "Wayback CDX (URL Inventory)", category: "property", source: "Internet Archive CDX", kind: "edge", edge_action: "wayback_cdx", description: "Every archived URL on a domain.", tags: ["Free", "No key"] },
];

export function getOsintCatalogEntry(id: string): OsintCatalogEntry | undefined {
  return OSINT_CATALOG.find((t) => t.id === id);
}
