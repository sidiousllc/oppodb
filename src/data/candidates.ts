export type CandidateCategory =
  | "us-house"
  | "us-senate"
  | "governor"
  | "statewide"     // AG, SoS, Treasurer, Lt Gov, etc.
  | "state-leg"     // State House / State Senate
  | "local"         // Mayor, City Council, County, School Board, DA, Sheriff
  | "uncategorized";

export interface Candidate {
  name: string;
  slug: string;
  category: CandidateCategory;
  state: string;
  /** Optional district identifier (e.g. "TX-21", "SD-15", "HD-3") */
  district?: string;
  /** Specific office title when known (e.g. "Attorney General", "Mayor") */
  office?: string;
  content: string;
}

// ============================================================================
// Slug lookup tables (legacy fallback when github_path is missing)
// ============================================================================
const SENATE_SLUGS: Record<string, string> = {
  "dan-sullivan": "AK", "john-cornyn": "TX", "joni-ernst": "IA",
  "susan-collins": "ME", "thom-tillis": "NC", "mike-rogers": "MI",
};

const GOV_SLUGS: Record<string, string> = {
  "jack-ciattarelli": "NJ", "winsome-earle-sears": "VA",
  "derek-dooley": "GA",
  "andy-biggs": "AZ", "brad-raffensperger": "GA", "brad-sherman": "IA",
  "burt-jones": "GA", "chris-carr": "GA", "david-schweikert": "AZ",
  "doug-mastriano": "PA", "joe-lombardo": "NV", "john-james": "MI",
  "jonathan-bush": "ME", "karrin-taylor-robson": "AZ", "kelly-ayotte": "NH",
  "lisa-demuth": "MN", "maria-lazar": "WI", "mike-cox": "MI",
  "mike-lindell": "MN", "perry-johnson": "MI", "randy-feenstra": "IA",
  "rick-jackson": "GA", "bobby-charles": "ME", "stacy-garrity": "PA",
  "tom-tiffany": "WI",
};

// Statewide non-gubernatorial offices (AG, SoS, Treasurer, Lt Gov, etc.)
const STATEWIDE_SLUGS: Record<string, { state: string; office: string }> = {
  "jason-miyares": { state: "VA", office: "Attorney General" },
  "john-king": { state: "GA", office: "Insurance Commissioner" },
};

const HOUSE_SLUGS: Record<string, string> = {
  "andy-ogles": "TN", "anna-paulina-luna": "FL", "ashley-hinson": "IA",
  "buddy-carter": "GA", "chuck-edwards": "NC", "eli-crane": "AZ",
  "gabe-evans": "CO", "jeff-hurd": "CO", "jeff-van-drew": "NJ",
  "jen-kiggans": "VA", "juan-ciscomani": "AZ", "ken-calvert": "CA",
  "mariannette-miller-meeks": "IA", "maria-salazar": "FL", "mike-collins": "GA",
  "mike-lawler": "NY", "nick-begich": "AK", "nick-lalota": "NY",
  "pat-harrigan": "NC", "rich-mccormick": "GA", "rob-bresnahan": "PA",
  "ryan-mackenzie": "PA", "ryan-zinke": "MT", "scott-perry": "PA",
  "tom-barrett": "MI", "tom-kean": "NJ", "derrick-van-orden": "WI",
  "young-kim": "CA", "zach-nunn": "IA",
  "aaron-bean": "FL", "abe-hamadeh": "AZ", "addison-mcdowell": "NC",
  "andy-harris": "MD", "brad-knott": "NC", "dan-meuser": "PA",
  "daniel-webster": "FL", "darrell-issa": "CA", "french-hill": "AR",
  "glenn-grothman": "WI", "jay-obernolte": "CA", "lauren-boebert": "CO",
  "neal-dunn": "FL", "richard-hudson": "NC", "stephanie-bice": "OK",
  "tim-moore": "NC", "tom-mcclintock": "CA", "tony-wied": "WI",
  "victoria-spartz": "IN", "virginia-foxx": "NC",
  "brian-fitzpatrick": "PA",
};

const STATE_LEG_SLUGS = new Set(["john-lujan", "carlos-de-la-cruz"]);

// ============================================================================
// State abbreviation maps
// ============================================================================
const STATE_ABBRS = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
]);

const STATE_NAME_TO_ABBR: Record<string, string> = {
  alabama:"AL", alaska:"AK", arizona:"AZ", arkansas:"AR", california:"CA",
  colorado:"CO", connecticut:"CT", delaware:"DE", florida:"FL", georgia:"GA",
  hawaii:"HI", idaho:"ID", illinois:"IL", indiana:"IN", iowa:"IA",
  kansas:"KS", kentucky:"KY", louisiana:"LA", maine:"ME", maryland:"MD",
  massachusetts:"MA", michigan:"MI", minnesota:"MN", mississippi:"MS",
  missouri:"MO", montana:"MT", nebraska:"NE", nevada:"NV", newhampshire:"NH",
  "new-hampshire":"NH", newjersey:"NJ", "new-jersey":"NJ", newmexico:"NM",
  "new-mexico":"NM", newyork:"NY", "new-york":"NY", "north-carolina":"NC",
  northcarolina:"NC", "north-dakota":"ND", northdakota:"ND", ohio:"OH",
  oklahoma:"OK", oregon:"OR", pennsylvania:"PA", "rhode-island":"RI",
  "south-carolina":"SC", southcarolina:"SC", "south-dakota":"SD",
  southdakota:"SD", tennessee:"TN", texas:"TX", utah:"UT", vermont:"VT",
  virginia:"VA", washington:"WA", "west-virginia":"WV", westvirginia:"WV",
  wisconsin:"WI", wyoming:"WY",
};

// ============================================================================
// Path keyword detection — covers GitHub repo folder conventions
// ============================================================================
const STATEWIDE_KEYWORDS = [
  "attorney-general", "ag-race", "secretary-of-state", "sos-race",
  "treasurer", "comptroller", "auditor", "lt-governor", "lieutenant-governor",
  "insurance-commissioner", "agriculture-commissioner", "land-commissioner",
  "statewide",
];

const STATE_LEG_KEYWORDS = [
  "state-leg", "state-legislature", "state-house", "state-senate",
  "state-assembly", "assembly", "statehouse", "statesenate",
];

const LOCAL_KEYWORDS = [
  "mayor", "city-council", "council", "county", "supervisor",
  "school-board", "schoolboard", "district-attorney", "da-race",
  "sheriff", "judge", "judicial", "alderman", "commissioner",
  "local", "municipal",
];

function extractStateFromPath(path: string): string {
  const segments = path.split("/").filter(Boolean);
  for (const seg of segments) {
    const norm = seg.replace(/\.md$/, "").toLowerCase();
    if (norm.length === 2 && STATE_ABBRS.has(norm.toUpperCase())) {
      return norm.toUpperCase();
    }
    if (STATE_NAME_TO_ABBR[norm]) return STATE_NAME_TO_ABBR[norm];
  }
  return "";
}

function extractDistrictFromPath(path: string, slug: string): string {
  // Match patterns like "tx-21", "ca-22", "hd-3", "sd-15"
  const districtMatch = (path + " " + slug).toLowerCase().match(
    /\b([a-z]{2}-\d{1,3}|hd-?\d{1,3}|sd-?\d{1,3}|cd-?\d{1,3})\b/,
  );
  return districtMatch ? districtMatch[1].toUpperCase() : "";
}

function inferOfficeFromPath(path: string): string {
  if (path.includes("attorney-general") || path.includes("/ag-")) return "Attorney General";
  if (path.includes("secretary-of-state") || path.includes("/sos-")) return "Secretary of State";
  if (path.includes("treasurer")) return "Treasurer";
  if (path.includes("comptroller")) return "Comptroller";
  if (path.includes("auditor")) return "Auditor";
  if (path.includes("lt-governor") || path.includes("lieutenant")) return "Lt. Governor";
  if (path.includes("insurance-commissioner")) return "Insurance Commissioner";
  if (path.includes("mayor")) return "Mayor";
  if (path.includes("sheriff")) return "Sheriff";
  if (path.includes("district-attorney") || path.includes("/da-")) return "District Attorney";
  if (path.includes("school-board")) return "School Board";
  if (path.includes("city-council")) return "City Council";
  if (path.includes("county")) return "County Office";
  if (path.includes("state-senate") || path.includes("statesenate")) return "State Senate";
  if (path.includes("state-house") || path.includes("statehouse") || path.includes("assembly")) return "State House";
  return "";
}

/**
 * Categorize a candidate using github_path first (most reliable),
 * then slug lookup tables, then fall back to "uncategorized".
 */
function categorize(
  name: string,
  slug: string,
  githubPath?: string,
): { category: CandidateCategory; state: string; district?: string; office?: string } {
  const lslug = slug.toLowerCase();
  const lname = name.toLowerCase();
  const path = (githubPath || "").toLowerCase();

  // ---- 1. Path-based inference (most reliable, comes from DB) ----
  if (path) {
    const state = extractStateFromPath(path);
    const district = extractDistrictFromPath(path, slug);
    const office = inferOfficeFromPath(path);

    // Local first (most specific)
    if (LOCAL_KEYWORDS.some(k => path.includes(k))) {
      return { category: "local", state, district, office };
    }
    // State legislature
    if (STATE_LEG_KEYWORDS.some(k => path.includes(k))) {
      return { category: "state-leg", state, district, office: office || "State Legislature" };
    }
    // Statewide non-gubernatorial offices
    if (STATEWIDE_KEYWORDS.some(k => path.includes(k))) {
      return { category: "statewide", state, office };
    }
    // Federal Senate
    if (path.includes("/senate") || path.startsWith("senate/")) {
      return { category: "us-senate", state: state || SENATE_SLUGS[lslug] || "", office: "U.S. Senate" };
    }
    // Governor
    if (path.includes("gov") || path.includes("governor")) {
      return { category: "governor", state: state || GOV_SLUGS[lslug] || "", office: "Governor" };
    }
    // Federal House
    if (path.includes("/house") || path.startsWith("house/")) {
      return {
        category: "us-house",
        state: state || HOUSE_SLUGS[lslug] || "",
        district,
        office: "U.S. House",
      };
    }
  }

  // ---- 2. Slug-based lookup tables (legacy fallback) ----
  if (SENATE_SLUGS[lslug]) {
    return { category: "us-senate", state: SENATE_SLUGS[lslug], office: "U.S. Senate" };
  }
  if (STATEWIDE_SLUGS[lslug]) {
    return { category: "statewide", state: STATEWIDE_SLUGS[lslug].state, office: STATEWIDE_SLUGS[lslug].office };
  }
  if (GOV_SLUGS[lslug]) {
    return { category: "governor", state: GOV_SLUGS[lslug], office: "Governor" };
  }
  if (STATE_LEG_SLUGS.has(lslug) || lname.includes("state level")) {
    return { category: "state-leg", state: "", office: "State Legislature" };
  }
  if (HOUSE_SLUGS[lslug]) {
    return { category: "us-house", state: HOUSE_SLUGS[lslug], office: "U.S. House" };
  }

  // ---- 3. Unknown — surface as "uncategorized" so profile stays visible ----
  return { category: "uncategorized", state: "" };
}

export const candidates: Candidate[] = [];

export function addCandidate(name: string, slug: string, content: string, githubPath?: string) {
  const { category, state, district, office } = categorize(name, slug, githubPath);
  candidates.push({ name, slug, category, state, district, office, content });
}

export function initCandidates(
  data: Array<{ name: string; slug: string; content: string; github_path?: string }>,
) {
  candidates.length = 0;
  for (const d of data) {
    addCandidate(d.name, d.slug, d.content, d.github_path);
  }
  candidates.sort((a, b) => a.name.localeCompare(b.name));
}

export function searchCandidates(query: string): Candidate[] {
  if (!query.trim()) return candidates;
  const q = query.toLowerCase();
  return candidates.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.state.toLowerCase().includes(q) ||
    (c.office?.toLowerCase().includes(q) ?? false) ||
    (c.district?.toLowerCase().includes(q) ?? false) ||
    c.content.toLowerCase().includes(q)
  );
}

export function getCandidateBySlug(slug: string): Candidate | undefined {
  return candidates.find(c => c.slug === slug);
}

export function getCandidatesByCategory(category: CandidateCategory): Candidate[] {
  return candidates.filter(c => c.category === category);
}

/** Group candidates by state for sidebar/state-based filtering. */
export function getCandidatesByState(state: string): Candidate[] {
  return candidates.filter(c => c.state === state);
}

/** Unique sorted list of all states represented in current dataset. */
export function getAllStates(): string[] {
  return Array.from(new Set(candidates.map(c => c.state).filter(Boolean))).sort();
}
