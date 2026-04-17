import { forwardRef } from "react";
import { type Candidate } from "@/data/candidates";
import { User, ChevronRight, MapPin } from "lucide-react";
import { getDistrictForCandidate } from "@/data/candidateDistricts";

interface CandidateCardProps {
  candidate: Candidate;
  onClick: (slug: string) => void;
  onDistrictClick?: (districtId: string) => void;
}

const categoryLabels: Record<string, string> = {
  "us-house": "U.S. House",
  "us-senate": "U.S. Senate",
  governor: "Governor",
  statewide: "Statewide",
  "state-leg": "State Leg",
  local: "Local",
  uncategorized: "Other",
};

export const CandidateCard = forwardRef<HTMLDivElement, CandidateCardProps>(
  ({ candidate, onClick, onDistrictClick }, ref) => {
    const firstLine = candidate.content.split("\n").find(l => l.trim().length > 20)?.trim().slice(0, 140) || "";
    const districtId = getDistrictForCandidate(candidate.slug);

    return (
      <div ref={ref} className="candidate-card animate-fade-in" onClick={() => onClick(candidate.slug)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-base font-semibold text-foreground truncate">
                {candidate.name}
              </h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`tag tag-${candidate.category}`}>
                  {categoryLabels[candidate.category] || candidate.category}
                </span>
                {candidate.office && candidate.office !== categoryLabels[candidate.category] && (
                  <span className="text-xs text-muted-foreground">{candidate.office}</span>
                )}
                {districtId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDistrictClick?.(districtId);
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--tag-governor)/0.1)] px-2 py-0.5 text-xs font-medium text-[hsl(var(--tag-governor))] hover:bg-[hsl(var(--tag-governor)/0.2)] transition-colors"
                  >
                    <MapPin className="h-3 w-3" />
                    {districtId}
                  </button>
                )}
                {!districtId && candidate.district && (
                  <span className="text-xs font-medium text-muted-foreground">{candidate.district}</span>
                )}
                {!districtId && candidate.state && (
                  <span className="text-xs text-muted-foreground">{candidate.state}</span>
                )}
              </div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-3" />
        </div>
        {firstLine && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{firstLine}...</p>
        )}
      </div>
    );
  }
);

CandidateCard.displayName = "CandidateCard";
