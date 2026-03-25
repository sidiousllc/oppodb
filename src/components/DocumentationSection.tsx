import { useState, useMemo } from "react";
import { ArrowLeft, BookOpen, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface WikiPage {
  slug: string;
  title: string;
  content: string;
}

const wikiPages: WikiPage[] = [
  { slug: "overview", title: "Overview", content: "" },
  { slug: "candidate-profiles", title: "Candidate Profiles", content: "" },
  { slug: "district-intelligence", title: "District Intelligence", content: "" },
  { slug: "polling-data", title: "Polling Data", content: "" },
  { slug: "campaign-finance", title: "Campaign Finance", content: "" },
  { slug: "state-legislative-districts", title: "State Legislative Districts", content: "" },
  { slug: "additional-features", title: "Additional Features", content: "" },
  { slug: "authentication-and-user-management", title: "Authentication & User Management", content: "" },
  { slug: "api-access", title: "API Access", content: "" },
  { slug: "ui-design-system", title: "UI Design System", content: "" },
  { slug: "data-sync-and-sources", title: "Data Sync & Sources", content: "" },
  { slug: "cook-ratings-and-forecasting", title: "Cook Ratings & Forecasting", content: "" },
  { slug: "admin-panel", title: "Admin Panel", content: "" },
];

// Lazy-load wiki content via raw imports
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
};

export function DocumentationSection() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPages = useMemo(() => {
    if (!searchQuery) return wikiPages;
    const q = searchQuery.toLowerCase();
    return wikiPages.filter(p => p.title.toLowerCase().includes(q));
  }, [searchQuery]);

  const handleSelectPage = async (slug: string) => {
    setSelectedSlug(slug);
    setLoading(true);
    try {
      const loader = wikiImports[slug];
      if (loader) {
        const text = await loader();
        setContent(text);
      } else {
        setContent("# Page Not Found\n\nThis documentation page could not be loaded.");
      }
    } catch {
      setContent("# Error\n\nFailed to load documentation page.");
    } finally {
      setLoading(false);
    }
  };

  const selectedPage = wikiPages.find(p => p.slug === selectedSlug);

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

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))] mb-3">
          <BookOpen className="h-3 w-3" />
          <span>Documentation</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-[hsl(var(--foreground))] font-bold">{selectedPage.title}</span>
        </div>

        {/* Article content */}
        <div className="candidate-card">
          {loading ? (
            <div className="text-center py-8 text-[11px] text-[hsl(var(--muted-foreground))]">
              Loading documentation...
            </div>
          ) : (
            <div className="prose-research">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-lg font-bold border-b border-[hsl(var(--win98-shadow))] pb-1 mb-3">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-sm font-bold border-b border-[hsl(var(--win98-light))] pb-1 mt-4 mb-2">
                      {children}
                    </h2>
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
                    <th className="bg-[hsl(var(--win98-face))] px-2 py-1 text-left font-bold border border-[hsl(var(--win98-shadow))]">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="px-2 py-1 border border-[hsl(var(--win98-light))]">
                      {children}
                    </td>
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
                      <code className="bg-[hsl(var(--win98-face))] px-1 text-[10px] font-mono border border-[hsl(var(--win98-shadow))]">
                        {children}
                      </code>
                    );
                  },
                  pre: ({ children }) => <>{children}</>,
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      className="text-[hsl(var(--primary))] hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {children}
                    </a>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc pl-4 my-1 space-y-0.5 text-[11px]">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-4 my-1 space-y-0.5 text-[11px]">{children}</ol>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-[hsl(var(--win98-titlebar))] pl-3 my-2 text-[11px] italic text-[hsl(var(--muted-foreground))]">
                      {children}
                    </blockquote>
                  ),
                  hr: () => (
                    <hr className="border-t border-[hsl(var(--win98-shadow))] my-3" />
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Table of Contents sidebar-style nav at bottom */}
        <div className="mt-4 candidate-card">
          <div className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] mb-2">📑 OTHER PAGES</div>
          <div className="flex flex-wrap gap-1">
            {wikiPages
              .filter(p => p.slug !== selectedSlug)
              .map(p => (
                <button
                  key={p.slug}
                  onClick={() => handleSelectPage(p.slug)}
                  className="win98-button text-[10px]"
                >
                  {p.title}
                </button>
              ))}
          </div>
        </div>
      </div>
    );
  }

  // Index / Table of Contents view
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="candidate-card mb-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center text-2xl">📖</div>
          <div>
            <h1 className="text-sm font-bold">OppoDB Documentation Wiki</h1>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              Comprehensive documentation for the Opposition Research Database platform
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
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

      {/* Page grid */}
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
