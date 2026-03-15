import { useState, useEffect, useRef } from "react";
import { Win98Window } from "./Win98Window";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface IMWindowProps {
  recipientId: string;
  recipientName: string;
  onClose: () => void;
  position: number;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
}

export function AOLIMWindow({ recipientId, recipientName, onClose, position }: IMWindowProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const myName = user?.email?.split("@")[0] || "Me";

  // Load existing messages
  useEffect(() => {
    if (!user) return;

    const loadMessages = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${recipientId}),and(sender_id.eq.${recipientId},receiver_id.eq.${user.id})`
        )
        .order("created_at", { ascending: true })
        .limit(100);

      if (data) setMessages(data);

      // Mark received messages as read
      await supabase
        .from("chat_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("sender_id", recipientId)
        .eq("receiver_id", user.id)
        .is("read_at", null);
    };

    loadMessages();

    // Subscribe to new messages in this conversation
    const channel = supabase
      .channel(`im-${[user.id, recipientId].sort().join("-")}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        (payload) => {
          const msg = payload.new as ChatMessage;
          // Only add if it's part of this conversation
          if (
            (msg.sender_id === user.id && msg.receiver_id === recipientId) ||
            (msg.sender_id === recipientId && msg.receiver_id === user.id)
          ) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });

            // Mark as read if we received it
            if (msg.receiver_id === user.id) {
              supabase
                .from("chat_messages")
                .update({ read_at: new Date().toISOString() })
                .eq("id", msg.id)
                .then();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, recipientId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !user || sending) return;
    setSending(true);
    const content = input.trim();
    setInput("");

    const { error } = await supabase.from("chat_messages").insert({
      sender_id: user.id,
      receiver_id: recipientId,
      content,
    });

    if (error) {
      console.error("Failed to send message:", error);
      setInput(content); // Restore input on error
    }
    setSending(false);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  const rightOffset = 210 + position * 260;

  return (
    <div
      className="fixed bottom-[56px] z-[996]"
      style={{ right: `${rightOffset}px`, width: "250px", height: "320px" }}
    >
      <Win98Window
        title={`${recipientName} - Instant Message`}
        icon={<span className="text-[10px]">💬</span>}
        onClose={onClose}
        className="h-full"
      >
        <div className="flex flex-col h-full bg-white">
          {/* Warning banner */}
          <div className="bg-[#ffffcc] border-b border-[#cccc99] px-2 py-[2px] text-[9px] text-center">
            ⚠️ Never share your password in an IM
          </div>

          {/* Messages area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-2 py-1 text-[11px] font-[Tahoma,sans-serif]"
          >
            {messages.length === 0 && (
              <div className="text-center text-[10px] text-[hsl(var(--muted-foreground))] py-4 italic">
                No messages yet. Say hi! 👋
              </div>
            )}
            {messages.map((msg) => {
              const isMe = msg.sender_id === user?.id;
              return (
                <div key={msg.id} className="mb-1">
                  <span
                    className="font-bold"
                    style={{ color: isMe ? "#0000ff" : "#ff0000" }}
                  >
                    {isMe ? myName : recipientName}
                  </span>
                  <span className="text-[9px] text-[hsl(var(--muted-foreground))] ml-1">
                    ({formatTime(msg.created_at)})
                  </span>
                  <span>: {msg.content}</span>
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div className="h-[2px] bg-[hsl(var(--win98-shadow))]" />

          {/* Input area */}
          <div className="p-1">
            <div className="win98-sunken bg-white p-[2px]">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Type a message..."
                className="w-full h-[36px] resize-none text-[11px] outline-none border-none bg-transparent font-[Tahoma,sans-serif]"
                disabled={sending}
              />
            </div>
            <div className="flex justify-end gap-1 mt-1">
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending}
                className="win98-button text-[10px] px-3 disabled:opacity-50"
              >
                Send
              </button>
              <button
                onClick={onClose}
                className="win98-button text-[10px] px-3"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </Win98Window>
    </div>
  );
}
