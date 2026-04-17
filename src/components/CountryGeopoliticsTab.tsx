import { useEffect, useState, useCallback } from "react";
import { Loader2, RefreshCw, ExternalLink, Shield, Swords, Globe2, TrendingUp, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  countryCode: string;
  countryName: string;
}

interface AllianceEntry { name: string; type: string; status: string; notes?: string; }
interface ConflictEntry { party: string; type: string; status: string; since?: string; notes?: string; }
interface PartnerEntry { country: string; share_pct?: number | null; }
interface Source { title: string; url: string; }

interface Brief {
  summary: string;
  alliances_blocs: AllianceEntry[];
  key_allies: string[];
  rivalries_conflicts: ConflictEntry[];
  sanctions_imposed: string[];
  sanctions_received: string[];
  military: {
    spending_usd_billions?: number | null;
    spending_pct_gdp?: number | null;
    active_personnel?: number | null;
    nuclear_status?: string;
    foreign_bases_hosted?: string[];
    foreign_bases_abroad?: string[];
    sipri_arms_export_rank?: number | null;
    notes?: string;
  };
  trade: {
    top_export_partners: PartnerEntry[];
    top_import_partners: PartnerEntry[];
    top_exports: string[];
    top_imports: string[];
    free_trade_agreements: string[];
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
  frozen: "bg-blue-100 text-blue-900 border-blue-300",
  dormant: "bg-gray-100 text-gray-900 border-gray-300",
  resolved: "bg-green-100 text-green-900 border-green-300",
};

function badgeClass(status: string): string {
  return STATUS_BADGE[status.toLowerCase()] || "bg-gray-100 text-gray-900 border-gray-300";
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
        Generating geopolitical brief for {countryName}…
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

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="win98-sunken bg-[hsl(var(--win98-light))] px-2 py-1.5 flex items-center justify-between">
        <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {cached ? "Cached" : "Freshly generated"}
          {generatedAt && ` · ${new Date(generatedAt).toLocaleDateString()}`}
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

      {/* Posture summary */}
      <section className="win98-raised bg-white p-3">
        <h3 className="text-[12px] font-bold mb-1 flex items-center gap-1">
          <Globe2 className="h-3 w-3" /> Geopolitical Posture
        </h3>
        <p className="text-[11px] leading-relaxed text-[hsl(var(--foreground))] mb-2">{brief.summary}</p>
        <p className="text-[11px] leading-relaxed italic text-[hsl(var(--muted-foreground))]">{brief.geopolitical_posture}</p>
      </section>

      {/* Alliances & blocs */}
      <section className="win98-raised bg-white p-3">
        <h3 className="text-[12px] font-bold mb-2 flex items-center gap-1">
          <Shield className="h-3 w-3" /> Alliances & Blocs ({brief.alliances_blocs.length})
        </h3>
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
                <div className="text-[9px] text-[hsl(var(--muted-foreground))]">{a.type}</div>
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

      {/* Rivalries & conflicts */}
      <section className="win98-raised bg-white p-3">
        <h3 className="text-[12px] font-bold mb-2 flex items-center gap-1">
          <Swords className="h-3 w-3" /> Rivalries & Conflicts ({brief.rivalries_conflicts.length})
        </h3>
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
                <div className="text-[9px] text-[hsl(var(--muted-foreground))]">
                  {c.type}{c.since ? ` · since ${c.since}` : ""}
                </div>
                {c.notes && <div className="text-[9px] mt-0.5">{c.notes}</div>}
              </div>
            ))}
          </div>
        )}
        {(brief.sanctions_imposed.length > 0 || brief.sanctions_received.length > 0) && (
          <div className="mt-2 pt-2 border-t border-[hsl(var(--win98-shadow))] grid gap-2 sm:grid-cols-2">
            {brief.sanctions_imposed.length > 0 && (
              <div>
                <div className="text-[10px] font-bold mb-1 flex items-center gap-1">
                  <AlertTriangle className="h-2.5 w-2.5" /> Sanctions Imposed
                </div>
                <ul className="space-y-0.5">
                  {brief.sanctions_imposed.map((s, i) => (
                    <li key={i} className="text-[9px]">• {s}</li>
                  ))}
                </ul>
              </div>
            )}
            {brief.sanctions_received.length > 0 && (
              <div>
                <div className="text-[10px] font-bold mb-1 flex items-center gap-1">
                  <AlertTriangle className="h-2.5 w-2.5" /> Sanctions Received
                </div>
                <ul className="space-y-0.5">
                  {brief.sanctions_received.map((s, i) => (
                    <li key={i} className="text-[9px]">• {s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Military */}
      <section className="win98-raised bg-white p-3">
        <h3 className="text-[12px] font-bold mb-2 flex items-center gap-1">
          <Shield className="h-3 w-3" /> Military & Defense
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
          <Stat label="Spending" value={brief.military.spending_usd_billions != null ? `$${brief.military.spending_usd_billions.toFixed(1)}B` : "—"} />
          <Stat label="% of GDP" value={brief.military.spending_pct_gdp != null ? `${brief.military.spending_pct_gdp.toFixed(2)}%` : "—"} />
          <Stat label="Active Personnel" value={brief.military.active_personnel != null ? brief.military.active_personnel.toLocaleString() : "—"} />
          <Stat label="Nuclear Status" value={brief.military.nuclear_status || "—"} />
          <Stat label="SIPRI Arms Export Rank" value={brief.military.sipri_arms_export_rank != null ? `#${brief.military.sipri_arms_export_rank}` : "—"} />
        </div>
        {(brief.military.foreign_bases_hosted?.length || 0) > 0 && (
          <div className="mt-2">
            <div className="text-[10px] font-bold">Foreign Bases Hosted</div>
            <div className="text-[10px]">{brief.military.foreign_bases_hosted!.join(", ")}</div>
          </div>
        )}
        {(brief.military.foreign_bases_abroad?.length || 0) > 0 && (
          <div className="mt-1">
            <div className="text-[10px] font-bold">Bases Abroad</div>
            <div className="text-[10px]">{brief.military.foreign_bases_abroad!.join(", ")}</div>
          </div>
        )}
        {brief.military.notes && <div className="text-[10px] italic text-[hsl(var(--muted-foreground))] mt-1">{brief.military.notes}</div>}
      </section>

      {/* Trade */}
      <section className="win98-raised bg-white p-3">
        <h3 className="text-[12px] font-bold mb-2 flex items-center gap-1">
          <TrendingUp className="h-3 w-3" /> Trade & Economics
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <PartnerList title="Top Export Partners" partners={brief.trade.top_export_partners} />
          <PartnerList title="Top Import Partners" partners={brief.trade.top_import_partners} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 mt-2">
          {brief.trade.top_exports.length > 0 && (
            <div>
              <div className="text-[10px] font-bold mb-0.5">Top Exports</div>
              <div className="text-[10px]">{brief.trade.top_exports.join(", ")}</div>
            </div>
          )}
          {brief.trade.top_imports.length > 0 && (
            <div>
              <div className="text-[10px] font-bold mb-0.5">Top Imports</div>
              <div className="text-[10px]">{brief.trade.top_imports.join(", ")}</div>
            </div>
          )}
        </div>
        {brief.trade.free_trade_agreements.length > 0 && (
          <div className="mt-2">
            <div className="text-[10px] font-bold mb-1">Free Trade Agreements</div>
            <div className="flex flex-wrap gap-1">
              {brief.trade.free_trade_agreements.map((a) => (
                <span key={a} className="text-[10px] bg-blue-50 border border-blue-300 px-1.5 py-0.5">{a}</span>
              ))}
            </div>
          </div>
        )}
        {brief.trade.notes && <div className="text-[10px] italic text-[hsl(var(--muted-foreground))] mt-2">{brief.trade.notes}</div>}
      </section>

      {/* Sources */}
      <section className="win98-raised bg-white p-3">
        <h3 className="text-[12px] font-bold mb-2">Sources ({brief.sources.length})</h3>
        <ol className="space-y-0.5 list-decimal list-inside">
          {brief.sources.map((s, i) => (
            <li key={i} className="text-[10px]">
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 hover:underline inline-flex items-center gap-0.5"
              >
                {s.title}
                <ExternalLink className="h-2 w-2" />
              </a>
            </li>
          ))}
        </ol>
        <div className="text-[9px] text-[hsl(var(--muted-foreground))] italic mt-2">
          AI-generated brief synthesized from public sources. Verify critical facts before operational use.
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="win98-sunken bg-[hsl(var(--win98-light))] p-1.5">
      <div className="text-[9px] text-[hsl(var(--muted-foreground))]">{label}</div>
      <div className="text-[11px] font-bold">{value}</div>
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
