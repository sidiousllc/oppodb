import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw, Ban, CreditCard, ShieldCheck, ShieldOff } from "lucide-react";

interface Subscription {
  id: string;
  paddle_subscription_id: string;
  paddle_customer_id: string;
  product_id: string;
  price_id: string;
  status: string;
  tier?: string | null;
  environment: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
}
interface ReportUnlock { id: string; report_id: string; created_at: string; environment: string; }
interface Transaction {
  id: string; status: string; created_at: string; _env: string;
  details?: { totals?: { grand_total?: string; currency_code?: string } };
}

export function AdminBillingSection({ userId, userEmail }: { userId: string; userEmail: string }) {
  const [loading, setLoading] = useState(true);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [unlocks, setUnlocks] = useState<ReportUnlock[]>([]);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-billing", {
        body: { action: "list_user_billing", user_id: userId },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      setSubs(data.subscriptions || []);
      setUnlocks(data.report_unlocks || []);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const loadTxns = async () => {
    setLoadingTxns(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-billing", {
        body: { action: "list_transactions", user_id: userId },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      setTxns(data.transactions || []);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoadingTxns(false); }
  };

  const cancel = async (subscription_id: string, immediate: boolean) => {
    if (!confirm(`Cancel subscription ${immediate ? "immediately" : "at period end"}?`)) return;
    setBusy(subscription_id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-billing", {
        body: { action: "cancel_subscription", subscription_id, reason: immediate ? "immediately" : "next_billing_period" },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      toast.success("Cancellation submitted");
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  const refund = async (t: Transaction) => {
    if (!confirm(`Issue full refund for transaction ${t.id}?`)) return;
    setBusy(t.id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-billing", {
        body: { action: "refund_transaction", transaction_id: t.id, environment: t._env, user_id: userId, reason: "requested_by_customer" },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      toast.success("Refund submitted");
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  const grantPremium = async () => {
    setBusy("grant");
    try {
      const reason = prompt("Reason for granting premium (logged):") || "manual_grant";
      const { data, error } = await supabase.functions.invoke("admin-billing", {
        body: { action: "grant_premium", user_id: userId, reason },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      toast.success("Premium granted");
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  const revokePremium = async () => {
    if (!confirm("Manually revoke premium role? (Will be re-granted by trigger if user has an active subscription.)")) return;
    setBusy("revoke");
    try {
      const reason = prompt("Reason (logged):") || "manual_revoke";
      const { data, error } = await supabase.functions.invoke("admin-billing", {
        body: { action: "revoke_premium", user_id: userId, reason },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      toast.success("Premium revoked");
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-[10px]"><Loader2 className="h-3 w-3 animate-spin" /> Loading billing…</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold">Subscriptions for {userEmail}</div>
        <button onClick={load} className="win98-button text-[9px]"><RefreshCw className="h-3 w-3 inline mr-0.5" />Refresh</button>
      </div>

      {subs.length === 0 ? (
        <div className="win98-sunken bg-[hsl(var(--win98-light))] p-2 text-[10px] text-[hsl(var(--muted-foreground))]">
          No subscriptions on file.
        </div>
      ) : (
        <div className="space-y-2">
          {subs.map(s => {
            const isActive = ["active","trialing","past_due"].includes(s.status)
              && (!s.current_period_end || new Date(s.current_period_end) > new Date());
            return (
              <div key={s.id} className="win98-sunken bg-white p-2 text-[10px] space-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <b>{s.price_id}</b> <span className="text-[9px] text-[hsl(var(--muted-foreground))]">({s.product_id})</span>
                  </div>
                  <span className={`text-[9px] px-1 ${isActive ? "bg-green-200" : "bg-gray-200"}`}>
                    {s.status}{s.cancel_at_period_end ? " · canceling" : ""} · {s.environment}
                  </span>
                </div>
                <div className="text-[9px] text-[hsl(var(--muted-foreground))]">
                  Period ends: {s.current_period_end ? new Date(s.current_period_end).toLocaleString() : "—"}<br/>
                  Paddle ID: <span className="font-mono">{s.paddle_subscription_id}</span>
                </div>
                {isActive && !s.cancel_at_period_end && (
                  <div className="flex gap-1 pt-1">
                    <button onClick={() => cancel(s.id, false)} disabled={busy === s.id} className="win98-button text-[9px]">
                      <Ban className="h-3 w-3 inline mr-0.5" />Cancel at period end
                    </button>
                    <button onClick={() => cancel(s.id, true)} disabled={busy === s.id} className="win98-button text-[9px]" style={{ color: "hsl(0,70%,45%)" }}>
                      Cancel immediately
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <div className="text-[10px] font-bold">Recent transactions (Paddle)</div>
        <button onClick={loadTxns} disabled={loadingTxns} className="win98-button text-[9px]">
          {loadingTxns ? <Loader2 className="h-3 w-3 inline animate-spin" /> : <CreditCard className="h-3 w-3 inline mr-0.5" />}
          Load
        </button>
      </div>
      {txns.length > 0 && (
        <div className="win98-sunken bg-white p-1 max-h-40 overflow-auto">
          <table className="w-full text-[9px]">
            <thead><tr className="bg-[hsl(var(--win98-titlebar))] text-white">
              <th className="text-left px-1">Date</th><th className="text-left px-1">Status</th>
              <th className="text-left px-1">Total</th><th className="text-left px-1">Env</th><th></th>
            </tr></thead>
            <tbody>
              {txns.map(t => (
                <tr key={t.id} className="border-b border-gray-200">
                  <td className="px-1">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="px-1">{t.status}</td>
                  <td className="px-1">{t.details?.totals?.grand_total ? `${(parseInt(t.details.totals.grand_total)/100).toFixed(2)} ${t.details.totals.currency_code}` : "—"}</td>
                  <td className="px-1">{t._env}</td>
                  <td className="px-1">
                    {t.status === "completed" && (
                      <button onClick={() => refund(t)} disabled={busy === t.id} className="win98-button text-[9px]">Refund</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-[10px] font-bold pt-2">Report unlocks</div>
      <div className="win98-sunken bg-white p-2 text-[9px] max-h-24 overflow-auto">
        {unlocks.length === 0 ? <span className="text-[hsl(var(--muted-foreground))]">None</span> :
          unlocks.map(u => (
            <div key={u.id}>{new Date(u.created_at).toLocaleDateString()} — report <span className="font-mono">{u.report_id}</span> ({u.environment})</div>
          ))}
      </div>

      <div className="win98-raised bg-[hsl(var(--win98-face))] p-2 space-y-1">
        <div className="text-[10px] font-bold">Manual overrides</div>
        <div className="text-[9px] text-[hsl(var(--muted-foreground))]">
          Use sparingly — premium role is normally synced from active subscriptions.
        </div>
        <div className="flex gap-1">
          <button onClick={grantPremium} disabled={busy === "grant"} className="win98-button text-[9px]">
            <ShieldCheck className="h-3 w-3 inline mr-0.5" />Grant premium
          </button>
          <button onClick={revokePremium} disabled={busy === "revoke"} className="win98-button text-[9px]" style={{ color: "hsl(0,70%,45%)" }}>
            <ShieldOff className="h-3 w-3 inline mr-0.5" />Revoke premium
          </button>
        </div>
      </div>
    </div>
  );
}
