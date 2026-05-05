import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Tier {
  priceId: string;
  name: string;
  price: string;
  cadence: string;
  highlights: string[];
  productKey: "pro" | "enterprise" | "report";
  badge?: string;
}

const SUBSCRIPTION_TIERS: Tier[] = [
  {
    priceId: "pro_monthly",
    name: "Pro — Monthly",
    price: "$49",
    cadence: "/month",
    productKey: "pro",
    highlights: [
      "Full premium research access",
      "All OppoHub & IntelHub sections",
      "AI assistant + report exports",
      "Cancel anytime",
    ],
  },
  {
    priceId: "pro_yearly",
    name: "Pro — Yearly",
    price: "$490",
    cadence: "/year",
    productKey: "pro",
    badge: "Save ~17%",
    highlights: [
      "Everything in Pro Monthly",
      "Two months free vs monthly",
      "Priority research queue",
    ],
  },
  {
    priceId: "enterprise_monthly",
    name: "Enterprise",
    price: "$199",
    cadence: "/month",
    productKey: "enterprise",
    highlights: [
      "Everything in Pro",
      "War-room collaboration",
      "Priority support",
      "Custom data syncs",
    ],
  },
];

const REPORT_TIER: Tier = {
  priceId: "report_unlock_one_time",
  name: "Single Report Unlock",
  price: "$25",
  cadence: " one-time",
  productKey: "report",
  highlights: ["Unlock one candidate report", "No subscription required"],
};

const API_TIER: Tier = {
  priceId: "api_access_monthly",
  name: "API & MCP Access",
  price: "$99",
  cadence: "/month",
  productKey: "enterprise",
  highlights: [
    "Programmatic REST API access",
    "MCP server for AI agents",
    "Use ORO data in your own tools",
    "Cancel anytime",
  ],
};

export function PricingWindow() {
  const { user } = useAuth();
  const { subscription, isActive, tier: currentTier, cancelAtPeriodEnd } = useSubscription();
  const { openCheckout, loading: checkoutLoading, error: checkoutError } = usePaddleCheckout();
  const [busy, setBusy] = useState<string | null>(null);

  const handleCheckout = (priceId: string) => {
    openCheckout({
      priceId,
      customerEmail: user?.email ?? undefined,
      customData: user ? { userId: user.id } : undefined,
    });
  };

  const handleChangePlan = async (priceId: string) => {
    setBusy(priceId);
    try {
      const { data, error } = await supabase.functions.invoke("change-subscription", {
        body: { newPriceId: priceId },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      toast({ title: "Plan updated", description: "Your new plan is now active. Prorated charges applied." });
    } catch (e) {
      toast({ title: "Could not change plan", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const handlePortal = async () => {
    setBusy("portal");
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal", { body: {} });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      window.open(data.url, "_blank");
    } catch (e) {
      toast({ title: "Could not open portal", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const renderActionButton = (t: Tier) => {
    const samePrice = subscription?.price_id === t.priceId;
    const isSubscriptionTier = t.productKey !== "report";

    if (!user) {
      return (
        <button className="win98-button text-[11px] w-full py-1.5 opacity-60" disabled>
          Sign in to subscribe
        </button>
      );
    }

    if (isSubscriptionTier && isActive && samePrice) {
      return (
        <div className="text-[10px] text-center py-1.5 px-2 bg-[hsl(var(--win98-titlebar))] text-white">
          ✓ Current plan{cancelAtPeriodEnd ? " (canceling at period end)" : ""}
        </div>
      );
    }

    if (isSubscriptionTier && isActive && !samePrice) {
      return (
        <button
          onClick={() => handleChangePlan(t.priceId)}
          disabled={busy === t.priceId}
          className="win98-button text-[11px] w-full py-1.5"
        >
          {busy === t.priceId ? "Updating…" : "Switch to this plan"}
        </button>
      );
    }

    return (
      <button
        onClick={() => handleCheckout(t.priceId)}
        disabled={checkoutLoading}
        className="win98-button text-[11px] w-full py-1.5 font-bold"
      >
        {checkoutLoading ? "Opening…" : isSubscriptionTier ? "Subscribe" : "Buy unlock"}
      </button>
    );
  };

  const TierCard = ({ t }: { t: Tier }) => (
    <div className="win98-sunken bg-white p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-bold text-[12px]">{t.name}</div>
          <div className="text-[16px] font-bold mt-0.5">
            {t.price}
            <span className="text-[10px] font-normal text-[hsl(var(--muted-foreground))]">{t.cadence}</span>
          </div>
        </div>
        {t.badge && (
          <span className="text-[9px] bg-yellow-200 border border-yellow-500 px-1 py-0.5">{t.badge}</span>
        )}
      </div>
      <ul className="text-[10px] space-y-0.5 flex-1">
        {t.highlights.map((h) => (
          <li key={h}>• {h}</li>
        ))}
      </ul>
      {renderActionButton(t)}
    </div>
  );

  return (
    <div className="p-3 text-[11px] space-y-3 overflow-auto">
      <div className="win98-sunken bg-white p-2">
        <div className="font-bold text-[12px]">Choose your plan</div>
        <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
          Premium tiers unlock advanced research, AI tools, and report exports.
        </div>
      </div>

      {checkoutError && (
        <div className="win98-sunken bg-red-50 p-2 text-red-800 text-[10px]">{checkoutError}</div>
      )}

      {isActive && subscription && (
        <div className="win98-sunken bg-blue-50 p-2 flex items-center justify-between gap-2">
          <div className="text-[10px]">
            <div>
              Active plan: <strong>{currentTier ?? subscription.price_id}</strong>
              {cancelAtPeriodEnd && " (canceling at period end)"}
            </div>
            {subscription.current_period_end && (
              <div className="text-[hsl(var(--muted-foreground))]">
                {cancelAtPeriodEnd ? "Access until" : "Renews"}{" "}
                {new Date(subscription.current_period_end).toLocaleDateString()}
              </div>
            )}
          </div>
          <button
            onClick={handlePortal}
            disabled={busy === "portal"}
            className="win98-button text-[10px] px-2 py-1"
          >
            {busy === "portal" ? "Opening…" : "Manage / Cancel"}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {SUBSCRIPTION_TIERS.map((t) => (
          <TierCard key={t.priceId} t={t} />
        ))}
      </div>

      <div className="font-bold text-[11px] mt-2">Developer access</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <TierCard t={API_TIER} />
      </div>

      <div className="font-bold text-[11px] mt-2">One-time purchase</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <TierCard t={REPORT_TIER} />
      </div>

      <div className="text-[9px] text-[hsl(var(--muted-foreground))] pt-2">
        Payments processed securely by our payment provider. By subscribing, you agree to the Terms.
      </div>
    </div>
  );
}
