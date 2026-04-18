import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { toast } from "sonner";
import { Loader2, Search, ExternalLink, Download, ArrowLeft, Eye } from "lucide-react";
import { ResearchDetailWindow } from "./ResearchDetailWindow";

interface InvestigationsPanelProps {
  onBack?: () => void;
}

type Row = Record<string, any> & { id: string };

const SOURCES: Record<
  string,
  {
    label: string;
    table: string;
    orderBy: string;
    syncFn?: string;
    syncQueryParam?: string;
    description: string;
    nameField: string;
    subtitleField?: string;
    sourceUrlField?: string;
  }
> = {
  lobbying: {
    label: "Lobbying (LDA)",
    table: "lobbying_disclosures",
    orderBy: "filing_date",
    syncFn: "lobbying-sync",
    description: "U.S. Senate Lobbying Disclosure Act filings",
    nameField: "registrant_name",
    subtitleField: "client_name",
    sourceUrlField: "source_url",
  },
  contracts: {
    label: "Federal Contracts",
    table: "gov_contracts",
    orderBy: "award_amount",
    syncFn: "contracts-sync",
    syncQueryParam: "recipient",
    description: "USAspending.gov federal contract awards",
    nameField: "recipient_name",
    subtitleField: "awarding_agency",
    sourceUrlField: "source_url",
  },
  cases: {
    label: "Federal Court Cases",
    table: "court_cases",
    orderBy: "filed_date",
    syncFn: "court-cases-sync",
    syncQueryParam: "q",
    description: "CourtListener federal & appellate dockets",
    nameField: "case_name",
    subtitleField: "court",
    sourceUrlField: "docket_url",
  },
  fara: {
    label: "FARA Registrants",
    table: "fara_registrants",
    orderBy: "registration_date",
    syncFn: "investigations-sync",
    syncQueryParam: "fara",
    description: "DOJ Foreign Agents Registration Act filings",
    nameField: "registrant_name",
    subtitleField: "country",
    sourceUrlField: "source_url",
  },
  ig: {
    label: "IG Reports",
    table: "ig_reports",
    orderBy: "published_on",
    syncFn: "investigations-sync",
    syncQueryParam: "ig",
    description: "Inspector General reports across federal agencies (Oversight.gov)",
    nameField: "title",
    subtitleField: "agency_name",
    sourceUrlField: "url",
  },
  spending: {
    label: "Federal Spending",
    table: "federal_spending",
    orderBy: "total_obligation",
    syncFn: "investigations-sync",
    syncQueryParam: "spending",
    description: "USAspending.gov grants, loans, and direct payments by recipient",
    nameField: "recipient_name",
    subtitleField: "awarding_agency",
    sourceUrlField: "source_url",
  },
};

export function InvestigationsPanel({ onBack }: InvestigationsPanelProps) {
  const [tab, setTab] = useState<string>("lobbying");
  const [data, setData] = useState<Record<string, Row[]>>({});
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<{ title: string; subtitle?: string; fields: Array<{ label: string; value: any }>; sourceUrl?: string | null } | null>(null);

  const cfg = SOURCES[tab];

  async function loadTab(key: string) {
    const c = SOURCES[key];
    if (!c) return;
    setLoading(true);
    try {
      // Page through all rows (PostgREST default cap is 1000 per request)
      const pageSize = 1000;
      let from = 0;
      const all: Row[] = [];
      // Hard safety ceiling to avoid runaway loops; effectively unlimited for our datasets
      const maxIterations = 200;
      for (let i = 0; i < maxIterations; i++) {
        const { data: rows, error } = await supabase
          .from(c.table as any)
          .select("*")
          .order(c.orderBy, { ascending: false, nullsFirst: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const batch = (rows ?? []) as unknown as Row[];
        all.push(...batch);
        if (batch.length < pageSize) break;
        from += pageSize;
      }
      setData((d) => ({ ...d, [key]: all }));
    } catch (e: any) {
      console.error(`Load ${key} failed`, e);
    } finally {
      setLoading(false);
    }
  }

  // Auto-load every source on mount so all tabs show their full datasets immediately
  useEffect(() => {
    Object.keys(SOURCES).forEach((key) => loadTab(key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!data[tab]) loadTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function syncSource() {
    if (!cfg.syncFn) return;
    setRunning(true);
    try {
      let path = cfg.syncFn;
      const params = new URLSearchParams();
      if (cfg.syncFn === "lobbying-sync") {
        params.set("year", String(new Date().getFullYear()));
      }
      if (cfg.syncQueryParam && query) {
        params.set(cfg.syncQueryParam, query);
      }
      // investigations-sync uses ?fara=1 / ?ig=1 / ?spending=1 as a flag
      if (cfg.syncFn === "investigations-sync") {
        params.set(cfg.syncQueryParam!, query || "1");
      }
      const qs = params.toString();
      if (qs) path += `?${qs}`;
      const res = await supabase.functions.invoke(path);
      if (res.error) throw res.error;
      toast.success(`Synced: ${res.data?.upserted ?? res.data?.count ?? 0} records`);
      loadTab(tab);
    } catch (e: any) {
      toast.error(e.message ?? "Sync failed");
    } finally {
      setRunning(false);
    }
  }

  function exportCsv() {
    const rows = data[tab] ?? [];
    if (rows.length === 0) {
      toast.error("Nothing to export");
      return;
    }
    const headers = Object.keys(rows[0]).filter(
      (k) => typeof rows[0][k] !== "object" || rows[0][k] === null
    );
    const csv = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tab}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openDetail(row: Row) {
    const c = SOURCES[tab];
    const fields = Object.entries(row)
      .filter(([k]) => !["id", "raw_data"].includes(k))
      .map(([k, v]) => ({
        label: k.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        value: v,
      }));
    setDetail({
      title: String(row[c.nameField] ?? "Record"),
      subtitle: c.subtitleField ? String(row[c.subtitleField] ?? "") : undefined,
      fields,
      sourceUrl: c.sourceUrlField ? row[c.sourceUrlField] : null,
    });
  }

  const fmtMoney = (n: number | null | undefined) =>
    n ? "$" + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—";

  const rows = data[tab] ?? [];

  return (
    <div>
      {onBack && (
        <button onClick={onBack} className="win98-button text-[10px] flex items-center gap-1 mb-3">
          <ArrowLeft className="h-3 w-3" />
          Back to Research Tools
        </button>
      )}

      <div className="win98-sunken bg-[hsl(var(--win98-light))] px-3 py-2 mb-3">
        <div className="flex items-center gap-2 text-[11px]">
          <Search className="h-4 w-4" />
          <span className="font-bold">Investigations</span>
          <span className="text-[hsl(var(--muted-foreground))]">— Public records: lobbying, contracts, courts, FARA, IG reports, spending</span>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          {Object.entries(SOURCES).map(([key, c]) => (
            <TabsTrigger key={key} value={key} className="text-[11px]">
              {c.label} ({(data[key] ?? []).length})
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex gap-2 my-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              tab === "lobbying"
                ? "(year auto-populated)"
                : tab === "ig"
                ? "agency or topic…"
                : tab === "fara"
                ? "registrant or country…"
                : "search term…"
            }
            className="h-7 text-[11px]"
          />
          <Button size="sm" onClick={syncSource} disabled={running} className="text-[11px]">
            {running ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Search className="w-3 h-3 mr-1" />}
            Sync
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv} className="text-[11px]">
            <Download className="w-3 h-3 mr-1" />
            CSV
          </Button>
        </div>

        {Object.keys(SOURCES).map((key) => (
          <TabsContent key={key} value={key}>
            <div className="win98-raised bg-[hsl(var(--win98-face))]">
              <div className="px-2 py-1 text-[11px] font-bold border-b border-b-[hsl(var(--win98-shadow))]">
                {SOURCES[key].description}
              </div>
              <div className="p-2 overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-[hsl(var(--win98-face))]">
                    <tr>
                      {key === "lobbying" && (
                        <>
                          <th className="text-left p-1">Registrant</th>
                          <th className="text-left p-1">Client</th>
                          <th className="text-left p-1">Year</th>
                          <th className="text-left p-1">Amount</th>
                          <th className="text-left p-1">Issues</th>
                        </>
                      )}
                      {key === "contracts" && (
                        <>
                          <th className="text-left p-1">Recipient</th>
                          <th className="text-left p-1">Agency</th>
                          <th className="text-left p-1">Amount</th>
                          <th className="text-left p-1">FY</th>
                          <th className="text-left p-1">Description</th>
                        </>
                      )}
                      {key === "cases" && (
                        <>
                          <th className="text-left p-1">Case</th>
                          <th className="text-left p-1">Court</th>
                          <th className="text-left p-1">Number</th>
                          <th className="text-left p-1">Filed</th>
                          <th className="text-left p-1">Nature</th>
                        </>
                      )}
                      {key === "fara" && (
                        <>
                          <th className="text-left p-1">Registrant</th>
                          <th className="text-left p-1">Country</th>
                          <th className="text-left p-1">Reg #</th>
                          <th className="text-left p-1">Status</th>
                          <th className="text-left p-1">Registered</th>
                        </>
                      )}
                      {key === "ig" && (
                        <>
                          <th className="text-left p-1">Title</th>
                          <th className="text-left p-1">Agency</th>
                          <th className="text-left p-1">Type</th>
                          <th className="text-left p-1">Topic</th>
                          <th className="text-left p-1">Published</th>
                        </>
                      )}
                      {key === "spending" && (
                        <>
                          <th className="text-left p-1">Recipient</th>
                          <th className="text-left p-1">Agency</th>
                          <th className="text-left p-1">Type</th>
                          <th className="text-left p-1">Amount</th>
                          <th className="text-left p-1">FY</th>
                        </>
                      )}
                      <th className="p-1 w-16">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data[key] ?? []).map((r) => (
                      <tr
                        key={r.id}
                        className="border-t border-[hsl(var(--win98-shadow))] hover:bg-[hsl(var(--win98-light))] cursor-pointer"
                        onClick={() => openDetail(r)}
                      >
                        {key === "lobbying" && (
                          <>
                            <td className="p-1 font-bold">{r.registrant_name}</td>
                            <td className="p-1">{r.client_name ?? "—"}</td>
                            <td className="p-1">{r.filing_year}</td>
                            <td className="p-1">{fmtMoney(r.amount)}</td>
                            <td className="p-1 max-w-[200px] truncate">
                              {Array.isArray(r.issues) ? r.issues.slice(0, 3).join(", ") : ""}
                            </td>
                          </>
                        )}
                        {key === "contracts" && (
                          <>
                            <td className="p-1 font-bold">{r.recipient_name}</td>
                            <td className="p-1">{r.awarding_agency ?? "—"}</td>
                            <td className="p-1">{fmtMoney(r.award_amount)}</td>
                            <td className="p-1">{r.fiscal_year}</td>
                            <td className="p-1 max-w-md truncate">{r.description ?? "—"}</td>
                          </>
                        )}
                        {key === "cases" && (
                          <>
                            <td className="p-1 font-bold">{r.case_name}</td>
                            <td className="p-1">{r.court}</td>
                            <td className="p-1">{r.case_number ?? "—"}</td>
                            <td className="p-1">{r.filed_date ?? "—"}</td>
                            <td className="p-1">{r.nature_of_suit ?? "—"}</td>
                          </>
                        )}
                        {key === "fara" && (
                          <>
                            <td className="p-1 font-bold">{r.registrant_name}</td>
                            <td className="p-1">{r.country ?? "—"}</td>
                            <td className="p-1">{r.registration_number}</td>
                            <td className="p-1">{r.status}</td>
                            <td className="p-1">{r.registration_date ?? "—"}</td>
                          </>
                        )}
                        {key === "ig" && (
                          <>
                            <td className="p-1 font-bold max-w-md truncate">{r.title}</td>
                            <td className="p-1">{r.agency_name}</td>
                            <td className="p-1">{r.type ?? "—"}</td>
                            <td className="p-1">{r.topic ?? "—"}</td>
                            <td className="p-1">{r.published_on ?? "—"}</td>
                          </>
                        )}
                        {key === "spending" && (
                          <>
                            <td className="p-1 font-bold">{r.recipient_name}</td>
                            <td className="p-1">{r.awarding_agency ?? "—"}</td>
                            <td className="p-1">{r.award_type}</td>
                            <td className="p-1">{fmtMoney(r.total_obligation ?? r.award_amount)}</td>
                            <td className="p-1">{r.fiscal_year ?? "—"}</td>
                          </>
                        )}
                        <td className="p-1 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => openDetail(r)}
                              className="win98-button px-1 py-0 h-[18px] text-[10px] flex items-center gap-1"
                              title="View details"
                            >
                              <Eye className="h-3 w-3" />
                            </button>
                            {SOURCES[key].sourceUrlField && r[SOURCES[key].sourceUrlField!] && (
                              <a
                                href={r[SOURCES[key].sourceUrlField!]}
                                target="_blank"
                                rel="noreferrer"
                                className="win98-button px-1 py-0 h-[18px] text-[10px] flex items-center"
                                title="Open source"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(data[key] ?? []).length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-3 text-center text-muted-foreground">
                          {loading ? "Loading…" : "No records yet. Enter a search term and click Sync."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>

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
