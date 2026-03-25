import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE = "https://api.congress.gov/v3";

interface SyncResult {
  action: string;
  synced: number;
  errors: string[];
}

function buildValidatedUrl(baseUrl: string, path: string, apiKey: string, params: Record<string, string> = {}): string {
  try {
    // Minimal path validation (Do this before new URL(baseUrl), as URL() resolves dot-segments.)
    if (baseUrl.includes('/../') || /\/%2e%2e\//i.test(baseUrl)) {
      throw new Error('Invalid path');
    }
    
    const url = new URL(baseUrl);
    
    // Protocol + host checks
    const allowedDomains = ['api.congress.gov'];
    if (!allowedDomains.includes(url.hostname)) {
      throw new Error('Invalid host');
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Invalid protocol');
    }
    
    // Validate path parameter - reject paths containing '../'
    if (path.includes('/../') || /\/%2e%2e\//i.test(path)) {
      throw new Error('Invalid parameter');
    }
    if (!/^\/[A-Za-z0-9\/_-]*$/.test(path)) {
      throw new Error('Invalid parameter');
    }
    
    // Set the pathname from the validated path
    url.pathname = path;
    
    // Add query parameters
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("format", "json");
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    
    return url.href;
  } catch {
    throw new Error('Invalid URL');
  }
}

async function fetchCongress(path: string, apiKey: string, params: Record<string, string> = {}): Promise<any> {
  const url = buildValidatedUrl(API_BASE, path, apiKey, params);

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Congress API ${resp.status}: ${await resp.text()}`);
  }
  return resp.json();
}

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Sync Members ───────────────────────────────────────────────────────────
async function syncMembers(
  supabase: any,
  apiKey: string,
  congress: number,
  chamber: string,
  limit: number
): Promise<SyncResult> {
  const result: SyncResult = { action: "sync_members", synced: 0, errors: [] };

  try {
    let offset = 0;
    let total = 0;

    while (offset < limit) {
      const batchSize = Math.min(250, limit - offset);
      const data = await fetchCongress(`/member`, apiKey, {
        limit: batchSize.toString(),
        offset: offset.toString(),
        ...(congress ? { currentMember: "true" } : {}),
      });

      const members = data.members || [];
      if (members.length === 0) break;
      total = data.pagination?.count || members.length;

      for (const m of members) {
        try {
          // Fetch detailed member info
          const detailUrl = m.url;
          let detail: any = {};
          if (m.bioguideId) {
            try {
              const dResp = await fetchCongress(`/member/${m.bioguideId}`, apiKey);
              detail = dResp.member || {};
              await delay(200); // Rate limit
            } catch {
              // Continue with basic data
            }
          }

          const record = {
            bioguide_id: m.bioguideId,
            name: m.name || `${m.firstName || ""} ${m.lastName || ""}`.trim(),
            first_name: detail.firstName || m.firstName || null,
            last_name: detail.lastName || m.lastName || null,
            party: m.partyName || detail.partyHistory?.[0]?.partyName || null,
            state: m.state || detail.state || null,
            district: m.district?.toString() || detail.district?.toString() || null,
            chamber: (detail.terms?.item?.[0]?.chamber || chamber || "house").toLowerCase(),
            congress: congress,
            terms: detail.terms?.item || [],
            leadership: detail.leadership || [],
            depiction_url: detail.depiction?.imageUrl || m.depiction?.imageUrl || null,
            official_url: detail.officialWebsiteUrl || m.officialWebsiteUrl || null,
            raw_data: detail || m,
            updated_at: new Date().toISOString(),
          };

          const { error } = await supabase
            .from("congress_members")
            .upsert(record, { onConflict: "bioguide_id" });
          if (error) {
            result.errors.push(`Member ${m.bioguideId}: ${error.message}`);
          } else {
            result.synced++;
          }
        } catch (e: any) {
          result.errors.push(`Member ${m.bioguideId}: ${e.message}`);
        }
      }

      offset += members.length;
      if (members.length < batchSize) break;
      await delay(500);
    }
  } catch (e: any) {
    result.errors.push(e.message);
  }

  return result;
}

// ─── Sync Bills ─────────────────────────────────────────────────────────────
async function syncBills(
  supabase: any,
  apiKey: string,
  congress: number,
  billType: string,
  limit: number
): Promise<SyncResult> {
  const result: SyncResult = { action: "sync_bills", synced: 0, errors: [] };

  try {
    let offset = 0;

    while (offset < limit) {
      const batchSize = Math.min(250, limit - offset);
      const path = billType
        ? `/bill/${congress}/${billType}`
        : `/bill/${congress}`;
      const data = await fetchCongress(path, apiKey, {
        limit: batchSize.toString(),
        offset: offset.toString(),
        sort: "updateDate+desc",
      });

      const bills = data.bills || [];
      if (bills.length === 0) break;

      for (const b of bills) {
        try {
          const bType = b.type?.toLowerCase() || billType || "hr";
          const bNum = b.number;
          const billId = `${bType}-${bNum}-${congress}`;

          // Fetch bill details
          let detail: any = {};
          try {
            const dResp = await fetchCongress(
              `/bill/${congress}/${bType}/${bNum}`,
              apiKey
            );
            detail = dResp.bill || {};
            await delay(200);
          } catch {
            // Continue with basic
          }

          // Fetch cosponsors
          let cosponsors: any[] = [];
          try {
            const cResp = await fetchCongress(
              `/bill/${congress}/${bType}/${bNum}/cosponsors`,
              apiKey
            );
            cosponsors = cResp.cosponsors || [];
            await delay(200);
          } catch {
            // Skip
          }

          // Fetch actions
          let actions: any[] = [];
          try {
            const aResp = await fetchCongress(
              `/bill/${congress}/${bType}/${bNum}/actions`,
              apiKey
            );
            actions = aResp.actions || [];
            await delay(200);
          } catch {
            // Skip
          }

          const record = {
            bill_id: billId,
            congress: congress,
            bill_type: bType,
            bill_number: bNum,
            title: detail.title || b.title || "",
            short_title: detail.shortTitle || null,
            introduced_date: detail.introducedDate || b.introducedDate || null,
            latest_action_text: (detail.latestAction || b.latestAction)?.text || null,
            latest_action_date: (detail.latestAction || b.latestAction)?.actionDate || null,
            origin_chamber: (detail.originChamber || b.originChamber || "").toLowerCase() || null,
            policy_area: detail.policyArea?.name || null,
            sponsor_bioguide_id: detail.sponsors?.[0]?.bioguideId || null,
            sponsor_name: detail.sponsors?.[0]?.fullName || null,
            cosponsor_count: detail.cosponsors?.count || cosponsors.length,
            cosponsors: cosponsors.map((c: any) => ({
              bioguideId: c.bioguideId,
              name: c.fullName,
              party: c.party,
              state: c.state,
              sponsorshipDate: c.sponsorshipDate,
            })),
            committees: detail.committees?.item || [],
            subjects: detail.subjects?.legislativeSubjects?.item || [],
            actions: actions.slice(0, 50).map((a: any) => ({
              date: a.actionDate,
              text: a.text,
              type: a.type,
              chamber: a.actionCode,
            })),
            congress_url: detail.congressDotGovUrl || b.url || null,
            raw_data: detail || b,
            updated_at: new Date().toISOString(),
          };

          const { error } = await supabase
            .from("congress_bills")
            .upsert(record, { onConflict: "bill_id" });
          if (error) {
            result.errors.push(`Bill ${billId}: ${error.message}`);
          } else {
            result.synced++;
          }
        } catch (e: any) {
          result.errors.push(`Bill: ${e.message}`);
        }
      }

      offset += bills.length;
      if (bills.length < batchSize) break;
      await delay(500);
    }
  } catch (e: any) {
    result.errors.push(e.message);
  }

  return result;
}

// ─── Sync Committees ────────────────────────────────────────────────────────
async function syncCommittees(
  supabase: any,
  apiKey: string,
  congress: number,
  chamber: string
): Promise<SyncResult> {
  const result: SyncResult = { action: "sync_committees", synced: 0, errors: [] };

  try {
    const chamberPath = chamber || "house";
    const data = await fetchCongress(`/committee/${chamberPath}`, apiKey, {
      limit: "250",
      ...(congress ? { congress: congress.toString() } : {}),
    });

    const committees = data.committees || [];

    for (const c of committees) {
      try {
        const systemCode = c.systemCode;
        if (!systemCode) continue;

        // Fetch detail
        let detail: any = {};
        try {
          const dResp = await fetchCongress(
            `/committee/${chamberPath}/${systemCode}`,
            apiKey
          );
          detail = dResp.committee || {};
          await delay(200);
        } catch {
          // Skip
        }

        const record = {
          system_code: systemCode,
          name: detail.name || c.name || "",
          chamber: chamberPath,
          committee_type: detail.committeeTypeCode || c.committeeTypeCode || null,
          parent_system_code: detail.parent?.systemCode || null,
          url: detail.url || c.url || null,
          subcommittees: detail.subcommittees?.item || [],
          members: [], // Members fetched separately if needed
          raw_data: detail || c,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from("congress_committees")
          .upsert(record, { onConflict: "system_code" });
        if (error) {
          result.errors.push(`Committee ${systemCode}: ${error.message}`);
        } else {
          result.synced++;
        }
      } catch (e: any) {
        result.errors.push(`Committee: ${e.message}`);
      }
    }

    // Also sync senate if no specific chamber
    if (!chamber || chamber === "house") {
      await delay(500);
      const senateData = await fetchCongress(`/committee/senate`, apiKey, {
        limit: "250",
        ...(congress ? { congress: congress.toString() } : {}),
      });

      for (const c of senateData.committees || []) {
        try {
          const systemCode = c.systemCode;
          if (!systemCode) continue;

          const record = {
            system_code: systemCode,
            name: c.name || "",
            chamber: "senate",
            committee_type: c.committeeTypeCode || null,
            url: c.url || null,
            subcommittees: [],
            members: [],
            raw_data: c,
            updated_at: new Date().toISOString(),
          };

          const { error } = await supabase
            .from("congress_committees")
            .upsert(record, { onConflict: "system_code" });
          if (error) {
            result.errors.push(`Committee ${systemCode}: ${error.message}`);
          } else {
            result.synced++;
          }
        } catch (e: any) {
          result.errors.push(`Senate committee: ${e.message}`);
        }
      }
    }
  } catch (e: any) {
    result.errors.push(e.message);
  }

  return result;
}

// ─── Sync Votes ─────────────────────────────────────────────────────────────
async function syncVotes(
  supabase: any,
  apiKey: string,
  congress: number,
  chamber: string,
  limit: number
): Promise<SyncResult> {
  const result: SyncResult = { action: "sync_votes", synced: 0, errors: [] };

  try {
    const chamberPath = chamber || "house";
    let offset = 0;

    while (offset < limit) {
      const batchSize = Math.min(250, limit - offset);
      // Congress.gov uses separate endpoints for house/senate votes
      const path = chamberPath === "senate"
        ? `/senate-vote/${congress}`
        : `/house-vote/${congress}`;
      
      let data: any;
      try {
        data = await fetchCongress(path, apiKey, {
          limit: batchSize.toString(),
          offset: offset.toString(),
        });
      } catch {
        // Try alternate path format
        data = await fetchCongress(`/vote/${congress}`, apiKey, {
          limit: batchSize.toString(),
          offset: offset.toString(),
          chamber: chamberPath,
        });
      }

      const votes = data.votes || data.houseVotes || data.senateVotes || [];
      if (votes.length === 0) break;

      for (const v of votes) {
        try {
          const rollNumber = v.rollNumber || v.number || v.rollCallNumber;
          const session = v.session || 1;
          const voteId = `${chamberPath}-${congress}-${session}-${rollNumber}`;

          // Fetch vote detail for member-level votes
          let memberVotes: any[] = [];
          try {
            const vPath = chamberPath === "senate"
              ? `/senate-vote/${congress}/${session}/${rollNumber}`
              : `/house-vote/${congress}/${session}/${rollNumber}`;
            const vResp = await fetchCongress(vPath, apiKey);
            const vDetail = vResp.vote || vResp.houseVote || vResp.senateVote || {};
            memberVotes = (vDetail.members?.member || vDetail.positions || []).map((mv: any) => ({
              bioguideId: mv.bioguideId,
              name: mv.fullName || mv.memberName,
              party: mv.party,
              state: mv.state,
              vote: mv.votePosition || mv.vote_position || mv.position,
            }));
            await delay(300);
          } catch {
            // Skip member-level data
          }

          const record = {
            vote_id: voteId,
            congress: congress,
            session: session,
            chamber: chamberPath,
            roll_number: rollNumber,
            vote_date: v.date || v.voteDate || null,
            question: v.question || v.voteQuestion || null,
            description: v.description || v.title || null,
            result: v.result || v.voteResult || null,
            bill_id: v.bill ? `${(v.bill.type || "").toLowerCase()}-${v.bill.number}-${congress}` : null,
            yea_total: v.totals?.yea || v.yea_nay?.yea || 0,
            nay_total: v.totals?.nay || v.yea_nay?.nay || 0,
            not_voting_total: v.totals?.notVoting || v.totals?.not_voting || 0,
            present_total: v.totals?.present || 0,
            member_votes: memberVotes,
            raw_data: v,
            updated_at: new Date().toISOString(),
          };

          const { error } = await supabase
            .from("congress_votes")
            .upsert(record, { onConflict: "vote_id" });
          if (error) {
            result.errors.push(`Vote ${voteId}: ${error.message}`);
          } else {
            result.synced++;
          }
        } catch (e: any) {
          result.errors.push(`Vote: ${e.message}`);
        }
      }

      offset += votes.length;
      if (votes.length < batchSize) break;
      await delay(500);
    }
  } catch (e: any) {
    result.errors.push(e.message);
  }

  return result;
}

// ─── Main Handler ───────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const congressApiKey = Deno.env.get("CONGRESS_GOV_API_KEY");

    if (!congressApiKey) {
      return new Response(
        JSON.stringify({ error: "CONGRESS_GOV_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller is admin
    const supabaseUser = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check admin role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = roles?.some((r: any) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "sync_all";
    const congress = parseInt(url.searchParams.get("congress") || "119");
    const chamber = url.searchParams.get("chamber") || "";
    const billType = url.searchParams.get("bill_type") || "";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 1000);

    const results: SyncResult[] = [];

    switch (action) {
      case "sync_members":
        results.push(await syncMembers(supabase, congressApiKey, congress, chamber, limit));
        break;

      case "sync_bills":
        results.push(await syncBills(supabase, congressApiKey, congress, billType, limit));
        break;

      case "sync_committees":
        results.push(await syncCommittees(supabase, congressApiKey, congress, chamber));
        break;

      case "sync_votes":
        results.push(await syncVotes(supabase, congressApiKey, congress, chamber, limit));
        break;

      case "sync_all":
        results.push(await syncMembers(supabase, congressApiKey, congress, chamber, Math.min(limit, 50)));
        results.push(await syncBills(supabase, congressApiKey, congress, billType, Math.min(limit, 50)));
        results.push(await syncCommittees(supabase, congressApiKey, congress, chamber));
        results.push(await syncVotes(supabase, congressApiKey, congress, chamber, Math.min(limit, 30)));
        break;

      default:
        return new Response(
          JSON.stringify({
            error: "Unknown action",
            valid_actions: ["sync_members", "sync_bills", "sync_committees", "sync_votes", "sync_all"],
            params: { congress: "Congress number (default 119)", chamber: "house|senate", limit: "Max records", bill_type: "hr|s|hjres|sjres" },
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify({
        success: true,
        congress,
        results,
        total_synced: results.reduce((s, r) => s + r.synced, 0),
        total_errors: results.reduce((s, r) => s + r.errors.length, 0),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Congress sync error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
