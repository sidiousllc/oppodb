import { LEGAL_DOCS, type LegalDocId } from "@/data/legal";

/**
 * Lightweight markdown renderer for legal docs (no external deps).
 * Supports: # ## ### headings, **bold**, *italic*, `code`, links, lists, tables, blockquotes, hr.
 */
function renderInline(text: string): string {
  // Escape HTML first
  let s = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // links [label](url)
  s = s.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline text-[hsl(var(--primary))]">$1</a>'
  );
  // bold
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // italic
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  // code
  s = s.replace(/`([^`]+)`/g, '<code class="bg-[hsl(var(--win98-face))] px-1 py-0.5 text-[10px]">$1</code>');
  return s;
}

function MarkdownToHtml({ source }: { source: string }) {
  const lines = source.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^# (.*)/.test(line)) {
      out.push(`<h1 class="text-[18px] font-bold mt-3 mb-2">${renderInline(line.slice(2))}</h1>`);
      i++;
    } else if (/^## (.*)/.test(line)) {
      out.push(`<h2 class="text-[14px] font-bold mt-3 mb-1 border-b border-[hsl(var(--win98-shadow))] pb-1">${renderInline(line.slice(3))}</h2>`);
      i++;
    } else if (/^### (.*)/.test(line)) {
      out.push(`<h3 class="text-[12px] font-bold mt-2 mb-1">${renderInline(line.slice(4))}</h3>`);
      i++;
    } else if (/^---\s*$/.test(line)) {
      out.push(`<hr class="my-3 border-[hsl(var(--win98-shadow))]" />`);
      i++;
    } else if (/^\|/.test(line)) {
      // table
      const tbl: string[] = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        tbl.push(lines[i]);
        i++;
      }
      const rows = tbl
        .filter((r) => !/^\|\s*[-:| ]+\|/.test(r))
        .map((r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
      if (rows.length) {
        const [head, ...body] = rows;
        out.push(
          `<table class="w-full text-[11px] my-2 border border-[hsl(var(--win98-shadow))]"><thead><tr>${head
            .map(
              (c) =>
                `<th class="border border-[hsl(var(--win98-shadow))] bg-[hsl(var(--win98-face))] px-2 py-1 text-left">${renderInline(
                  c
                )}</th>`
            )
            .join("")}</tr></thead><tbody>${body
            .map(
              (r) =>
                `<tr>${r
                  .map(
                    (c) =>
                      `<td class="border border-[hsl(var(--win98-shadow))] px-2 py-1 align-top">${renderInline(c)}</td>`
                  )
                  .join("")}</tr>`
            )
            .join("")}</tbody></table>`
        );
      }
    } else if (/^- /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^- /.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].slice(2))}</li>`);
        i++;
      }
      out.push(`<ul class="list-disc pl-5 my-2 space-y-0.5 text-[11px]">${items.join("")}</ul>`);
    } else if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^\d+\.\s/, ""))}</li>`);
        i++;
      }
      out.push(`<ol class="list-decimal pl-5 my-2 space-y-0.5 text-[11px]">${items.join("")}</ol>`);
    } else if (/^\s*$/.test(line)) {
      i++;
    } else {
      out.push(`<p class="my-1.5 text-[11px] leading-snug">${renderInline(line)}</p>`);
      i++;
    }
  }
  return <div dangerouslySetInnerHTML={{ __html: out.join("") }} />;
}

interface Props {
  docId?: LegalDocId;
}

export function LegalDocWindow({ docId = "terms" }: Props) {
  const doc = LEGAL_DOCS[docId] ?? LEGAL_DOCS.terms;
  return (
    <div className="p-3 overflow-auto h-full bg-white">
      <div className="win98-sunken bg-white p-4 max-w-[760px] mx-auto">
        <MarkdownToHtml source={doc.body} />
        <div className="mt-4 pt-2 border-t border-[hsl(var(--win98-shadow))] text-[10px] text-[hsl(var(--muted-foreground))]">
          ORO — Opposition Research Database. This document is provided for transparency and may be revised.
        </div>
      </div>
    </div>
  );
}
