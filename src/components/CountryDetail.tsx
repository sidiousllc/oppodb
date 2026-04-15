import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Download, Loader2, RefreshCw, Scale, AlertTriangle, FileText, Globe2, TrendingUp, Newspaper, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCountryByCode } from "@/data/internationalCountries";
import { Win98Window } from "./Win98Window";
import { exportContentPDF } from "@/lib/contentExport";

interface CountryDetailProps {
  countryCode: string;
  onBack: () => void;
}

interface CountryData {
  profile: any | null;
  elections: any[];
  leaders: any[];
  legislation: any[];
  policyIssues: any[];
  intelBriefings: any[];
  polling: any[];
}

type TabId = "overview" | "government" | "elections" | "economy" | "legislation" | "issues" | "intel";

interface DetailWindow {
  id: string;
  type: "issue" | "election" | "economy" | "intel" | "legislation" | "leader" | "polling";
  data: any;
  posIndex: number;
}

export function CountryDetail({ countryCode, onBack }: CountryDetailProps) {
  const country = getCountryByCode(countryCode);
  const [tab, setTab] = useState<TabId>("overview");
  const [data, setData] = useState<CountryData>({ profile: null, elections: [], leaders: [], legislation: [], policyIssues: [], intelBriefings: [], polling: [] });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [reportWindow, setReportWindow] = useState(false);
  const [legFilter, setLegFilter] = useState<string>("all");
  const [issueFilter, setIssueFilter] = useState<string>("all");
  const [detailWindows, setDetailWindows] = useState<DetailWindow[]>([]);
  const [winCounter, setWinCounter] = useState(0);

  const openDetailWindow = useCallback((type: DetailWindow["type"], item: any) => {
    const id = `${type}-${item.id || Date.now()}`;
    setDetailWindows(prev => {
      if (prev.find(w => w.id === id)) return prev;
      return [...prev, { id, type, data: item, posIndex: prev.length }];
    });
    setWinCounter(c => c + 1);
  }, []);

  const closeDetailWindow = useCallback((id: string) => {
    setDetailWindows(prev => prev.filter(w => w.id !== id));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [profileRes, electionsRes, leadersRes, legRes, issuesRes, intelRes, pollingRes] = await Promise.all([
      supabase.from("international_profiles").select("*").eq("country_code", countryCode).maybeSingle(),
      supabase.from("international_elections").select("*").eq("country_code", countryCode).order("election_year", { ascending: false }).limit(20),
      supabase.from("international_leaders").select("*").eq("country_code", countryCode),
      supabase.from("international_legislation").select("*").eq("country_code", countryCode).order("introduced_date", { ascending: false }).limit(100),
      supabase.from("international_policy_issues").select("*").eq("country_code", countryCode).order("created_at", { ascending: false }).limit(100),
      supabase.from("intel_briefings").select("*").eq("region", countryCode).order("published_at", { ascending: false }).limit(50),
      supabase.from("international_polling").select("*").eq("country_code", countryCode).order("date_conducted", { ascending: false }).limit(100),
    ]);
    setData({
      profile: profileRes.data,
      elections: electionsRes.data || [],
      leaders: leadersRes.data || [],
      legislation: legRes.data || [],
      policyIssues: issuesRes.data || [],
      intelBriefings: intelRes.data || [],
      polling: pollingRes.data || [],
    });
    setLoading(false);
  }, [countryCode]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await supabase.functions.invoke("international-sync", { body: { country_code: countryCode } });
      await fetchData();
    } catch (err) {
      console.error("Sync error:", err);
    }
    setSyncing(false);
  }, [countryCode, fetchData]);

  const fmt = (n: number | null | undefined) => n != null ? n.toLocaleString() : "N/A";
  const pct = (n: number | null | undefined) => n != null ? `${n.toFixed(1)}%` : "N/A";
  const money = (n: number | null | undefined) => n != null ? `$${n.toLocaleString()}` : "N/A";

  const buildReport = useCallback((): string => {
    const p = data.profile;
    const lines: string[] = [];
    lines.push(`# ${country?.flag || ""} ${country?.name || countryCode} — Country Intelligence Report`);
    lines.push(`Generated ${new Date().toLocaleDateString()}`);
    lines.push("");
    if (p) {
      lines.push("## Overview");
      lines.push(`- **Capital:** ${p.capital || "N/A"}`);
      lines.push(`- **Population:** ${fmt(p.population)}`);
      lines.push(`- **Area:** ${fmt(p.area_sq_km)} sq km`);
      lines.push(`- **Languages:** ${p.official_languages?.join(", ") || "N/A"}`);
      lines.push(`- **Currency:** ${p.currency || "N/A"}`);
      lines.push(`- **Government:** ${p.government_type || "N/A"}`);
      lines.push("");
      lines.push("## Economy");
      lines.push(`- **GDP:** ${money(p.gdp)}`);
      lines.push(`- **GDP Per Capita:** ${money(p.gdp_per_capita)}`);
      lines.push(`- **Unemployment:** ${pct(p.unemployment_rate)}`);
      lines.push(`- **Poverty Rate:** ${pct(p.poverty_rate)}`);
      lines.push(`- **Inflation:** ${pct(p.inflation_rate)}`);
      lines.push("");
    }
    if (data.leaders.length > 0) {
      lines.push("## Current Leaders");
      for (const l of data.leaders) {
        lines.push(`### ${l.name} — ${l.title}`);
        if (l.party) lines.push(`- **Party:** ${l.party}`);
        if (l.in_office_since) lines.push(`- **In Office Since:** ${l.in_office_since}`);
        if (l.bio) lines.push(l.bio);
        lines.push("");
      }
    }
    if (data.elections.length > 0) {
      lines.push("## Election History");
      for (const e of data.elections) {
        lines.push(`### ${e.election_year} — ${e.election_type}`);
        if (e.winner_name) lines.push(`- **Winner:** ${e.winner_name} (${e.winner_party || "N/A"})`);
        if (e.turnout_pct) lines.push(`- **Turnout:** ${pct(e.turnout_pct)}`);
        lines.push("");
      }
    }
    return lines.join("\n");
  }, [data, country, countryCode]);

  const handleExportPDF = useCallback(() => {
    const content = buildReport();
    exportContentPDF({
      title: `${country?.name || countryCode} — Country Report`,
      subtitle: `${country?.continent} · ${country?.region}`,
      tag: "INTERNATIONAL REPORT",
      content,
      section: "InternationalHub",
    });
  }, [buildReport, country, countryCode]);

  if (!country) return <div className="text-[11px]">Country not found.</div>;

  const p = data.profile;
  const tabs: { id: TabId; label: string; icon?: React.ReactNode; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "government", label: "Government" },
    { id: "legislation", label: "Legislation", icon: <Scale className="h-3 w-3" />, count: data.legislation.length },
    { id: "issues", label: "Issues", icon: <AlertTriangle className="h-3 w-3" />, count: data.policyIssues.length },
    { id: "elections", label: "Elections", count: data.elections.length },
    { id: "economy", label: "Economy" },
    { id: "intel", label: "Intel", icon: <Newspaper className="h-3 w-3" />, count: data.intelBriefings.length },
  ];

  const severityColor = (s: string) => {
    switch (s) {
      case "critical": return "bg-red-600 text-white";
      case "high": return "bg-orange-500 text-white";
      case "medium": return "bg-yellow-500 text-black";
      case "low": return "bg-green-600 text-white";
      default: return "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]";
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "enacted": case "passed": case "royal_assent": return "text-green-700 bg-green-100";
      case "rejected": return "text-red-700 bg-red-100";
      case "introduced": case "pending": return "text-blue-700 bg-blue-100";
      case "in_committee": return "text-yellow-700 bg-yellow-100";
      default: return "text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))]";
    }
  };

  const filteredLegislation = legFilter === "all"
    ? data.legislation
    : data.legislation.filter(l => l.bill_type === legFilter || l.source === legFilter);

  const filteredIssues = issueFilter === "all"
    ? data.policyIssues
    : data.policyIssues.filter(i => i.category === issueFilter || i.severity === issueFilter);

  const legTypes = [...new Set(data.legislation.map(l => l.bill_type))];
  const legSources = [...new Set(data.legislation.map(l => l.source))];
  const issueCategories = [...new Set(data.policyIssues.map(i => i.category))];

  return (
    <div className="space-y-3">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-1">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      {/* Header */}
      <div className="win98-sunken bg-[hsl(var(--win98-light))] px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-xl">{country.flag}</span>
            <div>
              <span className="font-bold text-sm">{country.name}</span>
              <span className="text-[hsl(var(--muted-foreground))] ml-2">{country.continent} · {country.region}</span>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button onClick={handleSync} disabled={syncing} className="win98-button text-[10px] flex items-center gap-1 px-2 py-0.5">
              <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} /> {syncing ? "Syncing…" : "Sync Data"}
            </button>
            <button onClick={handleExportPDF} className="win98-button text-[10px] flex items-center gap-1 px-2 py-0.5">
              <Download className="h-3 w-3" /> PDF
            </button>
            <button onClick={() => setReportWindow(true)} className="win98-button text-[10px] px-2 py-0.5">Full Report</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-[hsl(var(--border))] overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`text-[10px] px-3 py-1.5 border border-b-0 rounded-t transition-colors whitespace-nowrap flex items-center gap-1 ${
              tab === t.id
                ? "bg-white font-bold border-[hsl(var(--border))]"
                : "bg-[hsl(var(--win98-light))] text-[hsl(var(--muted-foreground))] border-transparent hover:bg-[hsl(var(--win98-bg))]"
            }`}
          >
            {t.icon}
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className="text-[8px] bg-[hsl(var(--muted))] px-1 rounded">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
          <span className="text-[11px] ml-2">Loading data…</span>
        </div>
      ) : (
        <div className="space-y-3">
          {tab === "overview" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoCard title="General" items={[
                ["Capital", p?.capital],
                ["Population", fmt(p?.population)],
                ["Area", p?.area_sq_km ? `${fmt(p.area_sq_km)} sq km` : "N/A"],
                ["Languages", p?.official_languages?.join(", ")],
                ["Currency", p?.currency],
                ["Government", p?.government_type],
              ]} />
              <InfoCard title="Key Indicators" items={[
                ["HDI", p?.human_dev_index?.toFixed(3)],
                ["Press Freedom Rank", p?.press_freedom_rank ? `#${p.press_freedom_rank}` : undefined],
                ["Corruption Index", p?.corruption_index?.toFixed(1)],
                ["Median Age", p?.median_age?.toFixed(1)],
              ]} />
              <div className="col-span-full grid grid-cols-4 gap-2">
                {[
                  { label: "Legislation", value: data.legislation.length, tab: "legislation" as TabId },
                  { label: "Policy Issues", value: data.policyIssues.length, tab: "issues" as TabId },
                  { label: "Elections", value: data.elections.length, tab: "elections" as TabId },
                  { label: "Leaders", value: data.leaders.length, tab: "government" as TabId },
                ].map(s => (
                  <button key={s.label} onClick={() => setTab(s.tab)} className="candidate-card p-2 text-center hover:bg-[hsl(var(--accent))] transition-colors">
                    <div className="text-lg font-bold">{s.value}</div>
                    <div className="text-[9px] text-[hsl(var(--muted-foreground))]">{s.label}</div>
                  </button>
                ))}
              </div>
              {!p && (
                <div className="col-span-full candidate-card p-4 text-center">
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] mb-2">No data loaded yet for {country.name}.</p>
                  <button onClick={handleSync} className="win98-button text-[10px] px-3 py-1">
                    <RefreshCw className="h-3 w-3 inline mr-1" /> Sync Data Now
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === "government" && (
            <div className="space-y-3">
              <InfoCard title="Leadership" items={[
                ["Head of State", p?.head_of_state],
                ["Head of Government", p?.head_of_government],
                ["Ruling Party", p?.ruling_party],
                ["Last Election", p?.last_election_date],
                ["Next Election", p?.next_election_date],
              ]} />
              {data.leaders.length > 0 && (
                <div className="candidate-card p-3">
                  <h3 className="text-[11px] font-bold mb-2">Current Leaders</h3>
                  {data.leaders.map(l => (
                    <button key={l.id} onClick={() => openDetailWindow("leader", l)} className="w-full text-left mb-2 pb-2 border-b border-[hsl(var(--border))] last:border-0 hover:bg-[hsl(var(--accent))] transition-colors rounded p-1 -m-1">
                      <div className="text-[11px] font-bold">{l.name}</div>
                      <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{l.title} · {l.party || "Independent"}</div>
                      {l.bio && <p className="text-[9px] mt-1">{l.bio.slice(0, 200)}…</p>}
                      <span className="text-[8px] text-blue-600 mt-0.5 inline-block">Click for details →</span>
                    </button>
                  ))}
                </div>
              )}
              {data.leaders.length === 0 && (
                <div className="candidate-card p-3 text-center text-[10px] text-[hsl(var(--muted-foreground))]">
                  No leader data available. Sync to fetch.
                </div>
              )}
            </div>
          )}

          {tab === "legislation" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <select value={legFilter} onChange={e => setLegFilter(e.target.value)} className="win98-sunken text-[10px] px-2 py-1 bg-white">
                  <option value="all">All Types</option>
                  {legTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  <optgroup label="Source">
                    {legSources.map(s => <option key={s} value={s}>{s}</option>)}
                  </optgroup>
                </select>
                <span className="text-[9px] text-[hsl(var(--muted-foreground))]">{filteredLegislation.length} items</span>
              </div>
              {filteredLegislation.length === 0 ? (
                <div className="candidate-card p-4 text-center">
                  <Scale className="h-6 w-6 mx-auto mb-2 text-[hsl(var(--muted-foreground))]" />
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] mb-2">No legislation data available for {country.name}.</p>
                  <button onClick={handleSync} className="win98-button text-[10px] px-3 py-1"><RefreshCw className="h-3 w-3 inline mr-1" /> Sync</button>
                </div>
              ) : filteredLegislation.map(l => (
                <button key={l.id} onClick={() => openDetailWindow("legislation", l)} className="candidate-card p-3 w-full text-left hover:bg-[hsl(var(--accent))] transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1">
                      <div className="text-[11px] font-bold leading-tight">{l.title}</div>
                      {l.bill_number && <span className="text-[9px] text-[hsl(var(--muted-foreground))]">{l.bill_number}</span>}
                    </div>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${statusColor(l.status)}`}>{l.status.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-[hsl(var(--muted-foreground))] mb-1 flex-wrap">
                    <span className="bg-[hsl(var(--muted))] px-1 rounded">{l.bill_type}</span>
                    {l.body && <span>📜 {l.body}</span>}
                    {l.introduced_date && <span>📅 {l.introduced_date}</span>}
                  </div>
                  {l.summary && <p className="text-[10px] leading-relaxed mt-1">{l.summary.slice(0, 200)}…</p>}
                  <span className="text-[8px] text-blue-600 mt-1 inline-block">Click for full details →</span>
                </button>
              ))}
            </div>
          )}

          {tab === "issues" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <select value={issueFilter} onChange={e => setIssueFilter(e.target.value)} className="win98-sunken text-[10px] px-2 py-1 bg-white">
                  <option value="all">All Categories</option>
                  {issueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  <optgroup label="Severity">
                    {["critical", "high", "medium", "low"].map(s => <option key={s} value={s}>{s}</option>)}
                  </optgroup>
                </select>
                <span className="text-[9px] text-[hsl(var(--muted-foreground))]">{filteredIssues.length} issues</span>
              </div>
              {filteredIssues.length === 0 ? (
                <div className="candidate-card p-4 text-center">
                  <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-[hsl(var(--muted-foreground))]" />
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] mb-2">No policy issues tracked for {country.name}.</p>
                  <button onClick={handleSync} className="win98-button text-[10px] px-3 py-1"><RefreshCw className="h-3 w-3 inline mr-1" /> Sync</button>
                </div>
              ) : filteredIssues.map(issue => (
                <button key={issue.id} onClick={() => openDetailWindow("issue", issue)} className="candidate-card p-3 w-full text-left hover:bg-[hsl(var(--accent))] transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="text-[11px] font-bold leading-tight flex-1">{issue.title}</div>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap ${severityColor(issue.severity)}`}>{issue.severity.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-[hsl(var(--muted-foreground))] mb-1 flex-wrap">
                    <span className="bg-[hsl(var(--muted))] px-1 rounded">{issue.category}</span>
                    <span className={`px-1 rounded ${issue.status === "escalating" ? "bg-red-100 text-red-700" : issue.status === "resolved" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{issue.status}</span>
                    {issue.started_date && <span>📅 Since {issue.started_date}</span>}
                  </div>
                  {issue.description && <p className="text-[10px] leading-relaxed mt-1">{issue.description.slice(0, 200)}…</p>}
                  <span className="text-[8px] text-blue-600 mt-1 inline-block">Click for full details →</span>
                </button>
              ))}
            </div>
          )}

          {tab === "elections" && (
            <div className="space-y-3">
              {data.elections.length === 0 ? (
                <div className="candidate-card p-3 text-center text-[10px] text-[hsl(var(--muted-foreground))]">
                  No election data available. Sync to fetch.
                </div>
              ) : data.elections.map(e => (
                <button key={e.id} onClick={() => openDetailWindow("election", e)} className="candidate-card p-3 w-full text-left hover:bg-[hsl(var(--accent))] transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold">{e.election_year} — {e.election_type}</span>
                    {e.election_date && <span className="text-[9px] text-[hsl(var(--muted-foreground))]">{e.election_date}</span>}
                  </div>
                  {e.winner_name && <div className="text-[10px]"><strong>Winner:</strong> {e.winner_name} ({e.winner_party || "N/A"})</div>}
                  {e.turnout_pct != null && <div className="text-[10px]"><strong>Turnout:</strong> {pct(e.turnout_pct)}</div>}
                  <span className="text-[8px] text-blue-600 mt-1 inline-block">Click for full details →</span>
                </button>
              ))}
            </div>
          )}

          {tab === "economy" && (
            <div className="space-y-3">
              {/* GDP & Core Metrics */}
              <div className="grid gap-3 sm:grid-cols-2">
                <button onClick={() => p && openDetailWindow("economy", { ...p, section: "gdp" })} className="text-left hover:bg-[hsl(var(--accent))] transition-colors rounded">
                  <InfoCard title="📊 GDP & Output — Click for details" items={[
                    ["Nominal GDP", money(p?.gdp)],
                    ["Real GDP", money(p?.real_gdp)],
                    ["GDP Per Capita", money(p?.gdp_per_capita)],
                    ["GDP Growth Rate", p?.gdp_growth_rate != null ? `${p.gdp_growth_rate.toFixed(1)}%` : "N/A"],
                    ["Industrial Production", p?.industrial_production_index != null ? p.industrial_production_index.toFixed(1) : "N/A"],
                  ]} />
                </button>
                <button onClick={() => p && openDetailWindow("economy", { ...p, section: "inflation" })} className="text-left hover:bg-[hsl(var(--accent))] transition-colors rounded">
                  <InfoCard title="📈 Inflation & Prices — Click for details" items={[
                    ["Inflation Rate", pct(p?.inflation_rate)],
                    ["CPI Rate", p?.cpi_rate != null ? `${p.cpi_rate.toFixed(1)}%` : "N/A"],
                    ["PCE Rate", p?.pce_rate != null ? `${p.pce_rate.toFixed(1)}%` : "N/A"],
                    ["Currency", p?.currency || "N/A"],
                  ]} />
                </button>
              </div>

              {/* Employment */}
              <div className="grid gap-3 sm:grid-cols-2">
                <button onClick={() => p && openDetailWindow("economy", { ...p, section: "employment" })} className="text-left hover:bg-[hsl(var(--accent))] transition-colors rounded">
                  <InfoCard title="👷 Employment & Labor — Click for details" items={[
                    ["Unemployment Rate", pct(p?.unemployment_rate)],
                    ["Nonfarm Payrolls", p?.nonfarm_payrolls != null ? fmt(p.nonfarm_payrolls) : "N/A"],
                    ["Labor Force Participation", p?.labor_force_participation != null ? `${p.labor_force_participation.toFixed(1)}%` : "N/A"],
                    ["Labor Cost Index", p?.labor_cost_index != null ? p.labor_cost_index.toFixed(1) : "N/A"],
                    ["Poverty Rate", pct(p?.poverty_rate)],
                  ]} />
                </button>
                <button onClick={() => p && openDetailWindow("economy", { ...p, section: "consumer" })} className="text-left hover:bg-[hsl(var(--accent))] transition-colors rounded">
                  <InfoCard title="🛒 Consumer & Spending — Click for details" items={[
                    ["Consumer Spending", money(p?.consumer_spending)],
                    ["Personal Income", money(p?.personal_income)],
                    ["Population", fmt(p?.population)],
                    ["Median Age", p?.median_age?.toFixed(1) || "N/A"],
                  ]} />
                </button>
              </div>

              {/* Leading / Coincident / Lagging Indicators */}
              <div className="candidate-card p-3">
                <h3 className="text-[11px] font-bold mb-2">📊 Indicator Categories</h3>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => p && openDetailWindow("economy", { ...p, section: "leading" })} className="text-left p-2 rounded border border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))] transition-colors">
                    <div className="text-[10px] font-bold text-green-700 mb-1">🟢 Leading</div>
                    <div className="text-[9px] text-[hsl(var(--muted-foreground))]">Predict future activity</div>
                    <div className="text-[9px] mt-1">
                      <div>• Stock Market: {p?.stock_market_name || "—"} {p?.stock_market_index != null ? fmt(p.stock_market_index) : ""}</div>
                      <div>• Building Permits: {p?.building_permits != null ? fmt(p.building_permits) : "N/A"}</div>
                      <div>• New Orders: {p?.manufacturer_new_orders != null ? money(p.manufacturer_new_orders) : "N/A"}</div>
                    </div>
                  </button>
                  <button onClick={() => p && openDetailWindow("economy", { ...p, section: "coincident" })} className="text-left p-2 rounded border border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))] transition-colors">
                    <div className="text-[10px] font-bold text-blue-700 mb-1">🔵 Coincident</div>
                    <div className="text-[9px] text-[hsl(var(--muted-foreground))]">Current state of economy</div>
                    <div className="text-[9px] mt-1">
                      <div>• GDP: {money(p?.gdp)}</div>
                      <div>• Industrial Prod: {p?.industrial_production_index != null ? p.industrial_production_index.toFixed(1) : "N/A"}</div>
                      <div>• Personal Income: {money(p?.personal_income)}</div>
                    </div>
                  </button>
                  <button onClick={() => p && openDetailWindow("economy", { ...p, section: "lagging" })} className="text-left p-2 rounded border border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))] transition-colors">
                    <div className="text-[10px] font-bold text-orange-700 mb-1">🟠 Lagging</div>
                    <div className="text-[9px] text-[hsl(var(--muted-foreground))]">Confirm past trends</div>
                    <div className="text-[9px] mt-1">
                      <div>• Unemployment: {pct(p?.unemployment_rate)}</div>
                      <div>• Corp. Profits: {money(p?.corporate_profits)}</div>
                      <div>• Labor Costs: {p?.labor_cost_index != null ? p.labor_cost_index.toFixed(1) : "N/A"}</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Trade & Fiscal */}
              <div className="grid gap-3 sm:grid-cols-2">
                <button onClick={() => p && openDetailWindow("economy", { ...p, section: "fiscal" })} className="text-left hover:bg-[hsl(var(--accent))] transition-colors rounded">
                  <InfoCard title="🏦 Fiscal & Debt — Click for details" items={[
                    ["Gov. Debt/GDP", p?.government_debt_gdp_pct != null ? `${p.government_debt_gdp_pct.toFixed(1)}%` : "N/A"],
                    ["Current Account", money(p?.current_account_balance)],
                    ["FDI Inflows", money(p?.fdi_inflows)],
                    ["Corruption Index", p?.corruption_index?.toFixed(1) || "N/A"],
                  ]} />
                </button>
                {p?.trade_partners && (Array.isArray(p.trade_partners) ? p.trade_partners : []).length > 0 && (
                  <button onClick={() => openDetailWindow("economy", { ...p, section: "trade" })} className="text-left hover:bg-[hsl(var(--accent))] transition-colors rounded">
                    <div className="candidate-card p-3">
                      <h3 className="text-[11px] font-bold mb-2">🤝 Trade Partners — Click for details</h3>
                      {(p.trade_partners as any[]).slice(0, 5).map((tp: any, i: number) => (
                        <div key={i} className="text-[10px] mb-0.5">• {typeof tp === "string" ? tp : tp.name || tp.country || JSON.stringify(tp)}</div>
                      ))}
                    </div>
                  </button>
                )}
              </div>

              {p?.major_industries?.length > 0 && (
                <button onClick={() => openDetailWindow("economy", { ...p, section: "industries" })} className="text-left hover:bg-[hsl(var(--accent))] transition-colors rounded w-full">
                  <div className="candidate-card p-3">
                    <h3 className="text-[11px] font-bold mb-2">🏭 Major Industries — Click for details</h3>
                    <div className="grid grid-cols-3 gap-1">
                      {p.major_industries.slice(0, 9).map((ind: string, i: number) => (
                        <div key={i} className="text-[10px] bg-[hsl(var(--muted))] px-2 py-1 rounded">{ind}</div>
                      ))}
                    </div>
                    {p.major_industries.length > 9 && <div className="text-[9px] text-blue-600 mt-1">+{p.major_industries.length - 9} more…</div>}
                  </div>
                </button>
              )}

              {/* Governance */}
              <div className="grid gap-3 sm:grid-cols-3">
                <InfoCard title="📊 Governance Indices" items={[
                  ["HDI", p?.human_dev_index?.toFixed(3) || "N/A"],
                  ["Press Freedom", p?.press_freedom_rank ? `#${p.press_freedom_rank}` : "N/A"],
                  ["Corruption", p?.corruption_index?.toFixed(1) || "N/A"],
                ]} />
              </div>

              {!p && (
                <div className="candidate-card p-4 text-center">
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] mb-2">No economic data loaded for {country.name}.</p>
                  <button onClick={handleSync} className="win98-button text-[10px] px-3 py-1"><RefreshCw className="h-3 w-3 inline mr-1" /> Sync Data</button>
                </div>
              )}
            </div>
          )}

          {tab === "intel" && (
            <div className="space-y-3">
              {data.intelBriefings.length === 0 ? (
                <div className="candidate-card p-3 text-center text-[10px] text-[hsl(var(--muted-foreground))]">
                  No intel briefings for {country.name}.
                  <br />
                  <button onClick={handleSync} className="win98-button text-[10px] px-3 py-1 mt-2"><RefreshCw className="h-3 w-3 inline mr-1" /> Sync Intel</button>
                </div>
              ) : data.intelBriefings.map(b => (
                <button key={b.id} onClick={() => openDetailWindow("intel", b)} className="candidate-card p-3 w-full text-left hover:bg-[hsl(var(--accent))] transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="text-[11px] font-bold leading-tight flex-1">{b.title}</div>
                    <span className="text-[8px] bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded whitespace-nowrap">{b.category}</span>
                  </div>
                  <div className="text-[9px] text-[hsl(var(--muted-foreground))] mb-1">
                    {b.source_name} · {b.scope} · {b.published_at ? new Date(b.published_at).toLocaleDateString() : ""}
                  </div>
                  {b.summary && <p className="text-[10px] leading-relaxed">{b.summary.slice(0, 200)}…</p>}
                  <span className="text-[8px] text-blue-600 mt-1 inline-block">Click for full briefing →</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Full Report Window */}
      {reportWindow && (
        <Win98Window
          title={`📊 ${country.flag} ${country.name} — Full Report`}
          icon={<span className="text-[14px]">{country.flag}</span>}
          onClose={() => setReportWindow(false)}
          defaultSize={{ width: 680, height: 520 }}
          defaultPosition={{ x: 80, y: 50 }}
          minSize={{ width: 400, height: 300 }}
          toolbar={
            <div className="flex items-center gap-2 px-2 py-1 bg-[hsl(var(--win98-light))] border-b border-[hsl(var(--win98-dark))]">
              <button onClick={handleExportPDF} className="win98-button text-[10px] flex items-center gap-1 px-2 py-0.5">
                <Download className="h-3 w-3" /> Export PDF
              </button>
            </div>
          }
        >
          <div className="overflow-y-auto h-full p-3 bg-white text-[hsl(var(--foreground))]">
            <div className="prose-research max-w-none">
              {buildReport().split("\n").map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={i} className="h-2" />;
                if (trimmed.startsWith("# ")) return <h1 key={i} className="text-base font-bold mb-2">{trimmed.slice(2)}</h1>;
                if (trimmed.startsWith("## ")) return <h2 key={i} className="text-sm font-bold mt-4 mb-1.5 border-b border-[hsl(var(--border))] pb-1">{trimmed.slice(3)}</h2>;
                if (trimmed.startsWith("### ")) return <h3 key={i} className="text-[11px] font-bold mt-2 mb-1">{trimmed.slice(4)}</h3>;
                if (trimmed.startsWith("- ")) {
                  const text = trimmed.slice(2);
                  const bm = text.match(/^\*\*(.*?)\*\*(.*)$/);
                  if (bm) return <div key={i} className="text-[10px] ml-3 flex gap-1"><span className="text-[hsl(var(--muted-foreground))]">•</span><span><strong>{bm[1]}</strong>{bm[2]}</span></div>;
                  return <div key={i} className="text-[10px] ml-3 flex gap-1"><span className="text-[hsl(var(--muted-foreground))]">•</span><span>{text}</span></div>;
                }
                return <p key={i} className="text-[10px] leading-relaxed">{trimmed}</p>;
              })}
            </div>
          </div>
        </Win98Window>
      )}

      {/* Detail Mini-Windows */}
      {detailWindows.map(win => (
        <DetailMiniWindow key={win.id} win={win} country={country} onClose={() => closeDetailWindow(win.id)} fmt={fmt} pct={pct} money={money} severityColor={severityColor} statusColor={statusColor} />
      ))}
    </div>
  );
}

function DetailMiniWindow({ win, country, onClose, fmt, pct, money, severityColor, statusColor }: {
  win: DetailWindow;
  country: any;
  onClose: () => void;
  fmt: (n: any) => string;
  pct: (n: any) => string;
  money: (n: any) => string;
  severityColor: (s: string) => string;
  statusColor: (s: string) => string;
}) {
  const d = win.data;
  const offset = win.posIndex * 30;

  if (win.type === "issue") {
    return (
      <Win98Window title={`⚠️ Issue: ${d.title?.slice(0, 40)}`} onClose={onClose} defaultSize={{ width: 560, height: 440 }} defaultPosition={{ x: 120 + offset, y: 60 + offset }} minSize={{ width: 350, height: 250 }}>
        <div className="overflow-y-auto h-full p-3 bg-white text-[hsl(var(--foreground))] space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-sm font-bold leading-tight">{d.title}</h2>
            <span className={`text-[9px] px-2 py-0.5 rounded font-bold whitespace-nowrap ${severityColor(d.severity)}`}>{d.severity?.toUpperCase()}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <DetailRow label="Category" value={d.category} />
            <DetailRow label="Status" value={d.status} />
            <DetailRow label="Started" value={d.started_date || "N/A"} />
            <DetailRow label="Resolved" value={d.resolved_date || "Ongoing"} />
          </div>
          {d.affected_regions?.length > 0 && (
            <div>
              <div className="text-[10px] font-bold mb-1">Affected Regions</div>
              <div className="flex flex-wrap gap-1">{d.affected_regions.map((r: string) => <span key={r} className="text-[9px] bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded">{r}</span>)}</div>
            </div>
          )}
          {d.description && (
            <div>
              <div className="text-[10px] font-bold mb-1">Full Description</div>
              <p className="text-[10px] leading-relaxed whitespace-pre-wrap">{d.description}</p>
            </div>
          )}
          {d.sources?.length > 0 && (
            <div>
              <div className="text-[10px] font-bold mb-1">Sources ({(d.sources as any[]).length})</div>
              {(d.sources as any[]).map((src: any, i: number) => (
                <a key={i} href={src.url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-600 hover:underline block mb-0.5">📰 {src.name || src.url}</a>
              ))}
            </div>
          )}
          {d.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1">{d.tags.map((t: string) => <span key={t} className="text-[8px] bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded">{t}</span>)}</div>
          )}
          <div className="text-[8px] text-[hsl(var(--muted-foreground))] border-t border-[hsl(var(--border))] pt-1">
            ID: {d.id} · Updated: {d.updated_at ? new Date(d.updated_at).toLocaleString() : "N/A"}
          </div>
        </div>
      </Win98Window>
    );
  }

  if (win.type === "election") {
    const candidates = Array.isArray(d.candidates) ? d.candidates : [];
    const results = d.results && typeof d.results === "object" ? d.results : {};
    return (
      <Win98Window title={`🗳️ ${d.election_year} ${d.election_type}`} onClose={onClose} defaultSize={{ width: 560, height: 460 }} defaultPosition={{ x: 140 + offset, y: 50 + offset }} minSize={{ width: 350, height: 250 }}>
        <div className="overflow-y-auto h-full p-3 bg-white text-[hsl(var(--foreground))] space-y-3">
          <h2 className="text-sm font-bold">{country.flag} {d.election_year} {d.election_type} Election</h2>
          <div className="grid grid-cols-2 gap-2">
            <DetailRow label="Date" value={d.election_date || "N/A"} />
            <DetailRow label="Type" value={d.election_type} />
            <DetailRow label="Winner" value={d.winner_name || "N/A"} />
            <DetailRow label="Winner Party" value={d.winner_party || "N/A"} />
            <DetailRow label="Turnout" value={d.turnout_pct != null ? pct(d.turnout_pct) : "N/A"} />
            <DetailRow label="Source" value={d.source || "N/A"} />
          </div>
          {candidates.length > 0 && (
            <div>
              <div className="text-[10px] font-bold mb-1">Candidates ({candidates.length})</div>
              <div className="space-y-1">
                {candidates.map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-[10px] border-b border-[hsl(var(--border))] py-1 last:border-0">
                    <div>
                      <span className="font-medium">{c.name || c.candidate || "Unknown"}</span>
                      {c.party && <span className="text-[hsl(var(--muted-foreground))] ml-1">({c.party})</span>}
                    </div>
                    {c.votes != null && <span>{fmt(c.votes)} votes</span>}
                    {c.vote_pct != null && <span className="font-bold">{pct(c.vote_pct)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {Object.keys(results).length > 0 && (
            <div>
              <div className="text-[10px] font-bold mb-1">Results Data</div>
              {Object.entries(results).map(([key, val]) => (
                <DetailRow key={key} label={key} value={String(val)} />
              ))}
            </div>
          )}
          {d.source_url && <a href={d.source_url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-600 hover:underline block">🔗 View source</a>}
          {d.tags?.length > 0 && <div className="flex flex-wrap gap-1">{d.tags.map((t: string) => <span key={t} className="text-[8px] bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded">{t}</span>)}</div>}
          <div className="text-[8px] text-[hsl(var(--muted-foreground))] border-t border-[hsl(var(--border))] pt-1">ID: {d.id}</div>
        </div>
      </Win98Window>
    );
  }

  if (win.type === "economy") {
    const section = d.section || "indicators";
    const titleMap: Record<string, string> = {
      gdp: "GDP & Output", inflation: "Inflation & Prices", employment: "Employment & Labor",
      consumer: "Consumer & Spending", leading: "Leading Indicators", coincident: "Coincident Indicators",
      lagging: "Lagging Indicators", fiscal: "Fiscal & Debt", trade: "Trade Partners",
      industries: "Major Industries", indicators: "Economic Overview",
    };
    return (
      <Win98Window title={`📊 ${country.flag} ${country.name} — ${titleMap[section] || "Economy"}`} onClose={onClose} defaultSize={{ width: 580, height: 540 }} defaultPosition={{ x: 100 + offset, y: 70 + offset }} minSize={{ width: 380, height: 280 }}>
        <div className="overflow-y-auto h-full p-3 bg-white text-[hsl(var(--foreground))] space-y-3">
          <h2 className="text-sm font-bold">{country.flag} {titleMap[section] || "Economic Profile"}</h2>

          {(section === "gdp" || section === "indicators") && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold border-b border-[hsl(var(--border))] pb-1">Gross Domestic Product (GDP)</div>
              <p className="text-[9px] text-[hsl(var(--muted-foreground))] leading-relaxed">GDP measures the total value of all goods and services produced within a country, indicating overall economic growth. Real GDP adjusts for inflation for a more accurate picture.</p>
              <div className="grid grid-cols-2 gap-2">
                <DetailRow label="Nominal GDP" value={money(d.gdp)} />
                <DetailRow label="Real GDP" value={money(d.real_gdp)} />
                <DetailRow label="GDP Per Capita" value={money(d.gdp_per_capita)} />
                <DetailRow label="GDP Growth Rate" value={d.gdp_growth_rate != null ? `${d.gdp_growth_rate.toFixed(2)}%` : "N/A"} />
                <DetailRow label="Industrial Production Index" value={d.industrial_production_index?.toFixed(1) || "N/A"} />
                <DetailRow label="Population" value={fmt(d.population)} />
              </div>
            </div>
          )}

          {(section === "inflation" || section === "indicators") && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold border-b border-[hsl(var(--border))] pb-1">Inflation Rates (CPI & PCE)</div>
              <p className="text-[9px] text-[hsl(var(--muted-foreground))] leading-relaxed">CPI tracks changes in a basket of consumer goods prices. PCE is the Federal Reserve's preferred measure, covering a broader range of expenditures and adjusting for substitution effects.</p>
              <div className="grid grid-cols-2 gap-2">
                <DetailRow label="Headline Inflation" value={pct(d.inflation_rate)} />
                <DetailRow label="CPI Rate" value={d.cpi_rate != null ? `${d.cpi_rate.toFixed(2)}%` : "N/A"} />
                <DetailRow label="PCE Rate" value={d.pce_rate != null ? `${d.pce_rate.toFixed(2)}%` : "N/A"} />
                <DetailRow label="Currency" value={d.currency || "N/A"} />
              </div>
            </div>
          )}

          {(section === "employment" || section === "indicators") && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold border-b border-[hsl(var(--border))] pb-1">Employment & Labor Market</div>
              <p className="text-[9px] text-[hsl(var(--muted-foreground))] leading-relaxed">The unemployment rate shows the percentage of the labor force without jobs. Nonfarm payrolls measure monthly changes in employed workers, indicating job market strength.</p>
              <div className="grid grid-cols-2 gap-2">
                <DetailRow label="Unemployment Rate" value={pct(d.unemployment_rate)} />
                <DetailRow label="Nonfarm Payrolls" value={d.nonfarm_payrolls != null ? fmt(d.nonfarm_payrolls) : "N/A"} />
                <DetailRow label="Labor Force Participation" value={d.labor_force_participation != null ? `${d.labor_force_participation.toFixed(1)}%` : "N/A"} />
                <DetailRow label="Labor Cost Index" value={d.labor_cost_index?.toFixed(1) || "N/A"} />
                <DetailRow label="Poverty Rate" value={pct(d.poverty_rate)} />
              </div>
            </div>
          )}

          {(section === "consumer" || section === "indicators") && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold border-b border-[hsl(var(--border))] pb-1">Consumer Spending</div>
              <p className="text-[9px] text-[hsl(var(--muted-foreground))] leading-relaxed">Consumer spending represents household expenditure on goods and services, monitored through retail sales and personal consumption expenditures — making up roughly two-thirds of economic activity.</p>
              <div className="grid grid-cols-2 gap-2">
                <DetailRow label="Consumer Spending" value={money(d.consumer_spending)} />
                <DetailRow label="Personal Income" value={money(d.personal_income)} />
                <DetailRow label="Median Age" value={d.median_age?.toFixed(1) || "N/A"} />
                <DetailRow label="Population" value={fmt(d.population)} />
              </div>
            </div>
          )}

          {section === "leading" && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold border-b border-[hsl(var(--border))] pb-1">🟢 Leading Indicators</div>
              <p className="text-[9px] text-[hsl(var(--muted-foreground))] leading-relaxed">Leading indicators predict future economic activity. They tend to change before the overall economy shifts, making them valuable for forecasting recessions and expansions.</p>
              <div className="grid grid-cols-2 gap-2">
                <DetailRow label="Stock Market Index" value={d.stock_market_index != null ? fmt(d.stock_market_index) : "N/A"} />
                <DetailRow label="Index Name" value={d.stock_market_name || "N/A"} />
                <DetailRow label="Building Permits" value={d.building_permits != null ? fmt(d.building_permits) : "N/A"} />
                <DetailRow label="Manufacturer New Orders" value={money(d.manufacturer_new_orders)} />
                <DetailRow label="Consumer Spending" value={money(d.consumer_spending)} />
              </div>
              <div className="text-[9px] bg-green-50 p-2 rounded border border-green-200">
                <div className="font-bold text-green-800 mb-1">Examples of Leading Indicators:</div>
                <div>• Stock market returns • Building permits • Manufacturing new orders • Consumer confidence • Yield curve • Weekly jobless claims • Money supply</div>
              </div>
            </div>
          )}

          {section === "coincident" && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold border-b border-[hsl(var(--border))] pb-1">🔵 Coincident Indicators</div>
              <p className="text-[9px] text-[hsl(var(--muted-foreground))] leading-relaxed">Coincident indicators move in tandem with the overall economy and reflect its current state. They confirm whether the economy is in expansion or contraction in real-time.</p>
              <div className="grid grid-cols-2 gap-2">
                <DetailRow label="GDP" value={money(d.gdp)} />
                <DetailRow label="Real GDP" value={money(d.real_gdp)} />
                <DetailRow label="Industrial Production" value={d.industrial_production_index?.toFixed(1) || "N/A"} />
                <DetailRow label="Personal Income" value={money(d.personal_income)} />
                <DetailRow label="Nonfarm Payrolls" value={d.nonfarm_payrolls != null ? fmt(d.nonfarm_payrolls) : "N/A"} />
              </div>
              <div className="text-[9px] bg-blue-50 p-2 rounded border border-blue-200">
                <div className="font-bold text-blue-800 mb-1">Examples of Coincident Indicators:</div>
                <div>• GDP • Industrial production • Personal income • Employment • Retail sales • Manufacturing & trade sales</div>
              </div>
            </div>
          )}

          {section === "lagging" && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold border-b border-[hsl(var(--border))] pb-1">🟠 Lagging Indicators</div>
              <p className="text-[9px] text-[hsl(var(--muted-foreground))] leading-relaxed">Lagging indicators confirm trends after they have already occurred. They help validate whether a trend is genuine and sustainable, providing retrospective confirmation.</p>
              <div className="grid grid-cols-2 gap-2">
                <DetailRow label="Unemployment Rate" value={pct(d.unemployment_rate)} />
                <DetailRow label="Corporate Profits" value={money(d.corporate_profits)} />
                <DetailRow label="Labor Cost Index" value={d.labor_cost_index?.toFixed(1) || "N/A"} />
                <DetailRow label="CPI Rate" value={d.cpi_rate != null ? `${d.cpi_rate.toFixed(2)}%` : "N/A"} />
                <DetailRow label="Gov. Debt/GDP" value={d.government_debt_gdp_pct != null ? `${d.government_debt_gdp_pct.toFixed(1)}%` : "N/A"} />
              </div>
              <div className="text-[9px] bg-orange-50 p-2 rounded border border-orange-200">
                <div className="font-bold text-orange-800 mb-1">Examples of Lagging Indicators:</div>
                <div>• Unemployment rate • Corporate profits • Labor cost per unit • CPI • Commercial lending • Avg. prime rate • Inventory-to-sales ratio</div>
              </div>
            </div>
          )}

          {section === "fiscal" && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold border-b border-[hsl(var(--border))] pb-1">Fiscal & External</div>
              <div className="grid grid-cols-2 gap-2">
                <DetailRow label="Gov. Debt/GDP" value={d.government_debt_gdp_pct != null ? `${d.government_debt_gdp_pct.toFixed(1)}%` : "N/A"} />
                <DetailRow label="Current Account Balance" value={money(d.current_account_balance)} />
                <DetailRow label="FDI Inflows" value={money(d.fdi_inflows)} />
                <DetailRow label="Corruption Index" value={d.corruption_index?.toFixed(1) || "N/A"} />
                <DetailRow label="Press Freedom Rank" value={d.press_freedom_rank ? `#${d.press_freedom_rank}` : "N/A"} />
                <DetailRow label="HDI" value={d.human_dev_index?.toFixed(3) || "N/A"} />
              </div>
            </div>
          )}

          {(section === "industries") && d.major_industries?.length > 0 && (
            <div>
              <div className="text-[10px] font-bold mb-1">Major Industries ({d.major_industries.length})</div>
              <div className="grid grid-cols-2 gap-1">
                {d.major_industries.map((ind: string, i: number) => (
                  <div key={i} className="text-[10px] bg-[hsl(var(--muted))] px-2 py-1 rounded">🏭 {ind}</div>
                ))}
              </div>
            </div>
          )}

          {(section === "trade") && d.trade_partners && (Array.isArray(d.trade_partners) ? d.trade_partners : []).length > 0 && (
            <div>
              <div className="text-[10px] font-bold mb-1">Trade Partners</div>
              {(d.trade_partners as any[]).map((tp: any, i: number) => (
                <div key={i} className="text-[10px] mb-0.5">🤝 {typeof tp === "string" ? tp : tp.name || tp.country || JSON.stringify(tp)}</div>
              ))}
            </div>
          )}

          <div className="text-[8px] text-[hsl(var(--muted-foreground))] border-t border-[hsl(var(--border))] pt-1">
            Last updated: {d.updated_at ? new Date(d.updated_at).toLocaleString() : "N/A"}
          </div>
        </div>
      </Win98Window>
    );
  }

  if (win.type === "intel") {
    return (
      <Win98Window title={`🕵️ ${d.title?.slice(0, 45)}`} onClose={onClose} defaultSize={{ width: 580, height: 460 }} defaultPosition={{ x: 110 + offset, y: 55 + offset }} minSize={{ width: 350, height: 250 }}>
        <div className="overflow-y-auto h-full p-3 bg-white text-[hsl(var(--foreground))] space-y-3">
          <h2 className="text-sm font-bold leading-tight">{d.title}</h2>
          <div className="grid grid-cols-2 gap-2">
            <DetailRow label="Category" value={d.category} />
            <DetailRow label="Scope" value={d.scope} />
            <DetailRow label="Source" value={d.source_name} />
            <DetailRow label="Published" value={d.published_at ? new Date(d.published_at).toLocaleDateString() : "N/A"} />
            <DetailRow label="Region" value={d.region || "Global"} />
          </div>
          {d.summary && (
            <div>
              <div className="text-[10px] font-bold mb-1">Summary</div>
              <p className="text-[10px] leading-relaxed bg-[hsl(var(--muted))] p-2 rounded">{d.summary}</p>
            </div>
          )}
          {d.content && (
            <div>
              <div className="text-[10px] font-bold mb-1">Full Content</div>
              <div className="text-[10px] leading-relaxed whitespace-pre-wrap">{d.content}</div>
            </div>
          )}
          {d.source_url && <a href={d.source_url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-600 hover:underline block">🔗 View original source</a>}
          <div className="text-[8px] text-[hsl(var(--muted-foreground))] border-t border-[hsl(var(--border))] pt-1">ID: {d.id}</div>
        </div>
      </Win98Window>
    );
  }

  if (win.type === "legislation") {
    return <LegislationDetailWindow d={d} offset={offset} onClose={onClose} statusColor={statusColor} />;
  }

  if (win.type === "leader") {
    return (
      <Win98Window title={`👤 ${d.name}`} onClose={onClose} defaultSize={{ width: 520, height: 420 }} defaultPosition={{ x: 150 + offset, y: 65 + offset }} minSize={{ width: 320, height: 220 }}>
        <div className="overflow-y-auto h-full p-3 bg-white text-[hsl(var(--foreground))] space-y-3">
          <h2 className="text-sm font-bold">{d.name}</h2>
          <div className="grid grid-cols-2 gap-2">
            <DetailRow label="Title" value={d.title} />
            <DetailRow label="Party" value={d.party || "Independent"} />
            <DetailRow label="In Office Since" value={d.in_office_since || "N/A"} />
            <DetailRow label="Term Ends" value={d.term_ends || "N/A"} />
          </div>
          {d.bio && (
            <div>
              <div className="text-[10px] font-bold mb-1">Biography</div>
              <p className="text-[10px] leading-relaxed whitespace-pre-wrap">{d.bio}</p>
            </div>
          )}
          {d.previous_positions && (d.previous_positions as any[]).length > 0 && (
            <div>
              <div className="text-[10px] font-bold mb-1">Previous Positions</div>
              {(d.previous_positions as any[]).map((pos: any, i: number) => (
                <div key={i} className="text-[10px] mb-0.5">• {typeof pos === "string" ? pos : pos.title || JSON.stringify(pos)}</div>
              ))}
            </div>
          )}
          {d.controversies && (d.controversies as any[]).length > 0 && (
            <div>
              <div className="text-[10px] font-bold mb-1 text-red-600">Controversies</div>
              {(d.controversies as any[]).map((c: any, i: number) => (
                <div key={i} className="text-[10px] mb-1 p-1.5 bg-red-50 rounded">{typeof c === "string" ? c : c.description || JSON.stringify(c)}</div>
              ))}
            </div>
          )}
          {d.image_url && <img src={d.image_url} alt={d.name} className="w-20 h-20 object-cover rounded" />}
          {d.tags?.length > 0 && <div className="flex flex-wrap gap-1">{d.tags.map((t: string) => <span key={t} className="text-[8px] bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded">{t}</span>)}</div>}
          <div className="text-[8px] text-[hsl(var(--muted-foreground))] border-t border-[hsl(var(--border))] pt-1">ID: {d.id}</div>
        </div>
      </Win98Window>
    );
  }

  return null;
}

function LegislationDetailWindow({ d, offset, onClose, statusColor }: { d: any; offset: number; onClose: () => void; statusColor: (s: string) => string }) {
  const [fullText, setFullText] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);
  const [showFullText, setShowFullText] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const isPdf = d.full_text_url && /\.pdf$/i.test(d.full_text_url);

  const fetchFullText = useCallback(async () => {
    if (fullText || isPdf) return;
    if (!d.full_text_url && !d.source_url) {
      // No URL to scrape — render body/summary as markdown
      const fallback = d.body && d.body.length > 10 ? d.body : d.summary || "*No full text available for this bill.*";
      setFullText(fallback);
      return;
    }
    setLoadingText(true);
    const scrapeUrl = d.full_text_url || d.source_url;
    try {
      const { data: result, error } = await supabase.functions.invoke("scrape-article", {
        body: { url: scrapeUrl },
      });
      if (!error && result?.markdown && result.markdown.length > 30) {
        setFullText(result.markdown);
      } else if (!error && result?.content) {
        setFullText(result.content);
      } else {
        // Fallback to body field
        const fallback = d.body && d.body.length > 10 ? d.body : d.summary || "*Could not fetch full text.*";
        setFullText(fallback);
      }
    } catch {
      const fallback = d.body && d.body.length > 10 ? d.body : "*Error fetching full text.*";
      setFullText(fallback);
    }
    setLoadingText(false);
  }, [d.full_text_url, d.source_url, d.body, d.summary, fullText, isPdf]);

  const handleShowFullText = useCallback(() => {
    if (isPdf) {
      setPdfUrl(d.full_text_url);
      setShowFullText(true);
    } else {
      setShowFullText(true);
      fetchFullText();
    }
  }, [isPdf, d.full_text_url, fetchFullText]);

  return (
    <Win98Window title={`📜 ${d.title?.slice(0, 45)}`} onClose={onClose} defaultSize={{ width: 640, height: 560 }} defaultPosition={{ x: 130 + offset, y: 45 + offset }} minSize={{ width: 400, height: 300 }}>
      <div className="overflow-y-auto h-full p-3 bg-white text-[hsl(var(--foreground))] space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-bold leading-tight">{d.title}</h2>
          <span className={`text-[9px] px-2 py-0.5 rounded font-medium whitespace-nowrap ${statusColor(d.status)}`}>{d.status?.replace(/_/g, " ")}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <DetailRow label="Bill Number" value={d.bill_number || "N/A"} />
          <DetailRow label="Type" value={d.bill_type} />
          <DetailRow label="Body" value={d.body || "N/A"} />
          <DetailRow label="Source" value={d.source} />
          <DetailRow label="Introduced" value={d.introduced_date || "N/A"} />
          <DetailRow label="Enacted" value={d.enacted_date || "N/A"} />
          <DetailRow label="Sponsor" value={d.sponsor || "N/A"} />
          <DetailRow label="Policy Area" value={d.policy_area || "N/A"} />
        </div>
        {d.summary && (
          <div>
            <div className="text-[10px] font-bold mb-1">Summary</div>
            <p className="text-[10px] leading-relaxed whitespace-pre-wrap">{d.summary}</p>
          </div>
        )}

        {/* Full Text Section */}
        {!showFullText && (
          <button onClick={handleShowFullText} className="win98-button text-[10px] flex items-center gap-1 px-3 py-1">
            <FileText className="h-3 w-3" /> {isPdf ? "View Full Bill (PDF)" : "Load Full Bill Text"}
          </button>
        )}

        {showFullText && isPdf && pdfUrl && (
          <div className="border border-[hsl(var(--border))] rounded">
            <div className="text-[10px] font-bold p-2 bg-[hsl(var(--muted))] border-b border-[hsl(var(--border))] flex items-center justify-between">
              <span>📄 Full Bill Text (PDF)</span>
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-600 hover:underline">Open in new tab ↗</a>
            </div>
            <iframe src={pdfUrl} className="w-full h-[400px] border-0" title="Bill PDF" />
          </div>
        )}

        {showFullText && !isPdf && (
          <div className="border border-[hsl(var(--border))] rounded">
            <div className="text-[10px] font-bold p-2 bg-[hsl(var(--muted))] border-b border-[hsl(var(--border))] flex items-center justify-between">
              <span>📄 Full Bill Text</span>
              {d.full_text_url && <a href={d.full_text_url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-600 hover:underline">Open source ↗</a>}
            </div>
            <div className="p-3 max-h-[400px] overflow-y-auto">
              {loadingText ? (
                <div className="flex items-center gap-2 text-[10px] text-[hsl(var(--muted-foreground))] py-4 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" /> Fetching full bill text…
                </div>
              ) : fullText ? (
                <div className="prose-research text-[10px] max-w-none">
                  <ReactMarkdown>{fullText}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">No text available.</p>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {d.full_text_url && <a href={d.full_text_url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-600 hover:underline flex items-center gap-0.5"><FileText className="h-3 w-3" /> Full Text (External)</a>}
          {d.source_url && <a href={d.source_url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-600 hover:underline flex items-center gap-0.5"><Globe2 className="h-3 w-3" /> Source</a>}
        </div>
        {d.tags?.length > 0 && <div className="flex flex-wrap gap-1">{d.tags.map((t: string) => <span key={t} className="text-[8px] bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded">{t}</span>)}</div>}
        <div className="text-[8px] text-[hsl(var(--muted-foreground))] border-t border-[hsl(var(--border))] pt-1">ID: {d.id}</div>
      </div>
    </Win98Window>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[10px] py-0.5 border-b border-[hsl(var(--border))]">
      <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
      <span className="font-medium text-right max-w-[60%] truncate">{value || "N/A"}</span>
    </div>
  );
}

function InfoCard({ title, items }: { title: string; items: [string, any][] }) {
  return (
    <div className="candidate-card p-3">
      <h3 className="text-[11px] font-bold mb-2">{title}</h3>
      {items.map(([label, val]) => (
        <div key={label} className="flex justify-between text-[10px] py-0.5 border-b border-[hsl(var(--border))] last:border-0">
          <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
          <span className="font-medium">{val || "N/A"}</span>
        </div>
      ))}
    </div>
  );
}
