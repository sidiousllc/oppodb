import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Build entity graph by inferring relationships from existing data
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
      // Bulk-build: harvest relationships from existing data sources
      let inserted = 0;

      // 1. Campaign finance: candidate -> top contributors
      const { data: finance } = await supabase.from("campaign_finance").select("candidate_name, candidate_slug, top_contributors, top_industries, cycle, state_abbr").not("top_contributors", "is", null).limit(500);
      for (const row of finance ?? []) {
        const contribs = Array.isArray(row.top_contributors) ? row.top_contributors : [];
        for (const c of contribs.slice(0, 10)) {
          const name = typeof c === "string" ? c : (c.name ?? c.contributor_name);
          const amount = typeof c === "object" ? Number(c.amount ?? c.total ?? 0) : 0;
          if (!name) continue;
          await supabase.from("entity_relationships").upsert({
            source_type: "donor", source_id: name.toLowerCase().replace(/\s+/g, "-"), source_label: name,
            target_type: "candidate", target_id: row.candidate_slug ?? row.candidate_name.toLowerCase().replace(/\s+/g, "-"), target_label: row.candidate_name,
            relationship_type: "contributed_to", amount, observed_at: `${row.cycle}-01-01`,
            source: "FEC/OpenSecrets",
          }, { onConflict: "source_type,source_id,target_type,target_id,relationship_type" });
          inserted++;
        }
      }

      // 2. Bills: sponsor -> bill, cosponsor -> bill
      const { data: bills } = await supabase.from("congress_bills").select("bill_id, title, sponsor_name, sponsor_bioguide_id, cosponsors").limit(500);
      for (const b of bills ?? []) {
        if (b.sponsor_bioguide_id) {
          await supabase.from("entity_relationships").upsert({
            source_type: "member", source_id: b.sponsor_bioguide_id, source_label: b.sponsor_name ?? "Member",
            target_type: "bill", target_id: b.bill_id, target_label: b.title.slice(0, 100),
            relationship_type: "sponsored", source: "Congress.gov",
          }, { onConflict: "source_type,source_id,target_type,target_id,relationship_type" });
          inserted++;
        }
        const cosp = Array.isArray(b.cosponsors) ? b.cosponsors : [];
        for (const c of cosp.slice(0, 20)) {
          if (!c.bioguideId) continue;
          await supabase.from("entity_relationships").upsert({
            source_type: "member", source_id: c.bioguideId, source_label: c.fullName ?? c.firstName + " " + c.lastName,
            target_type: "bill", target_id: b.bill_id, target_label: b.title.slice(0, 100),
            relationship_type: "cosponsored", source: "Congress.gov",
          }, { onConflict: "source_type,source_id,target_type,target_id,relationship_type" });
          inserted++;
        }
      }

      // 3. Lobbying: client -> registrant, registrant -> govt entity
      const { data: lobbying } = await supabase.from("lobbying_disclosures").select("registrant_name, client_name, govt_entities, amount, filing_year").limit(300);
      for (const l of lobbying ?? []) {
        if (l.client_name) {
          await supabase.from("entity_relationships").upsert({
            source_type: "client", source_id: l.client_name.toLowerCase().replace(/\s+/g, "-"), source_label: l.client_name,
            target_type: "lobbyist", target_id: l.registrant_name.toLowerCase().replace(/\s+/g, "-"), target_label: l.registrant_name,
            relationship_type: "hired", amount: l.amount, observed_at: `${l.filing_year}-01-01`,
            source: "Senate LDA",
          }, { onConflict: "source_type,source_id,target_type,target_id,relationship_type" });
          inserted++;
        }
        const govts = Array.isArray(l.govt_entities) ? l.govt_entities : [];
        for (const g of govts.slice(0, 5)) {
          if (!g) continue;
          await supabase.from("entity_relationships").upsert({
            source_type: "lobbyist", source_id: l.registrant_name.toLowerCase().replace(/\s+/g, "-"), source_label: l.registrant_name,
            target_type: "agency", target_id: String(g).toLowerCase().replace(/\s+/g, "-"), target_label: String(g),
            relationship_type: "lobbied", source: "Senate LDA",
          }, { onConflict: "source_type,source_id,target_type,target_id,relationship_type" });
          inserted++;
        }
      }

      // 4. Contracts: agency -> recipient
      const { data: contracts } = await supabase.from("gov_contracts").select("recipient_name, awarding_agency, award_amount, fiscal_year").not("awarding_agency", "is", null).limit(300);
      for (const c of contracts ?? []) {
        await supabase.from("entity_relationships").upsert({
          source_type: "agency", source_id: c.awarding_agency!.toLowerCase().replace(/\s+/g, "-"), source_label: c.awarding_agency!,
          target_type: "contractor", target_id: c.recipient_name.toLowerCase().replace(/\s+/g, "-"), target_label: c.recipient_name,
          relationship_type: "awarded_contract_to", amount: c.award_amount, observed_at: `${c.fiscal_year}-01-01`,
          source: "USAspending",
        }, { onConflict: "source_type,source_id,target_type,target_id,relationship_type" });
        inserted++;
      }

      return new Response(JSON.stringify({ success: true, inserted }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

      const { data: outbound } = await supabase.from("entity_relationships").select("*").eq("source_type", node.type).eq("source_id", node.id).limit(50);
      const { data: inbound } = await supabase.from("entity_relationships").select("*").eq("target_type", node.type).eq("target_id", node.id).limit(50);

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
