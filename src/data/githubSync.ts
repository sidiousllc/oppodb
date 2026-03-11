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
  return (data || []) as GitHubCandidate[];
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
