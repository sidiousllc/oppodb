import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Pull recent activity (last 15 minutes)
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: activities } = await admin
      .from("entity_activity")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);

    if (!activities || activities.length === 0) {
      return new Response(JSON.stringify({ dispatched: 0, message: "No new activity" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: rules } = await admin
      .from("alert_rules")
      .select("*, webhook_endpoints(*)")
      .eq("enabled", true);

    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ dispatched: 0, message: "No active rules" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let dispatched = 0;
    for (const rule of rules) {
      const matches = activities.filter((a: any) => {
        if (rule.entity_type && rule.entity_type !== "global" && a.entity_type !== rule.entity_type) return false;
        if (rule.entity_id && a.entity_id !== rule.entity_id) return false;
        if (rule.event_types?.length && !rule.event_types.includes(a.event_type)) return false;
        if (rule.keywords?.length && !rule.keywords.some((k: string) => a.summary.toLowerCase().includes(k.toLowerCase()))) return false;
        return true;
      });
      if (matches.length === 0) continue;

      // Cap to 5 newest matches per rule
      const top = matches.slice(0, 5);
      const summary = `${top.length} match${top.length > 1 ? "es" : ""} for "${rule.name}"`;

      for (const channel of rule.channels || ["in_app"]) {
        try {
          if (channel === "in_app") {
            await admin.from("notifications").insert({
              user_id: rule.user_id,
              category: "alert",
              title: summary,
              body: top.map((m: any) => `• ${m.summary}`).join("\n"),
              metadata: { rule_id: rule.id, matches: top },
            });
            await admin.from("alert_dispatch_log").insert({ alert_rule_id: rule.id, user_id: rule.user_id, channel: "in_app", status: "sent", payload: { matches: top.length } });
            dispatched++;
          } else if (channel === "webhook" && rule.webhook_endpoints) {
            const wh = rule.webhook_endpoints as any;
            if (wh.enabled && wh.url) {
              const body = wh.channel === "slack" || wh.channel === "discord"
                ? { text: `🔔 ${summary}\n${top.map((m: any) => `• ${m.summary}`).join("\n")}`, content: `🔔 ${summary}\n${top.map((m: any) => `• ${m.summary}`).join("\n")}` }
                : { rule: rule.name, matches: top };
              const resp = await fetch(wh.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
              await admin.from("alert_dispatch_log").insert({ alert_rule_id: rule.id, user_id: rule.user_id, channel: "webhook", status: resp.ok ? "sent" : "failed", payload: { matches: top.length, http: resp.status } });
              if (resp.ok) dispatched++;
            }
          }
        } catch (e) {
          console.error("dispatch error", e);
          await admin.from("alert_dispatch_log").insert({ alert_rule_id: rule.id, user_id: rule.user_id, channel, status: "failed", error: String(e) });
        }
      }

      await admin.from("alert_rules").update({
        last_triggered_at: new Date().toISOString(),
        trigger_count: (rule.trigger_count || 0) + 1,
      }).eq("id", rule.id);
    }

    return new Response(JSON.stringify({ dispatched, scanned: activities.length, rules: rules.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
