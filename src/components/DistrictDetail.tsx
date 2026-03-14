import { type DistrictProfile } from "@/data/districtIntel";
import { getCandidatesForDistrict } from "@/data/candidateDistricts";
import { getCandidateBySlug } from "@/data/candidates";
import { getCookRating, getCookRatingColor, type CookRating } from "@/data/cookRatings";
import {
  ArrowLeft,
  MapPin,
  Users,
  DollarSign,
  GraduationCap,
  Calendar,
  AlertCircle,
  UserCheck,
  Home,
  Heart,
  Globe2,
  Shield,
  TrendingDown,
  Briefcase,
  Building,
  BarChart3,
} from "lucide-react";

interface DistrictDetailProps {
  district: DistrictProfile;
  onBack: () => void;
  onSelectCandidate?: (slug: string) => void;
}

function CookRatingBanner({ rating }: { rating: CookRating }) {
  const color = getCookRatingColor(rating);
  return (
    <div
      className="rounded-xl border p-4 mb-6 flex items-center gap-3"
      style={{
        backgroundColor: `hsl(${color} / 0.08)`,
        borderColor: `hsl(${color} / 0.25)`,
      }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `hsl(${color} / 0.15)` }}
      >
        <BarChart3 className="h-5 w-5" style={{ color: `hsl(${color})` }} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium">Cook Political Report Rating</p>
        <p className="font-display text-lg font-bold" style={{ color: `hsl(${color})` }}>
          {rating}
        </p>
      </div>
      <a
        href="https://www.cookpolitical.com/ratings/house-race-ratings"
        target="_blank"
        rel="noopener noreferrer"
        className="ml-auto text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        Source
      </a>
    </div>
  );
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

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2">
      {icon}
      {title}
    </h2>
  );
}

function DataRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

export function DistrictDetail({ district, onBack, onSelectCandidate }: DistrictDetailProps) {
  const candidateSlugs = getCandidatesForDistrict(district.district_id);
  const linkedCandidates = candidateSlugs
    .map((slug) => getCandidateBySlug(slug))
    .filter(Boolean);

  const cookRating = getCookRating(district.district_id);

  const fmt = (n: number | null | undefined) => n != null ? n.toLocaleString() : null;
  const pct = (n: number | null | undefined) => n != null ? `${n}%` : null;
  const dollar = (n: number | null | undefined) => n != null ? `$${n.toLocaleString()}` : null;

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
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-bold text-foreground">
                {district.district_id}
              </h1>
              {cookRating && (
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold tracking-wide border"
                  style={{
                    backgroundColor: `hsl(${getCookRatingColor(cookRating)} / 0.12)`,
                    color: `hsl(${getCookRatingColor(cookRating)})`,
                    borderColor: `hsl(${getCookRatingColor(cookRating)} / 0.25)`,
                  }}
                >
                  {cookRating}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="tag tag-governor">{district.state}</span>
              <span className="text-sm text-muted-foreground">
                Congressional District
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Cook Rating Banner */}
      {cookRating && <CookRatingBanner rating={cookRating} />}

      {/* Key Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {district.population != null && (
          <StatCard
            icon={<Users className="h-5 w-5 text-muted-foreground" />}
            label="Population"
            value={fmt(district.population)!}
          />
        )}
        {district.median_income != null && (
          <StatCard
            icon={<DollarSign className="h-5 w-5 text-muted-foreground" />}
            label="Median Income"
            value={dollar(district.median_income)!}
          />
        )}
        {district.median_age != null && (
          <StatCard
            icon={<Calendar className="h-5 w-5 text-muted-foreground" />}
            label="Median Age"
            value={String(district.median_age)}
          />
        )}
        {district.education_bachelor_pct != null && (
          <StatCard
            icon={<GraduationCap className="h-5 w-5 text-muted-foreground" />}
            label="Bachelor's Degree+"
            value={pct(district.education_bachelor_pct)!}
          />
        )}
      </div>

      {/* Economic Indicators */}
      {(district.poverty_rate != null || district.unemployment_rate != null || district.total_households != null) && (
        <div className="bg-card rounded-xl border border-border p-6 mb-6">
          <SectionHeader
            icon={<TrendingDown className="h-5 w-5 text-accent" />}
            title="Economic Indicators"
          />
          <div className="space-y-0">
            <DataRow label="Poverty Rate" value={pct(district.poverty_rate)} />
            <DataRow label="Unemployment Rate" value={pct(district.unemployment_rate)} />
            <DataRow label="Total Households" value={fmt(district.total_households)} />
            <DataRow label="Avg. Household Size" value={district.avg_household_size != null ? String(district.avg_household_size) : null} />
          </div>
        </div>
      )}

      {/* Racial & Ethnic Demographics */}
      {(district.white_pct != null || district.black_pct != null || district.hispanic_pct != null || district.asian_pct != null) && (
        <div className="bg-card rounded-xl border border-border p-6 mb-6">
          <SectionHeader
            icon={<Users className="h-5 w-5 text-primary" />}
            title="Racial & Ethnic Demographics"
          />
          <div className="space-y-0">
            <DataRow label="White" value={pct(district.white_pct)} />
            <DataRow label="Black / African American" value={pct(district.black_pct)} />
            <DataRow label="Hispanic / Latino" value={pct(district.hispanic_pct)} />
            <DataRow label="Asian" value={pct(district.asian_pct)} />
            <DataRow label="Foreign-Born" value={pct(district.foreign_born_pct)} />
          </div>
        </div>
      )}

      {/* Housing */}
      {(district.owner_occupied_pct != null || district.median_home_value != null || district.median_rent != null) && (
        <div className="bg-card rounded-xl border border-border p-6 mb-6">
          <SectionHeader
            icon={<Home className="h-5 w-5 text-[hsl(var(--tag-house))]" />}
            title="Housing"
          />
          <div className="space-y-0">
            <DataRow label="Owner-Occupied" value={pct(district.owner_occupied_pct)} />
            <DataRow label="Renter-Occupied" value={district.owner_occupied_pct != null ? pct(Math.round((100 - district.owner_occupied_pct) * 10) / 10) : null} />
            <DataRow label="Median Home Value" value={dollar(district.median_home_value)} />
            <DataRow label="Median Gross Rent" value={dollar(district.median_rent)} />
          </div>
        </div>
      )}

      {/* Health & Veterans */}
      {(district.uninsured_pct != null || district.veteran_pct != null) && (
        <div className="bg-card rounded-xl border border-border p-6 mb-6">
          <SectionHeader
            icon={<Heart className="h-5 w-5 text-destructive" />}
            title="Health & Veterans"
          />
          <div className="space-y-0">
            <DataRow label="Uninsured" value={pct(district.uninsured_pct)} />
            <DataRow label="Veterans (18+)" value={pct(district.veteran_pct)} />
          </div>
        </div>
      )}

      {/* Linked Candidates */}
      {linkedCandidates.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-6 mb-6">
          <SectionHeader
            icon={<UserCheck className="h-5 w-5 text-primary" />}
            title="Tracked Representatives"
          />
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
          <SectionHeader
            icon={<AlertCircle className="h-5 w-5 text-accent" />}
            title="Top Issues"
          />
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
            U.S. Census ACS 5-Year Estimates (2022)
          </a>
          . Competitiveness ratings from the{" "}
          <a
            href="https://www.cookpolitical.com/ratings/house-race-ratings"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            Cook Political Report (March 2026)
          </a>
          .
        </p>
      </div>
    </div>
  );
}
