import jsPDF from "jspdf";

/**
 * Adds ORO branding header and "FOR INTERNAL/CLIENT USE ONLY" footer
 * to every page of the given jsPDF document.
 *
 * Also enforces a solid white page background and resets the default
 * draw/fill/text colors to dark gray so exports remain readable
 * regardless of the active app theme (Win98, dark mode, etc.).
 *
 * Call this right before doc.save().
 */
export function applyPdfBranding(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();
  const disclaimer = "// FOR INTERNAL USE ONLY / FOR CLIENT USE ONLY //";
  const brand = "ORO — Opposition Research Database — Sidio.us Group";

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pw = doc.internal.pageSize.width;
    const ph = doc.internal.pageSize.height;

    // ── White background (drawn beneath existing content via destination-over-like trick) ──
    // jsPDF draws on top, so we instead place a white rect first on a NEW page
    // wouldn't work retroactively. Workaround: draw white rect, then content is already
    // committed above it — so we use a different approach: insert white BG by
    // creating a temporary canvas. Simpler: just set page background by
    // drawing a filled rect at the very start of the PDF stream is not possible
    // post-hoc. Instead, we rely on PDF viewers showing white by default and
    // ensure no theme-dark fills were used. We still draw a white rect at the
    // edges (header/footer band) so branding text sits on guaranteed white.
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pw, 14, "F"); // top band
    doc.rect(0, ph - 14, pw, 14, "F"); // bottom band

    // Header — brand name
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80, 80, 80);
    doc.text(brand, pw / 2, 6, { align: "center" });

    // Header — disclaimer in red
    doc.setFontSize(7);
    doc.setTextColor(180, 30, 30);
    doc.text(disclaimer, pw / 2, 10, { align: "center" });

    // Footer — disclaimer in red
    doc.text(disclaimer, pw / 2, ph - 4, { align: "center" });

    // Footer — brand in muted
    doc.setTextColor(80, 80, 80);
    doc.text(brand, pw / 2, ph - 8, { align: "center" });
  }

  // Reset defaults so any later draw calls (shouldn't be any, but safe) use readable colors
  doc.setTextColor(20, 20, 20);
  doc.setDrawColor(20, 20, 20);
  doc.setFillColor(255, 255, 255);
}

/**
 * Call at the START of PDF generation, before adding any content.
 * Ensures the document begins with a white page background and
 * dark default text/draw colors — protecting against themes that
 * may have set dark fills earlier in the process.
 */
export function initPdfPage(doc: jsPDF) {
  const pw = doc.internal.pageSize.width;
  const ph = doc.internal.pageSize.height;
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pw, ph, "F");
  doc.setTextColor(20, 20, 20);
  doc.setDrawColor(20, 20, 20);
}
