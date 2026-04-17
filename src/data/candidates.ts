export interface Candidate {
  name: string;
  slug: string;
  category: "house" | "senate" | "governor" | "state" | "uncategorized";
  state: string;
  content: string;
}

// Lookup tables for slug-based fallback inference
const SENATE_SLUGS: Record<string, string> = {
  "dan-sullivan": "AK", "john-cornyn": "TX", "joni-ernst": "IA",
  "susan-collins": "ME", "thom-tillis": "NC", "mike-rogers": "MI",
};

const GOV_SLUGS: Record<string, string> = {
  "jack-ciattarelli": "NJ", "jason-miyares": "VA", "winsome-earle-sears": "VA",
  "derek-dooley": "GA", "john-king": "GA",
  "andy-biggs": "AZ", "brad-raffensperger": "GA", "brad-sherman": "IA",
  "burt-jones": "GA", "chris-carr": "GA", "david-schweikert": "AZ",
  "doug-mastriano": "PA", "joe-lombardo": "NV", "john-james": "MI",
  "jonathan-bush": "ME", "karrin-taylor-robson": "AZ", "kelly-ayotte": "NH",
  "lisa-demuth": "MN", "maria-lazar": "WI", "mike-cox": "MI",
  "mike-lindell": "MN", "perry-johnson": "MI", "randy-feenstra": "IA",
  "rick-jackson": "GA", "bobby-charles": "ME", "stacy-garrity": "PA",
  "tom-tiffany": "WI",
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

const STATE_SLUGS = new Set(["john-lujan", "carlos-de-la-cruz"]);

// US state abbreviations for path-based extraction
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

/**
 * Categorize a candidate using github_path first (most reliable),
 * then slug lookup tables, then fall back to "uncategorized" so unknown
 * profiles remain visible without being silently bucketed into House.
 */
function categorize(
  name: string,
  slug: string,
  githubPath?: string,
): { category: Candidate["category"]; state: string } {
  const lslug = slug.toLowerCase();
  const lname = name.toLowerCase();
  const path = (githubPath || "").toLowerCase();

  // ---- 1. Path-based inference (most reliable, comes from DB) ----
  if (path) {
    const segments = path.split("/").filter(Boolean);
    let inferredState = "";
    for (const seg of segments) {
      const norm = seg.replace(/\.md$/, "");
      if (norm.length === 2 && STATE_ABBRS.has(norm.toUpperCase())) {
        inferredState = norm.toUpperCase();
        break;
      }
      if (STATE_NAME_TO_ABBR[norm]) {
        inferredState = STATE_NAME_TO_ABBR[norm];
        break;
      }
    }

    if (path.includes("/senate") || path.startsWith("senate/")) {
      return { category: "senate", state: inferredState || SENATE_SLUGS[lslug] || "" };
    }
    if (path.includes("gov") || path.includes("governor")) {
      return { category: "governor", state: inferredState || GOV_SLUGS[lslug] || "" };
    }
    if (path.includes("state-races") || path.includes("/state/") || path.includes("state-leg")) {
      return { category: "state", state: inferredState };
    }
    if (path.includes("/house") || path.startsWith("house/")) {
      return { category: "house", state: inferredState || HOUSE_SLUGS[lslug] || "" };
    }
  }

  // ---- 2. Slug-based lookup tables ----
  if (SENATE_SLUGS[lslug]) return { category: "senate", state: SENATE_SLUGS[lslug] };
  if (GOV_SLUGS[lslug]) return { category: "governor", state: GOV_SLUGS[lslug] };
  if (STATE_SLUGS.has(lslug) || lname.includes("state level")) {
    return { category: "state", state: "" };
  }
  if (HOUSE_SLUGS[lslug]) return { category: "house", state: HOUSE_SLUGS[lslug] };

  // ---- 3. Unknown — surface as "uncategorized" so profile stays visible ----
  return { category: "uncategorized", state: "" };
}

export const candidates: Candidate[] = [];

export function addCandidate(name: string, slug: string, content: string, githubPath?: string) {
  const { category, state } = categorize(name, slug, githubPath);
  candidates.push({ name, slug, category, state, content });
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
    c.content.toLowerCase().includes(q)
  );
}

export function getCandidateBySlug(slug: string): Candidate | undefined {
  return candidates.find(c => c.slug === slug);
}

export function getCandidatesByCategory(category: Candidate["category"]): Candidate[] {
  return candidates.filter(c => c.category === category);
}
