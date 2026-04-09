import { useCallback } from "react";
import { ArrowLeft, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { extractInternalLink, isInternalHost } from "@/lib/researchLinkResolver";
import { exportContentPDF } from "@/lib/contentExport";

interface GenericDetailProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  tag?: { label: string; className: string };
  content: string;
  onBack: () => void;
  backLabel?: string;
  onNavigateSlug?: (slug: string) => boolean;
  sectionLabel?: string;
}

export function GenericDetail({
  icon,
  title,
  subtitle,
  tag,
  content,
  onBack,
  backLabel = "Back",
  onNavigateSlug,
  sectionLabel = "Report",
}: GenericDetailProps) {
  const handleLinkClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string | undefined, slug: string | null) => {
      if (!slug) return;
      e.preventDefault();
      const handled = onNavigateSlug?.(slug) ?? false;
      if (!handled && href && !isInternalHost(href) && (href.startsWith("http://") || href.startsWith("https://"))) {
        window.open(href, "_blank", "noopener,noreferrer");
      }
    },
    [onNavigateSlug]
  );

  return (
    <div className="animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </button>

      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            {icon}
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">
                {title}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                {tag && <span className={`tag ${tag.className}`}>{tag.label}</span>}
                {subtitle && <span className="text-sm text-muted-foreground">{subtitle}</span>}
              </div>
            </div>
          </div>
          <button
            onClick={() => exportContentPDF({ title, subtitle, tag: tag?.label, content, section: sectionLabel })}
            className="win98-button text-[10px] flex items-center gap-1 shrink-0"
          >
            <Download className="h-3 w-3" />
            PDF
          </button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6">
        <div className="prose-research">
          <ReactMarkdown
            components={{
              a: ({ href, children }) => {
                const link = extractInternalLink(href);

                if (link) {
                  return (
                    <a
                      href={href ?? "#"}
                      onClick={(e) => handleLinkClick(e, href, link.slug)}
                      className="text-primary hover:underline cursor-pointer"
                    >
                      {children}
                    </a>
                  );
                }

                return (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                );
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
