import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Download, Loader2, RefreshCw, Scale, AlertTriangle, FileText, Globe2 } from "lucide-react";
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
}

type TabId = "overview" | "government" | "elections" | "economy" | "legislation" | "issues" | "intel";

export function CountryDetail({ countryCode, onBack }: CountryDetailProps) {
  const country = getCountryByCode(countryCode);
  const [tab, setTab] = useState<TabId>("overview");
  const [data, setData] = useState<CountryData>({ profile: null, elections: [], leaders: [], legislation: [], policyIssues: [] });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [reportWindow, setReportWindow] = useState(false);
  const [legFilter, setLegFilter] = useState<string>("all");
  const [issueFilter, setIssueFilter] = useState<string>("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [profileRes, electionsRes, leadersRes, legRes, issuesRes] = await Promise.all([
      supabase.from("international_profiles").select("*").eq("country_code", countryCode).maybeSingle(),
      supabase.from("international_elections").select("*").eq("country_code", countryCode).order("election_year", { ascending: false }).limit(20),
      supabase.from("international_leaders").select("*").eq("country_code", countryCode),
      supabase.from("international_legislation").select("*").eq("country_code", countryCode).order("introduced_date", { ascending: false }).limit(100),
      supabase.from("international_policy_issues").select("*").eq("country_code", countryCode).order("created_at", { ascending: false }).limit(100),
    ]);
    setData({
      profile: profileRes.data,
      elections: electionsRes.data || [],
      leaders: leadersRes.data || [],
      legislation: legRes.data || [],
      policyIssues: issuesRes.data || [],
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
      lines.push("## Demographics");
      lines.push(`- **Median Age:** ${p.median_age ?? "N/A"}`);
      lines.push(`- **GDP:** ${money(p.gdp)}`);
      lines.push(`- **GDP Per Capita:** ${money(p.gdp_per_capita)}`);
      lines.push(`- **Unemployment:** ${pct(p.unemployment_rate)}`);
      lines.push(`- **Poverty Rate:** ${pct(p.poverty_rate)}`);
      lines.push(`- **Inflation:** ${pct(p.inflation_rate)}`);
      lines.push("");
      lines.push("## Governance & Transparency");
      lines.push(`- **Head of State:** ${p.head_of_state || "N/A"}`);
      lines.push(`- **Head of Government:** ${p.head_of_government || "N/A"}`);
      lines.push(`- **Ruling Party:** ${p.ruling_party || "N/A"}`);
      lines.push(`- **Human Development Index:** ${p.human_dev_index ?? "N/A"}`);
      lines.push(`- **Press Freedom Rank:** ${p.press_freedom_rank ?? "N/A"}`);
      lines.push(`- **Corruption Perception Index:** ${p.corruption_index ?? "N/A"}`);
      lines.push("");
      if (p.major_industries?.length) {
        lines.push("## Major Industries");
        for (const ind of p.major_industries) lines.push(`- ${ind}`);
        lines.push("");
      }
    } else {
      lines.push("No profile data available. Click **Sync Data** to fetch latest information.");
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

    if (data.legislation.length > 0) {
      lines.push("## Key Legislation");
      for (const l of data.legislation.slice(0, 15)) {
        lines.push(`### ${l.title}`);
        lines.push(`- **Type:** ${l.bill_type} | **Status:** ${l.status}`);
        if (l.body) lines.push(`- **Body:** ${l.body}`);
        if (l.introduced_date) lines.push(`- **Introduced:** ${l.introduced_date}`);
        if (l.summary) lines.push(l.summary);
        lines.push("");
      }
    }

    if (data.policyIssues.length > 0) {
      lines.push("## Active Policy Issues");
      for (const issue of data.policyIssues.slice(0, 15)) {
        lines.push(`### ${issue.title}`);
        lines.push(`- **Category:** ${issue.category} | **Severity:** ${issue.severity} | **Status:** ${issue.status}`);
        if (issue.description) lines.push(issue.description);
        lines.push("");
      }
    }

    if (data.elections.length > 0) {
      lines.push("## Election History");
      for (const e of data.elections) {
        lines.push(`### ${e.election_year} — ${e.election_type}`);
        if (e.winner_name) lines.push(`- **Winner:** ${e.winner_name} (${e.winner_party || "N/A"})`);
        if (e.turnout_pct) lines.push(`- **Turnout:** ${pct(e.turnout_pct)}`);
        if (e.source) lines.push(`- **Source:** ${e.source}`);
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
    { id: "intel", label: "Intel" },
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
              {/* Quick stats summary */}
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
                    <div key={l.id} className="mb-2 pb-2 border-b border-[hsl(var(--border))] last:border-0">
                      <div className="text-[11px] font-bold">{l.name}</div>
                      <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{l.title} · {l.party || "Independent"}</div>
                      {l.bio && <p className="text-[9px] mt-1">{l.bio.slice(0, 200)}…</p>}
                    </div>
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
              {/* Filter bar */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={legFilter}
                  onChange={e => setLegFilter(e.target.value)}
                  className="win98-sunken text-[10px] px-2 py-1 bg-white"
                >
                  <option value="all">All Types</option>
                  {legTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  <optgroup label="Source">
                    {legSources.map(s => <option key={s} value={s}>{s}</option>)}
                  </optgroup>
                </select>
                <span className="text-[9px] text-[hsl(var(--muted-foreground))]">
                  {filteredLegislation.length} items
                </span>
              </div>

              {filteredLegislation.length === 0 ? (
                <div className="candidate-card p-4 text-center">
                  <Scale className="h-6 w-6 mx-auto mb-2 text-[hsl(var(--muted-foreground))]" />
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] mb-2">
                    No legislation data available for {country.name}.
                  </p>
                  <button onClick={handleSync} className="win98-button text-[10px] px-3 py-1">
                    <RefreshCw className="h-3 w-3 inline mr-1" /> Sync Legislation
                  </button>
                </div>
              ) : filteredLegislation.map(l => (
                <div key={l.id} className="candidate-card p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1">
                      <div className="text-[11px] font-bold leading-tight">{l.title}</div>
                      {l.bill_number && (
                        <span className="text-[9px] text-[hsl(var(--muted-foreground))]">{l.bill_number}</span>
                      )}
                    </div>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${statusColor(l.status)}`}>
                      {l.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-[hsl(var(--muted-foreground))] mb-1 flex-wrap">
                    <span className="bg-[hsl(var(--muted))] px-1 rounded">{l.bill_type}</span>
                    {l.body && <span>📜 {l.body}</span>}
                    {l.source && l.source !== "national" && <span>🏛️ {l.source}</span>}
                    {l.policy_area && <span>📋 {l.policy_area}</span>}
                    {l.introduced_date && <span>📅 {l.introduced_date}</span>}
                    {l.sponsor && <span>👤 {l.sponsor}</span>}
                  </div>
                  {l.summary && (
                    <p className="text-[10px] leading-relaxed mt-1">{l.summary.slice(0, 300)}{l.summary.length > 300 ? "…" : ""}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    {l.full_text_url && (
                      <a href={l.full_text_url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-600 hover:underline flex items-center gap-0.5">
                        <FileText className="h-3 w-3" /> Full Text
                      </a>
                    )}
                    {l.source_url && (
                      <a href={l.source_url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-600 hover:underline flex items-center gap-0.5">
                        <Globe2 className="h-3 w-3" /> Source
                      </a>
                    )}
                    {l.tags?.length > 0 && (
                      <div className="flex gap-0.5 flex-wrap ml-auto">
                        {l.tags.slice(0, 4).map((tag: string) => (
                          <span key={tag} className="text-[8px] bg-[hsl(var(--muted))] px-1 rounded">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "issues" && (
            <div className="space-y-3">
              {/* Filter bar */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={issueFilter}
                  onChange={e => setIssueFilter(e.target.value)}
                  className="win98-sunken text-[10px] px-2 py-1 bg-white"
                >
                  <option value="all">All Categories</option>
                  {issueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  <optgroup label="Severity">
                    {["critical", "high", "medium", "low"].map(s => <option key={s} value={s}>{s}</option>)}
                  </optgroup>
                </select>
                <span className="text-[9px] text-[hsl(var(--muted-foreground))]">
                  {filteredIssues.length} issues
                </span>
              </div>

              {filteredIssues.length === 0 ? (
                <div className="candidate-card p-4 text-center">
                  <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-[hsl(var(--muted-foreground))]" />
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] mb-2">
                    No policy issues tracked for {country.name}.
                  </p>
                  <button onClick={handleSync} className="win98-button text-[10px] px-3 py-1">
                    <RefreshCw className="h-3 w-3 inline mr-1" /> Sync Issues
                  </button>
                </div>
              ) : filteredIssues.map(issue => (
                <div key={issue.id} className="candidate-card p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="text-[11px] font-bold leading-tight flex-1">{issue.title}</div>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap ${severityColor(issue.severity)}`}>
                      {issue.severity.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-[hsl(var(--muted-foreground))] mb-1 flex-wrap">
                    <span className="bg-[hsl(var(--muted))] px-1 rounded">{issue.category}</span>
                    <span className={`px-1 rounded ${issue.status === "escalating" ? "bg-red-100 text-red-700" : issue.status === "resolved" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                      {issue.status}
                    </span>
                    {issue.started_date && <span>📅 Since {issue.started_date}</span>}
                  </div>
                  {issue.description && (
                    <p className="text-[10px] leading-relaxed mt-1">{issue.description.slice(0, 400)}{issue.description.length > 400 ? "…" : ""}</p>
                  )}
                  {issue.sources?.length > 0 && (
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      {(issue.sources as any[]).slice(0, 3).map((src: any, i: number) => (
                        <a key={i} href={src.url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-600 hover:underline">
                          📰 {src.name || "Source"}
                        </a>
                      ))}
                    </div>
                  )}
                  {issue.tags?.length > 0 && (
                    <div className="flex gap-0.5 mt-1 flex-wrap">
                      {issue.tags.slice(0, 5).map((tag: string) => (
                        <span key={tag} className="text-[8px] bg-[hsl(var(--muted))] px-1 rounded">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
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
                <div key={e.id} className="candidate-card p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold">{e.election_year} — {e.election_type}</span>
                    {e.election_date && <span className="text-[9px] text-[hsl(var(--muted-foreground))]">{e.election_date}</span>}
                  </div>
                  {e.winner_name && (
                    <div className="text-[10px]">
                      <strong>Winner:</strong> {e.winner_name} ({e.winner_party || "N/A"})
                    </div>
                  )}
                  {e.turnout_pct != null && <div className="text-[10px]"><strong>Turnout:</strong> {pct(e.turnout_pct)}</div>}
                  {e.source && <div className="text-[9px] text-[hsl(var(--muted-foreground))] mt-1">Source: {e.source}</div>}
                </div>
              ))}
            </div>
          )}

          {tab === "economy" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoCard title="Economic Indicators" items={[
                ["GDP", money(p?.gdp)],
                ["GDP Per Capita", money(p?.gdp_per_capita)],
                ["Unemployment", pct(p?.unemployment_rate)],
                ["Poverty Rate", pct(p?.poverty_rate)],
                ["Inflation", pct(p?.inflation_rate)],
              ]} />
              {p?.major_industries?.length > 0 && (
                <div className="candidate-card p-3">
                  <h3 className="text-[11px] font-bold mb-2">Major Industries</h3>
                  {p.major_industries.map((ind: string, i: number) => (
                    <div key={i} className="text-[10px] flex items-center gap-1 mb-0.5">
                      <span className="text-[hsl(var(--muted-foreground))]">•</span> {ind}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "intel" && (
            <div className="candidate-card p-3 text-center text-[10px] text-[hsl(var(--muted-foreground))]">
              Intel briefings for {country.name} will appear here once synced from international news sources.
              <br />
              <button onClick={handleSync} className="win98-button text-[10px] px-3 py-1 mt-2">
                <RefreshCw className="h-3 w-3 inline mr-1" /> Sync Intel
              </button>
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
