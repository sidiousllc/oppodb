// Snapshot fetchers for report data blocks. Each fetcher takes a refId and
// returns a normalized JSON snapshot that's safe to store and re-render later.

import { supabase } from "@/integrations/supabase/client";
import type { ReportBlock, DataBlock } from "./types";

export async function fetchSnapshot(block: DataBlock): Promise<Record<string, unknown> | null> {
  switch (block.type) {
    case "candidate": {
      const { data } = await supabase
        .from("candidate_profiles")
        .select("name, slug, content, tags")
        .eq("slug", block.refId)
        .maybeSingle();
      return data as any;
    }
    case "research": {
      // refId = parent_slug, subsectionId = subpage slug
      const { data } = await supabase
        .from("candidate_profiles")
        .select("name, slug, content, subpage_title, parent_slug")
        .eq("slug", block.refId)
        .maybeSingle();
      return data as any;
    }
    case "district": {
      const { data } = await supabase
        .from("district_profiles")
        .select("*")
        .eq("district_id", block.refId)
        .maybeSingle();
      return data as any;
    }
    case "intel": {
      // refId = "scope:category" (e.g. "national:economy")
      const [scope, category] = block.refId.split(":");
      let q = supabase
        .from("intel_briefings")
        .select("title, summary, source_name, source_url, published_at, scope, category")
        .order("published_at", { ascending: false })
        .limit(20);
      if (scope) q = q.eq("scope", scope);
      if (category && category !== "all") q = q.eq("category", category);
      const { data } = await q;
      return { items: data ?? [] };
    }
    case "polling": {
      const { data } = await supabase
        .from("polling_data" as any)
        .select("*")
        .eq("id", block.refId)
        .maybeSingle();
      return (data as any) ?? null;
    }
    case "finance": {
      const { data } = await supabase
        .from("campaign_finance")
        .select("*")
        .eq("candidate_slug", block.refId)
        .order("cycle", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    }
    case "election": {
      // refId = "STATE-DD" e.g. "MN-05"
      const [state, district] = block.refId.split("-");
      const { data } = await supabase
        .from("congressional_election_results")
        .select("candidate_name, party, votes, vote_pct, is_winner, election_year, election_type")
        .eq("state_abbr", state)
        .eq("district_number", district)
        .order("election_year", { ascending: false })
        .limit(50);
      return { items: data ?? [] };
    }
    case "international": {
      const { data } = await supabase
        .from("international_profiles")
        .select(
          "country_code, country_name, capital, population, gdp, gdp_per_capita, head_of_state, head_of_government, ruling_party, last_election_date, next_election_date",
        )
        .eq("country_code", block.refId)
        .maybeSingle();
      return data as any;
    }
    case "legislation": {
      const { data } = await supabase
        .from("congress_bills")
        .select("bill_id, title, short_title, latest_action_text, latest_action_date, status, sponsor_name")
        .eq("bill_id", block.refId)
        .maybeSingle();
      return data as any;
    }
    case "messaging": {
      // refId = github_path or doc id; messaging docs store on candidate_profiles? Skip to placeholder.
      return { ref: block.refId };
    }
    default:
      return null;
  }
}

export async function refreshAllSnapshots(blocks: ReportBlock[]): Promise<ReportBlock[]> {
  const out: ReportBlock[] = [];
  for (const b of blocks) {
    if (
      b.type === "candidate" || b.type === "research" || b.type === "district" ||
      b.type === "intel" || b.type === "polling" || b.type === "finance" ||
      b.type === "election" || b.type === "international" ||
      b.type === "legislation" || b.type === "messaging"
    ) {
      const snap = await fetchSnapshot(b as DataBlock);
      out.push({ ...(b as DataBlock), snapshot: snap ?? undefined });
    } else if (b.type === "tabs") {
      const tabs = await Promise.all(
        b.tabs.map(async (t) => ({ ...t, blocks: await refreshAllSnapshots(t.blocks) })),
      );
      out.push({ ...b, tabs });
    } else {
      out.push(b);
    }
  }
  return out;
}
