import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, ExternalLink, ArrowUpRight, ArrowDownRight, Ban, Sparkles } from "lucide-react";

interface PlanOption {
  priceId: string;
  label: string;
  price: string;
  cadence: string;
  rank: number; // for upgrade/downgrade detection
  product: "pro" | "enterprise" | "api";
}

const PLANS: PlanOption[] = [
  { priceId: "pro_monthly",        label: "Pro — Monthly",     price: "$49",  cadence: "/mo",  rank: 1, product: "pro" },
  { priceId: "pro_yearly",         label: "Pro — Yearly",      price: "$490", cadence: "/yr",  rank: 2, product: "pro" },
  { priceId: "enterprise_monthly", label: "Enterprise",        price: "$199", cadence: "/mo",  rank: 3, product: "enterprise" },
  { priceId: "api_access_monthly", label: "API & MCP Access",  price: "$99",  cadence: "/mo",  rank: 0, product: "api" },
];

export function MySubscriptionWindow() {
  const { user } = useAuth();
  const { subscription, loading } = useSubscription();
  const { openCheckout, loading: checkoutLoading } = usePaddleCheckout();
  const [busy, setBusy] = useState<string | null>(null);

  const isActive = !!subscription
    && ["active","trialing","past_due"].includes(subscription.status)
    && (!subscription.current_period_end || new Date(subscription.current_period_end) > new Date());
  const cancelAtPeriodEnd = !!subscription?.cancel_at_period_end;
  const currentPlan = useMemo(
    () => PLANS.find(p => p.priceId === subscription?.price_id) || null,
    [subscription?.price_id],
  );

  const handleSubscribe = (priceId: string) => {
    openCheckout({
      priceId,
      customerEmail: user?.email ?? undefined,
      customData: user ? { userId: user.id } : undefined,
    });
  };

  const handleSwitch = async (priceId: string) => {
    setBusy(priceId);
    try {
      const { data, error } = await supabase.functions.invoke("change-subscription", { body: { newPriceId: priceId } });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      toast({ title: "Plan updated", description: "Prorated charges have been applied." });
    } catch (e) {
      toast({ title: "Could not switch plan", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  const handlePortal = async () => {
    setBusy("portal");
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal", { body: {} });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      window.open(data.url, "_blank");
    } catch (e) {
      toast({ title: "Could not open portal", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  const handleCancel = async () => {
    if (!confirm("Cancel at the end of the current billing period? You'll keep access until then.")) return;
    setBusy("cancel");
    try {
      const { data, error } = await supabase.functions.invoke("change-subscription", {
        body: { action: "cancel", effectiveFrom: "next_billing_period" },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      toast({ title: "Cancellation scheduled", description: "Access remains until the period ends." });
    } catch (e) {
      // Fallback: open portal
      toast({ title: "Opening billing portal…", description: "Please complete cancellation there." });
      await handlePortal();
    } finally { setBusy(null); }
  };

  if (loading) {
    return (
      <div className="p-4 text-[11px] flex items-center gap-2">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading your subscription…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4 text-[11px]">
        <div className="win98-sunken bg-white p-3">Please sign in to manage your subscription.</div>
      </div>
    );
  }

  return (
    <div className="p-3 text-[11px] space-y-3 overflow-auto h-full">
      {/* Current status panel */}
      <div className="win98-raised bg-[hsl(var(--win98-face))] p-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))]">Current plan</div>
            <div className="font-bold text-[13px] flex items-center gap-1">
              {isActive ? (
                <>
                  <Sparkles className="h-3 w-3" />
                  {currentPlan?.label || subscription?.price_id}
                </>
              ) : (
                <>Free — no active plan</>
              )}
            </div>
            {isActive && subscription?.current_period_end && (
              <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                {cancelAtPeriodEnd ? "Access ends" : "Renews"}{" "}
                {new Date(subscription.current_period_end).toLocaleDateString()}
                {subscription.status === "past_due" && " · ⚠ payment past due"}
              </div>
            )}
          </div>
          {isActive && (
            <div className={`text-[9px] px-2 py-0.5 ${cancelAtPeriodEnd ? "bg-yellow-200 border border-yellow-500" : "bg-green-200 border border-green-500"}`}>
              {cancelAtPeriodEnd ? "Canceling" : subscription?.status}
            </div>
          )}
        </div>

        {isActive && (
          <div className="flex flex-wrap gap-1 mt-2">
            <button onClick={handlePortal} disabled={busy === "portal"} className="win98-button text-[10px]">
              <ExternalLink className="h-3 w-3 inline mr-0.5" />
              {busy === "portal" ? "Opening…" : "Billing portal & invoices"}
            </button>
            {!cancelAtPeriodEnd && (
              <button onClick={handleCancel} disabled={busy === "cancel"} className="win98-button text-[10px]" style={{ color: "hsl(0,70%,45%)" }}>
                <Ban className="h-3 w-3 inline mr-0.5" />
                {busy === "cancel" ? "Canceling…" : "Cancel subscription"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Plan switcher */}
      <div>
        <div className="font-bold text-[11px] mb-1">{isActive ? "Change plan" : "Choose a plan"}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {PLANS.map(p => {
            const isCurrent = currentPlan?.priceId === p.priceId && isActive;
            const isUpgrade = isActive && currentPlan && p.product !== "api" && p.rank > currentPlan.rank;
            const isDowngrade = isActive && currentPlan && p.product !== "api" && p.rank < currentPlan.rank && currentPlan.product !== "api";
            return (
              <div key={p.priceId} className={`win98-sunken p-2 bg-white ${isCurrent ? "ring-2 ring-[hsl(var(--win98-titlebar))]" : ""}`}>
                <div className="flex items-baseline justify-between">
                  <div className="font-bold">{p.label}</div>
                  <div className="text-[12px] font-bold">{p.price}<span className="text-[9px] font-normal">{p.cadence}</span></div>
                </div>
                <div className="mt-1">
                  {isCurrent ? (
                    <div className="text-[9px] text-center py-1 bg-[hsl(var(--win98-titlebar))] text-white">✓ Current plan</div>
                  ) : isActive ? (
                    <button
                      onClick={() => handleSwitch(p.priceId)}
                      disabled={busy === p.priceId}
                      className="win98-button text-[10px] w-full"
                    >
                      {busy === p.priceId ? "Switching…" : (
                        <>
                          {isUpgrade && <ArrowUpRight className="h-3 w-3 inline mr-0.5" />}
                          {isDowngrade && <ArrowDownRight className="h-3 w-3 inline mr-0.5" />}
                          {isUpgrade ? "Upgrade" : isDowngrade ? "Downgrade" : "Switch"} to this plan
                        </>
                      )}
                    </button>
                  ) : (
                    <button onClick={() => handleSubscribe(p.priceId)} disabled={checkoutLoading} className="win98-button text-[10px] w-full font-bold">
                      {checkoutLoading ? "Opening…" : "Subscribe"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-[9px] text-[hsl(var(--muted-foreground))] pt-1">
        Plan changes are prorated immediately. Cancellations keep access until the end of the current period. Need help? Use the billing portal for invoices and payment methods.
      </div>
    </div>
  );
}
