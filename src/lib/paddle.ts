import { supabase } from "@/integrations/supabase/client";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

declare global {
  interface Window {
    Paddle: any;
  }
}

export function getPaddleEnvironment(): "sandbox" | "live" {
  return clientToken?.startsWith("test_") ? "sandbox" : "live";
}

export function isPaddleConfigured(): boolean {
  return Boolean(clientToken);
}

let paddleInitialized = false;
let paddleInitPromise: Promise<void> | null = null;

export async function initializePaddle(): Promise<void> {
  if (paddleInitialized) return;
  if (paddleInitPromise) return paddleInitPromise;
  if (!clientToken) throw new Error("VITE_PAYMENTS_CLIENT_TOKEN is not set");

  paddleInitPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-paddle="v2"]') as HTMLScriptElement | null;
    const ready = () => {
      try {
        const env = getPaddleEnvironment() === "sandbox" ? "sandbox" : "production";
        window.Paddle.Environment.set(env);
        window.Paddle.Initialize({ token: clientToken });
        paddleInitialized = true;
        resolve();
      } catch (e) {
        reject(e);
      }
    };
    if (existing) {
      if ((window as any).Paddle) ready();
      else existing.addEventListener("load", ready, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.dataset.paddle = "v2";
    script.onload = ready;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return paddleInitPromise;
}

export async function getPaddlePriceId(priceId: string): Promise<string> {
  const environment = getPaddleEnvironment();
  const { data, error } = await supabase.functions.invoke("get-paddle-price", {
    body: { priceId, environment },
  });
  if (error || !data?.paddleId) throw new Error(`Failed to resolve price: ${priceId}`);
  return data.paddleId as string;
}
