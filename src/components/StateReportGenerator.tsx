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
  polling: any[];
  intelBriefings: any[];
  localImpacts: any[];
  candidateProfiles: any[];
  predictionMarkets: any[];
  bills: any[];
  stateCfb: any[];
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
        { data: polling },
        { data: intelBriefings },
        { data: localImpacts },
        { data: candidateProfiles },
        { data: predictionMarkets },
        { data: bills },
        { data: stateCfb },
      ] = await Promise.all([
        supabase.from("district_profiles").select("*").eq("state", stateName),
        supabase.from("state_legislative_profiles").select("*").eq("state_abbr", abbr).limit(500),
        supabase.from("congress_members").select("*").eq("state", abbr),
        supabase.from("campaign_finance").select("*").eq("state_abbr", abbr),
        supabase.from("congressional_election_results").select("*").eq("state_abbr", abbr).order("election_year", { ascending: false }).limit(200),
        supabase.from("election_forecasts").select("*").eq("state_abbr", abbr),
        supabase.from("polling_data").select("*").ilike("candidate_or_topic", `%${stateName}%`).limit(50),
        supabase.from("intel_briefings").select("*").or(`region.ilike.%${stateName}%,region.ilike.%${abbr}%`).limit(50),
        supabase.from("local_impacts").select("*").eq("state", stateName),
        supabase.from("candidate_profiles").select("id,name,slug,tags").eq("is_subpage", false).limit(1000),
        supabase.from("prediction_markets").select("*").eq("state_abbr", abbr),
        supabase.from("congress_bills").select("bill_id,title,short_title,sponsor_name,status,latest_action_date").ilike("sponsor_name", `%${abbr}%`).limit(50),
        supabase.from("state_cfb_candidates").select("*").eq("state_abbr", abbr),
      ]);

      // Filter candidate profiles that mention the state
      const stateKeywords = [stateName.toLowerCase(), abbr.toLowerCase()];
      const filteredCandidates = (candidateProfiles || []).filter((c: any) =>
        c.tags?.some((t: string) => stateKeywords.includes(t.toLowerCase())) ||
        c.name?.toLowerCase().includes(stateName.toLowerCase())
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
        polling: polling || [],
        intelBriefings: intelBriefings || [],
        localImpacts: localImpacts || [],
        candidateProfiles: filteredCandidates,
        predictionMarkets: predictionMarkets || [],
        bills: bills || [],
        stateCfb: stateCfb || [],
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
    const pct = (n: number | null | undefined) => n != null ? `${n.toFixed(1)}%` : "N/A";
    const money = (n: number | null | undefined) => n != null ? `$${n.toLocaleString()}` : "N/A";

    lines.push(`# Comprehensive State Report: ${data.stateName} (${data.stateAbbr})`);
    lines.push(`Generated ${new Date().toLocaleDateString()}`);
    lines.push("");

    // Congressional Districts
    lines.push("## Congressional Districts");
    if (data.districts.length === 0) {
      lines.push("No congressional district data available.");
    } else {
      for (const d of data.districts) {
        lines.push(`### ${d.district_id}`);
        lines.push(`- **Population:** ${fmt(d.population)}`);
        lines.push(`- **Median Income:** ${money(d.median_income)}`);
        lines.push(`- **Median Age:** ${d.median_age ?? "N/A"}`);
        lines.push(`- **Education (Bachelor+):** ${pct(d.education_bachelor_pct)}`);
        lines.push(`- **Poverty Rate:** ${pct(d.poverty_rate)}`);
        lines.push(`- **Unemployment:** ${pct(d.unemployment_rate)}`);
        if (d.top_issues?.length) lines.push(`- **Top Issues:** ${d.top_issues.join(", ")}`);
        lines.push("");
      }
    }
    lines.push("");

    // Current Congress Members
    lines.push("## Current Congressional Delegation");
    if (data.congressMembers.length === 0) {
      lines.push("No congressional delegation data available.");
    } else {
      for (const m of data.congressMembers) {
        lines.push(`- **${m.name}** (${m.party || "N/A"}) — ${m.chamber}${m.district ? `, District ${m.district}` : ""}`);
      }
    }
    lines.push("");

    // Election Forecasts
    lines.push("## Election Forecasts");
    if (data.forecasts.length === 0) {
      lines.push("No forecast data available.");
    } else {
      for (const f of data.forecasts) {
        const label = f.district ? `${f.race_type} ${f.district}` : f.race_type;
        lines.push(`- **${label}** (${f.source}): Rating: ${f.rating || "N/A"}, Margin: ${f.margin ?? "N/A"}`);
      }
    }
    lines.push("");

    // Campaign Finance
    lines.push("## Campaign Finance");
    if (data.campaignFinance.length === 0) {
      lines.push("No campaign finance data available.");
    } else {
      for (const cf of data.campaignFinance) {
        lines.push(`### ${cf.candidate_name} (${cf.party || "N/A"}) — ${cf.office}`);
        lines.push(`- **Total Raised:** ${money(cf.total_raised)}`);
        lines.push(`- **Total Spent:** ${money(cf.total_spent)}`);
        lines.push(`- **Cash on Hand:** ${money(cf.cash_on_hand)}`);
        lines.push(`- **Small Dollar %:** ${pct(cf.small_dollar_pct)}`);
        lines.push("");
      }
    }
    lines.push("");

    // State Campaign Finance Board
    if (data.stateCfb.length > 0) {
      lines.push("## State Campaign Finance");
      for (const sc of data.stateCfb.slice(0, 20)) {
        lines.push(`- **${sc.candidate_name}** (${sc.party || "N/A"}, ${sc.chamber}): Raised ${money(sc.total_contributions)}, Spent ${money(sc.total_expenditures)}`);
      }
      lines.push("");
    }

    // Election History
    lines.push("## Election History");
    if (data.electionResults.length === 0) {
      lines.push("No election history data available.");
    } else {
      const byYear = new Map<number, any[]>();
      for (const r of data.electionResults) {
        if (!byYear.has(r.election_year)) byYear.set(r.election_year, []);
        byYear.get(r.election_year)!.push(r);
      }
      for (const [year, results] of [...byYear.entries()].sort((a, b) => b[0] - a[0]).slice(0, 5)) {
        lines.push(`### ${year}`);
        const winners = results.filter((r: any) => r.is_winner);
        for (const w of winners) {
          lines.push(`- **District ${w.district_number}**: ${w.candidate_name} (${w.party || "N/A"}) — ${pct(w.vote_pct)}`);
        }
        lines.push("");
      }
    }
    lines.push("");

    // Prediction Markets
    if (data.predictionMarkets.length > 0) {
      lines.push("## Prediction Markets");
      for (const pm of data.predictionMarkets) {
        lines.push(`- **${pm.title}** (${pm.source}): Yes ${pm.yes_price != null ? (pm.yes_price * 100).toFixed(0) + "¢" : "N/A"}, Volume ${money(pm.volume)}`);
      }
      lines.push("");
    }

    // Polling
    if (data.polling.length > 0) {
      lines.push("## Relevant Polling");
      for (const p of data.polling.slice(0, 15)) {
        lines.push(`- **${p.candidate_or_topic}** (${p.source}, ${p.date_conducted}): Approve ${pct(p.approve_pct)}, Disapprove ${pct(p.disapprove_pct)}`);
      }
      lines.push("");
    }

    // State Legislative Districts
    if (data.stateLeg.length > 0) {
      lines.push("## State Legislative Districts");
      lines.push(`Total districts: ${data.stateLeg.length}`);
      const houses = data.stateLeg.filter((d: any) => d.chamber === "house");
      const senates = data.stateLeg.filter((d: any) => d.chamber === "senate");
      if (houses.length) lines.push(`- **House Districts:** ${houses.length}`);
      if (senates.length) lines.push(`- **Senate Districts:** ${senates.length}`);
      const avgIncome = data.stateLeg.reduce((s: number, d: any) => s + (d.median_income || 0), 0) / data.stateLeg.length;
      if (avgIncome > 0) lines.push(`- **Avg Median Income:** ${money(Math.round(avgIncome))}`);
      lines.push("");
    }

    // Intel Briefings
    if (data.intelBriefings.length > 0) {
      lines.push("## Intelligence Briefings");
      for (const ib of data.intelBriefings.slice(0, 10)) {
        lines.push(`### ${ib.title}`);
        lines.push(`${ib.summary}`);
        lines.push(`- Source: ${ib.source_name} | ${ib.category} | ${ib.scope}`);
        lines.push("");
      }
    }

    // Local Impact
    if (data.localImpacts.length > 0) {
      lines.push("## State Impact Reports");
      for (const li of data.localImpacts) {
        lines.push(`### ${li.slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}`);
        lines.push(li.summary || li.content.slice(0, 300));
        lines.push("");
      }
    }

    // Candidate Profiles
    if (data.candidateProfiles.length > 0) {
      lines.push("## Opposition Research Profiles");
      for (const cp of data.candidateProfiles) {
        lines.push(`- **${cp.name}** — Tags: ${cp.tags?.join(", ") || "N/A"}`);
      }
      lines.push("");
    }

    // Legislation
    if (data.bills.length > 0) {
      lines.push("## Related Federal Legislation");
      for (const b of data.bills.slice(0, 15)) {
        lines.push(`- **${b.short_title || b.title}** (${b.bill_id}) — ${b.status || "N/A"}`);
        if (b.sponsor_name) lines.push(`  Sponsor: ${b.sponsor_name}`);
      }
      lines.push("");
    }

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
          <span className="text-[hsl(var(--muted-foreground))]">— Generate comprehensive state intelligence reports</span>
        </div>
      </div>

      <div className="candidate-card p-4">
        <p className="text-[10px] text-[hsl(var(--muted-foreground))] mb-3">
          Select a state to generate a report pulling data from all databases: districts, elections, finance, polling, forecasts, intel briefings, and opposition research.
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

      {/* Recent states quick-pick */}
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

      {/* Report Window */}
      {reportWindow && reportData && (
        <Win98Window
          title={`📊 State Report — ${reportData.stateName}`}
          icon={<span className="text-[14px]">📊</span>}
          onClose={() => setReportWindow(false)}
          defaultSize={{ width: 720, height: 560 }}
          defaultPosition={{ x: 60, y: 40 }}
          minSize={{ width: 400, height: 300 }}
          toolbar={
            <div className="flex items-center gap-2 px-2 py-1 bg-[hsl(var(--win98-light))] border-b border-[hsl(var(--win98-dark))]">
              <button onClick={handleExportPDF} className="win98-button text-[10px] flex items-center gap-1 px-2 py-0.5">
                <Download className="h-3 w-3" /> Export PDF
              </button>
              <span className="text-[9px] text-[hsl(var(--muted-foreground))] ml-auto">
                {reportData.districts.length} districts · {reportData.congressMembers.length} members · {reportData.campaignFinance.length} finance records
              </span>
            </div>
          }
          statusBar={
            <div className="text-[9px] text-[hsl(var(--muted-foreground))] px-2">
              Report generated {new Date().toLocaleString()} | {reportData.stateName}
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
                return <p key={i} className="text-[10px] leading-relaxed">{trimmed}</p>;
              })}
            </div>
          </div>
        </Win98Window>
      )}
    </div>
  );
}
