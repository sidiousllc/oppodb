// Admin-only data export: activity logs + device locations
// Returns full denormalized records (with profile display_name) so the
// client can format CSV/PDF/embed-in-report blocks consistently.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RequestBody {
  kind: "activity" | "locations" | "both";
  user_id?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  limit?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate the calling user
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await authClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Role check via RPC has_role
    const { data: isAdminData, error: roleErr } = await authClient.rpc("has_role", {
      _user_id: userRes.user.id,
      _role: "admin",
    });
    if (roleErr || !isAdminData) {
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const { kind = "both", user_id, date_from, date_to } = body;
    const limit = Math.min(Math.max(body.limit ?? 5000, 1), 50000);

    // Service-role client for full data access
    const admin = createClient(supabaseUrl, serviceKey);

    const result: Record<string, unknown> = {};

    // Profiles map
    const { data: profiles } = await admin.from("profiles").select("id, display_name");
    const pmap: Record<string, string> = {};
    for (const p of profiles ?? []) {
      pmap[(p as any).id] = (p as any).display_name ?? "";
    }

    if (kind === "activity" || kind === "both") {
      let q = admin
        .from("user_activity_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (user_id) q = q.eq("user_id", user_id);
      if (date_from) q = q.gte("created_at", date_from);
      if (date_to) q = q.lte("created_at", date_to);
      const { data, error } = await q;
      if (error) throw error;
      result.activity = (data ?? []).map((row: any) => ({
        ...row,
        user_name: pmap[row.user_id] ?? row.user_id,
      }));
    }

    if (kind === "locations" || kind === "both") {
      let q = admin
        .from("device_locations")
        .select("id, device_id, user_id, latitude, longitude, accuracy, altitude, heading, speed, recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(limit);
      if (user_id) q = q.eq("user_id", user_id);
      if (date_from) q = q.gte("recorded_at", date_from);
      if (date_to) q = q.lte("recorded_at", date_to);
      const { data, error } = await q;
      if (error) throw error;
      result.locations = (data ?? []).map((row: any) => ({
        ...row,
        user_name: pmap[row.user_id] ?? row.user_id,
      }));
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("admin-data-export error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
