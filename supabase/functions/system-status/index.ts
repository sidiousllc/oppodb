import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type CheckStatus = "ok" | "degraded" | "down";

interface HealthCheck {
  component: string;
  status: CheckStatus;
  latency_ms: number;
  detail?: string;
}

interface StatusResponse {
  status: CheckStatus;
  generated_at: string;
  duration_ms: number;
  checks: HealthCheck[];
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const COMPONENT_CHECKS = [
  { key: "database",         label: "Database",            fn: checkDatabase },
  { key: "auth",              label: "Auth",                 fn: checkAuth },
  { key: "candidates",       label: "Candidates",           fn: checkCandidates },
  { key: "districts",         label: "Districts",             fn: checkDistricts },
  { key: "polling",           label: "Polling",               fn: checkPolling },
  { key: "congress",          label: "Congress",              fn: checkCongress },
  { key: "election-results",  label: "Election Results",     fn: checkElectionResults },
  { key: "intel",             label: "Intel Hub",             fn: checkIntel },
  { key: "messaging",         label: "Messaging Hub",         fn: checkMessaging },
  { key: "maga-files",        label: "MAGA Files",            fn: checkMagaFiles },
  { key: "narrative-reports", label: "Narrative Reports",     fn: checkNarrativeReports },
  { key: "sync-pipeline",     label: "Sync Pipeline",         fn: checkSyncPipeline },
  { key: "docs-wiki",         label: "Wiki Pages",             fn: checkDocsWiki },
  { key: "public-api",        label: "Public API",             fn: checkPublicApi },
] as const;

Deno.serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const start = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const checks: HealthCheck[] = [];

  await Promise.all(
    COMPONENT_CHECKS.map(async ({ key, fn }) => {
      const t0 = Date.now();
      try {
        const result = await fn(supabase, supabaseUrl);
        checks.push({
          component: key,
          status: result.ok ? "ok" : result.degraded ? "degraded" : "down",
          latency_ms: Date.now() - t0,
          detail: result.detail,
        });
      } catch (err) {
        checks.push({ component: key, status: "down", latency_ms: Date.now() - t0, detail: String(err) });
      }
    })
  );

  const overall: CheckStatus =
    checks.every((c) => c.status === "ok") ? "ok"
    : checks.some((c) => c.status === "down") ? "down"
    : "degraded";

  return new Response(JSON.stringify({
    status: overall,
    generated_at: new Date().toISOString(),
    duration_ms: Date.now() - start,
    checks,
  } as StatusResponse), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

type CheckResult = { ok: boolean; degraded?: boolean; detail?: string };

async function checkDatabase(s: ReturnType<typeof createClient>, _url: string): Promise<CheckResult> {
  const { error } = await s.from("user_devices").select("id").limit(1);
  if (error) return { ok: false, detail: error.message };
  return { ok: true };
}

async function checkAuth(s: ReturnType<typeof createClient>, _url: string): Promise<CheckResult> {
  const { error } = await s.auth.admin.listUsers({ limit: 1 });
  if (error) return { ok: false, detail: error.message };
  return { ok: true };
}

async function checkCandidates(s: ReturnType<typeof createClient>, _url: string): Promise<CheckResult> {
  const { count, error } = await s.from("candidates").select("*", { count: "exact", head: true });
  if (error) return { ok: false, detail: error.message };
  if (count === 0) return { ok: false, degraded: true, detail: "No records found" };
  return { ok: true };
}

async function checkDistricts(s: ReturnType<typeof createClient>, _url: string): Promise<CheckResult> {
  const { count, error } = await s.from("district_profiles").select("*", { count: "exact", head: true });
  if (error) return { ok: false, detail: error.message };
  if (count === 0) return { ok: false, degraded: true, detail: "No records found" };
  return { ok: true };
}

async function checkPolling(s: ReturnType<typeof createClient>, _url: string): Promise<CheckResult> {
  const { count, error } = await s.from("polling_data").select("*", { count: "exact", head: true });
  if (error) return { ok: false, detail: error.message };
  return { ok: true };
}

async function checkCongress(s: ReturnType<typeof createClient>, _url: string): Promise<CheckResult> {
  const { count, error } = await s.from("congress_members").select("*", { count: "exact", head: true });
  if (error) return { ok: false, detail: error.message };
  return { ok: true };
}

async function checkElectionResults(s: ReturnType<typeof createClient>, _url: string): Promise<CheckResult> {
  const { count, error } = await s.from("congressional_election_results").select("*", { count: "exact", head: true });
  if (error) return { ok: false, detail: error.message };
  return { ok: true };
}

async function checkIntel(s: ReturnType<typeof createClient>, _url: string): Promise<CheckResult> {
  const { count, error } = await s.from("intel_briefings").select("*", { count: "exact", head: true });
  if (error) return { ok: false, detail: error.message };
  return { ok: true };
}

async function checkMessaging(s: ReturnType<typeof createClient>, _url: string): Promise<CheckResult> {
  const { count, error } = await s.from("messaging_guidance").select("*", { count: "exact", head: true });
  if (error) return { ok: false, detail: error.message };
  return { ok: true };
}

async function checkMagaFiles(s: ReturnType<typeof createClient>, _url: string): Promise<CheckResult> {
  const { count, error } = await s.from("maga_files").select("*", { count: "exact", head: true });
  if (error) return { ok: false, detail: error.message };
  return { ok: true };
}

async function checkNarrativeReports(s: ReturnType<typeof createClient>, _url: string): Promise<CheckResult> {
  const { count, error } = await s.from("narrative_reports").select("*", { count: "exact", head: true });
  if (error) return { ok: false, detail: error.message };
  return { ok: true };
}

async function checkSyncPipeline(s: ReturnType<typeof createClient>, _url: string): Promise<CheckResult> {
  const { data, error } = await s
    .from("sync_run_log")
    .select("source, status")
    .order("started_at", { ascending: false })
    .limit(10);
  if (error) return { ok: false, detail: error.message };
  const failures = (data ?? []).filter((r: { status: string }) => r.status === "failed");
  if (failures.length > 0) {
    return { ok: false, degraded: true, detail: `${failures.length} recent failure(s): ${failures.map((r: { source: string }) => r.source).join(", ")}` };
  }
  return { ok: true };
}

async function checkDocsWiki(s: ReturnType<typeof createClient>, _url: string): Promise<CheckResult> {
  const { count, error } = await s.from("wiki_pages").select("*", { count: "exact", head: true });
  if (error) return { ok: false, detail: error.message };
  return { ok: true };
}

async function checkPublicApi(_s: ReturnType<typeof createClient>, url: string): Promise<CheckResult> {
  try {
    const res = await fetch(`${url}/functions/v1/public-api`, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
    });
    // 401 is expected — means the endpoint is alive but requires auth
    if (res.status === 401 || res.ok) return { ok: true };
    return { ok: false, detail: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, detail: String(err) };
  }
}
