import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { type DistrictProfile } from "@/data/districtIntel";
import { type CookRating } from "@/data/cookRatings";
import { getCandidatesForDistrict } from "@/data/candidateDistricts";
import { getCandidateBySlug } from "@/data/candidates";
import { getCookHistory } from "@/data/cookHistory";
import { getPVIHistory, formatPVI, getEffectivePVI } from "@/data/cookPVI";
import { fetchCongressionalElectionResults, groupCongressionalByCycle } from "@/data/congressionalElections";
import { supabase } from "@/integrations/supabase/client";
import { applyPdfBranding } from "./pdfBranding";

export async function exportDistrictPDF(district: DistrictProfile, cookRating?: CookRating | null) {
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

  const sectionTitle = (title: string) => {
    checkPage(14);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text(title, margin, y);
    y += 2;
    doc.setDrawColor(180);
    doc.line(margin, y, pw - margin, y);
    y += 6;
  };

  const renderTable = (title: string, rows: string[][]) => {
    if (rows.length === 0) return;
    checkPage(30);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50);
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

  // ─── Fetch async data in parallel ───
  const stateAbbr = district.district_id.split("-")[0];
  const distNum = district.district_id.split("-")[1];

  const [electionResults, forecastsRes, congressRes, pollingRes, financeRes] = await Promise.all([
    fetchCongressionalElectionResults(stateAbbr, distNum),
    supabase.from("election_forecasts").select("*").eq("cycle", 2026).eq("state_abbr", stateAbbr).eq("district", distNum),
    Promise.all([
      supabase.from("congress_members").select("name,party,chamber,district,official_url").eq("state", stateAbbr).eq("chamber", "House").eq("district", distNum),
      supabase.from("congress_members").select("name,party,chamber").eq("state", stateAbbr).eq("chamber", "Senate"),
    ]),
    supabase.from("polling_data").select("*").ilike("candidate_or_topic", `%${stateAbbr}%`).order("date_conducted", { ascending: false }).limit(20),
    supabase.from("campaign_finance").select("*").eq("state_abbr", stateAbbr).order("total_raised", { ascending: false }).limit(10),
  ]);

  // ─── HEADER ───
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("DISTRICT INTEL — COMPREHENSIVE REPORT", margin, y);
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

  // ════════════════════════════════════════
  // SECTION 1: OVERVIEW
  // ════════════════════════════════════════
  sectionTitle("1. Overview");

  renderTable("Key Statistics", [
    ["Population", fmt(district.population)],
    ["Median Income", dollar(district.median_income)],
    ["Median Age", fmt(district.median_age)],
    ["Bachelor's Degree+", pct(district.education_bachelor_pct)],
  ]);

  // Cook Rating
  if (cookRating) {
    checkPage(14);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50);
    doc.text("Cook Political Report Rating", margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60);
    doc.text(`Current Rating: ${cookRating}`, margin, y);
    y += 8;
  }

  // Cook Rating History
  const cookHistory = getCookHistory(district.district_id, cookRating || undefined);
  if (cookHistory.length > 0) {
    const histRows = cookHistory.map(h => [h.cycle, h.rating]);
    checkPage(30);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50);
    doc.text("Cook Rating History", margin, y);
    y += 3;
    autoTable(doc, {
      startY: y,
      head: [["Cycle", "Rating"]],
      body: histRows,
      theme: "striped",
      headStyles: { fillColor: [55, 65, 81], fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8 },
      margin: { left: margin, right: margin },
      tableWidth: maxW,
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // PVI History
  const pviHistory = getPVIHistory(district.district_id);
  if (pviHistory && pviHistory.length > 0) {
    const pviRows = pviHistory.map(p => [p.cycle, formatPVI(p.score)]);
    checkPage(30);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50);
    doc.text("Partisan Voting Index (PVI) History", margin, y);
    y += 3;
    autoTable(doc, {
      startY: y,
      head: [["Cycle", "PVI"]],
      body: pviRows,
      theme: "striped",
      headStyles: { fillColor: [55, 65, 81], fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8 },
      margin: { left: margin, right: margin },
      tableWidth: maxW,
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  } else {
    const eff = getEffectivePVI(district.district_id);
    if (eff) {
      checkPage(10);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60);
      doc.text(`Current PVI: ${formatPVI(eff.score)}${eff.estimated ? " (estimated)" : ""}`, margin, y);
      y += 8;
    }
  }

  // Top Issues
  if (district.top_issues.length > 0) {
    checkPage(30);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50);
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

  // Tracked Representatives
  const candidateSlugs = getCandidatesForDistrict(district.district_id);
  const linkedCandidates = candidateSlugs.map(slug => getCandidateBySlug(slug)).filter(Boolean);
  if (linkedCandidates.length > 0) {
    checkPage(30);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50);
    doc.text("Tracked Representatives", margin, y);
    y += 3;
    autoTable(doc, {
      startY: y,
      head: [["Name", "Category"]],
      body: linkedCandidates.map(c => [c!.name, c!.category]),
      theme: "striped",
      headStyles: { fillColor: [55, 65, 81], fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8 },
      margin: { left: margin, right: margin },
      tableWidth: maxW,
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ════════════════════════════════════════
  // SECTION 2: DEMOGRAPHICS
  // ════════════════════════════════════════
  sectionTitle("2. Demographics");

  renderTable("Economic Indicators", [
    ["Poverty Rate", pct(district.poverty_rate)],
    ["Unemployment Rate", pct(district.unemployment_rate)],
    ["Total Households", fmt(district.total_households)],
    ["Avg Household Size", fmt(district.avg_household_size)],
  ]);

  renderTable("Racial & Ethnic Demographics", [
    ["White", pct(district.white_pct)],
    ["Black / African American", pct(district.black_pct)],
    ["Hispanic / Latino", pct(district.hispanic_pct)],
    ["Asian", pct(district.asian_pct)],
    ["Foreign-Born", pct(district.foreign_born_pct)],
  ]);

  const renterPct = district.owner_occupied_pct != null
    ? pct(Math.round((100 - district.owner_occupied_pct) * 10) / 10)
    : "—";
  renderTable("Housing", [
    ["Owner-Occupied", pct(district.owner_occupied_pct)],
    ["Renter-Occupied", renterPct],
    ["Median Home Value", dollar(district.median_home_value)],
    ["Median Gross Rent", dollar(district.median_rent)],
  ]);

  renderTable("Health & Veterans", [
    ["Uninsured", pct(district.uninsured_pct)],
    ["Veterans (18+)", pct(district.veteran_pct)],
  ]);

  // Voting Patterns
  if (district.voting_patterns && Object.keys(district.voting_patterns).length > 0) {
    const vpRows: string[][] = [];
    for (const [key, val] of Object.entries(district.voting_patterns)) {
      if (val != null && typeof val !== "object") {
        const label = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        vpRows.push([label, String(val)]);
      }
    }
    if (vpRows.length > 0) renderTable("Voting Patterns", vpRows);
  }

  // ════════════════════════════════════════
  // SECTION 3: ELECTIONS
  // ════════════════════════════════════════
  sectionTitle("3. Elections");

  // Forecast comparison
  const forecasts = forecastsRes.data || [];
  if (forecasts.length > 0) {
    checkPage(30);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50);
    doc.text("Election Forecasts (2026)", margin, y);
    y += 3;
    const fRows = forecasts.map((f: any) => [
      f.source || "—",
      f.rating || "—",
      f.dem_win_prob != null ? `${f.dem_win_prob}%` : "—",
      f.rep_win_prob != null ? `${f.rep_win_prob}%` : "—",
      f.margin != null ? `${f.margin > 0 ? "R" : "D"}+${Math.abs(f.margin).toFixed(1)}` : "—",
    ]);
    autoTable(doc, {
      startY: y,
      head: [["Source", "Rating", "Dem Win %", "Rep Win %", "Margin"]],
      body: fRows,
      theme: "striped",
      headStyles: { fillColor: [55, 65, 81], fontSize: 7, fontStyle: "bold" },
      bodyStyles: { fontSize: 7 },
      margin: { left: margin, right: margin },
      tableWidth: maxW,
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Congressional election history
  const cycles = groupCongressionalByCycle(electionResults);
  if (cycles.length > 0) {
    checkPage(20);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50);
    doc.text("Congressional Election History", margin, y);
    y += 3;

    for (const cycle of cycles.slice(0, 6)) {
      checkPage(25);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(70);
      doc.text(`${cycle.year} ${cycle.type}${cycle.date ? ` (${cycle.date})` : ""}`, margin, y);
      y += 3;
      const cRows = cycle.candidates.map(c => [
        c.candidate_name,
        c.party || "—",
        c.votes != null ? c.votes.toLocaleString() : "—",
        c.vote_pct != null ? `${c.vote_pct}%` : "—",
        c.is_winner ? "✓" : "",
        c.is_incumbent ? "Inc." : "",
      ]);
      autoTable(doc, {
        startY: y,
        head: [["Candidate", "Party", "Votes", "Vote %", "Won", "Inc."]],
        body: cRows,
        theme: "striped",
        headStyles: { fillColor: [55, 65, 81], fontSize: 7, fontStyle: "bold" },
        bodyStyles: { fontSize: 7 },
        margin: { left: margin, right: margin },
        tableWidth: maxW,
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }
  }

  // ════════════════════════════════════════
  // SECTION 4: CONGRESS
  // ════════════════════════════════════════
  sectionTitle("4. Congressional Delegation");

  const houseMembers = congressRes[0].data || [];
  const senators = congressRes[1].data || [];

  if (houseMembers.length > 0 || senators.length > 0) {
    const memberRows = [
      ...houseMembers.map((m: any) => [m.name, m.party || "—", "House", m.district || distNum]),
      ...senators.map((m: any) => [m.name, m.party || "—", "Senate", "—"]),
    ];
    checkPage(30);
    autoTable(doc, {
      startY: y,
      head: [["Name", "Party", "Chamber", "District"]],
      body: memberRows,
      theme: "striped",
      headStyles: { fillColor: [55, 65, 81], fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8 },
      margin: { left: margin, right: margin },
      tableWidth: maxW,
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  } else {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(120);
    doc.text("No congressional delegation data available.", margin, y);
    y += 8;
  }

  // ════════════════════════════════════════
  // SECTION 5: CAMPAIGN FINANCE
  // ════════════════════════════════════════
  const financeData = (financeRes.data || []).filter((f: any) =>
    !f.district || f.district === distNum || f.district === district.district_id
  );
  if (financeData.length > 0) {
    sectionTitle("5. Campaign Finance");
    const finRows = financeData.map((f: any) => [
      f.candidate_name,
      f.party || "—",
      f.total_raised != null ? `$${f.total_raised.toLocaleString()}` : "—",
      f.total_spent != null ? `$${f.total_spent.toLocaleString()}` : "—",
      f.cash_on_hand != null ? `$${f.cash_on_hand.toLocaleString()}` : "—",
      f.small_dollar_pct != null ? `${f.small_dollar_pct}%` : "—",
    ]);
    checkPage(30);
    autoTable(doc, {
      startY: y,
      head: [["Candidate", "Party", "Total Raised", "Total Spent", "Cash on Hand", "Small $%"]],
      body: finRows,
      theme: "striped",
      headStyles: { fillColor: [55, 65, 81], fontSize: 7, fontStyle: "bold" },
      bodyStyles: { fontSize: 7 },
      margin: { left: margin, right: margin },
      tableWidth: maxW,
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ════════════════════════════════════════
  // DATA SOURCES
  // ════════════════════════════════════════
  checkPage(30);
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
    "FEC / OpenSecrets — opensecrets.org",
    "Congress.gov API — api.congress.gov",
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
  doc.save(`${district.district_id.toLowerCase().replace(/\s+/g, "-")}-full-report.pdf`);
}
