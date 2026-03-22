import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getSourceInfo, POLLING_SOURCES, POLL_TYPES, type PollEntry } from "@/data/pollingData";

// ─── Theme colors (Win98-inspired) ──────────────────────────────────────────

const COLORS = {
  bg: [24, 24, 28] as [number, number, number],
  card: [32, 32, 38] as [number, number, number],
  border: [55, 55, 65] as [number, number, number],
  text: [240, 240, 245] as [number, number, number],
  textMuted: [140, 140, 155] as [number, number, number],
  primary: [0, 128, 128] as [number, number, number],     // teal
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
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
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

// ─── CSV Export ─────────────────────────────────────────────────────────────

export function exportPollingCSV(polls: PollEntry[], filename = "polling-data") {
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

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function setColor(doc: jsPDF, c: [number, number, number]) {
  doc.setTextColor(c[0], c[1], c[2]);
}

function setFillColor(doc: jsPDF, c: [number, number, number]) {
  doc.setFillColor(c[0], c[1], c[2]);
}

function setDrawColor(doc: jsPDF, c: [number, number, number]) {
  doc.setDrawColor(c[0], c[1], c[2]);
}

function drawCard(doc: jsPDF, x: number, y: number, w: number, h: number) {
  // Card background
  setFillColor(doc, COLORS.card);
  doc.roundedRect(x, y, w, h, 2, 2, "F");
  // Border
  setDrawColor(doc, COLORS.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2, 2, "S");
}

function drawBeveledBox(doc: jsPDF, x: number, y: number, w: number, h: number) {
  // Win98 sunken border effect
  setFillColor(doc, [20, 20, 24]);
  doc.rect(x, y, w, h, "F");
  // Top-left shadow (darker)
  setDrawColor(doc, [15, 15, 18]);
  doc.setLineWidth(0.5);
  doc.line(x, y, x + w, y);
  doc.line(x, y, x, y + h);
  // Bottom-right highlight
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
  // Footer bar
  setFillColor(doc, COLORS.card);
  doc.rect(0, ph - 12, pw, 12, "F");
  setDrawColor(doc, COLORS.border);
  doc.line(0, ph - 12, pw, ph - 12);
  doc.setFontSize(7);
  setColor(doc, COLORS.textMuted);
  doc.text(`Page ${pageNum} of ${totalPages}`, 14, ph - 5);
  doc.text("OPPO Research Database • Polling Report", pw - 14, ph - 5, { align: "right" });
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

  // Title bar (Win98 style)
  setFillColor(doc, COLORS.primary);
  doc.rect(0, 0, pw, 22, "F");
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  setColor(doc, [255, 255, 255]);
  doc.text("Polling Data Report", margin, 14);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} • ${polls.length} polls from ${new Set(polls.map((p) => p.source)).size} sources`,
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

  const avgApprove = latestBySource.length > 0
    ? latestBySource.reduce((s, p) => s + (p.approve_pct ?? 0), 0) / latestBySource.length : 0;
  const avgDisapprove = latestBySource.length > 0
    ? latestBySource.reduce((s, p) => s + (p.disapprove_pct ?? 0), 0) / latestBySource.length : 0;
  const netApproval = avgApprove - avgDisapprove;

  // Three stat cards
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

  // Chart area
  const chartX = margin + 26;
  const chartY = y + 20;
  const chartW = contentW - 34;

  // Gather approval data by source
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

    // Grid lines
    setDrawColor(doc, COLORS.border);
    doc.setLineWidth(0.15);
    for (let v = Math.ceil(minVal / 5) * 5; v <= maxVal; v += 5) {
      const gy = toChartY(v);
      doc.line(chartX, gy, chartX + chartW, gy);
      doc.setFontSize(6);
      setColor(doc, COLORS.textMuted);
      doc.text(`${v}%`, chartX - 3, gy + 1.5, { align: "right" });
    }

    // 50% reference line
    if (minVal < 50 && maxVal > 50) {
      setDrawColor(doc, COLORS.textMuted);
      doc.setLineWidth(0.2);
      doc.setLineDashPattern([1, 1], 0);
      doc.line(chartX, toChartY(50), chartX + chartW, toChartY(50));
      doc.setLineDashPattern([], 0);
    }

    // Draw lines per source (top 8 sources by count)
    const topSources = Array.from(approvalBySource.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 8);

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
        doc.line(
          toChartX(pts[i - 1].date_conducted),
          toChartY(pts[i - 1].approve_pct!),
          toChartX(pts[i].date_conducted),
          toChartY(pts[i].approve_pct!)
        );
      }

      // Dots
      pts.forEach((p) => {
        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
        doc.circle(toChartX(p.date_conducted), toChartY(p.approve_pct!), 0.6, "F");
      });
    });

    // X-axis date labels
    const start = new Date(allDates[0]);
    const end = new Date(allDates[allDates.length - 1]);
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    doc.setFontSize(5.5);
    setColor(doc, COLORS.textMuted);
    while (cur <= end) {
      const d = cur.toISOString().split("T")[0];
      if (d >= allDates[0]) {
        doc.text(cur.toLocaleDateString("en-US", { month: "short" }), toChartX(d), chartY + trendH + 4, { align: "center" });
      }
      cur.setMonth(cur.getMonth() + 1);
    }

    // Legend row
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

  // ── Source Dot Plot ───────────────────────────────────────────────────────

  const dotPlotSources = latestBySource.slice(0, 12);
  if (dotPlotSources.length > 0) {
    const dotH = Math.min(dotPlotSources.length * 7 + 18, 80);
    
    // Check if we need a new page
    if (y + dotH > ph - 20) {
      doc.addPage();
      pageBackground(doc);
      y = 14;
    }

    // Left half: dot plot, right half: generic ballot
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

    // Grid
    setDrawColor(doc, COLORS.border);
    doc.setLineWidth(0.1);
    [35, 40, 45, 50].forEach((v) => {
      doc.line(toPctX(v), dpY, toPctX(v), dpY + dotPlotSources.length * 6);
      doc.setFontSize(5);
      setColor(doc, COLORS.textMuted);
      doc.text(`${v}%`, toPctX(v), dpY + dotPlotSources.length * 6 + 3, { align: "center" });
    });

    // 50% dashed line
    setDrawColor(doc, COLORS.textMuted);
    doc.setLineDashPattern([0.5, 0.5], 0);
    doc.line(toPctX(50), dpY, toPctX(50), dpY + dotPlotSources.length * 6);
    doc.setLineDashPattern([], 0);

    dotPlotSources.forEach((poll, i) => {
      const rowY = dpY + i * 6 + 3;
      const src = getSourceInfo(poll.source);

      // Source name
      doc.setFontSize(5.5);
      doc.setFont("helvetica", "normal");
      setColor(doc, COLORS.text);
      doc.text(src.name, dpLeft - 3, rowY + 1.5, { align: "right" });

      // Connector line
      const aX = toPctX(poll.approve_pct ?? 0);
      const dX = toPctX(poll.disapprove_pct ?? 0);
      setDrawColor(doc, COLORS.border);
      doc.setLineWidth(0.4);
      doc.line(Math.min(aX, dX), rowY, Math.max(aX, dX), rowY);

      // Approve dot (green)
      doc.setFillColor(COLORS.approve[0], COLORS.approve[1], COLORS.approve[2]);
      doc.circle(aX, rowY, 1.5, "F");

      // Disapprove dot (red)
      doc.setFillColor(COLORS.disapprove[0], COLORS.disapprove[1], COLORS.disapprove[2]);
      doc.circle(dX, rowY, 1.5, "F");
    });

    // Legend
    const dpLegY = dpY + dotPlotSources.length * 6 + 1;
    doc.setFontSize(5);
    doc.setFillColor(COLORS.approve[0], COLORS.approve[1], COLORS.approve[2]);
    doc.circle(margin + 6, dpLegY, 1, "F");
    setColor(doc, COLORS.textMuted);
    doc.text("Approve", margin + 9, dpLegY + 1);
    doc.setFillColor(COLORS.disapprove[0], COLORS.disapprove[1], COLORS.disapprove[2]);
    doc.circle(margin + 24, dpLegY, 1, "F");
    doc.text("Disapprove", margin + 27, dpLegY + 1);

    // ── Generic Ballot (right half) ──────────────────────────────────────────

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

      // Average bar
      const barX = rightX + 6;
      const barW = halfW - 12;
      const barY = y + 14;
      const barH = 8;

      drawBeveledBox(doc, barX, barY, barW, barH);

      // Dem portion
      const demW = (avgD / total) * barW;
      doc.setFillColor(COLORS.dem[0], COLORS.dem[1], COLORS.dem[2]);
      doc.rect(barX, barY, demW, barH, "F");
      // Rep portion
      doc.setFillColor(COLORS.rep[0], COLORS.rep[1], COLORS.rep[2]);
      doc.rect(barX + demW, barY, barW - demW, barH, "F");

      // Labels on bar
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      setColor(doc, [255, 255, 255]);
      if (demW > 15) doc.text(`D ${avgD.toFixed(1)}%`, barX + 3, barY + 5.5);
      if (barW - demW > 15) doc.text(`R ${avgR.toFixed(1)}%`, barX + demW + 3, barY + 5.5);

      // Net margin
      const netBallot = avgD - avgR;
      doc.setFontSize(7);
      setColor(doc, netBallot >= 0 ? COLORS.dem : COLORS.rep);
      doc.text(`Net: ${netBallot > 0 ? "+" : ""}${netBallot.toFixed(1)} ${netBallot >= 0 ? "D" : "R"}`, barX, barY + barH + 5);

      // Per-source breakdown
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

        // Mini bar
        const miniBarX = barX + 35;
        const miniBarW = barW - 55;
        const miniH = 3;
        drawBeveledBox(doc, miniBarX, ey - 0.5, miniBarW, miniH);
        const dW = (d / t) * miniBarW;
        doc.setFillColor(COLORS.dem[0], COLORS.dem[1], COLORS.dem[2]);
        doc.rect(miniBarX, ey - 0.5, dW, miniH, "F");
        doc.setFillColor(COLORS.rep[0], COLORS.rep[1], COLORS.rep[2]);
        doc.rect(miniBarX + dW, ey - 0.5, miniBarW - dW, miniH, "F");

        // Values
        doc.setFontSize(5);
        setColor(doc, COLORS.textMuted);
        doc.text(`${d}–${r}`, miniBarX + miniBarW + 3, ey + 1.5);
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
    if (y + favH + 16 > ph - 20) {
      doc.addPage();
      pageBackground(doc);
      y = 14;
    }

    drawCard(doc, margin, y, contentW, favH + 16);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    setColor(doc, COLORS.text);
    doc.text("Favorability Tracking", margin + 6, y + 9);

    // Aggregate by week
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

      // Grid
      setDrawColor(doc, COLORS.border);
      doc.setLineWidth(0.1);
      for (let v = Math.ceil(fMin / 5) * 5; v <= fMax; v += 5) {
        doc.line(fChartX, toFY(v), fChartX + fChartW, toFY(v));
        doc.setFontSize(5.5);
        setColor(doc, COLORS.textMuted);
        doc.text(`${v}%`, fChartX - 3, toFY(v) + 1.5, { align: "right" });
      }

      // Approve area fill
      const approvePoints = weeklyData.filter((w) => w.approve !== null);
      if (approvePoints.length >= 2) {
        // Line
        doc.setDrawColor(COLORS.approve[0], COLORS.approve[1], COLORS.approve[2]);
        doc.setLineWidth(0.5);
        for (let i = 1; i < approvePoints.length; i++) {
          doc.line(
            toFX(approvePoints[i - 1].week), toFY(approvePoints[i - 1].approve!),
            toFX(approvePoints[i].week), toFY(approvePoints[i].approve!)
          );
        }
      }

      // Disapprove line
      const disapprovePoints = weeklyData.filter((w) => w.disapprove !== null);
      if (disapprovePoints.length >= 2) {
        doc.setDrawColor(COLORS.disapprove[0], COLORS.disapprove[1], COLORS.disapprove[2]);
        doc.setLineWidth(0.5);
        for (let i = 1; i < disapprovePoints.length; i++) {
          doc.line(
            toFX(disapprovePoints[i - 1].week), toFY(disapprovePoints[i - 1].disapprove!),
            toFX(disapprovePoints[i].week), toFY(disapprovePoints[i].disapprove!)
          );
        }
      }

      // Legend
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

  // ── PAGE 2+: Data Table ──────────────────────────────────────────────────

  doc.addPage();
  pageBackground(doc);

  // Section header
  setFillColor(doc, COLORS.primary);
  doc.rect(margin, 10, contentW, 10, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  setColor(doc, [255, 255, 255]);
  doc.text("COMPLETE POLLING DATA", margin + 4, 17);
  doc.text(`${polls.length} records`, pw - margin - 4, 17, { align: "right" });

  const tableData = polls.map((p) => [
    getSourceInfo(p.source).name,
    p.candidate_or_topic.length > 25 ? p.candidate_or_topic.slice(0, 25) + "…" : p.candidate_or_topic,
    POLL_TYPES.find((t) => t.id === p.poll_type)?.label ?? p.poll_type,
    p.date_conducted,
    `${p.approve_pct ?? p.favor_pct ?? "—"}%`,
    `${p.disapprove_pct ?? p.oppose_pct ?? "—"}%`,
    p.margin !== null ? (p.margin > 0 ? `+${p.margin}` : `${p.margin}`) : "—",
    p.sample_size ? `n=${p.sample_size.toLocaleString()}` : "—",
    p.methodology ?? "—",
  ]);

  autoTable(doc, {
    startY: 24,
    head: [["Source", "Topic", "Type", "Date", "Approve", "Disapprove", "Margin", "Sample", "Method"]],
    body: tableData,
    styles: {
      fontSize: 6.5,
      cellPadding: 1.5,
      textColor: [220, 220, 225],
      fillColor: COLORS.bg,
      lineColor: COLORS.border,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: COLORS.card,
      textColor: COLORS.primary,
      fontSize: 6.5,
      fontStyle: "bold",
      lineColor: COLORS.border,
    },
    alternateRowStyles: {
      fillColor: [28, 28, 34],
    },
    columnStyles: {
      0: { cellWidth: 28 },
      4: { halign: "center" },
      5: { halign: "center" },
      6: { halign: "center" },
      7: { halign: "center" },
    },
    willDrawPage: () => {
      pageBackground(doc);
    },
  });

  // ── Add page numbers ─────────────────────────────────────────────────────

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addPageFooter(doc, i, totalPages);
  }

  doc.save(`${filename}-${new Date().toISOString().split("T")[0]}.pdf`);
}
