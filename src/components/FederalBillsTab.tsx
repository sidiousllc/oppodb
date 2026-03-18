import { useState, useEffect, useCallback } from "react";
import {
  FileText, Search, ExternalLink, ChevronRight, Loader2, RefreshCw,
  Building2, Users, Vote, Calendar
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

interface CongressBill {
  id: string;
  bill_id: string;
  bill_type: string;
  bill_number: number;
  title: string;
  short_title: string | null;
  sponsor_name: string | null;
  latest_action_text: string | null;
  latest_action_date: string | null;
  policy_area: string | null;
  cosponsor_count: number;
  congress_url: string | null;
}

export function FederalBillsTab() {
  const { session } = useAuth();
  const { isAdmin } = useUserRole();
  const [bills, setBills] = useState<CongressBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [billCount, setBillCount] = useState(0);

  const loadBills = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("congress_bills")
      .select("id,bill_id,bill_type,bill_number,title,short_title,sponsor_name,latest_action_text,latest_action_date,policy_area,cosponsor_count,congress_url")
      .order("latest_action_date", { ascending: false })
      .limit(100);
    if (searchQuery) q = q.ilike("title", `%${searchQuery}%`);
    const { data } = await q;
    setBills((data as CongressBill[]) || []);
    setLoading(false);
  }, [searchQuery]);

  useEffect(() => {
    loadBills();
    supabase.from("congress_bills").select("id", { count: "exact", head: true }).then(({ count }) => {
      setBillCount(count || 0);
    });
  }, [loadBills]);

  const handleSync = useCallback(async () => {
    if (!session?.access_token) { toast.error("Please sign in"); return; }
    setSyncing(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const params = new URLSearchParams({ action: "bills", congress: "119", limit: "100" });
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/congress-sync?${params}`,
        { headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` } }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Sync failed");
      toast.success(`Synced ${data.total_synced} bills`);
      loadBills();
    } catch (e: any) {
      toast.error(e.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  }, [session, loadBills]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 flex-1 max-w-md rounded-lg border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search federal bills…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
        <span className="text-xs text-muted-foreground">{billCount} bills in database</span>
        {isAdmin && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Sync Bills
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            <span className="text-sm">Loading federal bills…</span>
          </div>
        </div>
      ) : bills.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="font-display text-lg font-semibold text-foreground mb-1">No Federal Bills Found</h3>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Click 'Sync Bills' to pull bills from Congress.gov." : "No bills have been synced yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {bills.map((bill) => (
            <div key={bill.id} className="candidate-card animate-fade-in">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide border bg-primary/10 text-primary border-primary/25">
                      {bill.bill_type.toUpperCase()} {bill.bill_number}
                    </span>
                    {bill.policy_area && (
                      <span className="text-[9px] text-muted-foreground border border-border rounded-full px-1.5 py-0.5">{bill.policy_area}</span>
                    )}
                    {bill.cosponsor_count > 0 && (
                      <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                        <Users className="h-2.5 w-2.5" /> {bill.cosponsor_count}
                      </span>
                    )}
                  </div>
                  <h3 className="font-display text-xs font-semibold text-foreground mt-1 line-clamp-2">
                    {bill.short_title || bill.title}
                  </h3>
                  {bill.sponsor_name && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">Sponsor: {bill.sponsor_name}</p>
                  )}
                  {bill.latest_action_text && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                      {bill.latest_action_date && <span className="font-medium">{bill.latest_action_date}: </span>}
                      {bill.latest_action_text}
                    </p>
                  )}
                </div>
                {bill.congress_url && (
                  <a
                    href={bill.congress_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 p-1 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
