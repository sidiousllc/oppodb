import jsPDF from "jspdf";

/**
 * Adds centered red "FOR INTERNAL/CLIENT USE ONLY" header and footer
 * to every page of the given jsPDF document.
 * Call this right before doc.save().
 */
export function applyPdfBranding(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();
  const label = "FOR INTERNAL/CLIENT USE ONLY";

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pw = doc.internal.pageSize.width;
    const ph = doc.internal.pageSize.height;

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(200, 30, 30);

    // Header
    doc.text(label, pw / 2, 8, { align: "center" });

    // Footer
    doc.text(label, pw / 2, ph - 4, { align: "center" });
  }
}
