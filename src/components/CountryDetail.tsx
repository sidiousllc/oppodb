import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Download, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCountryByCode } from "@/data/internationalCountries";
import { Win98Window } from "./Win98Window";
import { ResearchDetailWindow } from "./ResearchDetailWindow";
import { exportContentPDF } from "@/lib/contentExport";
import { CountryGeopoliticsTab } from "./CountryGeopoliticsTab";

interface CountryDetailProps {
  countryCode: string;
  onBack: () => void;
}

interface CountryData {
  profile: any | null;
  elections: any[];
  leaders: any[];
}

export function CountryDetail({ countryCode, onBack }: CountryDetailProps) {
  const country = getCountryByCode(countryCode);
  const [tab, setTab] = useState<"overview" | "government" | "geopolitics" | "elections" | "economy" | "intel">("overview");
  const [data, setData] = useState<CountryData>({ profile: null, elections: [], leaders: [] });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [reportWindow, setReportWindow] = useState(false);
  const [detail, setDetail] = useState<{ title: string; subtitle?: string; fields: Array<{ label: string; value: any }>; sourceUrl?: string | null } | null>(null);

  const openRecord = useCallback((title: string, record: Record<string, any>, opts?: { subtitle?: string; sourceUrl?: string | null }) => {
    const fields = Object.entries(record)
      .filter(([k]) => !["id", "raw_data", "country_code"].includes(k))
      .map(([k, v]) => ({ label: k.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()), value: v }));
    setDetail({ title, subtitle: opts?.subtitle, fields, sourceUrl: opts?.sourceUrl ?? null });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [profileRes, electionsRes, leadersRes] = await Promise.all([
      supabase.from("international_profiles").select("*").eq("country_code", countryCode).maybeSingle(),
      supabase.from("international_elections").select("*").eq("country_code", countryCode).order("election_year", { ascending: false }).limit(20),
      supabase.from("international_leaders").select("*").eq("country_code", countryCode),
    ]);
    setData({
      profile: profileRes.data,
      elections: electionsRes.data || [],
      leaders: leadersRes.data || [],
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
  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "government" as const, label: "Government" },
    { id: "geopolitics" as const, label: "Geopolitics" },
    { id: "elections" as const, label: "Elections" },
    { id: "economy" as const, label: "Economy" },
    { id: "intel" as const, label: "Intel" },
  ];

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
      <div className="flex gap-0.5 border-b border-[hsl(var(--border))]">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`text-[10px] px-3 py-1.5 border border-b-0 rounded-t transition-colors ${
              tab === t.id
                ? "bg-white font-bold border-[hsl(var(--border))]"
                : "bg-[hsl(var(--win98-light))] text-[hsl(var(--muted-foreground))] border-transparent hover:bg-[hsl(var(--win98-bg))]"
            }`}
          >
            {t.label}
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
              <InfoCard
                title="General"
                onView={p ? () => openRecord(`${country.name} — General`, {
                  capital: p.capital,
                  population: p.population,
                  area_sq_km: p.area_sq_km,
                  official_languages: p.official_languages,
                  currency: p.currency,
                  government_type: p.government_type,
                  continent: p.continent,
                  region: p.region,
                }) : undefined}
                items={[
                  ["Capital", p?.capital],
                  ["Population", fmt(p?.population)],
                  ["Area", p?.area_sq_km ? `${fmt(p.area_sq_km)} sq km` : "N/A"],
                  ["Languages", p?.official_languages?.join(", ")],
                  ["Currency", p?.currency],
                  ["Government", p?.government_type],
                ]}
              />
              <InfoCard
                title="Key Indicators"
                onView={p ? () => openRecord(`${country.name} — Indicators`, {
                  human_dev_index: p.human_dev_index,
                  press_freedom_rank: p.press_freedom_rank,
                  corruption_index: p.corruption_index,
                  median_age: p.median_age,
                  poverty_rate: p.poverty_rate,
                  unemployment_rate: p.unemployment_rate,
                  inflation_rate: p.inflation_rate,
                  gdp_growth_rate: p.gdp_growth_rate,
                }) : undefined}
                items={[
                  ["HDI", p?.human_dev_index?.toFixed(3)],
                  ["Press Freedom Rank", p?.press_freedom_rank ? `#${p.press_freedom_rank}` : undefined],
                  ["Corruption Index", p?.corruption_index?.toFixed(1)],
                  ["Median Age", p?.median_age?.toFixed(1)],
                ]}
              />
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
              <InfoCard
                title="Leadership"
                onView={p ? () => openRecord(`${country.name} — Leadership`, {
                  head_of_state: p.head_of_state,
                  head_of_government: p.head_of_government,
                  ruling_party: p.ruling_party,
                  opposition_parties: p.opposition_parties,
                  last_election_date: p.last_election_date,
                  next_election_date: p.next_election_date,
                  election_type: p.election_type,
                }) : undefined}
                items={[
                  ["Head of State", p?.head_of_state],
                  ["Head of Government", p?.head_of_government],
                  ["Ruling Party", p?.ruling_party],
                  ["Last Election", p?.last_election_date],
                  ["Next Election", p?.next_election_date],
                ]}
              />
              {data.leaders.length > 0 && (
                <div className="candidate-card p-3">
                  <h3 className="text-[11px] font-bold mb-2">Current Leaders</h3>
                  {data.leaders.map(l => (
                    <button
                      key={l.id}
                      onClick={() => openRecord(l.name, l, { subtitle: `${l.title}${l.party ? ` · ${l.party}` : ""}` })}
                      className="w-full text-left mb-2 pb-2 border-b border-[hsl(var(--border))] last:border-0 hover:bg-[hsl(var(--win98-light))] px-1 -mx-1 rounded transition-colors"
                    >
                      <div className="text-[11px] font-bold">{l.name}</div>
                      <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{l.title} · {l.party || "Independent"}</div>
                      {l.bio && <p className="text-[9px] mt-1 line-clamp-2">{l.bio.slice(0, 200)}…</p>}
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

          {tab === "geopolitics" && (
            <CountryGeopoliticsTab countryCode={countryCode} countryName={country.name} />
          )}

          {tab === "elections" && (
            <div className="space-y-3">
              {data.elections.length === 0 ? (
                <div className="candidate-card p-3 text-center text-[10px] text-[hsl(var(--muted-foreground))]">
                  No election data available. Sync to fetch.
                </div>
              ) : data.elections.map(e => (
                <button
                  key={e.id}
                  onClick={() => openRecord(`${e.election_year} — ${e.election_type}`, e, { subtitle: e.winner_name ? `Winner: ${e.winner_name}` : undefined, sourceUrl: e.source_url })}
                  className="candidate-card p-3 w-full text-left hover:bg-[hsl(var(--win98-light))] transition-colors"
                >
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
                </button>
              ))}
            </div>
          )}

          {tab === "economy" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoCard
                title="Economic Indicators"
                onView={p ? () => openRecord(`${country.name} — Economy`, {
                  gdp: p.gdp,
                  real_gdp: p.real_gdp,
                  gdp_per_capita: p.gdp_per_capita,
                  gdp_growth_rate: p.gdp_growth_rate,
                  unemployment_rate: p.unemployment_rate,
                  poverty_rate: p.poverty_rate,
                  inflation_rate: p.inflation_rate,
                  cpi_rate: p.cpi_rate,
                  pce_rate: p.pce_rate,
                  consumer_spending: p.consumer_spending,
                  corporate_profits: p.corporate_profits,
                  current_account_balance: p.current_account_balance,
                  fdi_inflows: p.fdi_inflows,
                  government_debt_gdp_pct: p.government_debt_gdp_pct,
                  industrial_production_index: p.industrial_production_index,
                  labor_force_participation: p.labor_force_participation,
                  stock_market_name: p.stock_market_name,
                  stock_market_index: p.stock_market_index,
                  trade_partners: p.trade_partners,
                }) : undefined}
                items={[
                  ["GDP", money(p?.gdp)],
                  ["GDP Per Capita", money(p?.gdp_per_capita)],
                  ["Unemployment", pct(p?.unemployment_rate)],
                  ["Poverty Rate", pct(p?.poverty_rate)],
                  ["Inflation", pct(p?.inflation_rate)],
                ]}
              />
              {p?.major_industries?.length > 0 && (
                <div className="candidate-card p-3">
                  <h3 className="text-[11px] font-bold mb-2">Major Industries</h3>
                  {p.major_industries.map((ind: string, i: number) => (
                    <button
                      key={i}
                      onClick={() => openRecord(ind, { industry: ind, country: country.name, region: country.region })}
                      className="w-full text-left text-[10px] flex items-center gap-1 mb-0.5 hover:bg-[hsl(var(--win98-light))] px-1 rounded"
                    >
                      <span className="text-[hsl(var(--muted-foreground))]">•</span> {ind}
                    </button>
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

      {detail && (
        <ResearchDetailWindow
          title={detail.title}
          subtitle={detail.subtitle}
          fields={detail.fields}
          sourceUrl={detail.sourceUrl}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function InfoCard({
  title,
  items,
  onView,
}: {
  title: string;
  items: [string, any][];
  onView?: () => void;
}) {
  return (
    <div className="candidate-card p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-bold">{title}</h3>
        {onView && (
          <button
            onClick={onView}
            className="win98-button text-[9px] px-2 py-[1px]"
            title="View full details"
          >
            Details
          </button>
        )}
      </div>
      {items.map(([label, val]) => (
        <div key={label} className="flex justify-between text-[10px] py-0.5 border-b border-[hsl(var(--border))] last:border-0">
          <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
          <span className="font-medium">{val || "N/A"}</span>
        </div>
      ))}
    </div>
  );
}
