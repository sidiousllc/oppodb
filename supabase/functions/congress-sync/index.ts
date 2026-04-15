import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const CONGRESS_API_KEY = Deno.env.get("CONGRESS_GOV_API_KEY");
    if (!CONGRESS_API_KEY) {
      return new Response(JSON.stringify({ error: "CONGRESS_GOV_API_KEY not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "sync_members";
    const currentCongress = url.searchParams.get("congress") || "119";
    const offset = parseInt(url.searchParams.get("offset") || "0");

    if (action === "sync_members") {
      return await syncMembers(sb, CONGRESS_API_KEY, currentCongress, offset);
    } else if (action === "sync_bills") {
      return await syncBills(sb, CONGRESS_API_KEY, currentCongress, offset);
    } else if (action === "sync_committees") {
      return await syncCommittees(sb, CONGRESS_API_KEY, currentCongress);
    } else if (action === "sync_votes") {
      return await syncVotes(sb, CONGRESS_API_KEY, currentCongress, offset);
    } else if (action === "sync_all") {
      return await syncAll(sb, CONGRESS_API_KEY, currentCongress);
    } else {
      return new Response(JSON.stringify({ error: "Unknown action. Use: sync_members, sync_bills, sync_committees, sync_votes, sync_all" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("congress-sync error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── helpers ──────────────────────────────────────────────────────────────────
async function congressFetch(path: string, apiKey: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`https://api.congress.gov/v3${path}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.href);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Congress API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── 1. Sync Members ────────────────────────────────────────────────────────
async function syncMembers(sb: any, apiKey: string, congress: string, offset: number) {
  const pageSize = 250;
  const data = await congressFetch("/member", apiKey, {
    limit: String(pageSize), offset: String(offset), currentMember: "true",
  });
  const members = data.members || [];

  const records = members.map((m: any) => {
    const terms = m.terms?.item || m.terms || [];
    let chamber = "House";
    if (Array.isArray(terms) && terms.length > 0) {
      chamber = terms[terms.length - 1].chamber || "House";
    }
    return {
      bioguide_id: m.bioguideId,
      name: m.name || `${m.firstName || ""} ${m.lastName || ""}`.trim(),
      first_name: m.firstName || null,
      last_name: m.lastName || null,
      party: m.partyName || m.party || null,
      state: m.state || null,
      district: m.district != null ? m.district.toString() : null,
      chamber,
      congress: parseInt(congress),
      depiction_url: m.depiction?.imageUrl || null,
      official_url: m.url || m.officialWebsiteUrl || null,
      terms: JSON.stringify(terms),
      updated_at: new Date().toISOString(),
    };
  }).filter((r: any) => r.bioguide_id);

  let upserted = 0, errors = 0;
  for (let i = 0; i < records.length; i += 50) {
    const batch = records.slice(i, i + 50);
    const { error } = await sb.from("congress_members").upsert(batch, { onConflict: "bioguide_id" });
    if (error) { console.error("Members upsert:", error.message); errors += batch.length; }
    else upserted += batch.length;
  }

  // Also try GovTrack for leadership data
  let leadershipUpdated = 0;
  try {
    const gtRes = await fetch("https://www.govtrack.us/api/v2/role?current=true&limit=600&format=json", {
      signal: AbortSignal.timeout(15000),
    });
    if (gtRes.ok) {
      const gtData = await gtRes.json();
      const roles = gtData?.objects || [];
      for (const role of roles) {
        if (role.leadership_title && role.person?.bioguideid) {
          const { error } = await sb.from("congress_members")
            .update({ leadership: JSON.stringify([{ title: role.leadership_title, party: role.party }]) })
            .eq("bioguide_id", role.person.bioguideid);
          if (!error) leadershipUpdated++;
        }
      }
    }
  } catch (e) { console.error("GovTrack leadership fetch error:", e); }

  return jsonResponse({
    action: "sync_members", fetched: members.length, upserted, errors,
    leadershipUpdated, offset, hasMore: members.length === pageSize, nextOffset: offset + pageSize,
  });
}

// ── 2. Sync Bills ──────────────────────────────────────────────────────────
async function syncBills(sb: any, apiKey: string, congress: string, offset: number) {
  const pageSize = 250;
  const data = await congressFetch(`/bill/${congress}`, apiKey, {
    limit: String(pageSize), offset: String(offset), sort: "updateDate+desc",
  });
  const bills = data.bills || [];

  const records: any[] = [];
  for (const b of bills) {
    const billId = `${b.type || "hr"}-${b.number}-${congress}`;
    records.push({
      bill_id: billId,
      congress: parseInt(congress),
      bill_type: (b.type || "hr").toLowerCase(),
      bill_number: b.number,
      title: (b.title || "").slice(0, 2000),
      short_title: b.shortTitle || null,
      latest_action_text: b.latestAction?.text || null,
      latest_action_date: b.latestAction?.actionDate || null,
      origin_chamber: b.originChamber || null,
      policy_area: b.policyArea?.name || null,
      introduced_date: b.introducedDate || null,
      updated_at: new Date().toISOString(),
    });
  }

  let upserted = 0, errors = 0;
  for (let i = 0; i < records.length; i += 50) {
    const batch = records.slice(i, i + 50);
    const { error } = await sb.from("congress_bills").upsert(batch, { onConflict: "bill_id" });
    if (error) { console.error("Bills upsert:", error.message); errors += batch.length; }
    else upserted += batch.length;
  }

  // Fetch detailed info for recent bills (sponsors, cosponsors, subjects)
  let detailsUpdated = 0;
  const recentBills = bills.slice(0, 20);
  for (const b of recentBills) {
    try {
      await new Promise(r => setTimeout(r, 200)); // rate limit
      const detail = await congressFetch(`/bill/${congress}/${(b.type || "hr").toLowerCase()}/${b.number}`, apiKey);
      const bill = detail.bill;
      if (!bill) continue;

      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (bill.sponsors?.length) {
        updates.sponsor_name = bill.sponsors[0].fullName || bill.sponsors[0].firstName + " " + bill.sponsors[0].lastName;
        updates.sponsor_bioguide_id = bill.sponsors[0].bioguideId || null;
      }
      if (bill.cosponsors?.count != null) updates.cosponsor_count = bill.cosponsors.count;
      if (bill.policyArea?.name) updates.policy_area = bill.policyArea.name;
      if (bill.subjects?.legislativeSubjects?.length) {
        updates.subjects = JSON.stringify(bill.subjects.legislativeSubjects.map((s: any) => s.name));
      }
      if (bill.committees?.length) {
        updates.committees = JSON.stringify(bill.committees.map((c: any) => ({ name: c.name, systemCode: c.systemCode })));
      }

      const billId = `${(b.type || "hr").toLowerCase()}-${b.number}-${congress}`;
      const { error } = await sb.from("congress_bills").update(updates).eq("bill_id", billId);
      if (!error) detailsUpdated++;
    } catch (e) { /* skip individual bill errors */ }
  }

  return jsonResponse({
    action: "sync_bills", fetched: bills.length, upserted, errors, detailsUpdated,
    offset, hasMore: bills.length === pageSize, nextOffset: offset + pageSize,
  });
}

// ── 3. Sync Committees ─────────────────────────────────────────────────────
async function syncCommittees(sb: any, apiKey: string, congress: string) {
  const chambers = ["house", "senate", "joint"];
  let totalUpserted = 0, totalErrors = 0;

  for (const chamber of chambers) {
    try {
      const data = await congressFetch(`/committee/${congress}/${chamber}`, apiKey, { limit: "250" });
      const committees = data.committees || [];

      const records = committees.map((c: any) => ({
        system_code: c.systemCode || c.committeeCode || "",
        name: c.name || "",
        chamber: chamber === "joint" ? "Joint" : chamber === "house" ? "House" : "Senate",
        committee_type: c.committeeTypeCode || c.type || null,
        parent_system_code: c.parent?.systemCode || null,
        url: c.url || null,
        subcommittees: JSON.stringify(c.subcommittees || []),
        updated_at: new Date().toISOString(),
      })).filter((r: any) => r.system_code);

      for (let i = 0; i < records.length; i += 50) {
        const batch = records.slice(i, i + 50);
        const { error } = await sb.from("congress_committees").upsert(batch, { onConflict: "system_code" });
        if (error) { console.error(`Committees ${chamber} upsert:`, error.message); totalErrors += batch.length; }
        else totalUpserted += batch.length;
      }

      // Fetch members for each committee
      for (const c of committees.slice(0, 15)) {
        try {
          await new Promise(r => setTimeout(r, 200));
          const memberData = await congressFetch(
            `/committee/${congress}/${chamber}/${c.systemCode || c.committeeCode}`, apiKey
          );
          const committee = memberData.committee;
          if (committee) {
            const members = committee.currentMembers || committee.members || [];
            if (members.length > 0) {
              await sb.from("congress_committees")
                .update({ members: JSON.stringify(members), updated_at: new Date().toISOString() })
                .eq("system_code", c.systemCode || c.committeeCode);
            }
          }
        } catch (e) { /* skip individual committee errors */ }
      }

      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.error(`Committees ${chamber} error:`, e);
    }
  }

  return jsonResponse({ action: "sync_committees", upserted: totalUpserted, errors: totalErrors });
}

// ── 4. Sync Votes ──────────────────────────────────────────────────────────
async function syncVotes(sb: any, apiKey: string, congress: string, offset: number) {
  const chambers = ["house", "senate"];
  let totalUpserted = 0, totalErrors = 0, totalFetched = 0;

  for (const chamber of chambers) {
    try {
      // Use ProPublica Congress API (free, no key needed for basic endpoints)
      // Fallback: Congress.gov doesn't have a direct votes list endpoint, so we use roll call votes
      const ppUrl = `https://api.propublica.org/congress/v1/${congress}/${chamber}/votes/recent.json`;
      // ProPublica requires API key - skip if not available, use Congress.gov amendment votes instead
      
      // Congress.gov: fetch recent amendments with votes
      const data = await congressFetch(`/amendment/${congress}`, apiKey, {
        limit: "50", offset: String(offset), sort: "updateDate+desc",
      });
      const amendments = data.amendments || [];
      
      for (const a of amendments) {
        if (!a.latestAction) continue;
        const voteId = `${chamber}-${congress}-amend-${a.number || "0"}`;
        const record = {
          vote_id: voteId,
          chamber: chamber === "house" ? "House" : "Senate",
          congress: parseInt(congress),
          session: 1,
          roll_number: a.number || 0,
          vote_date: a.latestAction?.actionDate || null,
          question: `Amendment ${a.number}: ${(a.purpose || a.description || "").slice(0, 500)}`,
          description: (a.purpose || a.description || "").slice(0, 1000),
          result: a.latestAction?.text?.includes("Agreed") ? "Passed" : a.latestAction?.text?.includes("Rejected") ? "Failed" : "Unknown",
          bill_id: a.amendedBill ? `${a.amendedBill.type}-${a.amendedBill.number}-${congress}` : null,
          updated_at: new Date().toISOString(),
        };
        
        const { error } = await sb.from("congress_votes").upsert(record, { onConflict: "vote_id" });
        if (error) totalErrors++;
        else totalUpserted++;
        totalFetched++;
      }

      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.error(`Votes ${chamber} error:`, e);
    }
  }

  // Also fetch from GovTrack for actual roll call votes with member details
  try {
    const gtRes = await fetch(
      `https://www.govtrack.us/api/v2/vote?congress=${congress}&limit=30&sort=-created&format=json`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (gtRes.ok) {
      const gtData = await gtRes.json();
      for (const vote of (gtData?.objects || [])) {
        const voteId = `${vote.chamber === 1 ? "senate" : "house"}-${congress}-${vote.session}-${vote.number}`;
        const record = {
          vote_id: voteId,
          chamber: vote.chamber === 1 ? "Senate" : "House",
          congress: parseInt(congress),
          session: vote.session || 1,
          roll_number: vote.number || 0,
          vote_date: vote.created?.split("T")[0] || null,
          question: (vote.question || "").slice(0, 500),
          description: (vote.question_details || "").slice(0, 1000),
          result: vote.result || null,
          yea_total: vote.total?.yea || null,
          nay_total: vote.total?.nay || null,
          not_voting_total: vote.total?.not_voting || null,
          present_total: vote.total?.present || null,
          bill_id: vote.related_bill ? `${vote.related_bill.bill_type}-${vote.related_bill.number}-${congress}` : null,
          updated_at: new Date().toISOString(),
        };
        const { error } = await sb.from("congress_votes").upsert(record, { onConflict: "vote_id" });
        if (error) totalErrors++;
        else totalUpserted++;
        totalFetched++;
      }
    }
  } catch (e) { console.error("GovTrack votes error:", e); }

  return jsonResponse({
    action: "sync_votes", fetched: totalFetched, upserted: totalUpserted, errors: totalErrors,
    offset, hasMore: totalFetched >= 50, nextOffset: offset + 50,
  });
}

// ── 5. Sync All ────────────────────────────────────────────────────────────
async function syncAll(sb: any, apiKey: string, congress: string) {
  const results: Record<string, any> = {};

  // Members (paginate through all)
  let memberTotal = 0;
  let memberOffset = 0;
  for (let page = 0; page < 3; page++) {
    const res = await syncMembers(sb, apiKey, congress, memberOffset);
    const body = await res.json();
    memberTotal += body.upserted || 0;
    if (!body.hasMore) break;
    memberOffset = body.nextOffset;
    await new Promise(r => setTimeout(r, 500));
  }
  results.members = memberTotal;

  // Bills (first 500)
  let billTotal = 0;
  for (let page = 0; page < 2; page++) {
    const res = await syncBills(sb, apiKey, congress, page * 250);
    const body = await res.json();
    billTotal += body.upserted || 0;
    if (!body.hasMore) break;
    await new Promise(r => setTimeout(r, 500));
  }
  results.bills = billTotal;

  // Committees
  const committeeRes = await syncCommittees(sb, apiKey, congress);
  const committeeBody = await committeeRes.json();
  results.committees = committeeBody.upserted || 0;

  // Votes
  const voteRes = await syncVotes(sb, apiKey, congress, 0);
  const voteBody = await voteRes.json();
  results.votes = voteBody.upserted || 0;

  return jsonResponse({ action: "sync_all", congress, results });
}
