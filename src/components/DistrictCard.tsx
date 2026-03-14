import { forwardRef } from "react";
import { type DistrictProfile } from "@/data/districtIntel";
import { getCookRating, getCookRatingColor, type CookRating } from "@/data/cookRatings";
import { getCurrentPVI, formatPVI, getPVIColor } from "@/data/cookPVI";
import { MapPin, ChevronRight, Users } from "lucide-react";

interface DistrictCardProps {
  district: DistrictProfile;
  onClick: (districtId: string) => void;
}

function CookBadge({ rating }: { rating: CookRating }) {
  const color = getCookRatingColor(rating);
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide whitespace-nowrap border"
      style={{
        backgroundColor: `hsl(${color} / 0.12)`,
        color: `hsl(${color})`,
        borderColor: `hsl(${color} / 0.25)`,
      }}
    >
      {rating}
    </span>
  );
}

export const DistrictCard = forwardRef<HTMLDivElement, DistrictCardProps>(
  ({ district, onClick }, ref) => {
    const rating = getCookRating(district.district_id);
    const pvi = getCurrentPVI(district.district_id);

    return (
      <div
        ref={ref}
        className="candidate-card animate-fade-in"
        onClick={() => onClick(district.district_id)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--tag-governor)/0.1)]">
              <MapPin className="h-5 w-5 text-[hsl(var(--tag-governor))]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-semibold text-foreground truncate">
                  {district.district_id}
                </h3>
                {rating && <CookBadge rating={rating} />}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="tag tag-governor">{district.state}</span>
                {district.population && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {district.population.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-3" />
        </div>
        {district.top_issues.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {district.top_issues.slice(0, 4).map((issue) => (
              <span
                key={issue}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-muted text-muted-foreground"
              >
                {issue}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }
);

DistrictCard.displayName = "DistrictCard";
