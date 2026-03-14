import jsPDF from "jspdf";

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
  const margin = 14;
  const maxWidth = pageWidth - margin * 2;
  let y = 20;

  const checkPage = (needed: number) => {
    if (y + needed > doc.internal.pageSize.height - 20) {
      doc.addPage();
      y = 20;
    }
  };

  // Section tag
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(section.toUpperCase(), margin, y);
  y += 8;

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  const titleLines = doc.splitTextToSize(title, maxWidth);
  checkPage(titleLines.length * 8);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 8 + 2;

  // Subtitle / tag
  if (subtitle || tag) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text([tag, subtitle].filter(Boolean).join(" • "), margin, y);
    y += 6;
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
  y += 8;

  // Render content lines
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      y += 4;
      continue;
    }

    // H1
    if (trimmed.startsWith("# ")) {
      checkPage(12);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      const wrapped = doc.splitTextToSize(trimmed.slice(2), maxWidth);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 7 + 4;
      continue;
    }

    // H2
    if (trimmed.startsWith("## ")) {
      checkPage(10);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      const wrapped = doc.splitTextToSize(trimmed.slice(3), maxWidth);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 6 + 3;
      continue;
    }

    // H3
    if (trimmed.startsWith("### ")) {
      checkPage(10);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      const wrapped = doc.splitTextToSize(trimmed.slice(4), maxWidth);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 5.5 + 3;
      continue;
    }

    // Bullet point
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      checkPage(8);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const text = stripMarkdownInline(trimmed.slice(2));
      const wrapped = doc.splitTextToSize(text, maxWidth - 8);
      doc.text("•", margin + 2, y);
      doc.text(wrapped, margin + 8, y);
      y += wrapped.length * 4.5 + 2;
      continue;
    }

    // Bold section header (e.g. **Agriculture:**)
    if (trimmed.startsWith("**") && trimmed.includes(":**")) {
      checkPage(8);
      const boldEnd = trimmed.indexOf(":**") + 1;
      const boldText = trimmed.slice(2, boldEnd);
      const rest = stripMarkdownInline(trimmed.slice(boldEnd + 2).trim());

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(boldText, margin, y);
      const boldWidth = doc.getTextWidth(boldText + " ");

      if (rest) {
        doc.setFont("helvetica", "normal");
        const wrapped = doc.splitTextToSize(rest, maxWidth - boldWidth);
        if (wrapped.length === 1) {
          doc.text(rest, margin + boldWidth, y);
          y += 5;
        } else {
          // First part on same line, rest below
          doc.text(wrapped[0], margin + boldWidth, y);
          y += 4.5;
          for (let i = 1; i < wrapped.length; i++) {
            checkPage(5);
            doc.text(wrapped[i], margin + 4, y);
            y += 4.5;
          }
          y += 1;
        }
      } else {
        y += 5;
      }
      continue;
    }

    // Normal paragraph
    checkPage(8);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const text = stripMarkdownInline(trimmed);
    const wrapped = doc.splitTextToSize(text, maxWidth);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 4.5 + 2;
  }

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
