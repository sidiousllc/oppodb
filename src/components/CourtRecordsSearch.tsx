import { useState, useCallback, useEffect } from "react";
import { Search, Scale, ArrowLeft, Info, ExternalLink, Loader2, FileText, X, Gavel } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CourtRecordsSearchProps {
  onBack?: () => void;
}

interface CourtResult {
  id: string;
  source: "courtlistener" | "judyrecords" | "cached" | "juriscraper";
  case_name: string;
  case_number?: string | null;
  court?: string | null;
  jurisdiction?: string | null;
  state?: string | null;
  filed_date?: string | null;
  status?: string | null;
  judge?: string | null;
  nature_of_suit?: string | null;
  parties?: any[];
  snippet?: string | null;
  docket_url?: string | null;
  documents?: { name: string; url: string; type?: string }[];
  raw?: any;
}

const STATES = [
  "", "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut",
  "delaware", "florida", "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa",
  "kansas", "kentucky", "louisiana", "maine", "maryland", "massachusetts", "michigan",
  "minnesota", "mississippi", "missouri", "montana", "nebraska", "nevada", "new hampshire",
  "new jersey", "new mexico", "new york", "north carolina", "north dakota", "ohio",
  "oklahoma", "oregon", "pennsylvania", "rhode island", "south carolina", "south dakota",
  "tennessee", "texas", "utah", "vermont", "virginia", "washington", "west virginia",
  "wisconsin", "wyoming",
];

const SOURCE_LABEL: Record<string, string> = {
  courtlistener: "Federal Dockets (CourtListener)",
  juriscraper: "Opinions (Juriscraper)",
  judyrecords: "State (JudyRecords)",
  cached: "Saved",
};

export function CourtRecordsSearch({ onBack }: CourtRecordsSearchProps) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | "federal" | "state">("all");
  const [stateFilter, setStateFilter] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [results, setResults] = useState<CourtResult[]>([]);
  const [errors, setErrors] = useState<{ source: string; message: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const [detail, setDetail] = useState<CourtResult | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [docViewer, setDocViewer] = useState<{ name: string; url: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("court-recent-searches");
      if (raw) setRecentSearches(JSON.parse(raw));
    } catch (_) { /* ignore */ }
  }, []);

  const persistRecent = (next: string[]) => {
    setRecentSearches(next);
    try { localStorage.setItem("court-recent-searches", JSON.stringify(next)); } catch (_) { /* ignore */ }
  };

  const runSearch = useCallback(async (qOverride?: string) => {
    const q = (qOverride ?? query).trim();
    if (!q) { toast.error("Please enter a search query"); return; }
    setLoading(true);
    setResults([]);
    setErrors([]);
    try {
      const { data, error } = await supabase.functions.invoke("court-search", {
        body: { q, scope, state: stateFilter || undefined },
      });
      if (error) throw error;
      setResults(data?.results ?? []);
      setErrors(data?.errors ?? []);
      persistRecent([q, ...recentSearches.filter((s) => s !== q)].slice(0, 10));
      if (!data?.results?.length) toast.info("No results found");
      else toast.success(`${data.results.length} result(s) found`);
    } catch (e: any) {
      toast.error(e?.message ?? "Search failed");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, scope, stateFilter, recentSearches]);

  const openDetail = async (r: CourtResult) => {
    setDetail(r);
    if (r.source === "judyrecords") return; // no detail API
    setDetailLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("court-search", {
        body: { id: r.id, source: r.source },
      });
      if (error) throw error;
      if (data?.result) setDetail(data.result);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load case detail");
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="relative">
      {onBack && (
        <button onClick={onBack} className="win98-button text-[10px] flex items-center gap-1 mb-3">
          <ArrowLeft className="h-3 w-3" />
          Back to Research Tools
        </button>
      )}

      <div className="win98-sunken bg-[hsl(var(--win98-light))] px-3 py-2 mb-3">
        <div className="flex items-center gap-2 text-[11px]">
          <Scale className="h-4 w-4" />
          <span className="font-bold">Court Records Search</span>
          <span className="text-[hsl(var(--muted-foreground))]">— Federal Dockets + Opinions (Juriscraper) + State (JudyRecords)</span>
        </div>
      </div>

      <div className="win98-sunken bg-white p-3 mb-3 space-y-2">
        <label className="block text-[10px] font-bold">Search Query</label>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            className="win98-input flex-1"
            placeholder='e.g. "John Smith" or 2024-cv-01234'
            maxLength={500}
          />
          <button onClick={() => runSearch()} disabled={loading} className="win98-button text-[10px] font-bold flex items-center gap-1">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
            Search
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] flex flex-col gap-0.5">
            <span className="font-bold">Scope</span>
            <select value={scope} onChange={(e) => setScope(e.target.value as any)} className="win98-input text-[10px] px-1 py-0.5">
              <option value="all">All courts</option>
              <option value="federal">Federal only</option>
              <option value="state">State only</option>
            </select>
          </label>
          <label className="text-[10px] flex flex-col gap-0.5">
            <span className="font-bold">State filter (state results)</span>
            <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="win98-input text-[10px] px-1 py-0.5">
              {STATES.map((s) => (
                <option key={s || "any"} value={s}>{s ? s.replace(/\b\w/g, (c) => c.toUpperCase()) : "Any state"}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="win98-raised bg-yellow-50 border border-yellow-300 p-2 mb-3 text-[10px]">
          <strong>Some sources failed:</strong>
          <ul className="list-disc ml-5">
            {errors.map((e, i) => <li key={i}>{SOURCE_LABEL[e.source] ?? e.source}: {e.message}</li>)}
          </ul>
        </div>
      )}

      {results.length > 0 && (
        <div className="win98-raised bg-[hsl(var(--win98-face))] p-2 mb-3">
          <div className="text-[10px] font-bold mb-2">Results ({results.length})</div>
          <div className="space-y-1.5">
            {results.map((r) => (
              <button
                key={`${r.source}-${r.id}`}
                onClick={() => openDetail(r)}
                className="block w-full text-left bg-white border border-[hsl(var(--win98-shadow))] p-2 hover:bg-blue-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold truncate">{r.case_name}</div>
                    <div className="text-[9px] opacity-80 mt-0.5 truncate">
                      {r.court || "—"}{r.case_number ? ` · ${r.case_number}` : ""}{r.filed_date ? ` · ${r.filed_date}` : ""}
                    </div>
                    {r.snippet && <div className="text-[9px] opacity-70 mt-1 line-clamp-2">{r.snippet}</div>}
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 bg-[hsl(var(--win98-light))] border border-[hsl(var(--win98-shadow))] shrink-0">
                    {SOURCE_LABEL[r.source]}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {!results.length && !loading && (
        <div className="win98-raised bg-[hsl(var(--win98-face))] p-3 mb-3">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "hsl(210, 60%, 50%)" }} />
            <div className="text-[10px]">
              <p className="font-bold mb-1">In-app federal + state court search</p>
              <p className="text-[hsl(var(--muted-foreground))]">
                Federal dockets via CourtListener (RECAP). Court opinions across 200+ state &amp; federal appellate courts via Free Law Project's <a href="https://github.com/freelawproject/juriscraper" target="_blank" rel="noopener noreferrer" className="underline">Juriscraper</a> pipeline. State case records via JudyRecords. Click any result to view details and linked documents.
              </p>
            </div>
          </div>
        </div>
      )}

      {recentSearches.length > 0 && (
        <div className="win98-raised bg-[hsl(var(--win98-face))] p-3">
          <p className="text-[10px] font-bold mb-2">🕒 Recent Searches</p>
          <div className="flex flex-wrap gap-1">
            {recentSearches.map((s, i) => (
              <button
                key={i}
                onClick={() => { setQuery(s); runSearch(s); }}
                className="win98-button text-[9px] px-2 py-0.5 flex items-center gap-1"
              >
                <Search className="h-2.5 w-2.5" />
                {s.length > 40 ? s.slice(0, 40) + "…" : s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Case detail mini-window */}
      {detail && (
        <CaseDetailWindow
          detail={detail}
          loading={detailLoading}
          onClose={() => setDetail(null)}
          onOpenDoc={(d) => setDocViewer(d)}
        />
      )}

      {/* Document viewer mini-window */}
      {docViewer && (
        <DocumentViewerWindow
          name={docViewer.name}
          url={docViewer.url}
          onClose={() => setDocViewer(null)}
        />
      )}
    </div>
  );
}

function CaseDetailWindow({
  detail, loading, onClose, onOpenDoc,
}: {
  detail: CourtResult;
  loading: boolean;
  onClose: () => void;
  onOpenDoc: (d: { name: string; url: string }) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="win98-raised bg-[hsl(var(--win98-face))] flex flex-col w-full max-w-3xl max-h-[85vh]">
        <div className="bg-[hsl(var(--win98-titlebar))] text-white px-2 py-1 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-bold truncate">
            <Gavel className="h-3 w-3" /> {detail.case_name}
          </div>
          <button onClick={onClose} className="win98-button !p-0 !h-4 !w-4 flex items-center justify-center text-black">
            <X className="h-3 w-3" />
          </button>
        </div>
        <div className="p-3 overflow-auto text-[10px] space-y-2">
          {loading && (
            <div className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading details…</div>
          )}
          <KV label="Source" value={SOURCE_LABEL[detail.source]} />
          <KV label="Court" value={detail.court} />
          <KV label="Case number" value={detail.case_number} />
          <KV label="Filed" value={detail.filed_date} />
          <KV label="Status" value={detail.status} />
          <KV label="Judge" value={detail.judge} />
          <KV label="Nature of suit" value={detail.nature_of_suit} />
          <KV label="Jurisdiction" value={detail.jurisdiction} />

          {detail.parties && detail.parties.length > 0 && (
            <div>
              <div className="font-bold mb-1">Parties</div>
              <div className="bg-white border border-[hsl(var(--win98-shadow))] p-1.5 max-h-32 overflow-auto">
                {detail.parties.map((p: any, i: number) => (
                  <div key={i} className="border-b border-gray-200 py-0.5 last:border-0">
                    {typeof p === "string" ? p : (p.name || p.party_types?.[0]?.name || JSON.stringify(p))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {detail.snippet && (
            <div>
              <div className="font-bold mb-1">Snippet</div>
              <div className="bg-white border border-[hsl(var(--win98-shadow))] p-1.5 whitespace-pre-wrap">{detail.snippet}</div>
            </div>
          )}

          {detail.documents && detail.documents.length > 0 && (
            <div>
              <div className="font-bold mb-1">Documents ({detail.documents.length})</div>
              <div className="space-y-1">
                {detail.documents.map((d, i) => (
                  <div key={i} className="flex items-center justify-between bg-white border border-[hsl(var(--win98-shadow))] p-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <FileText className="h-3 w-3 shrink-0" />
                      <span className="truncate">{d.name}</span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => onOpenDoc(d)} className="win98-button text-[9px] px-1.5 py-0.5">View</button>
                      <a href={d.url} target="_blank" rel="noopener noreferrer" className="win98-button text-[9px] px-1.5 py-0.5 flex items-center gap-1">
                        <ExternalLink className="h-2.5 w-2.5" /> Open
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {detail.docket_url && (
            <a href={detail.docket_url} target="_blank" rel="noopener noreferrer" className="win98-button text-[10px] inline-flex items-center gap-1">
              <ExternalLink className="h-3 w-3" /> Open full docket
            </a>
          )}

          {detail.raw && (
            <details className="text-[9px]">
              <summary className="cursor-pointer font-bold">Raw data</summary>
              <pre className="bg-white border border-[hsl(var(--win98-shadow))] p-1.5 max-h-40 overflow-auto">{JSON.stringify(detail.raw, null, 2)}</pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

function DocumentViewerWindow({ name, url, onClose }: { name: string; url: string; onClose: () => void }) {
  const isPdf = /\.pdf($|\?)/i.test(url);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
      <div className="win98-raised bg-[hsl(var(--win98-face))] flex flex-col w-full max-w-4xl h-[85vh]">
        <div className="bg-[hsl(var(--win98-titlebar))] text-white px-2 py-1 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-bold truncate">
            <FileText className="h-3 w-3" /> {name}
          </div>
          <div className="flex items-center gap-1">
            <a href={url} target="_blank" rel="noopener noreferrer" className="win98-button !text-black text-[9px] px-1.5 py-0.5 flex items-center gap-1">
              <ExternalLink className="h-2.5 w-2.5" /> Open
            </a>
            <button onClick={onClose} className="win98-button !p-0 !h-4 !w-4 flex items-center justify-center text-black">
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="flex-1 bg-white border-t border-[hsl(var(--win98-shadow))] overflow-hidden">
          {isPdf ? (
            <iframe src={url} title={name} className="w-full h-full" />
          ) : (
            <iframe src={url} title={name} className="w-full h-full" sandbox="allow-same-origin allow-scripts allow-popups" />
          )}
        </div>
        <div className="px-2 py-1 text-[9px] bg-[hsl(var(--win98-face))] border-t border-[hsl(var(--win98-shadow))] truncate">{url}</div>
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2">
      <div className="font-bold opacity-80">{label}</div>
      <div>{value}</div>
    </div>
  );
}
