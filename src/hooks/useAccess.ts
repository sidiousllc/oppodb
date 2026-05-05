import { useUserRole } from "./useUserRole";
import { useSubscription } from "./useSubscription";

export type Tier = "free" | "pro" | "enterprise" | "api";

const TIER_RANK: Record<Tier, number> = {
  free: 0,
  api: 1,        // API/MCP standalone — does not include premium research features
  pro: 2,
  enterprise: 3,
};

/**
 * Unified access control combining roles + active subscription tier.
 *
 * Hierarchy (research/UI features):
 *   admin / moderator → full
 *   enterprise        → everything in pro + war room collaboration, priority, custom syncs
 *   pro               → premium research, AI assistant, exports
 *   api               → API + MCP only (does NOT grant premium research UI)
 *   free              → public content
 *
 * Server-side checks must re-validate via has_active_subscription /
 * current_subscription_tier RPCs — this hook is for UX gating only.
 */
export function useAccess() {
  const { isAdmin, isModerator, isPremium, canManageContent, loading: rolesLoading } = useUserRole();
  const { subscription, isActive, tier: subTier, loading: subLoading } = useSubscription();

  // Resolve effective tier from subscription (when active) or premium role
  let effectiveTier: Tier = "free";
  if (isActive && subTier) {
    effectiveTier = (subTier as Tier) ?? "free";
  } else if (isActive && subscription?.price_id?.startsWith("api_")) {
    effectiveTier = "api";
  } else if (isPremium) {
    // legacy premium role with no sub row → treat as pro
    effectiveTier = "pro";
  }

  // Admins always get max access
  const adminOverride = isAdmin || isModerator;
  const tierRank = adminOverride ? TIER_RANK.enterprise : TIER_RANK[effectiveTier];

  const hasTier = (min: Tier) => tierRank >= TIER_RANK[min];

  return {
    loading: rolesLoading || subLoading,
    tier: adminOverride ? "enterprise" : effectiveTier,
    isAdmin,
    isModerator,
    canManageContent,

    // Feature flags
    hasPro: hasTier("pro") || adminOverride,
    hasEnterprise: hasTier("enterprise") || adminOverride,
    hasApi: adminOverride || effectiveTier === "api" || hasTier("pro"),
    // ↑ pro+ also includes API access; standalone "api" tier only gets API/MCP

    hasResearch: hasTier("pro") || adminOverride,
    hasWarRoom: hasTier("enterprise") || adminOverride,
    hasAiAssistant: hasTier("pro") || adminOverride,
    hasReportExport: hasTier("pro") || adminOverride,
    hasMcpTools: adminOverride || effectiveTier === "api" || hasTier("pro"),

    isPaying: isActive || isPremium || adminOverride,
    hasTier,
  };
}
