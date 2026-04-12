import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { type DistrictProfile } from "@/data/districtIntel";
import { type CookRating } from "@/data/cookRatings";
import { getCandidatesForDistrict } from "@/data/candidateDistricts";
import { getCandidateBySlug } from "@/data/candidates";
import { applyPdfBranding } from "./pdfBranding";

export function exportDistrictPDF(district: DistrictProfile, cookRating?: CookRating | null) {
  const doc = new jsPDF();
  const margin = 14;
  const pw = doc.internal.pageSize.width;
  const ph = doc.internal.pageSize.height;
  const maxW = pw - margin * 2;
  let y = 16;

  const checkPage = (needed: number) => {
    if (y + needed > ph - 20) {
      doc.addPage();
      y = 16;
    }
  };

  const fmt = (n: number | null | undefined) => n != null ? n.toLocaleString() : "—";
  const pct = (n: number | null | undefined) => n != null ? `${n}%` : "—";
  const dollar = (n: number | null | undefined) => n != null ? `$${n.toLocaleString()}` : "—";

  // ─── Header ───
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("DISTRICT INTEL — FULL REPORT", margin, y);
  y += 8;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30);
  doc.text(district.district_id, margin, y);

  if (cookRating) {
    const ratingX = margin + doc.getTextWidth(district.district_id) + 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80, 80, 80);
    doc.text(`[${cookRating}]`, ratingX, y);
  }
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`${district.state} • Congressional District`, margin, y);
  y += 5;

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Generated ${new Date().toLocaleDateString()}`, margin, y);
  y += 10;

  // ─── Helper to render a section table ───
  const renderTable = (title: string, rows: string[][]) => {
    checkPage(30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text(title, margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["Metric", "Value"]],
      body: rows,
      theme: "striped",
      headStyles: { fillColor: [55, 65, 81], fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8 },
      margin: { left: margin, right: margin },
      tableWidth: maxW,
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  };

  // ─── 1. Key Stats ───
  renderTable("Key Stats", [
    ["Population", fmt(district.population)],
    ["Median Income", dollar(district.median_income)],
    ["Median Age", fmt(district.median_age)],
    ["Bachelor's Degree+", pct(district.education_bachelor_pct)],
  ]);

  // ─── 2. Economic Indicators ───
  renderTable("Economic Indicators", [
    ["Poverty Rate", pct(district.poverty_rate)],
    ["Unemployment Rate", pct(district.unemployment_rate)],
    ["Total Households", fmt(district.total_households)],
    ["Avg Household Size", fmt(district.avg_household_size)],
  ]);

  // ─── 3. Race & Ethnicity ───
  renderTable("Racial & Ethnic Demographics", [
    ["White", pct(district.white_pct)],
    ["Black / African American", pct(district.black_pct)],
    ["Hispanic / Latino", pct(district.hispanic_pct)],
    ["Asian", pct(district.asian_pct)],
    ["Foreign-Born", pct(district.foreign_born_pct)],
  ]);

  // ─── 4. Housing ───
  const renterPct = district.owner_occupied_pct != null
    ? pct(Math.round((100 - district.owner_occupied_pct) * 10) / 10)
    : "—";
  renderTable("Housing", [
    ["Owner-Occupied", pct(district.owner_occupied_pct)],
    ["Renter-Occupied", renterPct],
    ["Median Home Value", dollar(district.median_home_value)],
    ["Median Gross Rent", dollar(district.median_rent)],
  ]);

  // ─── 5. Health & Veterans ───
  renderTable("Health & Veterans", [
    ["Uninsured", pct(district.uninsured_pct)],
    ["Veterans (18+)", pct(district.veteran_pct)],
  ]);

  // ─── 6. Top Issues ───
  if (district.top_issues.length > 0) {
    checkPage(30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text("Top Issues", margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["#", "Issue"]],
      body: district.top_issues.map((issue, i) => [`${i + 1}`, issue]),
      theme: "striped",
      headStyles: { fillColor: [55, 65, 81], fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8 },
      margin: { left: margin, right: margin },
      tableWidth: maxW,
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ─── 7. Voting Patterns ───
  if (district.voting_patterns && Object.keys(district.voting_patterns).length > 0) {
    const vpRows: string[][] = [];
    for (const [key, val] of Object.entries(district.voting_patterns)) {
      if (val != null && typeof val !== "object") {
        const label = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        vpRows.push([label, String(val)]);
      }
    }
    if (vpRows.length > 0) {
      renderTable("Voting Patterns", vpRows);
    }
  }

  // ─── 8. Linked Candidates ───
  const candidateSlugs = getCandidatesForDistrict(district.district_id);
  const linkedCandidates = candidateSlugs
    .map((slug) => getCandidateBySlug(slug))
    .filter(Boolean);

  if (linkedCandidates.length > 0) {
    checkPage(20);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text("Tracked Representatives", margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["Name", "Category"]],
      body: linkedCandidates.map((c) => [c!.name, c!.category]),
      theme: "striped",
      headStyles: { fillColor: [55, 65, 81], fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8 },
      margin: { left: margin, right: margin },
      tableWidth: maxW,
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ─── 9. Cook Rating ───
  if (cookRating) {
    checkPage(14);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text("Cook Political Report Rating", margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60);
    doc.text(`Current Rating: ${cookRating}`, margin, y);
    y += 10;
  }

  // ─── 10. Data Sources ───
  checkPage(20);
  doc.setDrawColor(180);
  doc.line(margin, y, pw - margin, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30);
  doc.text("Data Sources", margin, y);
  y += 5;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);

  const sources = [
    "U.S. Census ACS 5-Year Estimates (2022) — census.gov",
    "Cook Political Report — cookpolitical.com",
    "Cook PVI (2024) — cookpolitical.com/cook-pvi",
    "OpenElections — openelections.net",
    "MIT Election Data + Science Lab — electionlab.mit.edu",
  ];
  for (const src of sources) {
    checkPage(5);
    doc.text(`• ${src}`, margin + 2, y);
    y += 4;
  }

  // ─── Page numbers ───
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${totalPages}`, pw - margin - 22, ph - 12);
  }

  applyPdfBranding(doc);
  doc.save(`${district.district_id.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}
