import jsPDF from "jspdf";
import { applyPdfBranding } from "./pdfBranding";
import autoTable from "jspdf-autotable";

interface MessagingExportItem {
  title: string;
  source: string;
  source_url: string | null;
  author: string | null;
  published_date: string | null;
  summary: string;
  content: string;
  issue_areas: string[];
}

interface ThemeColors {
  bg: [number, number, number];
  card: [number, number, number];
  cardAlt: [number, number, number];
  text: [number, number, number];
  textMuted: [number, number, number];
  primary: [number, number, number];
  border: [number, number, number];
  titlebar: [number, number, number];
  titlebarText: [number, number, number];
  accent: [number, number, number];
  dem: [number, number, number];
  rep: [number, number, number];
  ind: [number, number, number];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100; l /= 100;
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  h /= 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function parseHSL(val: string): [number, number, number] {
  const parts = val.replace(/%/g, "").split(/[\s,]+/).map(Number);
  if (parts.length >= 3 && parts.every(n => !isNaN(n))) return hslToRgb(parts[0], parts[1], parts[2]);
  return [128, 128, 128];
}

function getThemeColors(): ThemeColors {
  // Force a fixed light, high-contrast palette for ALL PDF exports regardless
  // of the active app theme. This guarantees a white background with
  // dark, readable text in every exported document.
  const primary = parseHSL(getCSSVar("--primary")) || [40, 80, 160];
  const titlebar = parseHSL(getCSSVar("--win98-titlebar")) || [0, 0, 128];
  return {
    bg: [255, 255, 255],
    card: [255, 255, 255],
    cardAlt: [243, 244, 246],
    text: [20, 20, 20],
    textMuted: [90, 90, 90],
    primary,
    border: [200, 200, 200],
    titlebar,
    titlebarText: [255, 255, 255],
    accent: parseHSL(getCSSVar("--accent")) || [60, 140, 180],
    dem: [60, 120, 210],
    rep: [210, 60, 60],
    ind: [140, 80, 200],
  };
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/^>+\s?/gm, "")
    .replace(/^#{1,6}\s/gm, "");
}

export function exportMessagingPDF(item: MessagingExportItem) {
  const c = getThemeColors();
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.width;
  const ph = doc.internal.pageSize.height;
  const margin = 14;
  const maxW = pw - margin * 2;
  let y = 0;

  const drawBg = () => {
    doc.setFillColor(...c.bg);
    doc.rect(0, 0, pw, ph, "F");
  };

  const checkPage = (needed: number) => {
    if (y + needed > ph - 16) {
      doc.addPage();
      drawBg();
      y = 14;
    }
  };

  // ─── Page 1 ───
  drawBg();

  // Titlebar
  doc.setFillColor(...c.titlebar);
  doc.rect(0, 0, pw, 24, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...c.titlebarText);
  doc.text("📢 MessagingHub — Message Guidance Report", margin, 16);

  y = 32;

  // Party badge
  const party = item.issue_areas.find(t => ["Democrat", "Republican", "Independent"].includes(t));
  if (party) {
    const partyColor = party === "Democrat" ? c.dem : party === "Republican" ? c.rep : c.ind;
    doc.setFillColor(...partyColor);
    doc.roundedRect(margin, y, doc.getTextWidth(party) + 10, 10, 1.5, 1.5, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(party, margin + 5, y + 7);
    y += 15;
  }

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...c.text);
  const titleLines = doc.splitTextToSize(item.title, maxW);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 8 + 4;

  // Meta line
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...c.textMuted);
  const meta = [
    item.source,
    item.author,
    item.published_date ? new Date(item.published_date).toLocaleDateString() : null,
  ].filter(Boolean).join(" • ");
  doc.text(meta, margin, y);
  y += 6;

  // Issue tags
  const issueTags = item.issue_areas.filter(t => !["Democrat", "Republican", "Independent"].includes(t));
  if (issueTags.length > 0) {
    let tx = margin;
    doc.setFontSize(7);
    for (const tag of issueTags) {
      const tw = doc.getTextWidth(tag) + 6;
      if (tx + tw > pw - margin) { tx = margin; y += 9; }
      checkPage(10);
      doc.setFillColor(...c.cardAlt);
      doc.setDrawColor(...c.border);
      doc.roundedRect(tx, y - 4, tw, 8, 1, 1, "FD");
      doc.setTextColor(...c.textMuted);
      doc.text(tag, tx + 3, y + 2);
      tx += tw + 3;
    }
    y += 10;
  }

  // Divider
  doc.setDrawColor(...c.border);
  doc.line(margin, y, pw - margin, y);
  y += 8;

  // Summary
  if (item.summary) {
    checkPage(16);
    doc.setFillColor(...c.card);
    doc.setDrawColor(...c.border);
    const summaryText = stripMarkdown(item.summary);
    const summaryLines = doc.splitTextToSize(summaryText, maxW - 12);
    const summaryH = summaryLines.length * 4.5 + 10;
    doc.roundedRect(margin, y - 2, maxW, summaryH, 2, 2, "FD");
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...c.textMuted);
    doc.text(summaryLines, margin + 6, y + 5);
    y += summaryH + 6;
  }

  // ─── Content ───
  const lines = item.content.split("\n");
  const tableBuffer: string[][] = [];
  let inTable = false;

  const flushTable = () => {
    if (tableBuffer.length < 2) { tableBuffer.length = 0; inTable = false; return; }
    checkPage(30);
    const head = tableBuffer[0];
    const body = tableBuffer.slice(1);
    autoTable(doc, {
      startY: y,
      head: [head],
      body: body,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 7,
        cellPadding: 2,
        textColor: c.text,
        fillColor: c.card,
        lineColor: c.border,
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: c.titlebar,
        textColor: [255, 255, 255] as [number, number, number],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: c.cardAlt,
      },
      theme: "grid",
    });
    y = (doc as any).lastAutoTable?.finalY + 6 || y + 30;
    tableBuffer.length = 0;
    inTable = false;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Table rows
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      // Skip separator rows
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) { inTable = true; continue; }
      const cells = trimmed.split("|").slice(1, -1).map(c => c.trim());
      tableBuffer.push(cells);
      inTable = true;
      continue;
    }
    if (inTable) flushTable();

    if (!trimmed) { y += 3; continue; }

    // H1
    if (trimmed.startsWith("# ")) {
      checkPage(14);
      doc.setFontSize(15);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...c.text);
      const wrapped = doc.splitTextToSize(trimmed.slice(2), maxW);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 7 + 4;
      continue;
    }
    // H2
    if (trimmed.startsWith("## ")) {
      checkPage(12);
      y += 2;
      doc.setFillColor(...c.primary);
      doc.rect(margin, y - 4, 2, 8, "F");
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...c.text);
      const wrapped = doc.splitTextToSize(trimmed.slice(3), maxW - 6);
      doc.text(wrapped, margin + 5, y + 2);
      y += wrapped.length * 6 + 5;
      continue;
    }
    // H3
    if (trimmed.startsWith("### ")) {
      checkPage(10);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...c.text);
      const wrapped = doc.splitTextToSize(trimmed.slice(4), maxW);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 5 + 3;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith(">")) {
      checkPage(14);
      const quoteText = stripMarkdown(trimmed.replace(/^>+\s*/, ""));
      const wrapped = doc.splitTextToSize(quoteText, maxW - 16);
      const qh = wrapped.length * 4.5 + 6;
      doc.setFillColor(...c.card);
      doc.roundedRect(margin, y - 2, maxW, qh, 1.5, 1.5, "F");
      doc.setFillColor(...c.primary);
      doc.rect(margin, y - 2, 2.5, qh, "F");
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(...c.text);
      doc.text(wrapped, margin + 8, y + 4);
      y += qh + 4;
      continue;
    }

    // Bullet
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      checkPage(8);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...c.text);
      const text = stripMarkdown(trimmed.slice(2));
      const wrapped = doc.splitTextToSize(text, maxW - 10);
      doc.setFillColor(...c.primary);
      doc.circle(margin + 3, y - 1, 1, "F");
      doc.text(wrapped, margin + 8, y);
      y += wrapped.length * 4.2 + 2;
      continue;
    }

    // Numbered list
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      checkPage(8);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...c.primary);
      doc.text(numMatch[1] + ".", margin + 1, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...c.text);
      const text = stripMarkdown(numMatch[2]);
      const wrapped = doc.splitTextToSize(text, maxW - 12);
      doc.text(wrapped, margin + 8, y);
      y += wrapped.length * 4.2 + 2;
      continue;
    }

    // Checkmarks / icons
    if (trimmed.startsWith("❌") || trimmed.startsWith("✅")) {
      checkPage(8);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      const isNeg = trimmed.startsWith("❌");
      doc.setTextColor(isNeg ? 200 : 60, isNeg ? 60 : 160, isNeg ? 60 : 90);
      const text = stripMarkdown(trimmed.slice(1).trim());
      const wrapped = doc.splitTextToSize((isNeg ? "[X] " : "[✓] ") + text, maxW);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 4.2 + 2;
      doc.setTextColor(...c.text);
      continue;
    }

    // Bold label line  **Label:** content
    if (trimmed.startsWith("**") && trimmed.includes(":**")) {
      checkPage(8);
      const boldEnd = trimmed.indexOf(":**") + 1;
      const boldText = trimmed.slice(2, boldEnd);
      const rest = stripMarkdown(trimmed.slice(boldEnd + 2).trim());
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...c.text);
      doc.text(boldText, margin, y);
      const bw = doc.getTextWidth(boldText + " ");
      if (rest) {
        doc.setFont("helvetica", "normal");
        const wrapped = doc.splitTextToSize(rest, maxW - bw);
        if (wrapped.length === 1) {
          doc.text(rest, margin + bw, y);
          y += 4.5;
        } else {
          doc.text(wrapped[0], margin + bw, y);
          y += 4.2;
          for (let i = 1; i < wrapped.length; i++) {
            checkPage(5);
            doc.text(wrapped[i], margin + 4, y);
            y += 4.2;
          }
          y += 1;
        }
      } else {
        y += 4.5;
      }
      continue;
    }

    // Normal paragraph
    checkPage(8);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...c.text);
    const text = stripMarkdown(trimmed);
    const wrapped = doc.splitTextToSize(text, maxW);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 4.2 + 2;
  }

  // Flush trailing table
  if (inTable) flushTable();

  // Footer on last page
  y += 6;
  checkPage(12);
  doc.setDrawColor(...c.border);
  doc.line(margin, y, pw - margin, y);
  y += 6;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...c.textMuted);
  doc.text(`Generated ${new Date().toLocaleString()} • OppoDB MessagingHub`, margin, y);
  if (item.source_url) {
    y += 4;
    doc.text(`Source: ${item.source_url}`, margin, y);
  }

  // Page numbers on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (i > 1) {
      // Redraw titlebar on subsequent pages
      doc.setFillColor(...c.titlebar);
      doc.rect(0, 0, pw, 10, "F");
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...c.titlebarText);
      doc.text(item.title.slice(0, 80), margin, 7);
    }
    doc.setFontSize(7);
    doc.setTextColor(...c.textMuted);
    doc.text(`Page ${i} of ${totalPages}`, pw - margin - 20, ph - 8);
  }

  applyPdfBranding(doc);
  const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50);
  doc.save(`${slug}.pdf`);
}
