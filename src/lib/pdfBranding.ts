import jsPDF from "jspdf";

/**
 * Adds ORO branding header and "FOR INTERNAL/CLIENT USE ONLY" footer
 * to every page of the given jsPDF document.
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

    // Header — brand name
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text(brand, pw / 2, 6, { align: "center" });

    // Header — disclaimer in red
    doc.setFontSize(7);
    doc.setTextColor(200, 30, 30);
    doc.text(disclaimer, pw / 2, 10, { align: "center" });

    // Footer — disclaimer in red
    doc.text(disclaimer, pw / 2, ph - 4, { align: "center" });

    // Footer — brand in muted
    doc.setTextColor(100, 100, 100);
    doc.text(brand, pw / 2, ph - 8, { align: "center" });
  }
}
