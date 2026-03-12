import { useState, useEffect, useCallback } from "react";
import { type Candidate } from "@/data/candidates";
import { fetchSubpages, type GitHubCandidate } from "@/data/githubSync";
import { ArrowLeft, ExternalLink, User, FileText, ChevronRight, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";


interface CandidateDetailProps {
  candidate: Candidate;
  onBack: () => void;
}

const categoryLabels: Record<string, string> = {
  house: "House",
  senate: "Senate",
  governor: "Governor",
  state: "State",
};

/**
 * Resolves internal wiki-style links.
 * Patterns:
 *   /candidate-slug/subpage-slug
 *   /candidate-slug/subpage-slug/sub-sub
 *   /en/STATE/Candidate/slug
 * If the path matches a loaded subpage, navigate in-app. Otherwise link to GitHub.
 */
function resolveHref(href: string | undefined): { isInternal: boolean; matchSlug?: string } {
  if (!href) return { isInternal: false };
  if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("#")) {
    return { isInternal: false };
  }

  // Internal wiki path — extract the last segment as slug
  const path = href.replace(/^\/en\//, "/").replace(/^\//, "");
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return { isInternal: false };

  return { isInternal: true, matchSlug: segments[segments.length - 1] };
}

function MarkdownContent({
  content,
  subpages,
  onNavigateSubpage,
}: {
  content: string;
  subpages: GitHubCandidate[];
  onNavigateSubpage: (sp: GitHubCandidate) => void;
}) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, matchSlug?: string) => {
      e.preventDefault();
      if (!matchSlug) return;
      const match = subpages.find(
        (sp) =>
          sp.slug === matchSlug ||
          sp.slug.endsWith(matchSlug) ||
          sp.github_path.replace(".md", "").endsWith(matchSlug)
      );
      if (match) {
        onNavigateSubpage(match);
      }
    },
    [subpages, onNavigateSubpage]
  );

  return (
    <ReactMarkdown
      components={{
        a: ({ href, children }) => {
          const { isInternal, matchSlug } = resolveHref(href);
          if (isInternal) {
            return (
              <a
                href="#"
                onClick={(e) => handleClick(e, matchSlug)}
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

export function CandidateDetail({ candidate, onBack }: CandidateDetailProps) {
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
                <a
                  href={`https://github.com/${GITHUB_REPO}/blob/${GITHUB_BRANCH}/${activeSubpage.github_path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  View on GitHub <ExternalLink className="h-3 w-3" />
                </a>
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
              <a
                href={`https://github.com/${GITHUB_REPO}/tree/${GITHUB_BRANCH}/${candidate.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Source <ExternalLink className="h-3 w-3" />
              </a>
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
          />
        </div>
      </div>
    </div>
  );
}
