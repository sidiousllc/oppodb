import { type DistrictProfile } from "@/data/districtIntel";
import { getCookRating } from "@/data/cookRatings";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { applyPdfBranding } from "./pdfBranding";

type MetricDef = {
  key: keyof DistrictProfile;
  label: string;
  format: "number" | "percent" | "dollar";
};

type SectionDef = {
  title: string;
  metrics: MetricDef[];
};

const SECTIONS: SectionDef[] = [
  {
    title: "Demographics",
    metrics: [
      { key: "population", label: "Population", format: "number" },
      { key: "median_age", label: "Median Age", format: "number" },
      { key: "education_bachelor_pct", label: "Bachelor's+", format: "percent" },
    ],
  },
  {
    title: "Economic",
    metrics: [
      { key: "median_income", label: "Median Income", format: "dollar" },
      { key: "poverty_rate", label: "Poverty Rate", format: "percent" },
      { key: "unemployment_rate", label: "Unemployment", format: "percent" },
    ],
  },
  {
    title: "Race & Ethnicity",
    metrics: [
      { key: "white_pct", label: "White", format: "percent" },
      { key: "black_pct", label: "Black", format: "percent" },
      { key: "hispanic_pct", label: "Hispanic", format: "percent" },
      { key: "asian_pct", label: "Asian", format: "percent" },
      { key: "foreign_born_pct", label: "Foreign-Born", format: "percent" },
    ],
  },
  {
    title: "Housing",
    metrics: [
      { key: "owner_occupied_pct", label: "Owner-Occupied", format: "percent" },
      { key: "median_home_value", label: "Median Home Value", format: "dollar" },
      { key: "median_rent", label: "Median Rent", format: "dollar" },
    ],
  },
  {
    title: "Health & Veterans",
    metrics: [
      { key: "uninsured_pct", label: "Uninsured", format: "percent" },
      { key: "veteran_pct", label: "Veterans", format: "percent" },
    ],
  },
];

function fmtVal(v: number | null | undefined, format: "number" | "percent" | "dollar"): string {
  if (v == null) return "";
  if (format === "percent") return `${v}%`;
  if (format === "dollar") return `$${v.toLocaleString()}`;
  return v.toLocaleString();
}

/** Export comparison data as CSV and trigger download */
export function exportCSV(selected: DistrictProfile[]) {
  const headers = ["Section", "Metric", ...selected.map((d) => d.district_id)];

  const rows: string[][] = [];

  // Cook ratings row
  rows.push([
    "Cook Rating",
    "Rating",
    ...selected.map((d) => getCookRating(d.district_id) ?? "N/A"),
  ]);

  // State row
  rows.push(["General", "State", ...selected.map((d) => d.state)]);

  // Metric rows
  for (const section of SECTIONS) {
    for (const m of section.metrics) {
      rows.push([
        section.title,
        m.label,
        ...selected.map((d) => fmtVal(d[m.key] as number | null, m.format)),
      ]);
    }
  }

  // Top issues
  const maxIssues = Math.max(...selected.map((d) => d.top_issues.length));
  for (let i = 0; i < maxIssues; i++) {
    rows.push([
      "Top Issues",
      `Issue #${i + 1}`,
      ...selected.map((d) => d.top_issues[i] ?? ""),
    ]);
  }

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");

  downloadBlob(csvContent, "text/csv;charset=utf-8;", `district-comparison-${Date.now()}.csv`);
}

/** Export comparison data as a styled PDF and trigger download */
export function exportPDF(selected: DistrictProfile[]) {
  const doc = new jsPDF({ orientation: selected.length > 3 ? "landscape" : "portrait" });

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("District Comparison Report", 14, 24);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleDateString()} • ${selected.length} districts`, 14, 33);
  doc.setTextColor(0);

  let yPos = 40;

  // Cook Ratings table
  autoTable(doc, {
    startY: yPos,
    head: [["District", "Cook Rating", "State"]],
    body: selected.map((d) => [
      d.district_id,
      getCookRating(d.district_id) ?? "N/A",
      d.state,
    ]),
    theme: "grid",
    headStyles: { fillColor: [41, 98, 164], fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Sections
  for (const section of SECTIONS) {
    if (yPos > doc.internal.pageSize.height - 40) {
      doc.addPage();
      yPos = 14;
    }

    const head = [["Metric", ...selected.map((d) => d.district_id)]];
    const body = section.metrics.map((m) => [
      m.label,
      ...selected.map((d) => fmtVal(d[m.key] as number | null, m.format)),
    ]);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(section.title, 14, yPos);
    yPos += 3;

    autoTable(doc, {
      startY: yPos,
      head,
      body,
      theme: "striped",
      headStyles: { fillColor: [55, 65, 81], fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Top Issues
  if (yPos > doc.internal.pageSize.height - 40) {
    doc.addPage();
    yPos = 14;
  }

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Top Issues", 14, yPos);
  yPos += 3;

  const maxIssues = Math.max(...selected.map((d) => d.top_issues.length), 1);
  const issueHead = [["#", ...selected.map((d) => d.district_id)]];
  const issueBody: string[][] = [];
  for (let i = 0; i < maxIssues; i++) {
    issueBody.push([
      `${i + 1}`,
      ...selected.map((d) => d.top_issues[i] ?? "—"),
    ]);
  }

  autoTable(doc, {
    startY: yPos,
    head: issueHead,
    body: issueBody,
    theme: "striped",
    headStyles: { fillColor: [55, 65, 81], fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14 },
  });

  applyPdfBranding(doc);
  doc.save(`district-comparison-${Date.now()}.pdf`);
}

function downloadBlob(content: string, type: string, filename: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
