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

    // Validate JWT via getUser()
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser(token);

    const isServiceRole = token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!isServiceRole && (userError || !userData?.user)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Allow service_role tokens (for scheduled cron jobs)
    if (isServiceRole) {
      console.log("[SECURITY] Authenticated as service_role (cron)");
    } else {
      // For non-service_role tokens, verify user and check admin/moderator role
      const userId = userData!.user!.id;
      const adminClient = createClient(supabaseUrl, supabaseKey);
      const { data: roles } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      const userRoles = (roles || []).map((r: any) => r.role);
      const isAuthorized = userRoles.includes("admin") || userRoles.includes("moderator");

      if (!isAuthorized) {
        return new Response(
          JSON.stringify({ error: "Forbidden: Requires admin or moderator role" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[SECURITY] Authenticated as user ${userId} with roles: ${userRoles.join(", ")}`);
    }

    // Create privileged client for sync operations (only after auth check passes)
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: Record<string, unknown> = {};

    // Helper: log a sync run to sync_run_log so users can see status in their Profile → Sync tab.
    const logRun = async (source: string, status: "success" | "error" | "partial" | "skipped", rows = 0, errMsg?: string, startMs = Date.now()) => {
      try {
        await supabase.from("sync_run_log").insert({
          source,
          status,
          rows_synced: rows,
          error_message: errMsg ?? null,
          duration_ms: Date.now() - startMs,
          finished_at: new Date().toISOString(),
        });
      } catch (e) { console.error(`logRun(${source}) failed:`, e); }
    };

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

    // 6. Prediction markets sync
    try {
      const pmRes = await fetch(
        `${supabaseUrl}/functions/v1/prediction-markets-sync`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: "{}",
        },
      );
      const pmData = await pmRes.json();
      results.prediction_markets = {
        status: pmRes.ok ? "ok" : "error",
        total: pmData?.total ?? 0,
        upserted: pmData?.upserted ?? 0,
      };
      console.log(`Prediction markets sync: ${pmData?.upserted ?? 0} upserted`);
    } catch (e) {
      results.prediction_markets = { error: e instanceof Error ? e.message : "failed" };
      console.error("Prediction markets sync error:", e);
    }

    // 7. International profiles sync (top countries)
    try {
      const intlCodes = ["US","CA","MX","GB","FR","DE","IT","ES","JP","KR","CN","IN","BR","AR","AU","ZA","NG","EG"];
      let intlSynced = 0;
      for (const code of intlCodes) {
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/international-sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
            body: JSON.stringify({ country_code: code }),
          });
          if (res.ok) intlSynced++;
        } catch { /* continue */ }
      }
      results.international_sync = { synced: intlSynced, total: intlCodes.length };
      console.log(`International sync: ${intlSynced}/${intlCodes.length} countries`);
    } catch (e) {
      results.international_sync = { error: e instanceof Error ? e.message : "failed" };
      console.error("International sync error:", e);
    }

    // 8. Auto-discover and generate candidate profiles
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

    // 9. Polling sync (RealClearPolitics, 538, etc.)
    {
      const start = Date.now();
      try {
        const r = await fetch(`${supabaseUrl}/functions/v1/polling-sync`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` }, body: "{}",
        });
        const d = await r.json().catch(() => ({}));
        results.polling = { status: r.ok ? "ok" : "error", upserted: d?.upserted ?? 0 };
        await logRun("polling", r.ok ? "success" : "error", d?.upserted ?? 0, r.ok ? undefined : `HTTP ${r.status}`, start);
      } catch (e) {
        results.polling = { error: e instanceof Error ? e.message : "failed" };
        await logRun("polling", "error", 0, e instanceof Error ? e.message : "failed", start);
      }
    }

    // 10. Forecast sync (Cook, Sabato, Inside Elections)
    {
      const start = Date.now();
      try {
        const r = await fetch(`${supabaseUrl}/functions/v1/forecast-sync`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` }, body: "{}",
        });
        const d = await r.json().catch(() => ({}));
        results.forecasts = { status: r.ok ? "ok" : "error", upserted: d?.upserted ?? 0 };
        await logRun("forecasts", r.ok ? "success" : "error", d?.upserted ?? 0, undefined, start);
      } catch (e) {
        results.forecasts = { error: e instanceof Error ? e.message : "failed" };
        await logRun("forecasts", "error", 0, e instanceof Error ? e.message : "failed", start);
      }
    }

    // 11. Congress sync (members, bills, votes)
    {
      const start = Date.now();
      try {
        const r = await fetch(`${supabaseUrl}/functions/v1/congress-sync`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` }, body: "{}",
        });
        const d = await r.json().catch(() => ({}));
        results.congress = { status: r.ok ? "ok" : "error", ...d };
        await logRun("congress", r.ok ? "success" : "error", d?.upserted ?? 0, undefined, start);
      } catch (e) {
        results.congress = { error: e instanceof Error ? e.message : "failed" };
        await logRun("congress", "error", 0, e instanceof Error ? e.message : "failed", start);
      }
    }

    // 12. Geopolitics — refresh top-tier country briefs (rotate to keep AI cost down)
    {
      const start = Date.now();
      try {
        // Rotate through ~10 codes per run; full set covered every ~8 hours at 15-min cadence
        const ROTATION = [
          ["US","CN","RU","UA","IL"], ["IR","KP","TW","IN","PK"],
          ["GB","FR","DE","JP","KR"], ["BR","MX","CA","AU","ZA"],
          ["SA","AE","TR","EG","NG"], ["VE","CU","SY","YE","AF"],
        ];
        const idx = Math.floor(Date.now() / (15 * 60 * 1000)) % ROTATION.length;
        const batch = ROTATION[idx];
        let ok = 0;
        for (const code of batch) {
          try {
            const r = await fetch(`${supabaseUrl}/functions/v1/geopolitics-brief`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
              body: JSON.stringify({ country_code: code, force: false }),
            });
            if (r.ok) ok++;
            await new Promise((r) => setTimeout(r, 1500));
          } catch { /* continue */ }
        }
        results.geopolitics = { rotation_index: idx, batch, refreshed: ok };
        await logRun("geopolitics", ok > 0 ? "success" : "partial", ok, undefined, start);
      } catch (e) {
        results.geopolitics = { error: e instanceof Error ? e.message : "failed" };
        await logRun("geopolitics", "error", 0, e instanceof Error ? e.message : "failed", start);
      }
    }

    // 13. Intel briefings (news clusters)
    {
      const start = Date.now();
      try {
        const r = await fetch(`${supabaseUrl}/functions/v1/intel-briefing`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` }, body: "{}",
        });
        results.intel = { status: r.ok ? "ok" : "error" };
        await logRun("intel", r.ok ? "success" : "error", 0, undefined, start);
      } catch (e) {
        results.intel = { error: e instanceof Error ? e.message : "failed" };
        await logRun("intel", "error", 0, e instanceof Error ? e.message : "failed", start);
      }
    }

    // 14. Lobbying & contracts
    for (const fn of ["lobbying-sync", "contracts-sync", "court-cases-sync"]) {
      const start = Date.now();
      try {
        const r = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` }, body: "{}",
        });
        results[fn] = { status: r.ok ? "ok" : "error" };
        await logRun(fn, r.ok ? "success" : "error", 0, undefined, start);
      } catch (e) {
        results[fn] = { error: e instanceof Error ? e.message : "failed" };
        await logRun(fn, "error", 0, e instanceof Error ? e.message : "failed", start);
      }
    }

    // Master log entry
    await logRun("all", "success", Object.keys(results).length);

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
