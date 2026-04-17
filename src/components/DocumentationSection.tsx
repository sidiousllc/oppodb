import { useState, useMemo, useEffect } from "react";
import { ArrowLeft, BookOpen, ChevronRight, Download, FileText, FileDown, CheckSquare, Square } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import { applyPdfBranding } from "@/lib/pdfBranding";
import { toast } from "sonner";
import { AndroidBuildPanel } from "./AndroidBuildPanel";

interface WikiPage {
  slug: string;
  title: string;
  content: string;
  fromDb?: boolean;
}

const STATIC_PAGES: Array<{ slug: string; title: string }> = [
  { slug: "overview", title: "Overview" },
  { slug: "candidate-profiles", title: "Candidate Profiles" },
  { slug: "district-intelligence", title: "District Intelligence" },
  { slug: "polling-data", title: "Polling Data" },
  { slug: "campaign-finance", title: "Campaign Finance" },
  { slug: "state-legislative-districts", title: "State Legislative Districts" },
  { slug: "additional-features", title: "Additional Features" },
  { slug: "authentication-and-user-management", title: "Authentication & User Management" },
  { slug: "api-access", title: "API Access" },
  { slug: "ui-design-system", title: "UI Design System" },
  { slug: "data-sync-and-sources", title: "Data Sync & Sources" },
  { slug: "cook-ratings-and-forecasting", title: "Cook Ratings & Forecasting" },
  { slug: "admin-panel", title: "Admin Panel" },
  { slug: "research-tools", title: "Research Tools" },
  { slug: "android-app", title: "Android App" },
  { slug: "prediction-market-trading", title: "Prediction Market Trading" },
  { slug: "leghub", title: "LegHub" },
  { slug: "oppodb-search", title: "OppoDB Search" },
  { slug: "oppohub", title: "OppoHub" },
  { slug: "messaginghub", title: "MessagingHub" },
  { slug: "intelhub", title: "IntelHub" },
  { slug: "datahub", title: "DataHub" },
  { slug: "reporthub", title: "ReportHub" },
  { slug: "internationalhub", title: "InternationalHub" },
  { slug: "live-elections", title: "Live Elections" },
  { slug: "polling-alerts-and-email-preferences", title: "Polling Alerts & Email Preferences" },
  { slug: "aol-communication-suite", title: "AOL Communication Suite" },
  { slug: "mcp-server", title: "MCP Server" },
  { slug: "documentation-system", title: "Documentation System" },
];

// Lazy-load wiki content via raw imports (fallback)
const wikiImports: Record<string, () => Promise<string>> = {
  "overview": () => import("../../wiki/01-Overview.md?raw").then(m => m.default),
  "candidate-profiles": () => import("../../wiki/02-Candidate-Profiles.md?raw").then(m => m.default),
  "district-intelligence": () => import("../../wiki/03-District-Intelligence.md?raw").then(m => m.default),
  "polling-data": () => import("../../wiki/04-Polling-Data.md?raw").then(m => m.default),
  "campaign-finance": () => import("../../wiki/05-Campaign-Finance.md?raw").then(m => m.default),
  "state-legislative-districts": () => import("../../wiki/06-State-Legislative-Districts.md?raw").then(m => m.default),
  "additional-features": () => import("../../wiki/07-Additional-Features.md?raw").then(m => m.default),
  "authentication-and-user-management": () => import("../../wiki/08-Authentication-and-User-Management.md?raw").then(m => m.default),
  "api-access": () => import("../../wiki/09-API-Access.md?raw").then(m => m.default),
  "ui-design-system": () => import("../../wiki/10-UI-Design-System.md?raw").then(m => m.default),
  "data-sync-and-sources": () => import("../../wiki/11-Data-Sync-and-Sources.md?raw").then(m => m.default),
  "cook-ratings-and-forecasting": () => import("../../wiki/12-Cook-Ratings-and-Forecasting.md?raw").then(m => m.default),
  "admin-panel": () => import("../../wiki/13-Admin-Panel.md?raw").then(m => m.default),
  "research-tools": () => import("../../wiki/14-Research-Tools.md?raw").then(m => m.default),
  "android-app": () => import("../../wiki/15-Android-App.md?raw").then(m => m.default),
  "prediction-market-trading": () => import("../../wiki/16-Prediction-Market-Trading.md?raw").then(m => m.default),
  "leghub": () => import("../../wiki/17-LegHub.md?raw").then(m => m.default),
  "oppodb-search": () => import("../../wiki/18-OppoDB-Search.md?raw").then(m => m.default),
  "oppohub": () => import("../../wiki/19-OppoHub.md?raw").then(m => m.default),
  "messaginghub": () => import("../../wiki/20-MessagingHub.md?raw").then(m => m.default),
  "intelhub": () => import("../../wiki/21-IntelHub.md?raw").then(m => m.default),
  "datahub": () => import("../../wiki/22-DataHub.md?raw").then(m => m.default),
  "reporthub": () => import("../../wiki/23-ReportHub.md?raw").then(m => m.default),
  "internationalhub": () => import("../../wiki/24-InternationalHub.md?raw").then(m => m.default),
  "live-elections": () => import("../../wiki/25-Live-Elections.md?raw").then(m => m.default),
  "polling-alerts-and-email-preferences": () => import("../../wiki/26-Polling-Alerts-and-Email-Preferences.md?raw").then(m => m.default),
  "aol-communication-suite": () => import("../../wiki/27-AOL-Communication-Suite.md?raw").then(m => m.default),
  "mcp-server": () => import("../../wiki/28-MCP-Server.md?raw").then(m => m.default),
  "documentation-system": () => import("../../wiki/29-Documentation-System.md?raw").then(m => m.default),
};

async function loadPageContent(slug: string, dbPages: WikiPage[]): Promise<string> {
  const dbPage = dbPages.find(p => p.slug === slug);
  if (dbPage && dbPage.content) return dbPage.content;
  const loader = wikiImports[slug];
  if (loader) return await loader();
  return `# ${slug}\n\n_Content unavailable._`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportSinglePageMarkdown(page: WikiPage, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  downloadBlob(blob, `${page.slug}.md`);
}

function renderMarkdownToPdf(doc: jsPDF, markdown: string, startY: number): number {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const marginX = 14;
  const usableWidth = pageWidth - marginX * 2;
  let y = startY;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 16) {
      doc.addPage();
      y = 20;
    }
  };

  const lines = markdown.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.replace(/\t/g, "  ");
    if (!line.trim()) { y += 3; continue; }

    let text = line;
    let fontSize = 10;
    let style: "normal" | "bold" = "normal";

    if (line.startsWith("### ")) { text = line.slice(4); fontSize = 11; style = "bold"; }
    else if (line.startsWith("## ")) { text = line.slice(3); fontSize = 13; style = "bold"; }
    else if (line.startsWith("# ")) { text = line.slice(2); fontSize = 16; style = "bold"; }
    else if (line.startsWith("- ") || line.startsWith("* ")) { text = "• " + line.slice(2); }
    else if (/^\|.*\|$/.test(line)) { /* table row, render plain */ }

    // strip basic markdown
    text = text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

    doc.setFont("helvetica", style);
    doc.setFontSize(fontSize);
    doc.setTextColor(20, 20, 20);

    const wrapped = doc.splitTextToSize(text, usableWidth);
    for (const w of wrapped) {
      ensureSpace(fontSize * 0.5 + 2);
      doc.text(w, marginX, y);
      y += fontSize * 0.5 + 1.5;
    }
    y += 1;
  }
  return y;
}

function exportSinglePagePdf(page: WikiPage, content: string) {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(page.title, 14, 24);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(`OppoDB Documentation • ${new Date().toLocaleDateString()}`, 14, 30);
  renderMarkdownToPdf(doc, content, 38);
  applyPdfBranding(doc);
  doc.save(`${page.slug}.pdf`);
}

async function exportBulkPdf(pages: WikiPage[], dbPages: WikiPage[]) {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  // Cover page
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("OppoDB Documentation", 14, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`${pages.length} page${pages.length === 1 ? "" : "s"}`, 14, 40);
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, 47);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Contents", 14, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let tocY = 68;
  pages.forEach((p, i) => {
    if (tocY > 270) { doc.addPage(); tocY = 20; }
    doc.text(`${String(i + 1).padStart(2, "0")}. ${p.title}`, 18, tocY);
    tocY += 6;
  });

  for (const page of pages) {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(page.title, 14, 24);
    const content = await loadPageContent(page.slug, dbPages);
    renderMarkdownToPdf(doc, content, 34);
  }

  applyPdfBranding(doc);
  doc.save(`oppodb-documentation-${new Date().toISOString().slice(0, 10)}.pdf`);
}

async function exportBulkMarkdown(pages: WikiPage[], dbPages: WikiPage[]) {
  const parts: string[] = [
    `# OppoDB Documentation`,
    `_Generated ${new Date().toLocaleString()} • ${pages.length} pages_`,
    "",
    "## Contents",
    ...pages.map((p, i) => `${i + 1}. ${p.title}`),
    "",
    "---",
    "",
  ];
  for (const page of pages) {
    const content = await loadPageContent(page.slug, dbPages);
    parts.push(content, "", "---", "");
  }
  const blob = new Blob([parts.join("\n")], { type: "text/markdown;charset=utf-8" });
  downloadBlob(blob, `oppodb-documentation-${new Date().toISOString().slice(0, 10)}.md`);
}

export function DocumentationSection() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dbPages, setDbPages] = useState<WikiPage[]>([]);
  const [dbLoaded, setDbLoaded] = useState(false);

  // Bulk export state
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    supabase
      .from("wiki_pages")
      .select("slug, title, content, sort_order")
      .eq("published", true)
      .order("sort_order")
      .then(({ data }) => {
        if (data && data.length > 0) {
          setDbPages(data.map(p => ({ slug: p.slug, title: p.title, content: p.content, fromDb: true })));
        }
        setDbLoaded(true);
      });
  }, []);

  const wikiPages = useMemo(() => {
    if (!dbLoaded) return STATIC_PAGES.map(p => ({ ...p, content: "", fromDb: false }));
    const dbMap = new Map(dbPages.map(p => [p.slug, p]));
    const merged: WikiPage[] = STATIC_PAGES.map(sp => {
      const dbVersion = dbMap.get(sp.slug);
      return dbVersion ? { ...dbVersion } : { ...sp, content: "", fromDb: false };
    });
    for (const dp of dbPages) {
      if (!STATIC_PAGES.find(sp => sp.slug === dp.slug)) merged.push(dp);
    }
    return merged;
  }, [dbPages, dbLoaded]);

  const filteredPages = useMemo(() => {
    if (!searchQuery) return wikiPages;
    const q = searchQuery.toLowerCase();
    return wikiPages.filter(p => p.title.toLowerCase().includes(q));
  }, [searchQuery, wikiPages]);

  const handleSelectPage = async (slug: string) => {
    setSelectedSlug(slug);
    setLoading(true);
    try {
      const text = await loadPageContent(slug, dbPages);
      setContent(text);
    } catch {
      setContent("# Error\n\nFailed to load documentation page.");
    } finally {
      setLoading(false);
    }
  };

  const selectedPage = wikiPages.find(p => p.slug === selectedSlug);

  const toggleSlug = (slug: string) => {
    setSelectedSlugs(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  };
  const selectAll = () => setSelectedSlugs(new Set(wikiPages.map(p => p.slug)));
  const selectNone = () => setSelectedSlugs(new Set());

  const runBulkExport = async (format: "pdf" | "md") => {
    const pages = wikiPages.filter(p => selectedSlugs.has(p.slug));
    if (pages.length === 0) { toast.error("Select at least one page"); return; }
    setBulkBusy(true);
    try {
      if (format === "pdf") await exportBulkPdf(pages, dbPages);
      else await exportBulkMarkdown(pages, dbPages);
      toast.success(`Exported ${pages.length} page${pages.length === 1 ? "" : "s"}`);
      setBulkOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Export failed");
    } finally {
      setBulkBusy(false);
    }
  };

  if (selectedSlug && selectedPage) {
    return (
      <div className="animate-fade-in">
        <button
          onClick={() => { setSelectedSlug(null); setContent(""); }}
          className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-3 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Documentation
        </button>

        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))]">
            <BookOpen className="h-3 w-3" />
            <span>Documentation</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-[hsl(var(--foreground))] font-bold">{selectedPage.title}</span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => exportSinglePageMarkdown(selectedPage, content)}
              className="win98-button text-[10px] flex items-center gap-1 px-2"
              title="Download this page as Markdown"
            >
              <FileText className="h-3 w-3" /> .md
            </button>
            <button
              onClick={() => exportSinglePagePdf(selectedPage, content)}
              className="win98-button text-[10px] flex items-center gap-1 px-2"
              title="Download this page as PDF"
            >
              <FileDown className="h-3 w-3" /> PDF
            </button>
          </div>
        </div>

        <div className="candidate-card">
          {loading ? (
            <div className="text-center py-8 text-[11px] text-[hsl(var(--muted-foreground))]">Loading documentation...</div>
          ) : (
            <WikiMarkdown content={content} />
          )}
        </div>

        {selectedSlug === "android-app" && <AndroidBuildPanel />}

        <div className="mt-4 candidate-card">
          <div className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] mb-2">📑 OTHER PAGES</div>
          <div className="flex flex-wrap gap-1">
            {wikiPages
              .filter(p => p.slug !== selectedSlug)
              .map(p => (
                <button key={p.slug} onClick={() => handleSelectPage(p.slug)} className="win98-button text-[10px]">
                  {p.title}
                </button>
              ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="candidate-card mb-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center text-2xl">📖</div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold">OppoDB Documentation Wiki</h1>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              Comprehensive technical documentation for the Opposition Research Database platform — {wikiPages.length} pages.
            </p>
          </div>
          <button
            onClick={() => { setBulkOpen(o => !o); if (!bulkOpen && selectedSlugs.size === 0) selectAll(); }}
            className="win98-button text-[10px] flex items-center gap-1 px-2"
            title="Export multiple pages"
          >
            <Download className="h-3 w-3" /> Export…
          </button>
        </div>
      </div>

      {bulkOpen && (
        <div className="candidate-card mb-3">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="text-[11px] font-bold">Bulk Export — {selectedSlugs.size} of {wikiPages.length} selected</div>
            <div className="flex gap-1">
              <button onClick={selectAll} className="win98-button text-[10px] px-2">Select All</button>
              <button onClick={selectNone} className="win98-button text-[10px] px-2">Clear</button>
              <button
                onClick={() => runBulkExport("md")}
                disabled={bulkBusy || selectedSlugs.size === 0}
                className="win98-button text-[10px] px-2 flex items-center gap-1"
              >
                <FileText className="h-3 w-3" /> Combined .md
              </button>
              <button
                onClick={() => runBulkExport("pdf")}
                disabled={bulkBusy || selectedSlugs.size === 0}
                className="win98-button text-[10px] px-2 flex items-center gap-1"
              >
                <FileDown className="h-3 w-3" /> Combined PDF
              </button>
            </div>
          </div>
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3 max-h-[40vh] overflow-y-auto win98-sunken p-2">
            {wikiPages.map(p => {
              const checked = selectedSlugs.has(p.slug);
              return (
                <button
                  key={p.slug}
                  onClick={() => toggleSlug(p.slug)}
                  className="flex items-center gap-1.5 text-left text-[11px] px-1 py-0.5 hover:bg-[hsl(var(--win98-light))]"
                >
                  {checked
                    ? <CheckSquare className="h-3 w-3 shrink-0 text-[hsl(var(--primary))]" />
                    : <Square className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />}
                  <span className="truncate">{p.title}</span>
                </button>
              );
            })}
          </div>
          {bulkBusy && <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-2">Building export…</div>}
        </div>
      )}

      <div className="mb-3">
        <div className="win98-sunken flex items-center px-2 py-1">
          <span className="text-[11px] mr-1">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documentation..."
            className="flex-1 bg-transparent text-[11px] outline-none"
          />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {filteredPages.map((page, i) => (
          <button
            key={page.slug}
            onClick={() => handleSelectPage(page.slug)}
            className="candidate-card text-left hover:bg-[hsl(var(--win98-light))] transition-colors group"
          >
            <div className="flex items-start gap-2">
              <span className="text-lg">📄</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[11px] font-bold group-hover:text-[hsl(var(--primary))] transition-colors">
                    {page.title}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] group-hover:text-[hsl(var(--foreground))] transition-colors shrink-0 mt-0.5" />
            </div>
          </button>
        ))}
      </div>

      {filteredPages.length === 0 && (
        <div className="text-center py-8">
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">No documentation pages match your search.</p>
        </div>
      )}
    </div>
  );
}

function WikiMarkdown({ content }: { content: string }) {
  return (
    <div className="prose-research">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="text-lg font-bold border-b border-[hsl(var(--win98-shadow))] pb-1 mb-3">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-bold border-b border-[hsl(var(--win98-light))] pb-1 mt-4 mb-2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[12px] font-bold mt-3 mb-1">{children}</h3>
          ),
          table: ({ children }) => (
            <div className="win98-sunken overflow-x-auto my-2">
              <table className="w-full text-[10px]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="bg-[hsl(var(--win98-face))] px-2 py-1 text-left font-bold border border-[hsl(var(--win98-shadow))]">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-2 py-1 border border-[hsl(var(--win98-light))]">{children}</td>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <div className="win98-sunken bg-[hsl(var(--background))] p-2 my-2 overflow-x-auto">
                  <code className="text-[10px] font-mono whitespace-pre">{children}</code>
                </div>
              );
            }
            return (
              <code className="bg-[hsl(var(--win98-face))] px-1 text-[10px] font-mono border border-[hsl(var(--win98-shadow))]">{children}</code>
            );
          },
          pre: ({ children }) => <>{children}</>,
          a: ({ href, children }) => (
            <a href={href} className="text-[hsl(var(--primary))] hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-4 my-1 space-y-0.5 text-[11px]">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-4 my-1 space-y-0.5 text-[11px]">{children}</ol>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-[hsl(var(--win98-titlebar))] pl-3 my-2 text-[11px] italic text-[hsl(var(--muted-foreground))]">{children}</blockquote>
          ),
          hr: () => (
            <hr className="border-t border-[hsl(var(--win98-shadow))] my-3" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
