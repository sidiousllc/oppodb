import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const slug = (s: string) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Page through every row of a table (no limits)
async function fetchAll<T = any>(
  supabase: any,
  table: string,
  columns: string,
  pageSize = 1000,
  filter?: (q: any) => any,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    let q = supabase.from(table).select(columns).range(from, from + pageSize - 1);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) { console.warn(`fetchAll(${table}) error:`, error.message); break; }
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

// Buffered upsert
class Upserter {
  private buf: any[] = [];
  private inserted = 0;
  constructor(private supabase: any, private size = 500) {}
  async push(row: any) {
    this.buf.push(row);
    if (this.buf.length >= this.size) await this.flush();
  }
  async flush() {
    if (this.buf.length === 0) return;
    const batch = this.buf.splice(0, this.buf.length);
    const { error } = await this.supabase.from("entity_relationships").upsert(batch, {
      onConflict: "source_type,source_id,target_type,target_id,relationship_type",
    });
    if (error) console.warn("upsert error:", error.message);
    else this.inserted += batch.length;
  }
  count() { return this.inserted; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "expand";
    const entityType = url.searchParams.get("entity_type");
    const entityId = url.searchParams.get("entity_id");
    const depth = parseInt(url.searchParams.get("depth") ?? "1");

    if (action === "build") {
      const up = new Upserter(supabase);
      const sources: Record<string, number> = {};
      const tally = (k: string) => { sources[k] = (sources[k] ?? 0) + 1; };

      // 1. Campaign finance: donor -> candidate, industry -> candidate
      try {
        const finance = await fetchAll<any>(supabase, "campaign_finance",
          "candidate_name, candidate_slug, top_contributors, top_industries, cycle, state_abbr, district, office, party",
          1000, (q) => q.not("top_contributors", "is", null));
        for (const row of finance) {
          const candSlug = row.candidate_slug ?? slug(row.candidate_name);
          const contribs = Array.isArray(row.top_contributors) ? row.top_contributors : [];
          for (const c of contribs) {
            const name = typeof c === "string" ? c : (c?.name ?? c?.contributor_name ?? c?.organization);
            const amount = typeof c === "object" ? Number(c?.amount ?? c?.total ?? 0) : 0;
            if (!name) continue;
            await up.push({
              source_type: "donor", source_id: slug(name), source_label: name,
              target_type: "candidate", target_id: candSlug, target_label: row.candidate_name,
              relationship_type: "contributed_to", amount, observed_at: `${row.cycle}-01-01`,
              source: "FEC/OpenSecrets",
            });
            tally("donor->candidate");
          }
          const industries = Array.isArray(row.top_industries) ? row.top_industries : [];
          for (const ind of industries) {
            const name = typeof ind === "string" ? ind : (ind?.name ?? ind?.industry);
            const amount = typeof ind === "object" ? Number(ind?.amount ?? ind?.total ?? 0) : 0;
            if (!name) continue;
            await up.push({
              source_type: "industry", source_id: slug(name), source_label: name,
              target_type: "candidate", target_id: candSlug, target_label: row.candidate_name,
              relationship_type: "industry_supports", amount, observed_at: `${row.cycle}-01-01`,
              source: "OpenSecrets",
            });
            tally("industry->candidate");
          }
          // Candidate -> state/district
          if (row.state_abbr) {
            await up.push({
              source_type: "candidate", source_id: candSlug, source_label: row.candidate_name,
              target_type: "state", target_id: row.state_abbr.toLowerCase(), target_label: row.state_abbr,
              relationship_type: "ran_in", source: "FEC",
            });
            tally("candidate->state");
          }
        }
      } catch (e) { console.warn("finance harvest:", (e as Error).message); }

      // 2. Bills: sponsor & cosponsors
      try {
        const bills = await fetchAll<any>(supabase, "congress_bills",
          "bill_id, title, sponsor_name, sponsor_bioguide_id, cosponsors, policy_area, subjects");
        for (const b of bills) {
          const billLabel = (b.title ?? b.bill_id).slice(0, 100);
          if (b.sponsor_bioguide_id) {
            await up.push({
              source_type: "member", source_id: b.sponsor_bioguide_id, source_label: b.sponsor_name ?? "Member",
              target_type: "bill", target_id: b.bill_id, target_label: billLabel,
              relationship_type: "sponsored", source: "Congress.gov",
            });
            tally("member->bill (sponsor)");
          }
          const cosp = Array.isArray(b.cosponsors) ? b.cosponsors : [];
          for (const c of cosp) {
            const bid = c?.bioguideId ?? c?.bioguide_id;
            if (!bid) continue;
            const nm = c?.fullName ?? [c?.firstName, c?.lastName].filter(Boolean).join(" ");
            await up.push({
              source_type: "member", source_id: bid, source_label: nm || bid,
              target_type: "bill", target_id: b.bill_id, target_label: billLabel,
              relationship_type: "cosponsored", source: "Congress.gov",
            });
            tally("member->bill (cosponsor)");
          }
          if (b.policy_area) {
            await up.push({
              source_type: "bill", source_id: b.bill_id, source_label: billLabel,
              target_type: "topic", target_id: slug(b.policy_area), target_label: b.policy_area,
              relationship_type: "topic_of", source: "Congress.gov",
            });
            tally("bill->topic");
          }
        }
      } catch (e) { console.warn("bills harvest:", (e as Error).message); }

      // 3. Lobbying
      try {
        const lobbying = await fetchAll<any>(supabase, "lobbying_disclosures",
          "registrant_name, client_name, govt_entities, amount, filing_year, issues");
        for (const l of lobbying) {
          if (!l.registrant_name) continue;
          if (l.client_name) {
            await up.push({
              source_type: "client", source_id: slug(l.client_name), source_label: l.client_name,
              target_type: "lobbyist", target_id: slug(l.registrant_name), target_label: l.registrant_name,
              relationship_type: "hired", amount: l.amount, observed_at: l.filing_year ? `${l.filing_year}-01-01` : null,
              source: "Senate LDA",
            });
            tally("client->lobbyist");
          }
          const govts = Array.isArray(l.govt_entities) ? l.govt_entities : [];
          for (const g of govts) {
            if (!g) continue;
            const name = typeof g === "string" ? g : (g?.name ?? "");
            if (!name) continue;
            await up.push({
              source_type: "lobbyist", source_id: slug(l.registrant_name), source_label: l.registrant_name,
              target_type: "agency", target_id: slug(name), target_label: name,
              relationship_type: "lobbied", source: "Senate LDA",
            });
            tally("lobbyist->agency");
          }
        }
      } catch (e) { console.warn("lobbying harvest:", (e as Error).message); }

      // 4. Federal contracts
      try {
        const contracts = await fetchAll<any>(supabase, "gov_contracts",
          "recipient_name, awarding_agency, award_amount, fiscal_year, naics_description",
          1000, (q) => q.not("awarding_agency", "is", null).not("recipient_name", "is", null));
        for (const c of contracts) {
          await up.push({
            source_type: "agency", source_id: slug(c.awarding_agency), source_label: c.awarding_agency,
            target_type: "contractor", target_id: slug(c.recipient_name), target_label: c.recipient_name,
            relationship_type: "awarded_contract_to", amount: c.award_amount,
            observed_at: c.fiscal_year ? `${c.fiscal_year}-01-01` : null,
            source: "USAspending",
          });
          tally("agency->contractor");
        }
      } catch (e) { console.warn("contracts harvest:", (e as Error).message); }

      // 5. Congress members -> state/district/party
      try {
        const members = await fetchAll<any>(supabase, "congress_members",
          "bioguide_id, name, state, district, party, candidate_slug, chamber");
        for (const m of members) {
          if (m.state) {
            await up.push({
              source_type: "member", source_id: m.bioguide_id, source_label: m.name,
              target_type: "state", target_id: m.state.toLowerCase(), target_label: m.state,
              relationship_type: "represents", source: "Congress.gov",
            });
            tally("member->state");
          }
          if (m.district && m.state) {
            const did = `${m.state}-${String(m.district).padStart(2, "0")}`;
            await up.push({
              source_type: "member", source_id: m.bioguide_id, source_label: m.name,
              target_type: "district", target_id: did.toLowerCase(), target_label: did,
              relationship_type: "represents", source: "Congress.gov",
            });
            tally("member->district");
          }
          if (m.party) {
            await up.push({
              source_type: "member", source_id: m.bioguide_id, source_label: m.name,
              target_type: "party", target_id: slug(m.party), target_label: m.party,
              relationship_type: "member_of", source: "Congress.gov",
            });
            tally("member->party");
          }
          // link member to candidate profile if linked
          if (m.candidate_slug) {
            await up.push({
              source_type: "member", source_id: m.bioguide_id, source_label: m.name,
              target_type: "candidate", target_id: m.candidate_slug, target_label: m.name,
              relationship_type: "same_as", source: "ORO",
            });
            tally("member<->candidate");
          }
        }
      } catch (e) { console.warn("members harvest:", (e as Error).message); }

      // 6. Congress votes: member -> bill (voted yea/nay)
      try {
        const votes = await fetchAll<any>(supabase, "congress_votes",
          "vote_id, bill_id, member_votes, question, vote_date");
        for (const v of votes) {
          if (!v.bill_id) continue;
          const mv = Array.isArray(v.member_votes) ? v.member_votes : [];
          for (const m of mv) {
            const bid = m?.bioguide_id ?? m?.bioguideId;
            const pos = (m?.vote_position ?? m?.position ?? "").toString().toLowerCase();
            if (!bid || !pos) continue;
            const rel = pos.startsWith("y") ? "voted_yea_on" : pos.startsWith("n") ? "voted_nay_on" : "voted_on";
            await up.push({
              source_type: "member", source_id: bid, source_label: m?.name ?? bid,
              target_type: "bill", target_id: v.bill_id, target_label: v.question?.slice(0, 100) ?? v.bill_id,
              relationship_type: rel, observed_at: v.vote_date,
              source: "Congress.gov",
            });
            tally("member->bill (vote)");
          }
        }
      } catch (e) { console.warn("votes harvest:", (e as Error).message); }

      // 7. Court cases: parties -> case
      try {
        const cases = await fetchAll<any>(supabase, "court_cases",
          "id, case_name, parties, court, filed_date");
        for (const c of cases) {
          const parties = Array.isArray(c.parties) ? c.parties : [];
          for (const p of parties) {
            const name = typeof p === "string" ? p : (p?.name ?? p?.party_name);
            if (!name) continue;
            await up.push({
              source_type: "party", source_id: slug(name), source_label: name,
              target_type: "case", target_id: c.id, target_label: c.case_name?.slice(0, 100) ?? "case",
              relationship_type: "party_to", observed_at: c.filed_date,
              source: "CourtListener",
            });
            tally("party->case");
          }
        }
      } catch (e) { console.warn("court harvest:", (e as Error).message); }

      // 8. Election results -> candidate ran in district/state
      try {
        const elections = await fetchAll<any>(supabase, "congressional_election_results",
          "candidate_name, district_number, state_abbr, election_year, party, is_winner");
        for (const er of elections) {
          const candSlug = slug(er.candidate_name);
          const did = `${er.state_abbr}-${String(er.district_number).padStart(2, "0")}`;
          await up.push({
            source_type: "candidate", source_id: candSlug, source_label: er.candidate_name,
            target_type: "district", target_id: did.toLowerCase(), target_label: did,
            relationship_type: er.is_winner ? "won_election_in" : "ran_in",
            observed_at: `${er.election_year}-01-01`,
            source: "MIT Election Lab",
          });
          tally("candidate->district");
          if (er.party) {
            await up.push({
              source_type: "candidate", source_id: candSlug, source_label: er.candidate_name,
              target_type: "party", target_id: slug(er.party), target_label: er.party,
              relationship_type: "member_of", source: "MIT Election Lab",
            });
            tally("candidate->party");
          }
        }
      } catch (e) { console.warn("elections harvest:", (e as Error).message); }

      // 9. Candidate profiles -> tags / parent
      try {
        const profiles = await fetchAll<any>(supabase, "candidate_profiles",
          "slug, name, tags, parent_slug, is_subpage");
        for (const p of profiles) {
          if (p.is_subpage && p.parent_slug) {
            await up.push({
              source_type: "candidate", source_id: p.parent_slug, source_label: p.parent_slug,
              target_type: "subpage", target_id: p.slug, target_label: p.name,
              relationship_type: "has_subpage", source: "ORO",
            });
            tally("candidate->subpage");
          }
          const tags = Array.isArray(p.tags) ? p.tags : [];
          for (const t of tags) {
            if (!t) continue;
            await up.push({
              source_type: "candidate", source_id: p.slug, source_label: p.name,
              target_type: "tag", target_id: slug(t), target_label: t,
              relationship_type: "tagged", source: "ORO",
            });
            tally("candidate->tag");
          }
        }
      } catch (e) { console.warn("profiles harvest:", (e as Error).message); }

      // 10. International profiles -> continent/region
      try {
        const intl = await fetchAll<any>(supabase, "international_profiles",
          "country_code, country_name, continent, subregion");
        for (const i of intl) {
          if (i.continent) {
            await up.push({
              source_type: "country", source_id: slug(i.country_code ?? i.country_name), source_label: i.country_name,
              target_type: "continent", target_id: slug(i.continent), target_label: i.continent,
              relationship_type: "located_in", source: "REST Countries",
            });
            tally("country->continent");
          }
        }
      } catch (e) { console.warn("intl harvest:", (e as Error).message); }

      // 11. Bill impact analyses -> winners/losers
      try {
        const impacts = await fetchAll<any>(supabase, "bill_impact_analyses",
          "bill_id, winners, losers");
        for (const im of impacts) {
          const ws = Array.isArray(im.winners) ? im.winners : [];
          const ls = Array.isArray(im.losers) ? im.losers : [];
          for (const w of ws) {
            const name = typeof w === "string" ? w : (w?.name ?? w?.group);
            if (!name) continue;
            await up.push({
              source_type: "bill", source_id: im.bill_id, source_label: im.bill_id,
              target_type: "group", target_id: slug(name), target_label: name,
              relationship_type: "benefits", source: "AI",
            });
            tally("bill->winner");
          }
          for (const l of ls) {
            const name = typeof l === "string" ? l : (l?.name ?? l?.group);
            if (!name) continue;
            await up.push({
              source_type: "bill", source_id: im.bill_id, source_label: im.bill_id,
              target_type: "group", target_id: slug(name), target_label: name,
              relationship_type: "harms", source: "AI",
            });
            tally("bill->loser");
          }
        }
      } catch (e) { console.warn("impact harvest:", (e as Error).message); }

      await up.flush();
      return new Response(JSON.stringify({ success: true, inserted: up.count(), sources }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: expand graph from a root node
    if (!entityType || !entityId) {
      return new Response(JSON.stringify({ error: "entity_type and entity_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const visited = new Set<string>();
    const nodes = new Map<string, any>();
    const edges: any[] = [];
    const queue: { type: string; id: string; level: number }[] = [{ type: entityType, id: entityId, level: 0 }];

    while (queue.length > 0) {
      const node = queue.shift()!;
      const key = `${node.type}|${node.id}`;
      if (visited.has(key) || node.level > depth) continue;
      visited.add(key);

      const { data: outbound } = await supabase.from("entity_relationships").select("*").eq("source_type", node.type).eq("source_id", node.id).limit(200);
      const { data: inbound } = await supabase.from("entity_relationships").select("*").eq("target_type", node.type).eq("target_id", node.id).limit(200);

      for (const r of [...(outbound ?? []), ...(inbound ?? [])]) {
        nodes.set(`${r.source_type}|${r.source_id}`, { id: `${r.source_type}|${r.source_id}`, type: r.source_type, label: r.source_label });
        nodes.set(`${r.target_type}|${r.target_id}`, { id: `${r.target_type}|${r.target_id}`, type: r.target_type, label: r.target_label });
        edges.push({
          id: r.id, source: `${r.source_type}|${r.source_id}`, target: `${r.target_type}|${r.target_id}`,
          type: r.relationship_type, amount: r.amount, weight: r.weight,
        });
        if (node.level < depth) {
          queue.push({ type: r.source_type, id: r.source_id, level: node.level + 1 });
          queue.push({ type: r.target_type, id: r.target_id, level: node.level + 1 });
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      nodes: Array.from(nodes.values()),
      edges,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
