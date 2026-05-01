import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import type { SupabaseLike } from "../_shared/supabase-types.ts";

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

// ─── Auth ────────────────────────────────────────────────────────────────────

async function requireAuth(req: Request, supabaseUrl: string, supabaseKey: string): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (token === supabaseKey) return "service_role";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stateHealthScore(
  successes: number,
  failures: number,
  hours: number,
  threshold: number,
): number {
  const total = successes + failures;
  if (total === 0) return 100; // never synced = assume healthy
  const rate = successes / total;
  const recency = Math.max(0, 1 - failures / Math.max(hours, 1));
  return Math.round(rate * recency * 100);
}

async function getRecentSyncStats(
  supabase: SupabaseLike,
  state: string,
  windowHours: number,
): Promise<{ successes: number; failures: number; lastSyncAt: string | null }> {
  const since = new Date(Date.now() - windowHours * 3600 * 1000).toISOString();
  const { data: runs } = await supabase
    .from("sync_run_log")
    .select("status, finished_at")
    .gte("finished_at", since);

  const statePrefix = `state:${state.toLowerCase()}`;
  const relevant = (runs || []).filter((r: any) => {
    const s = r.status;
    return s === "success" || s === "error" || s === "partial";
  });

  let successes = 0;
  let failures = 0;
  let lastSyncAt: string | null = null;

  for (const run of relevant) {
    successes += run.status === "success" ? 1 : 0;
    failures += run.status === "error" ? 1 : 0;
    if (!lastSyncAt && run.finished_at) lastSyncAt = run.finished_at;
  }

  return { successes, failures, lastSyncAt };
}

async function sendAlert(
  supabase: SupabaseLike,
  userId: string,
  state: string,
  score: number,
  threshold: number,
  channels: string[],
  scheduleId: string,
): Promise<void> {
  const msg = `🔔 Health alert: **${state}** health dropped to **${score}** (threshold: ${threshold})`;

  for (const channel of channels) {
    if (channel === "in_app") {
      await supabase.from("notifications").insert({
        user_id: userId,
        category: "state_health_alert",
        title: `Health alert: ${state}`,
        body: msg,
        metadata: { state, score, threshold, schedule_id: scheduleId },
      });
    }
    // Extend with "email" or "webhook" here as needed
  }

  await supabase.from("state_refresh_schedules").update({
    last_alerted_at: new Date().toISOString(),
  }).eq("id", scheduleId);
}

// ─── GET /state-health-scheduler ──────────────────────────────────────────────
// Returns all schedules with current health scores (read-only health check)

async function handleGet(
  req: Request,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<Response> {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  const userId = await requireAuth(req, supabaseUrl, supabaseKey);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: schedules } = await supabase
    .from("state_refresh_schedules")
    .select("*")
    .eq("enabled", true)
    .order("state_abbr");

  const results = await Promise.all(
    (schedules || []).map(async (schedule: any) => {
      const { successes, failures, lastSyncAt } = await getRecentSyncStats(
        supabase,
        schedule.state_abbr,
        schedule.health_window_hours,
      );
      const score = stateHealthScore(successes, failures, schedule.health_window_hours, schedule.health_threshold);
      return {
        state: schedule.state_abbr,
        refresh_hours: schedule.refresh_hours,
        health_threshold: schedule.health_threshold,
        health_score: score,
        last_sync_at: lastSyncAt,
        enabled: schedule.enabled,
        last_alerted_at: schedule.last_alerted_at,
      };
    }),
  );

  return new Response(JSON.stringify({ schedules: results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── PUT /state-health-scheduler ─────────────────────────────────────────────
// Create or update a schedule for a state

async function handlePut(
  req: Request,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<Response> {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  const userId = await requireAuth(req, supabaseUrl, supabaseKey);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const { state_abbr, refresh_hours, health_threshold, health_window_hours, channels, enabled } = body;

  if (!state_abbr || !ALL_STATES.includes(state_abbr.toUpperCase())) {
    return new Response(JSON.stringify({ error: "Invalid state abbreviation" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const updates: any = {
    refresh_hours: refresh_hours ?? 6,
    health_threshold: health_threshold ?? 60,
    health_window_hours: health_window_hours ?? 24,
    channels: channels ?? ["in_app"],
    enabled: enabled ?? true,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("state_refresh_schedules")
    .upsert({ state_abbr: state_abbr.toUpperCase(), ...updates }, { onConflict: "state_abbr" })
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ schedule: data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── POST /state-health-scheduler/check ─────────────────────────────────────
// Cron entry point: evaluate health for all enabled states and fire alerts

async function handleCheck(
  req: Request,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<Response> {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  // Service role only (called by cron)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (token !== supabaseKey) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: schedules } = await supabase
    .from("state_refresh_schedules")
    .select("*")
    .eq("enabled", true);

  const results: Array<{ state: string; score: number; alerted: boolean; error?: string }> = [];

  for (const schedule of schedules || []) {
    try {
      const { successes, failures, lastSyncAt } = await getRecentSyncStats(
        supabase,
        schedule.state_abbr,
        schedule.health_window_hours,
      );
      const score = stateHealthScore(successes, failures, schedule.health_window_hours, schedule.health_threshold);

      // Log health
      await supabase.from("state_health_log").insert({
        state_abbr: schedule.state_abbr,
        health_score: score,
        sync_successes: successes,
        sync_failures: failures,
        last_sync_at: lastSyncAt ?? null,
        alert_sent: false,
        alert_channels: [],
      });

      // Fire alert if below threshold AND no recent alert
      const cooldownMs = schedule.refresh_hours * 3600 * 1000;
      const canAlert = !schedule.last_alerted_at ||
        (Date.now() - new Date(schedule.last_alerted_at).getTime()) > cooldownMs;

      if (score < schedule.health_threshold && canAlert) {
        await sendAlert(
          supabase,
          schedule.user_id,
          schedule.state_abbr,
          score,
          schedule.health_threshold,
          schedule.channels,
          schedule.id,
        );
        await supabase.from("state_health_log").update({ alert_sent: true, alert_channels: schedule.channels })
          .eq("state_abbr", schedule.state_abbr)
          .order("created_at", { ascending: false })
          .limit(1);
        results.push({ state: schedule.state_abbr, score, alerted: true });
      } else {
        results.push({ state: schedule.state_abbr, score, alerted: false });
      }

      // Update last_checked_at
      await supabase.from("state_refresh_schedules").update({
        last_checked_at: new Date().toISOString(),
      }).eq("id", schedule.id);
    } catch (e) {
      results.push({ state: schedule.state_abbr, score: 0, alerted: false, error: String(e) });
    }
  }

  return new Response(JSON.stringify({ checked: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    if (req.method === "GET") {
      return handleGet(req, supabaseUrl, supabaseKey);
    } else if (req.method === "PUT") {
      return handlePut(req, supabaseUrl, supabaseKey);
    } else if (req.method === "POST") {
      // POST with no body = check action
      return handleCheck(req, supabaseUrl, supabaseKey);
    } else {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});