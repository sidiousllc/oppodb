import { useState, useEffect, useRef, useCallback } from "react";
import { Win98Window } from "./Win98Window";
import { AOLIMWindow } from "./AOLIMWindow";
import { useAuth } from "@/contexts/AuthContext";
import { useMail } from "@/contexts/MailContext";
import { supabase } from "@/integrations/supabase/client";

interface OnlineUser {
  user_id: string;
  display_name: string;
  status: "online" | "away" | "offline";
  last_seen_at: string;
}

const STATUS_ICONS: Record<string, string> = {
  online: "🟢",
  away: "🟡",
  offline: "⚫",
};

export function AOLBuddyList() {
  const { user } = useAuth();
  const { openMail } = useMail();
  const [isOpen, setIsOpen] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [openChats, setOpenChats] = useState<Map<string, string>>(new Map()); // userId -> displayName
  const [unreadFrom, setUnreadFrom] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["Online"]));
  const [hasNewMail, setHasNewMail] = useState(true);
  const [soundPlaying, setSoundPlaying] = useState(false);
  const soundCacheRef = useRef<string | null>(null);
  const presenceInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const screenName = user?.email?.split("@")[0] || "Researcher";

  // Upsert own presence on mount and periodically
  useEffect(() => {
    if (!user) return;

    const upsertPresence = async () => {
      const displayName = user.email?.split("@")[0] || "User";
      await supabase.from("user_presence").upsert(
        {
          user_id: user.id,
          display_name: displayName,
          status: "online",
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    };

    upsertPresence();
    presenceInterval.current = setInterval(upsertPresence, 30000); // heartbeat every 30s

    // Set offline on unmount
    return () => {
      if (presenceInterval.current) clearInterval(presenceInterval.current);
      supabase
        .from("user_presence")
        .update({ status: "offline", last_seen_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .then();
    };
  }, [user]);

  // Load online users and subscribe to changes
  useEffect(() => {
    if (!user) return;

    const loadUsers = async () => {
      const { data } = await supabase
        .from("user_presence")
        .select("*")
        .neq("user_id", user.id)
        .order("last_seen_at", { ascending: false });

      if (data) {
        // Mark users as offline if last_seen > 60s ago
        const now = Date.now();
        const mapped = data.map((u) => {
          const lastSeen = new Date(u.last_seen_at).getTime();
          const stale = now - lastSeen > 60000;
          return {
            ...u,
            status: stale ? "offline" : u.status,
          } as OnlineUser;
        });
        setOnlineUsers(mapped);
      }
    };

    loadUsers();

    // Subscribe to presence changes
    const presenceChannel = supabase
      .channel("presence-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_presence" },
        () => {
          loadUsers();
        }
      )
      .subscribe();

    // Subscribe to incoming messages for unread indicators
    const msgChannel = supabase
      .channel("incoming-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        (payload) => {
          const msg = payload.new as { sender_id: string; receiver_id: string };
          if (msg.receiver_id === user.id) {
            // If chat window not open for this sender, mark as unread
            setOpenChats((prev) => {
              if (!prev.has(msg.sender_id)) {
                setUnreadFrom((u) => new Set(u).add(msg.sender_id));
              }
              return prev;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(msgChannel);
    };
  }, [user]);

  // Set away on visibility change
  useEffect(() => {
    if (!user) return;
    const handler = () => {
      const status = document.hidden ? "away" : "online";
      supabase
        .from("user_presence")
        .update({ status, last_seen_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .then();
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [user]);

  const openChat = useCallback((userId: string, displayName: string) => {
    setOpenChats((prev) => {
      const next = new Map(prev);
      next.set(userId, displayName);
      return next;
    });
    setUnreadFrom((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  }, []);

  const closeChat = useCallback((userId: string) => {
    setOpenChats((prev) => {
      const next = new Map(prev);
      next.delete(userId);
      return next;
    });
  }, []);

  function toggleGroup(label: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  async function playYouveGotMail() {
    if (soundPlaying) return;
    setSoundPlaying(true);
    try {
      if (soundCacheRef.current) {
        const audio = new Audio(soundCacheRef.current);
        await audio.play();
        setSoundPlaying(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
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
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            prompt:
              "Classic AOL 'You've Got Mail' announcement, cheerful male voice saying 'You've got mail!', 1990s computer notification sound, nostalgic dial-up era",
            duration: 3,
          }),
        }
      );
      if (!response.ok) {
        setSoundPlaying(false);
        return;
      }
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      soundCacheRef.current = audioUrl;
      const audio = new Audio(audioUrl);
      await audio.play();
    } catch (err) {
      console.warn("Could not play sound:", err);
    } finally {
      setSoundPlaying(false);
    }
  }

  const onlineList = onlineUsers.filter((u) => u.status === "online");
  const awayList = onlineUsers.filter((u) => u.status === "away");
  const offlineList = onlineUsers.filter((u) => u.status === "offline");

  const groups = [
    { label: "Online", users: onlineList, count: onlineList.length },
    { label: "Away", users: awayList, count: awayList.length },
    { label: "Offline", users: offlineList, count: offlineList.length },
  ];

  const totalOnline = onlineList.length + awayList.length;

  return (
    <>
      {/* Taskbar buddy icon */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-[32px] right-4 z-[997] win98-button flex items-center gap-1 text-[10px] h-[22px]"
        title="AOL Buddy List"
      >
        <span className="text-[12px]">👥</span>
        {unreadFrom.size > 0 && (
          <span className="text-[12px] animate-pulse">✉️</span>
        )}
        Buddy List
        {totalOnline > 0 && (
          <span className="text-[9px] opacity-70">({totalOnline})</span>
        )}
      </button>

      {/* Buddy List Window */}
      {isOpen && (
        <div className="fixed inset-0 z-[997] pointer-events-none">
          <div className="pointer-events-auto">
          <Win98Window
            title="AOL Buddy List™"
            icon={<span className="text-[10px]">👥</span>}
            onClose={() => setIsOpen(false)}
            defaultPosition={{ x: window.innerWidth - 220, y: window.innerHeight - 440 }}
            defaultSize={{ width: 200, height: 380 }}
            minSize={{ width: 160, height: 200 }}
            statusBar={
              <span className="text-[9px]">{totalOnline} buddies online</span>
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
                    onClick={() => { playYouveGotMail(); openMail(); }}
                    disabled={soundPlaying}
                    className="win98-button text-[9px] px-2 py-0 h-[16px] flex items-center gap-1"
                  >
                    <span className="text-[10px]">✉️</span>
                    {soundPlaying ? "Playing..." : "You've Got Mail!"}
                  </button>
                </div>
              </div>

              {/* Buddy groups */}
              <div className="flex-1 overflow-y-auto px-1 py-1">
                {onlineUsers.length === 0 && (
                  <div className="text-center text-[10px] text-[hsl(var(--muted-foreground))] py-4 italic">
                    No other users yet.
                    <br />
                    Share the app to see buddies!
                  </div>
                )}

                {groups.map(
                  (group) =>
                    group.users.length > 0 && (
                      <div key={group.label} className="mb-1">
                        <button
                          onClick={() => toggleGroup(group.label)}
                          className="flex items-center gap-1 w-full text-left text-[10px] font-bold py-[2px] px-1 hover:bg-[hsl(var(--win98-light))]"
                        >
                          <span className="text-[8px]">
                            {expandedGroups.has(group.label) ? "▼" : "►"}
                          </span>
                          {group.label} ({group.count})
                        </button>

                        {expandedGroups.has(group.label) && (
                          <div className="ml-3">
                            {group.users.map((buddy) => (
                              <div
                                key={buddy.user_id}
                                onDoubleClick={() =>
                                  buddy.status !== "offline" &&
                                  openChat(buddy.user_id, buddy.display_name)
                                }
                                className={`flex items-center gap-1 px-1 py-[1px] text-[10px] cursor-pointer hover:bg-[hsl(var(--win98-titlebar))] hover:text-white ${
                                  buddy.status === "offline" ? "opacity-50" : ""
                                }`}
                                title={
                                  buddy.status === "offline"
                                    ? "Offline"
                                    : "Double-click to send IM"
                                }
                              >
                                <span className="text-[7px]">
                                  {STATUS_ICONS[buddy.status]}
                                </span>
                                <span className="text-[10px]">👤</span>
                                <span
                                  className={
                                    buddy.status === "away" ? "italic" : ""
                                  }
                                >
                                  {buddy.display_name}
                                </span>
                                {unreadFrom.has(buddy.user_id) && (
                                  <span className="text-[10px] animate-pulse ml-auto">
                                    💬
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                )}
              </div>

              {/* Bottom buttons */}
              <div className="bg-[hsl(var(--win98-face))] border-t border-[hsl(var(--win98-shadow))] px-2 py-1 flex gap-1">
                <button className="win98-button text-[9px] flex-1 h-[18px]">
                  IM
                </button>
                <button className="win98-button text-[9px] flex-1 h-[18px]">
                  Info
                </button>
                <button className="win98-button text-[9px] flex-1 h-[18px]">
                  Setup
                </button>
              </div>
            </div>
          </Win98Window>
          </div>
        </div>
      )}

      {/* Open IM Windows */}
      {Array.from(openChats.entries()).map(([userId, name], index) => (
        <AOLIMWindow
          key={userId}
          recipientId={userId}
          recipientName={name}
          onClose={() => closeChat(userId)}
          position={index}
        />
      ))}
    </>
  );
}
