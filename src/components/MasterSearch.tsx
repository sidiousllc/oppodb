import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Search, X, User, AlertTriangle, Globe, FileText, MapPin, BarChart3, DollarSign, Landmark, Scale, Loader2, Bookmark, BookmarkCheck, Clock, Trash2, Download, FileDown, Vote, Receipt, Users, Filter, TrendingUp, Building2, History, Newspaper, Gavel, ArrowLeftRight, Briefcase, Mic, Flag, FileSearch, ShieldAlert, BookOpen, Swords, Handshake, StickyNote, ClipboardList, Brain, Target, Zap, Eye, Radar, MessageSquare } from "lucide-react";
import { exportSearchCSV, exportSearchPDF } from "@/lib/masterSearchExport";
import { supabase } from "@/integrations/supabase/client";
import { searchCandidates } from "@/data/candidates";
import { searchMagaFiles } from "@/data/magaFiles";
import { searchLocalImpact } from "@/data/localImpact";
import { searchNarrativeReports } from "@/data/narrativeReports";
import { searchDistricts, type DistrictProfile } from "@/data/districtIntel";
import { searchCountries } from "@/data/internationalCountries";

interface MasterSearchProps {
  onNavigate: (section: string, slug?: string) => void;
  districts: DistrictProfile[];
}

interface SearchResultGroup {
  key: string;
  label: string;
  icon: React.ReactNode;
  section: string;
  results: { id: string; title: string; subtitle?: string; slug?: string }[];
}

const STORAGE_KEY = "master-search-saved";
const RECENT_KEY = "master-search-recent";
const MAX_SAVED = 20;
const MAX_RECENT = 10;

function loadFromStorage(key: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch { return []; }
}

function saveToStorage(key: string, items: string[]) {
  localStorage.setItem(key, JSON.stringify(items));
}

const EMPTY_DB: Record<string, any[]> = {
  polling: [], finance: [], members: [], bills: [], forecasts: [],
  congressElections: [], stateFinance: [], mnFinance: [], winredDonations: [],
  voterStats: [], predictionMarkets: [], stateLeg: [], mitElections: [],
  trackedBills: [], messagingGuidance: [], intelBriefings: [],
  congressCommittees: [], congressVotes: [], stateLegElections: [],
  forecastHistory: [], internationalProfiles: [],
  // NEW: public records & investigations
  courtCases: [], faraRegistrants: [], federalSpending: [], lobbyingDisclosures: [],
  govContracts: [], igReports: [], congressionalRecord: [], districtProfiles: [],
  electionNightStreams: [], stateLegislators: [], stateLegBills: [],
  pollingAggregates: [],
  // NEW: international extras
  internationalElections: [], internationalLeaders: [], internationalLegislation: [],
  internationalPolling: [],
  // NEW: knowledge & collab
  wikiPages: [], warRooms: [], stakeholders: [], entityNotes: [], reports: [],
  oppoTrackers: [], watchlistItems: [],
  // NEW: AI cache (searchable summaries)
  vulnerabilityScores: [], talkingPoints: [], billImpactAnalyses: [],
  subjectImpactAnalyses: [], messagingAudienceAnalyses: [], messagingImpactAnalyses: [],
};

type DbResults = typeof EMPTY_DB;

export function MasterSearch({ onNavigate, districts }: MasterSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [savedSearches, setSavedSearches] = useState<string[]>(() => loadFromStorage(STORAGE_KEY));
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadFromStorage(RECENT_KEY));
  const [dbResults, setDbResults] = useState<DbResults>(EMPTY_DB);
  const [hasSearched, setHasSearched] = useState(false);

  // Ctrl+K shortcut to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const isCurrentQuerySaved = savedSearches.includes(query.trim());

  // Local/static data search (instant)
  const localResults = useMemo<SearchResultGroup[]>(() => {
    const q = query.trim();
    if (q.length < 2) return [];

    const groups: SearchResultGroup[] = [];

    const cands = searchCandidates(q).slice(0, 8);
    if (cands.length > 0) {
      groups.push({
        key: "candidates",
        label: "Candidate Profiles",
        icon: <User className="h-3.5 w-3.5" />,
        section: "oppohub",
        results: cands.map(c => ({
          id: c.slug,
          title: c.name,
          subtitle: `${c.category} ${c.state ? `• ${c.state}` : ""}`,
          slug: c.slug,
        })),
      });
    }

    const dists = searchDistricts(districts, q).slice(0, 8);
    if (dists.length > 0) {
      groups.push({
        key: "districts",
        label: "Congressional Districts",
        icon: <MapPin className="h-3.5 w-3.5" />,
        section: "district-intel",
        results: dists.map(d => ({
          id: d.district_id,
          title: d.district_id,
          subtitle: `${d.state || ""} • Pop: ${d.population?.toLocaleString() ?? "N/A"} • Income: $${d.median_income?.toLocaleString() ?? "N/A"}`,
          slug: d.district_id,
        })),
      });
    }

    const maga = searchMagaFiles(q).slice(0, 6);
    if (maga.length > 0) {
      groups.push({
        key: "maga",
        label: "MAGA Files",
        icon: <AlertTriangle className="h-3.5 w-3.5" />,
        section: "oppohub",
        results: maga.map(m => ({ id: m.slug, title: m.name, slug: m.slug })),
      });
    }

    const local = searchLocalImpact(q).slice(0, 6);
    if (local.length > 0) {
      groups.push({
        key: "local",
        label: "Local Impact Reports",
        icon: <Globe className="h-3.5 w-3.5" />,
        section: "oppohub",
        results: local.map(r => ({
          id: r.slug,
          title: r.state,
          subtitle: r.summary?.slice(0, 100),
          slug: r.slug,
        })),
      });
    }

    const narr = searchNarrativeReports(q).slice(0, 6);
    if (narr.length > 0) {
      groups.push({
        key: "narratives",
        label: "Narrative Reports",
        icon: <FileText className="h-3.5 w-3.5" />,
        section: "oppohub",
        results: narr.map(n => ({ id: n.slug, title: n.name, slug: n.slug })),
      });
    }

    const countries = searchCountries(q).slice(0, 8);
    if (countries.length > 0 && q.length >= 2) {
      groups.push({
        key: "countries",
        label: "🌐 Countries",
        icon: <Globe className="h-3.5 w-3.5" />,
        section: "internationalhub",
        results: countries.map(c => ({
          id: c.code,
          title: `${c.flag} ${c.name}`,
          subtitle: `${c.continent} • ${c.region}`,
          slug: c.code,
        })),
      });
    }

    return groups;
  }, [query, districts]);

  // DB search (triggered on Enter or button click)
  const runDbSearch = useCallback(async () => {
    const q = query.trim();
    if (q.length < 2) return;

    setIsSearching(true);
    setHasSearched(true);

    const likeQ = `%${q}%`;

    // Fetch voter registration stats via edge function
    const fetchVoterStats = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return [];
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voter-registration-stats`,
          {
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );
        const data = await response.json();
        if (data.states) {
          const qLower = q.toLowerCase();
          return data.states.filter((s: any) =>
            s.state?.toLowerCase().includes(qLower)
          ).slice(0, 10);
        }
        return [];
      } catch { return []; }
    };

    const LIMIT = 20;
    const safe = <T,>(p: PromiseLike<{ data: T[] | null }>) =>
      Promise.resolve(p).then(r => r?.data || []).catch(() => [] as T[]);

    const [
      polling, finance, members, bills, forecasts, congressElections,
      stateFinance, mnFinance, winredDonations, voterStats, predictionMarkets,
      stateLeg, mitElections, trackedBills, messagingGuidance, intelBriefings,
      congressCommittees, congressVotes, stateLegElections, forecastHistory,
      internationalProfiles,
      // NEW
      courtCases, faraRegistrants, federalSpending, lobbyingDisclosures,
      govContracts, igReports, congressionalRecord, districtProfiles,
      electionNightStreams, stateLegislators, stateLegBills, pollingAggregates,
      internationalElections, internationalLeaders, internationalLegislation,
      internationalPolling, wikiPages, warRooms, stakeholders, entityNotes,
      reports, oppoTrackers, watchlistItems,
      vulnerabilityScores, talkingPoints, billImpactAnalyses,
      subjectImpactAnalyses, messagingAudienceAnalyses, messagingImpactAnalyses,
    ] = await Promise.all([
      safe(supabase.from("polling_data").select("id, candidate_or_topic, source, poll_type, approve_pct, disapprove_pct, date_conducted").or(`candidate_or_topic.ilike.${likeQ},source.ilike.${likeQ},question.ilike.${likeQ}`).order("date_conducted", { ascending: false }).limit(LIMIT)),
      safe(supabase.from("campaign_finance").select("id, candidate_name, state_abbr, district, party, total_raised, total_spent, cash_on_hand, office, cycle").or(`candidate_name.ilike.${likeQ},state_abbr.ilike.${likeQ},district.ilike.${likeQ}`).order("total_raised", { ascending: false }).limit(LIMIT)),
      safe(supabase.from("congress_members").select("id, name, state, district, party, chamber, bioguide_id, candidate_slug").or(`name.ilike.${likeQ},state.ilike.${likeQ},bioguide_id.ilike.${likeQ}`).limit(LIMIT)),
      safe(supabase.from("congress_bills").select("id, bill_id, title, short_title, sponsor_name, status, latest_action_date").or(`title.ilike.${likeQ},short_title.ilike.${likeQ},sponsor_name.ilike.${likeQ},bill_id.ilike.${likeQ}`).order("latest_action_date", { ascending: false }).limit(LIMIT)),
      safe(supabase.from("election_forecasts").select("id, state_abbr, district, source, rating, race_type").or(`state_abbr.ilike.${likeQ},district.ilike.${likeQ},rating.ilike.${likeQ}`).eq("cycle", 2026).limit(LIMIT)),
      safe(supabase.from("congressional_election_results").select("id, candidate_name, state_abbr, district_number, party, election_year, votes, vote_pct, is_winner").or(`candidate_name.ilike.${likeQ},state_abbr.ilike.${likeQ}`).order("election_year", { ascending: false }).limit(LIMIT)),
      safe(supabase.from("state_cfb_candidates").select("id, candidate_name, state_abbr, chamber, party, office, total_contributions, total_expenditures, net_cash").or(`candidate_name.ilike.${likeQ},state_abbr.ilike.${likeQ},committee_name.ilike.${likeQ}`).order("total_contributions", { ascending: false }).limit(LIMIT)),
      safe(supabase.from("mn_cfb_candidates").select("id, candidate_name, chamber, committee_name, total_contributions, total_expenditures, net_cash").or(`candidate_name.ilike.${likeQ},committee_name.ilike.${likeQ}`).order("total_contributions", { ascending: false }).limit(LIMIT)),
      safe(supabase.from("winred_donations").select("id, donor_first_name, donor_last_name, donor_state, donor_city, amount, candidate_name, committee_name, transaction_date, recurring").or(`donor_last_name.ilike.${likeQ},donor_city.ilike.${likeQ},candidate_name.ilike.${likeQ},committee_name.ilike.${likeQ},donor_state.ilike.${likeQ}`).order("transaction_date", { ascending: false }).limit(LIMIT)),
      fetchVoterStats(),
      safe(supabase.from("prediction_markets").select("id, title, source, category, state_abbr, district, yes_price, no_price, volume, status, market_url").or(`title.ilike.${likeQ},state_abbr.ilike.${likeQ},candidate_name.ilike.${likeQ}`).eq("status", "active").order("volume", { ascending: false }).limit(LIMIT)),
      safe(supabase.from("state_legislative_profiles").select("id, district_id, state, state_abbr, chamber, district_number, population, median_income").or(`state.ilike.${likeQ},state_abbr.ilike.${likeQ},district_id.ilike.${likeQ}`).limit(LIMIT)),
      safe(supabase.from("mit_election_results").select("id, candidate, state, state_po, office, year, party, candidatevotes, totalvotes, district").or(`candidate.ilike.${likeQ},state.ilike.${likeQ},state_po.ilike.${likeQ}`).order("year", { ascending: false }).limit(LIMIT)),
      safe(supabase.from("tracked_bills").select("id, bill_number, title, state, status_desc, last_action, last_action_date").or(`title.ilike.${likeQ},bill_number.ilike.${likeQ},state.ilike.${likeQ}`).order("last_action_date", { ascending: false }).limit(LIMIT)),
      safe(supabase.from("messaging_guidance").select("id, title, slug, source, author, published_date, summary, issue_areas").or(`title.ilike.${likeQ},summary.ilike.${likeQ},author.ilike.${likeQ}`).order("published_date", { ascending: false }).limit(LIMIT)),
      safe(supabase.from("intel_briefings").select("id, title, summary, scope, category, source_name, published_at").or(`title.ilike.${likeQ},summary.ilike.${likeQ},source_name.ilike.${likeQ},category.ilike.${likeQ}`).order("published_at", { ascending: false }).limit(LIMIT)),
      safe(supabase.from("congress_committees").select("id, system_code, name, chamber").or(`name.ilike.${likeQ},system_code.ilike.${likeQ}`).order("name").limit(LIMIT)),
      safe(supabase.from("congress_votes").select("id, vote_id, chamber, vote_date, question, result, bill_id, yea_total, nay_total").or(`description.ilike.${likeQ},question.ilike.${likeQ},bill_id.ilike.${likeQ}`).order("vote_date", { ascending: false }).limit(LIMIT)),
      safe(supabase.from("state_leg_election_results").select("id, candidate_name, state_abbr, chamber, district_number, election_year, party, votes, vote_pct, is_winner").or(`candidate_name.ilike.${likeQ},state_abbr.ilike.${likeQ}`).order("election_year", { ascending: false }).limit(LIMIT)),
      safe(supabase.from("election_forecast_history").select("id, source, state_abbr, district, race_type, old_rating, new_rating, changed_at").or(`state_abbr.ilike.${likeQ},source.ilike.${likeQ}`).eq("cycle", 2026).order("changed_at", { ascending: false }).limit(LIMIT)),
      safe(supabase.from("international_profiles").select("id, country_code, country_name, continent, region, population, gdp_per_capita, government_type, head_of_state, ruling_party, tags").or(`country_name.ilike.${likeQ},country_code.ilike.${likeQ},continent.ilike.${likeQ},region.ilike.${likeQ},head_of_state.ilike.${likeQ},ruling_party.ilike.${likeQ}`).order("country_name").limit(LIMIT)),
      // NEW — public records & investigations
      safe(supabase.from("court_cases").select("id, case_name, case_number, court, judge, status, filed_date, docket_url").or(`case_name.ilike.${likeQ},case_number.ilike.${likeQ},judge.ilike.${likeQ},court.ilike.${likeQ}`).order("filed_date", { ascending: false, nullsFirst: false }).limit(LIMIT)),
      safe(supabase.from("fara_registrants").select("id, registrant_name, country, status, registration_date, registration_number").or(`registrant_name.ilike.${likeQ},country.ilike.${likeQ},registration_number.ilike.${likeQ}`).order("registration_date", { ascending: false, nullsFirst: false }).limit(LIMIT)),
      safe(supabase.from("federal_spending").select("id, recipient_name, recipient_state, awarding_agency, description, award_amount, fiscal_year, award_type").or(`recipient_name.ilike.${likeQ},awarding_agency.ilike.${likeQ},description.ilike.${likeQ},recipient_state.ilike.${likeQ}`).order("award_amount", { ascending: false, nullsFirst: false }).limit(LIMIT)),
      safe(supabase.from("lobbying_disclosures").select("id, registrant_name, client_name, filing_year, amount, filing_period").or(`registrant_name.ilike.${likeQ},client_name.ilike.${likeQ}`).order("filing_year", { ascending: false }).limit(LIMIT)),
      safe(supabase.from("gov_contracts").select("id, recipient_name, awarding_agency, description, award_amount, recipient_state, fiscal_year").or(`recipient_name.ilike.${likeQ},awarding_agency.ilike.${likeQ},description.ilike.${likeQ}`).order("award_amount", { ascending: false, nullsFirst: false }).limit(LIMIT)),
      safe(supabase.from("ig_reports").select("id, title, agency_name, summary, topic, published_on, url").or(`title.ilike.${likeQ},agency_name.ilike.${likeQ},summary.ilike.${likeQ},topic.ilike.${likeQ}`).order("published_on", { ascending: false, nullsFirst: false }).limit(LIMIT)),
      safe(supabase.from("congressional_record").select("id, speaker_name, title, chamber, date, category").or(`speaker_name.ilike.${likeQ},title.ilike.${likeQ},content.ilike.${likeQ}`).order("date", { ascending: false }).limit(LIMIT)),
      safe(supabase.from("district_profiles").select("id, district_id, state, population, median_income, median_age").or(`district_id.ilike.${likeQ},state.ilike.${likeQ}`).limit(LIMIT)),
      safe(supabase.from("election_night_streams").select("id, candidate_name, state_abbr, district, party, votes, vote_pct, precincts_reporting_pct, is_called, race_type, election_date").or(`candidate_name.ilike.${likeQ},state_abbr.ilike.${likeQ}`).order("election_date", { ascending: false }).limit(LIMIT)),
      safe(supabase.from("state_legislators").select("id, name, state_abbr, chamber, district, party, email").or(`name.ilike.${likeQ},state_abbr.ilike.${likeQ},party.ilike.${likeQ}`).limit(LIMIT)),
      safe(supabase.from("state_legislative_bills").select("id, identifier, title, state_abbr, sponsor_name, status, latest_action_date").or(`title.ilike.${likeQ},identifier.ilike.${likeQ},sponsor_name.ilike.${likeQ},state_abbr.ilike.${likeQ}`).order("latest_action_date", { ascending: false, nullsFirst: false }).limit(LIMIT)),
      safe(supabase.from("polling_aggregates").select("id, race_type, state_abbr, district, candidate_a, candidate_b, margin, candidate_a_pct, candidate_b_pct, last_poll_date").or(`candidate_a.ilike.${likeQ},candidate_b.ilike.${likeQ},state_abbr.ilike.${likeQ}`).order("last_poll_date", { ascending: false, nullsFirst: false }).limit(LIMIT)),
      // International extras
      safe(supabase.from("international_elections").select("id, country_code, election_year, election_type, winner_name, winner_party, election_date, turnout_pct").or(`country_code.ilike.${likeQ},winner_name.ilike.${likeQ},winner_party.ilike.${likeQ},election_type.ilike.${likeQ}`).order("election_date", { ascending: false, nullsFirst: false }).limit(LIMIT)),
      safe(supabase.from("international_leaders").select("id, country_code, name, title, party, in_office_since, term_ends").or(`name.ilike.${likeQ},country_code.ilike.${likeQ},party.ilike.${likeQ},title.ilike.${likeQ}`).limit(LIMIT)),
      safe(supabase.from("international_legislation").select("id, country_code, title, bill_number, status, sponsor, introduced_date, policy_area").or(`title.ilike.${likeQ},bill_number.ilike.${likeQ},sponsor.ilike.${likeQ},country_code.ilike.${likeQ},policy_area.ilike.${likeQ}`).order("introduced_date", { ascending: false, nullsFirst: false }).limit(LIMIT)),
      safe(supabase.from("international_polling").select("id, country_code, poll_topic, question, source, date_conducted, approve_pct, key_finding").or(`poll_topic.ilike.${likeQ},question.ilike.${likeQ},country_code.ilike.${likeQ},source.ilike.${likeQ}`).order("date_conducted", { ascending: false, nullsFirst: false }).limit(LIMIT)),
      // Knowledge & collab (RLS handles owner/shared scope automatically)
      safe(supabase.from("wiki_pages").select("id, slug, title").eq("published", true).or(`title.ilike.${likeQ},content.ilike.${likeQ}`).limit(LIMIT)),
      safe(supabase.from("war_rooms").select("id, name, description, race_scope, updated_at").or(`name.ilike.${likeQ},description.ilike.${likeQ}`).order("updated_at", { ascending: false }).limit(LIMIT)),
      safe(supabase.from("stakeholders").select("id, name, type, organization, title, email, state_abbr, party").or(`name.ilike.${likeQ},organization.ilike.${likeQ},email.ilike.${likeQ},title.ilike.${likeQ}`).limit(LIMIT)),
      safe(supabase.from("entity_notes").select("id, entity_type, entity_id, body, is_shared, created_at").ilike("body", likeQ).order("created_at", { ascending: false }).limit(LIMIT)),
      safe(supabase.from("reports").select("id, title, description, is_public, updated_at").or(`title.ilike.${likeQ},description.ilike.${likeQ}`).order("updated_at", { ascending: false }).limit(LIMIT)),
      safe(supabase.from("oppo_trackers").select("id, name, description, scope, scope_ref, updated_at").or(`name.ilike.${likeQ},description.ilike.${likeQ}`).order("updated_at", { ascending: false }).limit(LIMIT)),
      safe(supabase.from("watchlist_items").select("id, entity_type, entity_id, label, notes, created_at").or(`label.ilike.${likeQ},notes.ilike.${likeQ},entity_id.ilike.${likeQ}`).order("created_at", { ascending: false }).limit(LIMIT)),
      // AI cache
      safe(supabase.from("vulnerability_scores").select("id, candidate_slug, overall_score, summary, generated_at").or(`candidate_slug.ilike.${likeQ},summary.ilike.${likeQ}`).order("generated_at", { ascending: false }).limit(LIMIT)),
      safe(supabase.from("talking_points").select("id, subject_type, subject_ref, audience, angle, generated_by, created_at").or(`subject_ref.ilike.${likeQ},audience.ilike.${likeQ},angle.ilike.${likeQ},subject_type.ilike.${likeQ}`).order("created_at", { ascending: false }).limit(LIMIT)),
      safe(supabase.from("bill_impact_analyses").select("id, bill_id, scope, scope_ref, summary, generated_at").or(`bill_id.ilike.${likeQ},summary.ilike.${likeQ},scope_ref.ilike.${likeQ}`).order("generated_at", { ascending: false }).limit(LIMIT)),
      safe(supabase.from("subject_impact_analyses").select("id, subject_type, subject_ref, scope, scope_ref, summary, generated_at").or(`subject_ref.ilike.${likeQ},summary.ilike.${likeQ},subject_type.ilike.${likeQ}`).order("generated_at", { ascending: false }).limit(LIMIT)),
      safe(supabase.from("messaging_audience_analyses").select("id, messaging_slug, effectiveness_score, summary, generated_at").or(`messaging_slug.ilike.${likeQ},summary.ilike.${likeQ}`).order("generated_at", { ascending: false }).limit(LIMIT)),
      safe(supabase.from("messaging_impact_analyses").select("id, messaging_slug, scope, scope_ref, summary, generated_at").or(`messaging_slug.ilike.${likeQ},summary.ilike.${likeQ},scope_ref.ilike.${likeQ}`).order("generated_at", { ascending: false }).limit(LIMIT)),
    ]);

    setDbResults({
      polling, finance, members, bills, forecasts, congressElections,
      stateFinance, mnFinance, winredDonations, voterStats, predictionMarkets,
      stateLeg, mitElections, trackedBills, messagingGuidance, intelBriefings,
      congressCommittees, congressVotes, stateLegElections, forecastHistory,
      internationalProfiles,
      courtCases, faraRegistrants, federalSpending, lobbyingDisclosures,
      govContracts, igReports, congressionalRecord, districtProfiles,
      electionNightStreams, stateLegislators, stateLegBills, pollingAggregates,
      internationalElections, internationalLeaders, internationalLegislation,
      internationalPolling, wikiPages, warRooms, stakeholders, entityNotes,
      reports, oppoTrackers, watchlistItems,
      vulnerabilityScores, talkingPoints, billImpactAnalyses,
      subjectImpactAnalyses, messagingAudienceAnalyses, messagingImpactAnalyses,
    });
    setIsSearching(false);

    // Track recent search
    setRecentSearches(prev => {
      const updated = [q, ...prev.filter(s => s !== q)].slice(0, MAX_RECENT);
      saveToStorage(RECENT_KEY, updated);
      return updated;
    });
  }, [query]);

  // Auto-trigger DB search with debounce for speed
  useEffect(() => {
    if (query.trim().length < 2) return;
    const timer = setTimeout(() => {
      runDbSearch();
    }, 400);
    return () => clearTimeout(timer);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleBookmark = useCallback(() => {
    const q = query.trim();
    if (!q) return;
    setSavedSearches(prev => {
      const updated = prev.includes(q)
        ? prev.filter(s => s !== q)
        : [q, ...prev].slice(0, MAX_SAVED);
      saveToStorage(STORAGE_KEY, updated);
      return updated;
    });
  }, [query]);

  const removeSaved = useCallback((s: string) => {
    setSavedSearches(prev => {
      const updated = prev.filter(x => x !== s);
      saveToStorage(STORAGE_KEY, updated);
      return updated;
    });
  }, []);

  const removeRecent = useCallback((s: string) => {
    setRecentSearches(prev => {
      const updated = prev.filter(x => x !== s);
      saveToStorage(RECENT_KEY, updated);
      return updated;
    });
  }, []);

  const loadSearch = useCallback((s: string) => {
    setQuery(s);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") runDbSearch();
    if (e.key === "Escape") {
      if (query.trim()) {
        setQuery("");
        setDbResults(EMPTY_DB as any);
        setHasSearched(false);
      }
      inputRef.current?.blur();
    }
  }, [runDbSearch, query]);

  // Build DB result groups
  const dbGroups = useMemo<SearchResultGroup[]>(() => {
    const groups: SearchResultGroup[] = [];

    if (dbResults.members.length > 0) {
      groups.push({
        key: "congress-members",
        label: "Congress Members",
        icon: <Landmark className="h-3.5 w-3.5" />,
        section: "candidates",
        results: dbResults.members.map((m: any) => ({
          id: m.id,
          title: m.name,
          subtitle: `${m.party || ""} • ${m.state || ""}-${m.district || "AL"} • ${m.chamber}`,
          slug: m.candidate_slug || undefined,
        })),
      });
    }

    if (dbResults.finance.length > 0) {
      groups.push({
        key: "campaign-finance",
        label: "Campaign Finance (Federal)",
        icon: <DollarSign className="h-3.5 w-3.5" />,
        section: "campaign-finance",
        results: dbResults.finance.map((f: any) => ({
          id: f.id,
          title: f.candidate_name === "Unknown" ? `${f.district || f.state_abbr}` : f.candidate_name,
          subtitle: `${f.party || ""} • ${f.state_abbr} • ${f.office} • $${(f.total_raised || 0).toLocaleString()} raised • $${(f.cash_on_hand || 0).toLocaleString()} COH`,
        })),
      });
    }

    if (dbResults.stateFinance.length > 0) {
      groups.push({
        key: "state-finance",
        label: "State Campaign Finance",
        icon: <DollarSign className="h-3.5 w-3.5" />,
        section: "campaign-finance",
        results: dbResults.stateFinance.map((f: any) => ({
          id: f.id,
          title: f.candidate_name,
          subtitle: `${f.party || ""} • ${f.state_abbr} • ${f.office || f.chamber} • $${(f.total_contributions || 0).toLocaleString()} raised • $${(f.net_cash || 0).toLocaleString()} net`,
        })),
      });
    }

    if (dbResults.mnFinance.length > 0) {
      groups.push({
        key: "mn-finance",
        label: "MN CFB Finance",
        icon: <DollarSign className="h-3.5 w-3.5" />,
        section: "campaign-finance",
        results: dbResults.mnFinance.map((f: any) => ({
          id: f.id,
          title: f.candidate_name,
          subtitle: `${f.chamber} • ${f.committee_name} • $${(f.total_contributions || 0).toLocaleString()} raised`,
        })),
      });
    }

    if (dbResults.winredDonations.length > 0) {
      groups.push({
        key: "winred-donations",
        label: "WinRed Donations",
        icon: <Receipt className="h-3.5 w-3.5" />,
        section: "voter-data",
        results: dbResults.winredDonations.map((d: any) => ({
          id: d.id,
          title: `${d.donor_first_name || ""} ${d.donor_last_name || ""}`.trim() || "Anonymous",
          subtitle: `$${(d.amount || 0).toLocaleString()} → ${d.candidate_name || d.committee_name || "Unknown"} • ${d.donor_city || ""}, ${d.donor_state || ""} • ${d.transaction_date || ""}${d.recurring ? " • Recurring" : ""}`,
        })),
      });
    }

    if (dbResults.bills.length > 0) {
      groups.push({
        key: "legislation",
        label: "Legislation",
        icon: <Scale className="h-3.5 w-3.5" />,
        section: "leghub",
        results: dbResults.bills.map((b: any) => ({
          id: b.id,
          title: b.short_title || b.title,
          subtitle: `${b.bill_id} • ${b.sponsor_name || "Unknown sponsor"} • ${b.status || ""}`,
        })),
      });
    }

    if (dbResults.polling.length > 0) {
      groups.push({
        key: "polling",
        label: "Polling Data",
        icon: <BarChart3 className="h-3.5 w-3.5" />,
        section: "polling",
        results: dbResults.polling.map((p: any) => ({
          id: p.id,
          title: p.candidate_or_topic,
          subtitle: `${p.source} • ${p.poll_type} • ${p.date_conducted}${p.approve_pct ? ` • ${p.approve_pct}% approve` : ""}`,
        })),
      });
    }

    if (dbResults.forecasts.length > 0) {
      groups.push({
        key: "forecasts",
        label: "Election Forecasts",
        icon: <BarChart3 className="h-3.5 w-3.5" />,
        section: "district-intel",
        results: dbResults.forecasts.map((f: any) => ({
          id: f.id,
          title: `${f.state_abbr}-${(f.district || "AL").padStart(2, "0")}`,
          subtitle: `${f.source} • ${f.rating} • ${f.race_type}`,
          slug: `${f.state_abbr}-${(f.district || "AL").padStart(2, "0")}`,
        })),
      });
    }

    if (dbResults.congressElections.length > 0) {
      groups.push({
        key: "election-results",
        label: "Election Results",
        icon: <Landmark className="h-3.5 w-3.5" />,
        section: "live-elections",
        results: dbResults.congressElections.map((e: any) => ({
          id: e.id,
          title: e.candidate_name,
          subtitle: `${e.state_abbr}-${e.district_number} • ${e.party || ""} • ${e.election_year}${e.is_winner ? " ✓ Winner" : ""} • ${e.vote_pct ? `${e.vote_pct}%` : ""}`,
        })),
      });
    }

    if (dbResults.voterStats.length > 0) {
      groups.push({
        key: "voter-stats",
        label: "Voter Registration Stats",
        icon: <Users className="h-3.5 w-3.5" />,
        section: "voter-data",
        results: dbResults.voterStats.map((s: any) => ({
          id: s.state,
          title: s.state,
          subtitle: `${(s.total_registered || 0).toLocaleString()} registered • ${(s.total_eligible || 0).toLocaleString()} eligible • ${s.registration_rate ? `${s.registration_rate.toFixed(1)}%` : "N/A"} rate${s.turnout_general_2024 ? ` • ${s.turnout_general_2024}% turnout '24` : ""}`,
        })),
      });
    }

    if (dbResults.predictionMarkets.length > 0) {
      groups.push({
        key: "prediction-markets",
        label: "Prediction Markets",
        icon: <TrendingUp className="h-3.5 w-3.5" />,
        section: "polling",
        results: dbResults.predictionMarkets.map((m: any) => ({
          id: m.id,
          title: m.title,
          subtitle: `${m.source} • Yes: ${m.yes_price != null ? `${(m.yes_price * 100).toFixed(0)}¢` : "N/A"} • Vol: $${(m.volume || 0).toLocaleString()}${m.state_abbr ? ` • ${m.state_abbr}` : ""}`,
        })),
      });
    }

    if (dbResults.stateLeg.length > 0) {
      groups.push({
        key: "state-legislative",
        label: "State Legislative Districts",
        icon: <Building2 className="h-3.5 w-3.5" />,
        section: "leghub",
        results: dbResults.stateLeg.map((d: any) => ({
          id: d.id,
          title: d.district_id,
          subtitle: `${d.state || d.state_abbr} • ${d.chamber} • Pop: ${(d.population || 0).toLocaleString()} • Income: $${(d.median_income || 0).toLocaleString()}`,
          slug: d.district_id,
        })),
      });
    }

    if (dbResults.mitElections.length > 0) {
      groups.push({
        key: "mit-elections",
        label: "MIT Election History",
        icon: <History className="h-3.5 w-3.5" />,
        section: "live-elections",
        results: dbResults.mitElections.map((e: any) => ({
          id: e.id,
          title: e.candidate,
          subtitle: `${e.state_po} • ${e.office} • ${e.year} • ${e.party || ""} • ${(e.candidatevotes || 0).toLocaleString()} votes`,
        })),
      });
    }

    if (dbResults.trackedBills.length > 0) {
      groups.push({
        key: "tracked-bills",
        label: "Tracked Bills (LegHub)",
        icon: <Scale className="h-3.5 w-3.5" />,
        section: "leghub",
        results: dbResults.trackedBills.map((b: any) => ({
          id: b.id,
          title: `${b.bill_number} — ${b.title}`,
          subtitle: `${b.state} • ${b.status_desc || ""} • ${b.last_action_date || ""}`,
        })),
      });
    }

    if (dbResults.messagingGuidance.length > 0) {
      groups.push({
        key: "messaging-guidance",
        label: "📢 Messaging Guidance",
        icon: <FileText className="h-3.5 w-3.5" />,
        section: "messaging",
        results: dbResults.messagingGuidance.map((g: any) => ({
          id: g.id,
          title: g.title,
          subtitle: `${g.source || "Navigator Research"} • ${g.author || ""} • ${g.published_date || ""}${g.issue_areas?.length ? ` • ${g.issue_areas.join(", ")}` : ""}`,
          slug: g.slug,
        })),
      });
    }

    if (dbResults.intelBriefings.length > 0) {
      groups.push({
        key: "intel-briefings",
        label: "Intel Briefings",
        icon: <Newspaper className="h-3.5 w-3.5" />,
        section: "intelhub",
        results: dbResults.intelBriefings.map((b: any) => ({
          id: b.id,
          title: b.title,
          subtitle: `${b.source_name} • ${b.scope} • ${b.category} • ${b.published_at ? new Date(b.published_at).toLocaleDateString() : ""}`,
        })),
      });
    }

    if (dbResults.congressCommittees.length > 0) {
      groups.push({
        key: "congress-committees",
        label: "Congress Committees",
        icon: <Building2 className="h-3.5 w-3.5" />,
        section: "leghub",
        results: dbResults.congressCommittees.map((c: any) => ({
          id: c.id,
          title: c.name,
          subtitle: `${c.chamber} • ${c.system_code}`,
        })),
      });
    }

    if (dbResults.congressVotes.length > 0) {
      groups.push({
        key: "congress-votes",
        label: "Congress Votes",
        icon: <Gavel className="h-3.5 w-3.5" />,
        section: "leghub",
        results: dbResults.congressVotes.map((v: any) => ({
          id: v.id,
          title: v.question || v.bill_id || v.vote_id,
          subtitle: `${v.chamber} • ${v.vote_date || ""} • ${v.result || ""} • Yea: ${v.yea_total || 0} Nay: ${v.nay_total || 0}`,
        })),
      });
    }

    if (dbResults.stateLegElections.length > 0) {
      groups.push({
        key: "state-leg-elections",
        label: "State Leg Elections",
        icon: <Vote className="h-3.5 w-3.5" />,
        section: "leghub",
        results: dbResults.stateLegElections.map((e: any) => ({
          id: e.id,
          title: e.candidate_name,
          subtitle: `${e.state_abbr} ${e.chamber}-${e.district_number} • ${e.party || ""} • ${e.election_year}${e.is_winner ? " ✓" : ""} • ${e.vote_pct ? `${e.vote_pct}%` : ""}`,
        })),
      });
    }

    if (dbResults.forecastHistory.length > 0) {
      groups.push({
        key: "forecast-history",
        label: "Forecast Rating Changes",
        icon: <ArrowLeftRight className="h-3.5 w-3.5" />,
        section: "district-intel",
        results: dbResults.forecastHistory.map((f: any) => ({
          id: f.id,
          title: `${f.state_abbr}-${f.district || "AL"} (${f.source})`,
          subtitle: `${f.old_rating || "New"} → ${f.new_rating} • ${f.race_type} • ${f.changed_at ? new Date(f.changed_at).toLocaleDateString() : ""}`,
        })),
      });
    }

    if (dbResults.internationalProfiles.length > 0) {
      groups.push({
        key: "international-profiles",
        label: "🌐 International Profiles",
        icon: <Globe className="h-3.5 w-3.5" />,
        section: "internationalhub",
        results: dbResults.internationalProfiles.map((p: any) => ({
          id: p.id,
          title: p.country_name,
          subtitle: `${p.continent} • ${p.region || ""} • ${p.government_type || ""} • ${p.head_of_state ? `Leader: ${p.head_of_state}` : ""}${p.tags?.length ? ` • Tags: ${p.tags.join(", ")}` : ""}`,
          slug: p.country_code,
        })),
      });
    }

    // ─── NEW: public records ──────────────────────────────────────────────
    if (dbResults.courtCases.length > 0) groups.push({ key: "court-cases", label: "Court Cases", icon: <Gavel className="h-3.5 w-3.5" />, section: "research-tools", results: dbResults.courtCases.map((c: any) => ({ id: c.id, title: c.case_name, subtitle: `${c.court || ""} • ${c.case_number || ""} • ${c.judge || ""} • ${c.status || ""}` })) });
    if (dbResults.faraRegistrants.length > 0) groups.push({ key: "fara", label: "FARA Registrants", icon: <Flag className="h-3.5 w-3.5" />, section: "research-tools", results: dbResults.faraRegistrants.map((f: any) => ({ id: f.id, title: f.registrant_name, subtitle: `${f.country || ""} • ${f.status || ""} • Reg #${f.registration_number}` })) });
    if (dbResults.federalSpending.length > 0) groups.push({ key: "federal-spending", label: "Federal Spending", icon: <DollarSign className="h-3.5 w-3.5" />, section: "research-tools", results: dbResults.federalSpending.map((s: any) => ({ id: s.id, title: s.recipient_name, subtitle: `${s.awarding_agency || ""} • $${(s.award_amount || 0).toLocaleString()} • FY${s.fiscal_year || ""} • ${s.recipient_state || ""}` })) });
    if (dbResults.lobbyingDisclosures.length > 0) groups.push({ key: "lobbying", label: "Lobbying Disclosures", icon: <Handshake className="h-3.5 w-3.5" />, section: "research-tools", results: dbResults.lobbyingDisclosures.map((l: any) => ({ id: l.id, title: `${l.registrant_name} → ${l.client_name}`, subtitle: `${l.filing_year} ${l.filing_period || ""} • $${(l.amount || 0).toLocaleString()}` })) });
    if (dbResults.govContracts.length > 0) groups.push({ key: "gov-contracts", label: "Government Contracts", icon: <Briefcase className="h-3.5 w-3.5" />, section: "research-tools", results: dbResults.govContracts.map((c: any) => ({ id: c.id, title: c.recipient_name, subtitle: `${c.awarding_agency || ""} • $${(c.award_amount || 0).toLocaleString()} • ${c.recipient_state || ""}` })) });
    if (dbResults.igReports.length > 0) groups.push({ key: "ig-reports", label: "IG Reports", icon: <ShieldAlert className="h-3.5 w-3.5" />, section: "research-tools", results: dbResults.igReports.map((r: any) => ({ id: r.id, title: r.title, subtitle: `${r.agency_name || ""} • ${r.topic || ""} • ${r.published_on || ""}` })) });
    if (dbResults.congressionalRecord.length > 0) groups.push({ key: "congressional-record", label: "Congressional Record", icon: <Mic className="h-3.5 w-3.5" />, section: "leghub", results: dbResults.congressionalRecord.map((r: any) => ({ id: r.id, title: r.title || r.speaker_name, subtitle: `${r.speaker_name} • ${r.chamber} • ${r.date} • ${r.category || ""}` })) });
    if (dbResults.districtProfiles.length > 0) groups.push({ key: "district-profiles", label: "District Profiles", icon: <MapPin className="h-3.5 w-3.5" />, section: "district-intel", results: dbResults.districtProfiles.map((d: any) => ({ id: d.id, title: d.district_id, subtitle: `${d.state} • Pop: ${(d.population || 0).toLocaleString()} • Income: $${(d.median_income || 0).toLocaleString()}`, slug: d.district_id })) });
    if (dbResults.electionNightStreams.length > 0) groups.push({ key: "election-streams", label: "Election Night Streams", icon: <Zap className="h-3.5 w-3.5" />, section: "live-elections", results: dbResults.electionNightStreams.map((e: any) => ({ id: e.id, title: e.candidate_name, subtitle: `${e.state_abbr}-${e.district || ""} • ${e.party || ""} • ${(e.votes || 0).toLocaleString()} votes (${e.vote_pct || 0}%) • ${e.precincts_reporting_pct || 0}% reporting${e.is_called ? " ✓ Called" : ""}` })) });
    if (dbResults.stateLegislators.length > 0) groups.push({ key: "state-legislators", label: "State Legislators", icon: <Landmark className="h-3.5 w-3.5" />, section: "leghub", results: dbResults.stateLegislators.map((l: any) => ({ id: l.id, title: l.name, subtitle: `${l.state_abbr} ${l.chamber}-${l.district} • ${l.party || ""}` })) });
    if (dbResults.stateLegBills.length > 0) groups.push({ key: "state-leg-bills", label: "State Legislative Bills", icon: <Scale className="h-3.5 w-3.5" />, section: "leghub", results: dbResults.stateLegBills.map((b: any) => ({ id: b.id, title: `${b.identifier} — ${b.title}`, subtitle: `${b.state_abbr} • ${b.sponsor_name || ""} • ${b.status || ""} • ${b.latest_action_date || ""}` })) });
    if (dbResults.pollingAggregates.length > 0) groups.push({ key: "polling-aggregates", label: "Polling Aggregates", icon: <BarChart3 className="h-3.5 w-3.5" />, section: "polling", results: dbResults.pollingAggregates.map((p: any) => ({ id: p.id, title: `${p.candidate_a} vs ${p.candidate_b}`, subtitle: `${p.state_abbr}${p.district ? `-${p.district}` : ""} • Margin ${p.margin > 0 ? "+" : ""}${p.margin?.toFixed(1) || "?"} • ${p.candidate_a_pct?.toFixed(1) || "?"}% / ${p.candidate_b_pct?.toFixed(1) || "?"}%` })) });
    // International extras
    if (dbResults.internationalElections.length > 0) groups.push({ key: "intl-elections", label: "🌐 International Elections", icon: <Vote className="h-3.5 w-3.5" />, section: "internationalhub", results: dbResults.internationalElections.map((e: any) => ({ id: e.id, title: `${e.country_code} • ${e.election_year} ${e.election_type}`, subtitle: `Winner: ${e.winner_name || "?"} (${e.winner_party || "?"}) • Turnout ${e.turnout_pct || "?"}%`, slug: e.country_code })) });
    if (dbResults.internationalLeaders.length > 0) groups.push({ key: "intl-leaders", label: "🌐 International Leaders", icon: <User className="h-3.5 w-3.5" />, section: "internationalhub", results: dbResults.internationalLeaders.map((l: any) => ({ id: l.id, title: l.name, subtitle: `${l.country_code} • ${l.title} • ${l.party || ""} • Since ${l.in_office_since || "?"}`, slug: l.country_code })) });
    if (dbResults.internationalLegislation.length > 0) groups.push({ key: "intl-legislation", label: "🌐 International Legislation", icon: <Scale className="h-3.5 w-3.5" />, section: "internationalhub", results: dbResults.internationalLegislation.map((b: any) => ({ id: b.id, title: b.title, subtitle: `${b.country_code} • ${b.bill_number || ""} • ${b.sponsor || ""} • ${b.status || ""}`, slug: b.country_code })) });
    if (dbResults.internationalPolling.length > 0) groups.push({ key: "intl-polling", label: "🌐 International Polling", icon: <BarChart3 className="h-3.5 w-3.5" />, section: "internationalhub", results: dbResults.internationalPolling.map((p: any) => ({ id: p.id, title: p.poll_topic, subtitle: `${p.country_code} • ${p.source} • ${p.date_conducted || ""} • ${p.approve_pct ? `${p.approve_pct}% approve` : ""}`, slug: p.country_code })) });
    // Knowledge & collab
    if (dbResults.wikiPages.length > 0) groups.push({ key: "wiki", label: "📖 Wiki Pages", icon: <BookOpen className="h-3.5 w-3.5" />, section: "documentation", results: dbResults.wikiPages.map((p: any) => ({ id: p.id, title: p.title, subtitle: `Wiki • ${p.slug}`, slug: p.slug })) });
    if (dbResults.warRooms.length > 0) groups.push({ key: "war-rooms", label: "⚔️ War Rooms", icon: <Swords className="h-3.5 w-3.5" />, section: "war-rooms", results: dbResults.warRooms.map((w: any) => ({ id: w.id, title: w.name, subtitle: `${w.race_scope || ""} • ${w.description || ""}` })) });
    if (dbResults.stakeholders.length > 0) groups.push({ key: "stakeholders", label: "🤝 Stakeholders (CRM)", icon: <Users className="h-3.5 w-3.5" />, section: "research-tools", results: dbResults.stakeholders.map((s: any) => ({ id: s.id, title: s.name, subtitle: `${s.type || ""} • ${s.organization || ""} • ${s.title || ""} • ${s.state_abbr || ""}` })) });
    if (dbResults.entityNotes.length > 0) groups.push({ key: "entity-notes", label: "📝 Entity Notes", icon: <StickyNote className="h-3.5 w-3.5" />, section: "dashboard", results: dbResults.entityNotes.map((n: any) => ({ id: n.id, title: (n.body || "").slice(0, 80) || "(empty)", subtitle: `${n.entity_type} • ${n.entity_id}${n.is_shared ? " • Shared" : ""}` })) });
    if (dbResults.reports.length > 0) groups.push({ key: "reports", label: "📊 Reports", icon: <ClipboardList className="h-3.5 w-3.5" />, section: "reports", results: dbResults.reports.map((r: any) => ({ id: r.id, title: r.title, subtitle: `${r.description || ""}${r.is_public ? " • Public" : ""}` })) });
    if (dbResults.oppoTrackers.length > 0) groups.push({ key: "oppo-trackers", label: "🎯 Oppo Trackers", icon: <Target className="h-3.5 w-3.5" />, section: "oppohub", results: dbResults.oppoTrackers.map((t: any) => ({ id: t.id, title: t.name, subtitle: `${t.scope || ""} ${t.scope_ref || ""} • ${t.description || ""}` })) });
    if (dbResults.watchlistItems.length > 0) groups.push({ key: "watchlist", label: "👁️ Watchlist", icon: <Eye className="h-3.5 w-3.5" />, section: "dashboard", results: dbResults.watchlistItems.map((w: any) => ({ id: w.id, title: w.label || w.entity_id, subtitle: `${w.entity_type} • ${w.notes || ""}` })) });
    // AI cache
    if (dbResults.vulnerabilityScores.length > 0) groups.push({ key: "vulnerability-scores", label: "🧠 Vulnerability Scores (AI)", icon: <Radar className="h-3.5 w-3.5" />, section: "candidates", results: dbResults.vulnerabilityScores.map((v: any) => ({ id: v.id, title: `${v.candidate_slug} — Score ${v.overall_score}`, subtitle: (v.summary || "").slice(0, 120), slug: v.candidate_slug })) });
    if (dbResults.talkingPoints.length > 0) groups.push({ key: "talking-points", label: "🧠 Talking Points (AI)", icon: <Brain className="h-3.5 w-3.5" />, section: "messaging", results: dbResults.talkingPoints.map((t: any) => ({ id: t.id, title: `${t.subject_type} • ${t.subject_ref}`, subtitle: `${t.audience || "any audience"} • ${t.angle || "any angle"} • ${t.generated_by || ""}` })) });
    if (dbResults.billImpactAnalyses.length > 0) groups.push({ key: "bill-impact", label: "🧠 Bill Impact (AI)", icon: <FileSearch className="h-3.5 w-3.5" />, section: "leghub", results: dbResults.billImpactAnalyses.map((b: any) => ({ id: b.id, title: `${b.bill_id} (${b.scope}${b.scope_ref ? `:${b.scope_ref}` : ""})`, subtitle: (b.summary || "").slice(0, 120) })) });
    if (dbResults.subjectImpactAnalyses.length > 0) groups.push({ key: "subject-impact", label: "🧠 Subject Impact (AI)", icon: <FileSearch className="h-3.5 w-3.5" />, section: "intelhub", results: dbResults.subjectImpactAnalyses.map((s: any) => ({ id: s.id, title: `${s.subject_type} • ${s.subject_ref}`, subtitle: `${s.scope}${s.scope_ref ? `:${s.scope_ref}` : ""} • ${(s.summary || "").slice(0, 100)}` })) });
    if (dbResults.messagingAudienceAnalyses.length > 0) groups.push({ key: "messaging-audience", label: "🧠 Messaging Audience (AI)", icon: <MessageSquare className="h-3.5 w-3.5" />, section: "messaging", results: dbResults.messagingAudienceAnalyses.map((m: any) => ({ id: m.id, title: `${m.messaging_slug} — ${m.effectiveness_score}/100`, subtitle: (m.summary || "").slice(0, 120), slug: m.messaging_slug })) });
    if (dbResults.messagingImpactAnalyses.length > 0) groups.push({ key: "messaging-impact", label: "🧠 Messaging Impact (AI)", icon: <MessageSquare className="h-3.5 w-3.5" />, section: "messaging", results: dbResults.messagingImpactAnalyses.map((m: any) => ({ id: m.id, title: `${m.messaging_slug} (${m.scope}${m.scope_ref ? `:${m.scope_ref}` : ""})`, subtitle: (m.summary || "").slice(0, 120), slug: m.messaging_slug })) });

    return groups;
  }, [dbResults]);

  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());

  const toggleCategory = useCallback((key: string) => {
    setHiddenCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const allGroups = [...localResults, ...dbGroups];
  const filteredGroups = allGroups.filter(g => !hiddenCategories.has(g.key));
  const totalResults = filteredGroups.reduce((s, g) => s + g.results.length, 0);

  const handleClear = () => {
    setQuery("");
    setDbResults(EMPTY_DB as any);
    setHasSearched(false);
  };

  return (
    <div className="win98-raised bg-[hsl(var(--win98-face))] p-3">
      <div className="flex items-center gap-2 mb-3">
        <Search className="h-4 w-4" />
        <h2 className="text-sm font-bold">🔍OppoDB Search</h2>
        <span className="text-[9px] text-[hsl(var(--muted-foreground))]">
          Search across all databases & research tools
        </span>
        <kbd className="ml-auto text-[9px] px-1.5 py-0.5 rounded border border-[hsl(var(--win98-shadow))] bg-[hsl(var(--win98-light))] text-[hsl(var(--muted-foreground))] font-mono">
          Ctrl+K
        </kbd>
      </div>

      <div className="win98-sunken bg-white p-2 mb-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="win98-input w-full pl-7 pr-7"
              ref={inputRef}
              placeholder="Search candidates, districts, bills, finance, polling, markets, state leg, elections..."
              maxLength={500}
            />
            {query && (
              <button
                onClick={handleClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={toggleBookmark}
            disabled={query.trim().length < 2}
            className="win98-button text-[10px] flex items-center gap-1 px-2"
            title={isCurrentQuerySaved ? "Remove bookmark" : "Bookmark this search"}
          >
            {isCurrentQuerySaved
              ? <BookmarkCheck className="h-3.5 w-3.5" style={{ color: "hsl(45, 90%, 45%)" }} />
              : <Bookmark className="h-3.5 w-3.5" />
            }
          </button>
          <button
            onClick={runDbSearch}
            disabled={isSearching || query.trim().length < 2}
            className="win98-button text-[10px] font-bold flex items-center gap-1 px-3"
          >
            {isSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
            Search All
          </button>
        </div>
        <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-1">
          Type to see instant results — database search auto-triggers after 400ms • ⭐ Bookmark to save
        </p>
      </div>

      {/* Saved & Recent Searches (shown when no active query) */}
      {query.trim().length < 2 && (savedSearches.length > 0 || recentSearches.length > 0) && (
        <div className="grid gap-2 sm:grid-cols-2 mb-3">
          {savedSearches.length > 0 && (
            <div className="candidate-card">
              <div className="flex items-center gap-1.5 mb-2 pb-1 border-b border-b-[hsl(var(--win98-shadow))]">
                <BookmarkCheck className="h-3.5 w-3.5" style={{ color: "hsl(45, 90%, 45%)" }} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Saved Searches</span>
                <span className="text-[9px] text-[hsl(var(--muted-foreground))] ml-auto">{savedSearches.length}</span>
              </div>
              <div className="space-y-0.5 max-h-[160px] overflow-y-auto">
                {savedSearches.map((s) => (
                  <div key={s} className="flex items-center gap-1 group">
                    <button
                      onClick={() => loadSearch(s)}
                      className="flex-1 text-left px-1.5 py-1 text-[10px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white rounded-sm transition-colors truncate flex items-center gap-1"
                    >
                      <Bookmark className="h-2.5 w-2.5 shrink-0" style={{ color: "hsl(45, 90%, 45%)" }} />
                      {s}
                    </button>
                    <button
                      onClick={() => removeSaved(s)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(0,60%,50%)] transition-opacity"
                      title="Remove"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentSearches.length > 0 && (
            <div className="candidate-card">
              <div className="flex items-center gap-1.5 mb-2 pb-1 border-b border-b-[hsl(var(--win98-shadow))]">
                <Clock className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Recent Searches</span>
                <span className="text-[9px] text-[hsl(var(--muted-foreground))] ml-auto">{recentSearches.length}</span>
              </div>
              <div className="space-y-0.5 max-h-[160px] overflow-y-auto">
                {recentSearches.map((s) => (
                  <div key={s} className="flex items-center gap-1 group">
                    <button
                      onClick={() => loadSearch(s)}
                      className="flex-1 text-left px-1.5 py-1 text-[10px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white rounded-sm transition-colors truncate flex items-center gap-1"
                    >
                      <Clock className="h-2.5 w-2.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
                      {s}
                    </button>
                    <button
                      onClick={() => removeRecent(s)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(0,60%,50%)] transition-opacity"
                      title="Remove"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {query.trim().length >= 2 && (
        <div className="space-y-2">
          {/* Summary bar */}
          <div className="flex items-center gap-2 text-[10px] flex-wrap">
            <span className="font-bold">{totalResults} results</span>
            {hasSearched && (
              <span className="text-[hsl(var(--muted-foreground))]">
                • {filteredGroups.length}/{allGroups.length} categories
              </span>
            )}
            {isSearching && (
              <span className="text-[hsl(var(--muted-foreground))] flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Searching databases...
              </span>
            )}
            {totalResults > 0 && (
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => exportSearchCSV(query, filteredGroups)}
                  className="win98-button text-[9px] flex items-center gap-1 px-2 py-0.5"
                  title="Export as CSV"
                >
                  <Download className="h-3 w-3" /> CSV
                </button>
                <button
                  onClick={() => exportSearchPDF(query, filteredGroups)}
                  className="win98-button text-[9px] flex items-center gap-1 px-2 py-0.5"
                  title="Export as PDF"
                >
                  <FileDown className="h-3 w-3" /> PDF
                </button>
              </div>
            )}
          </div>

          {/* Category filter chips */}
          {allGroups.length > 1 && (
            <div className="flex items-center gap-1 flex-wrap">
              <Filter className="h-3 w-3 text-[hsl(var(--muted-foreground))] shrink-0" />
              {allGroups.map(g => {
                const isHidden = hiddenCategories.has(g.key);
                return (
                  <button
                    key={g.key}
                    onClick={() => toggleCategory(g.key)}
                    className={`text-[9px] px-1.5 py-0.5 rounded-sm border flex items-center gap-1 transition-colors ${
                      isHidden
                        ? "border-[hsl(var(--win98-shadow))] bg-[hsl(var(--win98-face))] text-[hsl(var(--muted-foreground))] opacity-50"
                        : "border-[hsl(var(--win98-shadow))] bg-white text-[hsl(var(--foreground))] font-medium"
                    }`}
                    title={isHidden ? `Show ${g.label}` : `Hide ${g.label}`}
                  >
                    {g.icon}
                    <span>{g.label}</span>
                    <span className="text-[8px]">({g.results.length})</span>
                  </button>
                );
              })}
              {hiddenCategories.size > 0 && (
                <button
                  onClick={() => setHiddenCategories(new Set())}
                  className="text-[9px] px-1.5 py-0.5 text-[hsl(var(--win98-titlebar))] hover:underline"
                >
                  Show all
                </button>
              )}
            </div>
          )}

          {totalResults === 0 && !isSearching && (
            <div className="win98-sunken bg-white p-4 text-center text-[11px] text-[hsl(var(--muted-foreground))]">
              No results found for "{query}". Try a different search term or press Enter to search databases.
            </div>
          )}

          {/* Result groups */}
          <div className="grid gap-2 sm:grid-cols-2">
            {filteredGroups.map((group) => (
              <div key={group.key} className="candidate-card">
                <div className="flex items-center gap-1.5 mb-2 pb-1 border-b border-b-[hsl(var(--win98-shadow))]">
                  <span className="text-[hsl(var(--muted-foreground))]">{group.icon}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider">{group.label}</span>
                  <span className="text-[9px] text-[hsl(var(--muted-foreground))] ml-auto">{group.results.length}</span>
                </div>
                <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
                  {group.results.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => onNavigate(group.section, r.slug)}
                      className="w-full text-left px-1.5 py-1 text-[10px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white rounded-sm transition-colors flex flex-col"
                    >
                      <span className="font-medium truncate">{r.title}</span>
                      {r.subtitle && (
                        <span className="text-[9px] opacity-70 truncate">{r.subtitle}</span>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => onNavigate(group.section)}
                  className="mt-1.5 text-[9px] text-[hsl(var(--win98-titlebar))] hover:underline"
                >
                  View all in {group.label} →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
