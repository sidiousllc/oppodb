import jsPDF from "jspdf";
import { applyPdfBranding, PDF_BRAND_HEADER_HEIGHT, PDF_BRAND_FOOTER_HEIGHT } from "./pdfBranding";

interface ExportOptions {
  title: string;
  subtitle?: string;
  tag?: string;
  content: string;
  section: string;
}

/**
 * Renders markdown-like content into a jsPDF document with basic formatting.
 * Supports bold (**), headers (#, ##, ###), and bullet points (- ).
 */
export function exportContentPDF({ title, subtitle, tag, content, section }: ExportOptions) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 14;
  const maxWidth = pageWidth - margin * 2;
  const topY = PDF_BRAND_HEADER_HEIGHT + 4;
  const bottomLimit = pageHeight - PDF_BRAND_FOOTER_HEIGHT - 4;
  let y = topY;

  const checkPage = (needed: number) => {
    if (y + needed > bottomLimit) {
      doc.addPage();
      y = topY;
    }
  };

  // Section tag
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(section.toUpperCase(), margin, y);
  y += 10;

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  const titleLines = doc.splitTextToSize(title, maxWidth);
  checkPage(titleLines.length * 9);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 9 + 4;

  // Subtitle / tag
  if (subtitle || tag) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text([tag, subtitle].filter(Boolean).join(" • "), margin, y);
    y += 8;
  }

  // Date
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Generated ${new Date().toLocaleDateString()}`, margin, y);
  y += 10;
  doc.setTextColor(0);

  // Divider
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Render content lines
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      y += 5;
      continue;
    }

    // H1
    if (trimmed.startsWith("# ")) {
      const headText = trimmed.slice(2);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      const wrapped = doc.splitTextToSize(headText, maxWidth);
      const lineH = 8;
      checkPage(wrapped.length * lineH + 6);
      y += 4; // space before heading
      doc.text(wrapped, margin, y);
      y += wrapped.length * lineH + 6;
      continue;
    }

    // H2
    if (trimmed.startsWith("## ")) {
      const headText = trimmed.slice(3);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      const wrapped = doc.splitTextToSize(headText, maxWidth);
      const lineH = 7;
      checkPage(wrapped.length * lineH + 5);
      y += 3;
      doc.text(wrapped, margin, y);
      y += wrapped.length * lineH + 5;
      continue;
    }

    // H3
    if (trimmed.startsWith("### ")) {
      const headText = trimmed.slice(4);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      const wrapped = doc.splitTextToSize(headText, maxWidth);
      const lineH = 6;
      checkPage(wrapped.length * lineH + 4);
      y += 2;
      doc.text(wrapped, margin, y);
      y += wrapped.length * lineH + 4;
      continue;
    }

    // Bullet point
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const text = stripMarkdownInline(trimmed.slice(2));
      const wrapped = doc.splitTextToSize(text, maxWidth - 8);
      const lineH = 5;
      checkPage(wrapped.length * lineH + 2);
      doc.text("•", margin + 2, y);
      doc.text(wrapped, margin + 8, y);
      y += wrapped.length * lineH + 3;
      continue;
    }

    // Bold section header (e.g. **Agriculture:**)
    if (trimmed.startsWith("**") && trimmed.includes(":**")) {
      const boldEnd = trimmed.indexOf(":**") + 1;
      const boldText = trimmed.slice(2, boldEnd);
      const rest = stripMarkdownInline(trimmed.slice(boldEnd + 2).trim());

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      const lineH = 5;
      checkPage(lineH + 2);
      doc.text(boldText, margin, y);
      const boldWidth = doc.getTextWidth(boldText + " ");

      if (rest) {
        doc.setFont("helvetica", "normal");
        const wrapped = doc.splitTextToSize(rest, maxWidth - boldWidth);
        if (wrapped.length === 1) {
          doc.text(rest, margin + boldWidth, y);
          y += lineH + 2;
        } else {
          doc.text(wrapped[0], margin + boldWidth, y);
          y += lineH;
          for (let i = 1; i < wrapped.length; i++) {
            checkPage(lineH);
            doc.text(wrapped[i], margin + 4, y);
            y += lineH;
          }
          y += 2;
        }
      } else {
        y += lineH + 2;
      }
      continue;
    }

    // Normal paragraph
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const text = stripMarkdownInline(trimmed);
    const wrapped = doc.splitTextToSize(text, maxWidth);
    const lineH = 5;
    checkPage(wrapped.length * lineH + 2);
    doc.text(wrapped, margin, y);
    y += wrapped.length * lineH + 3;
  }

  applyPdfBranding(doc);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  doc.save(`${slug}.pdf`);
}

function stripMarkdownInline(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/`(.*?)`/g, "$1");
}
