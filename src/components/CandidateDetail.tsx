import { type Candidate } from "@/data/candidates";
import { ArrowLeft, ExternalLink, User } from "lucide-react";
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

export function CandidateDetail({ candidate, onBack }: CandidateDetailProps) {
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
                href={`https://research-books.com/en/${candidate.slug}`}
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

      <div className="bg-card rounded-xl border border-border p-6">
        <div className="prose-research">
          <ReactMarkdown
            components={{
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              ),
            }}
          >
            {candidate.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
