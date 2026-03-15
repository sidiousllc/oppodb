import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALL_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
  "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
  "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

const STATES_PER_BATCH = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: Record<string, unknown> = {};

    // 1. Sync GitHub research content
    try {
      const ghRes = await fetch(`${supabaseUrl}/functions/v1/sync-github`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${anonKey}`,
        },
        body: "{}",
      });
      results.github = { status: ghRes.status, ok: ghRes.ok };
      console.log(`GitHub sync: ${ghRes.status}`);
    } catch (e) {
      results.github = { error: e instanceof Error ? e.message : "failed" };
      console.error("GitHub sync error:", e);
    }

    // 2. Determine which batch of states to process for election results
    // Use a simple metadata row to track the current batch offset
    const { data: meta } = await supabase
      .from("sync_metadata")
      .select("*")
      .eq("id", 2)
      .maybeSingle();

    let batchOffset = 0;
    if (meta?.last_commit_sha) {
      batchOffset = parseInt(meta.last_commit_sha) || 0;
    }

    // Wrap around if we've gone through all states
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
          {
            headers: {
              "Authorization": `Bearer ${anonKey}`,
            },
          },
        );
        const data = await res.json();
        electionResults.push({
          state,
          status: res.ok ? "ok" : "error",
          upserted: data?.upserted ?? 0,
        });
        console.log(`${state}: ${data?.upserted ?? 0} upserted`);
      } catch (e) {
        electionResults.push({ state, status: "error" });
        console.error(`${state} sync error:`, e);
      }
    }

    results.elections = {
      batch_offset: batchOffset,
      next_offset: nextOffset >= ALL_STATES.length ? 0 : nextOffset,
      states: electionResults,
    };

    // Save next batch offset (reuse sync_metadata row id=2)
    await supabase.from("sync_metadata").upsert({
      id: 2,
      last_commit_sha: String(nextOffset >= ALL_STATES.length ? 0 : nextOffset),
      last_synced_at: new Date().toISOString(),
    });

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
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
