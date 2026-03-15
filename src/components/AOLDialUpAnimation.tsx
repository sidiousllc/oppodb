import { useState, useEffect, useCallback } from "react";
import { Win98Window } from "./Win98Window";

interface AOLDialUpAnimationProps {
  onComplete: () => void;
}

const CONNECTION_STEPS = [
  { text: "Dialing...", detail: "📞 Dialing 1-800-AOL-ORDB", duration: 2200 },
  { text: "Handshaking...", detail: "🔊 kshhhhhhh... beeee brrrrr kshhh", duration: 2800 },
  { text: "Verifying username and password...", detail: "🔐 Authenticating with AOL network", duration: 1800 },
  { text: "Checking your mail...", detail: "✉️ Scanning mailbox...", duration: 1400 },
  { text: "Connected!", detail: "🌐 Welcome to the Opposition Research Database!", duration: 1600 },
];

const MODEM_NOISE_FRAMES = [
  "▒▓░▒▓▒░▓▒░▒▓░▒▓▒░▓",
  "░▒▓▒░▓░▒▓▒░▓▒░▒▓▒░",
  "▓░▒▓▒░▒▓░▒▓▒░▓░▒▓▒",
  "▒░▓▒░▒▓▒░▓░▒▓▒░▒▓░",
  "░▓▒░▒▓░▒▓▒░▓▒░▒▓▒░",
];

export function AOLDialUpAnimation({ onComplete }: AOLDialUpAnimationProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [noiseFrame, setNoiseFrame] = useState(0);
  const [showWelcome, setShowWelcome] = useState(false);
  const [progressPct, setProgressPct] = useState(0);

  // Animate modem noise
  useEffect(() => {
    if (currentStep < 2) {
      const interval = setInterval(() => {
        setNoiseFrame((f) => (f + 1) % MODEM_NOISE_FRAMES.length);
      }, 120);
      return () => clearInterval(interval);
    }
  }, [currentStep]);

  // Progress bar animation
  useEffect(() => {
    const totalDuration = CONNECTION_STEPS.reduce((s, step) => s + step.duration, 0);
    let elapsed = 0;
    for (let i = 0; i < currentStep; i++) elapsed += CONNECTION_STEPS[i].duration;
    const target = Math.min(((elapsed + CONNECTION_STEPS[currentStep]?.duration * 0.8) / totalDuration) * 100, 100);
    const timer = setTimeout(() => setProgressPct(target), 100);
    return () => clearTimeout(timer);
  }, [currentStep]);

  // Step through connection phases
  useEffect(() => {
    if (currentStep < CONNECTION_STEPS.length) {
      const timer = setTimeout(() => {
        if (currentStep === CONNECTION_STEPS.length - 1) {
          setProgressPct(100);
          setShowWelcome(true);
          setTimeout(onComplete, 1800);
        } else {
          setCurrentStep((s) => s + 1);
        }
      }, CONNECTION_STEPS[currentStep].duration);
      return () => clearTimeout(timer);
    }
  }, [currentStep, onComplete]);

  const skipAnimation = useCallback(() => {
    onComplete();
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[hsl(180,50%,50%)]">
      {/* Decorative AOL triangles / branding */}
      <div className="absolute top-4 left-4 text-white text-[11px] font-bold opacity-60">
        AOL Research Online
      </div>

      {showWelcome ? (
        /* Welcome splash */
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="text-[64px] leading-none">🌐</div>
          <div className="win98-raised bg-[hsl(var(--win98-face))] px-8 py-4 text-center">
            <p className="text-[18px] font-bold font-pixel text-[hsl(var(--primary))]">
              Welcome!
            </p>
            <p className="text-[11px] mt-1 text-[hsl(var(--muted-foreground))]">
              You've Got Research!
            </p>
          </div>
        </div>
      ) : (
        <Win98Window
          title="AOL Research Online — Connecting"
          icon={<span className="text-[12px]">📡</span>}
          className="w-full max-w-[420px]"
        >
          <div className="p-4 bg-[hsl(var(--win98-face))]">
            {/* AOL logo area */}
            <div className="flex items-center gap-3 mb-4">
              <div className="text-[40px] leading-none animate-pulse">🌐</div>
              <div>
                <h2 className="text-[13px] font-bold">AOL Research Online</h2>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  Opposition Research Database v4.0
                </p>
              </div>
            </div>

            {/* Connection status area */}
            <div className="win98-sunken bg-white p-3 mb-3">
              {/* Steps list */}
              <div className="space-y-1 mb-3">
                {CONNECTION_STEPS.map((step, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 text-[11px] transition-opacity duration-200 ${
                      i > currentStep ? "opacity-30" : i === currentStep ? "font-bold" : "opacity-70"
                    }`}
                  >
                    <span className="w-3 text-center">
                      {i < currentStep ? "✅" : i === currentStep ? "⏳" : "⬜"}
                    </span>
                    <span>{step.text}</span>
                  </div>
                ))}
              </div>

              {/* Detail / modem noise */}
              <div className="win98-sunken bg-black text-[hsl(120,100%,50%)] p-2 font-pixel text-[12px] min-h-[48px]">
                <p>{CONNECTION_STEPS[currentStep]?.detail}</p>
                {currentStep < 2 && (
                  <p className="mt-1 opacity-60 select-none">
                    {MODEM_NOISE_FRAMES[noiseFrame]}
                  </p>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-3">
              <div className="win98-sunken h-[18px] bg-white p-[2px]">
                <div
                  className="h-full bg-[hsl(var(--primary))] transition-all duration-700 ease-linear"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-[9px] text-center mt-1 text-[hsl(var(--muted-foreground))]">
                {Math.round(progressPct)}% — {CONNECTION_STEPS[currentStep]?.text}
              </p>
            </div>

            {/* Skip / Cancel */}
            <div className="flex justify-end">
              <button
                onClick={skipAnimation}
                className="win98-button text-[11px] px-4"
              >
                Skip
              </button>
            </div>
          </div>
        </Win98Window>
      )}
    </div>
  );
}
