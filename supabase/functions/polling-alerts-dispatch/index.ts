// Sends polling-alert emails for due subscriptions.
// Triggered by cron or manually via {force:true, subscription_id}.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let body: { force?: boolean; subscription_id?: string } = {};
  try { body = await req.json(); } catch {}

  let query = supabase.from("polling_alert_subscriptions").select("*").eq("enabled", true);
  if (body.subscription_id) query = query.eq("id", body.subscription_id);
  else query = query.lte("next_run_at", new Date().toISOString());

  const { data: subs, error } = await query;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];

  for (const sub of subs ?? []) {
    // Check user prefs
    const { data: prefs } = await supabase
      .from("email_notification_preferences")
      .select("*")
      .eq("user_id", sub.user_id)
      .maybeSingle();

    if (prefs && (!prefs.polling_alerts || prefs.digest_frequency === "off")) {
      results.push({ id: sub.id, skipped: "user_disabled" });
      continue;
    }

    // Pull recent polls matching scope
    const since = sub.last_sent_at ?? new Date(Date.now() - 7 * 86400000).toISOString();
    let pollQuery = supabase
      .from("polling_data")
      .select("*")
      .gte("created_at", since)
      .in("poll_type", sub.poll_types)
      .order("date_conducted", { ascending: false })
      .limit(20);

    const { data: polls } = await pollQuery;
    let filtered = polls ?? [];

    if (sub.scope === "state" && sub.scope_value) {
      filtered = filtered.filter((p: any) => p.raw_data?.state_abbr === sub.scope_value);
    } else if (sub.scope === "topic" && sub.scope_value) {
      filtered = filtered.filter((p: any) =>
        (p.candidate_or_topic ?? "").toLowerCase().includes(sub.scope_value.toLowerCase())
      );
    } else if (sub.scope === "candidate" && sub.scope_value) {
      filtered = filtered.filter((p: any) =>
        (p.candidate_or_topic ?? "").toLowerCase().includes(sub.scope_value.toLowerCase())
      );
    }

    // Margin threshold filter
    if (sub.min_margin_change && !body.force) {
      filtered = filtered.filter((p: any) => Math.abs(p.margin ?? 0) >= sub.min_margin_change);
    }

    if (filtered.length === 0 && !body.force) {
      // bump next_run_at without sending
      const next = new Date(Date.now() + cadenceMs(sub.cadence)).toISOString();
      await supabase.from("polling_alert_subscriptions")
        .update({ next_run_at: next }).eq("id", sub.id);
      results.push({ id: sub.id, skipped: "no_new_polls" });
      continue;
    }

    const summary = filtered.slice(0, 10).map((p: any) =>
      `• ${p.candidate_or_topic} (${p.source}): ${p.approve_pct ?? "?"}% approve / ${p.disapprove_pct ?? "?"}% disapprove · margin ${p.margin ?? "n/a"} · ${p.date_conducted}`
    ).join("\n");

    const subject = `Polling Alert: ${filtered.length} update${filtered.length === 1 ? "" : "s"}${sub.scope_value ? ` for ${sub.scope_value}` : ""}`;
    const bodyText = `New polling data matching your alert:\n\n${summary}\n\nView full polling data in the app.`;

    const idempotencyKey = `polling-alert-${sub.id}-${Date.now()}`;
    const sendResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-transactional-email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        templateName: "mail-notification",
        recipientEmail: sub.email,
        idempotencyKey,
        templateData: {
          senderName: "ORO Polling Alerts",
          mailSubject: subject,
          mailPreview: bodyText,
        },
      }),
    });

    const ok = sendResp.ok;
    const next = new Date(Date.now() + cadenceMs(sub.cadence)).toISOString();
    await supabase.from("polling_alert_subscriptions").update({
      last_sent_at: ok ? new Date().toISOString() : sub.last_sent_at,
      next_run_at: next,
    }).eq("id", sub.id);

    results.push({ id: sub.id, sent: ok, count: filtered.length });
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

function cadenceMs(c: string) {
  if (c === "daily") return 86400000;
  if (c === "weekly") return 7 * 86400000;
  return 3600000; // instant = recheck hourly
}
