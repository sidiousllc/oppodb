import { useState, useEffect, useCallback } from "react";
import { Edit3, Download } from "lucide-react";
import { type Candidate } from "@/data/candidates";
import { fetchSubpages, type GitHubCandidate } from "@/data/githubSync";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, User, FileText, ChevronRight, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { extractInternalLink, extractInternalSlug, isInternalHost } from "@/lib/researchLinkResolver";
import { VersionHistory } from "@/components/VersionHistory";
import { exportContentPDF } from "@/lib/contentExport";
import { CampaignFinancePanel } from "@/components/CampaignFinancePanel";
import { CandidatePollingPanel } from "@/components/CandidatePollingPanel";
import { CandidateVotingRecord } from "@/components/CandidateVotingRecord";
import { CandidateCongressPanel } from "@/components/CandidateCongressPanel";
import { FollowTheMoneyPanel } from "@/components/FollowTheMoneyPanel";
import { VulnerabilityScorePanel } from "@/components/VulnerabilityScorePanel";
import { TalkingPointsPanel } from "@/components/TalkingPointsPanel";

interface CandidateDetailProps {
  candidate: Candidate;
  onBack: () => void;
  onNavigateSlug?: (slug: string, parentSlug?: string) => boolean;
  onEdit?: (slug: string) => void;
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
  onNavigateSlug?: (slug: string, parentSlug?: string) => boolean;
}) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string | undefined, matchSlug: string | null, parentSlug: string | null) => {
      if (!matchSlug) return;
      e.preventDefault();

      // 1. Try to match a subpage of the CURRENT candidate first
      const match = subpages.find(
        (sp) =>
          sp.slug === matchSlug ||
          sp.slug.endsWith(`-${matchSlug}`) ||
          sp.github_path.replace(/\.md$/i, "").endsWith(`/${matchSlug}`)
      );

      if (match) {
        onNavigateSubpage(match);
        return;
      }

      // 2. If link had a parent slug like /andy-ogles/health-care, route to that parent first
      if (parentSlug) {
        const handledParent = onNavigateSlug?.(parentSlug, parentSlug) ?? false;
        if (handledParent) return;
      }

      // 3. Try top-level navigation by exact slug, passing parent hint for DB subpage lookup
      const handled = onNavigateSlug?.(matchSlug, parentSlug ?? undefined) ?? false;
      if (handled) return;

      // 4. Fall back to opening external links in a new tab
      if (href && !isInternalHost(href) && (href.startsWith("http://") || href.startsWith("https://"))) {
        window.open(href, "_blank", "noopener,noreferrer");
      }
    },
    [subpages, onNavigateSubpage, onNavigateSlug]
  );

  return (
    <ReactMarkdown
      components={{
        a: ({ href, children }) => {
          const link = extractInternalLink(href);

          if (link) {
            return (
              <a
                href={href ?? "#"}
                onClick={(e) => handleClick(e, href, link.slug, link.parentSlug)}
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

export function CandidateDetail({ candidate, onBack, onNavigateSlug, onEdit }: CandidateDetailProps) {
  const [subpages, setSubpages] = useState<GitHubCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubpage, setActiveSubpage] = useState<GitHubCandidate | null>(null);
  const [githubPath, setGithubPath] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setActiveSubpage(null);
    setGithubPath(null);

    Promise.all([
      fetchSubpages(candidate.slug),
      supabase
        .from("candidate_profiles")
        .select("github_path")
        .eq("slug", candidate.slug)
        .eq("is_subpage", false)
        .single(),
    ]).then(([subData, { data: profile }]) => {
      setSubpages(subData);
      if (profile?.github_path) setGithubPath(profile.github_path);
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

        {/* Version History for subpage */}
        <VersionHistory githubPath={activeSubpage.github_path} currentContent={activeSubpage.content} />

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
        <div className="flex items-start justify-between">
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
          <div className="flex items-center gap-2 shrink-0">
            {onEdit && (
              <button
                onClick={() => onEdit(candidate.slug)}
                className="win98-button text-[10px] flex items-center gap-1"
              >
                <Edit3 className="h-3 w-3" />
                Edit
              </button>
            )}
            <button
              onClick={async () => {
                // Fetch AI talking points so the PDF includes both core + AI sections
                const { data: tps } = await supabase
                  .from("talking_points")
                  .select("audience, angle, points, evidence, created_at, model")
                  .eq("subject_type", "candidate")
                  .eq("subject_ref", candidate.slug)
                  .order("created_at", { ascending: false })
                  .limit(10);

                let extra = "";
                if (tps && tps.length > 0) {
                  extra += `\n\n# AI-Generated Talking Points\n`;
                  tps.forEach((tp: any) => {
                    const date = new Date(tp.created_at).toISOString().slice(0, 10);
                    extra += `\n## ${tp.audience} / ${tp.angle} (${date})\n`;
                    if (tp.model) extra += `_Model: ${tp.model}_\n\n`;
                    (tp.points || []).forEach((p: any, i: number) => {
                      extra += `\n**${i + 1}. ${p.message}**\n`;
                      extra += `- _Why:_ ${p.rationale}\n`;
                      if (p.delivery_tips) extra += `- _Tip:_ ${p.delivery_tips}\n`;
                    });
                    if (tp.evidence?.length) {
                      extra += `\n**Evidence to cite:**\n`;
                      tp.evidence.forEach((e: any) => {
                        extra += `- ${e.claim}${e.source_hint ? ` — ${e.source_hint}` : ""}\n`;
                      });
                    }
                  });
                }

                exportContentPDF({
                  title: candidate.name,
                  subtitle: candidate.state,
                  tag: categoryLabels[candidate.category],
                  content: (candidate.content || "") + extra,
                  section: "Candidate Profile",
                });
              }}
              className="win98-button text-[10px] flex items-center gap-1"
            >
              <Download className="h-3 w-3" />
              PDF
            </button>
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

      {/* AI Vulnerability Analysis */}
      <VulnerabilityScorePanel candidateSlug={candidate.slug} />

      {/* AI Talking Points */}
      <TalkingPointsPanel subjectType="candidate" subjectRef={candidate.slug} />

      {/* Candidate Polling */}
      <CandidatePollingPanel candidateName={candidate.name} candidateSlug={candidate.slug} />

      {/* Legislative Record (LegiScan cross-reference) */}
      <CandidateVotingRecord candidateSlug={candidate.slug} candidateName={candidate.name} candidateState={candidate.state} />

      {/* Congress.gov Profile */}
      <CandidateCongressPanel candidateSlug={candidate.slug} candidateName={candidate.name} />

      {/* Campaign Finance */}
      <CampaignFinancePanel candidateSlug={candidate.slug} />

      {/* State Finance (FollowTheMoney) */}
      <FollowTheMoneyPanel embedded={false} />

      {/* Version History */}
      {githubPath && (
        <VersionHistory githubPath={githubPath} currentContent={candidate.content} />
      )}

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
