import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getSourceInfo, POLL_TYPES, type PollEntry } from "@/data/pollingData";

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

// ─── PDF Export ─────────────────────────────────────────────────────────────

export function exportPollingPDF(polls: PollEntry[], filename = "polling-report") {
  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.width;
  let y = 15;

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Polling Data Report", 14, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} • ${polls.length} polls from ${new Set(polls.map((p) => p.source)).size} sources`, 14, y);
  y += 10;
  doc.setTextColor(0);

  // Summary section
  const approvalPolls = polls.filter((p) => p.poll_type === "approval" && p.candidate_or_topic === "Trump Approval");
  if (approvalPolls.length > 0) {
    // Latest by source
    const latestMap = new Map<string, PollEntry>();
    approvalPolls.forEach((p) => {
      const ex = latestMap.get(p.source);
      if (!ex || p.date_conducted > ex.date_conducted) latestMap.set(p.source, p);
    });
    const latest = Array.from(latestMap.values());
    const avgApprove = latest.reduce((s, p) => s + (p.approve_pct ?? 0), 0) / latest.length;
    const avgDisapprove = latest.reduce((s, p) => s + (p.disapprove_pct ?? 0), 0) / latest.length;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Summary: Presidential Approval", 14, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Cross-Source Average: ${avgApprove.toFixed(1)}% approve / ${avgDisapprove.toFixed(1)}% disapprove (margin: ${(avgApprove - avgDisapprove).toFixed(1)})`, 14, y);
    y += 5;
    doc.text(`Based on ${latest.length} sources, latest polls conducted between ${approvalPolls[approvalPolls.length - 1]?.date_conducted} and ${approvalPolls[0]?.date_conducted}`, 14, y);
    y += 10;
  }

  // Main data table
  const tableData = polls.map((p) => [
    getSourceInfo(p.source).name,
    p.candidate_or_topic,
    POLL_TYPES.find((t) => t.id === p.poll_type)?.label ?? p.poll_type,
    p.date_conducted,
    `${p.approve_pct ?? p.favor_pct ?? "—"}%`,
    `${p.disapprove_pct ?? p.oppose_pct ?? "—"}%`,
    p.margin !== null ? (p.margin > 0 ? `+${p.margin}` : `${p.margin}`) : "—",
    p.sample_size ? `n=${p.sample_size.toLocaleString()}` : "—",
    p.methodology ?? "—",
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Source", "Topic", "Type", "Date", "Approve/Favor", "Disapprove/Oppose", "Margin", "Sample", "Method"]],
    body: tableData,
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [40, 40, 40], fontSize: 7.5, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 30 },
      4: { halign: "center" },
      5: { halign: "center" },
      6: { halign: "center" },
      7: { halign: "center" },
    },
  });

  // Source attribution footer on last page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${pageCount} • Sources: YouGov, Fox News, Emerson College, Reuters/Ipsos, FiveThirtyEight, AP-NORC, RealClearPolitics, Gallup, Rasmussen, Cook, Atlas Intel, CNN/SSRS`,
      14,
      doc.internal.pageSize.height - 8
    );
  }

  doc.save(`${filename}-${new Date().toISOString().split("T")[0]}.pdf`);
}
