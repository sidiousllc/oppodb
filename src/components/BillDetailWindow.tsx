import { useEffect, useState } from "react";
import { ExternalLink, Loader2, FileText, Calendar, Users, Gavel } from "lucide-react";

interface Props {
  billId: number;
  billNumber?: string;
  fallbackTitle?: string;
}

async function callLegiScan(params: Record<string, string>) {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const qs = new URLSearchParams(params).toString();
  const resp = await fetch(
    `https://${projectId}.supabase.co/functions/v1/legiscan?${qs}`,
    { headers: { "Content-Type": "application/json" } }
  );
  return resp.json();
}

export function BillDetailWindow({ billId, billNumber, fallbackTitle }: Props) {
  const [bill, setBill] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    callLegiScan({ op: "getBill", id: String(billId) })
      .then((data) => {
        if (cancelled) return;
        if (data?.bill) setBill(data.bill);
        else setErr("Bill details unavailable.");
      })
      .catch((e) => !cancelled && setErr(e?.message || "Failed to load bill"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [billId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading bill details…
      </div>
    );
  }

  const title = bill?.title || fallbackTitle || "Untitled bill";
  const description = bill?.description;
  const number = bill?.bill_number || billNumber || "";
  const sponsors: any[] = bill?.sponsors || [];
  const history: any[] = bill?.history || [];
  const stateLink = bill?.state_link || bill?.url;

  return (
    <div className="p-4 space-y-3 text-xs">
      <div className="flex items-start gap-2">
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border bg-primary/10 text-primary border-primary/25 shrink-0">
          {number || `#${billId}`}
        </span>
        <h2 className="font-display text-sm font-semibold text-foreground flex-1">{title}</h2>
      </div>

      {err && <p className="text-[11px] text-destructive">{err}</p>}

      {bill?.session?.session_name && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <Calendar className="h-3 w-3" /> {bill.session.session_name} • {bill?.state || ""}
        </div>
      )}

      {description && (
        <div className="rounded-md border border-border bg-card p-2">
          <p className="text-[11px] text-foreground whitespace-pre-wrap">{description}</p>
        </div>
      )}

      {bill?.status_desc && (
        <div className="flex items-center gap-2 text-[11px]">
          <Gavel className="h-3 w-3 text-primary" />
          <span className="text-muted-foreground">Status:</span>
          <span className="font-medium text-foreground">{bill.status_desc}</span>
        </div>
      )}

      {sponsors.length > 0 && (
        <div className="rounded-md border border-border p-2">
          <h3 className="font-semibold text-[11px] mb-1.5 flex items-center gap-1">
            <Users className="h-3 w-3" /> Sponsors ({sponsors.length})
          </h3>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {sponsors.slice(0, 25).map((s) => (
              <div key={s.people_id} className="flex items-center justify-between text-[10px] border-b border-border/30 pb-1">
                <span className="text-foreground">{s.name}</span>
                <span className="text-muted-foreground">{s.party} • {s.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="rounded-md border border-border p-2">
          <h3 className="font-semibold text-[11px] mb-1.5 flex items-center gap-1">
            <FileText className="h-3 w-3" /> History
          </h3>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {history.slice(0, 30).map((h, i) => (
              <div key={i} className="flex gap-2 text-[10px] border-b border-border/30 pb-1">
                <span className="text-muted-foreground shrink-0">{h.date}</span>
                <span className="text-foreground">{h.action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stateLink && (
        <a
          href={stateLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" /> View on state legislature site
        </a>
      )}
    </div>
  );
}
