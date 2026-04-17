import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Win98PageLayout } from "./Win98PageLayout";
import { Win98Window } from "./Win98Window";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { toast } from "sonner";
import { Loader2, Search, ExternalLink, Download } from "lucide-react";

interface Lobbying { id: string; registrant_name: string; client_name: string | null; filing_year: number; amount: number | null; issues: any; source_url: string | null; }
interface Contract { id: string; recipient_name: string; awarding_agency: string | null; award_amount: number | null; description: string | null; fiscal_year: number; source_url: string | null; }
interface Court { id: string; case_name: string; court: string; case_number: string | null; filed_date: string | null; nature_of_suit: string | null; docket_url: string | null; }

export function InvestigationsHub() {
  const [tab, setTab] = useState("lobbying");
  const [lobbying, setLobbying] = useState<Lobbying[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [cases, setCases] = useState<Court[]>([]);
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState(false);

  async function load() {
    const [{ data: l }, { data: c }, { data: ct }] = await Promise.all([
      supabase.from("lobbying_disclosures").select("*").order("filing_date", { ascending: false }).limit(100),
      supabase.from("gov_contracts").select("*").order("award_amount", { ascending: false }).limit(100),
      supabase.from("court_cases").select("*").order("filed_date", { ascending: false }).limit(100),
    ]);
    setLobbying((l ?? []) as Lobbying[]);
    setContracts((c ?? []) as Contract[]);
    setCases((ct ?? []) as Court[]);
  }

  useEffect(() => { load(); }, []);

  async function syncSource() {
    setRunning(true);
    try {
      let res;
      if (tab === "lobbying") res = await supabase.functions.invoke(`lobbying-sync?year=${new Date().getFullYear()}`);
      else if (tab === "contracts") res = await supabase.functions.invoke(`contracts-sync${query ? `?recipient=${encodeURIComponent(query)}` : ""}`);
      else res = await supabase.functions.invoke(`court-cases-sync?q=${encodeURIComponent(query || "election")}`);
      if (res?.error) throw res.error;
      toast.success(`Synced: ${res?.data?.upserted ?? 0} records`);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  }

  const fmt = (n: number | null | undefined) => n ? "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—";

  function exportCsv() {
    let rows: any[] = [];
    let filename = "";
    if (tab === "lobbying") { rows = lobbying; filename = "lobbying.csv"; }
    else if (tab === "contracts") { rows = contracts; filename = "contracts.csv"; }
    else { rows = cases; filename = "court-cases.csv"; }
    if (rows.length === 0) { toast.error("Nothing to export"); return; }
    const headers = Object.keys(rows[0]).filter(k => typeof rows[0][k] !== "object" || rows[0][k] === null);
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Win98PageLayout title="Investigations">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="lobbying" className="text-[11px]">Lobbying ({lobbying.length})</TabsTrigger>
          <TabsTrigger value="contracts" className="text-[11px]">Federal Contracts ({contracts.length})</TabsTrigger>
          <TabsTrigger value="court" className="text-[11px]">Court Cases ({cases.length})</TabsTrigger>
        </TabsList>

        <div className="flex gap-2 my-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tab === "lobbying" ? "(year auto)" : "search term…"} className="h-7 text-[11px]" />
          <Button size="sm" onClick={syncSource} disabled={running} className="text-[11px]">
            {running ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Search className="w-3 h-3 mr-1" />}Sync
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv} className="text-[11px]"><Download className="w-3 h-3 mr-1" />CSV</Button>
        </div>

        <TabsContent value="lobbying">
          <Win98Window title="Senate LDA filings">
            <div className="p-2 overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-[hsl(var(--win98-face))]"><tr><th className="text-left p-1">Registrant</th><th className="text-left p-1">Client</th><th className="text-left p-1">Year</th><th className="text-left p-1">Amount</th><th className="text-left p-1">Issues</th><th className="p-1"></th></tr></thead>
                <tbody>
                  {lobbying.map(l => (
                    <tr key={l.id} className="border-t border-[hsl(var(--win98-shadow))]">
                      <td className="p-1 font-bold">{l.registrant_name}</td>
                      <td className="p-1">{l.client_name ?? "—"}</td>
                      <td className="p-1">{l.filing_year}</td>
                      <td className="p-1">{fmt(l.amount)}</td>
                      <td className="p-1">{Array.isArray(l.issues) ? l.issues.slice(0, 3).join(", ") : ""}</td>
                      <td className="p-1">{l.source_url && <a href={l.source_url} target="_blank" rel="noreferrer"><ExternalLink className="w-3 h-3" /></a>}</td>
                    </tr>
                  ))}
                  {lobbying.length === 0 && <tr><td colSpan={6} className="p-3 text-center text-muted-foreground">No filings synced yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </Win98Window>
        </TabsContent>

        <TabsContent value="contracts">
          <Win98Window title="USAspending federal contracts">
            <div className="p-2 overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-[hsl(var(--win98-face))]"><tr><th className="text-left p-1">Recipient</th><th className="text-left p-1">Agency</th><th className="text-left p-1">Amount</th><th className="text-left p-1">FY</th><th className="text-left p-1">Description</th><th className="p-1"></th></tr></thead>
                <tbody>
                  {contracts.map(c => (
                    <tr key={c.id} className="border-t border-[hsl(var(--win98-shadow))]">
                      <td className="p-1 font-bold">{c.recipient_name}</td>
                      <td className="p-1">{c.awarding_agency ?? "—"}</td>
                      <td className="p-1">{fmt(c.award_amount)}</td>
                      <td className="p-1">{c.fiscal_year}</td>
                      <td className="p-1 max-w-md truncate">{c.description ?? "—"}</td>
                      <td className="p-1">{c.source_url && <a href={c.source_url} target="_blank" rel="noreferrer"><ExternalLink className="w-3 h-3" /></a>}</td>
                    </tr>
                  ))}
                  {contracts.length === 0 && <tr><td colSpan={6} className="p-3 text-center text-muted-foreground">No contracts. Enter a recipient name and Sync.</td></tr>}
                </tbody>
              </table>
            </div>
          </Win98Window>
        </TabsContent>

        <TabsContent value="court">
          <Win98Window title="CourtListener federal cases">
            <div className="p-2 overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-[hsl(var(--win98-face))]"><tr><th className="text-left p-1">Case</th><th className="text-left p-1">Court</th><th className="text-left p-1">Number</th><th className="text-left p-1">Filed</th><th className="text-left p-1">Nature</th><th className="p-1"></th></tr></thead>
                <tbody>
                  {cases.map(c => (
                    <tr key={c.id} className="border-t border-[hsl(var(--win98-shadow))]">
                      <td className="p-1 font-bold">{c.case_name}</td>
                      <td className="p-1">{c.court}</td>
                      <td className="p-1">{c.case_number ?? "—"}</td>
                      <td className="p-1">{c.filed_date ?? "—"}</td>
                      <td className="p-1">{c.nature_of_suit ?? "—"}</td>
                      <td className="p-1">{c.docket_url && <a href={c.docket_url} target="_blank" rel="noreferrer"><ExternalLink className="w-3 h-3" /></a>}</td>
                    </tr>
                  ))}
                  {cases.length === 0 && <tr><td colSpan={6} className="p-3 text-center text-muted-foreground">No cases. Enter a search term and Sync.</td></tr>}
                </tbody>
              </table>
            </div>
          </Win98Window>
        </TabsContent>
      </Tabs>
    </Win98PageLayout>
  );
}
