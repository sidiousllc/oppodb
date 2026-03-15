import { useState, useEffect, useRef } from "react";
import { Win98Window } from "./Win98Window";
import { useAuth } from "@/contexts/AuthContext";

interface Buddy {
  name: string;
  status: "online" | "away" | "offline";
  emoji: string;
}

const BUDDY_GROUPS: { label: string; buddies: Buddy[] }[] = [
  {
    label: "Research Team (4/7)",
    buddies: [
      { name: "DataAnalyst42", status: "online", emoji: "🔬" },
      { name: "OppoGuru", status: "online", emoji: "📊" },
      { name: "FieldOps_DC", status: "away", emoji: "🏛️" },
      { name: "PolicyWonk", status: "online", emoji: "📋" },
      { name: "MediaWatch", status: "offline", emoji: "📺" },
      { name: "DeepDive_01", status: "online", emoji: "🔎" },
      { name: "StatTracker", status: "offline", emoji: "📈" },
    ],
  },
  {
    label: "Leadership (2/3)",
    buddies: [
      { name: "CampaignDir", status: "online", emoji: "⭐" },
      { name: "CommsChief", status: "online", emoji: "📢" },
      { name: "StrategyLead", status: "offline", emoji: "🎯" },
    ],
  },
  {
    label: "Volunteers (1/5)",
    buddies: [
      { name: "CanvasserKY", status: "online", emoji: "🚶" },
      { name: "PhoneBankTX", status: "offline", emoji: "📞" },
      { name: "DoorKnockPA", status: "offline", emoji: "🚪" },
      { name: "DataEntryFL", status: "offline", emoji: "⌨️" },
      { name: "OutreachGA", status: "offline", emoji: "🤝" },
    ],
  },
];

const STATUS_ICONS: Record<string, string> = {
  online: "🟢",
  away: "🟡",
  offline: "⚫",
};

export function AOLBuddyList() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["Research Team (4/7)"]));
  const [hasNewMail, setHasNewMail] = useState(true);
  const [soundPlaying, setSoundPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const soundCacheRef = useRef<string | null>(null);

  // Play "You've Got Mail" on initial load
  useEffect(() => {
    if (hasNewMail && isOpen) {
      playYouveGotMail();
    }
  }, [isOpen]);

  async function playYouveGotMail() {
    if (soundPlaying) return;
    setSoundPlaying(true);

    try {
      // Use cached audio if available
      if (soundCacheRef.current) {
        const audio = new Audio(soundCacheRef.current);
        audioRef.current = audio;
        await audio.play();
        setSoundPlaying(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-sfx`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            prompt: "Classic AOL 'You've Got Mail' announcement, cheerful male voice saying 'You've got mail!', 1990s computer notification sound, nostalgic dial-up era",
            duration: 3,
          }),
        }
      );

      if (!response.ok) {
        console.warn("SFX generation failed:", response.status);
        setSoundPlaying(false);
        return;
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      soundCacheRef.current = audioUrl;

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      await audio.play();
    } catch (err) {
      console.warn("Could not play sound:", err);
    } finally {
      setSoundPlaying(false);
    }
  }

  function toggleGroup(label: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  const screenName = user?.email?.split("@")[0] || "Researcher";

  return (
    <>
      {/* Taskbar buddy icon */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className="fixed bottom-[32px] right-4 z-[997] win98-button flex items-center gap-1 text-[10px] h-[22px]"
        title="AOL Buddy List"
      >
        <span className="text-[12px]">👥</span>
        {hasNewMail && <span className="text-[12px] animate-pulse">✉️</span>}
        Buddy List
      </button>

      {/* Buddy List Window */}
      {isOpen && (
        <div className="fixed bottom-[56px] right-4 z-[997] w-[200px]" style={{ height: "380px" }}>
          <Win98Window
            title="AOL Buddy List™"
            icon={<span className="text-[10px]">👥</span>}
            onClose={() => setIsOpen(false)}
            className="h-full"
            statusBar={
              <span className="text-[9px]">
                {BUDDY_GROUPS.reduce((acc, g) => acc + g.buddies.filter(b => b.status === "online").length, 0)} buddies online
              </span>
            }
          >
            <div className="bg-white flex flex-col h-full">
              {/* Header */}
              <div className="bg-[hsl(var(--win98-face))] border-b border-[hsl(var(--win98-shadow))] px-2 py-1">
                <div className="text-[10px] font-bold text-center">
                  Welcome, {screenName}!
                </div>
                <div className="flex justify-center gap-1 mt-1">
                  <button
                    onClick={playYouveGotMail}
                    disabled={soundPlaying}
                    className="win98-button text-[9px] px-2 py-0 h-[16px] flex items-center gap-1"
                  >
                    {hasNewMail && <span className="text-[10px]">✉️</span>}
                    {soundPlaying ? "Playing..." : "You've Got Mail!"}
                  </button>
                </div>
              </div>

              {/* Buddy groups */}
              <div className="flex-1 overflow-y-auto px-1 py-1">
                {BUDDY_GROUPS.map(group => (
                  <div key={group.label} className="mb-1">
                    <button
                      onClick={() => toggleGroup(group.label)}
                      className="flex items-center gap-1 w-full text-left text-[10px] font-bold py-[2px] px-1 hover:bg-[hsl(var(--win98-light))]"
                    >
                      <span className="text-[8px]">{expandedGroups.has(group.label) ? "▼" : "►"}</span>
                      {group.label}
                    </button>

                    {expandedGroups.has(group.label) && (
                      <div className="ml-3">
                        {group.buddies
                          .sort((a, b) => {
                            const order = { online: 0, away: 1, offline: 2 };
                            return order[a.status] - order[b.status];
                          })
                          .map(buddy => (
                            <div
                              key={buddy.name}
                              className={`flex items-center gap-1 px-1 py-[1px] text-[10px] cursor-pointer hover:bg-[hsl(var(--win98-titlebar))] hover:text-white ${
                                buddy.status === "offline" ? "opacity-50" : ""
                              }`}
                            >
                              <span className="text-[7px]">{STATUS_ICONS[buddy.status]}</span>
                              <span>{buddy.emoji}</span>
                              <span className={buddy.status === "away" ? "italic" : ""}>
                                {buddy.name}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Bottom buttons */}
              <div className="bg-[hsl(var(--win98-face))] border-t border-[hsl(var(--win98-shadow))] px-2 py-1 flex gap-1">
                <button className="win98-button text-[9px] flex-1 h-[18px]">IM</button>
                <button className="win98-button text-[9px] flex-1 h-[18px]">Chat</button>
                <button className="win98-button text-[9px] flex-1 h-[18px]">Setup</button>
              </div>
            </div>
          </Win98Window>
        </div>
      )}
    </>
  );
}
