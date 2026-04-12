import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { type StateLegislativeProfile } from "@/data/stateLegislativeIntel";
import { applyPdfBranding } from "./pdfBranding";

export function exportStateLegPDF(district: StateLegislativeProfile) {
  const doc = new jsPDF();
  const margin = 14;
  let y = 20;
  const label = district.chamber === "house" ? "House" : "Senate";

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("STATE LEGISLATIVE DISTRICT", margin, y);
  y += 8;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text(`${district.state_abbr} ${label} District ${district.district_number}`, margin, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`${district.state} • ${label} Chamber`, margin, y);
  y += 5;

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Generated ${new Date().toLocaleDateString()}`, margin, y);
  y += 8;
  doc.setTextColor(0);

  const fmt = (n: number | null | undefined) => n != null ? n.toLocaleString() : "—";
  const pct = (n: number | null | undefined) => n != null ? `${n}%` : "—";
  const dollar = (n: number | null | undefined) => n != null ? `$${n.toLocaleString()}` : "—";

  const sections = [
    {
      title: "Demographics",
      rows: [
        ["Population", fmt(district.population)],
        ["Median Age", fmt(district.median_age)],
        ["Total Households", fmt(district.total_households)],
        ["Avg Household Size", fmt(district.avg_household_size)],
        ["Veterans", pct(district.veteran_pct)],
        ["Foreign Born", pct(district.foreign_born_pct)],
      ],
    },
    {
      title: "Economics",
      rows: [
        ["Median Income", dollar(district.median_income)],
        ["Poverty Rate", pct(district.poverty_rate)],
        ["Unemployment", pct(district.unemployment_rate)],
        ["Uninsured", pct(district.uninsured_pct)],
        ["Median Home Value", dollar(district.median_home_value)],
        ["Median Rent", dollar(district.median_rent)],
        ["Owner-Occupied", pct(district.owner_occupied_pct)],
      ],
    },
    {
      title: "Race & Ethnicity",
      rows: [
        ["White", pct(district.white_pct)],
        ["Black", pct(district.black_pct)],
        ["Hispanic", pct(district.hispanic_pct)],
        ["Asian", pct(district.asian_pct)],
      ],
    },
    {
      title: "Education & Housing",
      rows: [
        ["Bachelor's Degree+", pct(district.education_bachelor_pct)],
        ["Owner-Occupied", pct(district.owner_occupied_pct)],
        ["Median Home Value", dollar(district.median_home_value)],
        ["Median Rent", dollar(district.median_rent)],
      ],
    },
  ];

  for (const section of sections) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(section.title, margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["Metric", "Value"]],
      body: section.rows,
      theme: "striped",
      headStyles: { fillColor: [55, 65, 81], fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8 },
      margin: { left: margin },
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    if (y > doc.internal.pageSize.height - 40) {
      doc.addPage();
      y = 20;
    }
  }

  const slug = `${district.state_abbr}-${label}-${district.district_number}`.toLowerCase();
  applyPdfBranding(doc);
  doc.save(`${slug}.pdf`);
}
