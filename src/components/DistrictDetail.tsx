import { useState, useEffect, useMemo } from "react";
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
import { BillImpactPanel } from "@/components/BillImpactPanel";
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
  Landmark,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { exportDistrictPDF } from "@/lib/districtDetailExport";
import { SubjectAIPanel } from "@/components/SubjectAIPanel";

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

interface PollingItem {
  id: string;
  source: string;
  candidate_or_topic: string;
  poll_type: string;
  approve_pct: number | null;
  disapprove_pct: number | null;
  favor_pct: number | null;
  oppose_pct: number | null;
  date_conducted: string;
  sample_size: number | null;
}

interface IntelBriefingItem {
  id: string;
  title: string;
  summary: string;
  source_name: string;
  source_url: string | null;
  published_at: string | null;
  scope: string;
}

interface ForecastItem {
  id: string;
  source: string;
  rating: string | null;
  dem_win_prob: number | null;
  rep_win_prob: number | null;
  margin: number | null;
  last_updated: string | null;
}

interface DistrictFinanceItem {
  id: string;
  candidate_name: string;
  party: string | null;
  total_raised: number | null;
  total_spent: number | null;
  cash_on_hand: number | null;
  source: string;
  cycle: number;
}

interface CongressMemberItem {
  name: string;
  party: string | null;
  bioguide_id: string;
  official_url: string | null;
}

interface CongressBillItem {
  id: string;
  bill_id: string;
  short_title: string | null;
  title: string;
  sponsor_name: string | null;
  status: string | null;
  latest_action_text: string | null;
  latest_action_date: string | null;
  policy_area: string | null;
}

interface StateLegElectionItem {
  id: string;
  candidate_name: string;
  party: string | null;
  chamber: string;
  district_number: string;
  election_year: number;
  votes: number | null;
  vote_pct: number | null;
  is_winner: boolean | null;
}

interface MagaFileItem {
  id: string;
  name: string;
  slug: string;
  tags: string[];
}

interface PredictionMarketItem {
  id: string;
  title: string;
  yes_price: number | null;
  no_price: number | null;
  volume: number | null;
  source: string;
  market_url: string | null;
  last_traded_at: string | null;
}

interface CandidateProfileItem {
  id: string;
  name: string;
  slug: string;
  tags: string[];
}

interface StateLegProfileItem {
  id: string;
  district_id: string;
  chamber: string;
  district_number: string;
  population: number | null;
  median_income: number | null;
  poverty_rate: number | null;
  unemployment_rate: number | null;
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
  const [pollingItems, setPollingItems] = useState<PollingItem[]>([]);
  const [intelItems, setIntelItems] = useState<IntelBriefingItem[]>([]);
  const [forecastItems, setForecastItems] = useState<ForecastItem[]>([]);
  const [districtFinance, setDistrictFinance] = useState<DistrictFinanceItem[]>([]);
  const [congressMembers, setCongressMembers] = useState<CongressMemberItem[]>([]);
  const [congressBills, setCongressBills] = useState<CongressBillItem[]>([]);
  const [stateLegResults, setStateLegResults] = useState<StateLegElectionItem[]>([]);
  const [magaFiles, setMagaFiles] = useState<MagaFileItem[]>([]);
  const [predictionMarkets, setPredictionMarkets] = useState<PredictionMarketItem[]>([]);
  const [candidateProfiles, setCandidateProfiles] = useState<CandidateProfileItem[]>([]);
  const [stateLegProfiles, setStateLegProfiles] = useState<StateLegProfileItem[]>([]);
  const candidateSlugs = getCandidatesForDistrict(district.district_id);
  const linkedCandidates = candidateSlugs
    .map((slug) => getCandidateBySlug(slug))
    .filter(Boolean);

  const cookRating = getCookRating(district.district_id);
  const stateAbbr = district.district_id.split("-")[0];

  // Use DB top_issues or derive from demographics
  const effectiveTopIssues = useMemo(
    () => district.top_issues.length > 0 ? district.top_issues : deriveTopIssues(district),
    [district]
  );

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
        // If no direct match, show the most recent reports as general guidance
        setMessagingItems(matched.length > 0 ? matched.slice(0, 10) : data.slice(0, 6));
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

    // Load polling data relevant to district issues
    supabase
      .from("polling_data")
      .select("id, source, candidate_or_topic, poll_type, approve_pct, disapprove_pct, favor_pct, oppose_pct, date_conducted, sample_size")
      .order("date_conducted", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (!data) return;
        const issueSet = new Set(effectiveTopIssues.map(i => i.toLowerCase()));
        const matched = data.filter(p => {
          const topic = p.candidate_or_topic.toLowerCase();
          return [...issueSet].some(i => topic.includes(i) || i.includes(topic));
        });
        setPollingItems(matched.length > 0 ? matched.slice(0, 8) : data.slice(0, 4));
      });

    // Load intel briefings related to this district's state/scope
    const districtNum = district.district_id.split("-")[1];
    supabase
      .from("intel_briefings")
      .select("id, title, summary, source_name, source_url, published_at, scope")
      .order("published_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (!data) return;
        const stateNameLower = stateName.toLowerCase();
        const issueSet = new Set(effectiveTopIssues.map(i => i.toLowerCase()));
        // Match briefings mentioning this state, district, or key issues
        const matched = data.filter(b => {
          const text = (b.title + " " + b.summary).toLowerCase();
          return text.includes(stateNameLower) || text.includes(stateAbbr.toLowerCase()) ||
            text.includes(`district ${districtNum}`) ||
            [...issueSet].some(i => text.includes(i));
        });
        setIntelItems(matched.slice(0, 8));
      });

    // Load election forecasts for this district
    supabase
      .from("election_forecasts")
      .select("id, source, rating, dem_win_prob, rep_win_prob, margin, last_updated")
      .eq("state_abbr", stateAbbr)
      .eq("district", districtNum || "0")
      .eq("race_type", "house")
      .then(({ data }) => {
        if (data) setForecastItems(data as ForecastItem[]);
      });

    // Load campaign finance for candidates in this district
    supabase
      .from("campaign_finance")
      .select("id, candidate_name, party, total_raised, total_spent, cash_on_hand, source, cycle")
      .eq("state_abbr", stateAbbr)
      .eq("district", district.district_id)
      .order("total_raised", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setDistrictFinance(data as DistrictFinanceItem[]);
      });

    // Load congress members for this district
    supabase
      .from("congress_members")
      .select("name, party, bioguide_id, official_url")
      .eq("state", stateAbbr)
      .eq("district", districtNum || "0")
      .limit(5)
      .then(({ data }) => {
        if (data) setCongressMembers(data as CongressMemberItem[]);
      });

    // Load recent bills relevant to district top issues
    supabase
      .from("congress_bills")
      .select("id, bill_id, short_title, title, sponsor_name, status, latest_action_text, latest_action_date, policy_area")
      .order("latest_action_date", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (!data) return;
        const issueSet2 = new Set(effectiveTopIssues.map(i => i.toLowerCase()));
        const matched = data.filter(b => {
          const text = ((b.policy_area || "") + " " + (b.short_title || "") + " " + b.title).toLowerCase();
          return [...issueSet2].some(i => text.includes(i));
        });
        setCongressBills(matched.slice(0, 8));
      });

    // Load state legislative election results for this state
    supabase
      .from("state_leg_election_results")
      .select("id, candidate_name, party, chamber, district_number, election_year, votes, vote_pct, is_winner")
      .eq("state_abbr", stateAbbr)
      .order("election_year", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setStateLegResults(data as StateLegElectionItem[]);
      });

    // Load MAGA files relevant to district issues
    supabase
      .from("maga_files")
      .select("id, name, slug, tags")
      .limit(100)
      .then(({ data }) => {
        if (!data) return;
        const issueSet3 = new Set(effectiveTopIssues.map(i => i.toLowerCase()));
        const matched = data.filter(m => {
          const text = m.name.toLowerCase();
          return [...issueSet3].some(i => text.includes(i) || m.tags.some(t => t.toLowerCase().includes(i)));
        });
        setMagaFiles(matched.slice(0, 6));
      });

    // Load prediction markets for this district/state
    supabase
      .from("prediction_markets")
      .select("id, title, yes_price, no_price, volume, source, market_url, last_traded_at")
      .or(`state_abbr.eq.${stateAbbr},title.ilike.%${stateAbbrToName(stateAbbr)}%`)
      .eq("status", "active")
      .order("volume", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setPredictionMarkets(data as PredictionMarketItem[]);
      });

    // Load candidate profiles relevant to this district
    supabase
      .from("candidate_profiles")
      .select("id, name, slug, tags")
      .eq("is_subpage", false)
      .limit(500)
      .then(({ data }) => {
        if (!data) return;
        const stateNameLower = stateAbbrToName(stateAbbr).toLowerCase();
        const districtNum = district.district_id.split("-")[1];
        const matched = data.filter(c => {
          const text = c.name.toLowerCase();
          return text.includes(stateNameLower) || text.includes(stateAbbr.toLowerCase()) ||
            c.tags.some(t => t.toLowerCase().includes(stateNameLower) || t.toLowerCase().includes(stateAbbr.toLowerCase())) ||
            candidateSlugs.includes(c.slug);
        });
        setCandidateProfiles(matched.slice(0, 10));
      });

    // Load state legislative profiles for this state
    supabase
      .from("state_legislative_profiles")
      .select("id, district_id, chamber, district_number, population, median_income, poverty_rate, unemployment_rate")
      .eq("state_abbr", stateAbbr)
      .order("district_number")
      .limit(20)
      .then(({ data }) => {
        if (data) setStateLegProfiles(data as StateLegProfileItem[]);
      });
  }, [stateAbbr, effectiveTopIssues, district.district_id]);

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
          <SubjectAIPanel subjectType="district" subjectRef={district.district_id} subjectTitle={`District ${district.district_id}`} defaultScope="district" defaultScopeRef={district.district_id} />
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
          {/* AI Bill Impact Analysis */}
          <BillImpactPanel districtId={district.district_id} stateAbbr={stateAbbr} />
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

          {/* Election Forecasts */}
          {forecastItems.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <SectionHeader
                icon={<BarChart3 className="h-5 w-5 text-primary" />}
                title="Election Forecasts"
                subtitle="Current race ratings and win probabilities for this district"
              />
              <div className="space-y-2">
                {forecastItems.map((f) => (
                  <div key={f.id} className="p-3 rounded-lg bg-muted/50 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{f.source}</p>
                      {f.last_updated && <p className="text-[10px] text-muted-foreground">Updated: {f.last_updated}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      {f.rating && <span className="text-xs font-bold bg-accent/10 text-accent px-2 py-0.5 rounded">{f.rating}</span>}
                      {f.dem_win_prob != null && <span className="text-[10px] text-blue-600">D: {f.dem_win_prob}%</span>}
                      {f.rep_win_prob != null && <span className="text-[10px] text-red-600">R: {f.rep_win_prob}%</span>}
                      {f.margin != null && <span className="text-[10px] text-muted-foreground">Margin: {f.margin > 0 ? "+" : ""}{f.margin}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Issue Polling */}
          {pollingItems.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <SectionHeader
                icon={<Vote className="h-5 w-5 text-primary" />}
                title="Relevant Polling"
                subtitle="Public opinion polls on issues important to this district"
              />
              <div className="space-y-2">
                {pollingItems.map((p) => (
                  <div key={p.id} className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-foreground capitalize">{p.candidate_or_topic}</p>
                      <span className="text-[9px] bg-secondary/50 text-secondary-foreground px-1.5 py-0.5 rounded">{p.source}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {p.approve_pct != null && <span>Approve: <strong className="text-foreground">{p.approve_pct}%</strong></span>}
                      {p.disapprove_pct != null && <span>Disapprove: <strong className="text-foreground">{p.disapprove_pct}%</strong></span>}
                      {p.favor_pct != null && <span>Favor: <strong className="text-foreground">{p.favor_pct}%</strong></span>}
                      {p.oppose_pct != null && <span>Oppose: <strong className="text-foreground">{p.oppose_pct}%</strong></span>}
                      {p.sample_size && <span>n={p.sample_size}</span>}
                      <span>{p.date_conducted}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Intel Briefings */}
          {intelItems.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <SectionHeader
                icon={<Newspaper className="h-5 w-5 text-primary" />}
                title="Intelligence Briefings"
                subtitle="Recent intelligence relevant to this district and its key issues"
              />
              <div className="space-y-2">
                {intelItems.map((b) => (
                  <div key={b.id} className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-foreground line-clamp-1">{b.title}</p>
                      <span className="text-[9px] uppercase bg-accent/10 text-accent px-1.5 py-0.5 rounded shrink-0 ml-2">{b.scope}</span>
                    </div>
                    {b.summary && <p className="text-xs text-muted-foreground line-clamp-2 mb-1">{b.summary}</p>}
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{b.source_name}</span>
                      {b.published_at && <span>• {new Date(b.published_at).toLocaleDateString()}</span>}
                      {b.source_url && (
                        <a href={b.source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-auto">Read →</a>
                      )}
                    </div>
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

          {/* District Campaign Finance Summary */}
          {districtFinance.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <SectionHeader
                icon={<DollarSign className="h-5 w-5 text-primary" />}
                title="District Campaign Finance"
                subtitle="Fundraising overview for candidates in this district"
              />
              <div className="space-y-2">
                {districtFinance.filter(f => f.candidate_name !== `${stateAbbr} Aggregate`).slice(0, 6).map((f) => (
                  <div key={f.id} className="p-3 rounded-lg bg-muted/50 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{f.candidate_name}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {f.party && <span className="font-bold">{f.party}</span>}
                        <span>{f.source} · {f.cycle}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      {f.total_raised != null && <p className="text-xs font-bold text-foreground">${(f.total_raised / 1000).toFixed(0)}K raised</p>}
                      {f.cash_on_hand != null && <p className="text-[10px] text-muted-foreground">${(f.cash_on_hand / 1000).toFixed(0)}K COH</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current Representatives */}
          {congressMembers.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <SectionHeader
                icon={<Building2 className="h-5 w-5 text-primary" />}
                title="Current Representatives"
                subtitle="Congress members representing this district"
              />
              <div className="space-y-2">
                {congressMembers.map((m) => (
                  <div key={m.bioguide_id} className="p-3 rounded-lg bg-muted/50 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{m.name}</p>
                      {m.party && <span className="text-[10px] text-muted-foreground">{m.party}</span>}
                    </div>
                    {m.official_url && (
                      <a href={m.official_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline">Official Site →</a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Relevant Legislation */}
          {congressBills.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <SectionHeader
                icon={<FileText className="h-5 w-5 text-primary" />}
                title="Relevant Legislation"
                subtitle="Recent bills related to this district's top issues"
              />
              <div className="space-y-2">
                {congressBills.map((b) => (
                  <div key={b.id} className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium text-foreground line-clamp-1">{b.short_title || b.title}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1 flex-wrap">
                      <span className="bg-secondary/50 text-secondary-foreground px-1.5 py-0.5 rounded">{b.bill_id}</span>
                      {b.policy_area && <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded">{b.policy_area}</span>}
                      {b.status && <span>{b.status}</span>}
                      {b.sponsor_name && <span>by {b.sponsor_name}</span>}
                    </div>
                    {b.latest_action_text && (
                      <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">Latest: {b.latest_action_text}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* State Legislative Election History */}
          {stateLegResults.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <SectionHeader
                icon={<Vote className="h-5 w-5 text-primary" />}
                title="State Legislative Elections"
                subtitle={`Recent state-level election results in ${stateAbbrToName(stateAbbr)}`}
              />
              <div className="space-y-2">
                {stateLegResults.slice(0, 10).map((r) => (
                  <div key={r.id} className="p-3 rounded-lg bg-muted/50 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{r.candidate_name}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {r.party && <span className="font-bold">{r.party}</span>}
                        <span>{r.chamber} Dist. {r.district_number}</span>
                        <span>{r.election_year}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      {r.vote_pct != null && <p className="text-xs font-bold text-foreground">{r.vote_pct}%</p>}
                      {r.is_winner && <span className="text-[9px] bg-accent/10 text-accent px-1.5 py-0.5 rounded">Won</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MAGA Files */}
          {magaFiles.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <SectionHeader
                icon={<Shield className="h-5 w-5 text-destructive" />}
                title="Opposition Research Files"
                subtitle="Relevant opposition research for this district's key issues"
              />
              <div className="space-y-2">
                {magaFiles.map((m) => (
                  <div key={m.id} className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium text-foreground">{m.name}</p>
                    {m.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {m.tags.slice(0, 4).map((tag) => (
                          <span key={tag} className="text-[9px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prediction Markets */}
          {predictionMarkets.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <SectionHeader
                icon={<TrendingDown className="h-5 w-5 text-primary" />}
                title="Prediction Markets"
                subtitle="Market-based odds for races in this state/district"
              />
              <div className="space-y-2">
                {predictionMarkets.map((m) => (
                  <div key={m.id} className="p-3 rounded-lg bg-muted/50 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground line-clamp-1">{m.title}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                        <span>{m.source}</span>
                        {m.volume != null && <span>Vol: ${m.volume.toLocaleString()}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-2">
                      {m.yes_price != null && <span className="text-xs font-bold text-accent">Yes: {(m.yes_price * 100).toFixed(0)}¢</span>}
                      {m.no_price != null && <span className="text-xs text-muted-foreground">No: {(m.no_price * 100).toFixed(0)}¢</span>}
                      {m.market_url && (
                        <a href={m.market_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline">View →</a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Candidate Profiles */}
          {candidateProfiles.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <SectionHeader
                icon={<UserCheck className="h-5 w-5 text-primary" />}
                title="Candidate Research Profiles"
                subtitle="In-depth opposition research files for candidates in this area"
              />
              <div className="space-y-2">
                {candidateProfiles.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onSelectCandidate?.(c.slug)}
                    className="w-full text-left p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <p className="text-sm font-medium text-foreground">{c.name}</p>
                    {c.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {c.tags.slice(0, 4).map((tag) => (
                          <span key={tag} className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{tag}</span>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* State Legislative Demographics */}
          {stateLegProfiles.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <SectionHeader
                icon={<Landmark className="h-5 w-5 text-primary" />}
                title="State Legislative Districts"
                subtitle={`Demographic snapshot of state-level districts in ${stateAbbrToName(stateAbbr)}`}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {stateLegProfiles.slice(0, 8).map((s) => (
                  <div key={s.id} className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs font-bold text-foreground mb-1">{s.chamber} Dist. {s.district_number}</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                      {s.population != null && <span>Pop: {s.population.toLocaleString()}</span>}
                      {s.median_income != null && <span>Income: ${s.median_income.toLocaleString()}</span>}
                      {s.poverty_rate != null && <span>Poverty: {s.poverty_rate}%</span>}
                      {s.unemployment_rate != null && <span>Unemp: {s.unemployment_rate}%</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {localImpacts.length === 0 && messagingItems.length === 0 && narrativeItems.length === 0 && effectiveTopIssues.length === 0 && pollingItems.length === 0 && intelItems.length === 0 && forecastItems.length === 0 && districtFinance.length === 0 && congressBills.length === 0 && predictionMarkets.length === 0 && candidateProfiles.length === 0 && (
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
