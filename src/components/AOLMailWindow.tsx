import { useState, useEffect, useCallback, useRef } from "react";
import { Win98Window } from "./Win98Window";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Inbox, Send, Trash2, PenLine, ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface MailMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  subject: string;
  body: string;
  read_at: string | null;
  created_at: string;
  sender_name?: string;
  recipient_name?: string;
}

interface OnlineUser {
  user_id: string;
  display_name: string;
}

type Folder = "inbox" | "sent" | "compose";

export function AOLMailWindow({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [folder, setFolder] = useState<Folder>("inbox");
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [selectedMsg, setSelectedMsg] = useState<MailMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Compose state
  const [recipientMode, setRecipientMode] = useState<"user" | "external">("user");
  const [toUserId, setToUserId] = useState("");
  const [toSearch, setToSearch] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [toSuggestions, setToSuggestions] = useState<OnlineUser[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendToEmail, setSendToEmail] = useState(false);
  const toInputRef = useRef<HTMLInputElement>(null);

  const loadUsers = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_presence")
      .select("user_id, display_name")
      .neq("user_id", user.id);
    if (data) setUsers(data);
  }, [user]);

  const loadMessages = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase.from("user_mail").select("*").order("created_at", { ascending: false });

    if (folder === "inbox") {
      query = query.eq("recipient_id", user.id).eq("deleted_by_recipient", false);
    } else if (folder === "sent") {
      query = query.eq("sender_id", user.id).eq("deleted_by_sender", false);
    }

    const { data } = await query;
    if (data) {
      // Enrich with display names
      const userIds = new Set<string>();
      data.forEach((m: any) => { userIds.add(m.sender_id); userIds.add(m.recipient_id); });
      const { data: presenceData } = await supabase
        .from("user_presence")
        .select("user_id, display_name")
        .in("user_id", Array.from(userIds));
      const nameMap = new Map<string, string>();
      presenceData?.forEach((p: any) => nameMap.set(p.user_id, p.display_name));

      const enriched = data.map((m: any) => ({
        ...m,
        sender_name: nameMap.get(m.sender_id) || "Unknown",
        recipient_name: nameMap.get(m.recipient_id) || "Unknown",
      }));
      setMessages(enriched);

      if (folder === "inbox") {
        setUnreadCount(enriched.filter((m: MailMessage) => !m.read_at).length);
      }
    }
    setLoading(false);
  }, [user, folder]);

  useEffect(() => { loadMessages(); loadUsers(); }, [loadMessages, loadUsers]);

  // Search users by display name or email for compose
  useEffect(() => {
    if (!user || toSearch.length < 1) {
      setToSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "search_users", query: toSearch },
      });
      if (!error && data?.users) {
        setToSuggestions(data.users.map((u: any) => ({
          user_id: u.user_id,
          display_name: u.display_name,
        })));
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [toSearch, user]);

  // Realtime subscription for new mail
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("mail-updates")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "user_mail",
      }, (payload) => {
        const msg = payload.new as any;
        if (msg.recipient_id === user.id) {
          loadMessages();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadMessages]);

  const handleRead = async (msg: MailMessage) => {
    setSelectedMsg(msg);
    if (!msg.read_at && msg.recipient_id === user?.id) {
      await supabase.from("user_mail").update({ read_at: new Date().toISOString() }).eq("id", msg.id);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read_at: new Date().toISOString() } : m));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const handleDelete = async (msgId: string) => {
    if (!user) return;
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;
    const update = msg.sender_id === user.id
      ? { deleted_by_sender: true }
      : { deleted_by_recipient: true };
    await supabase.from("user_mail").update(update).eq("id", msgId);
    setMessages(prev => prev.filter(m => m.id !== msgId));
    if (selectedMsg?.id === msgId) setSelectedMsg(null);
  };

  const handleSend = async () => {
    if (!user || !toUserId || !subject.trim() || !body.trim()) return;
    setSending(true);
    const { error: mailInsertError } = await supabase.from("user_mail").insert({
      sender_id: user.id,
      recipient_id: toUserId,
      subject: subject.trim().slice(0, 200),
      body: body.trim().slice(0, 5000),
    });

    if (mailInsertError) {
      console.error("Failed to send in-app mail", mailInsertError);
      toast.error("Failed to send message.");
      setSending(false);
      return;
    }

    // Optionally send email notification to recipient's personal email
    if (sendToEmail) {
      try {
        const { error } = await supabase.functions.invoke("send-mail-notification", {
          body: {
            recipientUserId: toUserId,
            subject: subject.trim().slice(0, 200),
            bodyText: body.trim().slice(0, 5000),
          },
        });
        if (error) {
          console.error("Failed to send email notification", error);
          toast.error("Message sent in-app, but email notification failed.");
        }
      } catch (err) {
        console.error("Failed to send email notification", err);
        toast.error("Message sent in-app, but email notification failed.");
      }
    }

    setSending(false);
    setToUserId("");
    setToSearch("");
    setSubject("");
    setBody("");
    setSendToEmail(false);
    setFolder("sent");
  };

  const handleReply = (msg: MailMessage) => {
    setFolder("compose");
    setToUserId(msg.sender_id);
    setToSearch(msg.sender_name || "");
    setSubject(msg.subject.startsWith("Re: ") ? msg.subject : `Re: ${msg.subject}`);
    setBody(`\n\n--- Original Message ---\nFrom: ${msg.sender_name}\nDate: ${new Date(msg.created_at).toLocaleString()}\n\n${msg.body}`);
    setSelectedMsg(null);
  };

  const handleForward = (msg: MailMessage) => {
    setFolder("compose");
    setToUserId("");
    setToSearch("");
    setSubject(msg.subject.startsWith("Fwd: ") ? msg.subject : `Fwd: ${msg.subject}`);
    setBody(`\n\n--- Forwarded Message ---\nFrom: ${msg.sender_name}\nDate: ${new Date(msg.created_at).toLocaleString()}\nSubject: ${msg.subject}\n\n${msg.body}`);
    setSelectedMsg(null);
  };

  const screenName = user?.email?.split("@")[0] || "User";

  return (
    <div className="fixed inset-0 z-[998] bg-black/30 pointer-events-none">
      <div className="pointer-events-auto">
        <Win98Window
          title={`ORDB Mail — ${screenName} ${unreadCount > 0 ? `(${unreadCount} new)` : ""}`}
          icon={<span className="text-[10px]">✉️</span>}
          onClose={onClose}
          defaultPosition={{ x: Math.round(window.innerWidth / 2 - 350), y: Math.round(window.innerHeight / 2 - 250) }}
          defaultSize={{ width: 700, height: 500 }}
          minSize={{ width: 400, height: 300 }}
          statusBar={
            <span className="text-[9px]">
              {folder === "inbox" ? `${messages.length} messages, ${unreadCount} unread` :
               folder === "sent" ? `${messages.length} sent messages` :
               "Compose new message"}
            </span>
          }
        >
          <div className="flex flex-col h-full bg-white">
            {/* Toolbar */}
            <div className="bg-[hsl(var(--win98-face))] border-b border-[hsl(var(--win98-shadow))] px-2 py-1 flex items-center gap-1">
              <button
                onClick={() => { setFolder("compose"); setSelectedMsg(null); setToUserId(""); setToSearch(""); setSubject(""); setBody(""); }}
                className="win98-button text-[9px] flex items-center gap-1 font-bold"
              >
                <PenLine className="h-3 w-3" /> Write
              </button>
              <div className="w-[1px] h-4 bg-[hsl(var(--win98-shadow))]" />
              <button
                onClick={() => { setFolder("inbox"); setSelectedMsg(null); }}
                className={`win98-button text-[9px] flex items-center gap-1 ${folder === "inbox" ? "font-bold" : ""}`}
              >
                <Inbox className="h-3 w-3" /> Inbox
                {unreadCount > 0 && <span className="text-[8px] font-bold">({unreadCount})</span>}
              </button>
              <button
                onClick={() => { setFolder("sent"); setSelectedMsg(null); }}
                className={`win98-button text-[9px] flex items-center gap-1 ${folder === "sent" ? "font-bold" : ""}`}
              >
                <Send className="h-3 w-3" /> Sent
              </button>
              <div className="w-[1px] h-4 bg-[hsl(var(--win98-shadow))]" />
              <button onClick={() => loadMessages()} className="win98-button text-[9px] flex items-center gap-1">
                <RefreshCw className="h-3 w-3" /> Check Mail
              </button>
              {selectedMsg && (
                <>
                  <div className="w-[1px] h-4 bg-[hsl(var(--win98-shadow))]" />
                  <button onClick={() => handleReply(selectedMsg)} className="win98-button text-[9px]">↩ Reply</button>
                  <button onClick={() => handleForward(selectedMsg)} className="win98-button text-[9px]">⏩ Forward</button>
                  <button onClick={() => handleDelete(selectedMsg.id)} className="win98-button text-[9px] flex items-center gap-1">
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {folder === "compose" ? (
                /* Compose view */
                <div className="flex-1 flex flex-col p-2 gap-1">
                  <div className="flex items-center gap-2 text-[10px] relative">
                    <span className="font-bold w-10">To:</span>
                    <div className="flex-1 relative">
                      <input
                        ref={toInputRef}
                        value={toSearch}
                        onChange={(e) => {
                          setToSearch(e.target.value);
                          setToUserId("");
                          setShowSuggestions(true);
                        }}
                        onFocus={() => toSearch.length > 0 && setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                        className="win98-input w-full text-[10px]"
                        placeholder="Type a screen name..."
                        maxLength={100}
                        autoComplete="off"
                      />
                      {showSuggestions && toSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-50 bg-white border border-[hsl(var(--win98-shadow))] shadow max-h-[120px] overflow-y-auto">
                          {toSuggestions.map(u => (
                            <button
                              key={u.user_id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setToUserId(u.user_id);
                                setToSearch(u.display_name);
                                setShowSuggestions(false);
                              }}
                              className="block w-full text-left px-2 py-1 text-[10px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white"
                            >
                              {u.display_name}
                            </button>
                          ))}
                        </div>
                      )}
                      {toSearch.length > 0 && toSuggestions.length === 0 && showSuggestions && !toUserId && (
                        <div className="absolute top-full left-0 right-0 z-50 bg-white border border-[hsl(var(--win98-shadow))] px-2 py-1 text-[9px] text-[hsl(var(--muted-foreground))]">
                          No users found
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="font-bold w-10">Subj:</span>
                    <input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="win98-input flex-1 text-[10px]"
                      placeholder="Subject"
                      maxLength={200}
                    />
                  </div>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="win98-input flex-1 text-[10px] font-[Tahoma,sans-serif] resize-none"
                    placeholder="Write your message here..."
                    maxLength={5000}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-1.5 text-[9px] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={sendToEmail}
                        onChange={(e) => setSendToEmail(e.target.checked)}
                        className="accent-[hsl(var(--win98-titlebar))]"
                      />
                      📧 Also send to their email
                    </label>
                    <button
                      onClick={handleSend}
                      disabled={sending || !toUserId || !subject.trim() || !body.trim()}
                      className="win98-button text-[10px] font-bold px-4 disabled:opacity-50"
                    >
                      {sending ? "Sending..." : "📤 Send"}
                    </button>
                  </div>
                </div>
              ) : selectedMsg ? (
                /* Read message view */
                <div className="flex-1 flex flex-col">
                  <div className="bg-[hsl(var(--win98-face))] border-b border-[hsl(var(--win98-shadow))] px-3 py-2 text-[10px] space-y-0.5">
                    <button onClick={() => setSelectedMsg(null)} className="win98-button text-[9px] mb-1 flex items-center gap-1">
                      <ArrowLeft className="h-3 w-3" /> Back to list
                    </button>
                    <div><span className="font-bold">From:</span> {selectedMsg.sender_name}</div>
                    <div><span className="font-bold">To:</span> {selectedMsg.recipient_name}</div>
                    <div><span className="font-bold">Date:</span> {new Date(selectedMsg.created_at).toLocaleString()}</div>
                    <div><span className="font-bold">Subject:</span> {selectedMsg.subject}</div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 text-[11px] whitespace-pre-wrap font-[Tahoma,sans-serif]">
                    {selectedMsg.body}
                  </div>
                </div>
              ) : (
                /* Message list */
                <div className="flex-1 overflow-y-auto">
                  {loading ? (
                    <div className="text-center py-8 text-[10px]">Loading mail...</div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-3xl mb-2">📭</div>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        {folder === "inbox" ? "No mail! Check back later." : "No sent messages."}
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="bg-[hsl(var(--win98-face))] border-b border-[hsl(var(--win98-shadow))]">
                          <th className="text-left px-2 py-1 font-bold w-6"></th>
                          <th className="text-left px-2 py-1 font-bold">
                            {folder === "inbox" ? "From" : "To"}
                          </th>
                          <th className="text-left px-2 py-1 font-bold">Subject</th>
                          <th className="text-left px-2 py-1 font-bold w-[120px]">Date</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {messages.map(msg => {
                          const isUnread = folder === "inbox" && !msg.read_at;
                          return (
                            <tr
                              key={msg.id}
                              onClick={() => handleRead(msg)}
                              className={`border-b border-[hsl(var(--win98-light))] cursor-pointer hover:bg-[hsl(var(--win98-titlebar))] hover:text-white ${isUnread ? "font-bold" : ""}`}
                            >
                              <td className="px-2 py-1 text-center text-[10px]">
                                {isUnread ? "✉️" : "📨"}
                              </td>
                              <td className="px-2 py-1 truncate max-w-[120px]">
                                {folder === "inbox" ? msg.sender_name : msg.recipient_name}
                              </td>
                              <td className="px-2 py-1 truncate max-w-[250px]">
                                {msg.subject || "(no subject)"}
                              </td>
                              <td className="px-2 py-1 text-[9px]">
                                {new Date(msg.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                              </td>
                              <td className="px-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDelete(msg.id); }}
                                  className="win98-button px-0.5 py-0 text-[8px]"
                                  title="Delete"
                                >
                                  <Trash2 className="h-2.5 w-2.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>
        </Win98Window>
      </div>
    </div>
  );
}
