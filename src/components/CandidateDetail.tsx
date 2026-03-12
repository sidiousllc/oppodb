import { useState, useEffect, useCallback } from "react";
import { type Candidate } from "@/data/candidates";
import { fetchSubpages, type GitHubCandidate } from "@/data/githubSync";
import { ArrowLeft, User, FileText, ChevronRight, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { extractInternalSlug, isInternalHost } from "@/lib/researchLinkResolver";

interface CandidateDetailProps {
  candidate: Candidate;
  onBack: () => void;
  onNavigateSlug?: (slug: string) => boolean;
}

const categoryLabels: Record<string, string> = {
  house: "House",
  senate: "Senate",
  governor: "Governor",
  state: "State",
};

function MarkdownContent({
  content,
  subpages,
  onNavigateSubpage,
  onNavigateSlug,
}: {
  content: string;
  subpages: GitHubCandidate[];
  onNavigateSubpage: (sp: GitHubCandidate) => void;
  onNavigateSlug?: (slug: string) => boolean;
}) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string | undefined, matchSlug: string | null) => {
      if (!matchSlug) return;
      e.preventDefault();

      const match = subpages.find(
        (sp) =>
          sp.slug === matchSlug ||
          sp.slug.endsWith(matchSlug) ||
          sp.github_path.replace(".md", "").endsWith(matchSlug)
      );

      if (match) {
        onNavigateSubpage(match);
        return;
      }

      const handled = onNavigateSlug?.(matchSlug) ?? false;
      if (!handled && href && !isInternalHost(href) && (href.startsWith("http://") || href.startsWith("https://"))) {
        window.open(href, "_blank", "noopener,noreferrer");
      }
    },
    [subpages, onNavigateSubpage, onNavigateSlug]
  );

  return (
    <ReactMarkdown
      components={{
        a: ({ href, children }) => {
          const matchSlug = extractInternalSlug(href);

          if (matchSlug) {
            return (
              <a
                href={href ?? "#"}
                onClick={(e) => handleClick(e, href, matchSlug)}
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
  );
}

export function CandidateDetail({ candidate, onBack, onNavigateSlug }: CandidateDetailProps) {
  const [subpages, setSubpages] = useState<GitHubCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubpage, setActiveSubpage] = useState<GitHubCandidate | null>(null);

  useEffect(() => {
    setLoading(true);
    setActiveSubpage(null);
    fetchSubpages(candidate.slug).then((data) => {
      setSubpages(data);
      setLoading(false);
    });
  }, [candidate.slug]);

  if (activeSubpage) {
    return (
      <div className="animate-fade-in">
        <button
          onClick={() => setActiveSubpage(null)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {candidate.name}
        </button>

        <div className="bg-card rounded-xl border border-border p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent/10">
              <FileText className="h-7 w-7 text-accent" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">
                {activeSubpage.subpage_title || activeSubpage.name}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-sm text-muted-foreground">{candidate.name}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <div className="prose-research">
            <MarkdownContent
              content={activeSubpage.content}
              subpages={subpages}
              onNavigateSubpage={setActiveSubpage}
              onNavigateSlug={onNavigateSlug}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to all candidates
      </button>

      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <User className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {candidate.name}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className={`tag tag-${candidate.category}`}>
                {categoryLabels[candidate.category]}
              </span>
              {candidate.state && (
                <span className="text-sm text-muted-foreground">{candidate.state}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Subpages section */}
      {loading ? (
        <div className="bg-card rounded-xl border border-border p-6 mb-6">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading issue research…
          </div>
        </div>
      ) : subpages.length > 0 ? (
        <div className="bg-card rounded-xl border border-border p-4 mb-6">
          <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-3">
            Issue Research ({subpages.length})
          </h2>
          <div className="grid gap-1">
            {subpages.map((sp) => {
              const displayTitle = (sp.subpage_title || sp.name)
                .replace(/^Rep\.\s+.*?:\s*/, "")
                .replace(/^Sen\.\s+.*?:\s*/, "")
                .replace(/^Gov\.\s+.*?:\s*/, "");

              return (
                <button
                  key={sp.slug}
                  onClick={() => setActiveSubpage(sp)}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left text-sm hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-foreground truncate">{displayTitle}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 group-hover:text-foreground transition-colors" />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="bg-card rounded-xl border border-border p-6">
        <div className="prose-research">
          <MarkdownContent
            content={candidate.content}
            subpages={subpages}
            onNavigateSubpage={setActiveSubpage}
            onNavigateSlug={onNavigateSlug}
          />
        </div>
      </div>
    </div>
  );
}
