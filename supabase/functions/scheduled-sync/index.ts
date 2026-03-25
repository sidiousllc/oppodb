import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const TRUSTED_ORIGINS = [
  "https://oppodb.com",
  "https://db.oppodb.com",
  "https://ordb.lovable.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const isAllowed = origin && (
    TRUSTED_ORIGINS.includes(origin) ||
    origin.endsWith(".lovableproject.com") ||
    origin.endsWith(".lovable.app")
  );
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : TRUSTED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Vary": "Origin",
  };
}

const ALL_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
  "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
  "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

const STATES_PER_BATCH = 5;

function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1]
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    return JSON.parse(atob(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Authentication & Authorization ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const token = authHeader.slice("Bearer ".length).trim();
    const claims = parseJwtClaims(token);

    // Allow service_role tokens (for scheduled cron jobs)
    if (claims?.role === "service_role") {
      console.log("[SECURITY] Authenticated as service_role (cron)");
    } else {
      // For non-service_role tokens, verify user and check admin/moderator role
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: authError } = await authClient.auth.getUser(token);
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: Invalid user token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if user has admin or moderator role
      const adminClient = createClient(supabaseUrl, supabaseKey);
      const { data: roles } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const userRoles = (roles || []).map((r: any) => r.role);
      const isAuthorized = userRoles.includes("admin") || userRoles.includes("moderator");

      if (!isAuthorized) {
        return new Response(
          JSON.stringify({ error: "Forbidden: Requires admin or moderator role" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[SECURITY] Authenticated as user ${user.id} with roles: ${userRoles.join(", ")}`);
    }

    // Create privileged client for sync operations (only after auth check passes)
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: Record<string, unknown> = {};

    // 1. Sync GitHub research content — pass service_role key for internal call
    try {
      const ghRes = await fetch(`${supabaseUrl}/functions/v1/sync-github`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: "{}",
      });
      results.github = { status: ghRes.status, ok: ghRes.ok };
      console.log(`GitHub sync: ${ghRes.status}`);
    } catch (e) {
      results.github = { error: e instanceof Error ? e.message : "failed" };
      console.error("GitHub sync error:", e);
    }

    // 2. Determine which batch of states to process for state-level election results
    const { data: meta } = await supabase
      .from("sync_metadata")
      .select("*")
      .eq("id", 2)
      .maybeSingle();

    let batchOffset = 0;
    if (meta?.last_commit_sha) {
      batchOffset = parseInt(meta.last_commit_sha) || 0;
    }
    if (batchOffset >= ALL_STATES.length) {
      batchOffset = 0;
    }

    const batchStates = ALL_STATES.slice(batchOffset, batchOffset + STATES_PER_BATCH);
    const nextOffset = batchOffset + STATES_PER_BATCH;

    console.log(`Election sync batch: states ${batchOffset}-${batchOffset + batchStates.length - 1} (${batchStates.join(", ")})`);

    const electionResults: Array<{ state: string; status: string; upserted?: number }> = [];

    for (const state of batchStates) {
      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/election-results-sync?state=${state}`,
          { headers: { "Authorization": `Bearer ${supabaseKey}` } },
        );
        const data = await res.json();
        electionResults.push({ state, status: res.ok ? "ok" : "error", upserted: data?.upserted ?? 0 });
        console.log(`State leg ${state}: ${data?.upserted ?? 0} upserted`);
      } catch (e) {
        electionResults.push({ state, status: "error" });
        console.error(`${state} state leg sync error:`, e);
      }
    }

    results.elections = {
      batch_offset: batchOffset,
      next_offset: nextOffset >= ALL_STATES.length ? 0 : nextOffset,
      states: electionResults,
    };

    await supabase.from("sync_metadata").upsert({
      id: 2,
      last_commit_sha: String(nextOffset >= ALL_STATES.length ? 0 : nextOffset),
      last_synced_at: new Date().toISOString(),
    });

    // 3. Congressional election sync
    const { data: congMeta } = await supabase
      .from("sync_metadata")
      .select("*")
      .eq("id", 3)
      .maybeSingle();

    let congOffset = 0;
    if (congMeta?.last_commit_sha) {
      congOffset = parseInt(congMeta.last_commit_sha) || 0;
    }
    if (congOffset >= ALL_STATES.length) {
      congOffset = 0;
    }

    const congBatchStates = ALL_STATES.slice(congOffset, congOffset + STATES_PER_BATCH);
    const congNextOffset = congOffset + STATES_PER_BATCH;

    console.log(`Congressional sync batch: states ${congOffset}-${congOffset + congBatchStates.length - 1} (${congBatchStates.join(", ")})`);

    const congressionalResults: Array<{ state: string; status: string; upserted?: number }> = [];

    for (const state of congBatchStates) {
      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/congressional-election-sync?state=${state}`,
          { headers: { "Authorization": `Bearer ${supabaseKey}` } },
        );
        const data = await res.json();
        congressionalResults.push({ state, status: res.ok ? "ok" : "error", upserted: data?.upserted ?? 0 });
        console.log(`Congressional ${state}: ${data?.upserted ?? 0} upserted`);
      } catch (e) {
        congressionalResults.push({ state, status: "error" });
        console.error(`${state} congressional sync error:`, e);
      }
    }

    results.congressional = {
      batch_offset: congOffset,
      next_offset: congNextOffset >= ALL_STATES.length ? 0 : congNextOffset,
      states: congressionalResults,
    };

    await supabase.from("sync_metadata").upsert({
      id: 3,
      last_commit_sha: String(congNextOffset >= ALL_STATES.length ? 0 : congNextOffset),
      last_synced_at: new Date().toISOString(),
    });

    // 4. Campaign finance sync
    const { data: finMeta } = await supabase
      .from("sync_metadata")
      .select("*")
      .eq("id", 4)
      .maybeSingle();

    let finOffset = 0;
    if (finMeta?.last_commit_sha) {
      finOffset = parseInt(finMeta.last_commit_sha) || 0;
    }
    if (finOffset >= ALL_STATES.length) {
      finOffset = 0;
    }

    const finBatchStates = ALL_STATES.slice(finOffset, finOffset + STATES_PER_BATCH);
    const finNextOffset = finOffset + STATES_PER_BATCH;

    console.log(`Finance sync batch: states ${finOffset}-${finOffset + finBatchStates.length - 1} (${finBatchStates.join(", ")})`);

    const financeResults: Array<{ state: string; status: string; upserted?: number }> = [];

    for (const state of finBatchStates) {
      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/campaign-finance-sync?state=${state}`,
          { headers: { "Authorization": `Bearer ${supabaseKey}` } },
        );
        const data = await res.json();
        financeResults.push({ state, status: res.ok ? "ok" : "error", upserted: data?.upserted ?? 0 });
        console.log(`Finance ${state}: ${data?.upserted ?? 0} upserted`);
      } catch (e) {
        financeResults.push({ state, status: "error" });
        console.error(`${state} finance sync error:`, e);
      }
    }

    results.finance = {
      batch_offset: finOffset,
      next_offset: finNextOffset >= ALL_STATES.length ? 0 : finNextOffset,
      states: financeResults,
    };

    await supabase.from("sync_metadata").upsert({
      id: 4,
      last_commit_sha: String(finNextOffset >= ALL_STATES.length ? 0 : finNextOffset),
      last_synced_at: new Date().toISOString(),
    });

    // 5. State-level campaign finance board sync (MN, PA, MI)
    const stateCfbResults: Array<{ state: string; status: string }> = [];

    try {
      const res = await fetch(
        `${supabaseUrl}/functions/v1/mn-cfb-finance?action=sync`,
        { headers: { "Authorization": `Bearer ${supabaseKey}` } },
      );
      stateCfbResults.push({ state: "MN", status: res.ok ? "ok" : "error" });
      console.log(`MN CFB sync triggered: ${res.status}`);
    } catch (e) {
      stateCfbResults.push({ state: "MN", status: "error" });
      console.error("MN CFB sync error:", e);
    }

    for (const state of ["PA", "MI"]) {
      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/state-cfb-finance?action=sync&state=${state}`,
          { headers: { "Authorization": `Bearer ${supabaseKey}` } },
        );
        stateCfbResults.push({ state, status: res.ok ? "ok" : "error" });
        console.log(`${state} CFB sync triggered: ${res.status}`);
      } catch (e) {
        stateCfbResults.push({ state, status: "error" });
        console.error(`${state} CFB sync error:`, e);
      }
    }

    results.state_cfb = { states: stateCfbResults };

    // 6. Auto-discover and generate candidate profiles
    const CANDIDATES_PER_BATCH = 5;
    try {
      const { data: existingProfiles } = await supabase
        .from("candidate_profiles")
        .select("name")
        .eq("is_subpage", false);
      
      const existingNames = new Set((existingProfiles || []).map((p: any) => p.name.toLowerCase()));

      const { data: scraperMeta } = await supabase
        .from("sync_metadata")
        .select("*")
        .eq("id", 5)
        .maybeSingle();

      let scraperOffset = 0;
      if (scraperMeta?.last_commit_sha) {
        scraperOffset = parseInt(scraperMeta.last_commit_sha) || 0;
      }

      const { data: allMembers } = await supabase
        .from("congress_members")
        .select("name, state, party, district, chamber")
        .order("name");

      const needsProfile = (allMembers || []).filter(
        (m: any) => !existingNames.has(m.name.toLowerCase())
      );

      const { data: stateWinners } = await supabase
        .from("state_leg_election_results")
        .select("candidate_name, state_abbr, chamber, district_number, party")
        .eq("is_winner", true)
        .order("election_year", { ascending: false });

      const seenNames = new Set(needsProfile.map((m: any) => m.name.toLowerCase()));
      const stateNeedsProfile = (stateWinners || []).filter((w: any) => {
        const key = w.candidate_name.toLowerCase();
        if (existingNames.has(key) || seenNames.has(key)) return false;
        seenNames.add(key);
        return true;
      });

      const allCandidates = [
        ...needsProfile.map((m: any) => ({
          candidate_name: m.name,
          office: m.chamber === "senate" ? "US Senate" : "US House",
          state: m.state,
          party: m.party || "Republican",
          district: m.district,
        })),
        ...stateNeedsProfile.map((w: any) => ({
          candidate_name: w.candidate_name,
          office: `State ${w.chamber === "upper" ? "Senate" : "House"}`,
          state: w.state_abbr,
          party: w.party || "Republican",
          district: w.district_number,
        })),
      ];

      if (scraperOffset >= allCandidates.length) {
        scraperOffset = 0;
      }

      const batch = allCandidates.slice(scraperOffset, scraperOffset + CANDIDATES_PER_BATCH);
      const scraperNextOffset = scraperOffset + CANDIDATES_PER_BATCH;

      console.log(`Candidate scraper batch: ${scraperOffset}-${scraperOffset + batch.length - 1} of ${allCandidates.length} total`);

      const scraperResults: Array<{ name: string; status: string }> = [];

      for (const candidate of batch) {
        try {
          const res = await fetch(
            `${supabaseUrl}/functions/v1/candidate-scraper`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({ action: "scrape", ...candidate }),
            },
          );
          const data = await res.json();
          scraperResults.push({
            name: candidate.candidate_name,
            status: data.success ? "created" : "error",
          });
          console.log(`Profile ${candidate.candidate_name}: ${data.success ? "created" : "error"}`);
          await new Promise((r) => setTimeout(r, 2000));
        } catch (e) {
          scraperResults.push({ name: candidate.candidate_name, status: "error" });
          console.error(`Scraper error for ${candidate.candidate_name}:`, e);
        }
      }

      await supabase.from("sync_metadata").upsert({
        id: 5,
        last_commit_sha: String(scraperNextOffset >= allCandidates.length ? 0 : scraperNextOffset),
        last_synced_at: new Date().toISOString(),
      });

      results.candidate_scraper = {
        batch_offset: scraperOffset,
        next_offset: scraperNextOffset >= allCandidates.length ? 0 : scraperNextOffset,
        total_candidates_needing_profiles: allCandidates.length,
        generated: scraperResults,
      };
    } catch (e) {
      results.candidate_scraper = { error: e instanceof Error ? e.message : "failed" };
      console.error("Candidate scraper error:", e);
    }

    console.log(`[SECURITY] Sync completed. Results: ${JSON.stringify(Object.keys(results))}`);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Scheduled sync error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
