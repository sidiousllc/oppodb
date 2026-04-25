import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const checks: Array<{
    component: string;
    status: "ok" | "degraded" | "down";
    latency_ms: number;
    detail?: string;
  }> = [];
  const start = Date.now();

  const runCheck = async (name: string, fn: () => Promise<boolean>, detail?: string) => {
    const t0 = Date.now();
    try {
      const ok = await fn();
      checks.push({ component: name, status: ok ? "ok" : "down", latency_ms: Date.now() - t0, detail });
    } catch (err: any) {
      checks.push({ component: name, status: "down", latency_ms: Date.now() - t0, detail: String(err) });
    }
  };

  await Promise.all([
    runCheck("database", async () => {
      const { error } = await supabase.from("sync_run_log").select("id").limit(1);
      if (error) throw new Error(error.message);
      return true;
    }),
    runCheck("api-gateway", async () => {
      const res = await fetch(`${supabaseUrl}/functions/v1/public-api`, {
        headers: { "Accept": "application/json", "X-API-Key": "probe" },
        signal: AbortSignal.timeout(5000),
      });
      return res.status < 500;
    }, "GET /functions/v1/public-api"),
    runCheck("mcp-server", async () => {
      const res = await fetch(`${supabaseUrl}/functions/v1/mcp-server`, {
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(5000),
      });
      return res.status < 500;
    }, "MCP server endpoint"),
    runCheck("candidates", async () => {
      const { error } = await supabase.from("candidates").select("id").limit(1);
      if (error) throw new Error(error.message);
      return true;
    }),
    runCheck("polling", async () => {
      const { error } = await supabase.from("polling_data").select("id").limit(1);
      if (error) throw new Error(error.message);
      return true;
    }),
    runCheck("messaging", async () => {
      const { error } = await supabase.from("messaging_guidance").select("id").limit(1);
      if (error) throw new Error(error.message);
      return true;
    }),
    runCheck("intel", async () => {
      const { error } = await supabase.from("intel_briefings").select("id").limit(1);
      if (error) throw new Error(error.message);
      return true;
    }),
    runCheck("wiki-pages", async () => {
      const { error } = await supabase.from("wiki_pages").select("id").limit(1);
      if (error) throw new Error(error.message);
      return true;
    }),
  ]);

  const overall = checks.every(c => c.status === "ok")
    ? "ok"
    : checks.some(c => c.status === "down")
    ? "down"
    : "degraded";

  return new Response(
    JSON.stringify({
      status: overall,
      generated_at: new Date().toISOString(),
      duration_ms: Date.now() - start,
      checks,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
