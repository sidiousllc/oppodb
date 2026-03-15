import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ElectionCandidate {
  candidate_name: string;
  party: string | null;
  votes: number | null;
  vote_pct: number | null;
  is_winner: boolean;
}

interface ElectionCycleData {
  year: number;
  date: string | null;
  type: string;
  candidates: ElectionCandidate[];
  totalVotes: number;
}

export function exportElectionResultsPDF(
  cycles: ElectionCycleData[],
  title: string,
  subtitle: string,
) {
  if (cycles.length === 0) return;

  const doc = new jsPDF();
  const margin = 14;
  let y = 20;

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("ELECTION HISTORY", margin, y);
  y += 8;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  const titleLines = doc.splitTextToSize(title, doc.internal.pageSize.width - margin * 2);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 8 + 2;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(subtitle, margin, y);
  y += 5;

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Generated ${new Date().toLocaleDateString()} • ${cycles.length} election cycles`, margin, y);
  y += 8;
  doc.setTextColor(0);

  for (const cycle of cycles) {
    if (y > doc.internal.pageSize.height - 50) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`${cycle.year} ${cycle.type.charAt(0).toUpperCase() + cycle.type.slice(1)}`, margin, y);
    y += 3;

    const body = cycle.candidates.map((c) => [
      c.is_winner ? "✓" : "",
      c.candidate_name,
      c.party || "—",
      c.votes != null ? c.votes.toLocaleString() : "—",
      c.vote_pct != null ? `${c.vote_pct}%` : "—",
    ]);

    autoTable(doc, {
      startY: y,
      head: [["", "Candidate", "Party", "Votes", "Vote %"]],
      body,
      theme: "striped",
      headStyles: { fillColor: [55, 65, 81], fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        3: { halign: "right" },
        4: { halign: "right" },
      },
      margin: { left: margin },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${pageCount} • Source: OpenElections`,
      margin,
      doc.internal.pageSize.height - 8,
    );
  }

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  doc.save(`${slug}-elections.pdf`);
}
