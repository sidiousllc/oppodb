import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { type DistrictProfile } from "@/data/districtIntel";
import { type CookRating } from "@/data/cookRatings";

export function exportDistrictPDF(district: DistrictProfile, cookRating?: CookRating | null) {
  const doc = new jsPDF();
  const margin = 14;
  let y = 20;

  // Title
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("DISTRICT INTEL", margin, y);
  y += 8;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text(district.district_id, margin, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`${district.state} • Congressional District${cookRating ? ` • Cook Rating: ${cookRating}` : ""}`, margin, y);
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
      title: "Key Stats",
      rows: [
        ["Population", fmt(district.population)],
        ["Median Income", dollar(district.median_income)],
        ["Median Age", fmt(district.median_age)],
        ["Bachelor's+", pct(district.education_bachelor_pct)],
      ],
    },
    {
      title: "Economic Indicators",
      rows: [
        ["Poverty Rate", pct(district.poverty_rate)],
        ["Unemployment", pct(district.unemployment_rate)],
        ["Total Households", fmt(district.total_households)],
        ["Avg Household Size", fmt(district.avg_household_size)],
      ],
    },
    {
      title: "Race & Ethnicity",
      rows: [
        ["White", pct(district.white_pct)],
        ["Black", pct(district.black_pct)],
        ["Hispanic", pct(district.hispanic_pct)],
        ["Asian", pct(district.asian_pct)],
        ["Foreign-Born", pct(district.foreign_born_pct)],
      ],
    },
    {
      title: "Housing",
      rows: [
        ["Owner-Occupied", pct(district.owner_occupied_pct)],
        ["Median Home Value", dollar(district.median_home_value)],
        ["Median Rent", dollar(district.median_rent)],
      ],
    },
    {
      title: "Health & Veterans",
      rows: [
        ["Uninsured", pct(district.uninsured_pct)],
        ["Veterans", pct(district.veteran_pct)],
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

  // Top Issues
  if (district.top_issues.length > 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Top Issues", margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["#", "Issue"]],
      body: district.top_issues.map((issue, i) => [`${i + 1}`, issue]),
      theme: "striped",
      headStyles: { fillColor: [55, 65, 81], fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8 },
      margin: { left: margin },
    });
  }

  doc.save(`${district.district_id.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}
