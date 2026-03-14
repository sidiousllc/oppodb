export interface Candidate {
  name: string;
  slug: string;
  category: "house" | "senate" | "governor" | "state";
  state: string;
  content: string;
}

// Category mapping based on race type
function categorize(name: string, slug: string): { category: Candidate["category"]; state: string } {
  const lname = name.toLowerCase();
  const lslug = slug.toLowerCase();
  
  // Senate
  if (["dan-sullivan", "john-cornyn", "joni-ernst", "susan-collins", "thom-tillis", "mike-rogers"].includes(lslug)) {
    const stateMap: Record<string, string> = {
      "dan-sullivan": "AK", "john-cornyn": "TX", "joni-ernst": "IA",
      "susan-collins": "ME", "thom-tillis": "NC", "mike-rogers": "MI"
    };
    return { category: "senate", state: stateMap[lslug] || "" };
  }
  
  // Governor
  if (["jack-ciattarelli", "jason-miyares", "winsome-earle-sears", "derek-dooley", "john-king"].includes(lslug)) {
    const stateMap: Record<string, string> = {
      "jack-ciattarelli": "NJ", "jason-miyares": "VA", "winsome-earle-sears": "VA",
      "derek-dooley": "GA", "john-king": "GA"
    };
    return { category: "governor", state: stateMap[lslug] || "" };
  }
  
  // State level
  if (lname.includes("state level") || ["john-lujan", "carlos-de-la-cruz"].includes(lslug)) {
    return { category: "state", state: "" };
  }
  
  // Default: House
  const houseStates: Record<string, string> = {
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
    // New "How To Win Against" candidates
    "aaron-bean": "FL", "abe-hamadeh": "AZ", "addison-mcdowell": "NC",
    "andy-harris": "MD", "brad-knott": "NC", "dan-meuser": "PA",
    "daniel-webster": "FL", "darrell-issa": "CA", "french-hill": "AR",
    "glenn-grothman": "WI", "jay-obernolte": "CA", "lauren-boebert": "CO",
    "neal-dunn": "FL", "richard-hudson": "NC", "stephanie-bice": "OK",
    "tim-moore": "NC", "tom-mcclintock": "CA", "tony-wied": "WI",
    "victoria-spartz": "IN", "virginia-foxx": "NC",
  };
  
  return { category: "house", state: houseStates[lslug] || "" };
}

export const candidates: Candidate[] = [
  // All candidate data will be populated here
];

export function addCandidate(name: string, slug: string, content: string) {
  const { category, state } = categorize(name, slug);
  candidates.push({ name, slug, category, state, content });
}

// Initialize all candidates
const rawCandidates: Array<[string, string, string]> = [];

export function initCandidates(data: Array<{ name: string; slug: string; content: string }>) {
  candidates.length = 0;
  for (const d of data) {
    addCandidate(d.name, d.slug, d.content);
  }
  // Sort alphabetically
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
