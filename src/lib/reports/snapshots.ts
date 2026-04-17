// Snapshot fetchers for report data blocks. Each fetcher takes a refId and
// returns a normalized JSON snapshot that's safe to store and re-render later.

import { supabase } from "@/integrations/supabase/client";
import type { ReportBlock, DataBlock } from "./types";

const NEW_DATA_TYPES = new Set([
  "candidate","research","district","intel","polling","finance","election",
  "international","legislation","messaging",
  "talking_points","vulnerability","bill_impact","forecast",
  "prediction_market","investigations","war_room","entity_graph",
]);

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
      return { ref: block.refId };
    }

    // ───── New blocks ─────────────────────────────────────────────────────────

    case "talking_points": {
      // refId = candidate slug or bill_id; pick most recent cached talking_points row
      const { data } = await supabase
        .from("talking_points" as any)
        .select("audience, angle, points, evidence, created_at, subject_type, subject_ref")
        .eq("subject_ref", block.refId)
        .order("created_at", { ascending: false })
        .limit(5);
      return { items: data ?? [] };
    }

    case "vulnerability": {
      // refId = candidate slug
      const { data } = await supabase
        .from("vulnerability_scores" as any)
        .select("*")
        .eq("candidate_slug", block.refId)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as any) ?? null;
    }

    case "bill_impact": {
      // refId = bill_id
      const { data } = await supabase
        .from("bill_impact_analyses")
        .select("bill_id, scope, scope_ref, summary, fiscal_impact, political_impact, winners, losers, affected_groups, generated_at")
        .eq("bill_id", block.refId)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as any) ?? null;
    }

    case "forecast": {
      // refId = "STATE-DD" (House) or "STATE" (Senate/Pres) ; cycle inferred from latest
      const [state, district] = block.refId.split("-");
      let q = supabase
        .from("election_forecasts")
        .select("source, race_type, state_abbr, district, cycle, rating, dem_win_prob, rep_win_prob, margin, last_updated")
        .eq("state_abbr", state)
        .order("last_updated", { ascending: false })
        .limit(20);
      if (district) q = q.eq("district", district);
      const { data } = await q;
      return { items: data ?? [] };
    }

    case "prediction_market": {
      // refId = market id or slug
      const { data } = await supabase
        .from("prediction_markets" as any)
        .select("*")
        .or(`id.eq.${block.refId},slug.eq.${block.refId}`)
        .limit(1)
        .maybeSingle();
      return (data as any) ?? null;
    }

    case "investigations": {
      // refId = state abbr OR person/org name; pull a bundle
      const ref = block.refId.trim();
      const isState = /^[A-Z]{2}$/.test(ref);
      const [court, ig, fara, spending, contracts] = await Promise.all([
        supabase.from("court_cases")
          .select("case_name, case_number, court, filed_date, status, judge")
          .ilike(isState ? "court" : "case_name", `%${ref}%`)
          .order("filed_date", { ascending: false })
          .limit(15),
        supabase.from("ig_reports")
          .select("title, agency_name, published_on, summary, url")
          .ilike(isState ? "agency_name" : "title", `%${ref}%`)
          .order("published_on", { ascending: false })
          .limit(15),
        supabase.from("fara_registrants")
          .select("registrant_name, country, registration_date, status")
          .ilike(isState ? "state" : "registrant_name", `%${ref}%`)
          .order("registration_date", { ascending: false })
          .limit(15),
        supabase.from("federal_spending")
          .select("recipient_name, awarding_agency, total_obligation, fiscal_year, recipient_state")
          .ilike(isState ? "recipient_state" : "recipient_name", isState ? ref : `%${ref}%`)
          .order("total_obligation", { ascending: false })
          .limit(15),
        supabase.from("gov_contracts")
          .select("recipient_name, awarding_agency, award_amount, fiscal_year, recipient_state")
          .ilike(isState ? "recipient_state" : "recipient_name", isState ? ref : `%${ref}%`)
          .order("award_amount", { ascending: false })
          .limit(15),
      ]);
      return {
        court_cases: court.data ?? [],
        ig_reports: ig.data ?? [],
        fara: fara.data ?? [],
        spending: spending.data ?? [],
        contracts: contracts.data ?? [],
      };
    }

    case "war_room": {
      // refId = war room id
      const [room, members, messages] = await Promise.all([
        supabase.from("war_rooms" as any).select("*").eq("id", block.refId).maybeSingle(),
        supabase.rpc("list_war_room_members" as any, { _room_id: block.refId }),
        supabase.from("war_room_messages" as any)
          .select("content, created_at, user_id")
          .eq("war_room_id", block.refId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      return {
        room: room.data ?? null,
        members: members.data ?? [],
        recent_messages: messages.data ?? [],
      };
    }

    case "entity_graph": {
      // refId = "type:id", e.g. "candidate:tina-smith"
      const [stype, sid] = block.refId.split(":");
      const { data } = await supabase
        .from("entity_relationships")
        .select("source_label, source_type, target_label, target_type, relationship_type, amount, weight, observed_at")
        .or(`and(source_type.eq.${stype},source_id.eq.${sid}),and(target_type.eq.${stype},target_id.eq.${sid})`)
        .order("weight", { ascending: false, nullsFirst: false })
        .limit(80);
      return { root: block.refId, items: data ?? [] };
    }

    default:
      return null;
  }
}

export async function refreshAllSnapshots(blocks: ReportBlock[]): Promise<ReportBlock[]> {
  const out: ReportBlock[] = [];
  for (const b of blocks) {
    if (NEW_DATA_TYPES.has(b.type)) {
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
