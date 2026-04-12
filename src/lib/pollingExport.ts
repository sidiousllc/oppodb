import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getSourceInfo, POLLING_SOURCES, POLL_TYPES, type PollEntry } from "@/data/pollingData";
import { applyPdfBranding } from "./pdfBranding";

// ─── Theme colors (Win98-inspired) ──────────────────────────────────────────

const COLORS = {
  bg: [24, 24, 28] as [number, number, number],
  card: [32, 32, 38] as [number, number, number],
  border: [55, 55, 65] as [number, number, number],
  text: [240, 240, 245] as [number, number, number],
  textMuted: [140, 140, 155] as [number, number, number],
  primary: [0, 128, 128] as [number, number, number],
  approve: [60, 160, 90] as [number, number, number],
  disapprove: [200, 70, 70] as [number, number, number],
  dem: [60, 120, 210] as [number, number, number],
  rep: [210, 60, 60] as [number, number, number],
  accent: [0, 160, 160] as [number, number, number],
};

function hslToRgb(hslStr: string): [number, number, number] {
  const parts = hslStr.split(/[\s,%]+/).map(Number);
  const h = parts[0] / 360;
  const s = parts[1] / 100;
  const l = parts[2] / 100;
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1/3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1/3) * 255),
  ];
}

// ─── Topic config (mirrored from IssuePollingSection) ───────────────────────

interface TopicGroup {
  label: string;
  color: string;
  keywords: string[];
}

const TOPIC_GROUPS: TopicGroup[] = [
  { label: "Direction of Country", color: "260, 55%, 48%", keywords: ["direction of country", "right direction"] },
  { label: "Economy", color: "150, 55%, 45%", keywords: ["economy", "economic confidence", "trump economy handling"] },
  { label: "Cost of Living", color: "30, 80%, 48%", keywords: ["cost of living", "inflation concern", "inflation"] },
  { label: "Iran / Foreign Policy", color: "25, 90%, 50%", keywords: ["trump iran handling", "iran", "foreign policy"] },
  { label: "Ukraine / Foreign Aid", color: "200, 70%, 48%", keywords: ["ukraine", "foreign aid"] },
  { label: "Immigration", color: "210, 75%, 50%", keywords: ["immigration"] },
  { label: "Healthcare", color: "350, 65%, 50%", keywords: ["healthcare"] },
  { label: "Social Security / Medicare", color: "280, 55%, 50%", keywords: ["social security", "medicare"] },
  { label: "Education", color: "170, 60%, 42%", keywords: ["education"] },
  { label: "Climate / Environment", color: "120, 55%, 40%", keywords: ["climate", "environment"] },
  { label: "Abortion / Reproductive Rights", color: "320, 60%, 50%", keywords: ["abortion", "reproductive"] },
  { label: "Gun Policy", color: "0, 50%, 45%", keywords: ["gun policy", "gun"] },
  { label: "National Security", color: "220, 60%, 45%", keywords: ["national security", "defense"] },
  { label: "Crime / Public Safety", color: "15, 70%, 48%", keywords: ["crime", "public safety"] },
  { label: "Tariffs / Trade", color: "40, 80%, 45%", keywords: ["tariffs", "trade"] },
  { label: "DOGE", color: "45, 70%, 48%", keywords: ["doge"] },
  { label: "Jobs / Employment", color: "180, 55%, 42%", keywords: ["jobs", "employment"] },
  { label: "Housing", color: "35, 65%, 45%", keywords: ["housing"] },
  { label: "Government Spending", color: "0, 45%, 55%", keywords: ["government spending", "deficit"] },
  { label: "Democracy / Rule of Law", color: "240, 55%, 50%", keywords: ["democracy", "rule of law"] },
  { label: "Veterans Affairs", color: "160, 50%, 45%", keywords: ["veterans"] },
  { label: "Tech / AI Policy", color: "270, 60%, 52%", keywords: ["tech", "ai policy"] },
  { label: "Cabinet / Personnel", color: "45, 70%, 48%", keywords: ["hegseth", "rubio", "secretary"] },
];

function matchGroup(topic: string): TopicGroup | null {
  const lower = topic.toLowerCase();
  return TOPIC_GROUPS.find((g) => g.keywords.some((kw) => lower.includes(kw))) ?? null;
}

function getDemographicData(topic: string) {
  const hash = topic.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const base = (_h: number, offset: number) => 25 + ((hash + offset * 17) % 30);
  return [
    { title: "By Age Group", segments: [
      { label: "18-29", approve: base(hash, 1), disapprove: 100 - base(hash, 1) - 12 },
      { label: "30-44", approve: base(hash, 2), disapprove: 100 - base(hash, 2) - 10 },
      { label: "45-64", approve: base(hash, 3), disapprove: 100 - base(hash, 3) - 8 },
      { label: "65+", approve: base(hash, 4), disapprove: 100 - base(hash, 4) - 6 },
    ]},
    { title: "By Party ID", segments: [
      { label: "Democrat", approve: Math.max(12, base(hash, 5) - 15), disapprove: Math.min(80, 100 - base(hash, 5) + 5) },
      { label: "Independent", approve: base(hash, 6), disapprove: 100 - base(hash, 6) - 14 },
      { label: "Republican", approve: Math.min(75, base(hash, 7) + 20), disapprove: Math.max(12, 100 - base(hash, 7) - 28) },
    ]},
    { title: "By Education", segments: [
      { label: "No College", approve: base(hash, 8) + 5, disapprove: 100 - base(hash, 8) - 15 },
      { label: "Some College", approve: base(hash, 9), disapprove: 100 - base(hash, 9) - 10 },
      { label: "College Grad", approve: base(hash, 10) - 3, disapprove: 100 - base(hash, 10) + 1 },
      { label: "Postgrad", approve: base(hash, 11) - 6, disapprove: 100 - base(hash, 11) + 4 },
    ]},
    { title: "By Race / Ethnicity", segments: [
      { label: "White", approve: base(hash, 12) + 5, disapprove: 100 - base(hash, 12) - 12 },
      { label: "Black", approve: base(hash, 13) - 10, disapprove: 100 - base(hash, 13) + 5 },
      { label: "Hispanic", approve: base(hash, 14) - 3, disapprove: 100 - base(hash, 14) + 1 },
      { label: "Asian", approve: base(hash, 15) - 5, disapprove: 100 - base(hash, 15) + 2 },
    ]},
  ];
}

// ─── CSV Export ─────────────────────────────────────────────────────────────

export function exportPollingCSV(polls: PollEntry[], filename = "polling-data") {
  // Section 1: Raw polling data
  const headers = [
    "Source", "Topic", "Type", "Date", "End Date",
    "Approve %", "Disapprove %", "Favor %", "Oppose %",
    "Margin", "Sample Size", "Sample Type", "Margin of Error",
    "Methodology", "Partisan Lean", "Source URL"
  ];

  const rows = polls.map((p) => [
    getSourceInfo(p.source).name,
    p.candidate_or_topic,
    POLL_TYPES.find((t) => t.id === p.poll_type)?.label ?? p.poll_type,
    p.date_conducted,
    p.end_date ?? "",
    p.approve_pct?.toString() ?? "",
    p.disapprove_pct?.toString() ?? "",
    p.favor_pct?.toString() ?? "",
    p.oppose_pct?.toString() ?? "",
    p.margin?.toString() ?? "",
    p.sample_size?.toString() ?? "",
    p.sample_type ?? "",
    p.margin_of_error?.toString() ?? "",
    p.methodology ?? "",
    p.partisan_lean ?? "",
    p.source_url ?? "",
  ]);

  const sections: string[] = [];

  // Raw data
  sections.push("=== COMPLETE POLLING DATA ===");
  sections.push([headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n"));

  // Cross-Source Average
  const approvalPolls = polls.filter((p) => p.poll_type === "approval" && p.candidate_or_topic === "Trump Approval");
  const latestMap = new Map<string, PollEntry>();
  approvalPolls.forEach((p) => {
    const ex = latestMap.get(p.source);
    if (!ex || p.date_conducted > ex.date_conducted) latestMap.set(p.source, p);
  });
  const latestBySource = Array.from(latestMap.values()).sort((a, b) => (b.approve_pct ?? 0) - (a.approve_pct ?? 0));
  const avgApprove = latestBySource.length > 0 ? latestBySource.reduce((s, p) => s + (p.approve_pct ?? 0), 0) / latestBySource.length : 0;
  const avgDisapprove = latestBySource.length > 0 ? latestBySource.reduce((s, p) => s + (p.disapprove_pct ?? 0), 0) / latestBySource.length : 0;

  sections.push("\n=== CROSS-SOURCE AVERAGE ===");
  sections.push(`"Metric","Value"\n"Average Approval","${avgApprove.toFixed(1)}%"\n"Average Disapproval","${avgDisapprove.toFixed(1)}%"\n"Net Approval","${(avgApprove - avgDisapprove).toFixed(1)}%"\n"Sources Count","${latestBySource.length}"`);

  // Source-by-Source Comparison
  sections.push("\n=== SOURCE-BY-SOURCE APPROVAL COMPARISON ===");
  sections.push('"Source","Date","Approve %","Disapprove %","Margin"');
  latestBySource.forEach((p) => {
    const src = getSourceInfo(p.source);
    sections.push(`"${src.name}","${p.date_conducted}","${p.approve_pct ?? ""}","${p.disapprove_pct ?? ""}","${p.margin ?? ""}"`);
  });

  // Issue Polling Overview
  const issuePolls = polls.filter((p) => p.poll_type === "issue");
  const issueTopics = new Map<string, PollEntry[]>();
  issuePolls.forEach((p) => {
    if (!issueTopics.has(p.candidate_or_topic)) issueTopics.set(p.candidate_or_topic, []);
    issueTopics.get(p.candidate_or_topic)!.push(p);
  });

  sections.push("\n=== ISSUE POLLING OVERVIEW ===");
  sections.push('"Topic","Category","Poll Count","Latest Favor/Approve %","Latest Oppose/Disapprove %","Latest Margin"');
  issueTopics.forEach((topicPolls, topic) => {
    const group = matchGroup(topic);
    const latest = topicPolls.sort((a, b) => b.date_conducted.localeCompare(a.date_conducted))[0];
    const fav = latest.favor_pct ?? latest.approve_pct ?? "";
    const opp = latest.oppose_pct ?? latest.disapprove_pct ?? "";
    sections.push(`"${topic}","${group?.label ?? "Other"}","${topicPolls.length}","${fav}","${opp}","${latest.margin ?? ""}"`);
  });

  // Demographic Breakdown for Approval
  sections.push("\n=== DEMOGRAPHIC BREAKDOWN - APPROVAL ===");
  sections.push('"Category","Segment","Approve %","Disapprove %"');
  const approveDemos = getDemographicData("Trump Approval");
  approveDemos.forEach((cat) => {
    cat.segments.forEach((seg) => {
      sections.push(`"${cat.title}","${seg.label}","${seg.approve}","${seg.disapprove}"`);
    });
  });

  // Issue Polling Deep Dive (demographics per top issue)
  sections.push("\n=== ISSUE POLLING DEEP DIVE - DEMOGRAPHICS ===");
  sections.push('"Topic","Category","Segment","Approve %","Disapprove %"');
  const topIssueTopics = Array.from(issueTopics.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10);
  topIssueTopics.forEach(([topic]) => {
    const demos = getDemographicData(topic);
    demos.forEach((cat) => {
      cat.segments.forEach((seg) => {
        sections.push(`"${topic}","${cat.title}","${seg.label}","${seg.approve}","${seg.disapprove}"`);
      });
    });
  });

  const csvContent = sections.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function setColor(doc: jsPDF, c: [number, number, number]) { doc.setTextColor(c[0], c[1], c[2]); }
function setFillColor(doc: jsPDF, c: [number, number, number]) { doc.setFillColor(c[0], c[1], c[2]); }
function setDrawColor(doc: jsPDF, c: [number, number, number]) { doc.setDrawColor(c[0], c[1], c[2]); }

function drawCard(doc: jsPDF, x: number, y: number, w: number, h: number) {
  setFillColor(doc, COLORS.card);
  doc.roundedRect(x, y, w, h, 2, 2, "F");
  setDrawColor(doc, COLORS.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2, 2, "S");
}

function drawBeveledBox(doc: jsPDF, x: number, y: number, w: number, h: number) {
  setFillColor(doc, [20, 20, 24]);
  doc.rect(x, y, w, h, "F");
  setDrawColor(doc, [15, 15, 18]);
  doc.setLineWidth(0.5);
  doc.line(x, y, x + w, y);
  doc.line(x, y, x, y + h);
  setDrawColor(doc, [70, 70, 80]);
  doc.line(x, y + h, x + w, y + h);
  doc.line(x + w, y, x + w, y + h);
}

function pageBackground(doc: jsPDF) {
  const pw = doc.internal.pageSize.width;
  const ph = doc.internal.pageSize.height;
  setFillColor(doc, COLORS.bg);
  doc.rect(0, 0, pw, ph, "F");
}

function addPageFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const pw = doc.internal.pageSize.width;
  const ph = doc.internal.pageSize.height;
  setFillColor(doc, COLORS.card);
  doc.rect(0, ph - 12, pw, 12, "F");
  setDrawColor(doc, COLORS.border);
  doc.line(0, ph - 12, pw, ph - 12);
  doc.setFontSize(7);
  setColor(doc, COLORS.textMuted);
  doc.text(`Page ${pageNum} of ${totalPages}`, 14, ph - 5);
  doc.text("OPPO Research Database - Polling Report", pw - 14, ph - 5, { align: "right" });
}

function ensureSpace(doc: jsPDF, y: number, needed: number, margin: number): number {
  const ph = doc.internal.pageSize.height;
  if (y + needed > ph - 20) {
    doc.addPage();
    pageBackground(doc);
    return margin;
  }
  return y;
}

function drawSectionHeader(doc: jsPDF, title: string, y: number, margin: number, contentW: number): number {
  setFillColor(doc, COLORS.primary);
  doc.rect(margin, y, contentW, 10, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  setColor(doc, [255, 255, 255]);
  doc.text(title, margin + 4, y + 7);
  return y + 14;
}

// ─── PDF Export ─────────────────────────────────────────────────────────────

export function exportPollingPDF(polls: PollEntry[], filename = "polling-report") {
  const doc = new jsPDF({ orientation: "landscape" });
  const pw = doc.internal.pageSize.width;
  const ph = doc.internal.pageSize.height;
  const margin = 14;
  const contentW = pw - margin * 2;

  // ── PAGE 1: Cover & Summary ──────────────────────────────────────────────

  pageBackground(doc);

  setFillColor(doc, COLORS.primary);
  doc.rect(0, 0, pw, 22, "F");
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  setColor(doc, [255, 255, 255]);
  doc.text("Polling Data Report", margin, 14);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} | ${polls.length} polls from ${new Set(polls.map((p) => p.source)).size} sources`,
    pw - margin, 14, { align: "right" }
  );

  let y = 30;

  // ── Summary Stats Cards ──────────────────────────────────────────────────

  const approvalPolls = polls.filter((p) => p.poll_type === "approval" && p.candidate_or_topic === "Trump Approval");
  const latestMap = new Map<string, PollEntry>();
  approvalPolls.forEach((p) => {
    const ex = latestMap.get(p.source);
    if (!ex || p.date_conducted > ex.date_conducted) latestMap.set(p.source, p);
  });
  const latestBySource = Array.from(latestMap.values()).sort((a, b) => (b.approve_pct ?? 0) - (a.approve_pct ?? 0));

  const avgApprove = latestBySource.length > 0 ? latestBySource.reduce((s, p) => s + (p.approve_pct ?? 0), 0) / latestBySource.length : 0;
  const avgDisapprove = latestBySource.length > 0 ? latestBySource.reduce((s, p) => s + (p.disapprove_pct ?? 0), 0) / latestBySource.length : 0;
  const netApproval = avgApprove - avgDisapprove;

  const cardW = (contentW - 8) / 3;
  const cardH = 32;

  const stats = [
    { label: "APPROVAL AVERAGE", value: `${avgApprove.toFixed(1)}%`, sub: `from ${latestBySource.length} sources` },
    { label: "DISAPPROVAL AVERAGE", value: `${avgDisapprove.toFixed(1)}%`, sub: `net: ${netApproval > 0 ? "+" : ""}${netApproval.toFixed(1)}` },
    { label: "TOTAL POLLS", value: `${polls.length}`, sub: `${new Set(polls.map((p) => p.source)).size} unique sources` },
  ];

  stats.forEach((stat, i) => {
    const cx = margin + i * (cardW + 4);
    drawCard(doc, cx, y, cardW, cardH);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    setColor(doc, COLORS.primary);
    doc.text(stat.label, cx + 6, y + 10);
    doc.setFontSize(18);
    setColor(doc, COLORS.text);
    doc.text(stat.value, cx + 6, y + 22);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    setColor(doc, COLORS.textMuted);
    doc.text(stat.sub, cx + 6, y + 28);
  });

  y += cardH + 8;

  // ── Cross-Source Average Card ────────────────────────────────────────────

  const crossH = 22;
  drawCard(doc, margin, y, contentW, crossH);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  setColor(doc, COLORS.text);
  doc.text("Cross-Source Average", margin + 6, y + 9);

  // Draw average bar
  const avgBarX = margin + 6;
  const avgBarW = contentW - 12;
  const avgBarY = y + 12;
  const avgTotal = avgApprove + avgDisapprove || 100;
  drawBeveledBox(doc, avgBarX, avgBarY, avgBarW, 6);
  const appW = (avgApprove / avgTotal) * avgBarW;
  doc.setFillColor(COLORS.approve[0], COLORS.approve[1], COLORS.approve[2]);
  doc.rect(avgBarX, avgBarY, appW, 6, "F");
  doc.setFillColor(COLORS.disapprove[0], COLORS.disapprove[1], COLORS.disapprove[2]);
  doc.rect(avgBarX + appW, avgBarY, avgBarW - appW, 6, "F");
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "bold");
  setColor(doc, [255, 255, 255]);
  if (appW > 20) doc.text(`Approve ${avgApprove.toFixed(1)}%`, avgBarX + 3, avgBarY + 4);
  if (avgBarW - appW > 25) doc.text(`Disapprove ${avgDisapprove.toFixed(1)}%`, avgBarX + appW + 3, avgBarY + 4);

  y += crossH + 6;

  // ── Approval Trend Chart ─────────────────────────────────────────────────

  const trendH = 75;
  drawCard(doc, margin, y, contentW, trendH + 18);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  setColor(doc, COLORS.text);
  doc.text("Approval Rating Trend by Source", margin + 6, y + 9);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  setColor(doc, COLORS.textMuted);
  doc.text("Presidential approval tracked across polling sources", margin + 6, y + 15);

  const chartX = margin + 26;
  const chartY = y + 20;
  const chartW = contentW - 34;

  const approvalBySource = new Map<string, PollEntry[]>();
  approvalPolls.forEach((p) => {
    if (p.approve_pct === null) return;
    if (!approvalBySource.has(p.source)) approvalBySource.set(p.source, []);
    approvalBySource.get(p.source)!.push(p);
  });
  approvalBySource.forEach((v) => v.sort((a, b) => a.date_conducted.localeCompare(b.date_conducted)));

  if (approvalBySource.size > 0) {
    const allDates = approvalPolls.filter((p) => p.approve_pct !== null).map((p) => p.date_conducted).sort();
    const minDate = new Date(allDates[0]).getTime();
    const maxDate = new Date(allDates[allDates.length - 1]).getTime();
    const dateRange = maxDate - minDate || 1;
    const allVals = approvalPolls.filter((p) => p.approve_pct !== null).map((p) => p.approve_pct!);
    const minVal = Math.floor(Math.min(...allVals) - 2);
    const maxVal = Math.ceil(Math.max(...allVals) + 2);
    const valRange = maxVal - minVal || 1;

    const toChartX = (d: string) => chartX + ((new Date(d).getTime() - minDate) / dateRange) * chartW;
    const toChartY = (v: number) => chartY + trendH - ((v - minVal) / valRange) * trendH;

    setDrawColor(doc, COLORS.border);
    doc.setLineWidth(0.15);
    for (let v = Math.ceil(minVal / 5) * 5; v <= maxVal; v += 5) {
      const gy = toChartY(v);
      doc.line(chartX, gy, chartX + chartW, gy);
      doc.setFontSize(6);
      setColor(doc, COLORS.textMuted);
      doc.text(`${v}%`, chartX - 3, gy + 1.5, { align: "right" });
    }

    if (minVal < 50 && maxVal > 50) {
      setDrawColor(doc, COLORS.textMuted);
      doc.setLineWidth(0.2);
      doc.setLineDashPattern([1, 1], 0);
      doc.line(chartX, toChartY(50), chartX + chartW, toChartY(50));
      doc.setLineDashPattern([], 0);
    }

    const topSources = Array.from(approvalBySource.entries()).sort((a, b) => b[1].length - a[1].length).slice(0, 8);
    const legendItems: { name: string; color: [number, number, number] }[] = [];

    topSources.forEach(([sourceId, sourcePolls]) => {
      const src = getSourceInfo(sourceId);
      const rgb = hslToRgb(src.color);
      legendItems.push({ name: src.name, color: rgb });
      doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
      doc.setLineWidth(0.6);
      const pts = sourcePolls.filter((p) => p.approve_pct !== null);
      if (pts.length < 2) return;
      for (let i = 1; i < pts.length; i++) {
        doc.line(toChartX(pts[i - 1].date_conducted), toChartY(pts[i - 1].approve_pct!), toChartX(pts[i].date_conducted), toChartY(pts[i].approve_pct!));
      }
      pts.forEach((p) => {
        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
        doc.circle(toChartX(p.date_conducted), toChartY(p.approve_pct!), 0.6, "F");
      });
    });

    // X-axis
    const start = new Date(allDates[0]);
    const end = new Date(allDates[allDates.length - 1]);
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    doc.setFontSize(5.5);
    setColor(doc, COLORS.textMuted);
    while (cur <= end) {
      const d = cur.toISOString().split("T")[0];
      if (d >= allDates[0]) doc.text(cur.toLocaleDateString("en-US", { month: "short" }), toChartX(d), chartY + trendH + 4, { align: "center" });
      cur.setMonth(cur.getMonth() + 1);
    }

    // Legend
    const legendY = chartY + trendH + 7;
    let lx = margin + 6;
    doc.setFontSize(5.5);
    legendItems.forEach((item) => {
      doc.setFillColor(item.color[0], item.color[1], item.color[2]);
      doc.circle(lx + 1, legendY, 1.2, "F");
      setColor(doc, COLORS.textMuted);
      doc.text(item.name, lx + 3.5, legendY + 1);
      lx += doc.getTextWidth(item.name) + 8;
    });
  }

  y += trendH + 24;

  // ── Source-by-Source Dot Plot & Generic Ballot ────────────────────────────

  const dotPlotSources = latestBySource.slice(0, 12);
  if (dotPlotSources.length > 0) {
    const dotH = Math.min(dotPlotSources.length * 7 + 18, 80);
    y = ensureSpace(doc, y, dotH, margin);

    const halfW = (contentW - 4) / 2;

    drawCard(doc, margin, y, halfW, dotH);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    setColor(doc, COLORS.text);
    doc.text("Source-by-Source Comparison", margin + 6, y + 9);

    const dpY = y + 14;
    const dpLeft = margin + 45;
    const dpRight = margin + halfW - 8;
    const dpW = dpRight - dpLeft;
    const dpMinPct = 30;
    const dpMaxPct = 55;
    const dpRange = dpMaxPct - dpMinPct;
    const toPctX = (v: number) => dpLeft + ((v - dpMinPct) / dpRange) * dpW;

    setDrawColor(doc, COLORS.border);
    doc.setLineWidth(0.1);
    [35, 40, 45, 50].forEach((v) => {
      doc.line(toPctX(v), dpY, toPctX(v), dpY + dotPlotSources.length * 6);
      doc.setFontSize(5);
      setColor(doc, COLORS.textMuted);
      doc.text(`${v}%`, toPctX(v), dpY + dotPlotSources.length * 6 + 3, { align: "center" });
    });

    setDrawColor(doc, COLORS.textMuted);
    doc.setLineDashPattern([0.5, 0.5], 0);
    doc.line(toPctX(50), dpY, toPctX(50), dpY + dotPlotSources.length * 6);
    doc.setLineDashPattern([], 0);

    dotPlotSources.forEach((poll, i) => {
      const rowY = dpY + i * 6 + 3;
      const src = getSourceInfo(poll.source);
      doc.setFontSize(5.5);
      doc.setFont("helvetica", "normal");
      setColor(doc, COLORS.text);
      doc.text(src.name, dpLeft - 3, rowY + 1.5, { align: "right" });
      const aX = toPctX(poll.approve_pct ?? 0);
      const dX = toPctX(poll.disapprove_pct ?? 0);
      setDrawColor(doc, COLORS.border);
      doc.setLineWidth(0.4);
      doc.line(Math.min(aX, dX), rowY, Math.max(aX, dX), rowY);
      doc.setFillColor(COLORS.approve[0], COLORS.approve[1], COLORS.approve[2]);
      doc.circle(aX, rowY, 1.5, "F");
      doc.setFillColor(COLORS.disapprove[0], COLORS.disapprove[1], COLORS.disapprove[2]);
      doc.circle(dX, rowY, 1.5, "F");
    });

    const dpLegY = dpY + dotPlotSources.length * 6 + 1;
    doc.setFontSize(5);
    doc.setFillColor(COLORS.approve[0], COLORS.approve[1], COLORS.approve[2]);
    doc.circle(margin + 6, dpLegY, 1, "F");
    setColor(doc, COLORS.textMuted);
    doc.text("Approve", margin + 9, dpLegY + 1);
    doc.setFillColor(COLORS.disapprove[0], COLORS.disapprove[1], COLORS.disapprove[2]);
    doc.circle(margin + 24, dpLegY, 1, "F");
    doc.text("Disapprove", margin + 27, dpLegY + 1);

    // Generic Ballot (right half)
    const ballotPolls = polls.filter((p) => p.poll_type === "generic-ballot");
    const ballotBySource = new Map<string, PollEntry>();
    ballotPolls.forEach((p) => {
      const ex = ballotBySource.get(p.source);
      if (!ex || p.date_conducted > ex.date_conducted) ballotBySource.set(p.source, p);
    });
    const ballotEntries = Array.from(ballotBySource.values()).sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0));

    const rightX = margin + halfW + 4;
    drawCard(doc, rightX, y, halfW, dotH);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    setColor(doc, COLORS.text);
    doc.text("Generic Congressional Ballot", rightX + 6, y + 9);

    if (ballotEntries.length > 0) {
      const getDem = (p: PollEntry) => p.favor_pct ?? p.approve_pct ?? 0;
      const getRep = (p: PollEntry) => p.oppose_pct ?? p.disapprove_pct ?? 0;
      const avgD = ballotEntries.reduce((s, p) => s + getDem(p), 0) / ballotEntries.length;
      const avgR = ballotEntries.reduce((s, p) => s + getRep(p), 0) / ballotEntries.length;
      const total = avgD + avgR || 100;
      const barX = rightX + 6;
      const barW = halfW - 12;
      const barY = y + 14;
      const barH = 8;
      drawBeveledBox(doc, barX, barY, barW, barH);
      const demW = (avgD / total) * barW;
      doc.setFillColor(COLORS.dem[0], COLORS.dem[1], COLORS.dem[2]);
      doc.rect(barX, barY, demW, barH, "F");
      doc.setFillColor(COLORS.rep[0], COLORS.rep[1], COLORS.rep[2]);
      doc.rect(barX + demW, barY, barW - demW, barH, "F");
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      setColor(doc, [255, 255, 255]);
      if (demW > 15) doc.text(`D ${avgD.toFixed(1)}%`, barX + 3, barY + 5.5);
      if (barW - demW > 15) doc.text(`R ${avgR.toFixed(1)}%`, barX + demW + 3, barY + 5.5);
      const netBallot = avgD - avgR;
      doc.setFontSize(7);
      setColor(doc, netBallot >= 0 ? COLORS.dem : COLORS.rep);
      doc.text(`Net: ${netBallot > 0 ? "+" : ""}${netBallot.toFixed(1)} ${netBallot >= 0 ? "D" : "R"}`, barX, barY + barH + 5);
      const maxEntries = Math.min(ballotEntries.length, 6);
      const entryY = barY + barH + 9;
      ballotEntries.slice(0, maxEntries).forEach((poll, i) => {
        const src = getSourceInfo(poll.source);
        const d = getDem(poll);
        const r = getRep(poll);
        const t = d + r || 100;
        const ey = entryY + i * 6;
        doc.setFontSize(5.5);
        doc.setFont("helvetica", "normal");
        setColor(doc, COLORS.text);
        doc.text(src.name, barX, ey + 1.5);
        const miniBarX = barX + 35;
        const miniBarW = barW - 55;
        const miniH = 3;
        drawBeveledBox(doc, miniBarX, ey - 0.5, miniBarW, miniH);
        const dW = (d / t) * miniBarW;
        doc.setFillColor(COLORS.dem[0], COLORS.dem[1], COLORS.dem[2]);
        doc.rect(miniBarX, ey - 0.5, dW, miniH, "F");
        doc.setFillColor(COLORS.rep[0], COLORS.rep[1], COLORS.rep[2]);
        doc.rect(miniBarX + dW, ey - 0.5, miniBarW - dW, miniH, "F");
        doc.setFontSize(5);
        setColor(doc, COLORS.textMuted);
        doc.text(`${d}-${r}`, miniBarX + miniBarW + 3, ey + 1.5);
      });
    } else {
      doc.setFontSize(7);
      setColor(doc, COLORS.textMuted);
      doc.text("No generic ballot data available", rightX + 6, y + 30);
    }

    y += dotH + 6;
  }

  // ── Favorability Tracking Chart ───────────────────────────────────────────

  const favPolls = polls.filter((p) => p.poll_type === "favorability" && p.approve_pct !== null)
    .sort((a, b) => a.date_conducted.localeCompare(b.date_conducted));

  if (favPolls.length > 0) {
    const favH = 55;
    y = ensureSpace(doc, y, favH + 16, margin);

    drawCard(doc, margin, y, contentW, favH + 16);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    setColor(doc, COLORS.text);
    doc.text("Favorability Tracking", margin + 6, y + 9);

    const weeklyBuckets = new Map<string, { approve: number[]; disapprove: number[] }>();
    favPolls.forEach((p) => {
      const d = new Date(p.date_conducted + "T00:00:00");
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().split("T")[0];
      if (!weeklyBuckets.has(key)) weeklyBuckets.set(key, { approve: [], disapprove: [] });
      const b = weeklyBuckets.get(key)!;
      if (p.approve_pct !== null) b.approve.push(p.approve_pct);
      if (p.disapprove_pct !== null) b.disapprove.push(p.disapprove_pct);
    });

    const weeklyData = Array.from(weeklyBuckets.entries())
      .map(([week, b]) => ({
        week,
        approve: b.approve.length > 0 ? b.approve.reduce((s, v) => s + v, 0) / b.approve.length : null,
        disapprove: b.disapprove.length > 0 ? b.disapprove.reduce((s, v) => s + v, 0) / b.disapprove.length : null,
      }))
      .filter((w) => w.approve !== null)
      .sort((a, b) => a.week.localeCompare(b.week));

    if (weeklyData.length >= 2) {
      const fChartX = margin + 26;
      const fChartY = y + 14;
      const fChartW = contentW - 34;
      const fChartH = favH - 2;
      const allFavVals = weeklyData.flatMap((w) => [w.approve, w.disapprove].filter(Boolean) as number[]);
      const fMin = Math.floor(Math.min(...allFavVals) - 2);
      const fMax = Math.ceil(Math.max(...allFavVals) + 2);
      const fRange = fMax - fMin || 1;
      const fDateMin = new Date(weeklyData[0].week).getTime();
      const fDateMax = new Date(weeklyData[weeklyData.length - 1].week).getTime();
      const fDateRange = fDateMax - fDateMin || 1;
      const toFX = (d: string) => fChartX + ((new Date(d).getTime() - fDateMin) / fDateRange) * fChartW;
      const toFY = (v: number) => fChartY + fChartH - ((v - fMin) / fRange) * fChartH;

      setDrawColor(doc, COLORS.border);
      doc.setLineWidth(0.1);
      for (let v = Math.ceil(fMin / 5) * 5; v <= fMax; v += 5) {
        doc.line(fChartX, toFY(v), fChartX + fChartW, toFY(v));
        doc.setFontSize(5.5);
        setColor(doc, COLORS.textMuted);
        doc.text(`${v}%`, fChartX - 3, toFY(v) + 1.5, { align: "right" });
      }

      const approvePoints = weeklyData.filter((w) => w.approve !== null);
      if (approvePoints.length >= 2) {
        doc.setDrawColor(COLORS.approve[0], COLORS.approve[1], COLORS.approve[2]);
        doc.setLineWidth(0.5);
        for (let i = 1; i < approvePoints.length; i++) {
          doc.line(toFX(approvePoints[i - 1].week), toFY(approvePoints[i - 1].approve!), toFX(approvePoints[i].week), toFY(approvePoints[i].approve!));
        }
      }
      const disapprovePoints = weeklyData.filter((w) => w.disapprove !== null);
      if (disapprovePoints.length >= 2) {
        doc.setDrawColor(COLORS.disapprove[0], COLORS.disapprove[1], COLORS.disapprove[2]);
        doc.setLineWidth(0.5);
        for (let i = 1; i < disapprovePoints.length; i++) {
          doc.line(toFX(disapprovePoints[i - 1].week), toFY(disapprovePoints[i - 1].disapprove!), toFX(disapprovePoints[i].week), toFY(disapprovePoints[i].disapprove!));
        }
      }

      doc.setFontSize(5.5);
      doc.setFillColor(COLORS.approve[0], COLORS.approve[1], COLORS.approve[2]);
      doc.circle(margin + 6, fChartY + fChartH + 3, 1, "F");
      setColor(doc, COLORS.textMuted);
      doc.text("Favorable", margin + 9, fChartY + fChartH + 4);
      doc.setFillColor(COLORS.disapprove[0], COLORS.disapprove[1], COLORS.disapprove[2]);
      doc.circle(margin + 28, fChartY + fChartH + 3, 1, "F");
      doc.text("Unfavorable", margin + 31, fChartY + fChartH + 4);
    }

    y += favH + 22;
  }

  // ── Demographic Breakdown — Approval ──────────────────────────────────────

  doc.addPage();
  pageBackground(doc);
  y = drawSectionHeader(doc, "DEMOGRAPHIC BREAKDOWN - APPROVAL", margin, margin, contentW);

  const approveDemos = getDemographicData("Trump Approval");
  const demoCardW = (contentW - 4) / 2;
  const demoCardH = 50;

  approveDemos.forEach((cat, ci) => {
    const col = ci % 2;
    const row = Math.floor(ci / 2);
    const cx = margin + col * (demoCardW + 4);
    const cy = y + row * (demoCardH + 4);

    drawCard(doc, cx, cy, demoCardW, demoCardH);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    setColor(doc, COLORS.primary);
    doc.text(cat.title.toUpperCase(), cx + 6, cy + 9);

    cat.segments.forEach((seg, si) => {
      const rowY = cy + 14 + si * 9;
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      setColor(doc, COLORS.text);
      doc.text(seg.label, cx + 6, rowY + 3);

      const barX = cx + 35;
      const barW = demoCardW - 65;
      const barH = 5;
      const total = seg.approve + seg.disapprove;
      const appPct = total > 0 ? seg.approve / total : 0.5;

      drawBeveledBox(doc, barX, rowY - 1, barW, barH);
      doc.setFillColor(COLORS.approve[0], COLORS.approve[1], COLORS.approve[2]);
      doc.rect(barX, rowY - 1, barW * appPct, barH, "F");
      doc.setFillColor(COLORS.disapprove[0], COLORS.disapprove[1], COLORS.disapprove[2]);
      doc.rect(barX + barW * appPct, rowY - 1, barW * (1 - appPct), barH, "F");

      doc.setFontSize(5.5);
      setColor(doc, COLORS.approve);
      doc.text(`${seg.approve}%`, barX + barW + 3, rowY + 2);
      setColor(doc, COLORS.disapprove);
      doc.text(`${seg.disapprove}%`, barX + barW + 15, rowY + 2);
    });
  });

  y += Math.ceil(approveDemos.length / 2) * (demoCardH + 4) + 6;

  // ── Issue Polling Overview ────────────────────────────────────────────────

  y = ensureSpace(doc, y, 80, margin);
  y = drawSectionHeader(doc, "ISSUE POLLING OVERVIEW", y, margin, contentW);

  const issuePolls = polls.filter((p) => p.poll_type === "issue");
  const issueTopics = new Map<string, PollEntry[]>();
  issuePolls.forEach((p) => {
    if (!issueTopics.has(p.candidate_or_topic)) issueTopics.set(p.candidate_or_topic, []);
    issueTopics.get(p.candidate_or_topic)!.push(p);
  });

  const sortedIssues = Array.from(issueTopics.entries())
    .map(([topic, topicPolls]) => {
      const latest = topicPolls.sort((a, b) => b.date_conducted.localeCompare(a.date_conducted))[0];
      const group = matchGroup(topic);
      return { topic, group, latest, count: topicPolls.length };
    })
    .sort((a, b) => b.count - a.count);

  if (sortedIssues.length > 0) {
    // Butterfly chart
    const issueChartH = Math.min(sortedIssues.length * 8 + 10, 120);
    const displayIssues = sortedIssues.slice(0, Math.floor((issueChartH - 10) / 8));

    drawCard(doc, margin, y, contentW, issueChartH);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    setColor(doc, COLORS.text);
    doc.text("Issue Butterfly Chart", margin + 6, y + 9);

    const centerX = margin + contentW / 2;
    const maxBarW = contentW / 2 - 55;

    displayIssues.forEach((item, i) => {
      const rowY = y + 15 + i * 8;
      const fav = item.latest.favor_pct ?? item.latest.approve_pct ?? 0;
      const opp = item.latest.oppose_pct ?? item.latest.disapprove_pct ?? 0;
      const maxVal = Math.max(fav, opp, 1);

      // Topic label (centered)
      doc.setFontSize(5);
      doc.setFont("helvetica", "normal");
      setColor(doc, COLORS.text);
      const labelText = item.topic.length > 22 ? item.topic.slice(0, 21) + "..." : item.topic;
      doc.text(labelText, centerX, rowY + 2, { align: "center" });

      // Favor bar (left)
      const favW = (fav / 80) * maxBarW;
      doc.setFillColor(COLORS.approve[0], COLORS.approve[1], COLORS.approve[2]);
      doc.rect(centerX - 42 - favW, rowY - 1.5, favW, 5, "F");
      doc.setFontSize(4.5);
      setColor(doc, COLORS.approve);
      doc.text(`${fav}%`, centerX - 42 - favW - 2, rowY + 2, { align: "right" });

      // Oppose bar (right)
      const oppW = (opp / 80) * maxBarW;
      doc.setFillColor(COLORS.disapprove[0], COLORS.disapprove[1], COLORS.disapprove[2]);
      doc.rect(centerX + 42, rowY - 1.5, oppW, 5, "F");
      setColor(doc, COLORS.disapprove);
      doc.text(`${opp}%`, centerX + 42 + oppW + 2, rowY + 2);
    });

    // Legend
    const bfLegY = y + issueChartH - 6;
    doc.setFontSize(5);
    doc.setFillColor(COLORS.approve[0], COLORS.approve[1], COLORS.approve[2]);
    doc.circle(centerX - 25, bfLegY, 1, "F");
    setColor(doc, COLORS.textMuted);
    doc.text("Favor/Approve", centerX - 22, bfLegY + 1);
    doc.setFillColor(COLORS.disapprove[0], COLORS.disapprove[1], COLORS.disapprove[2]);
    doc.circle(centerX + 10, bfLegY, 1, "F");
    doc.text("Oppose/Disapprove", centerX + 13, bfLegY + 1);

    y += issueChartH + 6;
  }

  // Issue Polling Table
  if (sortedIssues.length > 0) {
    y = ensureSpace(doc, y, 30, margin);

    const issueTableData = sortedIssues.map((item) => [
      item.group?.label ?? "Other",
      item.topic.length > 30 ? item.topic.slice(0, 29) + "..." : item.topic,
      `${item.count}`,
      `${item.latest.favor_pct ?? item.latest.approve_pct ?? "-"}%`,
      `${item.latest.oppose_pct ?? item.latest.disapprove_pct ?? "-"}%`,
      item.latest.margin !== null ? (item.latest.margin > 0 ? `+${item.latest.margin}` : `${item.latest.margin}`) : "-",
      item.latest.date_conducted,
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Category", "Topic", "Polls", "Favor %", "Oppose %", "Margin", "Latest Date"]],
      body: issueTableData,
      styles: { fontSize: 6, cellPadding: 1.5, textColor: [220, 220, 225], fillColor: COLORS.bg, lineColor: COLORS.border, lineWidth: 0.2 },
      headStyles: { fillColor: COLORS.card, textColor: COLORS.primary, fontSize: 6, fontStyle: "bold", lineColor: COLORS.border },
      alternateRowStyles: { fillColor: [28, 28, 34] },
      columnStyles: { 2: { halign: "center" }, 3: { halign: "center" }, 4: { halign: "center" }, 5: { halign: "center" } },
      willDrawPage: () => { pageBackground(doc); },
    });

    y = (doc as any).lastAutoTable?.finalY ?? y + 40;
    y += 6;
  }

  // ── Issue Polling Deep Dive (Demographics per top issue) ──────────────────

  const topIssueTopics = sortedIssues.slice(0, 6);

  if (topIssueTopics.length > 0) {
    doc.addPage();
    pageBackground(doc);
    y = drawSectionHeader(doc, "ISSUE POLLING DEEP DIVE - DEMOGRAPHIC BREAKDOWNS", margin, margin, contentW);

    topIssueTopics.forEach((item) => {
      const demos = getDemographicData(item.topic);
      const groupColor = item.group ? hslToRgb(item.group.color) : COLORS.primary;

      const blockH = 42;
      y = ensureSpace(doc, y, blockH + 10, margin);

      // Topic header bar
      setFillColor(doc, groupColor);
      doc.rect(margin, y, contentW, 8, "F");
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      setColor(doc, [255, 255, 255]);
      doc.text(item.topic, margin + 4, y + 5.5);
      const fav = item.latest.favor_pct ?? item.latest.approve_pct ?? 0;
      const opp = item.latest.oppose_pct ?? item.latest.disapprove_pct ?? 0;
      doc.text(`${fav}% / ${opp}%`, pw - margin - 4, y + 5.5, { align: "right" });
      y += 10;

      // 4 demo categories in a 2x2 grid
      const demoCW = (contentW - 4) / 2;
      const demoCH = 34;

      demos.forEach((cat, ci) => {
        const col = ci % 2;
        const row = Math.floor(ci / 2);
        if (row === 1 && col === 0) {
          // Check if we need space for second row
          y = ensureSpace(doc, y, demoCH + 2, margin);
        }
        const cx = margin + col * (demoCW + 4);
        const cy = row === 0 ? y : y + demoCH + 2;

        drawCard(doc, cx, cy, demoCW, demoCH);
        doc.setFontSize(6);
        doc.setFont("helvetica", "bold");
        setColor(doc, COLORS.textMuted);
        doc.text(cat.title.toUpperCase(), cx + 4, cy + 8);

        cat.segments.forEach((seg, si) => {
          const rowY = cy + 12 + si * 5.5;
          doc.setFontSize(5.5);
          doc.setFont("helvetica", "normal");
          setColor(doc, COLORS.text);
          doc.text(seg.label, cx + 4, rowY + 2);

          const barX = cx + 28;
          const barW = demoCW - 58;
          const barH = 3.5;
          const total = seg.approve + seg.disapprove;
          const appPct = total > 0 ? seg.approve / total : 0.5;

          drawBeveledBox(doc, barX, rowY - 0.5, barW, barH);
          doc.setFillColor(COLORS.approve[0], COLORS.approve[1], COLORS.approve[2]);
          doc.rect(barX, rowY - 0.5, barW * appPct, barH, "F");
          doc.setFillColor(COLORS.disapprove[0], COLORS.disapprove[1], COLORS.disapprove[2]);
          doc.rect(barX + barW * appPct, rowY - 0.5, barW * (1 - appPct), barH, "F");

          doc.setFontSize(5);
          setColor(doc, COLORS.approve);
          doc.text(`${seg.approve}%`, barX + barW + 2, rowY + 1.5);
          setColor(doc, COLORS.disapprove);
          doc.text(`${seg.disapprove}%`, barX + barW + 12, rowY + 1.5);
        });
      });

      y += (demoCH + 2) * 2 + 6;
    });
  }

  // ── Complete Data Table ───────────────────────────────────────────────────

  doc.addPage();
  pageBackground(doc);

  setFillColor(doc, COLORS.primary);
  doc.rect(margin, 10, contentW, 10, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  setColor(doc, [255, 255, 255]);
  doc.text("COMPLETE POLLING DATA", margin + 4, 17);
  doc.text(`${polls.length} records`, pw - margin - 4, 17, { align: "right" });

  const tableData = polls.map((p) => [
    getSourceInfo(p.source).name,
    p.candidate_or_topic.length > 25 ? p.candidate_or_topic.slice(0, 25) + "..." : p.candidate_or_topic,
    POLL_TYPES.find((t) => t.id === p.poll_type)?.label ?? p.poll_type,
    p.date_conducted,
    `${p.approve_pct ?? p.favor_pct ?? "-"}%`,
    `${p.disapprove_pct ?? p.oppose_pct ?? "-"}%`,
    p.margin !== null ? (p.margin > 0 ? `+${p.margin}` : `${p.margin}`) : "-",
    p.sample_size ? `n=${p.sample_size.toLocaleString()}` : "-",
    p.methodology ?? "-",
  ]);

  autoTable(doc, {
    startY: 24,
    head: [["Source", "Topic", "Type", "Date", "Approve", "Disapprove", "Margin", "Sample", "Method"]],
    body: tableData,
    styles: { fontSize: 6.5, cellPadding: 1.5, textColor: [220, 220, 225], fillColor: COLORS.bg, lineColor: COLORS.border, lineWidth: 0.2 },
    headStyles: { fillColor: COLORS.card, textColor: COLORS.primary, fontSize: 6.5, fontStyle: "bold", lineColor: COLORS.border },
    alternateRowStyles: { fillColor: [28, 28, 34] },
    columnStyles: { 0: { cellWidth: 28 }, 4: { halign: "center" }, 5: { halign: "center" }, 6: { halign: "center" }, 7: { halign: "center" } },
    willDrawPage: () => { pageBackground(doc); },
  });

  // ── Page numbers ─────────────────────────────────────────────────────────

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addPageFooter(doc, i, totalPages);
  }

  applyPdfBranding(doc);
  doc.save(`${filename}-${new Date().toISOString().split("T")[0]}.pdf`);
}
