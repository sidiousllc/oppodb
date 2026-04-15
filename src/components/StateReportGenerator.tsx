import { useState, useCallback } from "react";
import { ArrowLeft, Download, Loader2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ALL_STATE_ABBRS, STATE_NAMES } from "@/data/stateLegislativeIntel";
import { exportContentPDF } from "@/lib/contentExport";
import { Win98Window } from "./Win98Window";

interface StateReportGeneratorProps {
  onBack: () => void;
}

interface StateReportData {
  stateName: string;
  stateAbbr: string;
  districts: any[];
  stateLeg: any[];
  congressMembers: any[];
  campaignFinance: any[];
  electionResults: any[];
  forecasts: any[];
  forecastHistory: any[];
  polling: any[];
  intelBriefings: any[];
  localImpacts: any[];
  candidateProfiles: any[];
  predictionMarkets: any[];
  bills: any[];
  stateCfb: any[];
  voterStats: any[];
  mitElections: any[];
  winredDonations: any[];
  stateLegElections: any[];
  trackedBills: any[];
  narrativeReports: any[];
  magaFiles: any[];
  congressVotes: any[];
  messagingGuidance: any[];
}

export function StateReportGenerator({ onBack }: StateReportGeneratorProps) {
  const [selectedState, setSelectedState] = useState("");
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<StateReportData | null>(null);
  const [reportWindow, setReportWindow] = useState(false);

  const generateReport = useCallback(async () => {
    if (!selectedState) return;
    setLoading(true);
    const abbr = selectedState;
    const stateName = STATE_NAMES[abbr] || abbr;

    try {
      const [
        { data: districts },
        { data: stateLeg },
        { data: congressMembers },
        { data: campaignFinance },
        { data: electionResults },
        { data: forecasts },
        { data: forecastHistory },
        { data: polling },
        { data: intelBriefings },
        { data: localImpacts },
        { data: candidateProfiles },
        { data: predictionMarkets },
        { data: bills },
        { data: stateCfb },
        { data: voterStats },
        { data: mitElections },
        { data: winredDonations },
        { data: stateLegElections },
        { data: trackedBills },
        { data: narrativeReports },
        { data: magaFiles },
        { data: congressVotes },
        { data: messagingGuidance },
      ] = await Promise.all([
        supabase.from("district_profiles").select("*").eq("state", stateName),
        supabase.from("state_legislative_profiles").select("*").eq("state_abbr", abbr).limit(1000),
        supabase.from("congress_members").select("*").eq("state", abbr),
        supabase.from("campaign_finance").select("*").eq("state_abbr", abbr),
        supabase.from("congressional_election_results").select("*").eq("state_abbr", abbr).order("election_year", { ascending: false }).limit(500),
        supabase.from("election_forecasts").select("*").eq("state_abbr", abbr),
        supabase.from("election_forecast_history").select("*").eq("state_abbr", abbr).order("changed_at", { ascending: false }).limit(100),
        supabase.from("polling_data").select("*").ilike("candidate_or_topic", `%${stateName}%`).limit(100),
        supabase.from("intel_briefings").select("*").or(`region.ilike.%${stateName}%,region.ilike.%${abbr}%`).limit(50),
        supabase.from("local_impacts").select("*").eq("state", stateName),
        supabase.from("candidate_profiles").select("id,name,slug,tags,content").eq("is_subpage", false).limit(1000),
        supabase.from("prediction_markets").select("*").eq("state_abbr", abbr),
        supabase.from("congress_bills").select("*").limit(500),
        supabase.from("state_cfb_candidates").select("*").eq("state_abbr", abbr),
        supabase.from("state_voter_stats").select("*").ilike("state", `%${stateName}%`),
        supabase.from("mit_election_results").select("*").eq("state_po", abbr).order("year", { ascending: false }).limit(500),
        supabase.from("winred_donations").select("*").eq("donor_state", abbr).order("transaction_date", { ascending: false }).limit(200),
        supabase.from("state_leg_election_results").select("*").eq("state_abbr", abbr).order("election_year", { ascending: false }).limit(500),
        supabase.from("tracked_bills").select("*").eq("state", abbr),
        supabase.from("narrative_reports").select("*"),
        supabase.from("maga_files").select("*"),
        supabase.from("congress_votes").select("vote_id,chamber,congress,vote_date,question,description,result,yea_total,nay_total,not_voting_total,bill_id").order("vote_date", { ascending: false }).limit(200),
        supabase.from("messaging_guidance").select("*").limit(200),
      ]);

      // Filter candidate profiles that mention the state
      const stateKeywords = [stateName.toLowerCase(), abbr.toLowerCase()];
      const filteredCandidates = (candidateProfiles || []).filter((c: any) =>
        c.tags?.some((t: string) => stateKeywords.includes(t.toLowerCase())) ||
        c.name?.toLowerCase().includes(stateName.toLowerCase()) ||
        c.content?.toLowerCase().includes(stateName.toLowerCase())
      );

      // Filter bills sponsored by state members
      const memberNames = (congressMembers || []).map((m: any) => m.name?.toLowerCase()).filter(Boolean);
      const memberBioguides = (congressMembers || []).map((m: any) => m.bioguide_id).filter(Boolean);
      const filteredBills = (bills || []).filter((b: any) => {
        const sponsorName = b.sponsor_name?.toLowerCase() || "";
        const sponsorBio = b.sponsor_bioguide_id || "";
        return memberNames.some((n: string) => sponsorName.includes(n.split(",")[0]?.trim() || n)) ||
               memberBioguides.includes(sponsorBio);
      });

      // Filter narratives/maga mentioning state
      const filteredNarratives = (narrativeReports || []).filter((n: any) =>
        n.content?.toLowerCase().includes(stateName.toLowerCase()) ||
        n.tags?.some((t: string) => stateKeywords.includes(t.toLowerCase()))
      );
      const filteredMaga = (magaFiles || []).filter((m: any) =>
        m.content?.toLowerCase().includes(stateName.toLowerCase()) ||
        m.tags?.some((t: string) => stateKeywords.includes(t.toLowerCase()))
      );

      // Filter congress votes by delegation members
      const filteredVotes = (congressVotes || []).filter((v: any) => {
        if (v.bill_id && filteredBills.some((b: any) => b.bill_id === v.bill_id)) return true;
        return false;
      });

      // Filter messaging relevant to state
      const filteredMessaging = (messagingGuidance || []).filter((m: any) =>
        m.content?.toLowerCase().includes(stateName.toLowerCase()) ||
        m.issue_areas?.some((i: string) => stateKeywords.includes(i.toLowerCase()))
      );

      setReportData({
        stateName,
        stateAbbr: abbr,
        districts: districts || [],
        stateLeg: stateLeg || [],
        congressMembers: congressMembers || [],
        campaignFinance: campaignFinance || [],
        electionResults: electionResults || [],
        forecasts: forecasts || [],
        forecastHistory: forecastHistory || [],
        polling: polling || [],
        intelBriefings: intelBriefings || [],
        localImpacts: localImpacts || [],
        candidateProfiles: filteredCandidates,
        predictionMarkets: predictionMarkets || [],
        bills: filteredBills,
        stateCfb: stateCfb || [],
        voterStats: voterStats || [],
        mitElections: mitElections || [],
        winredDonations: winredDonations || [],
        stateLegElections: stateLegElections || [],
        trackedBills: trackedBills || [],
        narrativeReports: filteredNarratives,
        magaFiles: filteredMaga,
        congressVotes: filteredVotes,
        messagingGuidance: filteredMessaging,
      });
      setReportWindow(true);
    } catch (err) {
      console.error("Report generation error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedState]);

  const buildMarkdownReport = useCallback((data: StateReportData): string => {
    const lines: string[] = [];
    const fmt = (n: number | null | undefined) => n != null ? n.toLocaleString() : "N/A";
    const pct = (n: number | null | undefined) => n != null ? `${Number(n).toFixed(1)}%` : "N/A";
    const money = (n: number | null | undefined) => n != null ? `$${Number(n).toLocaleString()}` : "N/A";

    lines.push(`# Comprehensive State Intelligence Report: ${data.stateName} (${data.stateAbbr})`);
    lines.push(`Generated ${new Date().toLocaleDateString()} | Confidential Research Document`);
    lines.push("");

    // ===== EXECUTIVE SUMMARY =====
    lines.push("## Executive Summary");
    lines.push(`This report provides a comprehensive intelligence overview of **${data.stateName}** across ${countDataSources(data)} data categories.`);
    lines.push(`- **Congressional Districts:** ${data.districts.length}`);
    lines.push(`- **State Legislative Districts:** ${data.stateLeg.length}`);
    lines.push(`- **Congressional Delegation:** ${data.congressMembers.length} members`);
    lines.push(`- **Campaign Finance Records:** ${data.campaignFinance.length} federal + ${data.stateCfb.length} state`);
    lines.push(`- **Election History Records:** ${data.electionResults.length} congressional + ${data.mitElections.length} MIT Lab`);
    lines.push(`- **Active Forecasts:** ${data.forecasts.length} with ${data.forecastHistory.length} rating changes`);
    lines.push(`- **Polling Data Points:** ${data.polling.length}`);
    lines.push(`- **Prediction Market Contracts:** ${data.predictionMarkets.length}`);
    lines.push(`- **Opposition Research Profiles:** ${data.candidateProfiles.length}`);
    lines.push(`- **Related Legislation:** ${data.bills.length} federal + ${data.trackedBills.length} tracked`);
    lines.push(`- **Intelligence Briefings:** ${data.intelBriefings.length}`);
    lines.push(`- **WinRed Donation Records:** ${data.winredDonations.length}`);
    lines.push("");

    // ===== VOTER REGISTRATION & TURNOUT =====
    lines.push("## Voter Registration & Turnout");
    if (data.voterStats.length === 0) {
      lines.push("No voter registration statistics available.");
    } else {
      for (const vs of data.voterStats) {
        lines.push(`- **Total Registered Voters:** ${fmt(vs.total_registered)}`);
        lines.push(`- **Total Eligible Voters:** ${fmt(vs.total_eligible)}`);
        lines.push(`- **Registration Rate:** ${pct(vs.registration_rate)}`);
        lines.push(`- **General 2024 Turnout:** ${vs.turnout_general_2024 != null ? pct(vs.turnout_general_2024) : "N/A"}`);
        if (vs.source) lines.push(`- **Source:** ${vs.source}`);
      }
    }
    lines.push("");

    // ===== CONGRESSIONAL DELEGATION =====
    lines.push("## Congressional Delegation");
    if (data.congressMembers.length === 0) {
      lines.push("No congressional delegation data available.");
    } else {
      const senators = data.congressMembers.filter((m: any) => m.chamber === "senate");
      const reps = data.congressMembers.filter((m: any) => m.chamber === "house");
      const partyBreakdown = data.congressMembers.reduce((acc: Record<string, number>, m: any) => {
        const p = m.party || "Unknown";
        acc[p] = (acc[p] || 0) + 1;
        return acc;
      }, {});

      lines.push("### Party Breakdown");
      for (const [party, count] of Object.entries(partyBreakdown)) {
        lines.push(`- **${party}:** ${count}`);
      }
      lines.push("");

      if (senators.length > 0) {
        lines.push("### U.S. Senators");
        for (const m of senators) {
          lines.push(`- **${m.name}** (${m.party || "N/A"})`);
          if (m.official_url) lines.push(`  - Website: ${m.official_url}`);
          if (m.leadership?.length) lines.push(`  - Leadership: ${JSON.stringify(m.leadership)}`);
          if (m.terms?.length) {
            const latestTerm = m.terms[m.terms.length - 1];
            if (latestTerm) lines.push(`  - Current Term: ${latestTerm.startYear || "?"} – ${latestTerm.endYear || "?"}`);
          }
        }
        lines.push("");
      }

      if (reps.length > 0) {
        lines.push("### U.S. Representatives");
        for (const m of reps) {
          lines.push(`- **${m.name}** (${m.party || "N/A"}) — District ${m.district || "At-Large"}`);
          if (m.official_url) lines.push(`  - Website: ${m.official_url}`);
        }
        lines.push("");
      }
    }

    // ===== CONGRESSIONAL DISTRICTS - DETAILED =====
    lines.push("## Congressional District Profiles");
    if (data.districts.length === 0) {
      lines.push("No congressional district data available.");
    } else {
      // State-wide averages
      const avgPop = avg(data.districts, "population");
      const avgIncome = avg(data.districts, "median_income");
      const avgAge = avg(data.districts, "median_age");
      const avgPoverty = avg(data.districts, "poverty_rate");
      const avgUnemploy = avg(data.districts, "unemployment_rate");
      const avgEduc = avg(data.districts, "education_bachelor_pct");

      lines.push("### Statewide District Averages");
      lines.push(`- **Avg Population:** ${fmt(Math.round(avgPop))}`);
      lines.push(`- **Avg Median Income:** ${money(Math.round(avgIncome))}`);
      lines.push(`- **Avg Median Age:** ${avgAge.toFixed(1)}`);
      lines.push(`- **Avg Poverty Rate:** ${avgPoverty.toFixed(1)}%`);
      lines.push(`- **Avg Unemployment:** ${avgUnemploy.toFixed(1)}%`);
      lines.push(`- **Avg Bachelor's Degree+:** ${avgEduc.toFixed(1)}%`);
      lines.push("");

      for (const d of data.districts) {
        lines.push(`### ${d.district_id}`);
        lines.push("#### Demographics");
        lines.push(`- **Population:** ${fmt(d.population)}`);
        lines.push(`- **Median Age:** ${d.median_age ?? "N/A"}`);
        lines.push(`- **Total Households:** ${fmt(d.total_households)}`);
        lines.push(`- **Avg Household Size:** ${d.avg_household_size ?? "N/A"}`);
        lines.push("");
        lines.push("#### Economics");
        lines.push(`- **Median Income:** ${money(d.median_income)}`);
        lines.push(`- **Poverty Rate:** ${pct(d.poverty_rate)}`);
        lines.push(`- **Unemployment:** ${pct(d.unemployment_rate)}`);
        lines.push(`- **Median Home Value:** ${money(d.median_home_value)}`);
        lines.push(`- **Median Rent:** ${money(d.median_rent)}`);
        lines.push(`- **Owner-Occupied:** ${pct(d.owner_occupied_pct)}`);
        lines.push("");
        lines.push("#### Education & Social");
        lines.push(`- **Bachelor's Degree+:** ${pct(d.education_bachelor_pct)}`);
        lines.push(`- **Veteran Population:** ${pct(d.veteran_pct)}`);
        lines.push(`- **Foreign-Born:** ${pct(d.foreign_born_pct)}`);
        lines.push(`- **Uninsured:** ${pct(d.uninsured_pct)}`);
        lines.push("");
        lines.push("#### Racial/Ethnic Composition");
        lines.push(`- **White:** ${pct(d.white_pct)}`);
        lines.push(`- **Black:** ${pct(d.black_pct)}`);
        lines.push(`- **Hispanic:** ${pct(d.hispanic_pct)}`);
        lines.push(`- **Asian:** ${pct(d.asian_pct)}`);
        if (d.top_issues?.length) lines.push(`- **Top Issues:** ${d.top_issues.join(", ")}`);
        if (d.voting_patterns && Object.keys(d.voting_patterns).length > 0) {
          lines.push("#### Voting Patterns");
          for (const [key, val] of Object.entries(d.voting_patterns)) {
            lines.push(`- ${key}: ${JSON.stringify(val)}`);
          }
        }
        lines.push("");
      }
    }
    lines.push("");

    // ===== ELECTION FORECASTS =====
    lines.push("## Election Forecasts & Ratings");
    if (data.forecasts.length === 0) {
      lines.push("No forecast data available.");
    } else {
      // Group by race type
      const byType = groupBy(data.forecasts, "race_type");
      for (const [raceType, races] of Object.entries(byType)) {
        lines.push(`### ${raceType.charAt(0).toUpperCase() + raceType.slice(1)} Races`);
        for (const f of races) {
          const label = f.district ? `District ${f.district}` : "Statewide";
          lines.push(`#### ${label} (${f.source})`);
          lines.push(`- **Rating:** ${f.rating || "N/A"}`);
          lines.push(`- **Margin:** ${f.margin != null ? `${f.margin > 0 ? "D+" : "R+"}${Math.abs(f.margin).toFixed(1)}` : "N/A"}`);
          lines.push(`- **Dem Win Probability:** ${f.dem_win_prob != null ? pct(f.dem_win_prob) : "N/A"}`);
          lines.push(`- **Rep Win Probability:** ${f.rep_win_prob != null ? pct(f.rep_win_prob) : "N/A"}`);
          lines.push(`- **Dem Vote Share:** ${f.dem_vote_share != null ? pct(f.dem_vote_share) : "N/A"}`);
          lines.push(`- **Rep Vote Share:** ${f.rep_vote_share != null ? pct(f.rep_vote_share) : "N/A"}`);
          lines.push(`- **Cycle:** ${f.cycle} | Last Updated: ${f.last_updated || "N/A"}`);
          lines.push("");
        }
      }
    }

    // Forecast History / Rating Changes
    if (data.forecastHistory.length > 0) {
      lines.push("### Rating Change History");
      for (const fh of data.forecastHistory.slice(0, 30)) {
        const label = fh.district ? `${fh.race_type} D-${fh.district}` : fh.race_type;
        lines.push(`- **${label}** (${fh.source}) ${fh.changed_at?.slice(0, 10)}: ${fh.old_rating || "NEW"} → ${fh.new_rating || "N/A"}`);
      }
      lines.push("");
    }

    // ===== CAMPAIGN FINANCE - FEDERAL =====
    lines.push("## Federal Campaign Finance");
    if (data.campaignFinance.length === 0) {
      lines.push("No federal campaign finance data available.");
    } else {
      const totalRaised = data.campaignFinance.reduce((s: number, cf: any) => s + (cf.total_raised || 0), 0);
      const totalSpent = data.campaignFinance.reduce((s: number, cf: any) => s + (cf.total_spent || 0), 0);
      lines.push(`### Aggregate Totals (${data.campaignFinance.length} candidates)`);
      lines.push(`- **Total Raised Across All Candidates:** ${money(totalRaised)}`);
      lines.push(`- **Total Spent Across All Candidates:** ${money(totalSpent)}`);
      lines.push("");

      for (const cf of data.campaignFinance) {
        lines.push(`### ${cf.candidate_name} (${cf.party || "N/A"}) — ${cf.office}${cf.district ? ` D-${cf.district}` : ""}`);
        lines.push(`- **Cycle:** ${cf.cycle} | Source: ${cf.source}`);
        lines.push(`- **Total Raised:** ${money(cf.total_raised)}`);
        lines.push(`- **Total Spent:** ${money(cf.total_spent)}`);
        lines.push(`- **Cash on Hand:** ${money(cf.cash_on_hand)}`);
        lines.push(`- **Total Debt:** ${money(cf.total_debt)}`);
        lines.push(`- **Individual Contributions:** ${money(cf.individual_contributions)}`);
        lines.push(`- **PAC Contributions:** ${money(cf.pac_contributions)}`);
        lines.push(`- **Self-Funding:** ${money(cf.self_funding)}`);
        lines.push(`- **Small Dollar %:** ${pct(cf.small_dollar_pct)}`);
        lines.push(`- **Large Donor %:** ${pct(cf.large_donor_pct)}`);
        lines.push(`- **Out-of-State %:** ${pct(cf.out_of_state_pct)}`);
        if (cf.filing_date) lines.push(`- **Latest Filing:** ${cf.filing_date}`);
        if (cf.top_industries?.length) {
          lines.push("- **Top Industries:**");
          for (const ind of cf.top_industries.slice(0, 5)) {
            lines.push(`  - ${typeof ind === "string" ? ind : JSON.stringify(ind)}`);
          }
        }
        if (cf.top_contributors?.length) {
          lines.push("- **Top Contributors:**");
          for (const con of cf.top_contributors.slice(0, 5)) {
            lines.push(`  - ${typeof con === "string" ? con : JSON.stringify(con)}`);
          }
        }
        lines.push("");
      }
    }

    // ===== STATE CAMPAIGN FINANCE =====
    if (data.stateCfb.length > 0) {
      lines.push("## State Campaign Finance");
      const stateTotal = data.stateCfb.reduce((s: number, sc: any) => s + (Number(sc.total_contributions) || 0), 0);
      lines.push(`### Aggregate (${data.stateCfb.length} candidates): Total Raised ${money(stateTotal)}`);
      lines.push("");
      for (const sc of data.stateCfb) {
        lines.push(`### ${sc.candidate_name} (${sc.party || "N/A"}) — ${sc.chamber} ${sc.office || ""}`);
        lines.push(`- **Committee:** ${sc.committee_name}`);
        lines.push(`- **Total Contributions:** ${money(sc.total_contributions)}`);
        lines.push(`- **Total Expenditures:** ${money(sc.total_expenditures)}`);
        lines.push(`- **Net Cash:** ${money(sc.net_cash)}`);
        lines.push(`- **Contribution Count:** ${fmt(sc.contribution_count)}`);
        lines.push(`- **Expenditure Count:** ${fmt(sc.expenditure_count)}`);
        lines.push(`- **In-Kind Total:** ${money(sc.in_kind_total)}`);
        lines.push(`- **Years Active:** ${sc.years_active?.join(", ") || "N/A"}`);
        if (sc.top_contributors?.length) {
          lines.push("- **Top Contributors:**");
          for (const tc of (sc.top_contributors as any[]).slice(0, 5)) {
            lines.push(`  - ${typeof tc === "string" ? tc : JSON.stringify(tc)}`);
          }
        }
        if (sc.contributor_types && Object.keys(sc.contributor_types).length) {
          lines.push(`- **Contributor Types:** ${JSON.stringify(sc.contributor_types)}`);
        }
        if (sc.top_vendors?.length) {
          lines.push("- **Top Vendors:**");
          for (const tv of (sc.top_vendors as any[]).slice(0, 5)) {
            lines.push(`  - ${typeof tv === "string" ? tv : JSON.stringify(tv)}`);
          }
        }
        lines.push("");
      }
    }

    // ===== WINRED DONATIONS =====
    if (data.winredDonations.length > 0) {
      lines.push("## WinRed Donation Activity");
      const totalDonated = data.winredDonations.reduce((s: number, d: any) => s + (Number(d.amount) || 0), 0);
      const avgDonation = totalDonated / data.winredDonations.length;
      const recurringCount = data.winredDonations.filter((d: any) => d.recurring).length;
      const uniqueDonors = new Set(data.winredDonations.map((d: any) => `${d.donor_first_name} ${d.donor_last_name}`)).size;

      lines.push(`- **Total Donations:** ${fmt(data.winredDonations.length)}`);
      lines.push(`- **Total Amount:** ${money(totalDonated)}`);
      lines.push(`- **Average Donation:** ${money(Math.round(avgDonation))}`);
      lines.push(`- **Unique Donors:** ${fmt(uniqueDonors)}`);
      lines.push(`- **Recurring Donations:** ${fmt(recurringCount)} (${((recurringCount / data.winredDonations.length) * 100).toFixed(1)}%)`);
      lines.push("");

      // Top recipients
      const byCandidate = data.winredDonations.reduce((acc: Record<string, number>, d: any) => {
        const name = d.candidate_name || d.committee_name || "Unknown";
        acc[name] = (acc[name] || 0) + (Number(d.amount) || 0);
        return acc;
      }, {});
      const sortedRecipients = Object.entries(byCandidate).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 10);
      if (sortedRecipients.length) {
        lines.push("### Top WinRed Recipients");
        for (const [name, amount] of sortedRecipients) {
          lines.push(`- **${name}:** ${money(amount as number)}`);
        }
        lines.push("");
      }

      // Top cities
      const byCity = data.winredDonations.reduce((acc: Record<string, number>, d: any) => {
        const city = d.donor_city || "Unknown";
        acc[city] = (acc[city] || 0) + (Number(d.amount) || 0);
        return acc;
      }, {});
      const sortedCities = Object.entries(byCity).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 10);
      if (sortedCities.length) {
        lines.push("### Top Donor Cities");
        for (const [city, amount] of sortedCities) {
          lines.push(`- **${city}:** ${money(amount as number)}`);
        }
        lines.push("");
      }
    }

    // ===== ELECTION HISTORY - CONGRESSIONAL =====
    lines.push("## Congressional Election History");
    if (data.electionResults.length === 0) {
      lines.push("No congressional election history data available.");
    } else {
      const byYear = new Map<number, any[]>();
      for (const r of data.electionResults) {
        if (!byYear.has(r.election_year)) byYear.set(r.election_year, []);
        byYear.get(r.election_year)!.push(r);
      }
      for (const [year, results] of [...byYear.entries()].sort((a, b) => b[0] - a[0]).slice(0, 10)) {
        lines.push(`### ${year} Elections`);
        const districtMap = new Map<string, any[]>();
        for (const r of results) {
          const d = r.district_number;
          if (!districtMap.has(d)) districtMap.set(d, []);
          districtMap.get(d)!.push(r);
        }
        for (const [dist, candidates] of [...districtMap.entries()].sort()) {
          lines.push(`#### District ${dist}`);
          const sorted = candidates.sort((a: any, b: any) => (b.votes || 0) - (a.votes || 0));
          for (const c of sorted) {
            const winnerTag = c.is_winner ? " ✓ WINNER" : "";
            const incumbentTag = c.is_incumbent ? " (I)" : "";
            lines.push(`- ${c.candidate_name}${incumbentTag} (${c.party || "N/A"}): ${fmt(c.votes)} votes (${pct(c.vote_pct)})${winnerTag}`);
          }
          if (sorted[0]?.total_votes) lines.push(`  Total votes: ${fmt(sorted[0].total_votes)}`);
          lines.push("");
        }
      }
    }

    // ===== MIT ELECTION LAB HISTORY =====
    if (data.mitElections.length > 0) {
      lines.push("## MIT Election Lab — Historical Results");
      const byOffice = groupBy(data.mitElections, "office");
      for (const [office, results] of Object.entries(byOffice)) {
        lines.push(`### ${office}`);
        const byYear = groupBy(results, "year");
        const years = Object.keys(byYear).map(Number).sort((a, b) => b - a).slice(0, 6);
        for (const year of years) {
          const yearResults = byYear[String(year)];
          lines.push(`#### ${year}`);
          // Aggregate by candidate (skip county-level detail)
          const byCand: Record<string, { votes: number; party: string }> = {};
          for (const r of yearResults) {
            const key = (r as any).candidate;
            if (!byCand[key]) byCand[key] = { votes: 0, party: (r as any).party || "N/A" };
            byCand[key].votes += (r as any).candidatevotes || 0;
          }
          const totalVotes = (yearResults[0] as any)?.totalvotes || Object.values(byCand).reduce((s, c) => s + c.votes, 0);
          const sorted = Object.entries(byCand).sort((a, b) => b[1].votes - a[1].votes).slice(0, 5);
          for (const [name, info] of sorted) {
            const votePct = totalVotes > 0 ? ((info.votes / totalVotes) * 100).toFixed(1) : "?";
            lines.push(`- ${name} (${info.party}): ${fmt(info.votes)} (${votePct}%)`);
          }
          lines.push("");
        }
      }
    }

    // ===== STATE LEGISLATIVE ELECTIONS =====
    if (data.stateLegElections.length > 0) {
      lines.push("## State Legislative Election Results");
      const byYear = groupBy(data.stateLegElections, "election_year");
      const years = Object.keys(byYear).map(Number).sort((a, b) => b - a).slice(0, 4);
      for (const year of years) {
        lines.push(`### ${year}`);
        const byChamber = groupBy(byYear[String(year)], "chamber");
        for (const [chamber, results] of Object.entries(byChamber)) {
          lines.push(`#### ${chamber.charAt(0).toUpperCase() + chamber.slice(1)}`);
          const winners = results.filter((r: any) => r.is_winner);
          const partyWins = winners.reduce((acc: Record<string, number>, w: any) => {
            const p = w.party || "Unknown";
            acc[p] = (acc[p] || 0) + 1;
            return acc;
          }, {});
          for (const [party, count] of Object.entries(partyWins)) {
            lines.push(`- **${party}:** ${count} seats won`);
          }
          lines.push(`- Total races: ${new Set(results.map((r: any) => r.district_number)).size}`);
          lines.push("");
        }
      }
    }

    // ===== STATE LEGISLATIVE DISTRICTS =====
    if (data.stateLeg.length > 0) {
      lines.push("## State Legislative Districts");
      const houses = data.stateLeg.filter((d: any) => d.chamber === "house");
      const senates = data.stateLeg.filter((d: any) => d.chamber === "senate");
      lines.push(`- **Total Districts:** ${data.stateLeg.length}`);
      if (houses.length) lines.push(`- **House Districts:** ${houses.length}`);
      if (senates.length) lines.push(`- **Senate Districts:** ${senates.length}`);

      // Averages
      const slAvgIncome = avg(data.stateLeg, "median_income");
      const slAvgPov = avg(data.stateLeg, "poverty_rate");
      const slAvgUnemp = avg(data.stateLeg, "unemployment_rate");
      const slAvgEduc = avg(data.stateLeg, "education_bachelor_pct");
      lines.push("");
      lines.push("### Statewide Averages (State Legislative)");
      lines.push(`- **Avg Median Income:** ${money(Math.round(slAvgIncome))}`);
      lines.push(`- **Avg Poverty Rate:** ${slAvgPov.toFixed(1)}%`);
      lines.push(`- **Avg Unemployment:** ${slAvgUnemp.toFixed(1)}%`);
      lines.push(`- **Avg Bachelor's+:** ${slAvgEduc.toFixed(1)}%`);

      // Extremes
      const richest = [...data.stateLeg].filter((d: any) => d.median_income).sort((a: any, b: any) => (b.median_income || 0) - (a.median_income || 0))[0];
      const poorest = [...data.stateLeg].filter((d: any) => d.median_income).sort((a: any, b: any) => (a.median_income || 0) - (b.median_income || 0))[0];
      if (richest) lines.push(`- **Highest Income District:** ${richest.district_id} (${money(richest.median_income)})`);
      if (poorest) lines.push(`- **Lowest Income District:** ${poorest.district_id} (${money(poorest.median_income)})`);
      lines.push("");
    }

    // ===== PREDICTION MARKETS =====
    if (data.predictionMarkets.length > 0) {
      lines.push("## Prediction Markets");
      for (const pm of data.predictionMarkets) {
        lines.push(`### ${pm.title}`);
        lines.push(`- **Source:** ${pm.source} | Status: ${pm.status || "active"}`);
        lines.push(`- **Yes Price:** ${pm.yes_price != null ? (pm.yes_price * 100).toFixed(0) + "¢" : "N/A"}`);
        lines.push(`- **No Price:** ${pm.no_price != null ? (pm.no_price * 100).toFixed(0) + "¢" : "N/A"}`);
        lines.push(`- **Volume:** ${money(pm.volume)}`);
        lines.push(`- **Liquidity:** ${money(pm.liquidity)}`);
        if (pm.candidate_name) lines.push(`- **Candidate:** ${pm.candidate_name}`);
        if (pm.last_traded_at) lines.push(`- **Last Trade:** ${pm.last_traded_at}`);
        if (pm.market_url) lines.push(`- **URL:** ${pm.market_url}`);
        lines.push("");
      }
    }

    // ===== POLLING DATA =====
    lines.push("## Polling Data");
    if (data.polling.length === 0) {
      lines.push("No polling data available for this state.");
    } else {
      for (const p of data.polling) {
        lines.push(`### ${p.candidate_or_topic}`);
        lines.push(`- **Source:** ${p.source || "N/A"} | Type: ${p.poll_type || "N/A"}`);
        lines.push(`- **Date:** ${p.date_conducted || "N/A"}${p.end_date ? ` to ${p.end_date}` : ""}`);
        if (p.approve_pct != null) lines.push(`- **Approve:** ${pct(p.approve_pct)}`);
        if (p.disapprove_pct != null) lines.push(`- **Disapprove:** ${pct(p.disapprove_pct)}`);
        if (p.favor_pct != null) lines.push(`- **Favor:** ${pct(p.favor_pct)}`);
        if (p.oppose_pct != null) lines.push(`- **Oppose:** ${pct(p.oppose_pct)}`);
        if (p.margin != null) lines.push(`- **Margin:** ${p.margin > 0 ? "+" : ""}${Number(p.margin).toFixed(1)}`);
        if (p.sample_size) lines.push(`- **Sample Size:** ${fmt(p.sample_size)} (${p.sample_type || "N/A"})`);
        if (p.margin_of_error) lines.push(`- **Margin of Error:** ±${p.margin_of_error}`);
        if (p.methodology) lines.push(`- **Methodology:** ${p.methodology}`);
        if (p.partisan_lean) lines.push(`- **Partisan Lean:** ${p.partisan_lean}`);
        if (p.question) lines.push(`- **Question:** ${p.question}`);
        lines.push("");
      }
    }

    // ===== FEDERAL LEGISLATION =====
    lines.push("## Federal Legislation (Sponsored by Delegation)");
    if (data.bills.length === 0) {
      lines.push("No related federal legislation found.");
    } else {
      for (const b of data.bills.slice(0, 30)) {
        lines.push(`### ${b.short_title || b.title}`);
        lines.push(`- **Bill ID:** ${b.bill_id} | Congress: ${b.congress}`);
        lines.push(`- **Status:** ${b.status || "N/A"}`);
        lines.push(`- **Sponsor:** ${b.sponsor_name || "N/A"}`);
        lines.push(`- **Introduced:** ${b.introduced_date || "N/A"}`);
        lines.push(`- **Latest Action:** ${b.latest_action_text || "N/A"} (${b.latest_action_date || "N/A"})`);
        if (b.policy_area) lines.push(`- **Policy Area:** ${b.policy_area}`);
        if (b.cosponsor_count) lines.push(`- **Cosponsors:** ${b.cosponsor_count}`);
        if (b.origin_chamber) lines.push(`- **Origin:** ${b.origin_chamber}`);
        lines.push("");
      }
    }

    // ===== TRACKED BILLS (STATE) =====
    if (data.trackedBills.length > 0) {
      lines.push("## Tracked State Bills (LegiScan)");
      for (const tb of data.trackedBills) {
        lines.push(`- **${tb.title}** (${tb.bill_number || "N/A"})`);
        lines.push(`  Status: ${tb.status_desc || "N/A"} | Last Action: ${tb.last_action || "N/A"} (${tb.last_action_date || "N/A"})`);
        if (tb.legiscan_url) lines.push(`  URL: ${tb.legiscan_url}`);
      }
      lines.push("");
    }

    // ===== CONGRESS VOTES =====
    if (data.congressVotes.length > 0) {
      lines.push("## Related Congressional Votes");
      for (const v of data.congressVotes.slice(0, 20)) {
        lines.push(`- **${v.description || v.question || v.vote_id}** (${v.chamber}, ${v.vote_date || "N/A"})`);
        lines.push(`  Result: ${v.result || "N/A"} | Yea: ${v.yea_total || 0} / Nay: ${v.nay_total || 0} / Not Voting: ${v.not_voting_total || 0}`);
      }
      lines.push("");
    }

    // ===== INTELLIGENCE BRIEFINGS =====
    if (data.intelBriefings.length > 0) {
      lines.push("## Intelligence Briefings");
      for (const ib of data.intelBriefings) {
        lines.push(`### ${ib.title}`);
        lines.push(`- **Category:** ${ib.category} | Scope: ${ib.scope}`);
        lines.push(`- **Source:** ${ib.source_name}`);
        if (ib.published_at) lines.push(`- **Published:** ${ib.published_at.slice(0, 10)}`);
        lines.push(`- **Summary:** ${ib.summary}`);
        if (ib.source_url) lines.push(`- **URL:** ${ib.source_url}`);
        lines.push("");
      }
    }

    // ===== LOCAL IMPACT REPORTS =====
    if (data.localImpacts.length > 0) {
      lines.push("## State Impact Reports");
      for (const li of data.localImpacts) {
        const title = li.slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
        lines.push(`### ${title}`);
        if (li.tags?.length) lines.push(`Tags: ${li.tags.join(", ")}`);
        lines.push(li.summary || "");
        lines.push("");
        // Include full content (truncated)
        if (li.content) {
          lines.push(li.content.slice(0, 2000));
          if (li.content.length > 2000) lines.push("... (truncated)");
        }
        lines.push("");
      }
    }

    // ===== OPPOSITION RESEARCH =====
    if (data.candidateProfiles.length > 0) {
      lines.push("## Opposition Research Profiles");
      for (const cp of data.candidateProfiles) {
        lines.push(`### ${cp.name}`);
        if (cp.tags?.length) lines.push(`- **Tags:** ${cp.tags.join(", ")}`);
        // Include content excerpt
        if (cp.content) {
          const excerpt = cp.content.slice(0, 500);
          lines.push(excerpt);
          if (cp.content.length > 500) lines.push("... (see full profile for details)");
        }
        lines.push("");
      }
    }

    // ===== MAGA FILES =====
    if (data.magaFiles.length > 0) {
      lines.push("## Related MAGA Files");
      for (const mf of data.magaFiles) {
        lines.push(`### ${mf.name}`);
        if (mf.tags?.length) lines.push(`- **Tags:** ${mf.tags.join(", ")}`);
        const excerpt = mf.content?.slice(0, 500) || "";
        lines.push(excerpt);
        if (mf.content?.length > 500) lines.push("... (see full file for details)");
        lines.push("");
      }
    }

    // ===== NARRATIVE REPORTS =====
    if (data.narrativeReports.length > 0) {
      lines.push("## Related Narrative Reports");
      for (const nr of data.narrativeReports) {
        lines.push(`### ${nr.name}`);
        if (nr.tags?.length) lines.push(`- **Tags:** ${nr.tags.join(", ")}`);
        const excerpt = nr.content?.slice(0, 500) || "";
        lines.push(excerpt);
        if (nr.content?.length > 500) lines.push("... (see full report for details)");
        lines.push("");
      }
    }

    // ===== MESSAGING GUIDANCE =====
    if (data.messagingGuidance.length > 0) {
      lines.push("## Related Messaging Guidance");
      for (const mg of data.messagingGuidance.slice(0, 10)) {
        lines.push(`### ${mg.title}`);
        lines.push(`- **Source:** ${mg.source} | Type: ${mg.research_type}`);
        if (mg.issue_areas?.length) lines.push(`- **Issue Areas:** ${mg.issue_areas.join(", ")}`);
        lines.push(`- **Summary:** ${mg.summary}`);
        lines.push("");
      }
    }

    lines.push("---");
    lines.push(`*End of Report — ${data.stateName} — Generated ${new Date().toLocaleString()}*`);

    return lines.join("\n");
  }, []);

  const handleExportPDF = useCallback(() => {
    if (!reportData) return;
    const content = buildMarkdownReport(reportData);
    exportContentPDF({
      title: `State Report: ${reportData.stateName}`,
      subtitle: `Comprehensive intelligence report — ${reportData.stateAbbr}`,
      tag: "STATE REPORT",
      content,
      section: "Research Tools",
    });
  }, [reportData, buildMarkdownReport]);

  const reportContent = reportData ? buildMarkdownReport(reportData) : "";

  const totalDataPoints = reportData ? countDataPoints(reportData) : 0;

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-3 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Research Tools
      </button>

      <div className="win98-sunken bg-[hsl(var(--win98-light))] px-3 py-2 mb-3">
        <div className="flex items-center gap-2 text-[11px]">
          <FileText className="h-4 w-4" />
          <span className="font-bold">State Report Generator</span>
          <span className="text-[hsl(var(--muted-foreground))]">— Generate comprehensive state intelligence reports from 20+ data sources</span>
        </div>
      </div>

      <div className="candidate-card p-4">
        <p className="text-[10px] text-[hsl(var(--muted-foreground))] mb-3">
          Select a state to generate a deep-dive intelligence report pulling data from all databases: congressional & state districts, election history (MIT Lab + OpenElections), campaign finance (federal + state), polling, forecasts & rating history, prediction markets, WinRed donations, legislation, intel briefings, voter registration stats, and opposition research.
        </p>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-[10px] font-bold block mb-1">Select State</label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="win98-input w-full text-[11px] py-1.5 px-2"
            >
              <option value="">— Choose a state —</option>
              {ALL_STATE_ABBRS.map((abbr) => (
                <option key={abbr} value={abbr}>
                  {STATE_NAMES[abbr]} ({abbr})
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={generateReport}
            disabled={!selectedState || loading}
            className="win98-button text-[11px] px-4 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            {loading ? "Generating…" : "Generate Report"}
          </button>
        </div>
      </div>

      {/* Battleground quick-pick */}
      <div className="candidate-card p-3">
        <p className="text-[10px] font-bold mb-2">Quick Select — Battleground States</p>
        <div className="flex flex-wrap gap-1.5">
          {["AZ", "GA", "MI", "NV", "NC", "PA", "WI", "MN", "NH", "ME"].map((abbr) => (
            <button
              key={abbr}
              onClick={() => { setSelectedState(abbr); }}
              className={`win98-button text-[9px] px-2 py-0.5 ${selectedState === abbr ? "win98-button-active" : ""}`}
            >
              {abbr}
            </button>
          ))}
        </div>
      </div>

      {/* Data sources legend */}
      <div className="candidate-card p-3">
        <p className="text-[10px] font-bold mb-2">Data Sources Included</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
          {[
            "Congressional Districts", "State Legislative Districts", "Congressional Delegation",
            "Federal Campaign Finance", "State Campaign Finance", "Congressional Elections",
            "MIT Election Lab History", "State Leg Elections", "Election Forecasts",
            "Forecast Rating History", "Polling Data", "Prediction Markets",
            "WinRed Donations", "Federal Legislation", "Tracked State Bills",
            "Congress Votes", "Intel Briefings", "Local Impact Reports",
            "Opposition Research", "MAGA Files", "Narrative Reports",
            "Voter Registration Stats", "Messaging Guidance",
          ].map((src) => (
            <span key={src} className="text-[8px] text-[hsl(var(--muted-foreground))] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))] inline-block" />
              {src}
            </span>
          ))}
        </div>
      </div>

      {/* Report Window */}
      {reportWindow && reportData && (
        <Win98Window
          title={`📊 State Report — ${reportData.stateName}`}
          icon={<span className="text-[14px]">📊</span>}
          onClose={() => setReportWindow(false)}
          defaultSize={{ width: 800, height: 600 }}
          defaultPosition={{ x: 40, y: 30 }}
          minSize={{ width: 400, height: 300 }}
          toolbar={
            <div className="flex items-center gap-2 px-2 py-1 bg-[hsl(var(--win98-light))] border-b border-[hsl(var(--win98-dark))]">
              <button onClick={handleExportPDF} className="win98-button text-[10px] flex items-center gap-1 px-2 py-0.5">
                <Download className="h-3 w-3" /> Export PDF
              </button>
              <span className="text-[9px] text-[hsl(var(--muted-foreground))] ml-auto">
                {totalDataPoints} data points across {countDataSources(reportData)} categories
              </span>
            </div>
          }
          statusBar={
            <div className="text-[9px] text-[hsl(var(--muted-foreground))] px-2">
              Report generated {new Date().toLocaleString()} | {reportData.stateName} ({reportData.stateAbbr})
            </div>
          }
        >
          <div className="overflow-y-auto h-full p-3 bg-white text-[hsl(var(--foreground))]">
            <div className="prose-research max-w-none">
              {reportContent.split("\n").map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={i} className="h-2" />;
                if (trimmed.startsWith("# "))
                  return <h1 key={i} className="text-base font-bold mb-2 text-[hsl(var(--foreground))]">{trimmed.slice(2)}</h1>;
                if (trimmed.startsWith("## "))
                  return <h2 key={i} className="text-sm font-bold mt-4 mb-1.5 border-b border-[hsl(var(--border))] pb-1 text-[hsl(var(--foreground))]">{trimmed.slice(3)}</h2>;
                if (trimmed.startsWith("### "))
                  return <h3 key={i} className="text-[11px] font-bold mt-2 mb-1 text-[hsl(var(--foreground))]">{trimmed.slice(4)}</h3>;
                if (trimmed.startsWith("#### "))
                  return <h4 key={i} className="text-[10px] font-bold mt-1.5 mb-0.5 text-[hsl(var(--foreground))]">{trimmed.slice(5)}</h4>;
                if (trimmed.startsWith("---"))
                  return <hr key={i} className="my-3 border-[hsl(var(--border))]" />;
                if (trimmed.startsWith("*") && trimmed.endsWith("*") && !trimmed.startsWith("**"))
                  return <p key={i} className="text-[9px] italic text-[hsl(var(--muted-foreground))]">{trimmed.slice(1, -1)}</p>;
                if (trimmed.startsWith("- ")) {
                  const text = trimmed.slice(2);
                  const boldMatch = text.match(/^\*\*(.*?)\*\*(.*)$/);
                  if (boldMatch) {
                    return (
                      <div key={i} className="text-[10px] ml-3 flex gap-1 leading-relaxed">
                        <span className="text-[hsl(var(--muted-foreground))]">•</span>
                        <span><strong>{boldMatch[1]}</strong>{boldMatch[2]}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={i} className="text-[10px] ml-3 flex gap-1 leading-relaxed">
                      <span className="text-[hsl(var(--muted-foreground))]">•</span>
                      <span>{text}</span>
                    </div>
                  );
                }
                if (trimmed.startsWith("  - ")) {
                  return (
                    <div key={i} className="text-[9px] ml-6 flex gap-1 leading-relaxed text-[hsl(var(--muted-foreground))]">
                      <span>◦</span>
                      <span>{trimmed.slice(4)}</span>
                    </div>
                  );
                }
                return <p key={i} className="text-[10px] leading-relaxed">{trimmed}</p>;
              })}
            </div>
          </div>
        </Win98Window>
      )}
    </div>
  );
}

// Utility functions
function avg(arr: any[], field: string): number {
  const valid = arr.filter((d) => d[field] != null);
  if (valid.length === 0) return 0;
  return valid.reduce((s, d) => s + Number(d[field]), 0) / valid.length;
}

function groupBy(arr: any[], field: string): Record<string, any[]> {
  return arr.reduce((acc, item) => {
    const key = String(item[field] || "unknown");
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, any[]>);
}

function countDataSources(data: StateReportData): number {
  let count = 0;
  if (data.districts.length) count++;
  if (data.stateLeg.length) count++;
  if (data.congressMembers.length) count++;
  if (data.campaignFinance.length) count++;
  if (data.electionResults.length) count++;
  if (data.forecasts.length) count++;
  if (data.forecastHistory.length) count++;
  if (data.polling.length) count++;
  if (data.intelBriefings.length) count++;
  if (data.localImpacts.length) count++;
  if (data.candidateProfiles.length) count++;
  if (data.predictionMarkets.length) count++;
  if (data.bills.length) count++;
  if (data.stateCfb.length) count++;
  if (data.voterStats.length) count++;
  if (data.mitElections.length) count++;
  if (data.winredDonations.length) count++;
  if (data.stateLegElections.length) count++;
  if (data.trackedBills.length) count++;
  if (data.narrativeReports.length) count++;
  if (data.magaFiles.length) count++;
  if (data.congressVotes.length) count++;
  if (data.messagingGuidance.length) count++;
  return count;
}

function countDataPoints(data: StateReportData): number {
  return data.districts.length + data.stateLeg.length + data.congressMembers.length +
    data.campaignFinance.length + data.electionResults.length + data.forecasts.length +
    data.forecastHistory.length + data.polling.length + data.intelBriefings.length +
    data.localImpacts.length + data.candidateProfiles.length + data.predictionMarkets.length +
    data.bills.length + data.stateCfb.length + data.voterStats.length + data.mitElections.length +
    data.winredDonations.length + data.stateLegElections.length + data.trackedBills.length +
    data.narrativeReports.length + data.magaFiles.length + data.congressVotes.length +
    data.messagingGuidance.length;
}
