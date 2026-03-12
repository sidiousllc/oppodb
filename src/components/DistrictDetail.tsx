import { type DistrictProfile } from "@/data/districtIntel";
import { getCandidatesForDistrict } from "@/data/candidateDistricts";
import { getCandidateBySlug } from "@/data/candidates";
import {
  ArrowLeft,
  MapPin,
  Users,
  DollarSign,
  GraduationCap,
  Calendar,
  AlertCircle,
  UserCheck,
} from "lucide-react";

interface DistrictDetailProps {
  district: DistrictProfile;
  onBack: () => void;
  onSelectCandidate?: (slug: string) => void;
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-display text-lg font-bold text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}

export function DistrictDetail({ district, onBack, onSelectCandidate }: DistrictDetailProps) {
  const candidateSlugs = getCandidatesForDistrict(district.district_id);
  const linkedCandidates = candidateSlugs
    .map((slug) => getCandidateBySlug(slug))
    .filter(Boolean);

  return (
    <div className="animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to District Intel
      </button>

      {/* Header */}
      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--tag-governor)/0.1)]">
            <MapPin className="h-7 w-7 text-[hsl(var(--tag-governor))]" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {district.district_id}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="tag tag-governor">{district.state}</span>
              <span className="text-sm text-muted-foreground">
                Congressional District
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {district.population && (
          <StatCard
            icon={<Users className="h-5 w-5 text-muted-foreground" />}
            label="Population"
            value={district.population.toLocaleString()}
          />
        )}
        {district.median_income && (
          <StatCard
            icon={<DollarSign className="h-5 w-5 text-muted-foreground" />}
            label="Median Income"
            value={`$${district.median_income.toLocaleString()}`}
          />
        )}
        {district.median_age && (
          <StatCard
            icon={<Calendar className="h-5 w-5 text-muted-foreground" />}
            label="Median Age"
            value={String(district.median_age)}
          />
        )}
        {district.education_bachelor_pct && (
          <StatCard
            icon={
              <GraduationCap className="h-5 w-5 text-muted-foreground" />
            }
            label="Bachelor's Degree+"
            value={`${district.education_bachelor_pct}%`}
          />
        )}
      </div>

      {/* Linked Candidates */}
      {linkedCandidates.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-6 mb-6">
          <h2 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Tracked Representatives
          </h2>
          <div className="space-y-2">
            {linkedCandidates.map((candidate) => {
              if (!candidate) return null;
              const categoryColors: Record<string, string> = {
                house: "tag-house",
                senate: "tag-senate",
                governor: "tag-governor",
                state: "tag-state",
              };
              return (
                <button
                  key={candidate.slug}
                  onClick={() => onSelectCandidate?.(candidate.slug)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <UserCheck className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {candidate.name}
                    </p>
                  </div>
                  <span className={`tag ${categoryColors[candidate.category] || ""}`}>
                    {candidate.category}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Issues */}
      {district.top_issues.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-6 mb-6">
          <h2 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-accent" />
            Top Issues
          </h2>
          <div className="space-y-3">
            {district.top_issues.map((issue, i) => (
              <div
                key={issue}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-foreground capitalize">
                  {issue}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Source */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="font-display text-lg font-bold text-foreground mb-3">
          Data Sources
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          District demographics sourced from the{" "}
          <a
            href="https://www.census.gov/programs-surveys/acs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            U.S. Census ACS 5-Year Estimates
          </a>
          . Modeled after the{" "}
          <a
            href="https://github.com/tyler-pritchard/constituency-intel"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            constituency-intel
          </a>{" "}
          framework.
        </p>
      </div>
    </div>
  );
}
