// Source bias classification + story clustering utilities (Ground News-style)

export type Bias = "left" | "lean-left" | "center" | "lean-right" | "right" | "unknown";

// Curated bias map. Keys are matched as case-insensitive substrings of source name.
const BIAS_RULES: Array<{ match: string; bias: Bias }> = [
  // LEFT
  { match: "jacobin", bias: "left" },
  { match: "democracy now", bias: "left" },
  { match: "the intercept", bias: "left" },
  { match: "mother jones", bias: "left" },
  { match: "the nation", bias: "left" },
  { match: "salon", bias: "left" },
  { match: "huffpost", bias: "left" },
  { match: "daily beast", bias: "left" },
  { match: "talking points memo", bias: "left" },
  { match: "alternet", bias: "left" },

  // LEAN LEFT
  { match: "msnbc", bias: "lean-left" },
  { match: "vox", bias: "lean-left" },
  { match: "slate", bias: "lean-left" },
  { match: "the new republic", bias: "lean-left" },
  { match: "the atlantic", bias: "lean-left" },
  { match: "the guardian", bias: "lean-left" },
  { match: "cnn", bias: "lean-left" },
  { match: "nbc news", bias: "lean-left" },
  { match: "cbs news", bias: "lean-left" },
  { match: "abc news", bias: "lean-left" },
  { match: "washington post", bias: "lean-left" },
  { match: "new york times", bias: "lean-left" },
  { match: "npr", bias: "lean-left" },
  { match: "pbs", bias: "lean-left" },
  { match: "politico", bias: "lean-left" },
  { match: "axios", bias: "lean-left" },
  { match: "the hill", bias: "lean-left" },
  { match: "bloomberg", bias: "lean-left" },
  { match: "time ", bias: "lean-left" },
  { match: "rolling stone", bias: "lean-left" },
  { match: "propublica", bias: "lean-left" },
  { match: "the 19th", bias: "lean-left" },
  { match: "kaiser health", bias: "lean-left" },
  { match: "kff health", bias: "lean-left" },
  { match: "marshall project", bias: "lean-left" },
  { match: "the appeal", bias: "lean-left" },
  { match: "grist", bias: "lean-left" },
  { match: "inside climate", bias: "lean-left" },
  { match: "chalkbeat", bias: "lean-left" },
  { match: "hechinger", bias: "lean-left" },
  { match: "brennan center", bias: "lean-left" },
  { match: "center for american progress", bias: "lean-left" },
  { match: "cap", bias: "lean-left" },
  { match: "epi", bias: "lean-left" },
  { match: "economic policy institute", bias: "lean-left" },
  { match: "cbpp", bias: "lean-left" },
  { match: "urban institute", bias: "lean-left" },
  { match: "third way", bias: "lean-left" },
  { match: "brookings", bias: "lean-left" },
  { match: "lawfare", bias: "lean-left" },
  { match: "states newsroom", bias: "lean-left" },
  { match: "stateline", bias: "lean-left" },
  { match: "calmatters", bias: "lean-left" },
  { match: "texas tribune", bias: "lean-left" },
  { match: "wisconsin watch", bias: "lean-left" },
  { match: "minnesota reformer", bias: "lean-left" },
  { match: "ohio capital journal", bias: "lean-left" },
  { match: "virginia mercury", bias: "lean-left" },
  { match: "florida phoenix", bias: "lean-left" },
  { match: "georgia recorder", bias: "lean-left" },
  { match: "arizona mirror", bias: "lean-left" },
  { match: "kansas reflector", bias: "lean-left" },
  { match: "missouri independent", bias: "lean-left" },
  { match: "kentucky lantern", bias: "lean-left" },
  { match: "louisiana illuminator", bias: "lean-left" },
  { match: "nebraska examiner", bias: "lean-left" },
  { match: "alaska beacon", bias: "lean-left" },
  { match: "idaho capital sun", bias: "lean-left" },
  { match: "maine morning star", bias: "lean-left" },
  { match: "new jersey monitor", bias: "lean-left" },
  { match: "maryland matters", bias: "lean-left" },
  { match: "ct mirror", bias: "lean-left" },
  { match: "connecticut mirror", bias: "lean-left" },
  { match: "indiana capital", bias: "lean-left" },
  { match: "iowa capital", bias: "lean-left" },
  { match: "nh bulletin", bias: "lean-left" },
  { match: "new hampshire bulletin", bias: "lean-left" },
  { match: "oregon capital", bias: "lean-left" },
  { match: "south dakota searchlight", bias: "lean-left" },
  { match: "montana free press", bias: "lean-left" },
  { match: "nevada current", bias: "lean-left" },
  { match: "michigan advance", bias: "lean-left" },
  { match: "north carolina newsline", bias: "lean-left" },
  { match: "ncpolicy", bias: "lean-left" },
  { match: "nc policy watch", bias: "lean-left" },
  { match: "the bulwark", bias: "lean-left" },
  { match: "washington monthly", bias: "lean-left" },

  // CENTER
  { match: "reuters", bias: "center" },
  { match: "ap news", bias: "center" },
  { match: "ap world", bias: "center" },
  { match: "associated press", bias: "center" },
  { match: "bbc", bias: "center" },
  { match: "c-span", bias: "center" },
  { match: "cspan", bias: "center" },
  { match: "1440", bias: "center" },
  { match: "ground news", bias: "center" },
  { match: "tangle", bias: "center" },
  { match: "the dispatch", bias: "center" },
  { match: "semafor", bias: "center" },
  { match: "allsides", bias: "center" },
  { match: "ballotpedia", bias: "center" },
  { match: "fivethirtyeight", bias: "center" },
  { match: "real clear", bias: "center" },
  { match: "realclear", bias: "center" },
  { match: "punchbowl", bias: "center" },
  { match: "roll call", bias: "center" },
  { match: "cq roll", bias: "center" },
  { match: "the economist", bias: "center" },
  { match: "financial times", bias: "center" },
  { match: "cook political", bias: "center" },
  { match: "sabato", bias: "center" },
  { match: "inside elections", bias: "center" },
  { match: "decision desk", bias: "center" },
  { match: "ncsl", bias: "center" },
  { match: "naco", bias: "center" },
  { match: "csg", bias: "center" },
  { match: "icma", bias: "center" },
  { match: "governing", bias: "center" },
  { match: "route fifty", bias: "center" },
  { match: "scotusblog", bias: "center" },
  { match: "tax foundation", bias: "center" },
  { match: "bipartisan policy", bias: "center" },
  { match: "niskanen", bias: "center" },
  { match: "rand", bias: "center" },
  { match: "wilson center", bias: "center" },
  { match: "stimson", bias: "center" },
  { match: "council on foreign relations", bias: "center" },
  { match: "cfr", bias: "center" },
  { match: "carnegie endowment", bias: "center" },
  { match: "csis", bias: "center" },
  { match: "atlantic council", bias: "center" },
  { match: "chatham house", bias: "center" },
  { match: "international crisis group", bias: "center" },
  { match: "un news", bias: "center" },
  { match: "euronews", bias: "center" },
  { match: "deutsche welle", bias: "center" },
  { match: "france 24", bias: "center" },
  { match: "japan times", bias: "center" },
  { match: "nikkei", bias: "center" },
  { match: "afp", bias: "center" },
  { match: "agence france", bias: "center" },
  { match: "marketwatch", bias: "center" },
  { match: "cnbc", bias: "center" },
  { match: "the markup", bias: "center" },
  { match: "techdirt", bias: "center" },

  // LEAN RIGHT
  { match: "wall street journal", bias: "lean-right" },
  { match: "wsj", bias: "lean-right" },
  { match: "washington examiner", bias: "lean-right" },
  { match: "national review", bias: "lean-right" },
  { match: "reason", bias: "lean-right" },
  { match: "the american conservative", bias: "lean-right" },
  { match: "free press", bias: "lean-right" },
  { match: "free beacon", bias: "lean-right" },
  { match: "washington times", bias: "lean-right" },
  { match: "new york post", bias: "lean-right" },
  { match: "ny post", bias: "lean-right" },
  { match: "epoch times", bias: "lean-right" },
  { match: "just the news", bias: "lean-right" },
  { match: "real clear politics", bias: "lean-right" },
  { match: "manhattan institute", bias: "lean-right" },
  { match: "hoover", bias: "lean-right" },
  { match: "aei", bias: "lean-right" },
  { match: "american enterprise", bias: "lean-right" },
  { match: "cato", bias: "lean-right" },
  { match: "r street", bias: "lean-right" },
  { match: "american action forum", bias: "lean-right" },
  { match: "committee for responsible federal budget", bias: "lean-right" },
  { match: "crfb", bias: "lean-right" },

  // RIGHT
  { match: "fox news", bias: "right" },
  { match: "fox business", bias: "right" },
  { match: "newsmax", bias: "right" },
  { match: "oan", bias: "right" },
  { match: "one america", bias: "right" },
  { match: "breitbart", bias: "right" },
  { match: "daily wire", bias: "right" },
  { match: "the daily wire", bias: "right" },
  { match: "daily caller", bias: "right" },
  { match: "the federalist", bias: "right" },
  { match: "townhall", bias: "right" },
  { match: "redstate", bias: "right" },
  { match: "pjmedia", bias: "right" },
  { match: "pj media", bias: "right" },
  { match: "the blaze", bias: "right" },
  { match: "blaze media", bias: "right" },
  { match: "human events", bias: "right" },
  { match: "western journal", bias: "right" },
  { match: "gateway pundit", bias: "right" },
  { match: "national pulse", bias: "right" },
  { match: "the post millennial", bias: "right" },
  { match: "post millennial", bias: "right" },
  { match: "heritage", bias: "right" },
  { match: "claremont", bias: "right" },
  { match: "first things", bias: "right" },
];

export function classifyBias(sourceName: string): Bias {
  const s = sourceName.toLowerCase();
  // Longer (more specific) matches win
  let best: { len: number; bias: Bias } | null = null;
  for (const rule of BIAS_RULES) {
    if (s.includes(rule.match) && (!best || rule.match.length > best.len)) {
      best = { len: rule.match.length, bias: rule.bias };
    }
  }
  return best?.bias ?? "unknown";
}

export const BIAS_META: Record<Bias, { label: string; color: string; bg: string; bucket: "L" | "C" | "R" | "U" }> = {
  left:        { label: "Left",       color: "#ffffff", bg: "#1d4ed8", bucket: "L" },
  "lean-left": { label: "Lean Left",  color: "#ffffff", bg: "#3b82f6", bucket: "L" },
  center:      { label: "Center",     color: "#ffffff", bg: "#9333ea", bucket: "C" },
  "lean-right":{ label: "Lean Right", color: "#ffffff", bg: "#f97316", bucket: "R" },
  right:       { label: "Right",      color: "#ffffff", bg: "#dc2626", bucket: "R" },
  unknown:     { label: "Unrated",    color: "#000000", bg: "#d4d4d4", bucket: "U" },
};

// ───────── Story clustering ─────────

const STOPWORDS = new Set([
  "the","a","an","and","or","but","of","in","on","to","for","with","at","by","from","as","is","are","was","were","be","been","being",
  "it","its","this","that","these","those","he","she","they","them","his","her","their","i","you","we","us","our",
  "after","before","over","under","into","about","amid","amidst","says","said","new","report","reports","says",
  "us","u.s.","american","americans","day","week","month","year","years","just","more","most","less","why","how","what","when","where","who",
  "vs","vs.","via","could","would","should","may","might","will","won't","wont","cant","can","do","does","did","not","no","yes",
  "amid","amid","–","—","-",
]);

function tokenize(s: string): Set<string> {
  const tokens = s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  return new Set(tokens);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface ClusterableArticle {
  title: string;
  source: string;
  link?: string | null;
  pubDate?: string | null;
  summary?: string | null;
}

export interface StoryCluster<T extends ClusterableArticle = ClusterableArticle> {
  id: string;
  lead: T;
  articles: T[];
  bias: { L: number; C: number; R: number; U: number };
  blindspot: "left" | "right" | "center" | null; // which side is missing
}

export function clusterArticles<T extends ClusterableArticle>(
  articles: T[],
  threshold = 0.34,
): StoryCluster<T>[] {
  const tokenCache = articles.map((a) => tokenize(a.title));
  const clusters: { indices: number[]; tokens: Set<string> }[] = [];

  for (let i = 0; i < articles.length; i++) {
    const tokens = tokenCache[i];
    let placed = false;
    for (const c of clusters) {
      // Compare against the centroid (first member's tokens) — cheap & decent
      if (jaccard(tokens, c.tokens) >= threshold) {
        c.indices.push(i);
        // Expand centroid
        for (const t of tokens) c.tokens.add(t);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push({ indices: [i], tokens: new Set(tokens) });
  }

  return clusters.map((c, idx) => {
    // Sort cluster members by date desc (newest = lead)
    const members = c.indices
      .map((i) => articles[i])
      .sort((a, b) => {
        const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
        const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
        return db - da;
      });
    const counts = { L: 0, C: 0, R: 0, U: 0 };
    // Dedupe by source so a chain of same-source posts doesn't skew bias
    const seenSources = new Set<string>();
    for (const m of members) {
      if (seenSources.has(m.source)) continue;
      seenSources.add(m.source);
      counts[BIAS_META[classifyBias(m.source)].bucket]++;
    }
    let blindspot: StoryCluster["blindspot"] = null;
    const totalRated = counts.L + counts.C + counts.R;
    if (totalRated >= 3) {
      if (counts.L === 0 && counts.R > 0) blindspot = "left";
      else if (counts.R === 0 && counts.L > 0) blindspot = "right";
      else if (counts.C === 0 && counts.L > 0 && counts.R > 0) blindspot = "center";
    }
    return {
      id: `cluster-${idx}-${members[0].title.slice(0, 24)}`,
      lead: members[0],
      articles: members,
      bias: counts,
      blindspot,
    };
  });
}

export function biasBarSegments(counts: { L: number; C: number; R: number; U: number }) {
  const total = counts.L + counts.C + counts.R + counts.U;
  if (total === 0) return { L: 0, C: 0, R: 0, U: 100 };
  return {
    L: (counts.L / total) * 100,
    C: (counts.C / total) * 100,
    R: (counts.R / total) * 100,
    U: (counts.U / total) * 100,
  };
}
