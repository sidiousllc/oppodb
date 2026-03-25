import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ExportGroup {
  label: string;
  results: { title: string; subtitle?: string }[];
}

export function exportSearchCSV(query: string, groups: ExportGroup[]) {
  const rows: string[][] = [["Category", "Title", "Details"]];
  for (const g of groups) {
    for (const r of g.results) {
      rows.push([g.label, r.title, r.subtitle || ""]);
    }
  }
  const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `search-results-${slugify(query)}.csv`);
}

export function exportSearchPDF(query: string, groups: ExportGroup[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(0, 0, 128);
  doc.rect(0, 0, pageW, 50, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Master Search Results", 30, 32);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Query: "${query}"  •  ${new Date().toLocaleDateString()}`, 30, 46);

  let y = 70;
  const totalResults = groups.reduce((s, g) => s + g.results.length, 0);
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(10);
  doc.text(`${totalResults} results across ${groups.length} categories`, 30, y);
  y += 20;

  for (const group of groups) {
    if (y > doc.internal.pageSize.getHeight() - 80) {
      doc.addPage();
      y = 40;
    }

    // Section header
    doc.setFillColor(192, 192, 192);
    doc.rect(25, y - 12, pageW - 50, 18, "F");
    doc.setTextColor(0, 0, 128);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`${group.label} (${group.results.length})`, 30, y);
    y += 14;

    const tableBody = group.results.map(r => [r.title, r.subtitle || ""]);
    autoTable(doc, {
      startY: y,
      head: [["Title", "Details"]],
      body: tableBody,
      margin: { left: 25, right: 25 },
      styles: { fontSize: 8, cellPadding: 4, font: "helvetica" },
      headStyles: { fillColor: [0, 0, 128], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [240, 240, 240] },
      didDrawPage: () => {
        // Footer
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        doc.text(`ORDB Master Search Export — ${new Date().toISOString()}`, 30, pageH - 15);
      },
    });

    y = (doc as any).lastAutoTable?.finalY + 20 || y + 40;
  }

  doc.save(`search-results-${slugify(query)}.pdf`);
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
