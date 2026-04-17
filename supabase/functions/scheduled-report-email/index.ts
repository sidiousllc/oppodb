// Scheduled report email worker.
// Two modes:
//   1. Cron-style sweep: POST {} → runs all schedules with next_run_at <= now()
//   2. Manual send: POST { schedule_id, force: true } → send a specific schedule immediately
//
// Renders a simple HTML report from blocks and dispatches via send-transactional-email.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Schedule {
  id: string;
  report_id: string;
  owner_id: string;
  cadence: string;
  recipients: string[];
  subject: string;
  enabled: boolean;
  next_run_at: string;
}

function nextRunFor(cadence: string, from = new Date()): string {
  const d = new Date(from);
  if (cadence === "daily") d.setUTCDate(d.getUTCDate() + 1);
  else if (cadence === "monthly") d.setUTCMonth(d.getUTCMonth() + 1);
  else d.setUTCDate(d.getUTCDate() + 7); // weekly default
  d.setUTCHours(13, 0, 0, 0); // standardize to 13:00 UTC
  return d.toISOString();
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function renderBlockHtml(block: any): string {
  switch (block.type) {
    case "heading": return `<h2 style="color:#0a3a8c;border-bottom:1px solid #ccc;padding-bottom:4px">${escapeHtml(block.text)}</h2>`;
    case "subheading": return `<h3>${escapeHtml(block.text)}</h3>`;
    case "text": return `<p style="white-space:pre-wrap">${escapeHtml(block.text)}</p>`;
    case "image": return `<figure><img src="${escapeHtml(block.url)}" alt="" style="max-width:100%;border:1px solid #ccc;border-radius:4px"/>${block.caption ? `<figcaption style="font-size:11px;color:#666;font-style:italic">${escapeHtml(block.caption)}</figcaption>` : ""}</figure>`;
    case "divider": return `<hr style="border:0;border-top:1px solid #ccc;margin:16px 0"/>`;
    case "page_break": return `<div style="margin:24px 0;border-top:1px dashed #aaa"></div>`;
    case "tabs": return (block.tabs ?? []).map((t: any) => `<details open><summary style="font-weight:bold;cursor:pointer">${escapeHtml(t.label)}</summary><div>${(t.blocks ?? []).map(renderBlockHtml).join("")}</div></details>`).join("");
    case "table": {
      const cols = block.columns ?? [];
      const rows = block.rows ?? [];
      return `<table style="border-collapse:collapse;width:100%;font-size:12px;border:1px solid #ccc">
        <thead><tr style="background:#eee">${cols.map((c: string) => `<th style="padding:4px 8px;border:1px solid #ccc;text-align:left">${escapeHtml(c)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((r: any[]) => `<tr>${cols.map((_: string, i: number) => `<td style="padding:4px 8px;border:1px solid #ccc">${escapeHtml(String(r[i] ?? ""))}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>${block.caption ? `<p style="font-size:11px;color:#666;font-style:italic">${escapeHtml(block.caption)}</p>` : ""}`;
    }
    case "chart": {
      // Email clients can't render JS charts, fall back to a value list.
      const series = block.series?.length ? block.series : ["value"];
      return `<div style="border:1px solid #ccc;padding:8px;border-radius:4px"><strong>📈 Chart (${block.chartType})</strong><br>${(block.data ?? []).map((row: any) => `${escapeHtml(Object.values(row)[0] as string)}: ${series.map((k: string) => `<strong>${escapeHtml(String(row[k] ?? ""))}</strong>`).join(" / ")}`).join("<br>")}</div>`;
    }
    case "map":
      return `<div style="border:1px solid #ccc;padding:8px;border-radius:4px"><strong>🗺️ Map</strong>: ${block.mode === "districts" ? (block.districts ?? []).join(", ") : `${(block.points ?? []).length} points`}</div>`;
    default: {
      const snap = block.snapshot;
      const title = block.title ?? `${block.type} — ${block.refId ?? ""}`;
      return `<div style="border-left:3px solid #0a3a8c;padding-left:8px;margin:8px 0"><strong>${escapeHtml(title)}</strong>${snap ? `<pre style="font-size:10px;background:#f4f4f4;padding:6px;overflow:auto;max-height:200px">${escapeHtml(JSON.stringify(snap, null, 2).slice(0, 2000))}</pre>` : ""}</div>`;
    }
  }
}

function renderReportHtml(report: any, publicUrl: string): string {
  const blocks = (report.blocks ?? []).map(renderBlockHtml).join("");
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:720px;margin:0 auto;padding:24px;color:#222">
    <h1 style="color:#0a3a8c">${escapeHtml(report.title)}</h1>
    ${report.description ? `<p style="color:#666;font-style:italic;border-left:3px solid #0a3a8c;padding-left:12px">${escapeHtml(report.description)}</p>` : ""}
    ${blocks}
    <hr style="margin-top:32px"/>
    <p style="font-size:11px;color:#888">
      View live report: <a href="${publicUrl}">${publicUrl}</a><br>
      Generated ${new Date().toUTCString()} by ORO — Opposition Research Database
    </p>
  </body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const force: boolean = !!body.force;
    const scheduleId: string | undefined = body.schedule_id;

    let q = admin.from("report_schedules").select("*").eq("enabled", true);
    if (scheduleId) q = q.eq("id", scheduleId);
    else q = q.lte("next_run_at", new Date().toISOString());

    const { data: schedules, error } = await q;
    if (error) throw error;

    const results: any[] = [];

    for (const s of (schedules ?? []) as Schedule[]) {
      try {
        const { data: report } = await admin.from("reports").select("*").eq("id", s.report_id).maybeSingle();
        if (!report) { results.push({ id: s.id, status: "report-missing" }); continue; }

        const publicUrl = `https://ordb.lovable.app/r/${s.report_id}`;
        const html = renderReportHtml(report, publicUrl);
        const subject = s.subject || `${(report as any).title} — automated update`;

        // Send to each recipient via send-transactional-email
        for (const to of s.recipients) {
          try {
            await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                to,
                subject,
                html,
                template_name: "scheduled-report",
                metadata: { schedule_id: s.id, report_id: s.report_id },
              }),
            });
          } catch (sendErr) {
            console.error("send error", to, sendErr);
          }
        }

        // Update schedule
        const next = force ? s.next_run_at : nextRunFor(s.cadence);
        await admin.from("report_schedules").update({
          last_sent_at: new Date().toISOString(),
          next_run_at: next,
        }).eq("id", s.id);

        results.push({ id: s.id, status: "sent", recipients: s.recipients.length });
      } catch (e) {
        console.error("schedule error", s.id, e);
        results.push({ id: s.id, status: "error", error: String(e) });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("scheduled-report-email error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
