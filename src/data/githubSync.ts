import { supabase } from "@/integrations/supabase/client";

export interface GitHubCandidate {
  slug: string;
  name: string;
  content: string;
  github_path: string;
  is_subpage: boolean;
  parent_slug: string | null;
  subpage_title: string | null;
}

// Index/category pages that should not appear as candidate profiles
const INDEX_SLUGS = new Set([
  "house", "senate", "state-races", "home", "agent", "mcp",
  "alaska-house", "alaska-senate", "arizona-house", "california-house",
  "colorado-house", "florida-house", "georgia-senate", "iowa-house",
  "maine-senate", "michigan-house", "michigan-senate", "montana-house",
  "nebraska-house", "new-york-house", "newjersey-house", "north-carolina-house",
  "pennsylvania-house", "tennessee-house", "texas-house", "texas-senate",
  "virginia-house", "wisconsin-house", "virginia-state", "newhampshire-state",
  "az-gov", "ga-gov", "ia-gov", "me-gov", "mi-gov", "mn-gov",
  "nh-gov", "nj-gov", "nv-gov", "pa-gov", "wi-gov",
]);

function cleanName(name: string): string {
  // Strip markdown bold markers like **How To Win Against X**
  return name.replace(/^\*\*(.+)\*\*$/, "$1").trim();
}

export async function fetchCandidatesFromDB(): Promise<GitHubCandidate[]> {
  const { data, error } = await supabase
    .from("candidate_profiles")
    .select("slug, name, content, github_path, is_subpage, parent_slug, subpage_title")
    .eq("is_subpage", false)
    .order("name");

  if (error) {
    console.error("Error fetching candidates from DB:", error);
    return [];
  }

  return (data || [])
    .filter((c) => !INDEX_SLUGS.has(c.slug))
    .map((c) => ({ ...c, name: cleanName(c.name) })) as GitHubCandidate[];
}

export async function fetchSubpages(parentSlug: string): Promise<GitHubCandidate[]> {
  const { data, error } = await supabase
    .from("candidate_profiles")
    .select("slug, name, content, github_path, is_subpage, parent_slug, subpage_title")
    .eq("is_subpage", true)
    .eq("parent_slug", parentSlug)
    .order("name");

  if (error) {
    console.error("Error fetching subpages:", error);
    return [];
  }
  return (data || []) as GitHubCandidate[];
}

export async function getLastSyncTime(): Promise<string | null> {
  const { data } = await supabase
    .from("sync_metadata")
    .select("last_synced_at")
    .eq("id", 1)
    .single();
  return data?.last_synced_at || null;
}
