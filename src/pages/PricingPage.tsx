import { Link, useNavigate } from "react-router-dom";
import { Win98Window } from "@/components/Win98Window";
import { PricingWindow } from "@/components/PricingWindow";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

export default function PricingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[hsl(var(--win98-desktop,#008080))] flex flex-col">
      <PaymentTestModeBanner />

      {/* Faux taskbar header for brand consistency */}
      <header className="bg-[hsl(var(--win98-titlebar))] text-white px-3 py-1.5 flex items-center justify-between text-[12px] border-b-2 border-[hsl(var(--win98-shadow))]">
        <Link to="/" className="font-bold flex items-center gap-2">
          <span>🗂️</span>
          <span>ORO — Opposition Research Database</span>
        </Link>
        <Link to="/" className="win98-button text-[11px] px-2 py-0.5 text-black">
          Back to Desktop
        </Link>
      </header>

      <main className="flex-1 flex items-start justify-center p-4 md:p-8">
        <div className="w-full max-w-3xl">
          <Win98Window
            title="Upgrade / Billing"
            icon={<span>💳</span>}
            onClose={() => navigate("/")}
            defaultSize={{ width: 720, height: 600 }}
          >
            <PricingWindow />
          </Win98Window>
        </div>
      </main>

      <footer className="text-center text-[10px] text-white/80 p-2">
        Payments processed securely. Use test card 4242 4242 4242 4242 in preview.
      </footer>
    </div>
  );
}
