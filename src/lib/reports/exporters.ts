// PDF + CSV export for Reports.
// Renders headings, content, data snapshots (with pretty key/value layouts),
// charts (as bitmap snapshots via html2canvas), tables (via jspdf-autotable),
// maps (district chips / point lists), and admin data.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { applyPdfBranding } from "@/lib/pdfBranding";
import type { Report, ReportBlock } from "./types";

const M = 14;   // page margin
const LH = 5;   // line height

function ensureSpace(doc: jsPDF, y: number, needed = 10): number {
  if (y + needed > doc.internal.pageSize.height - 14) {
    doc.addPage();
    return 18;
  }
  return y;
}

function writeText(doc: jsPDF, text: string, y: number, opts?: { size?: number; bold?: boolean; color?: [number, number, number]; italic?: boolean }): number {
  const size = opts?.size ?? 10;
  doc.setFontSize(size);
  const style = opts?.bold && opts?.italic ? "bolditalic" : opts?.bold ? "bold" : opts?.italic ? "italic" : "normal";
  doc.setFont("helvetica", style);
  if (opts?.color) doc.setTextColor(...opts.color);
  else doc.setTextColor(20, 20, 20);
  const pageWidth = doc.internal.pageSize.width - M * 2;
  const lines = doc.splitTextToSize(String(text ?? ""), pageWidth);
  for (const line of lines) {
    y = ensureSpace(doc, y, LH);
    doc.text(line, M, y);
    y += LH;
  }
  return y + 1;
}

function fmtNum(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return v.toLocaleString();
  return String(v);
}
function fmtPct(v: unknown): string {
  if (typeof v === "number") return `${v.toFixed(1)}%`;
  return v == null ? "—" : String(v);
}
function fmtMoney(v: unknown): string {
  if (typeof v === "number") return `$${v.toLocaleString()}`;
  return v == null ? "—" : String(v);
}
function fmtDate(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString();
}

/** Render a 2-column key/value mini-table with autotable. */
function kvTable(doc: jsPDF, rows: Array<[string, string]>, y: number): number {
  if (rows.length === 0) return y;
  autoTable(doc, {
    startY: y,
    head: [],
    body: rows,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1.2, textColor: [30, 30, 30] },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50, textColor: [80, 80, 80] },
      1: { cellWidth: "auto" },
    },
    margin: { left: M, right: M },
  });
  // @ts-ignore
  return (doc.lastAutoTable?.finalY ?? y) + 3;
}

/** Render a labeled section header. */
function sectionTitle(doc: jsPDF, text: string, y: number, color: [number, number, number] = [0, 80, 0]): number {
  y = ensureSpace(doc, y, 10);
  return writeText(doc, text, y, { size: 12, bold: true, color });
}

// ─── Chart rendering: snapshot the rendered DOM via html2canvas ────────────────

async function renderChartToImage(block: any): Promise<string | null> {
  try {
    // Find the chart in the DOM — match by recharts surface inside the report builder canvas
    // Look for any data attribute we can target; fallback to first matching block id
    const sel = `[data-report-block-id="${block.id}"] .recharts-surface`;
    const node = document.querySelector(sel) as HTMLElement | null;
    if (!node) return null;
    const canvas = await html2canvas(node, { backgroundColor: "#ffffff", scale: 2, logging: false });
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

async function renderBlock(doc: jsPDF, block: ReportBlock, y: number, depth = 0): Promise<number> {
  switch (block.type) {
    case "heading":
      y = ensureSpace(doc, y, 12);
      return writeText(doc, block.text, y, { size: 16, bold: true, color: [0, 0, 128] });
    case "subheading":
      y = ensureSpace(doc, y, 10);
      return writeText(doc, block.text, y, { size: 13, bold: true });
    case "text":
      return writeText(doc, block.text, y);
    case "image":
      try {
        y = ensureSpace(doc, y, 60);
        doc.addImage(block.url, "JPEG", M, y, 80, 50, undefined, "FAST");
        y += 54;
        if (block.caption) y = writeText(doc, block.caption, y, { size: 8, color: [100, 100, 100] });
        return y;
      } catch {
        return writeText(doc, `[Image: ${block.url}]`, y, { size: 8 });
      }
    case "divider": {
      y = ensureSpace(doc, y, 4);
      doc.setDrawColor(180, 180, 180);
      doc.line(M, y, doc.internal.pageSize.width - M, y);
      return y + 4;
    }
    case "page_break":
      doc.addPage();
      return 18;
    case "tabs": {
      for (const tab of block.tabs) {
        y = writeText(doc, `▶ ${tab.label}`, y, { size: 12, bold: true, color: [60, 60, 120] });
        for (const b of tab.blocks) y = await renderBlock(doc, b, y, depth + 1);
      }
      return y;
    }

    case "chart": {
      y = sectionTitle(doc, block.title ?? "Chart", y, [60, 60, 120]);
      const img = await renderChartToImage(block);
      if (img) {
        try {
          y = ensureSpace(doc, y, 95);
          doc.addImage(img, "PNG", M, y, 180, 90, undefined, "FAST");
          y += 94;
        } catch {
          /* ignore */
        }
      } else {
        // Fallback: render data as a small table
        const series = (block.series && block.series.length ? block.series : ["value"]) as string[];
        const labelKey = Object.keys(block.data[0] ?? {}).find((k) => typeof (block.data[0] as any)[k] === "string") ?? "label";
        autoTable(doc, {
          startY: y,
          head: [[labelKey, ...series]],
          body: block.data.map((row: any) => [String(row[labelKey] ?? ""), ...series.map((k) => fmtNum(row[k]))]),
          styles: { fontSize: 8 },
          margin: { left: M, right: M },
          headStyles: { fillColor: [60, 60, 120] },
        });
        // @ts-ignore
        y = (doc.lastAutoTable?.finalY ?? y) + 3;
      }
      if (block.caption) y = writeText(doc, block.caption, y, { size: 8, italic: true, color: [120, 120, 120] });
      return y;
    }

    case "table": {
      y = sectionTitle(doc, block.title ?? "Table", y, [60, 60, 120]);
      autoTable(doc, {
        startY: y,
        head: [block.columns],
        body: block.rows.map((r) => r.map((c) => String(c ?? ""))),
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [60, 60, 120] },
        margin: { left: M, right: M },
      });
      // @ts-ignore
      y = (doc.lastAutoTable?.finalY ?? y) + 3;
      if (block.caption) y = writeText(doc, block.caption, y, { size: 8, italic: true, color: [120, 120, 120] });
      return y;
    }

    case "map": {
      y = sectionTitle(doc, block.title ?? "Map", y, [60, 60, 120]);
      if (block.mode === "districts" && block.districts?.length) {
        y = writeText(doc, `Highlighted districts (${block.districts.length}):`, y, { size: 9, bold: true });
        y = writeText(doc, block.districts.join(", "), y, { size: 9 });
      } else if (block.mode === "points" && block.points?.length) {
        autoTable(doc, {
          startY: y,
          head: [["Label", "Latitude", "Longitude"]],
          body: block.points.map((p) => [p.label ?? "", p.lat.toFixed(5), p.lng.toFixed(5)]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [60, 60, 120] },
          margin: { left: M, right: M },
        });
        // @ts-ignore
        y = (doc.lastAutoTable?.finalY ?? y) + 3;
      } else {
        y = writeText(doc, "(no map data)", y, { size: 8, italic: true, color: [120, 120, 120] });
      }
      if (block.caption) y = writeText(doc, block.caption, y, { size: 8, italic: true, color: [120, 120, 120] });
      return y;
    }

    // ─── Data snapshots — pretty layouts ───────────────────────────────────

    case "candidate": {
      const s = (block as any).snapshot ?? {};
      y = sectionTitle(doc, block.title ?? `👤 ${s.name ?? block.refId}`, y);
      y = kvTable(doc, [
        ["Slug", s.slug ?? block.refId],
        ["Tags", Array.isArray(s.tags) ? s.tags.join(", ") : "—"],
      ], y);
      if (s.content) y = writeText(doc, String(s.content).slice(0, 4000), y, { size: 9 });
      return y;
    }

    case "research": {
      const s = (block as any).snapshot ?? {};
      y = sectionTitle(doc, block.title ?? `🔍 ${s.subpage_title ?? s.name ?? block.refId}`, y);
      y = kvTable(doc, [
        ["Parent", s.parent_slug ?? "—"],
        ["Subpage", s.subpage_title ?? s.slug ?? "—"],
      ], y);
      if (s.content) y = writeText(doc, String(s.content).slice(0, 6000), y, { size: 9 });
      return y;
    }

    case "district": {
      const s = (block as any).snapshot ?? {};
      y = sectionTitle(doc, block.title ?? `🗺️ ${s.district_id ?? block.refId}`, y);
      y = kvTable(doc, [
        ["State", s.state ?? "—"],
        ["Population", fmtNum(s.population)],
        ["Median income", fmtMoney(s.median_income)],
        ["Median age", fmtNum(s.median_age)],
        ["Bachelor+ %", fmtPct(s.education_bachelor_pct)],
        ["White / Black / Hispanic / Asian", `${fmtPct(s.white_pct)} / ${fmtPct(s.black_pct)} / ${fmtPct(s.hispanic_pct)} / ${fmtPct(s.asian_pct)}`],
        ["Unemployment", fmtPct(s.unemployment_rate)],
        ["Poverty rate", fmtPct(s.poverty_rate)],
        ["Top issues", Array.isArray(s.top_issues) ? s.top_issues.join(", ") : "—"],
      ], y);
      return y;
    }

    case "intel": {
      y = sectionTitle(doc, block.title ?? `🕵️ Intel — ${block.refId}`, y);
      const items = ((block as any).snapshot?.items ?? []) as Array<any>;
      for (const it of items.slice(0, 15)) {
        y = writeText(doc, `• ${it.title}`, y, { size: 9, bold: true });
        y = writeText(doc, `  ${it.source_name}${it.published_at ? " — " + new Date(it.published_at).toLocaleDateString() : ""}`, y, { size: 8, color: [100, 100, 100] });
        if (it.summary) y = writeText(doc, "  " + it.summary, y, { size: 8 });
      }
      return y;
    }

    case "polling": {
      const s = (block as any).snapshot ?? {};
      y = sectionTitle(doc, block.title ?? `📊 Poll — ${s.pollster ?? block.refId}`, y);
      y = kvTable(doc, [
        ["Pollster", s.pollster ?? "—"],
        ["Question", s.question ?? s.topic ?? "—"],
        ["State / District", `${s.state ?? "—"} / ${s.district ?? "—"}`],
        ["Date", fmtDate(s.poll_date ?? s.end_date)],
        ["Sample size", fmtNum(s.sample_size)],
        ["Margin of error", s.margin_of_error != null ? `±${s.margin_of_error}` : "—"],
        ["Approve / Disapprove", `${fmtPct(s.approve_pct)} / ${fmtPct(s.disapprove_pct)}`],
      ], y);
      return y;
    }

    case "finance": {
      const s = (block as any).snapshot ?? {};
      y = sectionTitle(doc, block.title ?? `💰 ${s.candidate_name ?? block.refId} — Cycle ${s.cycle ?? ""}`, y);
      y = kvTable(doc, [
        ["Office", s.office ?? "—"],
        ["State / District", `${s.state_abbr ?? "—"} / ${s.district ?? "—"}`],
        ["Total raised", fmtMoney(s.total_raised)],
        ["Total spent", fmtMoney(s.total_spent)],
        ["Cash on hand", fmtMoney(s.cash_on_hand)],
        ["Total debt", fmtMoney(s.total_debt)],
        ["Individual contributions", fmtMoney(s.individual_contributions)],
        ["PAC contributions", fmtMoney(s.pac_contributions)],
        ["Self-funding", fmtMoney(s.self_funding)],
        ["Small dollar %", fmtPct(s.small_dollar_pct)],
        ["Large donor %", fmtPct(s.large_donor_pct)],
        ["Out-of-state %", fmtPct(s.out_of_state_pct)],
        ["Source", `${s.source ?? "—"}${s.filing_date ? " (" + fmtDate(s.filing_date) + ")" : ""}`],
      ], y);
      return y;
    }

    case "election": {
      y = sectionTitle(doc, block.title ?? `🗳️ Election — ${block.refId}`, y);
      const items = ((block as any).snapshot?.items ?? []) as Array<any>;
      autoTable(doc, {
        startY: y,
        head: [["Year", "Type", "Candidate", "Party", "Votes", "Pct", "Winner"]],
        body: items.map((it) => [
          fmtNum(it.election_year),
          it.election_type ?? "—",
          it.candidate_name ?? "—",
          it.party ?? "—",
          fmtNum(it.votes),
          fmtPct(it.vote_pct),
          it.is_winner ? "★" : "",
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 80, 0] },
        margin: { left: M, right: M },
      });
      // @ts-ignore
      return (doc.lastAutoTable?.finalY ?? y) + 3;
    }

    case "international": {
      const s = (block as any).snapshot ?? {};
      y = sectionTitle(doc, block.title ?? `🌐 ${s.country_name ?? block.refId}`, y);
      y = kvTable(doc, [
        ["Code", s.country_code ?? "—"],
        ["Capital", s.capital ?? "—"],
        ["Population", fmtNum(s.population)],
        ["GDP", fmtMoney(s.gdp)],
        ["GDP per capita", fmtMoney(s.gdp_per_capita)],
        ["Head of state", s.head_of_state ?? "—"],
        ["Head of government", s.head_of_government ?? "—"],
        ["Ruling party", s.ruling_party ?? "—"],
        ["Last election", fmtDate(s.last_election_date)],
        ["Next election", fmtDate(s.next_election_date)],
      ], y);
      return y;
    }

    case "legislation": {
      const s = (block as any).snapshot ?? {};
      y = sectionTitle(doc, block.title ?? `⚖️ ${s.short_title ?? s.bill_id ?? block.refId}`, y);
      y = kvTable(doc, [
        ["Bill ID", s.bill_id ?? block.refId],
        ["Title", s.title ?? "—"],
        ["Sponsor", s.sponsor_name ?? "—"],
        ["Status", s.status ?? "—"],
        ["Latest action", `${s.latest_action_text ?? "—"}${s.latest_action_date ? " (" + fmtDate(s.latest_action_date) + ")" : ""}`],
      ], y);
      return y;
    }

    case "messaging": {
      y = sectionTitle(doc, block.title ?? `📢 Messaging — ${block.refId}`, y);
      const s = (block as any).snapshot ?? {};
      return writeText(doc, JSON.stringify(s, null, 2).slice(0, 1500), y, { size: 8 });
    }

    // ─── New intelligence blocks ──────────────────────────────────────────

    case "talking_points": {
      y = sectionTitle(doc, block.title ?? `🗣️ Talking Points — ${block.refId}`, y);
      const items = ((block as any).snapshot?.items ?? []) as Array<any>;
      if (items.length === 0) return writeText(doc, "(no cached talking points)", y, { size: 8, italic: true, color: [120, 120, 120] });
      for (const tp of items) {
        y = writeText(doc, `${tp.audience} / ${tp.angle} — ${fmtDate(tp.created_at)}`, y, { size: 10, bold: true });
        const points = Array.isArray(tp.points) ? tp.points : [];
        for (const [i, p] of points.entries()) {
          y = writeText(doc, `${i + 1}. ${p.message ?? ""}`, y, { size: 9, bold: true });
          if (p.rationale) y = writeText(doc, `   Why: ${p.rationale}`, y, { size: 8 });
          if (p.delivery_tips) y = writeText(doc, `   Tip: ${p.delivery_tips}`, y, { size: 8, italic: true, color: [100, 100, 100] });
        }
        const ev = Array.isArray(tp.evidence) ? tp.evidence : [];
        if (ev.length) {
          y = writeText(doc, "Evidence:", y, { size: 9, bold: true });
          for (const e of ev) y = writeText(doc, `  • ${e.claim}${e.source_hint ? " — " + e.source_hint : ""}`, y, { size: 8 });
        }
        y += 2;
      }
      return y;
    }

    case "vulnerability": {
      const s = (block as any).snapshot ?? {};
      y = sectionTitle(doc, block.title ?? `🛡️ Vulnerability — ${s.candidate_name ?? block.refId}`, y, [120, 0, 0]);
      y = kvTable(doc, [
        ["Overall score", s.overall_score != null ? `${s.overall_score}/100` : "—"],
        ["Tier", s.tier ?? "—"],
        ["Generated", fmtDate(s.generated_at)],
      ], y);
      const factors = (s.factors ?? s.dimensions ?? {}) as Record<string, unknown>;
      if (factors && typeof factors === "object") {
        const rows = Object.entries(factors).map(([k, v]): [string, string] => [k, typeof v === "object" ? JSON.stringify(v) : String(v)]);
        if (rows.length) y = kvTable(doc, rows, y);
      }
      if (s.summary) y = writeText(doc, s.summary, y, { size: 9 });
      return y;
    }

    case "bill_impact": {
      const s = (block as any).snapshot ?? {};
      y = sectionTitle(doc, block.title ?? `🧠 Bill Impact — ${s.bill_id ?? block.refId}`, y);
      y = kvTable(doc, [
        ["Scope", `${s.scope ?? "—"}${s.scope_ref ? " (" + s.scope_ref + ")" : ""}`],
        ["Generated", fmtDate(s.generated_at)],
      ], y);
      if (s.summary) { y = writeText(doc, "Summary:", y, { size: 10, bold: true }); y = writeText(doc, s.summary, y, { size: 9 }); }
      if (s.fiscal_impact) { y = writeText(doc, "Fiscal Impact:", y, { size: 10, bold: true }); y = writeText(doc, s.fiscal_impact, y, { size: 9 }); }
      if (s.political_impact) { y = writeText(doc, "Political Impact:", y, { size: 10, bold: true }); y = writeText(doc, s.political_impact, y, { size: 9 }); }
      const winners = Array.isArray(s.winners) ? s.winners : [];
      const losers = Array.isArray(s.losers) ? s.losers : [];
      if (winners.length) { y = writeText(doc, `Winners: ${winners.map((w: any) => typeof w === "string" ? w : (w.group ?? w.name ?? JSON.stringify(w))).join(", ")}`, y, { size: 9, color: [0, 100, 0] }); }
      if (losers.length) { y = writeText(doc, `Losers: ${losers.map((w: any) => typeof w === "string" ? w : (w.group ?? w.name ?? JSON.stringify(w))).join(", ")}`, y, { size: 9, color: [120, 0, 0] }); }
      return y;
    }

    case "forecast": {
      y = sectionTitle(doc, block.title ?? `🎲 Forecast — ${block.refId}`, y);
      const items = ((block as any).snapshot?.items ?? []) as Array<any>;
      if (items.length === 0) return writeText(doc, "(no forecast data)", y, { size: 8, italic: true, color: [120, 120, 120] });
      autoTable(doc, {
        startY: y,
        head: [["Source", "Race", "State/Dist", "Cycle", "Rating", "Dem win%", "Rep win%", "Margin", "Updated"]],
        body: items.map((it) => [
          it.source ?? "—",
          it.race_type ?? "—",
          `${it.state_abbr ?? ""}${it.district ? "-" + it.district : ""}`,
          fmtNum(it.cycle),
          it.rating ?? "—",
          fmtPct(it.dem_win_prob != null ? it.dem_win_prob * 100 : null),
          fmtPct(it.rep_win_prob != null ? it.rep_win_prob * 100 : null),
          it.margin != null ? `${it.margin > 0 ? "D+" : "R+"}${Math.abs(it.margin).toFixed(1)}` : "—",
          fmtDate(it.last_updated),
        ]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [40, 40, 120] },
        margin: { left: M, right: M },
      });
      // @ts-ignore
      return (doc.lastAutoTable?.finalY ?? y) + 3;
    }

    case "prediction_market": {
      const s = (block as any).snapshot ?? {};
      y = sectionTitle(doc, block.title ?? `📉 Market — ${s.title ?? s.question ?? block.refId}`, y);
      y = kvTable(doc, [
        ["Platform", s.platform ?? "—"],
        ["Question", s.question ?? s.title ?? "—"],
        ["Yes price", s.yes_price != null ? `${(s.yes_price * 100).toFixed(1)}¢` : "—"],
        ["No price", s.no_price != null ? `${(s.no_price * 100).toFixed(1)}¢` : "—"],
        ["Volume", fmtMoney(s.volume)],
        ["Liquidity", fmtMoney(s.liquidity)],
        ["End date", fmtDate(s.end_date)],
        ["Status", s.status ?? "—"],
      ], y);
      return y;
    }

    case "investigations": {
      const s = (block as any).snapshot ?? {};
      y = sectionTitle(doc, block.title ?? `🔎 Investigations — ${block.refId}`, y, [120, 0, 0]);

      const sections: Array<[string, any[], string[][]]> = [
        ["Court Cases", s.court_cases ?? [], (s.court_cases ?? []).map((r: any) => [r.case_name ?? "", r.case_number ?? "", r.court ?? "", fmtDate(r.filed_date), r.status ?? ""])],
        ["IG Reports", s.ig_reports ?? [], (s.ig_reports ?? []).map((r: any) => [r.title ?? "", r.agency_name ?? "", fmtDate(r.published_on), (r.summary ?? "").slice(0, 80)])],
        ["FARA Registrants", s.fara ?? [], (s.fara ?? []).map((r: any) => [r.registrant_name ?? "", r.country ?? "", fmtDate(r.registration_date), r.status ?? ""])],
        ["Federal Spending", s.spending ?? [], (s.spending ?? []).map((r: any) => [r.recipient_name ?? "", r.awarding_agency ?? "", fmtMoney(r.total_obligation), fmtNum(r.fiscal_year), r.recipient_state ?? ""])],
        ["Government Contracts", s.contracts ?? [], (s.contracts ?? []).map((r: any) => [r.recipient_name ?? "", r.awarding_agency ?? "", fmtMoney(r.award_amount), fmtNum(r.fiscal_year), r.recipient_state ?? ""])],
      ];
      const heads: Record<string, string[]> = {
        "Court Cases": ["Case", "Number", "Court", "Filed", "Status"],
        "IG Reports": ["Title", "Agency", "Published", "Summary"],
        "FARA Registrants": ["Registrant", "Country", "Registered", "Status"],
        "Federal Spending": ["Recipient", "Agency", "Obligation", "FY", "State"],
        "Government Contracts": ["Recipient", "Agency", "Amount", "FY", "State"],
      };
      for (const [label, rows, body] of sections) {
        if (!rows || rows.length === 0) continue;
        y = writeText(doc, `${label} (${rows.length})`, y, { size: 10, bold: true, color: [120, 0, 0] });
        autoTable(doc, {
          startY: y,
          head: [heads[label]],
          body,
          styles: { fontSize: 7, cellPadding: 1 },
          headStyles: { fillColor: [120, 0, 0] },
          margin: { left: M, right: M },
        });
        // @ts-ignore
        y = (doc.lastAutoTable?.finalY ?? y) + 3;
      }
      return y;
    }

    case "war_room": {
      const s = (block as any).snapshot ?? {};
      const room = s.room ?? {};
      y = sectionTitle(doc, block.title ?? `⚔️ War Room — ${room.name ?? block.refId}`, y);
      y = kvTable(doc, [
        ["Name", room.name ?? "—"],
        ["Description", room.description ?? "—"],
        ["Created", fmtDate(room.created_at)],
        ["Members", String((s.members ?? []).length)],
      ], y);
      const members = (s.members ?? []) as any[];
      if (members.length) {
        autoTable(doc, {
          startY: y,
          head: [["Member", "Role", "Added"]],
          body: members.map((m: any) => [m.display_name ?? m.user_id?.slice(0, 8) ?? "—", m.role ?? "—", fmtDate(m.added_at)]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [60, 60, 120] },
          margin: { left: M, right: M },
        });
        // @ts-ignore
        y = (doc.lastAutoTable?.finalY ?? y) + 3;
      }
      const msgs = (s.recent_messages ?? []) as any[];
      if (msgs.length) {
        y = writeText(doc, `Recent messages (${msgs.length})`, y, { size: 10, bold: true });
        for (const m of msgs.slice(0, 25)) {
          y = writeText(doc, `[${fmtDate(m.created_at)}] ${(m.content ?? "").slice(0, 200)}`, y, { size: 8 });
        }
      }
      return y;
    }

    case "entity_graph": {
      const s = (block as any).snapshot ?? {};
      y = sectionTitle(doc, block.title ?? `🕸️ Entity Graph — ${s.root ?? block.refId}`, y);
      const items = (s.items ?? []) as any[];
      if (items.length === 0) return writeText(doc, "(no relationships)", y, { size: 8, italic: true, color: [120, 120, 120] });
      autoTable(doc, {
        startY: y,
        head: [["Source", "Type", "Relationship", "Target", "Type", "Amount", "Weight"]],
        body: items.map((it: any) => [
          it.source_label ?? "—",
          it.source_type ?? "—",
          it.relationship_type ?? "—",
          it.target_label ?? "—",
          it.target_type ?? "—",
          it.amount != null ? fmtMoney(it.amount) : "—",
          it.weight != null ? String(it.weight) : "—",
        ]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [80, 60, 120] },
        margin: { left: M, right: M },
      });
      // @ts-ignore
      return (doc.lastAutoTable?.finalY ?? y) + 3;
    }

    case "admin_activity": {
      y = sectionTitle(doc, block.title ?? "Activity Logs", y, [120, 0, 0]);
      const rows = ((block as any).snapshot?.rows ?? []) as Array<any>;
      autoTable(doc, {
        startY: y,
        head: [["When", "User", "Activity", "Details"]],
        body: rows.slice(0, 200).map((r) => [
          fmtDate(r.created_at) + " " + new Date(r.created_at).toLocaleTimeString(),
          r.user_name ?? r.user_id ?? "—",
          r.activity_type ?? "—",
          r.details ? JSON.stringify(r.details).slice(0, 120) : "",
        ]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [120, 0, 0] },
        margin: { left: M, right: M },
      });
      // @ts-ignore
      return (doc.lastAutoTable?.finalY ?? y) + 3;
    }

    case "admin_locations": {
      y = sectionTitle(doc, block.title ?? "Location History", y, [120, 0, 0]);
      const rows = ((block as any).snapshot?.rows ?? []) as Array<any>;
      const mapImg = (block as any).snapshot?.mapImage as string | undefined;
      if (mapImg) {
        try {
          y = ensureSpace(doc, y, 110);
          doc.addImage(mapImg, "PNG", M, y, 180, 100, undefined, "FAST");
          y += 104;
        } catch { /* ignore */ }
      }
      autoTable(doc, {
        startY: y,
        head: [["When", "User", "Lat", "Lng", "Acc"]],
        body: rows.slice(0, 200).map((r) => [
          fmtDate(r.recorded_at) + " " + new Date(r.recorded_at).toLocaleTimeString(),
          r.user_name ?? r.user_id ?? "—",
          r.latitude?.toFixed?.(5) ?? "—",
          r.longitude?.toFixed?.(5) ?? "—",
          r.accuracy ? `±${Math.round(r.accuracy)}m` : "—",
        ]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [120, 0, 0] },
        margin: { left: M, right: M },
      });
      // @ts-ignore
      return (doc.lastAutoTable?.finalY ?? y) + 3;
    }

    case "api_data":
    case "mcp_data": {
      y = writeText(doc, block.title ?? `${block.type} — ${(block as any).endpoint ?? (block as any).toolName}`, y, { size: 11, bold: true, color: [60, 60, 120] });
      const json = JSON.stringify((block as any).snapshot ?? {}, null, 2);
      return writeText(doc, json.length > 2500 ? json.slice(0, 2500) + "\n…(truncated)" : json, y, { size: 7 });
    }
    default:
      return y;
  }
}

export async function exportReportPdf(report: Report) {
  const doc = new jsPDF();
  let y = 20;
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(report.title, M, y);
  y += 8;
  if (report.description) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(80, 80, 80);
    const lines = doc.splitTextToSize(report.description, doc.internal.pageSize.width - M * 2);
    for (const l of lines) { doc.text(l, M, y); y += 5; }
  }
  doc.setDrawColor(180, 180, 180);
  doc.line(M, y, doc.internal.pageSize.width - M, y);
  y += 6;

  for (const block of report.blocks) {
    y = await renderBlock(doc, block, y);
  }

  applyPdfBranding(doc);
  doc.save(`${report.title.replace(/[^a-z0-9]+/gi, "_")}_report.pdf`);
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportReportCsv(report: Report) {
  const lines: string[] = [];
  lines.push(["Block Type", "Title", "Field", "Value"].map(csvEscape).join(","));

  const walk = (block: ReportBlock, prefix = "") => {
    const title = block.title ?? "";
    if (block.type === "tabs") {
      for (const t of block.tabs) for (const b of t.blocks) walk(b, `${prefix}${t.label} > `);
      return;
    }
    if ("text" in block) {
      lines.push([block.type, prefix + title, "text", (block as any).text].map(csvEscape).join(","));
      return;
    }
    if (block.type === "image") {
      lines.push([block.type, prefix + title, "url", block.url].map(csvEscape).join(","));
      return;
    }
    if (block.type === "table") {
      lines.push([block.type, prefix + title, "columns", block.columns.join(" | ")].map(csvEscape).join(","));
      for (const [ri, row] of block.rows.entries()) {
        for (const [ci, val] of row.entries()) {
          lines.push([block.type, prefix + title, `row${ri + 1}.${block.columns[ci] ?? ci}`, val].map(csvEscape).join(","));
        }
      }
      return;
    }
    if (block.type === "chart") {
      const series = block.series && block.series.length ? block.series : ["value"];
      lines.push([block.type, prefix + title, "chartType", block.chartType].map(csvEscape).join(","));
      for (const [ri, row] of block.data.entries()) {
        for (const k of Object.keys(row)) {
          lines.push([block.type, prefix + title, `row${ri + 1}.${k}`, (row as any)[k]].map(csvEscape).join(","));
        }
      }
      void series;
      return;
    }
    if (block.type === "map") {
      if (block.mode === "districts") {
        lines.push([block.type, prefix + title, "districts", (block.districts ?? []).join("|")].map(csvEscape).join(","));
      } else {
        for (const [i, p] of (block.points ?? []).entries()) {
          lines.push([block.type, prefix + title, `point${i + 1}`, `${p.lat},${p.lng}${p.label ? " (" + p.label + ")" : ""}`].map(csvEscape).join(","));
        }
      }
      return;
    }
    if ("snapshot" in block && (block as any).snapshot) {
      const snap: any = (block as any).snapshot;
      // Investigations bundle: walk each sub-array
      if (block.type === "investigations") {
        for (const key of ["court_cases", "ig_reports", "fara", "spending", "contracts"]) {
          const rows = snap[key] ?? [];
          for (const [ri, r] of rows.entries()) {
            for (const [k, v] of Object.entries(r)) {
              lines.push([block.type, prefix + title, `${key}[${ri + 1}].${k}`, v].map(csvEscape).join(","));
            }
          }
        }
        return;
      }
      // talking_points stored as items
      const rows = snap.items ?? snap.rows;
      if (Array.isArray(rows)) {
        for (const [ri, r] of rows.entries()) {
          for (const [k, v] of Object.entries(r)) {
            lines.push([block.type, prefix + title, `[${ri + 1}].${k}`, v].map(csvEscape).join(","));
          }
        }
      } else if (typeof snap === "object" && snap !== null) {
        for (const [k, v] of Object.entries(snap)) {
          lines.push([block.type, prefix + title, k, v].map(csvEscape).join(","));
        }
      }
    }
  };

  for (const b of report.blocks) walk(b);

  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${report.title.replace(/[^a-z0-9]+/gi, "_")}_report.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** CSV-only export for raw activity logs (no report context). */
export function exportActivityLogsCsv(rows: Array<Record<string, unknown>>, filename = "activity_logs.csv") {
  if (rows.length === 0) {
    alert("No rows to export.");
    return;
  }
  const cols = Array.from(rows.reduce((set, r) => {
    Object.keys(r).forEach((k) => set.add(k));
    return set;
  }, new Set<string>()));
  const lines = [cols.join(",")];
  for (const r of rows) lines.push(cols.map((c) => csvEscape(r[c])).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** PDF export of admin activity + locations with optional map image. */
export function exportAdminLogsPdf(opts: {
  title: string;
  activity: Array<Record<string, any>>;
  locations: Array<Record<string, any>>;
  mapImage?: string;
}) {
  const doc = new jsPDF();
  let y = 20;
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(opts.title, M, y);
  y += 10;

  if (opts.activity.length > 0) {
    y = writeText(doc, `Activity Logs (${opts.activity.length})`, y, { size: 14, bold: true, color: [120, 0, 0] });
    autoTable(doc, {
      startY: y,
      head: [["When", "User", "Activity", "Details"]],
      body: opts.activity.slice(0, 300).map((r) => [
        new Date(r.created_at).toLocaleString(),
        r.user_name ?? r.user_id ?? "—",
        r.activity_type ?? "—",
        r.details ? JSON.stringify(r.details).slice(0, 140) : "",
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [120, 0, 0] },
      margin: { left: M, right: M },
    });
    // @ts-ignore
    y = (doc.lastAutoTable?.finalY ?? y) + 3;
  }

  if (opts.locations.length > 0) {
    doc.addPage(); y = 18;
    y = writeText(doc, `Location History (${opts.locations.length})`, y, { size: 14, bold: true, color: [120, 0, 0] });
    if (opts.mapImage) {
      try {
        y = ensureSpace(doc, y, 110);
        doc.addImage(opts.mapImage, "PNG", M, y, 180, 100, undefined, "FAST");
        y += 104;
      } catch { /* ignore */ }
    }
    autoTable(doc, {
      startY: y,
      head: [["When", "User", "Lat", "Lng", "Acc"]],
      body: opts.locations.slice(0, 300).map((r) => [
        new Date(r.recorded_at).toLocaleString(),
        r.user_name ?? r.user_id ?? "—",
        r.latitude?.toFixed?.(5) ?? "—",
        r.longitude?.toFixed?.(5) ?? "—",
        r.accuracy ? `±${Math.round(r.accuracy)}m` : "—",
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [120, 0, 0] },
      margin: { left: M, right: M },
    });
  }

  applyPdfBranding(doc);
  doc.save(`${opts.title.replace(/[^a-z0-9]+/gi, "_")}.pdf`);
}
