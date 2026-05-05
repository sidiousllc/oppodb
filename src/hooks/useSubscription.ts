import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getPaddleEnvironment } from "@/lib/paddle";

export interface SubscriptionRow {
  id: string;
  paddle_subscription_id: string;
  paddle_customer_id: string;
  product_id: string;
  price_id: string;
  tier: "pro" | "enterprise" | null;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  environment: "sandbox" | "live";
}

const ACTIVE = ["active", "trialing", "past_due"];

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const env = getPaddleEnvironment();

    const fetchSub = async () => {
      const { data } = await supabase
        .from("subscriptions" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("environment", env)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        setSubscription((data as unknown as SubscriptionRow) ?? null);
        setLoading(false);
      }
    };
    fetchSub();

    const channel = supabase
      .channel(`subs:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => fetchSub(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  const isActive = !!subscription && (
    (ACTIVE.includes(subscription.status) &&
      (!subscription.current_period_end || new Date(subscription.current_period_end) > new Date())) ||
    (subscription.status === "canceled" &&
      subscription.current_period_end !== null &&
      new Date(subscription.current_period_end) > new Date())
  );

  return {
    subscription,
    loading,
    isActive,
    tier: isActive ? subscription?.tier ?? null : null,
    isPastDue: subscription?.status === "past_due",
    cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
  };
}
