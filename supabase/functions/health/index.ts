import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type CheckStatus = "ok" | "degraded" | "down";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
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

  const start = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const checks: Array<{
      component: string;
      status: CheckStatus;
      latency_ms: number;
      detail?: string;
    }> = [];

    const runCheck = async (name: string, fn: () => Promise<boolean>) => {
      const t0 = Date.now();
      try {
        const ok = await fn();
        checks.push({ component: name, status: ok ? "ok" : "down", latency_ms: Date.now() - t0 });
      } catch (err) {
        checks.push({
          component: name,
          status: "down",
          latency_ms: Date.now() - t0,
          detail: String(err),
        });
      }
    };

    await runCheck("database", async () => {
      const { error } = await supabase.from("user_devices").select("id").limit(1);
      if (error) throw error;
      return true;
    });

    const overall: CheckStatus =
      checks.every((c) => c.status === "ok")
        ? "ok"
        : checks.some((c) => c.status === "down")
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
  } catch (err) {
    return new Response(
      JSON.stringify({
        status: "down",
        generated_at: new Date().toISOString(),
        duration_ms: Date.now() - start,
        checks: [{ component: "health-function", status: "down", latency_ms: Date.now() - start, detail: String(err) }],
      }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
