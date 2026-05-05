import { type ReactNode } from "react";
import { useAccess, type Tier } from "@/hooks/useAccess";
import { useOpenApp } from "@/components/desktop/appRegistry";

interface TierGateProps {
  /** Minimum tier required: "pro" | "enterprise" | "api" */
  requires: Tier;
  /** Feature label shown in upgrade prompt */
  feature?: string;
  children: ReactNode;
  /** Custom fallback. If omitted, a Win98 upgrade card is shown. */
  fallback?: ReactNode;
  /** When true, renders nothing if access denied (silent gate). */
  silent?: boolean;
}

const LABELS: Record<Tier, string> = {
  free: "Free",
  api: "API & MCP Access",
  pro: "Pro",
  enterprise: "Enterprise",
};

export function TierGate({ requires, feature, children, fallback, silent }: TierGateProps) {
  const access = useAccess();
  const openApp = useOpenApp();

  if (access.loading) {
    return <div className="text-[10px] text-[hsl(var(--muted-foreground))] p-2">Checking access…</div>;
  }

  const allowed = access.hasTier(requires);
  if (allowed) return <>{children}</>;
  if (silent) return null;
  if (fallback) return <>{fallback}</>;

  return (
    <div className="win98-raised bg-[hsl(var(--win98-face))] p-4 text-center">
      <div className="text-3xl mb-2">🔒</div>
      <div className="text-[12px] font-bold mb-1">
        {LABELS[requires]} plan required
      </div>
      <div className="text-[10px] text-[hsl(var(--muted-foreground))] mb-3">
        {feature ? `${feature} is` : "This feature is"} available on the {LABELS[requires]} plan or higher.
      </div>
      <button
        className="win98-button text-[11px] px-3 py-1 font-bold"
        onClick={() => openApp("pricing")}
      >
        Upgrade now
      </button>
    </div>
  );
}

/** Inline badge to mark Pro/Enterprise-only items. */
export function TierBadge({ tier }: { tier: Tier }) {
  const styles: Record<Tier, string> = {
    free: "bg-gray-200 text-gray-700 border-gray-400",
    api: "bg-purple-100 text-purple-800 border-purple-400",
    pro: "bg-blue-100 text-blue-800 border-blue-400",
    enterprise: "bg-yellow-100 text-yellow-800 border-yellow-500",
  };
  return (
    <span className={`text-[8px] px-1 py-0.5 border font-bold uppercase ${styles[tier]}`}>
      {LABELS[tier]}
    </span>
  );
}
