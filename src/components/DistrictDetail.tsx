import { useState, useEffect } from "react";
import { type DistrictProfile } from "@/data/districtIntel";
import { DistrictBoundaryMap } from "@/components/DistrictBoundaryMap";
import { CookRatingHistory } from "@/components/CookRatingHistory";
import { CookPVIChart } from "@/components/CookPVIChart";
import { CongressionalElectionsSection } from "@/components/CongressionalElectionsSection";
import { ForecastComparisonPanel } from "@/components/ForecastComparisonPanel";
import { MITElectionHistoryPanel } from "@/components/MITElectionHistoryPanel";
import { PresidentialCountyMap } from "@/components/PresidentialCountyMap";
import { getCandidatesForDistrict } from "@/data/candidateDistricts";
import { getCandidateBySlug } from "@/data/candidates";
import { DistrictPollingPanel } from "@/components/DistrictPollingPanel";
import { AreaFinancePanel } from "@/components/AreaFinancePanel";
import { DistrictCongressPanel } from "@/components/DistrictCongressPanel";
import { DistrictNewsTab } from "@/components/DistrictNewsTab";
import { getCookRating, getCookRatingColor, type CookRating } from "@/data/cookRatings";
import { supabase } from "@/integrations/supabase/client";
import { stateAbbrToName } from "@/lib/stateAbbreviations";
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
  TrendingDown,
  BarChart3,
  Download,
  Newspaper,
  Vote,
  Building2,
  LayoutDashboard,
  Briefcase,
  Shield,
  Globe,
  FileText,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { exportDistrictPDF } from "@/lib/districtDetailExport";

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

function StatCard({ icon, label, value, sublabel }: { icon: React.ReactNode; label: string; value: string; sublabel?: string }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-display text-lg font-bold text-foreground">{value}</p>
        {sublabel && <p className="text-[10px] text-muted-foreground">{sublabel}</p>}
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5 ml-7">{subtitle}</p>}
    </div>
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

interface LocalImpact {
  slug: string;
  state: string;
  summary: string;
  tags: string[];
}

interface MessagingItem {
  id: string;
  title: string;
  slug: string;
  source: string;
  summary: string;
  issue_areas: string[];
}

interface NarrativeItem {
  id: string;
  name: string;
  slug: string;
  tags: string[];
}

/** Derive top issues from demographics when the DB field is empty */
function deriveTopIssues(d: DistrictProfile): string[] {
  const issues: string[] = [];
  if (d.poverty_rate != null && d.poverty_rate > 15) issues.push("poverty");
  if (d.unemployment_rate != null && d.unemployment_rate > 6) issues.push("jobs");
  if (d.uninsured_pct != null && d.uninsured_pct > 10) issues.push("healthcare");
  if (d.median_home_value != null && d.median_income != null && d.median_home_value / d.median_income > 5) issues.push("housing costs");
  if (d.education_bachelor_pct != null && d.education_bachelor_pct < 20) issues.push("education");
  if (d.foreign_born_pct != null && d.foreign_born_pct > 15) issues.push("immigration");
  if (d.veteran_pct != null && d.veteran_pct > 10) issues.push("veterans");
  if (d.median_income != null && d.median_income < 45000) issues.push("income inequality");
  if (d.owner_occupied_pct != null && d.owner_occupied_pct < 45) issues.push("housing");
  if (d.median_rent != null && d.median_income != null && (d.median_rent * 12) / d.median_income > 0.3) issues.push("cost of living");
  // Always include economy as a baseline
  if (issues.length === 0) issues.push("economy", "healthcare", "education");
  return issues.slice(0, 6);
}

export function DistrictDetail({ district, onBack, onSelectCandidate }: DistrictDetailProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [localImpacts, setLocalImpacts] = useState<LocalImpact[]>([]);
  const [messagingItems, setMessagingItems] = useState<MessagingItem[]>([]);
  const [narrativeItems, setNarrativeItems] = useState<NarrativeItem[]>([]);
  const candidateSlugs = getCandidatesForDistrict(district.district_id);
  const linkedCandidates = candidateSlugs
    .map((slug) => getCandidateBySlug(slug))
    .filter(Boolean);

  const cookRating = getCookRating(district.district_id);
  const stateAbbr = district.district_id.split("-")[0];

  // Use DB top_issues or derive from demographics
  const effectiveTopIssues = district.top_issues.length > 0 ? district.top_issues : deriveTopIssues(district);

  const fmt = (n: number | null | undefined) => n != null ? n.toLocaleString() : null;
  const pct = (n: number | null | undefined) => n != null ? `${n}%` : null;
  const dollar = (n: number | null | undefined) => n != null ? `$${n.toLocaleString()}` : null;

  // Load local impacts, messaging guidance, and narrative reports
  useEffect(() => {
    const stateName = stateAbbrToName(stateAbbr);

    supabase
      .from("local_impacts")
      .select("slug, state, summary, tags")
      .eq("state", stateName)
      .limit(20)
      .then(({ data }) => { if (data) setLocalImpacts(data); });

    // Load messaging guidance matching district issues
    supabase
      .from("messaging_guidance")
      .select("id, title, slug, source, summary, issue_areas")
      .order("published_date", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (!data) return;
        const issueSet = new Set(effectiveTopIssues.map(i => i.toLowerCase()));
        const matched = data.filter(m =>
          m.issue_areas.some(a => {
            const al = a.toLowerCase();
            return issueSet.has(al) || [...issueSet].some(i => al.includes(i) || i.includes(al));
          })
        );
        setMessagingItems(matched.slice(0, 10));
      });

    // Load narrative reports
    supabase
      .from("narrative_reports")
      .select("id, name, slug, tags")
      .limit(100)
      .then(({ data }) => {
        if (!data) return;
        const issueSet = new Set(effectiveTopIssues.map(i => i.toLowerCase()));
        const matched = data.filter(n => {
          const nameLower = n.name.toLowerCase();
          return [...issueSet].some(i => nameLower.includes(i) || n.tags.some(t => t.toLowerCase().includes(i)));
        });
        setNarrativeItems(matched.length > 0 ? matched.slice(0, 8) : data.slice(0, 5));
      });
  }, [stateAbbr, effectiveTopIssues]);

  // Compute additional derived stats
  const renterPct = district.owner_occupied_pct != null ? Math.round((100 - district.owner_occupied_pct) * 10) / 10 : null;
  const affordabilityRatio = district.median_income && district.median_home_value
    ? (district.median_home_value / district.median_income).toFixed(1)
    : null;

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
        <div className="flex items-start justify-between">
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
                <span className="text-sm text-muted-foreground">Congressional District</span>
              </div>
            </div>
          </div>
          <button
            onClick={async () => {
              try {
                await exportDistrictPDF(district, cookRating);
              } catch (e) {
                console.error("PDF export failed:", e);
              }
            }}
            className="win98-button text-[10px] flex items-center gap-1 shrink-0"
          >
            <Download className="h-3 w-3" />
            PDF
          </button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1 rounded-lg">
          <TabsTrigger value="overview" className="flex items-center gap-1 text-xs">
            <LayoutDashboard className="h-3 w-3" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="demographics" className="flex items-center gap-1 text-xs">
            <Users className="h-3 w-3" />
            Demographics
          </TabsTrigger>
          <TabsTrigger value="elections" className="flex items-center gap-1 text-xs">
            <Vote className="h-3 w-3" />
            Elections
          </TabsTrigger>
          <TabsTrigger value="congress" className="flex items-center gap-1 text-xs">
            <Building2 className="h-3 w-3" />
            Congress
          </TabsTrigger>
          <TabsTrigger value="finance" className="flex items-center gap-1 text-xs">
            <DollarSign className="h-3 w-3" />
            Finance
          </TabsTrigger>
          <TabsTrigger value="issues" className="flex items-center gap-1 text-xs">
            <FileText className="h-3 w-3" />
            Issues & Impact
          </TabsTrigger>
          <TabsTrigger value="news" className="flex items-center gap-1 text-xs">
            <Newspaper className="h-3 w-3" />
            News
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <DistrictBoundaryMap districtId={district.district_id} stateName={district.state} />
          {cookRating && <CookRatingBanner rating={cookRating} />}
          {cookRating && <CookRatingHistory districtId={district.district_id} currentRating={cookRating} />}
          <CookPVIChart districtId={district.district_id} />

          <div className="grid grid-cols-2 gap-3 mb-6">
            {district.population != null && (
              <StatCard icon={<Users className="h-5 w-5 text-muted-foreground" />} label="Population" value={fmt(district.population)!} />
            )}
            {district.median_income != null && (
              <StatCard icon={<DollarSign className="h-5 w-5 text-muted-foreground" />} label="Median Income" value={dollar(district.median_income)!} />
            )}
            {district.median_age != null && (
              <StatCard icon={<Calendar className="h-5 w-5 text-muted-foreground" />} label="Median Age" value={String(district.median_age)} />
            )}
            {district.education_bachelor_pct != null && (
              <StatCard icon={<GraduationCap className="h-5 w-5 text-muted-foreground" />} label="Bachelor's Degree+" value={pct(district.education_bachelor_pct)!} />
            )}
            {district.poverty_rate != null && (
              <StatCard icon={<TrendingDown className="h-5 w-5 text-muted-foreground" />} label="Poverty Rate" value={pct(district.poverty_rate)!} />
            )}
            {district.unemployment_rate != null && (
              <StatCard icon={<Briefcase className="h-5 w-5 text-muted-foreground" />} label="Unemployment" value={pct(district.unemployment_rate)!} />
            )}
          </div>

          {/* Linked Candidates */}
          {linkedCandidates.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <SectionHeader icon={<UserCheck className="h-5 w-5 text-primary" />} title="Tracked Representatives" />
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
                        <p className="text-sm font-medium text-foreground truncate">{candidate.name}</p>
                      </div>
                      <span className={`tag ${categoryColors[candidate.category] || ""}`}>{candidate.category}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top Issues */}
          {effectiveTopIssues.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <SectionHeader icon={<AlertCircle className="h-5 w-5 text-accent" />} title="Top Issues" subtitle="Key voter concerns in this district" />
              <div className="space-y-3">
                {effectiveTopIssues.map((issue, i) => (
                  <div key={issue} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">{i + 1}</span>
                    <span className="text-sm font-medium text-foreground capitalize">{issue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Stats Summary */}
          {(district.voting_patterns || affordabilityRatio) && (
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <SectionHeader icon={<Globe className="h-5 w-5 text-primary" />} title="District At a Glance" />
              <div className="space-y-0">
                {affordabilityRatio && <DataRow label="Home Price-to-Income Ratio" value={`${affordabilityRatio}x`} />}
                {district.foreign_born_pct != null && <DataRow label="Foreign-Born Population" value={pct(district.foreign_born_pct)} />}
                {district.veteran_pct != null && <DataRow label="Veteran Population" value={pct(district.veteran_pct)} />}
                {district.uninsured_pct != null && <DataRow label="Uninsured Rate" value={pct(district.uninsured_pct)} />}
              </div>
            </div>
          )}

          {/* Data Source */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="font-display text-lg font-bold text-foreground mb-3">Data Sources</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              District demographics sourced from the{" "}
              <a href="https://www.census.gov/programs-surveys/acs" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">U.S. Census ACS 5-Year Estimates (2022)</a>.
              Competitiveness ratings from the{" "}
              <a href="https://www.cookpolitical.com/ratings/house-race-ratings" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">Cook Political Report (March 2026)</a>.
              Partisan Voting Index from the{" "}
              <a href="https://www.cookpolitical.com/cook-pvi" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">Cook PVI (2024)</a>.
              Election history from{" "}
              <a href="https://openelections.net" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">OpenElections</a>
              {" "}and the{" "}
              <a href="https://electionlab.mit.edu/data" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">MIT Election Data + Science Lab</a>.
              Congressional data from{" "}
              <a href="https://api.congress.gov" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">Congress.gov API</a>.
            </p>
          </div>
        </TabsContent>

        {/* Demographics Tab */}
        <TabsContent value="demographics" className="mt-4">
          <div className="grid grid-cols-2 gap-3 mb-6">
            {district.population != null && (
              <StatCard icon={<Users className="h-5 w-5 text-muted-foreground" />} label="Population" value={fmt(district.population)!} />
            )}
            {district.median_income != null && (
              <StatCard icon={<DollarSign className="h-5 w-5 text-muted-foreground" />} label="Median Income" value={dollar(district.median_income)!} />
            )}
            {district.median_age != null && (
              <StatCard icon={<Calendar className="h-5 w-5 text-muted-foreground" />} label="Median Age" value={String(district.median_age)} />
            )}
            {district.education_bachelor_pct != null && (
              <StatCard icon={<GraduationCap className="h-5 w-5 text-muted-foreground" />} label="Bachelor's Degree+" value={pct(district.education_bachelor_pct)!} />
            )}
          </div>

          {/* Economic Indicators */}
          {(district.poverty_rate != null || district.unemployment_rate != null || district.total_households != null) && (
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <SectionHeader icon={<TrendingDown className="h-5 w-5 text-accent" />} title="Economic Indicators" subtitle="Income, employment, and economic health metrics" />
              <div className="space-y-0">
                <DataRow label="Poverty Rate" value={pct(district.poverty_rate)} />
                <DataRow label="Unemployment Rate" value={pct(district.unemployment_rate)} />
                <DataRow label="Total Households" value={fmt(district.total_households)} />
                <DataRow label="Avg. Household Size" value={district.avg_household_size != null ? String(district.avg_household_size) : null} />
                {affordabilityRatio && <DataRow label="Home Price-to-Income Ratio" value={`${affordabilityRatio}x`} />}
              </div>
            </div>
          )}

          {/* Racial & Ethnic Demographics */}
          {(district.white_pct != null || district.black_pct != null || district.hispanic_pct != null || district.asian_pct != null) && (
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <SectionHeader icon={<Users className="h-5 w-5 text-primary" />} title="Racial & Ethnic Demographics" subtitle="Population breakdown by race and ethnicity" />
              <div className="space-y-0">
                <DataRow label="White" value={pct(district.white_pct)} />
                <DataRow label="Black / African American" value={pct(district.black_pct)} />
                <DataRow label="Hispanic / Latino" value={pct(district.hispanic_pct)} />
                <DataRow label="Asian" value={pct(district.asian_pct)} />
                <DataRow label="Foreign-Born" value={pct(district.foreign_born_pct)} />
              </div>
              {/* Diversity summary */}
              {district.white_pct != null && district.white_pct < 50 && (
                <p className="text-xs text-primary mt-3 bg-primary/5 rounded-lg p-2">
                  ⚡ Majority-minority district — no single racial group makes up more than 50% of the population.
                </p>
              )}
            </div>
          )}

          {/* Housing */}
          {(district.owner_occupied_pct != null || district.median_home_value != null || district.median_rent != null) && (
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <SectionHeader icon={<Home className="h-5 w-5 text-[hsl(var(--tag-house))]" />} title="Housing" subtitle="Homeownership, home values, and rental costs" />
              <div className="space-y-0">
                <DataRow label="Owner-Occupied" value={pct(district.owner_occupied_pct)} />
                <DataRow label="Renter-Occupied" value={pct(renterPct)} />
                <DataRow label="Median Home Value" value={dollar(district.median_home_value)} />
                <DataRow label="Median Gross Rent" value={dollar(district.median_rent)} />
              </div>
            </div>
          )}

          {/* Health & Veterans */}
          {(district.uninsured_pct != null || district.veteran_pct != null) && (
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <SectionHeader icon={<Heart className="h-5 w-5 text-destructive" />} title="Health & Veterans" subtitle="Healthcare coverage and veteran population" />
              <div className="space-y-0">
                <DataRow label="Uninsured" value={pct(district.uninsured_pct)} />
                <DataRow label="Veterans (18+)" value={pct(district.veteran_pct)} />
              </div>
              {district.uninsured_pct != null && district.uninsured_pct > 10 && (
                <p className="text-xs text-destructive mt-3 bg-destructive/5 rounded-lg p-2">
                  ⚠️ Above-average uninsured rate — national average is approximately 8%.
                </p>
              )}
            </div>
          )}
        </TabsContent>

        {/* Elections Tab */}
        <TabsContent value="elections" className="mt-4">
          {cookRating && <CookRatingBanner rating={cookRating} />}
          <DistrictPollingPanel districtId={district.district_id} />
          <ForecastComparisonPanel districtId={district.district_id} />
          <CongressionalElectionsSection districtId={district.district_id} />
          <MITElectionHistoryPanel districtId={district.district_id} />
          <PresidentialCountyMap stateAbbr={stateAbbr} />
        </TabsContent>

        {/* Congress Tab */}
        <TabsContent value="congress" className="mt-4">
          <DistrictCongressPanel districtId={district.district_id} />
        </TabsContent>

        {/* Finance Tab */}
        <TabsContent value="finance" className="mt-4">
          <AreaFinancePanel stateAbbr={stateAbbr} districtId={district.district_id} />
        </TabsContent>

        {/* Issues & Impact Tab */}
        <TabsContent value="issues" className="mt-4">
          {/* Top Issues */}
          {effectiveTopIssues.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <SectionHeader icon={<AlertCircle className="h-5 w-5 text-accent" />} title="Top Issues" subtitle={district.top_issues.length > 0 ? "Key voter concerns identified in this district" : "Derived from district demographics"} />
              <div className="space-y-3">
                {effectiveTopIssues.map((issue, i) => (
                  <div key={issue} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">{i + 1}</span>
                    <span className="text-sm font-medium text-foreground capitalize">{issue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messaging Guidance */}
          {messagingItems.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <SectionHeader
                icon={<FileText className="h-5 w-5 text-primary" />}
                title="Messaging Guidance"
                subtitle="Research-backed messaging relevant to this district's key issues"
              />
              <div className="space-y-2">
                {messagingItems.map((item) => (
                  <div key={item.id} className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium text-foreground mb-1">{item.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">{item.summary}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] bg-secondary/50 text-secondary-foreground px-1.5 py-0.5 rounded">{item.source}</span>
                      {item.issue_areas.slice(0, 3).map((a) => (
                        <span key={a} className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{a}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Narrative Reports */}
          {narrativeItems.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <SectionHeader
                icon={<Globe className="h-5 w-5 text-primary" />}
                title="Narrative Reports"
                subtitle="In-depth policy impact reports relevant to district concerns"
              />
              <div className="space-y-2">
                {narrativeItems.map((item) => (
                  <div key={item.id} className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.tags.slice(0, 4).map((tag) => (
                          <span key={tag} className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Local Impacts */}
          {localImpacts.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <SectionHeader
                icon={<Shield className="h-5 w-5 text-destructive" />}
                title={`State Impact Reports — ${stateAbbrToName(stateAbbr)}`}
                subtitle="How federal policy changes are affecting this state"
              />
              <div className="space-y-2">
                {localImpacts.map((impact) => (
                  <div key={impact.slug} className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium text-foreground mb-1">{impact.summary || impact.slug}</p>
                    <div className="flex flex-wrap gap-1">
                      {impact.tags.slice(0, 5).map((tag) => (
                        <span key={tag} className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{tag}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {localImpacts.length === 0 && messagingItems.length === 0 && narrativeItems.length === 0 && effectiveTopIssues.length === 0 && (
            <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No issue or impact data available yet for this district.</p>
            </div>
          )}
        </TabsContent>

        {/* News Tab */}
        <TabsContent value="news" className="mt-4">
          <DistrictNewsTab districtId={district.district_id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
