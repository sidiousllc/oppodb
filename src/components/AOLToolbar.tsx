import { useState, useRef, useEffect } from "react";
import { ArrowLeft, ArrowRight, RotateCw, Home, Star, Mail, Send, Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Win98MenuBar } from "./Win98MenuBar";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/research-chat`;

async function streamChat({
  messages, onDelta, onDone, accessToken,
}: {
  messages: Msg[];
  onDelta: (text: string) => void;
  onDone: () => void;
  accessToken: string;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ messages }),
  });
  if (!resp.ok || !resp.body) throw new Error("Failed to start stream");
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let done = false;
  while (!done) {
    const { done: d, value } = await reader.read();
    if (d) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { done = true; break; }
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch {
        buf = line + "\n" + buf;
        break;
      }
    }
  }
  onDone();
}

interface AOLToolbarProps {
  onBack?: () => void;
  onRefresh?: () => void;
  currentSection?: string;
  currentSlug?: string | null;
}

export function AOLToolbar({ onBack, onRefresh, currentSection, currentSlug }: AOLToolbarProps) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build display URL
  const displayUrl = currentSlug
    ? `aol://ordb.research/${currentSection}/${currentSlug}`
    : `aol://ordb.research/${currentSection || "opposition-database"}`;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Close chat when clicking outside
  useEffect(() => {
    if (!chatOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".aol-chat-area")) {
        setChatOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [chatOpen]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    setInput("");
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setChatOpen(true);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: [...messages, userMsg],
        onDelta: upsert,
        onDone: () => setLoading(false),
        accessToken: session?.access_token ?? "",
      });
    } catch (e) {
      console.error(e);
      setLoading(false);
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    }
  };

  const handleInputFocus = () => {
    // When focusing, clear the URL and show placeholder
    if (!input && messages.length > 0) {
      setChatOpen(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      send();
    }
    if (e.key === "Escape") {
      setChatOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="bg-[hsl(var(--win98-face))] border-b-2 border-b-[hsl(var(--win98-shadow))]">
      {/* Menu bar */}
      <Win98MenuBar />

      {/* Navigation toolbar */}
      <div className="flex items-center gap-1 px-2 py-1">
        <button onClick={onBack} disabled={!onBack} className="win98-button flex flex-col items-center gap-0 px-2 py-0.5 text-[9px] disabled:opacity-40" title="Back">
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>
        <button onClick={() => window.history.forward()} className="win98-button flex flex-col items-center gap-0 px-2 py-0.5 text-[9px]" title="Forward">
          <ArrowRight className="h-4 w-4" />
          <span>Forward</span>
        </button>
        <button onClick={onRefresh || (() => window.location.reload())} className="win98-button flex flex-col items-center gap-0 px-2 py-0.5 text-[9px]" title="Refresh">
          <RotateCw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
        <button onClick={() => navigate("/")} className="win98-button flex flex-col items-center gap-0 px-2 py-0.5 text-[9px]" title="Home">
          <Home className="h-4 w-4" />
          <span>Home</span>
        </button>
        <button onClick={() => navigate("/profile")} className="win98-button flex flex-col items-center gap-0 px-2 py-0.5 text-[9px]" title="Favorites / Profile">
          <Star className="h-4 w-4" />
          <span>Favorites</span>
        </button>
        <button onClick={() => { const el = document.querySelector('[title="AOL Buddy List"]') as HTMLButtonElement; el?.click(); }} className="win98-button flex flex-col items-center gap-0 px-2 py-0.5 text-[9px]" title="Open Buddy List / Mail">
          <Mail className="h-4 w-4" />
          <span>Mail</span>
        </button>

        {/* AOL logo */}
        <div className="ml-auto flex items-center">
          <div className="w-[50px] h-[40px] flex items-center justify-center">
            <span className={`text-[28px] leading-none ${loading ? "animate-spin" : "animate-pulse"}`}>🌐</span>
          </div>
        </div>
      </div>

      {/* Address bar + Research Assistant */}
      <div className="relative aol-chat-area">
        <div className="flex items-center gap-1 px-2 py-1 border-t border-t-[hsl(var(--win98-highlight))]">
          <span className="text-[11px] font-bold whitespace-nowrap flex items-center gap-1">
            <Bot className="h-3 w-3" />
            Ask Jeeves
          </span>
          <div className="flex-1 win98-sunken bg-white px-1 py-[1px] flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={handleInputFocus}
              onKeyDown={handleKeyDown}
              placeholder={displayUrl}
              className="w-full bg-transparent text-[11px] outline-none border-none font-[Tahoma,sans-serif] text-black placeholder:text-[hsl(var(--muted-foreground))]"
              disabled={loading}
            />
          </div>
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="win98-button text-[11px] px-3 flex items-center gap-1 disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="h-2 w-2 animate-spin rounded-full border border-black border-t-transparent" />
                Searching...
              </>
            ) : (
              <>
                <Send className="h-3 w-3" />
                Ask
              </>
            )}
          </button>
          {messages.length > 0 && (
            <button
              onClick={() => setChatOpen(v => !v)}
              className="win98-button text-[9px] px-1"
              title="Toggle research results"
            >
              {chatOpen ? "▲" : "▼"}
            </button>
          )}
        </div>

        {/* Chat results dropdown */}
        {chatOpen && messages.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-[100] bg-[hsl(var(--win98-face))] win98-raised mx-2 mb-2" style={{ maxHeight: "400px" }}>
            {/* Results header */}
            <div className="win98-titlebar text-[10px] py-[2px] px-2 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Bot className="h-3 w-3" />
                Research Results — {messages.filter(m => m.role === "user").length} queries
              </span>
              <div className="flex gap-[2px]">
                <button
                  onClick={() => { setMessages([]); setChatOpen(false); }}
                  className="win98-titlebar-btn text-[8px]"
                  title="Clear history"
                >
                  🗑
                </button>
                <button
                  onClick={() => setChatOpen(false)}
                  className="win98-titlebar-btn"
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="overflow-y-auto bg-white p-2 space-y-2" style={{ maxHeight: "360px" }}>
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-1.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" && (
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center mt-0.5 text-[12px]">
                      🤖
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] px-2 py-1.5 text-[11px] ${
                      m.role === "user"
                        ? "bg-[hsl(var(--win98-titlebar))] text-white"
                        : "win98-sunken bg-[hsl(var(--win98-light))]"
                    }`}
                  >
                    {m.role === "assistant" ? (
                      <div className="prose-research text-[11px] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <span className="font-bold">{m.content}</span>
                    )}
                  </div>
                  {m.role === "user" && (
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center mt-0.5 text-[12px]">
                      👤
                    </div>
                  )}
                </div>
              ))}
              {loading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex gap-1.5">
                  <div className="text-[12px]">🤖</div>
                  <div className="win98-sunken bg-[hsl(var(--win98-light))] px-2 py-1.5 text-[11px] text-[hsl(var(--muted-foreground))] italic">
                    Searching the database...
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
