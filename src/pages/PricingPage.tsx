import { Link } from "react-router-dom";
import { PricingWindow } from "@/components/PricingWindow";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[hsl(var(--win98-bg))]">
      <PaymentTestModeBanner />
      <header className="bg-[hsl(var(--win98-titlebar))] text-white px-4 py-2 flex items-center justify-between">
        <Link to="/" className="font-bold text-sm">ORO — Opposition Research Database</Link>
        <Link to="/" className="win98-button text-[11px] px-2 py-0.5 text-black">Back to app</Link>
      </header>
      <main className="max-w-5xl mx-auto p-4">
        <h1 className="text-xl font-bold mb-1">Plans & Pricing</h1>
        <p className="text-[12px] text-[hsl(var(--muted-foreground))] mb-3">
          Subscribe for full premium research access, or unlock a single report. Programmatic access via our REST API and MCP server is available as a separate add-on.
        </p>
        <div className="win98-window bg-[hsl(var(--win98-bg))]">
          <PricingWindow />
        </div>
      </main>
    </div>
  );
}
