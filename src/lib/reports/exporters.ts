// PDF + CSV export for Reports.
import jsPDF from "jspdf";
import { applyPdfBranding } from "@/lib/pdfBranding";
import type { Report, ReportBlock } from "./types";

const M = 14; // margin
const LH = 5;  // line height

function ensureSpace(doc: jsPDF, y: number, needed = 10): number {
  if (y + needed > doc.internal.pageSize.height - 14) {
    doc.addPage();
    return 18;
  }
  return y;
}

function writeText(doc: jsPDF, text: string, y: number, opts?: { size?: number; bold?: boolean; color?: [number, number, number] }): number {
  const size = opts?.size ?? 10;
  doc.setFontSize(size);
  doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
  if (opts?.color) doc.setTextColor(...opts.color);
  else doc.setTextColor(20, 20, 20);
  const pageWidth = doc.internal.pageSize.width - M * 2;
  const lines = doc.splitTextToSize(text || "", pageWidth);
  for (const line of lines) {
    y = ensureSpace(doc, y, LH);
    doc.text(line, M, y);
    y += LH;
  }
  return y + 1;
}

function renderBlock(doc: jsPDF, block: ReportBlock, y: number, depth = 0): number {
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
        for (const b of tab.blocks) y = renderBlock(doc, b, y, depth + 1);
      }
      return y;
    }
    case "candidate":
    case "research":
    case "district":
    case "international":
    case "finance":
    case "polling":
    case "legislation":
    case "messaging": {
      const title = block.title ?? `${block.type} — ${block.refId}`;
      y = writeText(doc, title, y, { size: 12, bold: true, color: [0, 80, 0] });
      const snap = (block as any).snapshot;
      if (snap) {
        const json = JSON.stringify(snap, null, 2);
        return writeText(doc, json.length > 3000 ? json.slice(0, 3000) + "\n…(truncated)" : json, y, { size: 7 });
      }
      return writeText(doc, "(no cached snapshot — open report in app to refresh)", y, { size: 8, color: [120, 120, 120] });
    }
    case "intel": {
      y = writeText(doc, block.title ?? `Intel — ${block.refId}`, y, { size: 12, bold: true, color: [0, 80, 0] });
      const items = ((block as any).snapshot?.items ?? []) as Array<{ title: string; source_name: string; published_at?: string; summary?: string }>;
      for (const it of items.slice(0, 15)) {
        y = writeText(doc, `• ${it.title}`, y, { size: 9, bold: true });
        y = writeText(doc, `  ${it.source_name}${it.published_at ? " — " + new Date(it.published_at).toLocaleDateString() : ""}`, y, { size: 8, color: [100, 100, 100] });
        if (it.summary) y = writeText(doc, "  " + it.summary, y, { size: 8 });
      }
      return y;
    }
    case "election": {
      y = writeText(doc, block.title ?? `Election — ${block.refId}`, y, { size: 12, bold: true, color: [0, 80, 0] });
      const items = ((block as any).snapshot?.items ?? []) as Array<{ candidate_name: string; party?: string; votes?: number; vote_pct?: number; election_year?: number; is_winner?: boolean }>;
      for (const it of items) {
        const winner = it.is_winner ? "★ " : "  ";
        y = writeText(doc, `${winner}${it.election_year} — ${it.candidate_name} (${it.party ?? "?"}) — ${it.votes?.toLocaleString() ?? "—"} (${it.vote_pct?.toFixed(1) ?? "—"}%)`, y, { size: 9 });
      }
      return y;
    }
    case "admin_activity": {
      y = writeText(doc, block.title ?? "Activity Logs", y, { size: 12, bold: true, color: [120, 0, 0] });
      const rows = ((block as any).snapshot?.rows ?? []) as Array<{ created_at: string; user_name: string; activity_type: string; details: unknown }>;
      for (const r of rows.slice(0, 80)) {
        y = writeText(doc, `[${new Date(r.created_at).toLocaleString()}] ${r.user_name} — ${r.activity_type}`, y, { size: 8 });
        if (r.details) {
          const d = JSON.stringify(r.details);
          y = writeText(doc, "  " + (d.length > 200 ? d.slice(0, 200) + "…" : d), y, { size: 7, color: [100, 100, 100] });
        }
      }
      return y;
    }
    case "admin_locations": {
      y = writeText(doc, block.title ?? "Location History", y, { size: 12, bold: true, color: [120, 0, 0] });
      const rows = ((block as any).snapshot?.rows ?? []) as Array<{ recorded_at: string; user_name: string; latitude: number; longitude: number; accuracy?: number }>;
      // Map screenshot if attached
      const mapImg = (block as any).snapshot?.mapImage as string | undefined;
      if (mapImg) {
        try {
          y = ensureSpace(doc, y, 70);
          doc.addImage(mapImg, "PNG", M, y, 180, 100, undefined, "FAST");
          y += 104;
        } catch { /* ignore */ }
      }
      for (const r of rows.slice(0, 100)) {
        y = writeText(doc, `[${new Date(r.recorded_at).toLocaleString()}] ${r.user_name} — ${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}${r.accuracy ? ` (±${Math.round(r.accuracy)}m)` : ""}`, y, { size: 7 });
      }
      return y;
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

export function exportReportPdf(report: Report) {
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
    y = renderBlock(doc, block, y);
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
    } else if (block.type === "image") {
      lines.push([block.type, prefix + title, "url", block.url].map(csvEscape).join(","));
    } else if ("snapshot" in block && (block as any).snapshot) {
      const snap = (block as any).snapshot;
      // tabular data
      const rows = snap.items ?? snap.rows;
      if (Array.isArray(rows)) {
        for (const r of rows) {
          for (const [k, v] of Object.entries(r)) {
            lines.push([block.type, prefix + title, k, v].map(csvEscape).join(","));
          }
          lines.push([]);
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
    for (const r of opts.activity.slice(0, 200)) {
      y = writeText(doc, `[${new Date(r.created_at).toLocaleString()}] ${r.user_name ?? r.user_id} — ${r.activity_type}`, y, { size: 8 });
      if (r.details) {
        const d = JSON.stringify(r.details);
        y = writeText(doc, "  " + (d.length > 220 ? d.slice(0, 220) + "…" : d), y, { size: 7, color: [100, 100, 100] });
      }
    }
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
    for (const r of opts.locations.slice(0, 250)) {
      y = writeText(doc, `[${new Date(r.recorded_at).toLocaleString()}] ${r.user_name ?? r.user_id} — ${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}${r.accuracy ? ` (±${Math.round(r.accuracy)}m)` : ""}`, y, { size: 7 });
    }
  }

  applyPdfBranding(doc);
  doc.save(`${opts.title.replace(/[^a-z0-9]+/gi, "_")}.pdf`);
}
