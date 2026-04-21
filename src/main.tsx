import { createRoot } from "react-dom/client";
import * as amplitude from "@amplitude/unified";
import { SpeedInsights } from "@vercel/speed-insights/react";
import App from "./App.tsx";
import { getSpeedInsightsConfig } from "@/lib/speedInsightsConfig";
import { getSessionReplayConfig } from "@/lib/sessionReplayConfig";
import "./index.css";
import "./themes.css";

// PWA: Guard against service worker registration in iframes and preview hosts
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
}

// Initialize Amplitude Analytics and Session Replay (sampled by environment)
const replay = getSessionReplayConfig();
amplitude.initAll("e8159d2da0817143b5c1f636427f8c2e", {
  analytics: { autocapture: true },
  sessionReplay: { sampleRate: replay.enabled ? replay.sampleRate : 0 },
});

const speedInsights = getSpeedInsightsConfig();
if (speedInsights.debug) {
  // eslint-disable-next-line no-console
  console.info("[SpeedInsights] config", speedInsights);
}

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    {speedInsights.enabled && (
      <SpeedInsights
        sampleRate={speedInsights.sampleRate}
        debug={speedInsights.debug}
      />
    )}
  </>
);

