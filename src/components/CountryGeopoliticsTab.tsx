import { useEffect, useState, useCallback } from "react";
import { Loader2, RefreshCw, ExternalLink, Shield, Swords, Globe2, TrendingUp, AlertTriangle, LineChart, Banknote, Zap, Award, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  countryCode: string;
  countryName: string;
}

interface AllianceEntry { name: string; type: string; status: string; joined?: string; notes?: string; }
interface ConflictEntry { party: string; type: string; status: string; since?: string; notes?: string; }
interface PartnerEntry { country: string; share_pct?: number | null; }
interface Source { title: string; url: string; category?: string; }
interface StockMarket {
  exchange_name: string;
  ticker_or_mic?: string;
  flagship_index?: string;
  listed_companies?: number;
  market_cap_usd_billions?: number;
  top_listed_companies?: string[];
  regulator?: string;
  notes?: string;
}
interface SWF { name: string; aum_usd_billions?: number; notes?: string; }

interface Brief {
  summary: string;
  alliances_blocs: AllianceEntry[];
  key_allies: string[];
  rivalries_conflicts: ConflictEntry[];
  sanctions_imposed: string[];
  sanctions_received: string[];
  intelligence_agencies?: string[];
  military: {
    spending_usd_billions?: number | null;
    spending_pct_gdp?: number | null;
    active_personnel?: number | null;
    reserve_personnel?: number | null;
    paramilitary?: number | null;
    nuclear_status?: string;
    nuclear_warheads?: number | null;
    foreign_bases_hosted?: string[];
    foreign_bases_abroad?: string[];
    sipri_arms_export_rank?: number | null;
    sipri_arms_import_rank?: number | null;
    global_firepower_rank?: number | null;
    notes?: string;
  };
  economy?: {
    gdp_nominal_usd_billions?: number | null;
    gdp_ppp_usd_billions?: number | null;
    gdp_growth_pct?: number | null;
    inflation_pct?: number | null;
    unemployment_pct?: number | null;
    public_debt_pct_gdp?: number | null;
    fx_reserves_usd_billions?: number | null;
    sovereign_credit_rating_sp?: string;
    sovereign_credit_rating_moodys?: string;
    sovereign_credit_rating_fitch?: string;
    currency_code?: string;
    currency_regime?: string;
    central_bank?: string;
    policy_rate_pct?: number | null;
    notes?: string;
  };
  stock_markets?: StockMarket[];
  sovereign_wealth_funds?: SWF[];
  trade: {
    total_exports_usd_billions?: number | null;
    total_imports_usd_billions?: number | null;
    trade_balance_usd_billions?: number | null;
    top_export_partners: PartnerEntry[];
    top_import_partners: PartnerEntry[];
    top_exports: string[];
    top_imports: string[];
    free_trade_agreements: string[];
    wto_member?: boolean;
    notes?: string;
  };
  energy_resources?: {
    oil_production_bpd?: number | null;
    oil_reserves_billion_bbl?: number | null;
    natural_gas_reserves_tcm?: number | null;
    energy_mix?: string;
    opec_member?: boolean;
    critical_minerals?: string[];
    notes?: string;
  };
  soft_power?: {
    global_soft_power_rank?: number | null;
    press_freedom_rank?: number | null;
    corruption_perception_rank?: number | null;
    democracy_index_score?: number | null;
    unhdi_rank?: number | null;
    notes?: string;
  };
  geopolitical_posture: string;
  sources: Source[];
}

const STATUS_BADGE: Record<string, string> = {
  member: "bg-green-100 text-green-900 border-green-300",
  observer: "bg-blue-100 text-blue-900 border-blue-300",
  partner: "bg-blue-100 text-blue-900 border-blue-300",
  applicant: "bg-yellow-100 text-yellow-900 border-yellow-300",
  suspended: "bg-red-100 text-red-900 border-red-300",
  active: "bg-red-100 text-red-900 border-red-300",
  escalating: "bg-red-100 text-red-900 border-red-300",
  frozen: "bg-blue-100 text-blue-900 border-blue-300",
  dormant: "bg-gray-100 text-gray-900 border-gray-300",
  resolved: "bg-green-100 text-green-900 border-green-300",
};

function badgeClass(status: string): string {
  return STATUS_BADGE[status.toLowerCase()] || "bg-gray-100 text-gray-900 border-gray-300";
}

function fmtNum(n: number | null | undefined, suffix = "", digits = 1): string {
  if (n == null || isNaN(n as number)) return "—";
  return `${(n as number).toLocaleString(undefined, { maximumFractionDigits: digits })}${suffix}`;
}

export function CountryGeopoliticsTab({ countryCode, countryName }: Props) {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  const load = useCallback(async (force = false) => {
    if (force) setRefreshing(true); else setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("geopolitics-brief", {
        body: { country_code: countryCode, force },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setBrief(data?.geopolitics || null);
      setGeneratedAt(data?.generated_at || null);
      setCached(data?.cached || false);
      if (force) toast.success("Geopolitics brief refreshed");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load geopolitics brief";
      toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [countryCode]);

  useEffect(() => { load(false); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))] p-4">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Generating deeply-sourced brief for {countryName}…
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="space-y-2 p-2">
        <div className="text-[11px] text-[hsl(var(--muted-foreground))]">No geopolitics brief available.</div>
        <button onClick={() => load(true)} className="win98-button text-[11px] px-2 py-1">Generate brief</button>
      </div>
    );
  }

  const eco = brief.economy || {};
  const energy = brief.energy_resources || {};
  const soft = brief.soft_power || {};

  return (
    <div className="space-y-3">
      <div className="win98-sunken bg-[hsl(var(--win98-light))] px-2 py-1.5 flex items-center justify-between">
        <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {cached ? "Cached" : "Freshly generated"}
          {generatedAt && ` · ${new Date(generatedAt).toLocaleDateString()}`}
          {brief.sources?.length ? ` · ${brief.sources.length} sources` : ""}
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="win98-button text-[10px] px-2 py-0.5 flex items-center gap-1 disabled:opacity-50"
        >
          {refreshing ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <RefreshCw className="h-2.5 w-2.5" />}
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Posture */}
      <section className="win98-raised bg-white p-3">
        <h3 className="text-[12px] font-bold mb-1 flex items-center gap-1"><Globe2 className="h-3 w-3" /> Geopolitical Posture</h3>
        <p className="text-[11px] leading-relaxed mb-2">{brief.summary}</p>
        <p className="text-[11px] leading-relaxed italic text-[hsl(var(--muted-foreground))]">{brief.geopolitical_posture}</p>
      </section>

      {/* Alliances */}
      <section className="win98-raised bg-white p-3">
        <h3 className="text-[12px] font-bold mb-2 flex items-center gap-1"><Shield className="h-3 w-3" /> Alliances & Blocs ({brief.alliances_blocs.length})</h3>
        {brief.alliances_blocs.length === 0 ? (
          <div className="text-[10px] text-[hsl(var(--muted-foreground))]">None recorded.</div>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {brief.alliances_blocs.map((a, i) => (
              <div key={i} className="border border-[hsl(var(--win98-shadow))] bg-[hsl(var(--win98-face))] p-1.5 text-[10px]">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="font-bold">{a.name}</span>
                  <span className={`text-[8px] px-1 py-0.5 border ${badgeClass(a.status)}`}>{a.status}</span>
                </div>
                <div className="text-[9px] text-[hsl(var(--muted-foreground))]">{a.type}{a.joined ? ` · since ${a.joined}` : ""}</div>
                {a.notes && <div className="text-[9px] mt-0.5">{a.notes}</div>}
              </div>
            ))}
          </div>
        )}
        {brief.key_allies.length > 0 && (
          <div className="mt-2 pt-2 border-t border-[hsl(var(--win98-shadow))]">
            <div className="text-[10px] font-bold mb-1">Key Allies</div>
            <div className="flex flex-wrap gap-1">
              {brief.key_allies.map((ally) => (
                <span key={ally} className="text-[10px] bg-green-50 border border-green-300 px-1.5 py-0.5">{ally}</span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Rivalries */}
      <section className="win98-raised bg-white p-3">
        <h3 className="text-[12px] font-bold mb-2 flex items-center gap-1"><Swords className="h-3 w-3" /> Rivalries & Conflicts ({brief.rivalries_conflicts.length})</h3>
        {brief.rivalries_conflicts.length === 0 ? (
          <div className="text-[10px] text-[hsl(var(--muted-foreground))]">No active rivalries recorded.</div>
        ) : (
          <div className="space-y-1">
            {brief.rivalries_conflicts.map((c, i) => (
              <div key={i} className="border border-[hsl(var(--win98-shadow))] bg-[hsl(var(--win98-face))] p-1.5 text-[10px]">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="font-bold">vs. {c.party}</span>
                  <span className={`text-[8px] px-1 py-0.5 border ${badgeClass(c.status)}`}>{c.status}</span>
                </div>
                <div className="text-[9px] text-[hsl(var(--muted-foreground))]">{c.type}{c.since ? ` · since ${c.since}` : ""}</div>
                {c.notes && <div className="text-[9px] mt-0.5">{c.notes}</div>}
              </div>
            ))}
          </div>
        )}
        {(brief.sanctions_imposed.length > 0 || brief.sanctions_received.length > 0) && (
          <div className="mt-2 pt-2 border-t border-[hsl(var(--win98-shadow))] grid gap-2 sm:grid-cols-2">
            {brief.sanctions_imposed.length > 0 && (
              <div>
                <div className="text-[10px] font-bold mb-1 flex items-center gap-1"><AlertTriangle className="h-2.5 w-2.5" /> Sanctions Imposed</div>
                <ul className="space-y-0.5">{brief.sanctions_imposed.map((s, i) => <li key={i} className="text-[9px]">• {s}</li>)}</ul>
              </div>
            )}
            {brief.sanctions_received.length > 0 && (
              <div>
                <div className="text-[10px] font-bold mb-1 flex items-center gap-1"><AlertTriangle className="h-2.5 w-2.5" /> Sanctions Received</div>
                <ul className="space-y-0.5">{brief.sanctions_received.map((s, i) => <li key={i} className="text-[9px]">• {s}</li>)}</ul>
              </div>
            )}
          </div>
        )}
        {brief.intelligence_agencies && brief.intelligence_agencies.length > 0 && (
          <div className="mt-2 pt-2 border-t border-[hsl(var(--win98-shadow))]">
            <div className="text-[10px] font-bold mb-1 flex items-center gap-1"><Eye className="h-2.5 w-2.5" /> Intelligence Agencies</div>
            <div className="text-[10px]">{brief.intelligence_agencies.join(", ")}</div>
          </div>
        )}
      </section>

      {/* Military */}
      <section className="win98-raised bg-white p-3">
        <h3 className="text-[12px] font-bold mb-2 flex items-center gap-1"><Shield className="h-3 w-3" /> Military & Defense</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
          <Stat label="Spending" value={fmtNum(brief.military.spending_usd_billions, "B USD")} />
          <Stat label="% of GDP" value={fmtNum(brief.military.spending_pct_gdp, "%", 2)} />
          <Stat label="Active" value={fmtNum(brief.military.active_personnel, "", 0)} />
          <Stat label="Reserve" value={fmtNum(brief.military.reserve_personnel, "", 0)} />
          <Stat label="Paramilitary" value={fmtNum(brief.military.paramilitary, "", 0)} />
          <Stat label="Nuclear" value={brief.military.nuclear_status || "—"} />
          <Stat label="Warheads" value={fmtNum(brief.military.nuclear_warheads, "", 0)} />
          <Stat label="SIPRI Export #" value={brief.military.sipri_arms_export_rank ? `#${brief.military.sipri_arms_export_rank}` : "—"} />
          <Stat label="GFP Rank" value={brief.military.global_firepower_rank ? `#${brief.military.global_firepower_rank}` : "—"} />
        </div>
        {(brief.military.foreign_bases_hosted?.length || 0) > 0 && (
          <div className="mt-2"><div className="text-[10px] font-bold">Foreign Bases Hosted</div><div className="text-[10px]">{brief.military.foreign_bases_hosted!.join(", ")}</div></div>
        )}
        {(brief.military.foreign_bases_abroad?.length || 0) > 0 && (
          <div className="mt-1"><div className="text-[10px] font-bold">Bases Abroad</div><div className="text-[10px]">{brief.military.foreign_bases_abroad!.join(", ")}</div></div>
        )}
        {brief.military.notes && <div className="text-[10px] italic text-[hsl(var(--muted-foreground))] mt-1">{brief.military.notes}</div>}
      </section>

      {/* Economy */}
      <section className="win98-raised bg-white p-3">
        <h3 className="text-[12px] font-bold mb-2 flex items-center gap-1"><Banknote className="h-3 w-3" /> Macroeconomy</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
          <Stat label="GDP (nominal)" value={fmtNum(eco.gdp_nominal_usd_billions, "B USD")} />
          <Stat label="GDP (PPP)" value={fmtNum(eco.gdp_ppp_usd_billions, "B USD")} />
          <Stat label="Growth" value={fmtNum(eco.gdp_growth_pct, "%", 1)} />
          <Stat label="Inflation" value={fmtNum(eco.inflation_pct, "%", 1)} />
          <Stat label="Unemployment" value={fmtNum(eco.unemployment_pct, "%", 1)} />
          <Stat label="Debt/GDP" value={fmtNum(eco.public_debt_pct_gdp, "%", 1)} />
          <Stat label="FX Reserves" value={fmtNum(eco.fx_reserves_usd_billions, "B USD")} />
          <Stat label="Policy Rate" value={fmtNum(eco.policy_rate_pct, "%", 2)} />
          <Stat label="Currency" value={eco.currency_code || "—"} />
          <Stat label="Regime" value={eco.currency_regime || "—"} />
          <Stat label="S&P" value={eco.sovereign_credit_rating_sp || "—"} />
          <Stat label="Moody's" value={eco.sovereign_credit_rating_moodys || "—"} />
          <Stat label="Fitch" value={eco.sovereign_credit_rating_fitch || "—"} />
          <Stat label="Central Bank" value={eco.central_bank || "—"} />
        </div>
        {eco.notes && <div className="text-[10px] italic text-[hsl(var(--muted-foreground))] mt-2">{eco.notes}</div>}
      </section>

      {/* Stock markets */}
      {brief.stock_markets && brief.stock_markets.length > 0 && (
        <section className="win98-raised bg-white p-3">
          <h3 className="text-[12px] font-bold mb-2 flex items-center gap-1"><LineChart className="h-3 w-3" /> Stock Markets ({brief.stock_markets.length})</h3>
          <div className="space-y-1.5">
            {brief.stock_markets.map((m, i) => (
              <div key={i} className="border border-[hsl(var(--win98-shadow))] bg-[hsl(var(--win98-face))] p-1.5 text-[10px]">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="font-bold">{m.exchange_name}</span>
                  {m.ticker_or_mic && <span className="text-[9px] text-[hsl(var(--muted-foreground))]">{m.ticker_or_mic}</span>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 mt-1">
                  {m.flagship_index && <Stat label="Index" value={m.flagship_index} />}
                  {m.market_cap_usd_billions != null && <Stat label="Mkt Cap" value={fmtNum(m.market_cap_usd_billions, "B USD")} />}
                  {m.listed_companies != null && <Stat label="Listings" value={fmtNum(m.listed_companies, "", 0)} />}
                  {m.regulator && <Stat label="Regulator" value={m.regulator} />}
                </div>
                {m.top_listed_companies && m.top_listed_companies.length > 0 && (
                  <div className="mt-1 text-[9px]"><span className="font-bold">Top listings: </span>{m.top_listed_companies.join(", ")}</div>
                )}
                {m.notes && <div className="text-[9px] italic mt-0.5">{m.notes}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sovereign Wealth Funds */}
      {brief.sovereign_wealth_funds && brief.sovereign_wealth_funds.length > 0 && (
        <section className="win98-raised bg-white p-3">
          <h3 className="text-[12px] font-bold mb-2">Sovereign Wealth Funds ({brief.sovereign_wealth_funds.length})</h3>
          <div className="grid gap-1 sm:grid-cols-2">
            {brief.sovereign_wealth_funds.map((s, i) => (
              <div key={i} className="border border-[hsl(var(--win98-shadow))] bg-[hsl(var(--win98-face))] p-1.5 text-[10px]">
                <div className="flex justify-between"><span className="font-bold">{s.name}</span>{s.aum_usd_billions != null && <span>{fmtNum(s.aum_usd_billions, "B")}</span>}</div>
                {s.notes && <div className="text-[9px] mt-0.5">{s.notes}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Trade */}
      <section className="win98-raised bg-white p-3">
        <h3 className="text-[12px] font-bold mb-2 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Trade & Economics</h3>
        <div className="grid grid-cols-3 gap-2 text-[10px] mb-2">
          <Stat label="Total Exports" value={fmtNum(brief.trade.total_exports_usd_billions, "B USD")} />
          <Stat label="Total Imports" value={fmtNum(brief.trade.total_imports_usd_billions, "B USD")} />
          <Stat label="Balance" value={fmtNum(brief.trade.trade_balance_usd_billions, "B USD")} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <PartnerList title="Top Export Partners" partners={brief.trade.top_export_partners} />
          <PartnerList title="Top Import Partners" partners={brief.trade.top_import_partners} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 mt-2">
          {brief.trade.top_exports.length > 0 && (
            <div><div className="text-[10px] font-bold mb-0.5">Top Exports</div><div className="text-[10px]">{brief.trade.top_exports.join(", ")}</div></div>
          )}
          {brief.trade.top_imports.length > 0 && (
            <div><div className="text-[10px] font-bold mb-0.5">Top Imports</div><div className="text-[10px]">{brief.trade.top_imports.join(", ")}</div></div>
          )}
        </div>
        {brief.trade.free_trade_agreements.length > 0 && (
          <div className="mt-2">
            <div className="text-[10px] font-bold mb-1">Free Trade Agreements {brief.trade.wto_member ? "· WTO member" : ""}</div>
            <div className="flex flex-wrap gap-1">
              {brief.trade.free_trade_agreements.map((a) => <span key={a} className="text-[10px] bg-blue-50 border border-blue-300 px-1.5 py-0.5">{a}</span>)}
            </div>
          </div>
        )}
        {brief.trade.notes && <div className="text-[10px] italic text-[hsl(var(--muted-foreground))] mt-2">{brief.trade.notes}</div>}
      </section>

      {/* Energy & Resources */}
      {(energy.oil_production_bpd != null || energy.energy_mix || (energy.critical_minerals?.length || 0) > 0) && (
        <section className="win98-raised bg-white p-3">
          <h3 className="text-[12px] font-bold mb-2 flex items-center gap-1"><Zap className="h-3 w-3" /> Energy & Resources</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
            <Stat label="Oil prod (bpd)" value={fmtNum(energy.oil_production_bpd, "", 0)} />
            <Stat label="Oil reserves" value={fmtNum(energy.oil_reserves_billion_bbl, "B bbl")} />
            <Stat label="Gas reserves" value={fmtNum(energy.natural_gas_reserves_tcm, " tcm", 2)} />
            <Stat label="OPEC" value={energy.opec_member ? "Yes" : "No"} />
          </div>
          {energy.energy_mix && <div className="text-[10px] mt-1"><span className="font-bold">Energy mix: </span>{energy.energy_mix}</div>}
          {energy.critical_minerals && energy.critical_minerals.length > 0 && (
            <div className="text-[10px] mt-1"><span className="font-bold">Critical minerals: </span>{energy.critical_minerals.join(", ")}</div>
          )}
          {energy.notes && <div className="text-[10px] italic text-[hsl(var(--muted-foreground))] mt-1">{energy.notes}</div>}
        </section>
      )}

      {/* Soft power */}
      {(soft.global_soft_power_rank != null || soft.press_freedom_rank != null || soft.corruption_perception_rank != null) && (
        <section className="win98-raised bg-white p-3">
          <h3 className="text-[12px] font-bold mb-2 flex items-center gap-1"><Award className="h-3 w-3" /> Soft Power & Governance Indices</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
            <Stat label="Soft Power Rank" value={soft.global_soft_power_rank ? `#${soft.global_soft_power_rank}` : "—"} />
            <Stat label="Press Freedom (RSF)" value={soft.press_freedom_rank ? `#${soft.press_freedom_rank}` : "—"} />
            <Stat label="Corruption (TI)" value={soft.corruption_perception_rank ? `#${soft.corruption_perception_rank}` : "—"} />
            <Stat label="Democracy Index" value={fmtNum(soft.democracy_index_score, "/10", 2)} />
            <Stat label="UN HDI Rank" value={soft.unhdi_rank ? `#${soft.unhdi_rank}` : "—"} />
          </div>
          {soft.notes && <div className="text-[10px] italic text-[hsl(var(--muted-foreground))] mt-1">{soft.notes}</div>}
        </section>
      )}

      {/* Sources */}
      <section className="win98-raised bg-white p-3">
        <h3 className="text-[12px] font-bold mb-2">Sources ({brief.sources.length})</h3>
        <ol className="space-y-0.5 list-decimal list-inside">
          {brief.sources.map((s, i) => (
            <li key={i} className="text-[10px]">
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline inline-flex items-center gap-0.5">
                {s.title}
                <ExternalLink className="h-2 w-2" />
              </a>
              {s.category && <span className="text-[9px] text-[hsl(var(--muted-foreground))] ml-1">· {s.category}</span>}
            </li>
          ))}
        </ol>
        <div className="text-[9px] text-[hsl(var(--muted-foreground))] italic mt-2">
          AI-synthesized from Wikipedia, World Bank, REST Countries, Wikidata, and the listed authoritative sources. Verify critical facts before operational use.
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="win98-sunken bg-[hsl(var(--win98-light))] p-1.5">
      <div className="text-[9px] text-[hsl(var(--muted-foreground))]">{label}</div>
      <div className="text-[11px] font-bold truncate" title={value}>{value}</div>
    </div>
  );
}

function PartnerList({ title, partners }: { title: string; partners: PartnerEntry[] }) {
  if (partners.length === 0) return null;
  return (
    <div>
      <div className="text-[10px] font-bold mb-1">{title}</div>
      <div className="space-y-0.5">
        {partners.map((p, i) => (
          <div key={i} className="flex justify-between text-[10px] bg-[hsl(var(--win98-face))] px-1.5 py-0.5 border border-[hsl(var(--win98-shadow))]">
            <span>{p.country}</span>
            {p.share_pct != null && <span className="font-bold">{p.share_pct.toFixed(1)}%</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
