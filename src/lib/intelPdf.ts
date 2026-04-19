/**
 * Shared full-article PDF rendering for Intel briefings.
 * Renders title + metadata + full article body with proper text wrapping
 * and automatic page breaks (no truncation, no clipping).
 */
import jsPDF from "jspdf";
import { format } from "date-fns";
import { applyPdfBranding } from "@/lib/pdfBranding";

export interface IntelArticleForPdf {
  title: string;
  source: string;
  pubDate?: string | null;
  link?: string | null;
  summary?: string | null;
  /** Full scraped markdown/text body. Optional — falls back to summary. */
  content?: string | null;
}

const PAGE_MARGIN = 15;
const LINE_HEIGHT = 4.5;
const BOTTOM_LIMIT = 280;

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > BOTTOM_LIMIT) {
    doc.addPage();
    return 18;
  }
  return y;
}

function writeWrapped(
  doc: jsPDF,
  text: string,
  y: number,
  opts: { fontSize?: number; bold?: boolean; italic?: boolean; color?: [number, number, number] } = {},
): number {
  const pw = doc.internal.pageSize.width;
  doc.setFontSize(opts.fontSize ?? 10);
  doc.setFont("helvetica", opts.bold ? "bold" : opts.italic ? "italic" : "normal");
  if (opts.color) doc.setTextColor(...opts.color);
  else doc.setTextColor(0, 0, 0);

  const lines: string[] = doc.splitTextToSize(text, pw - PAGE_MARGIN * 2);
  for (const line of lines) {
    y = ensureSpace(doc, y, LINE_HEIGHT);
    doc.text(line, PAGE_MARGIN, y);
    y += LINE_HEIGHT;
  }
  return y;
}

/** Strip basic markdown so jsPDF renders cleanly. */
function cleanMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "")          // headings
    .replace(/\*\*(.+?)\*\*/g, "$1")        // bold
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")            // italic
    .replace(/_(.+?)_/g, "$1")
    .replace(/!\[.*?\]\(.*?\)/g, "")       // images
    .replace(/\[(.+?)\]\((.+?)\)/g, "$1 ($2)") // links → text (url)
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")  // code
    .replace(/^>\s?/gm, "")                 // blockquotes
    .replace(/\n{3,}/g, "\n\n")             // collapse excessive blanks
    .trim();
}

/** Render one article into the doc starting at y, returns new y. */
export function renderArticleToPdf(
  doc: jsPDF,
  article: IntelArticleForPdf,
  startY: number,
): number {
  let y = startY;

  // Title
  y = writeWrapped(doc, article.title, y, { fontSize: 14, bold: true });
  y += 2;

  // Meta line
  const meta = `${article.source}${article.pubDate ? ` • ${format(new Date(article.pubDate), "PPp")}` : ""}`;
  y = writeWrapped(doc, meta, y, { fontSize: 9, italic: true, color: [100, 100, 100] });
  if (article.link) {
    y = writeWrapped(doc, article.link, y, { fontSize: 8, italic: true, color: [80, 80, 160] });
  }
  y += 3;

  // Body — prefer full content, fall back to summary
  const body = (article.content && article.content.trim().length > 0
    ? cleanMarkdown(article.content)
    : article.summary || "(No content available)").trim();

  // Split paragraphs to preserve spacing
  const paragraphs = body.split(/\n\s*\n/);
  for (const p of paragraphs) {
    const text = p.replace(/\n/g, " ").trim();
    if (!text) continue;
    y = writeWrapped(doc, text, y, { fontSize: 10 });
    y += 3;
  }

  return y;
}

/** Export a single article as a fully-paginated PDF. */
export function exportArticlePdf(article: IntelArticleForPdf, filename = "intel-brief.pdf"): void {
  const doc = new jsPDF();
  renderArticleToPdf(doc, article, 18);
  applyPdfBranding(doc);
  doc.save(filename);
}

/** Export multiple articles into a single PDF, one starting on each new page. */
export function exportArticlesPdf(articles: IntelArticleForPdf[], filename = "intel-briefings.pdf"): void {
  if (articles.length === 0) return;
  const doc = new jsPDF();
  articles.forEach((a, i) => {
    if (i > 0) doc.addPage();
    renderArticleToPdf(doc, a, 18);
  });
  applyPdfBranding(doc);
  doc.save(filename);
}
