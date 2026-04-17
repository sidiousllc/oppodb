// Public endpoint called by the Android app to validate a serial key.
// No JWT required (verify_jwt is false by default for Lovable functions).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ valid: false, reason: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const serial = String(body.serial ?? "").trim();
    const deviceId = String(body.deviceId ?? body.device_id ?? "unknown").trim().slice(0, 128);

    if (!serial || serial.length < 6 || serial.length > 128) {
      return new Response(JSON.stringify({ valid: false, reason: "invalid_serial" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase.rpc("validate_app_serial", {
      p_serial: serial, p_device_id: deviceId,
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    return new Response(JSON.stringify({
      valid: !!row?.valid,
      reason: row?.reason ?? "unknown",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("validate-serial error", e);
    return new Response(JSON.stringify({ valid: false, reason: "server_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
