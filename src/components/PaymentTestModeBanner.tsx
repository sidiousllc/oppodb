import { getPaddleEnvironment, isPaddleConfigured } from "@/lib/paddle";

export function PaymentTestModeBanner() {
  if (!isPaddleConfigured()) return null;
  if (getPaddleEnvironment() !== "sandbox") return null;
  return (
    <div className="w-full bg-orange-100 border-b border-orange-300 px-4 py-2 text-center text-[11px] text-orange-800">
      All payments made in the preview are in test mode. Use card{" "}
      <code className="font-mono">4242 4242 4242 4242</code> to complete a test checkout.
    </div>
  );
}
